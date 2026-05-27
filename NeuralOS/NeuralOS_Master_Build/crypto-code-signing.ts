/**
 * Cryptographic Code Signing Module
 * Provides RSA-based code signing, verification, and certificate management
 * for all NeuralOS modules with integrity verification
 */

import crypto from 'crypto';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface SigningKeyPair {
  publicKey: string; // PEM format
  privateKey: string; // PEM format
  keyId: string;
  algorithm: 'RSA-SHA256' | 'RSA-SHA512' | 'ECDSA-SHA256';
  createdAt: number;
  expiresAt: number;
  metadata: Record<string, any>;
}

interface CodeSignature {
  signature: string; // Base64 encoded
  publicKeyId: string;
  algorithm: string;
  timestamp: number;
  moduleName: string;
  moduleHash: string;
  version: string;
  metadata?: Record<string, any>;
}

interface SigningCertificate {
  subject: string;
  issuer: string;
  publicKey: string;
  privateKey?: string;
  keyId: string;
  validFrom: number;
  validUntil: number;
  isRevoked: boolean;
  revokedAt?: number;
  algorithm: string;
  chain: SigningCertificate[];
}

interface SignatureVerificationResult {
  isValid: boolean;
  moduleName: string;
  moduleHash: string;
  timestamp: number;
  algorithm: string;
  keyId: string;
  verificationTime: number;
  error?: string;
  chainVerified: boolean;
}

interface SigningAuditEntry {
  timestamp: number;
  action: 'SIGN' | 'VERIFY' | 'KEY_GENERATED' | 'KEY_REVOKED' | 'CERT_ISSUED';
  moduleName?: string;
  keyId: string;
  success: boolean;
  details: Record<string, any>;
}

interface RevocationList {
  version: number;
  generated: number;
  nextUpdate: number;
  revokedKeys: Array<{ keyId: string; revokedAt: number; reason: string }>;
  revokedCerts: Array<{ certId: string; revokedAt: number; reason: string }>;
}

// ============================================================================
// CRYPTOGRAPHIC CODE SIGNING ENGINE
// ============================================================================

export class CryptoCodeSigningEngine {
  private keyStore: Map<string, SigningKeyPair> = new Map();
  private certificateStore: Map<string, SigningCertificate> = new Map();
  private revocationList: RevocationList = {
    version: 1,
    generated: Date.now(),
    nextUpdate: Date.now() + 86400000, // 24 hours
    revokedKeys: [],
    revokedCerts: [],
  };
  private auditLog: SigningAuditEntry[] = [];
  private maxAuditEntries: number = 10000;

  // ========================================================================
  // KEY MANAGEMENT
  // ========================================================================

  /**
   * Generate a new RSA or ECDSA key pair for code signing
   */
  generateKeyPair(
    algorithm: 'RSA-SHA256' | 'RSA-SHA512' | 'ECDSA-SHA256' = 'RSA-SHA256',
    expirationDays: number = 365
  ): string {
    // Generate key pair based on algorithm
    let { publicKey, privateKey } =
      algorithm.startsWith('RSA')
        ? crypto.generateKeyPairSync('rsa', {
            modulusLength: 4096,
            publicKeyEncoding: {
              type: 'spki',
              format: 'pem',
            },
            privateKeyEncoding: {
              type: 'pkcs8',
              format: 'pem',
            },
          })
        : crypto.generateKeyPairSync('ec', {
            namedCurve: 'prime256v1',
            publicKeyEncoding: {
              type: 'spki',
              format: 'pem',
            },
            privateKeyEncoding: {
              type: 'pkcs8',
              format: 'pem',
            },
          });

    // Generate unique key ID
    const keyId = this.generateKeyId();
    const now = Date.now();
    const expiresAt = now + expirationDays * 86400000;

    const keyPair: SigningKeyPair = {
      publicKey,
      privateKey,
      keyId,
      algorithm,
      createdAt: now,
      expiresAt,
      metadata: {
        modulus: algorithm.startsWith('RSA') ? 4096 : 256,
        purpose: 'code-signing',
      },
    };

    this.keyStore.set(keyId, keyPair);

    // Log to audit trail
    this.auditLog.push({
      timestamp: now,
      action: 'KEY_GENERATED',
      keyId,
      success: true,
      details: {
        algorithm,
        expirationDays,
        keyId,
      },
    });

    return keyId;
  }

  /**
   * Get a signing key pair by ID
   */
  getKeyPair(keyId: string): SigningKeyPair | null {
    const keyPair = this.keyStore.get(keyId);

    if (!keyPair) {
      return null;
    }

    // Check if key is expired
    if (keyPair.expiresAt < Date.now()) {
      return null;
    }

    // Check if key is revoked
    if (
      this.revocationList.revokedKeys.some((k) => k.keyId === keyId)
    ) {
      return null;
    }

    return keyPair;
  }

  /**
   * Revoke a signing key
   */
  revokeKey(keyId: string, reason: string = 'unspecified'): boolean {
    const keyPair = this.keyStore.get(keyId);

    if (!keyPair) {
      return false;
    }

    this.revocationList.revokedKeys.push({
      keyId,
      revokedAt: Date.now(),
      reason,
    });

    this.auditLog.push({
      timestamp: Date.now(),
      action: 'KEY_REVOKED',
      keyId,
      success: true,
      details: { reason },
    });

    return true;
  }

  /**
   * List all active keys
   */
  listActiveKeys(): SigningKeyPair[] {
    const now = Date.now();
    const revokedKeyIds = new Set(
      this.revocationList.revokedKeys.map((k) => k.keyId)
    );

    return Array.from(this.keyStore.values()).filter(
      (k) => k.expiresAt >= now && !revokedKeyIds.has(k.keyId)
    );
  }

  // ========================================================================
  // CODE SIGNING
  // ========================================================================

  /**
   * Sign module code with a private key
   */
  signCode(
    moduleCode: string,
    moduleName: string,
    keyId: string,
    version: string = '1.0.0'
  ): CodeSignature | null {
    const keyPair = this.getKeyPair(keyId);

    if (!keyPair) {
      this.auditLog.push({
        timestamp: Date.now(),
        action: 'SIGN',
        moduleN: moduleName,
        keyId,
        success: false,
        details: { error: 'Key not found or expired' },
      });
      return null;
    }

    // Calculate SHA-256 hash of module code
    const moduleHash = crypto
      .createHash('sha256')
      .update(moduleCode)
      .digest('hex');

    // Sign the hash
    const signer = crypto.createSign(
      keyPair.algorithm === 'RSA-SHA256' ? 'RSA-SHA256' : 'SHA256'
    );
    signer.update(moduleCode);
    const signature = signer.sign(keyPair.privateKey, 'base64');

    const timestamp = Date.now();

    const codeSignature: CodeSignature = {
      signature,
      publicKeyId: keyId,
      algorithm: keyPair.algorithm,
      timestamp,
      moduleName,
      moduleHash,
      version,
      metadata: {
        codeLength: moduleCode.length,
        signedAt: new Date(timestamp).toISOString(),
      },
    };

    // Log to audit trail
    this.auditLog.push({
      timestamp,
      action: 'SIGN',
      moduleName,
      keyId,
      success: true,
      details: {
        moduleHash,
        version,
        signatureLength: signature.length,
      },
    });

    return codeSignature;
  }

  /**
   * Verify a code signature
   */
  verifySignature(
    moduleCode: string,
    signature: CodeSignature
  ): SignatureVerificationResult {
    const startTime = Date.now();

    const keyPair = this.getKeyPair(signature.publicKeyId);

    if (!keyPair) {
      return {
        isValid: false,
        moduleName: signature.moduleName,
        moduleHash: signature.moduleHash,
        timestamp: signature.timestamp,
        algorithm: signature.algorithm,
        keyId: signature.publicKeyId,
        verificationTime: Date.now() - startTime,
        error: 'Key not found or expired',
        chainVerified: false,
      };
    }

    // Calculate current code hash
    const currentHash = crypto
      .createHash('sha256')
      .update(moduleCode)
      .digest('hex');

    // If hash doesn't match, code has been modified
    if (currentHash !== signature.moduleHash) {
      return {
        isValid: false,
        moduleName: signature.moduleName,
        moduleHash: signature.moduleHash,
        timestamp: signature.timestamp,
        algorithm: signature.algorithm,
        keyId: signature.publicKeyId,
        verificationTime: Date.now() - startTime,
        error: 'Code hash mismatch - code has been modified',
        chainVerified: false,
      };
    }

    // Verify the signature
    const verifier = crypto.createVerify(
      signature.algorithm === 'RSA-SHA256' ? 'RSA-SHA256' : 'SHA256'
    );
    verifier.update(moduleCode);
    const isValid = verifier.verify(
      keyPair.publicKey,
      signature.signature,
      'base64'
    );

    return {
      isValid,
      moduleName: signature.moduleName,
      moduleHash: signature.moduleHash,
      timestamp: signature.timestamp,
      algorithm: signature.algorithm,
      keyId: signature.publicKeyId,
      verificationTime: Date.now() - startTime,
      chainVerified: true,
    };
  }

  /**
   * Batch verify multiple signatures
   */
  verifyMultipleSignatures(
    codeModules: Array<{ code: string; signature: CodeSignature }>
  ): SignatureVerificationResult[] {
    return codeModules.map(({ code, signature }) =>
      this.verifySignature(code, signature)
    );
  }

  // ========================================================================
  // CERTIFICATE MANAGEMENT
  // ========================================================================

  /**
   * Issue a signing certificate
   */
  issueCertificate(
    subject: string,
    publicKey: string,
    validityDays: number = 365,
    issuer: string = 'NeuralOS-CA'
  ): SigningCertificate {
    const certId = this.generateCertificateId();
    const now = Date.now();
    const validUntil = now + validityDays * 86400000;

    const certificate: SigningCertificate = {
      subject,
      issuer,
      publicKey,
      keyId: certId,
      validFrom: now,
      validUntil,
      isRevoked: false,
      algorithm: 'RSA-SHA256',
      chain: [],
    };

    this.certificateStore.set(certId, certificate);

    this.auditLog.push({
      timestamp: now,
      action: 'CERT_ISSUED',
      keyId: certId,
      success: true,
      details: { subject, issuer, validityDays },
    });

    return certificate;
  }

  /**
   * Verify certificate chain
   */
  verifyCertificateChain(cert: SigningCertificate): boolean {
    const now = Date.now();

    // Check if certificate is within validity period
    if (cert.validFrom > now || cert.validUntil < now) {
      return false;
    }

    // Check if certificate is revoked
    if (
      cert.isRevoked ||
      this.revocationList.revokedCerts.some((c) => c.certId === cert.keyId)
    ) {
      return false;
    }

    // Recursively verify chain
    if (cert.chain.length > 0) {
      return cert.chain.every((c) => this.verifyCertificateChain(c));
    }

    return true;
  }

  /**
   * Revoke a certificate
   */
  revokeCertificate(certId: string, reason: string = 'unspecified'): boolean {
    const cert = this.certificateStore.get(certId);

    if (!cert) {
      return false;
    }

    cert.isRevoked = true;
    this.revocationList.revokedCerts.push({
      certId,
      revokedAt: Date.now(),
      reason,
    });

    this.auditLog.push({
      timestamp: Date.now(),
      action: 'CERT_REVOKED',
      keyId: certId,
      success: true,
      details: { reason },
    });

    return true;
  }

  // ========================================================================
  // AUDIT & REPORTING
  // ========================================================================

  /**
   * Get audit log entries
   */
  getAuditLog(limit: number = 1000): SigningAuditEntry[] {
    return this.auditLog.slice(-limit);
  }

  /**
   * Get audit logs by action type
   */
  getAuditLogByAction(
    action: SigningAuditEntry['action'],
    limit: number = 1000
  ): SigningAuditEntry[] {
    return this.auditLog
      .filter((e) => e.action === action)
      .slice(-limit);
  }

  /**
   * Get signing statistics
   */
  getSigningStats(): Record<string, any> {
    const totalEntries = this.auditLog.length;
    const signOperations = this.auditLog.filter((e) => e.action === 'SIGN');
    const verifyOperations = this.auditLog.filter((e) => e.action === 'VERIFY');
    const successfulSignings = signOperations.filter((e) => e.success).length;
    const successfulVerifications = verifyOperations.filter(
      (e) => e.success
    ).length;

    return {
      totalAuditEntries: totalEntries,
      totalSignings: signOperations.length,
      successfulSignings,
      failedSignings: signOperations.length - successfulSignings,
      totalVerifications: verifyOperations.length,
      successfulVerifications,
      failedVerifications:
        verifyOperations.length - successfulVerifications,
      activeKeys: this.listActiveKeys().length,
      revokedKeys: this.revocationList.revokedKeys.length,
      revokedCertificates: this.revocationList.revokedCerts.length,
    };
  }

  /**
   * Export revocation list
   */
  exportRevocationlist(): RevocationList {
    return {
      ...this.revocationList,
      generated: Date.now(),
      nextUpdate: Date.now() + 86400000,
    };
  }

  /**
   * Update revocation list from remote
   */
  updateRevocationList(remoteList: RevocationList): void {
    this.revocationList = remoteList;
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  private generateKeyId(): string {
    return `key_${crypto.randomBytes(16).toString('hex')}_${Date.now()}`;
  }

  private generateCertificateId(): string {
    return `cert_${crypto.randomBytes(16).toString('hex')}_${Date.now()}`;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let signingEngine: CryptoCodeSigningEngine | null = null;

export function getSigningEngine(): CryptoCodeSigningEngine {
  if (!signingEngine) {
    signingEngine = new CryptoCodeSigningEngine();
  }
  return signingEngine;
}

// ============================================================================
// REACT HOOK INTEGRATION
// ============================================================================

import { useState, useCallback, useRef } from 'react';

export interface UseCodeSigningOptions {
  autoVerify?: boolean;
  persistSignatures?: boolean;
}

export function useCodeSigning(options: UseCodeSigningOptions = {}) {
  const engine = useRef(getSigningEngine()).current;
  const [signingState, setSigningState] = useState({
    isSigningActive: false,
    lastSignKey: null as string | null,
    verificationResults: [] as SignatureVerificationResult[],
    stats: engine.getSigningStats(),
  });

  const generateKey = useCallback(
    (algorithm: 'RSA-SHA256' | 'RSA-SHA512' | 'ECDSA-SHA256' = 'RSA-SHA256',
      expirationDays: number = 365
    ) => {
      const keyId = engine.generateKeyPair(algorithm, expirationDays);
      setSigningState((prev) => ({ ...prev, lastSignKey: keyId }));
      return keyId;
    },
    [engine]
  );

  const signModule = useCallback(
    (code: string, moduleName: string, keyId: string, version?: string) => {
      const signature = engine.signCode(code, moduleName, keyId, version);
      setSigningState((prev) => ({
        ...prev,
        stats: engine.getSigningStats(),
      }));
      return signature;
    },
    [engine]
  );

  const verifyModule = useCallback(
    (code: string, signature: CodeSignature) => {
      const result = engine.verifySignature(code, signature);
      setSigningState((prev) => ({
        ...prev,
        verificationResults: [...prev.verificationResults, result],
        stats: engine.getSigningStats(),
      }));
      return result;
    },
    [engine]
  );

  const getStats = useCallback(
    () => engine.getSigningStats(),
    [engine]
  );

  return {
    generateKey,
    signModule,
    verifyModule,
    getStats,
    signingState,
    engine,
  };
}
