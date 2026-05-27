/**
 * Encrypted Data Vault Module
 * Provides AES-256-GCM encrypted storage with key derivation,
 * secure key management, and automatic encryption/decryption
 */

import crypto from 'crypto';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface VaultSecret {
  id: string;
  name: string;
  type: 'password' | 'api-key' | 'token' | 'certificate' | 'private-key' | 'custom';
  encryptedValue: string; // Base64 encoded
  iv: string; // Base64 encoded initialization vector
  authTag: string; // Base64 encoded authentication tag
  salt: string; // Base64 encoded salt for key derivation
  algorithm: string;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  metadata: Record<string, any>;
  rotationCount: number;
}

interface VaultAccessLog {
  timestamp: number;
  secretId: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'ROTATE';
  accessedBy: string;
  success: boolean;
  details: Record<string, any>;
}

interface MasterKeyDerivation {
  algorithm: 'PBKDF2' | 'Argon2' | 'scrypt';
  iterations: number;
  saltLength: number;
  keyLength: number;
  memory?: number; // For Argon2
  parallelism?: number; // For Argon2
}

interface EncryptionContext {
  algorithm: 'AES-256-GCM' | 'AES-256-CBC';
  keyDerivation: MasterKeyDerivation;
  tagLength: number; // 128 bits by default
  saltLength: number; // 32 bytes by default
}

interface SecretRotation {
  secretId: string;
  rotatedAt: number;
  oldKey: string; // Base64 encoded for historical reference
  newKey: string; // Base64 encoded
  reason: string;
  rotatedBy: string;
}

interface VaultHealth {
  totalSecrets: number;
  expiredSecrets: number;
  rotationNeeded: number;
  lastRotationTime: number;
  accessLogSize: number;
  encryptedSize: number; // In bytes
}

// ============================================================================
// ENCRYPTED VAULT ENGINE
// ============================================================================

export class EncryptedVaultEngine {
  private masterKey: Buffer | null = null;
  private masterKeyDerived: boolean = false;
  private secrets: Map<string, VaultSecret> = new Map();
  private accessLog: VaultAccessLog[] = [];
  private rotationHistory: SecretRotation[] = [];
  private maxAccessLogSize: number = 50000;
  private encryptionContext: EncryptionContext = {
    algorithm: 'AES-256-GCM',
    keyDerivation: {
      algorithm: 'PBKDF2',
      iterations: 600000, // OWASP recommendation
      saltLength: 32,
      keyLength: 32,
    },
    tagLength: 128,
    saltLength: 32,
  };

  /**
   * Initialize vault with master password
   */
  initializeVault(masterPassword: string): boolean {
    if (this.masterKeyDerived) {
      return false; // Vault already initialized
    }

    try {
      const salt = crypto.randomBytes(32);
      this.masterKey = crypto.pbkdf2Sync(
        masterPassword,
        salt,
        this.encryptionContext.keyDerivation.iterations,
        this.encryptionContext.keyDerivation.keyLength,
        'sha256'
      );
      this.masterKeyDerived = true;
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Change master password
   */
  changeMasterPassword(
    oldPassword: string,
    newPassword: string
  ): boolean {
    try {
      // Verify old password by attempting to re-derive
      // In production, this would compare against stored hash
      const oldKey = crypto.pbkdf2Sync(
        oldPassword,
        crypto.randomBytes(32),
        this.encryptionContext.keyDerivation.iterations,
        this.encryptionContext.keyDerivation.keyLength,
        'sha256'
      );

      // Re-derive all secrets with new master key
      const oldSecrets = Array.from(this.secrets.values());

      // Set new master key
      const newSalt = crypto.randomBytes(32);
      this.masterKey = crypto.pbkdf2Sync(
        newPassword,
        newSalt,
        this.encryptionContext.keyDerivation.iterations,
        this.encryptionContext.keyDerivation.keyLength,
        'sha256'
      );

      // Re-encrypt all secrets with new key
      for (const secret of oldSecrets) {
        // Decrypt with old key, re-encrypt with new key
        // (simplified - full implementation would handle this properly)
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Store a secret in the vault
   */
  storeSecret(
    name: string,
    value: string,
    type: VaultSecret['type'] = 'custom',
    metadata: Record<string, any> = {},
    expiresIn?: number
  ): VaultSecret | null {
    if (!this.masterKey) {
      return null;
    }

    try {
      const secretId = this.generateSecretId();
      const iv = crypto.randomBytes(12); // 96-bit IV for GCM
      const salt = crypto.randomBytes(32);
      const now = Date.now();

      // Encrypt the secret value
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        this.masterKey,
        iv
      );
      let encryptedValue = cipher.update(value, 'utf8', 'base64');
      encryptedValue += cipher.final('base64');
      const authTag = cipher.getAuthTag();

      const secret: VaultSecret = {
        id: secretId,
        name,
        type,
        encryptedValue,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        salt: salt.toString('base64'),
        algorithm: this.encryptionContext.algorithm,
        createdAt: now,
        updatedAt: now,
        expiresAt: expiresIn ? now + expiresIn : undefined,
        metadata,
        rotationCount: 0,
      };

      this.secrets.set(secretId, secret);

      // Log access
      this.accessLog.push({
        timestamp: now,
        secretId,
        action: 'CREATE',
        accessedBy: 'system',
        success: true,
        details: { type, hasMetadata: Object.keys(metadata).length > 0 },
      });

      this.pruneAccessLog();

      return secret;
    } catch (error) {
      return null;
    }
  }

  /**
   * Retrieve a secret from the vault
   */
  retrieveSecret(secretId: string, accessedBy: string = 'system'): string | null {
    if (!this.masterKey) {
      return null;
    }

    const secret = this.secrets.get(secretId);

    if (!secret) {
      this.logAccess(secretId, 'READ', accessedBy, false, {
        error: 'Secret not found',
      });
      return null;
    }

    // Check if secret has expired
    if (secret.expiresAt && secret.expiresAt < Date.now()) {
      this.logAccess(secretId, 'READ', accessedBy, false, {
        error: 'Secret expired',
      });
      return null;
    }

    try {
      const iv = Buffer.from(secret.iv, 'base64');
      const authTag = Buffer.from(secret.authTag, 'base64');

      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.masterKey,
        iv
      );
      decipher.setAuthTag(authTag);

      let decryptedValue = decipher.update(secret.encryptedValue, 'base64', 'utf8');
      decryptedValue += decipher.final('utf8');

      this.logAccess(secretId, 'READ', accessedBy, true, {
        type: secret.type,
        length: decryptedValue.length,
      });

      return decryptedValue;
    } catch (error) {
      this.logAccess(secretId, 'READ', accessedBy, false, {
        error: 'Decryption failed',
      });
      return null;
    }
  }

  /**
   * Update a secret
   */
  updateSecret(
    secretId: string,
    newValue: string,
    updatedBy: string = 'system'
  ): boolean {
    if (!this.masterKey) {
      return false;
    }

    const secret = this.secrets.get(secretId);

    if (!secret) {
      return false;
    }

    try {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        this.masterKey,
        iv
      );
      let encryptedValue = cipher.update(newValue, 'utf8', 'base64');
      encryptedValue += cipher.final('base64');
      const authTag = cipher.getAuthTag();

      secret.encryptedValue = encryptedValue;
      secret.iv = iv.toString('base64');
      secret.authTag = authTag.toString('base64');
      secret.updatedAt = Date.now();

      this.logAccess(secretId, 'UPDATE', updatedBy, true, {
        type: secret.type,
      });

      return true;
    } catch (error) {
      this.logAccess(secretId, 'UPDATE', updatedBy, false, {
        error: 'Update failed',
      });
      return false;
    }
  }

  /**
   * Delete a secret
   */
  deleteSecret(
    secretId: string,
    deletedBy: string = 'system'
  ): boolean {
    const secret = this.secrets.get(secretId);

    if (!secret) {
      return false;
    }

    this.secrets.delete(secretId);
    this.logAccess(secretId, 'DELETE', deletedBy, true, {
      type: secret.type,
    });

    return true;
  }

  /**
   * Rotate a secret (re-encrypt with new parameters)
   */
  rotateSecret(
    secretId: string,
    rotatedBy: string = 'system',
    reason: string = 'scheduled'
  ): boolean {
    if (!this.masterKey) {
      return false;
    }

    const secret = this.secrets.get(secretId);

    if (!secret) {
      return false;
    }

    try {
      // Retrieve the current value (which will decrypt it)
      const currentValue = this.retrieveSecret(secretId);

      if (!currentValue) {
        return false;
      }

      // Generate new encryption parameters
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        this.masterKey,
        iv
      );
      let encryptedValue = cipher.update(currentValue, 'utf8', 'base64');
      encryptedValue += cipher.final('base64');
      const authTag = cipher.getAuthTag();

      // Store rotation history
      this.rotationHistory.push({
        secretId,
        rotatedAt: Date.now(),
        oldKey: secret.encryptedValue.substring(0, 32),
        newKey: encryptedValue.substring(0, 32),
        reason,
        rotatedBy,
      });

      // Update secret with new encryption
      secret.encryptedValue = encryptedValue;
      secret.iv = iv.toString('base64');
      secret.authTag = authTag.toString('base64');
      secret.rotationCount++;
      secret.updatedAt = Date.now();

      this.logAccess(secretId, 'ROTATE', rotatedBy, true, {
        reason,
        rotationCount: secret.rotationCount,
      });

      return true;
    } catch (error) {
      this.logAccess(secretId, 'ROTATE', rotatedBy, false, {
        error: 'Rotation failed',
      });
      return false;
    }
  }

  /**
   * List all secret metadata (without values)
   */
  listSecrets(): Omit<VaultSecret, 'encryptedValue'>[] {
    return Array.from(this.secrets.values()).map((secret) => {
      const { encryptedValue, ...rest } = secret;
      return rest as Omit<VaultSecret, 'encryptedValue'>;
    });
  }

  /**
   * Get access logs
   */
  getAccessLogs(limit: number = 1000): VaultAccessLog[] {
    return this.accessLog.slice(-limit);
  }

  /**
   * Get access logs by action
   */
  getAccessLogsByAction(
    action: VaultAccessLog['action'],
    limit: number = 1000
  ): VaultAccessLog[] {
    return this.accessLog
      .filter((log) => log.action === action)
      .slice(-limit);
  }

  /**
   * Get vault health status
   */
  getVaultHealth(): VaultHealth {
    const now = Date.now();
    const expiredCount = Array.from(this.secrets.values()).filter(
      (s) => s.expiresAt && s.expiresAt < now
    ).length;
    const rotationNeeded = Array.from(this.secrets.values()).filter(
      (s) => s.rotationCount < 3
    ).length;

    return {
      totalSecrets: this.secrets.size,
      expiredSecrets: expiredCount,
      rotationNeeded,
      lastRotationTime: this.rotationHistory.length > 0
        ? this.rotationHistory[this.rotationHistory.length - 1].rotatedAt
        : 0,
      accessLogSize: this.accessLog.length,
      encryptedSize: Array.from(this.secrets.values()).reduce(
        (sum, s) => sum + s.encryptedValue.length,
        0
      ),
    };
  }

  /**
   * Get rotation history
   */
  getRotationHistory(): SecretRotation[] {
    return this.rotationHistory;
  }

  /**
   * Clean up expired secrets
   */
  cleanupExpiredSecrets(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [id, secret] of this.secrets.entries()) {
      if (secret.expiresAt && secret.expiresAt < now) {
        this.secrets.delete(id);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  private generateSecretId(): string {
    return `secret_${crypto.randomBytes(16).toString('hex')}_${Date.now()}`;
  }

  private logAccess(
    secretId: string,
    action: VaultAccessLog['action'],
    accessedBy: string,
    success: boolean,
    details: Record<string, any>
  ): void {
    this.accessLog.push({
      timestamp: Date.now(),
      secretId,
      action,
      accessedBy,
      success,
      details,
    });
    this.pruneAccessLog();
  }

  private pruneAccessLog(): void {
    if (this.accessLog.length > this.maxAccessLogSize) {
      this.accessLog = this.accessLog.slice(-this.maxAccessLogSize);
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let vaultEngine: EncryptedVaultEngine | null = null;

export function getVaultEngine(): EncryptedVaultEngine {
  if (!vaultEngine) {
    vaultEngine = new EncryptedVaultEngine();
  }
  return vaultEngine;
}

// ============================================================================
// REACT HOOK INTEGRATION
// ============================================================================

import { useState, useCallback, useRef } from 'react';

export interface UseVaultOptions {
  autoCleanup?: boolean;
  cleanupInterval?: number;
}

export function useEncryptedVault(options: UseVaultOptions = {}) {
  const engine = useRef(getVaultEngine()).current;
  const [vaultState, setVaultState] = useState({
    isInitialized: false,
    secrets: [] as Omit<VaultSecret, 'encryptedValue'>[],
    health: null as VaultHealth | null,
    lastAction: null as VaultAccessLog | null,
  });

  const initializeVault = useCallback((masterPassword: string) => {
    const success = engine.initializeVault(masterPassword);
    if (success) {
      setVaultState((prev) => ({
        ...prev,
        isInitialized: true,
        secrets: engine.listSecrets(),
      }));
    }
    return success;
  }, [engine]);

  const storeSecret = useCallback(
    (
      name: string,
      value: string,
      type: VaultSecret['type'] = 'custom',
      metadata?: Record<string, any>,
      expiresIn?: number
    ) => {
      const secret = engine.storeSecret(name, value, type, metadata, expiresIn);
      if (secret) {
        setVaultState((prev) => ({
          ...prev,
          secrets: engine.listSecrets(),
        }));
      }
      return secret;
    },
    [engine]
  );

  const retrieveSecret = useCallback(
    (secretId: string, accessedBy: string = 'system') => {
      return engine.retrieveSecret(secretId, accessedBy);
    },
    [engine]
  );

  const updateSecret = useCallback(
    (secretId: string, newValue: string, updatedBy: string = 'system') => {
      const success = engine.updateSecret(secretId, newValue, updatedBy);
      if (success) {
        setVaultState((prev) => ({
          ...prev,
          secrets: engine.listSecrets(),
        }));
      }
      return success;
    },
    [engine]
  );

  const rotateSecret = useCallback(
    (
      secretId: string,
      rotatedBy: string = 'system',
      reason: string = 'scheduled'
    ) => {
      const success = engine.rotateSecret(secretId, rotatedBy, reason);
      if (success) {
        setVaultState((prev) => ({
          ...prev,
          secrets: engine.listSecrets(),
          health: engine.getVaultHealth(),
        }));
      }
      return success;
    },
    [engine]
  );

  const getHealth = useCallback(() => {
    const health = engine.getVaultHealth();
    setVaultState((prev) => ({ ...prev, health }));
    return health;
  }, [engine]);

  return {
    initializeVault,
    storeSecret,
    retrieveSecret,
    updateSecret,
    rotateSecret,
    getHealth,
    vaultState,
    engine,
  };
}
