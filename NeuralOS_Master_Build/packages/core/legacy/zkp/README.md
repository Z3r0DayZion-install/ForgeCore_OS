# ForgeCore Real-ZKP Material

This directory stores verification material for Groth16 proof validation.

Required files for real mode:

- `verification_key.json`: Groth16 verification key (public).
- `verification_key.sha256`: Digest pin for `verification_key.json`.

Do not place proving keys or witnesses in this repository.

## Setup

1. Place your trusted `verification_key.json` in this folder.
2. Generate the pin file:
   - `npm run zkp:pin-key`
3. Validate readiness:
   - `npm run zkp:status`
4. Strict real-mode readiness check:
   - `cmd /c "set FORGE_ZKP_MODE=real&& npm run zkp:status:strict"`

## Runtime env controls

- `FORGE_ZKP_MODE=simulate|hybrid|real`
- `FORGE_ZKP_VERIFICATION_KEY_PATH=<absolute path>`
- `FORGE_ZKP_VERIFICATION_KEY_PIN_PATH=<absolute path>`
- `FORGE_ZKP_VKEY_SHA256=<hex digest>`

Notes:

- In `real` mode, ForgeCore requires both a loaded verification key and a pin.
- In `hybrid` mode, ForgeCore attempts real verification when full proofs are supplied and falls back to structural checks on unavailable verifier state.
