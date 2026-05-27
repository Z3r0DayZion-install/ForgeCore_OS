/**
 * NeuralOS Multi-Operator Orchestration & Cross-Shell Sync
 * Implements concurrent operator management and shell synchronization
 * 
 * @module operator-orchestration
 * @version 2.0.0
 */

import type { OperatorControl, OperatorSession, MultiOperatorSession, OrchestrationMode } from './operator-unlimited';

export interface OperatorExecutionContext {
  sessionId: string;
  operatorId: string;
  commandType: string;
  priority: number;
  timestamp: number;
  estimatedDuration: number;
  isParallel: boolean;
}

export interface ExecutionQueue {
  queued: OperatorExecutionContext[];
  executing: OperatorExecutionContext[];
  completed: OperatorExecutionContext[];
  maxQueueSize: number;
}

export interface ShellSyncState {
  shell: 'winshadow' | 'neuralmac' | 'neurallinux';
  syncedAt: number;
  activeSessions: number;
  primaryOperator: string | null;
  executingCommands: number;
  status: 'synced' | 'syncing' | 'out-of-sync' | 'failed';
}

export class OperatorOrchestrator {
  private executionQueues: Map<string, ExecutionQueue> = new Map();
  private syncState: Map<string, ShellSyncState> = new Map();
  private commandIdCounter = 0;
  private orchestrationMode: OrchestrationMode = 'no-limit';

  constructor(orchestrationMode: OrchestrationMode = 'no-limit') {
    this.orchestrationMode = orchestrationMode;
  }

  /**
   * Set orchestration mode
   */
  setOrchestrationMode(mode: OrchestrationMode): void {
    this.orchestrationMode = mode;
  }

  /**
   * Get orchestration mode
   */
  getOrchestrationMode(): OrchestrationMode {
    return this.orchestrationMode;
  }

  /**
   * Queue command for execution
   */
  queueCommand(
    control: OperatorControl,
    commandType: string,
    priority = 5,
    estimatedDuration = 1000
  ): string {
    if (!control.session) {
      throw new Error('No active session');
    }

    const sessionId = control.session.metadata.sessionId;
    const isParallel = control.session.role === 'super-admin' || this.orchestrationMode === 'no-limit';

    const context: OperatorExecutionContext = {
      sessionId,
      operatorId: control.session.metadata.operatorId,
      commandType,
      priority,
      timestamp: Date.now(),
      estimatedDuration,
      isParallel
    };

    // Get or create queue for this session
    if (!this.executionQueues.has(sessionId)) {
      this.executionQueues.set(sessionId, {
        queued: [],
        executing: [],
        completed: [],
        maxQueueSize: control.session.role === 'super-admin' ? Number.MAX_SAFE_INTEGER : 100
      });
    }

    const queue = this.executionQueues.get(sessionId)!;

    // Check queue size
    if (queue.queued.length >= queue.maxQueueSize) {
      throw new Error('Queue full');
    }

    // Add to queue
    queue.queued.push(context);

    // Sort by priority (higher = more urgent)
    queue.queued.sort((a, b) => b.priority - a.priority);

    this.commandIdCounter++;
    return `cmd_${sessionId}_${this.commandIdCounter}`;
  }

  /**
   * Execute queued commands based on orchestration mode
   */
  async executeQueued(
    control: OperatorControl,
    hostBridge?: any
  ): Promise<Array<{ commandId: string; status: string; result?: unknown }>> {
    const sessionId = control.session?.metadata.sessionId;
    if (!sessionId || !this.executionQueues.has(sessionId)) {
      return [];
    }

    const queue = this.executionQueues.get(sessionId)!;
    const results: Array<{ commandId: string; status: string; result?: unknown }> = [];

    // In no-limit mode, execute all commands in parallel
    if (this.orchestrationMode === 'no-limit' || control.session?.role === 'super-admin') {
      const promises = queue.queued.map(async (context) => {
        queue.executing.push(context);
        try {
          if (hostBridge?.executeCommand) {
            const result = await hostBridge.executeCommand(context.commandType, {});
            return { commandId: `cmd_${sessionId}_${this.commandIdCounter}`, status: 'success', result };
          }
          return { commandId: `cmd_${sessionId}_${this.commandIdCounter}`, status: 'no_bridge' };
        } catch (error) {
          return {
            commandId: `cmd_${sessionId}_${this.commandIdCounter}`,
            status: 'failed',
            result: error instanceof Error ? error.message : String(error)
          };
        }
      });

      const parallelResults = await Promise.all(promises);
      results.push(...parallelResults);
      queue.queued = [];
      queue.executing = [];
      queue.completed.push(...queue.queued);
    } else {
      // In coordinated mode, execute sequentially
      for (const context of queue.queued) {
        queue.executing.push(context);

        try {
          if (hostBridge?.executeCommand) {
            const result = await hostBridge.executeCommand(context.commandType, {});
            results.push({
              commandId: `cmd_${sessionId}_${this.commandIdCounter}`,
              status: 'success',
              result
            });
          }
        } catch (error) {
          results.push({
            commandId: `cmd_${sessionId}_${this.commandIdCounter}`,
            status: 'failed',
            result: error instanceof Error ? error.message : String(error)
          });
        }

        queue.executing = [];
        queue.completed.push(context);
      }

      queue.queued = [];
    }

    return results;
  }

  /**
   * Synchronize operator state to other shells
   */
  async syncToShell(
    shell: 'winshadow' | 'neuralmac' | 'neurallinux',
    control: OperatorControl,
    hostBridge?: any
  ): Promise<boolean> {
    if (!hostBridge?.syncOperatorState) {
      return false;
    }

    const syncState: ShellSyncState = {
      shell,
      syncedAt: Date.now(),
      activeSessions: control.multiOperator?.activeSessions.size || (control.session ? 1 : 0),
      primaryOperator: control.multiOperator?.primarySession || control.session?.metadata.sessionId || null,
      executingCommands: 0,
      status: 'syncing'
    };

    try {
      const sessions = control.multiOperator?.activeSessions
        ? Array.from(control.multiOperator.activeSessions.values())
        : (control.session ? [control.session] : []);

      await hostBridge.syncOperatorState({
        shell,
        sessions,
        primarySession: syncState.primaryOperator,
        orchestrationMode: this.orchestrationMode,
        currentRole: control.currentRole,
        noLimits: control.noLimits,
        timestamp: Date.now()
      });

      syncState.status = 'synced';
      this.syncState.set(shell, syncState);
      return true;
    } catch (error) {
      syncState.status = 'failed';
      this.syncState.set(shell, syncState);
      return false;
    }
  }

  /**
   * Synchronize to all shells concurrently
   */
  async syncToAllShells(
    control: OperatorControl,
    hostBridge?: any
  ): Promise<Map<string, boolean>> {
    const shells: Array<'winshadow' | 'neuralmac' | 'neurallinux'> = [
      'winshadow',
      'neuralmac',
      'neurallinux'
    ];

    const syncPromises = shells.map((shell) =>
      this.syncToShell(shell, control, hostBridge).then((success) => [shell, success] as const)
    );

    const results = await Promise.all(syncPromises);
    return new Map(results);
  }

  /**
   * Get synchronization state
   */
  getSyncState(): Map<string, ShellSyncState> {
    return new Map(this.syncState);
  }

  /**
   * Get execution queue status
   */
  getQueueStatus(sessionId: string): ExecutionQueue | null {
    return this.executionQueues.get(sessionId) || null;
  }

  /**
   * Get all execution queues
   */
  getAllQueueStatuses(): Array<{ sessionId: string; queue: ExecutionQueue }> {
    return Array.from(this.executionQueues.entries()).map(([sessionId, queue]) => ({
      sessionId,
      queue
    }));
  }

  /**
   * Cancel queued commands for a session
   */
  cancelQueuedCommands(sessionId: string): number {
    const queue = this.executionQueues.get(sessionId);
    if (!queue) return 0;

    const cancelled = queue.queued.length;
    queue.queued = [];
    return cancelled;
  }

  /**
   * Get orchestration stats
   */
  getExecutionStats(): {
    totalQueued: number;
    totalExecuting: number;
    totalCompleted: number;
    bySession: Array<{ sessionId: string; queued: number; executing: number; completed: number }>;
  } {
    let totalQueued = 0;
    let totalExecuting = 0;
    let totalCompleted = 0;
    const bySession: Array<{ sessionId: string; queued: number; executing: number; completed: number }> = [];

    for (const [sessionId, queue] of this.executionQueues.entries()) {
      const queued = queue.queued.length;
      const executing = queue.executing.length;
      const completed = queue.completed.length;

      totalQueued += queued;
      totalExecuting += executing;
      totalCompleted += completed;

      bySession.push({ sessionId, queued, executing, completed });
    }

    return { totalQueued, totalExecuting, totalCompleted, bySession };
  }

  /**
   * Initialize orchestration for multi-operator mode
   */
  initializeMultiOperatorMode(
    control: OperatorControl,
    maxConcurrentSessions?: number
  ): void {
    if (!control.multiOperator) {
      control.multiOperator = {
        activeSessions: new Map(),
        primarySession: null,
        orchestrationMode: this.orchestrationMode,
        crossShellSync: true,
        delegationChain: [],
        createdAt: Date.now(),
        maxConcurrentSessions: maxConcurrentSessions || null
      };
    }
  }

  /**
   * Get orchestration status report
   */
  getStatusReport(): {
    mode: OrchestrationMode;
    activeQueues: number;
    totalCommands: number;
    syncStatus: Map<string, ShellSyncState>;
    execStats: ReturnType<typeof this.getExecutionStats>;
  } {
    return {
      mode: this.orchestrationMode,
      activeQueues: this.executionQueues.size,
      totalCommands: this.commandIdCounter,
      syncStatus: this.getSyncState(),
      execStats: this.getExecutionStats()
    };
  }
}

/**
 * Global orchestrator instance
 */
let orchestrator: OperatorOrchestrator | null = null;

/**
 * Get or create orchestrator
 */
export function getOrchestrator(mode: OrchestrationMode = 'no-limit'): OperatorOrchestrator {
  if (!orchestrator) {
    orchestrator = new OperatorOrchestrator(mode);
  }
  return orchestrator;
}
