/**
 * NeuralOS Unrestricted Operator Control System
 * Implements full-control & super-admin modes with no limits
 * 
 * @module operator-unlimited
 * @version 2.0.0
 */

export type OperatorRole = 'user' | 'operator' | 'full-control' | 'super-admin';
export type OrchestrationMode = 'no-limit' | 'coordinated';

export interface OperatorSession {
  role: OperatorRole;
  token: string;
  activatedAt: number;
  expiresAt: number | null; // null = never expires for super-admin
  metadata: {
    hostname: string;
    sessionId: string;
    operatorId: string;
    delegatedFrom?: string;
    commandCount: number;
    lastCommandAt: number;
    auditLog: Array<{ timestamp: number; action: string; details?: string }>;
  };
}

export interface MultiOperatorSession {
  activeSessions: Map<string, OperatorSession>;
  primarySession: string | null;
  orchestrationMode: OrchestrationMode;
  crossShellSync: boolean;
  delegationChain: Array<{ from: string; to: string; timestamp: number; capabilities?: string[] }>;
  createdAt: number;
  maxConcurrentSessions: number | null; // null = unlimited
}

export interface OperatorControl {
  enabled: boolean;
  currentRole: OperatorRole;
  session: OperatorSession | null;
  multiOperator: MultiOperatorSession | null;
  unlimitedMode: boolean;
  restrictedPermissions: Set<string>;
  noLimits: boolean;
  commandBypassCount: number;
  lastCommandBypass: number;
}

/**
 * Generate unique operator token
 */
export function generateOperatorToken(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'unknown';
  const hash = btoa(`${timestamp}${random}${hostname}`).substring(0, 8);
  return `op_${timestamp}_${hash}`;
}

/**
 * Generate unique session ID
 */
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create a new operator session with specified role
 */
export function createOperatorSession(role: OperatorRole, operatorId: string, delegatedFrom?: string): OperatorSession {
  const now = Date.now();
  
  // Expiry: super-admin never expires, full-control gets 1 hour, operator gets 30min, user gets none
  let expiresAt: number | null = null;
  switch (role) {
    case 'super-admin':
      expiresAt = null; // Never expires
      break;
    case 'full-control':
      expiresAt = now + 3600000; // 1 hour
      break;
    case 'operator':
      expiresAt = now + 1800000; // 30 minutes
      break;
    default:
      expiresAt = now; // User role expires immediately
  }

  return {
    role,
    token: generateOperatorToken(),
    activatedAt: now,
    expiresAt,
    metadata: {
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
      sessionId: generateSessionId(),
      operatorId,
      delegatedFrom,
      commandCount: 0,
      lastCommandAt: 0,
      auditLog: [{ timestamp: now, action: `session_created_${role}` }]
    }
  };
}

/**
 * Initialize multi-operator session manager
 */
export function initializeMultiOperatorSession(orchestrationMode: OrchestrationMode = 'no-limit'): MultiOperatorSession {
  return {
    activeSessions: new Map(),
    primarySession: null,
    orchestrationMode,
    crossShellSync: true,
    delegationChain: [],
    createdAt: Date.now(),
    maxConcurrentSessions: orchestrationMode === 'no-limit' ? null : 4
  };
}

/**
 * Initialize operator control state
 */
export function initializeOperatorControl(): OperatorControl {
  return {
    enabled: false,
    currentRole: 'user',
    session: null,
    multiOperator: null,
    unlimitedMode: false,
    restrictedPermissions: new Set(),
    noLimits: false,
    commandBypassCount: 0,
    lastCommandBypass: 0
  };
}

/**
 * Activate super-admin mode (no limits, no expiry)
 */
export function activateSuperAdmin(operatorId: string, control: OperatorControl): OperatorControl {
  const session = createOperatorSession('super-admin', operatorId);
  
  return {
    enabled: true,
    currentRole: 'super-admin',
    session,
    multiOperator: control.multiOperator || initializeMultiOperatorSession('no-limit'),
    unlimitedMode: true,
    restrictedPermissions: new Set(),
    noLimits: true,
    commandBypassCount: 0,
    lastCommandBypass: Date.now()
  };
}

/**
 * Activate full-control mode (1-hour expiry, no permission checks)
 */
export function activateFullControl(operatorId: string, control: OperatorControl): OperatorControl {
  const session = createOperatorSession('full-control', operatorId);
  
  return {
    enabled: true,
    currentRole: 'full-control',
    session,
    multiOperator: control.multiOperator || initializeMultiOperatorSession(),
    unlimitedMode: true,
    restrictedPermissions: new Set(),
    noLimits: false,
    commandBypassCount: 0,
    lastCommandBypass: Date.now()
  };
}

/**
 * Activate standard operator mode
 */
export function activateOperatorMode(operatorId: string, control: OperatorControl): OperatorControl {
  const session = createOperatorSession('operator', operatorId);
  
  return {
    enabled: true,
    currentRole: 'operator',
    session,
    multiOperator: control.multiOperator || initializeMultiOperatorSession('coordinated'),
    unlimitedMode: false,
    restrictedPermissions: new Set(['system.audit']),
    noLimits: false,
    commandBypassCount: 0,
    lastCommandBypass: Date.now()
  };
}

/**
 * Create concurrent operator session without terminating current
 */
export function createConcurrentSession(
  operatorId: string,
  role: OperatorRole,
  control: OperatorControl
): OperatorControl {
  if (!control.multiOperator) {
    control.multiOperator = initializeMultiOperatorSession();
  }

  const maxSessions = control.multiOperator.maxConcurrentSessions;
  if (maxSessions !== null && control.multiOperator.activeSessions.size >= maxSessions) {
    throw new Error(`Max concurrent sessions (${maxSessions}) reached`);
  }

  const session = createOperatorSession(role, operatorId);
  control.multiOperator.activeSessions.set(session.metadata.sessionId, session);

  // Set as primary if none exists
  if (!control.multiOperator.primarySession) {
    control.multiOperator.primarySession = session.metadata.sessionId;
  }

  return control;
}

/**
 * Switch primary operator
 */
export function switchPrimaryOperator(sessionId: string, control: OperatorControl): OperatorControl {
  if (!control.multiOperator) {
    throw new Error('Multi-operator not initialized');
  }

  if (!control.multiOperator.activeSessions.has(sessionId)) {
    throw new Error(`Session ${sessionId} not found`);
  }

  control.multiOperator.primarySession = sessionId;
  const session = control.multiOperator.activeSessions.get(sessionId);
  
  if (session) {
    control.currentRole = session.role;
    control.session = session;
  }

  return control;
}

/**
 * Delegate capabilities to another session
 */
export function delegateCapabilities(
  fromSessionId: string,
  toSessionId: string,
  capabilities: string[],
  control: OperatorControl
): OperatorControl {
  if (!control.multiOperator) {
    throw new Error('Multi-operator not initialized');
  }

  const fromSession = control.multiOperator.activeSessions.get(fromSessionId);
  const toSession = control.multiOperator.activeSessions.get(toSessionId);

  if (!fromSession || !toSession) {
    throw new Error('One or both sessions not found');
  }

  control.multiOperator.delegationChain.push({
    from: fromSessionId,
    to: toSessionId,
    timestamp: Date.now(),
    capabilities
  });

  // Add to audit log
  toSession.metadata.auditLog.push({
    timestamp: Date.now(),
    action: 'capability_delegated',
    details: `from ${fromSessionId} with ${capabilities.length} capabilities`
  });

  return control;
}

/**
 * Get all active operator sessions
 */
export function getActiveSessions(control: OperatorControl): OperatorSession[] {
  if (!control.multiOperator) {
    return control.session ? [control.session] : [];
  }
  return Array.from(control.multiOperator.activeSessions.values());
}

/**
 * Record operator action in audit log
 */
export function auditOperatorAction(
  control: OperatorControl,
  action: string,
  details?: string
): void {
  if (!control.session) return;

  control.session.metadata.auditLog.push({
    timestamp: Date.now(),
    action,
    details
  });

  // Also update in multi-operator sessions
  if (control.multiOperator) {
    const session = control.multiOperator.activeSessions.get(control.session.metadata.sessionId);
    if (session) {
      session.metadata.auditLog.push({
        timestamp: Date.now(),
        action,
        details
      });
    }
  }
}

/**
 * Check if operator has permission bypass capability
 */
export function canBypassPermission(control: OperatorControl): boolean {
  if (!control.enabled || !control.session) return false;
  
  // Super-admin and full-control always bypass
  if (control.session.role === 'super-admin' || control.session.role === 'full-control') {
    return true;
  }

  return false;
}

/**
 * Check if super-admin is active
 */
export function isSuperAdminActive(control: OperatorControl): boolean {
  return (
    control.enabled &&
    control.session !== null &&
    control.session.role === 'super-admin' &&
    control.noLimits === true
  );
}

/**
 * Check if full-control is active and not expired
 */
export function isFullControlActive(control: OperatorControl): boolean {
  return (
    control.enabled &&
    control.session !== null &&
    control.session.role === 'full-control' &&
    (control.session.expiresAt === null || control.session.expiresAt > Date.now()) &&
    control.unlimitedMode === true
  );
}

/**
 * Revoke all operator access
 */
export function revokeAllOperatorAccess(control: OperatorControl): OperatorControl {
  if (control.session) {
    control.session.metadata.auditLog.push({
      timestamp: Date.now(),
      action: 'access_revoked'
    });
  }

  return {
    enabled: false,
    currentRole: 'user',
    session: null,
    multiOperator: null,
    unlimitedMode: false,
    restrictedPermissions: new Set(),
    noLimits: false,
    commandBypassCount: 0,
    lastCommandBypass: 0
  };
}

/**
 * Sync operator sessions to other shells
 */
export async function syncOperatorSessionsToShells(
  control: OperatorControl,
  hostBridge?: any
): Promise<boolean> {
  if (!hostBridge || typeof hostBridge.syncOperatorState !== 'function') {
    return false;
  }

  try {
    const sessions = getActiveSessions(control);
    await hostBridge.syncOperatorState({
      sessions,
      primarySession: control.multiOperator?.primarySession || null,
      orchestrationMode: control.multiOperator?.orchestrationMode || 'no-limit',
      currentRole: control.currentRole,
      noLimits: control.noLimits
    });
    return true;
  } catch (error) {
    console.error('[OPERATOR] sync failed:', error);
    return false;
  }
}

/**
 * Persist operator control state to storage
 */
export function persistOperatorState(control: OperatorControl): void {
  if (typeof window === 'undefined') return;

  try {
    // Don't persist super-admin sessions to disk
    if (control.session?.role === 'super-admin') {
      window.localStorage.removeItem('neuralos.operator-state.v2');
      return;
    }

    const serializable = {
      enabled: control.enabled,
      currentRole: control.currentRole,
      session: control.session ? {
        ...control.session,
        metadata: {
          ...control.session.metadata,
          auditLog: control.session.metadata.auditLog.slice(-50) // Keep last 50 entries
        }
      } : null,
      unlimitedMode: control.unlimitedMode,
      noLimits: control.noLimits
    };

    window.localStorage.setItem('neuralos.operator-state.v2', JSON.stringify(serializable));
  } catch (error) {
    console.error('[OPERATOR] persist failed:', error);
  }
}

/**
 * Load operator control state from storage
 */
export function loadOperatorState(): OperatorControl | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.localStorage.getItem('neuralos.operator-state.v2');
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    if (!parsed.session) return null;

    // Reset sessions that have expired
    if (parsed.session.expiresAt && parsed.session.expiresAt < Date.now()) {
      return null;
    }

    return {
      enabled: parsed.enabled || false,
      currentRole: parsed.currentRole || 'user',
      session: parsed.session,
      multiOperator: null,
      unlimitedMode: parsed.unlimitedMode || false,
      restrictedPermissions: new Set(parsed.restrictedPermissions || []),
      noLimits: parsed.noLimits || false,
      commandBypassCount: 0,
      lastCommandBypass: 0
    };
  } catch (error) {
    console.error('[OPERATOR] load failed:', error);
    return null;
  }
}
