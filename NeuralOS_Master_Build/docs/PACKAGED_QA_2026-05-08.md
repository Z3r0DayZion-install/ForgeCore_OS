# Packaged QA Evidence - 2026-05-08

Branch: `codex/next-15-ci-hooks`

## Environment

- Host: Windows 10.0.19045
- Visual Studio Build Tools: 2022, version 17.14.31
- MSVC toolset: 14.44.35207
- Required Spectre libraries: installed for v14.44 x86/x64
- Packaged app: `dist/win-unpacked/NeuralOS.exe`
- Portable app: `dist/NeuralOS_Master_v1.0.0.exe`

## Commands Run

- `npm run rebuild`
- `npm run test:e2e:all`
- `npm run build:win`
- `npm run test:packaged`
- Packaged QA script against `dist/win-unpacked/NeuralOS.exe`
- Clean-temp process launch check against copied portable EXE

## Results

- Native rebuild: passed.
- Full E2E suite: 23 passed.
- Default Windows package build: passed without `--config.npmRebuild=false`.
- Packaged smoke: passed on `winshadow` shell mode with dry-run native launch for `calc.exe`.
- Packaged shell QA: passed for `winshadow`, `neuralmac`, `neurallinux`, and back to `winshadow`.
- Packaged PTY QA: passed; PTY output contained `PACKAGED_PTY_OK`.
- Packaged system QA: metrics returned numeric `ram`, `cpu`, and `battery`; VPN and Pod status APIs returned defined values.
- Portable clean-temp launch: passed; copied portable EXE stayed running from an isolated temp directory for the launch window.

## Issue Found And Fixed

Initial packaged shell-switch QA caused the app to quit while switching shells. Root cause: `createWindow()` destroyed the active window before creating the replacement, triggering Electron's `window-all-closed` quit handler in packaged mode. The fix creates and registers the next `BrowserWindow` before destroying the previous one, and only clears `ctx.mainWindow` when the closed window is still the active window.

## Shell Scope

WinShadow is the packaged landing shell for this branch. XXXplorer remains covered by dedicated vault-move and preference specs, but generic packaged smoke should not use XXXplorer as the startup surface while its renderer is visually unstable.
