# NeuralOS SPEC

## Source Context
- MinePack source: `repos/minepacks/NeuralEmpire_ChatArchive_MinePack`
- Dossier: `projects/NeuralOS.md`
- Selection signal: `project_presence` (NeuralOS: 80)
- Dossier presence metric: 80

## Mission
Define a defensive-only, deterministic module specification for **NeuralOS** within ForgeCore.

## Co-Mention Context
- NeuroDrop (5326x co-mentions)
- NeuralVault (758x co-mentions)
- ZeroTrace (504x co-mentions)
- TearGrid (209x co-mentions)
- NeuralDrop (168x co-mentions)
- TearDrop (159x co-mentions)
- NeuralPass (159x co-mentions)
- DirectDrop (144x co-mentions)

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
