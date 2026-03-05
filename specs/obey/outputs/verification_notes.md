# Verification Notes

Expected sequence:
- `npm run specs:check`
- `npm run specs:verify`
- `npm run specs:sign`
- `npm run specs:verify:signatures`
- `npm run founder:ops`

The release hash chain is valid when `dist/artifact_hashes.txt` includes both:
- `forgecore-os 2.0.0.exe`
- `specs-manifest.json`
