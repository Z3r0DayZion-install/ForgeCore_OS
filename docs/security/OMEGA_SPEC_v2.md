# OMEGA_SPEC_v2.md — Capability Microkernel & IntentFirewall

## 📋 EXECUTIVE SUMMARY
**STATUS**: 🛠️ IMPLEMENTATION PHASE (v2.0)
The OMEGA Core is the constitutional enforcement engine for ForgeCore™ OS. It shifts security from passive documentation to active runtime enforcement through **Capability Brokers** and an **IntentFirewall**.

---

## 🛡️ CORE ARCHITECTURE

### 1. CAPABILITY BROKERS
No module (UI, Plugin, or Sub-process) is allowed to perform direct OS operations. All actions must be mediated by a **Broker**.

#### **Brokers Defined:**
- **FS_BROKER**: Mediates all file read/write/delete operations.
- **NET_BROKER**: Mediates all network requests (proxy, DNS, sockets).
- **EXEC_BROKER**: Mediates process spawning and shell command execution.
- **CRYPTO_BROKER**: Mediates access to the Rust Quantum Bridge and VaultCrypt.

### 2. INTENTFIREWALL (POLICY ENGINE)
The Firewall evaluates every brokered request against a **Constitutional Policy**.

#### **Policy Schema (JSON):**
```json
{
  "entity": "plugin_id | system | user",
  "action": "fs:read | fs:write | net:out | exec:spawn",
  "resource": "path/to/resource | domain.com",
  "constraint": {
    "readOnly": true,
    "maxSize": "10MB",
    "ratelimit": "10/min"
  },
  "effect": "ALLOW | DENY | GHOST"
}
```

### 3. INVARIANTS (THE UNBREAKABLE RULES)
1. **Deny-by-Default**: Any action not explicitly ALLOWED is DENIED.
2. **Fail-Closed**: If the OMEGA Kernel crashes or fails to evaluate a policy, all brokers must block all activity.
3. **Audit-on-Evaluate**: Every firewall evaluation (Pass or Fail) must be sealed into the TEAR Audit Chain.
4. **Machine Binding**: The OMEGA Policy is signed by the Hardware DNA key.

---

## 🚀 IMPLEMENTATION ROADMAP (v2.0)
1. **[DONE]** Initial Spec Formulation.
2. **[IN PROGRESS]** Implementation of `intent_firewall.js` policy evaluator.
3. **[TODO]** Implementation of `omega_brokers.js` wrapper layer.
4. **[TODO]** Migration of `v3_sovereign_server.js` to use OMEGA Brokers.
