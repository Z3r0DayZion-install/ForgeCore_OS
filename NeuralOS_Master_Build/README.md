## NeuralOS Master Build

Sovereign Desktop Runtime built on Electron 41. Provides a triple-shell architecture (WinShadow, NeuralMac, NeuralLinux) with hot-swap switching, a hardware-sealed identity system, and capability-based IPC.

### Quick Start

```bash
cd NeuralOS_Master_Build
npm install
npm run rebuild          # rebuild node-pty for Electron ABI
npm start                # launch in development mode
```

### Architecture

The main process is split into focused modules under `modules/`:

| Module | Purpose |
|--------|---------|
| `config.js` | Paths, constants, `DEFAULT_SYSTEM_STATE`, native launch allowlist |
| `context.js` | Shared mutable singleton (`mainWindow`, `ptyProcess`) |
| `state.js` | Deep-merge state engine — load, persist, normalize |
| `hardware.js` | Ed25519 hardware seal generation |
| `logging.js` | Session memory log + proof-of-operation log |
| `pty.js` | Pseudo-terminal lifecycle management |
| `window.js` | BrowserWindow creation, CSP headers, permission handler, shell resolution |
| `ipc.js` | All IPC handlers (system, fs, vpn, pod, shell, state) |

The entry point `main.desktop.js` is a 51-line orchestrator that wires these modules together and manages the app lifecycle.

### Renderer API

`preload.js` exposes `window.neuralos` with eight namespaces via `contextBridge`:

- **shell** — `getMode()`, `switch(mode)`, `execute(cmd)`, `onMemoryUpdate(cb)`
- **core** — `getSeal()`
- **fs** — `ls(dir)`, `verify(path)`, `vaultMove(src, dest)`
- **vpn** — `start(config)`, `stop()`, `status()`
- **pod** — `start()`, `stop()`, `status()`
- **state** — `get()`, `set(patch)`, `onUpdate(cb)`
- **pty** — `send(data)`, `onData(cb)`, `resize(cols, rows)`
- **system** — `audit()`, `launch(appPath)`, `metrics()`

### Security

- `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`
- Content-Security-Policy injected via `session.webRequest.onHeadersReceived` — restricts to `self`/`file:` origins
- `setPermissionRequestHandler` denies all permissions except clipboard
- Native launch targets are allowlisted (no shell injection)

### Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Launch the app in development mode |
| `npm run proof:lint` | Run ESLint with auto-fix |
| `npm run test:e2e` | Run single smoke test (xxxplorer) |
| `npm run test:e2e:all` | Run all 9 spec files (23 tests) |
| `npm run build:win` | Build portable Windows exe |
| `npm run rebuild` | Rebuild node-pty for current Electron ABI |

### Tests

Nine Playwright E2E spec files in `tests/`:

| Spec | Coverage |
|------|----------|
| `xxxplorer.spec.ts` | Vault move integrity |
| `xxxplorer-preferences.spec.ts` | Theme and root persistence |
| `state-persistence.spec.ts` | State persistence across launches |
| `winshadow-draft.spec.ts` | Command draft persistence |
| `native-launch.spec.ts` | Allowlist enforcement + injection blocking |
| `shell-hotswap.spec.ts` | Shell mode, execute, switch, hot-swap |
| `system-metrics.spec.ts` | RAM/CPU/battery metrics, audit lifecycle |
| `vpn-pod-ipc.spec.ts` | VPN and Pod start/stop/status |
| `memory-engine.spec.ts` | State get/set/deep-merge, event subscriptions |

### Native Modules

Five Rust NAPI addons (`.node` binaries) ship pre-built:

- `packages/core/neuralpod_core/index.node` — Pod lifecycle
- `packages/core/seal_pulse/index.node` — Seal pulse engine
- `packages/core/trustctl/index.node` — Hash verification
- `packages/core/vaultfs/index.node` — Vault filesystem + TPM enclave
- `packages/modules/vipn/rust/index.node` — VPN bridge

These use N-API (stable ABI) and don't require per-Electron-version rebuilds. `node-pty` is the only native dependency that needs `npm run rebuild` after Electron upgrades.
