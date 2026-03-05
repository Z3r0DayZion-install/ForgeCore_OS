# HyperSnatch TASKS

All deliverables for this project stay under `specs/hypersnatch/outputs/`.

## Atomic tasks

| ID | Task | Output | Test |
| --- | --- | --- | --- |
| hypersnatch-001 | Define canonical API contract schema. | `specs/hypersnatch/outputs/api_contract.schema.json` | JSON parses and keys stay stable. |
| hypersnatch-002 | Create deterministic sample payload. | `specs/hypersnatch/outputs/sample_payload.json` | SHA-256 unchanged across reruns. |
| hypersnatch-003 | Define intent allowlist policy format. | `specs/hypersnatch/outputs/intent_allowlist.json` | Entries are explicit, no wildcards. |
| hypersnatch-004 | Define audit event schema. | `specs/hypersnatch/outputs/audit_event.schema.json` | Required fields validated in unit test. |
| hypersnatch-005 | Define package descriptor for NeuroDrop/TEAR export. | `specs/hypersnatch/outputs/package_descriptor.json` | Descriptor hash appears in spec manifest. |
| hypersnatch-006 | Define HUD widget contract for health/proof display. | `specs/hypersnatch/outputs/hud_widget_contract.json` | Contract versioning validates semver format. |
| hypersnatch-007 | Create proof-bundle checklist. | `specs/hypersnatch/outputs/proof_bundle_checklist.md` | Checklist references verify scripts. |
| hypersnatch-008 | Add verification notes and expected command flow. | `specs/hypersnatch/outputs/verification_notes.md` | Command list matches package scripts. |

## Verification gate
- `npm run specs:verify`
