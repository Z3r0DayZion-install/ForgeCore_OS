# forge

ForgeCore OS repository root.

## Repository Map

- `NeuralOS_Master_Build/` - Electron desktop runtime, shell packages, native module bindings, Playwright tests, and Windows packaging config.
- `.github/workflows/forgecore-ci.yml` - canonical CI workflow for portable build verification, NeuralOS E2E tests, and lint.
- `.github/workflows/release.yml` - tagged release workflow for portable artifacts and release manifests.
- `docs/` - root ForgeCore architecture, shipping, security, and release documentation.
- `scripts/` - root release, manifest, trust, and publishing automation.

Decision: keep `NeuralOS_Master_Build` as a subdirectory of this root repository for the current branch. The existing root package scripts and CI paths already depend on that layout.
