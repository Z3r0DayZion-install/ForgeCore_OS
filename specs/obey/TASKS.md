# Obey TASKS

All deliverables for this project stay under `specs/obey/outputs/`.

## Atomic tasks

| ID | Task | Output | Test |
| --- | --- | --- | --- |
| obey-001 | Define canonical API contract schema. | `specs/obey/outputs/api_contract.schema.json` | JSON parses and keys stay stable. |
| obey-002 | Create deterministic sample payload. | `specs/obey/outputs/sample_payload.json` | SHA-256 unchanged across reruns. |
| obey-003 | Define intent allowlist policy format. | `specs/obey/outputs/intent_allowlist.json` | Entries are explicit, no wildcards. |
| obey-004 | Define audit event schema. | `specs/obey/outputs/audit_event.schema.json` | Required fields validated in unit test. |
| obey-005 | Define package descriptor for NeuroDrop/TEAR export. | `specs/obey/outputs/package_descriptor.json` | Descriptor hash appears in spec manifest. |
| obey-006 | Define HUD widget contract for health/proof display. | `specs/obey/outputs/hud_widget_contract.json` | Contract versioning validates semver format. |
| obey-007 | Create proof-bundle checklist. | `specs/obey/outputs/proof_bundle_checklist.md` | Checklist references verify scripts. |
| obey-008 | Add verification notes and expected command flow. | `specs/obey/outputs/verification_notes.md` | Command list matches package scripts. |

## Verification gate
- `npm run specs:verify`
