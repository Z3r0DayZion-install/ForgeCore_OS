#!/usr/bin/env bash
set -euo pipefail

echo "[deterministic] Installing pinned dependencies"
npm ci

echo "[deterministic] Generating and verifying MinePack specs"
npm run specs:generate
npm run specs:materialize:obey
npm run specs:materialize:mind_unset
npm run test:specs:obey
npm run test:specs:mind_unset
npm run specs:verify
npm run specs:sign
npm run specs:verify:signatures

echo "[deterministic] Building portable artifact"
npm run build:portable

echo "[deterministic] Writing release manifest + checksum"
node scripts/release_portable.cjs
echo "[deterministic] Verifying artifact + release hash chain"
npm run verify:portable
npm run verify:release

echo "[deterministic] Done"
