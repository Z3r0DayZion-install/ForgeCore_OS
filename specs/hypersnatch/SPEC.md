# HyperSnatch SPEC

## Source Context
- MinePack source: `repos/minepacks/NeuralEmpire_ChatArchive_MinePack`
- Dossier: `projects/HyperSnatch.md`
- Selection signal: `project_presence` (HyperSnatch: 58)
- Dossier presence metric: 58

## Mission
Define a defensive-only, deterministic module specification for **HyperSnatch** within ForgeCore.

## Co-Mention Context
- NeuroDrop (4935x co-mentions)
- NeuralOS (2769x co-mentions)
- NeuralVault (590x co-mentions)
- ZeroTrace (507x co-mentions)
- TearGrid (209x co-mentions)
- TearDrop (149x co-mentions)
- NeuralPass (131x co-mentions)
- FartSuite (87x co-mentions)

## Scope
1. Freeze SPEC: boundaries + APIs + file tree
2. Determinism kit: canonical JSON, hash vectors, atomic writes
3. Security suite hooks: intent firewall, allowlists, audit ledger
4. Packaging: NeuroDrop/TEAR export + VERIFY scripts
5. UX: HUD panels + health widgets + "proof bundle" UI
6. Monetization: tier gates + license/activation checks (offline-first)

## Non-Goals
- No stealth/evasion or covert channels.
- No offensive behavior or automation.
- No non-deterministic output formats.

## Determinism Rules
- UTF-8 text, LF line endings, stable field ordering.
- SHA-256 for every release-relevant artifact.
- Atomic write pattern (`.tmp` + rename) for generated files.

## Dependency Policy
See `specs/DEPENDENCY_POLICY.md` and `specs/dependency-pins.json`.

## Acceptance Criteria
1. `TASKS.md` contains only atomic, testable tasks.
2. Output scope is limited to `specs/<project>/outputs/`.
3. `npm run specs:verify` succeeds and emits dist manifests.
