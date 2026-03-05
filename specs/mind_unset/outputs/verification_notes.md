# Verification Notes

Expected sequence:
- `npm run specs:materialize:mind_unset`
- `npm run test:specs:mind_unset`
- `npm run specs:verify`
- `npm run specs:attest`
- `npm run verify:release`

The release is valid when the hash chain includes:
- `forgecore-os 2.0.0.exe`
- `specs-manifest.json`
- `specs-manifest.signatures.json`
