# TearGrid TASKS

All deliverables for this project stay under `specs/teargrid/outputs/`.

## Atomic tasks

| ID | Task | Output | Test |
| --- | --- | --- | --- |
| teargrid-001 | Define canonical API contract schema. | `specs/teargrid/outputs/api_contract.schema.json` | JSON parses and keys stay stable. |
| teargrid-002 | Create deterministic sample payload. | `specs/teargrid/outputs/sample_payload.json` | SHA-256 unchanged across reruns. |
| teargrid-003 | Define intent allowlist policy format. | `specs/teargrid/outputs/intent_allowlist.json` | Entries are explicit, no wildcards. |
| teargrid-004 | Define audit event schema. | `specs/teargrid/outputs/audit_event.schema.json` | Required fields validated in unit test. |
| teargrid-005 | Define package descriptor for NeuroDrop/TEAR export. | `specs/teargrid/outputs/package_descriptor.json` | Descriptor hash appears in spec manifest. |
| teargrid-006 | Define HUD widget contract for health/proof display. | `specs/teargrid/outputs/hud_widget_contract.json` | Contract versioning validates semver format. |
| teargrid-007 | Create proof-bundle checklist. | `specs/teargrid/outputs/proof_bundle_checklist.md` | Checklist references verify scripts. |
| teargrid-008 | Add verification notes and expected command flow. | `specs/teargrid/outputs/verification_notes.md` | Command list matches package scripts. |

## Verification gate
- `npm run specs:verify`
