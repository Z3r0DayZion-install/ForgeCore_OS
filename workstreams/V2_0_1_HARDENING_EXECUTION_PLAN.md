# ForgeCore v2.0.1 Hardening Execution Plan

Branch: `release/v2.0.1-hardening`  
Baseline tag: `v2.0.0-forgecore-final-20260305`

## Objective

Ship a zero-regression hardening release that improves trust guarantees, install confidence, and operational reliability without adding risky feature scope.

## Scope gates

- No breaking API or UX changes.
- No protocol-level stealth/evasion features.
- Every change must be covered by deterministic verification.
- Release must pass:
  - `npm run release:harden:stable`
  - `npm run founder:ops`
  - `npm run release:align:stable`

## Workstream A: Trust and signing policy

1. Enforce strict signing policy in release mode:
   - Fail `ship:portable` when signature status is not acceptable in strict mode.
2. Add policy assertion test:
   - Validate trust-root threshold and required signers in CI.
3. Add trust-root rotation procedure doc with rollback-safe steps.

Acceptance:
- Release pipeline fails on unsigned artifact in strict path.
- CI asserts threshold and signer invariants.

## Workstream B: Ghost-Witness reliability

1. Add reliability counters:
   - Witness query success rate, timeout count, median latency.
2. Persist proof metrics in a rolling JSON report under `dist/`.
3. Add regression test for witness proof under retry/timing jitter.

Acceptance:
- `prove:ghost-witness` reports metrics and stays green across repeated runs.
- Founder pipeline has deterministic pass behavior.

## Workstream C: Installer and feed confidence

1. Add `feed:install:fresh` command:
   - Rotates prior install root and performs full install + verify.
2. Emit canonical install evidence bundle:
   - receipt, local+launch logs, process snapshot, summary markdown.
3. Attach evidence bundle in release workflow automation.

Acceptance:
- Fresh install flow is one command and reproducible.
- Release evidence archive is generated automatically.

## Workstream D: Packaging and attack surface

1. Add build-time assertion that packaged `app.asar` size is below a configured cap.
2. Add explicit allowlist for packaged runtime assets.
3. Add CI check that disallowed directories are excluded from packaged output.

Acceptance:
- Packaging aborts on oversized bundle or forbidden content.
- Stable binary size drift is detected automatically.

## Workstream E: Compliance and audit artifacts

1. Generate SBOM for release artifact and include hash in `artifact_hashes.txt`.
2. Add machine-readable release attestation summary (`dist/release-attestation.json`).
3. Extend ship bundle to include SBOM + attestation summary.

Acceptance:
- Ship bundle contains binary, hash chain, signatures, alignment report, SBOM, attestation.

## Definition of done

- All workstreams completed or explicitly deferred with rationale.
- Final release candidate built from this branch and tagged `v2.0.1-*`.
- Release evidence and attestation uploaded with GitHub Release assets.

