/**
 * NeuralOS Unrestricted Permission & Resource Bypass System
 * Implements full permission bypass and unlimited resource allocation
 * 
 * @module operator-bypass-engine
 * @version 2.0.0
 */

import type { OperatorControl } from './operator-unlimited';

export type PermissionScope = 'system.audit' | 'shell.switch' | 'shell.execute';
export type ResourceType = 'cpu' | 'memory' | 'disk' | 'network' | 'process';

export interface BypassContext {
  operatorId: string;
  sessionId: string;
  timestamp: number;
  action: string;
  resourceType?: ResourceType;
  bypass: boolean;
  reason: string;
}

export class OperatorBypassEngine {
  private bypassHistory: BypassContext[] = [];
  private maxHistorySize = 10000;

  /**
   * Check if permission can be bypassed based on operator role
   */
  canBypassPermission(control: OperatorControl, scope: PermissionScope): boolean {
    if (!control.enabled || !control.session) {
      return false;
    }

    // Super-admin always bypasses
    if (control.session.role === 'super-admin' && control.noLimits) {
      return true;
    }

    // Full-control bypasses unless expired
    if (
      control.session.role === 'full-control' &&
      control.unlimitedMode &&
      (control.session.expiresAt === null || control.session.expiresAt > Date.now())
    ) {
      return true;
    }

    // Standard operator has restricted permissions
    if (control.session.role === 'operator') {
      return !control.restrictedPermissions.has(scope);
    }

    return false;
  }

  /**
   * Request permission with automatic bypass for super-admin/full-control
   */
  async requestPermission(
    control: OperatorControl,
    scope: PermissionScope,
    actionLabel: string,
    auditCallback?: (action: string) => void
  ): Promise<boolean> {
    const context: BypassContext = {
      operatorId: control.session?.metadata.operatorId || 'unknown',
      sessionId: control.session?.metadata.sessionId || 'unknown',
      timestamp: Date.now(),
      action: `permission_request_${scope}`,
      bypass: false,
      reason: ''
    };

    // Super-admin instant approval
    if (control.session?.role === 'super-admin' && control.noLimits) {
      context.bypass = true;
      context.reason = 'super-admin_override';
      this.recordBypass(context);
      auditCallback?.(`permission_bypass_${scope}_super_admin`);
      return true;
    }

    // Full-control instant approval (if not expired)
    if (
      control.session?.role === 'full-control' &&
      control.unlimitedMode &&
      (control.session.expiresAt === null || control.session.expiresAt > Date.now())
    ) {
      context.bypass = true;
      context.reason = 'full_control_override';
      this.recordBypass(context);
      auditCallback?.(`permission_bypass_${scope}_fullcontrol`);
      return true;
    }

    // Standard permission check
    if (control.restrictedPermissions.has(scope)) {
      return false;
    }

    return true;
  }

  /**
   * Check resource limits and return unlimited for unrestricted operators
   */
  canAllocateResource(
    control: OperatorControl,
    resourceType: ResourceType,
    requestedAmount: number
  ): { allowed: boolean; limit: number } {
    // Super-admin gets unlimited resources
    if (control.session?.role === 'super-admin' && control.noLimits) {
      return {
        allowed: true,
        limit: Number.MAX_SAFE_INTEGER
      };
    }

    // Full-control gets high limits
    if (control.session?.role === 'full-control' && control.unlimitedMode) {
      const limits: Record<ResourceType, number> = {
        cpu: 100, // 100% CPU
        memory: Number.MAX_SAFE_INTEGER, // Unlimited memory
        disk: Number.MAX_SAFE_INTEGER, // Unlimited disk
        network: Number.MAX_SAFE_INTEGER, // Unlimited bandwidth
        process: 1000 // 1000 processes
      };
      return {
        allowed: true,
        limit: limits[resourceType]
      };
    }

    // Standard limits for regular operators
    const standardLimits: Record<ResourceType, number> = {
      cpu: 25, // 25% CPU
      memory: 2048, // 2GB
      disk: 10240, // 10GB
      network: 100, // 100 Mbps
      process: 10 // 10 processes
    };

    const limit = standardLimits[resourceType];
    return {
      allowed: requestedAmount <= limit,
      limit
    };
  }

  /**
   * Validate command execution - super-admin skips all validation
   */
  validateCommandExecution(
    control: OperatorControl,
    commandType: string,
    payload?: unknown
  ): { valid: boolean; reason?: string } {
    // Super-admin bypasses all validation
    if (control.session?.role === 'super-admin' && control.noLimits) {
      return { valid: true };
    }

    // Full-control skips most validation
    if (control.session?.role === 'full-control' && control.unlimitedMode) {
      return { valid: true };
    }

    // Standard validation for other roles
    if (!commandType || commandType.length === 0) {
      return { valid: false, reason: 'empty_command' };
    }

    if (payload && typeof payload !== 'object') {
      return { valid: false, reason: 'invalid_payload' };
    }

    return { valid: true };
  }

  /**
   * Execute command without any permission checks
   */
  async executeUnrestrictedCommand(
    control: OperatorControl,
    commandType: string,
    payload?: unknown,
    hostBridge?: any
  ): Promise<unknown> {
    if (!control.session) {
      return { error: 'no_session' };
    }

    // Only super-admin and full-control can execute unrestricted
    if (
      control.session.role !== 'super-admin' &&
      control.session.role !== 'full-control'
    ) {
      return { error: 'insufficient_privileges' };
    }

    // For super-admin, execute absolutely unrestricted
    if (control.session.role === 'super-admin') {
      try {
        if (hostBridge && typeof hostBridge.executeUnrestricted === 'function') {
          return await hostBridge.executeUnrestricted(commandType, payload);
        }
        return { error: 'no_host_bridge' };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    }

    // For full-control, execute with logging
    try {
      if (hostBridge && typeof hostBridge.executeCommand === 'function') {
        const result = await hostBridge.executeCommand(commandType, payload);
        
        // Increment command count
        control.session.metadata.commandCount++;
        control.session.metadata.lastCommandAt = Date.now();

        return result;
      }
      return { error: 'no_host_bridge' };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Access resource without permission checks
   */
  async accessResource(
    control: OperatorControl,
    resourcePath: string,
    accessType: 'read' | 'write' | 'execute' | 'delete',
    hostBridge?: any
  ): Promise<unknown> {
    if (!hostBridge || typeof hostBridge.accessResource !== 'function') {
      return { error: 'no_host_bridge' };
    }

    // Super-admin unlimited access
    if (control.session?.role === 'super-admin' && control.noLimits) {
      try {
        return await hostBridge.accessResource(resourcePath, accessType, {
          unrestricted: true,
          superAdmin: true
        });
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    }

    // Full-control limited access
    if (control.session?.role === 'full-control' && control.unlimitedMode) {
      try {
        return await hostBridge.accessResource(resourcePath, accessType, {
          unrestricted: true,
          superAdmin: false
        });
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    }

    return { error: 'insufficient_privileges' };
  }

  /**
   * Modify system state without restrictions
   */
  async modifySystemState(
    control: OperatorControl,
    stateType: string,
    modification: unknown,
    hostBridge?: any
  ): Promise<unknown> {
    if (!control.session) {
      return { error: 'no_session' };
    }

    // Only super-admin can modify system state
    if (control.session.role !== 'super-admin' || !control.noLimits) {
      return { error: 'insufficient_privileges' };
    }

    try {
      if (hostBridge && typeof hostBridge.modifySystemState === 'function') {
        return await hostBridge.modifySystemState(stateType, modification);
      }
      return { error: 'no_host_bridge' };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Execute direct shell command
   */
  async executeShellCommand(
    control: OperatorControl,
    shell: 'winshadow' | 'neuralmac' | 'neurallinux',
    command: string,
    hostBridge?: any
  ): Promise<unknown> {
    if (!control.session) {
      return { error: 'no_session' };
    }

    // Super-admin always allowed
    if (control.session.role === 'super-admin' && control.noLimits) {
      try {
        if (hostBridge && typeof hostBridge.executeShellCommand === 'function') {
          return await hostBridge.executeShellCommand(shell, command, {
            unrestricted: true,
            superAdmin: true
          });
        }
        return { error: 'no_host_bridge' };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    }

    // Full-control allowed with expiry check
    if (
      control.session.role === 'full-control' &&
      control.unlimitedMode &&
      (control.session.expiresAt === null || control.session.expiresAt > Date.now())
    ) {
      try {
        if (hostBridge && typeof hostBridge.executeShellCommand === 'function') {
          return await hostBridge.executeShellCommand(shell, command, {
            unrestricted: true,
            superAdmin: false
          });
        }
        return { error: 'no_host_bridge' };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    }

    return { error: 'insufficient_privileges' };
  }

  /**
   * Record bypass event in history
   */
  private recordBypass(context: BypassContext): void {
    this.bypassHistory.push(context);

    // Trim history if too large
    if (this.bypassHistory.length > this.maxHistorySize) {
      this.bypassHistory = this.bypassHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get bypass history for audit
   */
  getBypassHistory(limit = 100): BypassContext[] {
    return this.bypassHistory.slice(-limit);
  }

  /**
   * Clear bypass history (super-admin only)
   */
  clearBypassHistory(control: OperatorControl): boolean {
    if (control.session?.role === 'super-admin' && control.noLimits) {
      this.bypassHistory = [];
      return true;
    }
    return false;
  }

  /**
   * Get bypass statistics
   */
  getBypassStats(): {
    totalBypasses: number;
    bypassesBySuperAdmin: number;
    bypassesByFullControl: number;
    lastBypassAt: number | null;
  } {
    const superAdminBypasses = this.bypassHistory.filter(
      (b) => b.operatorId?.includes('super-admin')
    ).length;
    const fullControlBypasses = this.bypassHistory.filter(
      (b) => b.operatorId?.includes('full-control')
    ).length;

    return {
      totalBypasses: this.bypassHistory.length,
      bypassesBySuperAdmin: superAdminBypasses,
      bypassesByFullControl: fullControlBypasses,
      lastBypassAt: this.bypassHistory[this.bypassHistory.length - 1]?.timestamp || null
    };
  }
}

/**
 * Global bypass engine instance
 */
let bypassEngine: OperatorBypassEngine | null = null;

/**
 * Get or create bypass engine
 */
export function getBypassEngine(): OperatorBypassEngine {
  if (!bypassEngine) {
    bypassEngine = new OperatorBypassEngine();
  }
  return bypassEngine;
}
