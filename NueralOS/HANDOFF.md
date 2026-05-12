# NeuralOS Project Handoff

**Repository**: `ForgeCore_OS` (https://github.com/Z3r0DayZion-install/ForgeCore_OS)
**Remote alias**: `origin` → `https://github.com/Z3r0DayZion-install/forge.git` (redirects to ForgeCore_OS)
**Current Branch**: `main` (clean — last stabilization branch merged and deleted)
**Type**: Electron + Rust security/networking application
**Platform**: Windows primary (CI also runs Ubuntu, macOS)

---

## Project Overview

NeuralOS is a multi-component security platform. The active Electron application lives in `NeuralOS_Master_Build/`. Other components (Rust scanner, rule engine, Tauri UI, widget) are linked or separate.

### Components

1. **WinShadow** — Windows shell with launcher, command palette, module system (Electron)
2. **XXXplorer** — File explorer module loaded as iframe inside WinShadow shell (Electron)
3. **FartSuite™ Core** — Network scanning (Rust + Tauri)
4. **NodeChain™ Rule Engine** — CRDT-based rule engine (Rust)
5. **VaultPanel+ Widget** — Dashboard widget (React 19 iframe module inside WinShadow)

### Active Code Location

All active Electron development is under:

```
NeuralOS_Master_Build/
├── main.desktop.js          # Electron main process
├── package.json             # Scripts, deps, electron-builder config
├── tests/                   # Playwright E2E specs
│   ├── winshadow-draft.spec.ts
│   ├── neuralos.shell.e2e.spec.ts
│   └── helpers/
│       ├── winshadowHarness.ts
│       └── runtimeIsolation.ts
├── packages/
│   ├── shells/winshadow/    # WinShadow renderer
│   ├── modules/xxxplorer/   # XXXplorer renderer
│   └── modules/vaultpanel-plus/  # VaultPanel+ React 19 dashboard (src/App.tsx)
└── modules/                 # IPC, state, window, logging, etc.
```

---

## Current State (as of 2026-05-12)

### main is clean

Last merged PR: **NeuralOS_Master_Build #5** — `feat(vaultpanel): v1 dashboard polish — role, metrics, honest VIPN, proof filter`
Merge commit: `aa929fb` (2026-05-12)

ForgeCore_OS last merged PR: **#7** — `ci: stabilize E2E, harden CI pipeline, opt into Node24 actions runner`
Merge commit: `116d347` (2026-05-12)

ForgeCore_OS CI jobs (PR #7):

| Job | Result | Runner |
|-----|--------|--------|
| `e2e-tests` | ✓ success (22+ tests) | windows-latest |
| `lint` | ✓ success | ubuntu-latest |
| `build-portable` | ✓ success | ubuntu-latest |

### What PR #7 fixed

| Root cause | Fix |
|------------|-----|
| Renderer assets not built before E2E | Added `build:assets` step before Playwright |
| Electron binary path wrong on Windows CI | Pinned `executablePath` to `electron/dist/electron.exe` |
| WinShadow draft test using fragile UI input in CI | CI now calls `window.neuralos.state.set()` directly |
| Test ordering causing stale state | WinShadow draft spec runs first |
| Node.js 20 actions runner deprecation warning | Added `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` top-level env |

---

## CI/CD

**Workflow file**: `.github/workflows/forgecore-ci.yml`
**Triggers**: push to any branch, pull_request

### Jobs

**`build-portable`** (ubuntu-latest, ~7 min)
- Installs Wine for cross-platform build
- Generates MinePack specs, materializes outputs, verifies
- Builds portable artifact, generates release manifest, verifies hash chain

**`e2e-tests`** (windows-latest, ~5 min)
- Installs root + NeuralOS deps
- Builds renderer assets (xxxplorer + winshadow)
- Rebuilds native modules for Electron
- Runs `npm run test:e2e:ci` (Playwright, `CI=true`)
- Uploads playwright-report artifact (retained 14 days)

**`lint`** (ubuntu-latest, ~40 sec)
- Installs NeuralOS deps
- Runs `npx eslint .` in `NeuralOS_Master_Build/`

---

## Open Follow-up Issues (non-blocking)

| Issue | Title | Priority | Status |
|-------|-------|----------|--------|
| **#8** | test: remove `waitForTimeout` timing assumptions from `winshadowHarness` | Low | **Merged** — PR #4, commit `eea39e1` |
| **#9** | ci: add AST gate blocking `BrowserWindow` with `nodeIntegration: true` | Medium | **Merged** — PR #3, commit `c1ece0f` |

### Harness timing policy (post-#8)

All `waitForTimeout(...)` calls removed from the paths touched in PR #4. The harness now uses deterministic waits exclusively:

- `expect(locator).toBeVisible({ timeout: N })` — wait for element readiness
- `locator.waitFor({ state: 'attached', timeout: N })` — wait for DOM attachment
- `expect.poll(...)` — poll for JS bridge/state readiness

**Do not re-introduce raw `waitForTimeout(...)` sleeps** in test helpers or specs. If a wait is needed, wait on a real signal (visibility, DOM state, app-level readiness flag).

### Issue #9 — nodeIntegration gate (merged)

Gate script: `NeuralOS_Master_Build/scripts/guard_node_integration.js`
Wired into: `test:security-gates` → `omega-intent-gates.yml` `test-security-gates` job

**Allowlist format** — the only accepted bypass comment, placed on the line directly above `new BrowserWindow(`:

```js
// ALLOWLISTED_NODE_INTEGRATION: <reason>
const win = new BrowserWindow({ webPreferences: { nodeIntegration: true } });
```

Any `nodeIntegration: true` window without this exact comment will fail CI. `nodeIntegration: false` or absent requires no comment.

Both should be separate branches off `main`. Do not reopen merged branches.

---

## E2E Test Inventory

### `winshadow-draft.spec.ts` — 1 test
Proves command draft persists to disk between app launches.
- CI path: uses `window.neuralos.state.set()` directly (deterministic)
- Non-CI path: uses actual UI input (not exercised in CI)
- State file: `memory/NODECHAIN_STATE.winshadow-draft-test.json` (created/cleaned per run)

### `neuralos.shell.e2e.spec.ts` — 4 tests (mode: parallel)
Each test launches its own isolated Electron instance via `runtimeIsolation.ts`.

| Test | What it proves |
|------|---------------|
| Core loop | Launcher grid → open XXXplorer module → iframe loads → back to launcher |
| Host status + adapter stubs | WinShadow = ACTIVE_HOST, Mac/Linux = STUB/HOST_UNSUPPORTED |
| Workspace state persistence | Recent module list survives `page.reload()` |
| Warp capsule UI | Presets panel, signer registry, trust feed all visible on load |

### Known flakiness (not currently causing failures)
- Retry loops in `openOverlayWithRetry` (3x) and `openDockAppWindow` (4x) — were needed to stabilize, still present
- `release-gates` job in `omega-intent-gates.yml` (NeuralOS_Master_Build CI) — Warp Capsule UI timing flake, non-required check, pre-existing

---

## Known Issues

1. **`main.xxxplorer.js` missing `sandbox: true`** — fixed in NeuralOS_Master_Build PR #6 (`fix/recovery-window-hardening`). The standalone XXXplorer window was missing an explicit `sandbox: true` in its `webPreferences` (relied on Electron default). Now matches main window posture. The "recovery window" entry previously listed here was stale — no such window existed in the codebase.
2. **preload.js `postMessage` targetOrigin `'*'`** — in `preload.js` line ~150, the bridge-ready reply uses `'*'` as `targetOrigin`. This cannot be narrowed to `'file://'` because `file://` pages have a null (opaque) origin per the HTML spec; narrowing would break the handshake. Comment added in code. The message carries no secrets.
3. **Signing** — SEAL-Pulse signing not available in CI. Artifacts are unsigned.
4. **`actions/checkout@v4` / `actions/setup-node@v4`** — Still annotated as Node.js 20 actions, forced to Node.js 24 via `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`. Benign until action authors publish Node.js 24-native tagged releases.

---

## Git Workflow

- **`main`** — production-ready, branch-protected, PRs required
- Branch naming: `codex/next-{N}-{slug}` for agent branches
- Merge strategy: squash preferred
- Delete branch on merge

### Recent merged branches (NeuralOS_Master_Build)

| Branch | What it did | Merged |
|--------|-------------|--------|
| `feat/vaultpanel-v1-dashboard` | VaultPanel+ v1 polish: live role badge, CPU/RAM metrics, removed fake VIPN latency/protocol, added Proof filter, cleaned footer | 2026-05-12 |

### Recent merged branches (ForgeCore_OS)

| Branch | What it did | Merged |
|--------|-------------|--------|
| `codex/next-15-ci-hooks` | E2E stabilization, CI hardening, Node24 opt-in | 2026-05-12 |
| `codex/next-14-ci-deps` | Fixed final CI steps, upgraded root deps | prior |
| `codex/next-13-harden` | CSP + permission handlers, 9 E2E tests | prior |
| `codex/next-12-cleanup` | Removed 496 dead files, upgraded Electron 41 | prior |

---

## Build & Dev

### Requirements

- Node.js 22+
- npm (not pnpm for NeuralOS_Master_Build)
- Electron 41+
- Rust 1.93+ (for non-Electron components)

### Key commands (run from `NeuralOS_Master_Build/`)

```bash
npm ci                        # install deps
npm run build:assets          # build xxxplorer + winshadow renderers
npm run build --prefix packages/modules/vaultpanel-plus  # build vaultpanel+ (dist/ gitignored, built in CI)
npm run rebuild               # rebuild native modules for Electron
npm run test:e2e:ci           # run Playwright E2E (CI mode)
npx eslint .                  # lint
```

---

## Scope Boundary

- **In scope**: `C:\Users\KickA\NueralOS` (ForgeCore_OS repo) only
- **Out of scope**: NeuralTube (`Downloads/neuraltube_*`), NeuralBook, NeuralShell, mcp-server, and any other sibling directories
- If a task references Downloads or NeuralTube, stop and confirm before proceeding

---

**Last Updated**: 2026-05-12
**State**: both repos on main are clean; ForgeCore_OS PR #7 merged; NeuralOS_Master_Build PRs #3 (nodeIntegration gate), #4 (timing cleanup), #5 (VaultPanel+ v1) all merged

### VaultPanel+ bridge API surface (as wired in v1)

| Namespace | Call | Used for |
|-----------|------|----------|
| `core` | `getSeal()` | Hardware root SEAL (shown truncated in header) |
| `state` | `get()` / `onUpdate()` | `vaultStatus`, `role` (role badge in header) |
| `vpn` | `status()` | Live VPN connection status |
| `pod` | `status()` / `peers()` | Mesh node count + peer list |
| `shell` | `onMemoryUpdate()` | Cognitive memory stream (live) |
| `system` | `metrics()` | CPU load % + RAM total/used (fetched once on mount) |
| `system` | `audit()` | Full system audit trigger (FULL_SYSTEM_AUDIT button) |
