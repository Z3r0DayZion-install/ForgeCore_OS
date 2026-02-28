# NeuralShell Hardened Sovereign Architecture

## 1. Microkernel Model (/src/kernel)
All privileged operations are mediated by a frozen Capability Broker.
- **execution.js**: Hard-pinned binary paths, immutable environment, no raw child process exposure.
- **filesystem.js**: Descriptor-based atomic reads, frozen boundary checks.
- **network.js**: HTTPS-only, SPKI pinning, redirect/proxy denial.
- **crypto.js**: Hardware-bound root key derived from machine GUID/etc-machine-id.
- **tokens.js**: Non-forgeable Symbol-based capability tokens.

## 2. Deterministic AI Intent Firewall
LLM output is treated as hostile input and converted into validated intents.
- **intents.js**: Static registry of allowed actions.
- **intentParser.js**: Ajv-validated schema enforcement, rejects unknown fields/arguments.

## 3. TCB Minimization
Electron attack surface is reduced to the minimum required for the UI.
- **Navigation Guard**: Restricted to `file://`, no window.open, no external redirects.
- **CSP**: `default-src 'none'`, strict script/style/img/connect policies.
- **Electron Hardening**: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.

## 4. Boot Integrity & Self-Healing
- **Integrity**: RSA-4096 signed manifest verifying SHA256 of all critical files.
- **Recovery Mode**: Launch-closed UI for repair if tampering is detected.
- **Privilege Policy**: Execution blocked if running as Administrator/root without explicit flags.

## 5. Security Regression Prevention
- **AST Security Gate**: CI fails if restricted APIs are imported outside the kernel or if BrowserWindow settings are weakened.

## 6. Known Architectural Limitations
- **Memory Integrity**: Node.js cannot prevent memory scraping or key extraction by a same-user process with debugger capabilities.
- **Atomic Swap (Windows)**: File replacement during self-healing may fail if handles are active, requiring an external maintenance executable.
- **AST Obfuscation**: Static regex/AST scanning can be bypassed via obfuscated dynamic property access.

---
**Status: STRUCTURALLY VERIFIED (STATIC)**
Final generating of VAR proof requires execution in a compatible host shell.
