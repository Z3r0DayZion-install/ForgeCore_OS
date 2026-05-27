# Full Control No Limits - Integration Guide

## Overview

This guide explains how to integrate the unrestricted operator control system into the NeuralOS shells (WinShadow, NeuralMac, NeuralLinux).

## Files Created

1. **operator-unlimited.ts** - Core operator session management
2. **operator-bypass-engine.ts** - Permission and resource bypass logic
3. **operator-orchestration.ts** - Multi-operator orchestration and cross-shell sync
4. **operator-react-integration.ts** - React hooks and UI utilities

## Installation

Place all `.ts` files in:
- `packages/shells/winshadow/src/lib/`
- `packages/shells/neuralmac/src/lib/`  
- `packages/shells/neurallinux/src/lib/`

Or in a shared library location that all shells can import from.

## Integration Steps

### Step 1: Update App.tsx State Management

```typescript
import { useOperatorControl } from './lib/operator-react-integration';

export default function App() {
  // ... existing state ...
  
  const operatorControl = useOperatorControl();
  
  // Access operator state and methods
  const {
    control,
    activateSuperAdmin,
    activateFullControl,
    activateOperatorMode,
    revokeAccess,
    isSuperAdminActive,
    isFullControlActive
  } = operatorControl;
}
```

### Step 2: Modify Permission Checking

```typescript
import { usePermissionBypass } from './lib/operator-react-integration';

const permissionBypass = usePermissionBypass(control);

const requestPermission = async (scope: string): Promise<boolean> => {
  // Check if can bypass (returns true for super-admin/full-control)
  if (permissionBypass.canBypassPermission(scope)) {
    return true;
  }

  // Otherwise use standard permission flow
  return standardPermissionFlow(scope);
};
```

### Step 3: Add Unrestricted Command Execution

```typescript
import { useUnrestrictedExecution } from './lib/operator-react-integration';

const unrestricted = useUnrestrictedExecution(hostBridge);

// Execute command without validation
const result = await unrestricted.executeUnrestricted(
  control,
  'system.command',
  { payload: 'data' }
);

// Or execute shell command directly
const shellResult = await unrestricted.executeShellCommand(
  control,
  'winshadow',
  'command to execute'
);
```

### Step 4: Add Command Palette Commands

```typescript
const commandPaletteItems = useMemo(() => {
  return [
    // ... existing commands ...
    {
      id: 'operator-activate-super-admin',
      title: 'Activate Super-Admin (No Limits)',
      subtitle: 'Enable unrestricted access without expiry',
      keywords: 'super admin operator no limits unrestricted',
      icon: Shield,
      accent: 'text-red-600',
      action: () => {
        operatorControl.activateSuperAdmin('current-user');
        showStatus('Super-Admin mode activated // NO LIMITS', 'success');
      }
    },
    {
      id: 'operator-activate-full-control',
      title: 'Activate Full-Control',
      subtitle: 'Unrestricted access for 1 hour',
      keywords: 'full control operator unrestricted',
      icon: Shield,
      accent: 'text-orange-400',
      action: () => {
        operatorControl.activateFullControl('current-user');
        showStatus('Full-Control mode activated // 1 hour expiry', 'success');
      }
    },
    {
      id: 'operator-activate-standard',
      title: 'Activate Standard Operator',
      subtitle: 'Standard operator with limited permissions',
      keywords: 'operator restricted mode',
      icon: Shield,
      accent: 'text-green-400',
      action: () => {
        operatorControl.activateOperatorMode('current-user');
        showStatus('Operator mode activated', 'success');
      }
    },
    {
      id: 'operator-create-concurrent',
      title: 'Create Concurrent Operator Session',
      subtitle: 'Add another operator without terminating current',
      keywords: 'operator concurrent session multiple',
      icon: Users,
      accent: 'text-blue-400',
      action: () => {
        operatorControl.createConcurrentSession('new-operator', 'full-control');
        showStatus('Concurrent session created', 'success');
      }
    },
    {
      id: 'operator-revoke',
      title: 'Revoke Operator Access',
      subtitle: 'Return to normal user mode',
      keywords: 'revoke operator access disable',
      icon: Lock,
      accent: 'text-gray-400',
      action: () => {
        operatorControl.revokeAccess();
        showStatus('Operator access revoked', 'info');
      }
    },
    {
      id: 'operator-sync-shells',
      title: 'Sync to All Shells',
      subtitle: 'Synchronize operator sessions across WinShadow, NeuralMac, NeuralLinux',
      keywords: 'sync shells synchronize operator cross-shell',
      icon: Zap,
      accent: 'text-yellow-400',
      action: async () => {
        const sync = useCrossShellSync(control, hostBridge);
        await sync.syncToAllShells();
        showStatus('Shells synchronized', 'success');
      }
    }
  ];
}, [operatorControl, control]);
```

### Step 5: Update Status Bar Display

```typescript
import { getOperatorStatusText, getOperatorStatusColor } from './lib/operator-react-integration';

// In the shell status bar component
const operatorStatus = getOperatorStatusText(control);
const operatorColor = getOperatorStatusColor(control);

return (
  <div className="flex items-center gap-2">
    {control.enabled && (
      <span
        style={{
          color: operatorColor,
          fontWeight: 'bold',
          fontSize: '11px'
        }}
      >
        {operatorStatus}
      </span>
    )}
    {/* ... rest of status bar ... */}
  </div>
);
```

### Step 6: Add Multi-Operator UI (Optional)

```typescript
import { useOrchestration } from './lib/operator-react-integration';

const orchestration = useOrchestration(control);

// Display active sessions
const sessions = operatorControl.getActiveSessions();

return (
  <div>
    {sessions.map((session) => (
      <div key={session.metadata.sessionId}>
        <span>{session.metadata.operatorId}</span>
        <span>{session.role}</span>
        <span>{orchestration.execStats.bySession
          .find(s => s.sessionId === session.metadata.sessionId)
          ?.queued || 0} queued
        </span>
      </div>
    ))}
  </div>
);
```

## Usage Examples

### Example 1: Activate Super-Admin Mode

```typescript
// Activate super-admin (no limits, no expiry)
operatorControl.activateSuperAdmin('admin-user');

// Now all commands execute without any validation or limits
const result = await unrestricted.executeUnrestricted(
  control,
  'system.reboot',
  { force: true }
);
```

### Example 2: Execute Unrestricted Command

```typescript
// With full-control or super-admin active
if (operatorControl.isSuperAdminActive || operatorControl.isFullControlActive) {
  const result = await unrestricted.executeShellCommand(
    control,
    'winshadow',
    'Get-Process | Where-Object { $_.Memory -gt 1GB }'
  );
}
```

### Example 3: Create Concurrent Sessions

```typescript
// Add another operator without terminating current
operatorControl.createConcurrentSession('operator-2', 'full-control');

// Switch between operators
const sessions = operatorControl.getActiveSessions();
operatorControl.switchPrimaryOperator(sessions[1].metadata.sessionId);
```

### Example 4: Cross-Shell Synchronization

```typescript
const sync = useCrossShellSync(control, hostBridge);

// Sync to all shells at once
await sync.syncToAllShells();

// Or sync to specific shell
await sync.syncToShell('neuralmac');
```

## Permission Bypass Behavior

### Super-Admin Mode (`'super-admin'`)
- ✅ No permission checks
- ✅ Unlimited resources
- ✅ Never expires (`expiresAt: null`)
- ✅ Can modify other operators
- ✅ Can disable audit logs

### Full-Control Mode (`'full-control'`)
- ✅ All permissions granted
- ✅ Unlimited resources
- ⚠️ Expires in 1 hour
- ✅ Cannot modify other operators
- ✅ Audit logging applies

### Standard Operator (`'operator'`)
- ⚠️ System audit permission restricted
- ⚠️ Resource limits enforced
- ⚠️ Expires in 30 minutes
- ❌ Cannot modify system settings

### User Mode (`'user'`)
- ✅ Standard permission prompts
- ✅ Resource limits enforced
- ❌ Expires immediately

## Storage & Persistence

States are automatically persisted to localStorage:
- Key: `neuralos.operator-state.v2`
- Super-admin sessions are NOT persisted to disk
- Sessions exceeding expiry time are invalid
- Last 50 audit log entries are kept per session

## Cross-Shell Synchronization

When `crossShellSync` is enabled:
- Operator sessions sync automatically
- Primary operator state maintained
- Orchestration mode synchronized
- Changes propagate to all connected shells in real-time

## Audit Logging

Every operator action is logged:
- Timestamp
- Action type
- Optional details
- Session ID and operator ID
- Super-admin can clear logs if enabled

## Security Notes

1. **Super-Admin Only**: Super-admin mode is the highest privilege level
2. **No Limits**: Once activated, super-admin can do absolutely anything
3. **Session Expiry**: Full-control expires after 1 hour, automatically reset
4. **Audit Trail**: All actions are logged unless super-admin disables logging
5. **Storage**: Never persist super-admin credentials; regenerate on each login

## Troubleshooting

### Commands Not Executing
- Verify `hostBridge` is available
- Check operator mode is active
- Ensure session hasn't expired

### Sync Not Working
- Verify all shells have the operator-orchestration module
- Check network connectivity between shells
- Ensure `crossShellSync` flag is true

### Performance Issues
- Reduce `maxConcurrentSessions` for coordinated mode
- Switch to sequential orchestration for heavy workloads
- Monitor `execStats` for queue size

## Next Steps

1. Integrate modules into shell source
2. Add command palette commands
3. Update status bar displays
4. Test activation and execution flows
5. Verify cross-shell synchronization
6. Build and deploy all shells

## References

- `OPERATOR_FULLCONTROL_NOLIMITS_SPEC.md` - Full specification
- `operator-unlimited.ts` - Core implementation
- `operator-bypass-engine.ts` - Permission bypass logic
- `operator-orchestration.ts` - Orchestration and sync
- `operator-react-integration.ts` - React hooks and utilities
