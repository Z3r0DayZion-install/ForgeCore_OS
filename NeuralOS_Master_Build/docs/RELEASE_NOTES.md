# Release Notes

## codex/next-15-ci-hooks

Date: 2026-05-08

### Added

- ForgeCore CI workflow with portable build verification, Playwright E2E coverage, and lint jobs.
- Release workflow for tagged builds with artifact hash reporting and release manifest upload.
- Root pre-commit hook wired to `lint-staged`.
- NeuralOS operational docs for native rebuild troubleshooting, shell hot-swap behavior, and manual QA.
- Packaged-app QA evidence for shell switching, PTY, metrics, VPN/Pod status, packaged smoke, and clean-temp portable launch.

### Changed

- CI E2E execution now uses the same full-suite script as local development: `npm run test:e2e:all`.
- `test-results/.last-run.json` is removed from tracking so generated Playwright state can stay local.
- Shell hot-swap now creates the replacement window before destroying the previous window, preventing packaged Electron from quitting during shell changes.
- Packaged smoke now validates WinShadow as the landing shell instead of launching through XXXplorer.

### Notes Before PR

- Git root is currently `C:/Users/KickA`; `NeuralOS_Master_Build` is a subdirectory inside that repository.
- Local-only artifacts are ignored for stale workflow drafts, the subproject hook folder, package sample data, and Playwright report output.
- Visual Studio Build Tools 2022 plus the v14.44 x86/x64 Spectre libraries are installed on this machine; default `npm run rebuild` and `npm run build:win` now pass without the packaging fallback.
- `postinstall` was intentionally left out for now so `npm ci` stays lightweight; native dependency alignment is covered by explicit `npm run rebuild` and `npm run build:win`.
- XXXplorer is still covered by targeted specs, but its visual instability should be triaged separately from packaged startup smoke.
