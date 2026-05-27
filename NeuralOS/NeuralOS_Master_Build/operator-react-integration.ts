/**
 * NeuralOS Operator Control React Integration
 * Provides React hooks and utilities for UI integration
 * 
 * @module operator-react-integration
 * @version 2.0.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { OperatorControl, OperatorSession } from './operator-unlimited';
import * as Unlimited from './operator-unlimited';
import { getBypassEngine } from './operator-bypass-engine';
import { getOrchestrator } from './operator-orchestration';

/**
 * Hook for managing operator control state
 */
export function useOperatorControl() {
  const [control, setControl] = useState<OperatorControl>(() => {
    const stored = Unlimited.loadOperatorState();
    return stored || Unlimited.initializeOperatorControl();
  });

  const persistRef = useRef<NodeJS.Timeout>();

  // Persist changes
  useEffect(() => {
    if (persistRef.current) {
      clearTimeout(persistRef.current);
    }

    persistRef.current = setTimeout(() => {
      Unlimited.persistOperatorState(control);
    }, 500);

    return () => {
      if (persistRef.current) {
        clearTimeout(persistRef.current);
      }
    };
  }, [control]);

  const activateSuperAdmin = useCallback((operatorId: string) => {
    setControl((prev) => Unlimited.activateSuperAdmin(operatorId, prev));
  }, []);

  const activateFullControl = useCallback((operatorId: string) => {
    setControl((prev) => Unlimited.activateFullControl(operatorId, prev));
  }, []);

  const activateOperatorMode = useCallback((operatorId: string) => {
    setControl((prev) => Unlimited.activateOperatorMode(operatorId, prev));
  }, []);

  const createConcurrentSession = useCallback((operatorId: string, role: Unlimited.OperatorRole) => {
    try {
      setControl((prev) => Unlimited.createConcurrentSession(operatorId, role, prev));
    } catch (error) {
      console.error('[OPERATOR] concurrent session failed:', error);
    }
  }, []);

  const switchPrimaryOperator = useCallback((sessionId: string) => {
    try {
      setControl((prev) => Unlimited.switchPrimaryOperator(sessionId, prev));
    } catch (error) {
      console.error('[OPERATOR] switch primary failed:', error);
    }
  }, []);

  const revokeAccess = useCallback(() => {
    setControl((prev) => Unlimited.revokeAllOperatorAccess(prev));
  }, []);

  const getActiveSessions = useCallback(() => {
    return Unlimited.getActiveSessions(control);
  }, [control]);

  return {
    control,
    setControl,
    activateSuperAdmin,
    activateFullControl,
    activateOperatorMode,
    createConcurrentSession,
    switchPrimaryOperator,
    revokeAccess,
    getActiveSessions,
    isSuperAdminActive: Unlimited.isSuperAdminActive(control),
    isFullControlActive: Unlimited.isFullControlActive(control),
    canBypassPermission: Unlimited.canBypassPermission(control)
  };
}

/**
 * Hook for permission bypass checking
 */
export function usePermissionBypass(control: OperatorControl | null) {
  const engine = getBypassEngine();

  const canBypassPermission = useCallback(
    (scope: string) => {
      if (!control) return false;
      return engine.canBypassPermission(
        control,
        scope as Unlimited.PermissionScope
      );
    },
    [control, engine]
  );

  const requestPermission = useCallback(
    async (scope: string, actionLabel: string) => {
      if (!control) return false;
      return engine.requestPermission(
        control,
        scope as Unlimited.PermissionScope,
        actionLabel
      );
    },
    [control, engine]
  );

  const getBypassStats = useCallback(() => {
    return engine.getBypassStats();
  }, [engine]);

  return { canBypassPermission, requestPermission, getBypassStats };
}

/**
 * Hook for command execution in unrestricted mode
 */
export function useUnrestrictedExecution(hostBridge?: any) {
  const engine = getBypassEngine();
  const orchestrator = getOrchestrator();
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const executeUnrestricted = useCallback(
    async (control: OperatorControl, commandType: string, payload?: unknown) => {
      setIsExecuting(true);
      setLastError(null);

      try {
        const result = await engine.executeUnrestrictedCommand(
          control,
          commandType,
          payload,
          hostBridge
        );

        if (result.error) {
          setLastError(result.error as string);
        } else {
          // Record in audit log
          Unlimited.auditOperatorAction(control, 'command_executed', commandType);
        }

        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setLastError(errorMsg);
        Unlimited.auditOperatorAction(control, 'command_failed', errorMsg);
        return { error: errorMsg };
      } finally {
        setIsExecuting(false);
      }
    },
    [engine, hostBridge]
  );

  const executeShellCommand = useCallback(
    async (
      control: OperatorControl,
      shell: 'winshadow' | 'neuralmac' | 'neurallinux',
      command: string
    ) => {
      setIsExecuting(true);
      setLastError(null);

      try {
        const result = await engine.executeShellCommand(
          control,
          shell,
          command,
          hostBridge
        );

        if (result.error) {
          setLastError(result.error as string);
        }

        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setLastError(errorMsg);
        return { error: errorMsg };
      } finally {
        setIsExecuting(false);
      }
    },
    [engine, hostBridge]
  );

  return {
    executeUnrestricted,
    executeShellCommand,
    isExecuting,
    lastError,
    clearError: () => setLastError(null)
  };
}

/**
 * Hook for orchestration and multi-operator management
 */
export function useOrchestration(control: OperatorControl) {
  const orchestrator = getOrchestrator();
  const [execStats, setExecStats] = useState(() => orchestrator.getExecutionStats());

  const updateStats = useCallback(() => {
    setExecStats(orchestrator.getExecutionStats());
  }, [orchestrator]);

  const queueCommand = useCallback(
    (commandType: string, priority?: number, estimatedDuration?: number) => {
      try {
        const commandId = orchestrator.queueCommand(
          control,
          commandType,
          priority,
          estimatedDuration
        );
        updateStats();
        return commandId;
      } catch (error) {
        console.error('[ORCHESTRATOR] queue failed:', error);
        return null;
      }
    },
    [control, orchestrator, updateStats]
  );

  const executeQueued = useCallback(
    async (hostBridge?: any) => {
      const results = await orchestrator.executeQueued(control, hostBridge);
      updateStats();
      return results;
    },
    [control, orchestrator, updateStats]
  );

  const cancelQueued = useCallback(() => {
    if (control.session) {
      const cancelled = orchestrator.cancelQueuedCommands(
        control.session.metadata.sessionId
      );
      updateStats();
      return cancelled;
    }
    return 0;
  }, [control, orchestrator, updateStats]);

  return {
    queueCommand,
    executeQueued,
    cancelQueued,
    execStats,
    statusReport: orchestrator.getStatusReport()
  };
}

/**
 * Hook for cross-shell synchronization
 */
export function useCrossShellSync(control: OperatorControl, hostBridge?: any) {
  const orchestrator = getOrchestrator();
  const [syncStatus, setSyncStatus] = useState(() => orchestrator.getSyncState());
  const [isSyncing, setIsSyncing] = useState(false);

  const syncToAllShells = useCallback(async () => {
    setIsSyncing(true);
    try {
      await orchestrator.syncToAllShells(control, hostBridge);
      setSyncStatus(orchestrator.getSyncState());
    } catch (error) {
      console.error('[SYNC] failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [control, orchestrator, hostBridge]);

  const syncToShell = useCallback(
    async (shell: 'winshadow' | 'neuralmac' | 'neurallinux') => {
      setIsSyncing(true);
      try {
        await orchestrator.syncToShell(shell, control, hostBridge);
        setSyncStatus(orchestrator.getSyncState());
      } catch (error) {
        console.error('[SYNC] shell sync failed:', error);
      } finally {
        setIsSyncing(false);
      }
    },
    [control, orchestrator, hostBridge]
  );

  return {
    syncToAllShells,
    syncToShell,
    syncStatus,
    isSyncing
  };
}

/**
 * Status indicator component props
 */
export interface OperatorStatusIndicatorProps {
  control: OperatorControl;
  className?: string;
}

/**
 * Get operator status text
 */
export function getOperatorStatusText(control: OperatorControl): string {
  if (!control.enabled) {
    return 'USER MODE';
  }

  if (control.session?.role === 'super-admin' && control.noLimits) {
    return 'SUPER-ADMIN // NO-LIMITS';
  }

  if (
    control.session?.role === 'full-control' &&
    control.unlimitedMode &&
    (control.session.expiresAt === null || control.session.expiresAt > Date.now())
  ) {
    return 'FULL-CONTROL // UNRESTRICTED';
  }

  if (control.session?.role === 'operator') {
    return 'OPERATOR // RESTRICTED';
  }

  return 'UNKNOWN';
}

/**
 * Get operator color for UI
 */
export function getOperatorStatusColor(control: OperatorControl): string {
  if (!control.enabled) {
    return '#999999'; // Gray
  }

  if (control.session?.role === 'super-admin' && control.noLimits) {
    return '#FF0066'; // Bright red (pulsing)
  }

  if (control.session?.role === 'full-control' && control.unlimitedMode) {
    return '#FF3333'; // Red
  }

  if (control.session?.role === 'operator') {
    return '#00FF00'; // Green
  }

  return '#999999';
}

/**
 * Format operator session info
 */
export function formatOperatorSession(session: OperatorSession): {
  role: string;
  duration: string;
  commands: number;
  status: string;
} {
  const now = Date.now();
  const duration = now - session.activatedAt;
  const durationMinutes = Math.floor(duration / 60000);
  const durationSeconds = Math.floor((duration % 60000) / 1000);

  const isExpired =
    session.expiresAt !== null && session.expiresAt < now;
  const timeUntilExpiry = session.expiresAt ? session.expiresAt - now : null;
  const expiryMinutes = timeUntilExpiry ? Math.floor(timeUntilExpiry / 60000) : null;

  return {
    role: session.role.toUpperCase(),
    duration: `${durationMinutes}m ${durationSeconds}s`,
    commands: session.metadata.commandCount,
    status: isExpired
      ? 'EXPIRED'
      : session.expiresAt === null
        ? 'INFINITE'
        : expiryMinutes !== null && expiryMinutes <= 5
          ? `EXPIRES IN ${expiryMinutes}m`
          : 'ACTIVE'
  };
}
