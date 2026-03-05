# ForgeCore OS - ChatGPT Proof File

Generated: March 5, 2026 (America/Los_Angeles)  
Project Root: `C:\Users\KickA\ForgeCore_OS`

## 1) What This App Is

ForgeCore OS is an offline-first sovereign desktop workspace (Electron + Node.js) with:

- local encrypted vault storage
- a tamper-evident TEAR audit chain
- execution timeline sealing
- P2P swarm telemetry and witness attestation
- in-app terminal, Monaco editor, and operational HUD

Primary entrypoints:

- Desktop boot: `electron_main.js`
- Backend: `core/v3_sovereign_server.js`
- UI shell: `core/EMPIRE_HUD.html`

## 2) What It Actually Does Right Now

### Security + Integrity

- Auth lockscreen with session tokens and logout endpoint.
- Rate limiting on API access.
- TEAR chain records boot, auth events, command executions, vault writes, and auto-heal events.
- Machine binding through TPM/DNA layer (with mock fallback when TPM unavailable).

### Resilience

- **Ghost-Witness protocol**: On new TEAR block commit, node multicasts witness announcements and stores signed witness records.
- **Auto-heal**: Vault CID mismatch can trigger automatic restore from Merkle CAS snapshot.
- Vault snapshots are resealed after write/delete/upload/save operations.

### Operator UX

- Dashboard gauges, terminal, vault explorer, swarm status, timeline, and telemetry feed.
- New attestation HUD card shows:
  - witness head count
  - latest observer quorum
  - latest witnessed execution head
  - last auto-heal event status

### Spec Intelligence Layer

- MinePack-driven spec generation for top-10 NeuralEmpire projects.
- Deterministic `specs/<project>/SPEC.md` + `TASKS.md` with implemented `specs/obey/outputs/*` and `specs/mind_unset/outputs/*` artifacts.
- Dependency pin policy and lockfile enforcement in release verification.
- Dist-level spec hash manifest + detached trust-root signatures for external attestation.

## 3) Backend API Surface (Current)

Source: `core/v3_sovereign_server.js` route map.

### Core/System

- `/api/handshake`
- `/api/hw`
- `/api/peers`
- `/api/system/timeline`
- `/api/system/ledger`
- `/api/system/unlock`
- `/api/system/logout` (POST)
- `/api/system/certificate`
- `/api/system/info`
- `/api/system/execute`
- `/api/system/settings`

### Swarm / Witness

- `/api/swarm/status`
- `/api/swarm/dispatch`
- `/api/tear/witnesses`
- `/api/tear/stats`
- `/api/tear/chain`
- `/api/tear/seal` (POST)
- `/api/tear/verify` (POST)

### Vault / File I/O

- `/api/list`
- `/api/raw`
- `/api/save`
- `/api/vault/new` (POST)
- `/api/vault/upload` (POST)
- `/api/vault/delete` (POST)

### Forge / Code Ops

- `/api/forge/repos`
- `/api/forge/tree`
- `/api/forge/file`
- `/api/forge/search`
- `/api/forge/save` (POST)
- `/api/forge/execute` (POST)
- `/api/forge/git/init` (POST)
- `/api/forge/git/commit` (POST)
- `/api/forge/git/log`
- `/api/forge/git/diff`

### Quantum + Neural + XXXplorer + Other

- `/api/quantum/gen-key` (POST)
- `/api/quantum/encrypt` (POST)
- `/api/quantum/decrypt` (POST)
- `/api/quantum/sign` (POST)
- `/api/quantum/verify` (POST)
- `/api/neuralpass/*`
- `/api/xxxplorer/*`
- `/api/vipn/*`
- `/api/zerotrace/purge`

### Telemetry Stream

- WebSocket: `/api/stream` (from `core/telemetry_stream.js`)

## 4) Proof of Runtime + Resilience Validation

Executed in this workspace on March 5, 2026:

1. `npm run prove:ghost-witness`
   - PASS
   - Cross-node witness proof succeeded with observer `NODE_ALPHA_PROOF`
2. `npm run test:resilience`
   - PASS
   - Tamper injected into vault file and auto-heal restored expected content
3. Packaging checks
   - `npm run release:harden:stable` PASS
   - `npm run founder:ops` PASS
   - `npm run specs:materialize:obey` PASS
   - `npm run specs:materialize:mind_unset` PASS
   - `npm run test:specs:obey` PASS
   - `npm run test:specs:mind_unset` PASS
   - `npm run specs:check` PASS
   - `npm run specs:verify` PASS
   - `npm run specs:sign` PASS
   - `npm run specs:verify:signatures` PASS
   - `npm run build:portable` PASS
   - `node scripts/release_portable.cjs` PASS
   - `npm run smoke:portable` PASS
   - `npm run verify:portable` PASS
   - `npm run feed:verify:local` PASS
   - `npm run release:align:stable` PASS

## 5) Build Artifact Proof

Source: `dist/release-manifest.json` + `dist/forgecore-os-2.0.0.sha256.txt`

- Artifact: `dist/forgecore-os 2.0.0.exe`
- Size: `84,711,372` bytes
- SHA-256: `BCE82D1CABF15061227A1D2E7D0C9E8E94D96BFCA13E53E836F0853087348613`
- Manifest timestamp: `2026-03-05T22:06:41.105Z`
- Specs manifest: `dist/specs-manifest.json`
- Specs manifest SHA-256: `4228DDC97B4DA2A7B9BED76840509930E29119CAE6D53B3275EFCB8AA1EC3784`
- Specs signatures: `dist/specs-manifest.signatures.json`
- Specs signatures SHA-256: `0897E327B3552ADD2EFB685284A7F6A0CE5BF1C95C4FB8F507BD96CB1CF2D246`

## 6) How to Reproduce the Proof

From project root:

```bash
npm run release:harden:stable
npm run prove:ghost-witness
npm run test:resilience
npm run specs:materialize:obey
npm run specs:materialize:mind_unset
npm run test:specs:obey
npm run test:specs:mind_unset
npm run specs:check
npm run specs:verify
npm run specs:sign
npm run specs:verify:signatures
npm run build:portable
node scripts/release_portable.cjs
npm run smoke:portable
npm run verify:portable
npm run feed:verify:local
npm run release:align:stable
```

## 7) Plain-English Summary for ChatGPT

ForgeCore OS is a local-first secure workspace app with authenticated session control, TEAR audit sealing, Merkle-based snapshot recovery, and decentralized witness attestation over a swarm channel. It now also includes a deterministic MinePack-to-spec pipeline, implemented Obey and MindUnset module output artifacts with unit tests, and detached trust-root signatures for the specs manifest. Current portable build integrity is verified by SHA-256 and smoke/runtime tests.
