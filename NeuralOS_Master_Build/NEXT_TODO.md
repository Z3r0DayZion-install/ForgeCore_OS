# Next Todo List - Phase 2

Updated: 2026-05-08

Previous cycle completed: repo hygiene, CI command alignment, docs, release notes, full E2E, lint, asset build, Windows packaging fallback, and packaged smoke test.

## Priority 1 - Commit And PR Readiness

- [x] Review the current diff from the repository root at `C:/Users/KickA`.
- [x] Stage the intended files only: `.gitignore`, `.github/workflows/forgecore-ci.yml`, root `README.md`, `NeuralOS_Master_Build/README.md`, `NeuralOS_Master_Build/NEXT_TODO.md`, `NeuralOS_Master_Build/docs/RELEASE_NOTES.md`, packaged QA evidence, `NeuralOS_Master_Build/modules/window.js`, and the removal of `NeuralOS_Master_Build/test-results/.last-run.json` from tracking.
- [x] Confirm ignored local artifacts stay out of Git status: stale workflow drafts, subproject `.husky/`, `packages/sample.txt`, Playwright report output, and packaged build output.
- [x] Commit the change set on `codex/next-15-ci-hooks`. Outcome: committed as `ci: harden neuralos verification workflow`.
- [x] Push the branch and open or update the PR with test results. Outcome: pushed branch and updated PR #7.

## Priority 2 - Native Build Environment

- [x] Install Visual Studio C++ Build Tools with MSVC, Windows SDK, and Desktop C++ workload.
- [x] Rerun `npm run rebuild` and confirm `node-pty` rebuilds without the fallback.
- [x] Rerun default `npm run build:win` and confirm the package builds without `--config.npmRebuild=false`.
- [x] Rerun `npm run test:packaged` against the default build artifact.
- [x] Decide whether to add a `postinstall` script for `electron-builder install-app-deps`. Outcome: leave it out for now to keep `npm ci` lighter; explicit rebuild/build steps cover native alignment.

## Priority 3 - Repository Boundary Decision

- [x] Decide whether `NeuralOS_Master_Build` should remain a subdirectory of the `C:/Users/KickA` repository. Outcome: keep the current root for this branch.
- [x] If keeping the current root, add a short root-level map that explains where NeuralOS work lives.
- [x] If splitting the project, plan a clean repo extraction path that preserves needed history. Outcome: no split now; defer extraction planning until the current CI branch lands.
- [x] Update CI paths and package commands to match the chosen repository boundary. Outcome: current CI paths already match the retained root.

## Priority 4 - Release QA Evidence

- [x] Run the manual QA checklist for WinShadow, NeuralMac, NeuralLinux, XXXplorer, and the system layer.
- [x] Verify shell switching and PTY behavior inside the packaged app, not only the dev app.
- [x] Capture screenshots or notes from the packaged-app QA pass.
- [x] Add the QA evidence summary to `docs/RELEASE_NOTES.md`.
- [x] Confirm the portable EXE launches from a clean temporary directory.

## Follow-Up Watchlist

- [ ] Consider adding a dedicated packaged shell-switch Playwright test so this lifecycle regression is caught before manual QA.
- [ ] Decide later whether `NeuralOS_Master_Build` should become its own Git repository after the CI/hooks branch is merged.
