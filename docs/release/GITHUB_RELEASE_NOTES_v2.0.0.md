# ForgeCore OS v2.0.0 Final

Tag: `v2.0.0-forgecore-final-20260305`  
Commit: `9aee08468954a30463c4e4bb5e81b957ac4c3f29`  
Generated (manifest): `2026-03-05T21:16:27.548Z`

## What shipped

- Stable portable Windows release with full release/feed alignment gating.
- Deterministic specs pipeline for both `obey` and `mind_unset`.
- Ghost-Witness proof, resilience regression, and release hash-chain verification integrated into founder operations.
- Signed publish metadata with threshold trust-root verification.
- Ship-ready proof bundle and operations runbook.

## Integrity proof

- Artifact: `forgecore-os 2.0.0.exe`
- Size: `84,711,372` bytes
- SHA-256: `BCE82D1CABF15061227A1D2E7D0C9E8E94D96BFCA13E53E836F0853087348613`
- Specs manifest SHA-256: `4228DDC97B4DA2A7B9BED76840509930E29119CAE6D53B3275EFCB8AA1EC3784`
- Specs signatures SHA-256: `0897E327B3552ADD2EFB685284A7F6A0CE5BF1C95C4FB8F507BD96CB1CF2D246`

## Verification status

- `npm run release:harden:stable` PASS
- `npm run founder:ops` PASS
- `npm run release:align:stable` PASS
- `npm run smoke:portable` PASS (`runtimeApi=OK`)
- Dist publish alignment: `OK`
- Deployed publish alignment: `OK`

## Attached release assets

- `forgecore-os 2.0.0.exe`
- `forgecore-os-2.0.0.sha256.txt`
- `release-manifest.json`
- `artifact_hashes.txt`
- `release-feed-alignment.json`
- `specs-manifest.json`
- `specs-manifest.sha256.txt`
- `specs-manifest.signatures.json`
- `specs-manifest.sig.stub.json`
- `CHATGPT_PROOF_FILE.md`
