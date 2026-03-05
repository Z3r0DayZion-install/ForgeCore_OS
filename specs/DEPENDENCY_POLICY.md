# Dependency Policy

Policy version: `1`

Rules:
- Install using `npm ci` only (never floating installs for release).
- `package-lock.json` is the source of truth for pinned versions.
- Release checks must fail on lockfile drift.
- New dependencies require lockfile update and pin verification.

Pinned packages:
- `concurrently`: `8.2.2`
- `electron`: `31.7.7`
- `electron-builder`: `24.13.3`
- `monaco-editor`: `0.44.0`
- `pkg`: `5.8.1`
- `wait-on`: `7.2.0`
- `xterm`: `5.3.0`
- `xterm-addon-fit`: `0.8.0`
- `y-websocket`: `3.0.0`
- `yjs`: `13.6.29`
