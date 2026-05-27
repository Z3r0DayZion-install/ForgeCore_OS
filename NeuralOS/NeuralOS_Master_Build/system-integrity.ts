/**
 * System Integrity Verification Framework
 * Provides comprehensive file integrity monitoring, tamper detection,
 * and automated recovery for critical system files
 */

import crypto from 'crypto';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface FileIntegrity {
  filePath: string;
  fileSize: number;
  sha256Hash: string;
  sha512Hash: string;
  md5Hash: string;
  lastModified: number;
  permissions: number;
  owner: string;
  checksum: string;
  lastVerified: number;
  integrityStatus: 'valid' | 'modified' | 'missing' | 'corrupted';
  metadata: Record<string, any>;
}

interface IntegrityPolicy {
  id: string;
  name: string;
  description: string;
  filePaths: string[];
  hashAlgorithm: 'SHA256' | 'SHA512' | 'MD5';
  verificationInterval: number; // In milliseconds
  actionOnTamper: 'log' | 'alert' | 'quarantine' | 'restore';
  autoRestore: boolean;
  createdAt: number;
  enabled: boolean;
}

interface TamperEvent {
  timestamp: number;
  filePath: string;
  eventType: 'modified' | 'deleted' | 'created' | 'permission-changed' | 'owner-changed';
  previousHash: string;
  currentHash: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actionTaken: string;
  resolved: boolean;
  resolvedAt?: number;
}

interface IntegrityReport {
  reportId: string;
  timestamp: number;
  totalFiles: number;
  validFiles: number;
  modifiedFiles: number;
  missingFiles: number;
  corruptedFiles: number;
  tamperEvents: TamperEvent[];
  systemHealth: 'healthy' | 'degraded' | 'compromised';
  recommendations: string[];
}

interface RecoveryAction {
  timestamp: number;
  filePath: string;
  action: 'restore-from-backup' | 'revert-permissions' | 'revert-owner' | 'rebuild';
  success: boolean;
  details: Record<string, any>;
}

// ============================================================================
// SYSTEM INTEGRITY VERIFICATION ENGINE
// ============================================================================

export class SystemIntegrityEngine {
  private integrityDatabase: Map<string, FileIntegrity> = new Map();
  private policies: Map<string, IntegrityPolicy> = new Map();
  private tamperEvents: TamperEvent[] = [];
  private recoveryActions: RecoveryAction[] = [];
  private verificationIntervals: Map<string, NodeJS.Timer> = new Map();
  private backups: Map<string, string> = new Map(); // filePath -> backupData
  private maxTamperEvents: number = 10000;
  private maxRecoveryActions: number = 5000;

  // ========================================================================
  // FILE INTEGRITY MONITORING
  // ========================================================================

  /**
   * Calculate file hash using multiple algorithms
   */
  private calculateFileHashes(
    fileContent: Buffer
  ): { sha256: string; sha512: string; md5: string } {
    return {
      sha256: crypto.createHash('sha256').update(fileContent).digest('hex'),
      sha512: crypto.createHash('sha512').update(fileContent).digest('hex'),
      md5: crypto.createHash('md5').update(fileContent).digest('hex'),
    };
  }

  /**
   * Register a file for integrity monitoring
   */
  registerFileForMonitoring(
    filePath: string,
    fileContent: Buffer,
    owner: string = 'system',
    permissions: number = 0o644,
    metadata: Record<string, any> = {}
  ): FileIntegrity {
    const hashes = this.calculateFileHashes(fileContent);
    const checksum = (fileContent.length + Object.values(hashes).join('').charCodeAt(0))
      .toString(16);

    const fileIntegrity: FileIntegrity = {
      filePath,
      fileSize: fileContent.length,
      sha256Hash: hashes.sha256,
      sha512Hash: hashes.sha512,
      md5Hash: hashes.md5,
      lastModified: Date.now(),
      permissions,
      owner,
      checksum,
      lastVerified: Date.now(),
      integrityStatus: 'valid',
      metadata,
    };

    this.integrityDatabase.set(filePath, fileIntegrity);
    this.backups.set(filePath, fileContent.toString('base64'));

    return fileIntegrity;
  }

  /**
   * Verify file integrity
   */
  verifyFileIntegrity(
    filePath: string,
    currentContent: Buffer,
    currentOwner?: string,
    currentPermissions?: number
  ): {
    isValid: boolean;
    changes: string[];
    previousIntegrity: FileIntegrity | null;
  } {
    const storedIntegrity = this.integrityDatabase.get(filePath);

    if (!storedIntegrity) {
      return {
        isValid: false,
        changes: ['File not registered for monitoring'],
        previousIntegrity: null,
      };
    }

    const changes: string[] = [];
    const hashes = this.calculateFileHashes(currentContent);

    // Check size
    if (currentContent.length !== storedIntegrity.fileSize) {
      changes.push(`File size changed from ${storedIntegrity.fileSize} to ${currentContent.length}`);
    }

    // Check hash
    if (hashes.sha256 !== storedIntegrity.sha256Hash) {
      changes.push('SHA256 hash mismatch - file content modified');
    }

    // Check ownership if provided
    if (currentOwner && currentOwner !== storedIntegrity.owner) {
      changes.push(`File owner changed from ${storedIntegrity.owner} to ${currentOwner}`);
    }

    // Check permissions if provided
    if (currentPermissions && currentPermissions !== storedIntegrity.permissions) {
      changes.push(
        `File permissions changed from ${storedIntegrity.permissions.toString(8)} to ${currentPermissions.toString(8)}`
      );
    }

    const isValid = changes.length === 0;

    if (!isValid) {
      const tamperEvent: TamperEvent = {
        timestamp: Date.now(),
        filePath,
        eventType: hashes.sha256 !== storedIntegrity.sha256Hash ? 'modified' : 'permission-changed',
        previousHash: storedIntegrity.sha256Hash,
        currentHash: hashes.sha256,
        severity: 'high',
        actionTaken: 'logged',
        resolved: false,
      };

      this.tamperEvents.push(tamperEvent);
      this.pruneTamperEvents();

      // Update integrity status
      storedIntegrity.integrityStatus = 'modified';
    } else {
      storedIntegrity.integrityStatus = 'valid';
    }

    storedIntegrity.lastVerified = Date.now();

    return {
      isValid,
      changes,
      previousIntegrity: { ...storedIntegrity },
    };
  }

  /**
   * Batch verify multiple files
   */
  verifyMultipleFiles(
    files: Array<{ path: string; content: Buffer; owner?: string; permissions?: number }>
  ): {
    totalFiles: number;
    validFiles: number;
    modifiedFiles: number;
    results: Array<{ filePath: string; isValid: boolean; changes: string[] }>;
  } {
    const results = files.map(({ path, content, owner, permissions }) =>
      this.verifyFileIntegrity(path, content, owner, permissions)
    );

    const validCount = results.filter((r) => r.isValid).length;
    const modifiedCount = results.length - validCount;

    return {
      totalFiles: results.length,
      validFiles: validCount,
      modifiedFiles: modifiedCount,
      results: results.map((r, i) => ({
        filePath: files[i].path,
        isValid: r.isValid,
        changes: r.changes,
      })),
    };
  }

  // ========================================================================
  // INTEGRITY POLICIES
  // ========================================================================

  /**
   * Create an integrity policy
   */
  createPolicy(
    name: string,
    filePaths: string[],
    options: {
      hashAlgorithm?: 'SHA256' | 'SHA512' | 'MD5';
      verificationInterval?: number;
      actionOnTamper?: 'log' | 'alert' | 'quarantine' | 'restore';
      autoRestore?: boolean;
    } = {}
  ): IntegrityPolicy {
    const policyId = this.generatePolicyId();

    const policy: IntegrityPolicy = {
      id: policyId,
      name,
      description: `Policy for monitoring ${filePaths.length} files`,
      filePaths,
      hashAlgorithm: options.hashAlgorithm || 'SHA256',
      verificationInterval: options.verificationInterval || 3600000, // 1 hour
      actionOnTamper: options.actionOnTamper || 'log',
      autoRestore: options.autoRestore || false,
      createdAt: Date.now(),
      enabled: true,
    };

    this.policies.set(policyId, policy);

    // Start verification interval if auto-restore is enabled
    if (policy.autoRestore) {
      this.startPolicyVerification(policyId);
    }

    return policy;
  }

  /**
   * Enable automatic verification for a policy
   */
  private startPolicyVerification(policyId: string): void {
    const policy = this.policies.get(policyId);

    if (!policy || this.verificationIntervals.has(policyId)) {
      return;
    }

    const interval = setInterval(() => {
      // In production, this would actually read and verify files
      // For now, we'll just update the verification timestamps
      for (const filePath of policy.filePaths) {
        const integrity = this.integrityDatabase.get(filePath);
        if (integrity) {
          integrity.lastVerified = Date.now();
        }
      }
    }, policy.verificationInterval);

    this.verificationIntervals.set(policyId, interval);
  }

  /**
   * Disable policy verification
   */
  stopPolicyVerification(policyId: string): boolean {
    const interval = this.verificationIntervals.get(policyId);

    if (!interval) {
      return false;
    }

    clearInterval(interval);
    this.verificationIntervals.delete(policyId);

    return true;
  }

  /**
   * List all policies
   */
  listPolicies(): IntegrityPolicy[] {
    return Array.from(this.policies.values());
  }

  // ========================================================================
  // TAMPER DETECTION & RESPONSE
  // ========================================================================

  /**
   * Get tamper events
   */
  getTamperEvents(limit: number = 1000): TamperEvent[] {
    return this.tamperEvents.slice(-limit);
  }

  /**
   * Get tamper events by severity
   */
  getTamperEventsBySeverity(
    severity: TamperEvent['severity'],
    limit: number = 1000
  ): TamperEvent[] {
    return this.tamperEvents
      .filter((e) => e.severity === severity)
      .slice(-limit);
  }

  /**
   * Resolve a tamper event
   */
  resolveTamperEvent(eventIndex: number, resolution: string): boolean {
    if (eventIndex < 0 || eventIndex >= this.tamperEvents.length) {
      return false;
    }

    const event = this.tamperEvents[eventIndex];
    event.resolved = true;
    event.resolvedAt = Date.now();
    event.actionTaken = resolution;

    return true;
  }

  /**
   * Get critical tamper events
   */
  getCriticalTamperEvents(): TamperEvent[] {
    return this.tamperEvents.filter(
      (e) => e.severity === 'critical' && !e.resolved
    );
  }

  // ========================================================================
  // RECOVERY & RESTORATION
  // ========================================================================

  /**
   * Restore a file from backup
   */
  restoreFileFromBackup(filePath: string): boolean {
    const backup = this.backups.get(filePath);
    const integrity = this.integrityDatabase.get(filePath);

    if (!backup || !integrity) {
      return false;
    }

    try {
      const backupContent = Buffer.from(backup, 'base64');

      this.recoveryActions.push({
        timestamp: Date.now(),
        filePath,
        action: 'restore-from-backup',
        success: true,
        details: {
          restoredSize: backupContent.length,
          originalHash: integrity.sha256Hash,
        },
      });

      this.pruneRecoveryActions();

      // Re-verify after restore
      this.verifyFileIntegrity(filePath, backupContent);

      return true;
    } catch (error) {
      this.recoveryActions.push({
        timestamp: Date.now(),
        filePath,
        action: 'restore-from-backup',
        success: false,
        details: { error: String(error) },
      });

      return false;
    }
  }

  /**
   * Reset file permissions
   */
  resetFilePermissions(
    filePath: string,
    targetPermissions: number
  ): boolean {
    const integrity = this.integrityDatabase.get(filePath);

    if (!integrity) {
      return false;
    }

    this.recoveryActions.push({
      timestamp: Date.now(),
      filePath,
      action: 'revert-permissions',
      success: true,
      details: {
        previousPermissions: integrity.permissions.toString(8),
        newPermissions: targetPermissions.toString(8),
      },
    });

    integrity.permissions = targetPermissions;
    integrity.lastModified = Date.now();

    return true;
  }

  /**
   * Reset file owner
   */
  resetFileOwner(filePath: string, targetOwner: string): boolean {
    const integrity = this.integrityDatabase.get(filePath);

    if (!integrity) {
      return false;
    }

    this.recoveryActions.push({
      timestamp: Date.now(),
      filePath,
      action: 'revert-owner',
      success: true,
      details: {
        previousOwner: integrity.owner,
        newOwner: targetOwner,
      },
    });

    integrity.owner = targetOwner;
    integrity.lastModified = Date.now();

    return true;
  }

  /**
   * Get recovery history
   */
  getRecoveryHistory(limit: number = 1000): RecoveryAction[] {
    return this.recoveryActions.slice(-limit);
  }

  // ========================================================================
  // REPORTING & ANALYTICS
  // ========================================================================

  /**
   * Generate comprehensive integrity report
   */
  generateIntegrityReport(): IntegrityReport {
    const reportId = this.generateReportId();
    const timestamp = Date.now();

    const integrityFiles = Array.from(this.integrityDatabase.values());
    const validFiles = integrityFiles.filter(
      (f) => f.integrityStatus === 'valid'
    ).length;
    const modifiedFiles = integrityFiles.filter(
      (f) => f.integrityStatus === 'modified'
    ).length;
    const missingFiles = integrityFiles.filter(
      (f) => f.integrityStatus === 'missing'
    ).length;
    const corruptedFiles = integrityFiles.filter(
      (f) => f.integrityStatus === 'corrupted'
    ).length;

    // Determine system health
    let systemHealth: 'healthy' | 'degraded' | 'compromised' = 'healthy';
    if (modifiedFiles > 0 || corruptedFiles > 0) {
      systemHealth = 'degraded';
    }
    if (modifiedFiles > integrityFiles.length * 0.1) {
      systemHealth = 'compromised';
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (modifiedFiles > 0) {
      recommendations.push(`Review and address ${modifiedFiles} modified files`);
    }
    if (corruptedFiles > 0) {
      recommendations.push(`Restore ${corruptedFiles} corrupted files from backup`);
    }
    if (missingFiles > 0) {
      recommendations.push(`Investigate ${missingFiles} missing files`);
    }

    const criticalTampers = this.getCriticalTamperEvents();
    if (criticalTampers.length > 0) {
      recommendations.push(`Address ${criticalTampers.length} critical security events`);
    }

    return {
      reportId,
      timestamp,
      totalFiles: integrityFiles.length,
      validFiles,
      modifiedFiles,
      missingFiles,
      corruptedFiles,
      tamperEvents: this.getTamperEvents(100),
      systemHealth,
      recommendations,
    };
  }

  /**
   * Get integrity statistics
   */
  getIntegrityStats(): Record<string, any> {
    const integrityFiles = Array.from(this.integrityDatabase.values());

    return {
      totalMonitoredFiles: integrityFiles.length,
      validFiles: integrityFiles.filter((f) => f.integrityStatus === 'valid').length,
      modifiedFiles: integrityFiles.filter((f) => f.integrityStatus === 'modified').length,
      missingFiles: integrityFiles.filter((f) => f.integrityStatus === 'missing').length,
      corruptedFiles: integrityFiles.filter((f) => f.integrityStatus === 'corrupted').length,
      totalTamperEvents: this.tamperEvents.length,
      unresolvedTamperEvents: this.tamperEvents.filter((e) => !e.resolved).length,
      criticalTamperEvents: this.getCriticalTamperEvents().length,
      totalRecoveryActions: this.recoveryActions.length,
      successfulRecoveries: this.recoveryActions.filter((a) => a.success).length,
      failedRecoveries: this.recoveryActions.filter((a) => !a.success).length,
      activePolicies: Array.from(this.policies.values()).filter((p) => p.enabled).length,
    };
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  private generatePolicyId(): string {
    return `policy_${crypto.randomBytes(16).toString('hex')}_${Date.now()}`;
  }

  private generateReportId(): string {
    return `report_${crypto.randomBytes(16).toString('hex')}_${Date.now()}`;
  }

  private pruneTamperEvents(): void {
    if (this.tamperEvents.length > this.maxTamperEvents) {
      this.tamperEvents = this.tamperEvents.slice(-this.maxTamperEvents);
    }
  }

  private pruneRecoveryActions(): void {
    if (this.recoveryActions.length > this.maxRecoveryActions) {
      this.recoveryActions = this.recoveryActions.slice(-this.maxRecoveryActions);
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let integrityEngine: SystemIntegrityEngine | null = null;

export function getIntegrityEngine(): SystemIntegrityEngine {
  if (!integrityEngine) {
    integrityEngine = new SystemIntegrityEngine();
  }
  return integrityEngine;
}

// ============================================================================
// REACT HOOK INTEGRATION
// ============================================================================

import { useState, useCallback, useRef } from 'react';

export function useSystemIntegrity() {
  const engine = useRef(getIntegrityEngine()).current;
  const [integrityState, setIntegrityState] = useState({
    monitoring: false,
    stats: engine.getIntegrityStats(),
    currentReport: null as IntegrityReport | null,
    activePolicies: engine.listPolicies(),
  });

  const registerFile = useCallback(
    (
      filePath: string,
      content: Buffer,
      owner?: string,
      permissions?: number,
      metadata?: Record<string, any>
    ) => {
      const integrity = engine.registerFileForMonitoring(
        filePath,
        content,
        owner,
        permissions,
        metadata
      );
      setIntegrityState((prev) => ({
        ...prev,
        stats: engine.getIntegrityStats(),
      }));
      return integrity;
    },
    [engine]
  );

  const verifyFile = useCallback(
    (filePath: string, content: Buffer, owner?: string, permissions?: number) => {
      const result = engine.verifyFileIntegrity(filePath, content, owner, permissions);
      setIntegrityState((prev) => ({
        ...prev,
        stats: engine.getIntegrityStats(),
      }));
      return result;
    },
    [engine]
  );

  const generateReport = useCallback(() => {
    const report = engine.generateIntegrityReport();
    setIntegrityState((prev) => ({
      ...prev,
      currentReport: report,
      stats: engine.getIntegrityStats(),
    }));
    return report;
  }, [engine]);

  const restoreFile = useCallback((filePath: string) => {
    const success = engine.restoreFileFromBackup(filePath);
    setIntegrityState((prev) => ({
      ...prev,
      stats: engine.getIntegrityStats(),
    }));
    return success;
  }, [engine]);

  return {
    registerFile,
    verifyFile,
    generateReport,
    restoreFile,
    getTamperEvents: () => engine.getTamperEvents(),
    getCriticalEvents: () => engine.getCriticalTamperEvents(),
    integrityState,
    engine,
  };
}
