# ForgeCore Ship Operations

Canonical release flow for the current ForgeCore runtime.

## 0) One-command stable hardening

```bash
npm run release:harden:stable
```

This runs the full stable release chain, including publish, deploy, feed verify, and release/feed alignment gating.

## 1) Generate and verify specs bundle

```bash
npm run specs:generate
npm run specs:materialize:obey
npm run specs:materialize:mind_unset
npm run test:specs:obey
npm run test:specs:mind_unset
npm run specs:check
npm run specs:verify
npm run specs:sign
npm run specs:verify:signatures
```

## 2) Build and package

```bash
npm run build:portable
node scripts/release_portable.cjs
```

## 3) Runtime and integrity checks

```bash
npm run smoke:portable
npm run verify:portable
npm run verify:release
```

## 4) Founder validation gate

```bash
npm run founder:ops
```

This executes:

1. ghost-witness proof
2. Obey output materialization + unit test
3. MindUnset output materialization + unit test
4. specs drift check
5. specs manifest verification
6. specs detached-signature verification
7. resilience regression
8. release-hash verification

## 5) Ship-ready handoff bundle

```bash
npm run ship:ready
```

Output directory:

`release/ship_ready/`

Contains:

- built artifact
- release manifest
- checksum file
- artifact hash chain
- specs directory (top-10 generated project specs)
- specs hash manifest + detached signatures
- command sequence
- ChatGPT proof file

## 6) Alignment gate (manual)

```bash
npm run release:align:stable
```

Checks that `dist/release-manifest.json`, `dist/publish/stable/*`, and deployed feed metadata all point to the same artifact hash/version.
