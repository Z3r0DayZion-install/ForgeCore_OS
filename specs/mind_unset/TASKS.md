# Mind Unset TASKS

All deliverables for this project stay under `specs/mind_unset/outputs/`.

## Atomic tasks

| ID | Task | Output | Test |
| --- | --- | --- | --- |
| mind_unset-001 | Define canonical API contract schema. | `specs/mind_unset/outputs/api_contract.schema.json` | JSON parses and keys stay stable. |
| mind_unset-002 | Create deterministic sample payload. | `specs/mind_unset/outputs/sample_payload.json` | SHA-256 unchanged across reruns. |
| mind_unset-003 | Define intent allowlist policy format. | `specs/mind_unset/outputs/intent_allowlist.json` | Entries are explicit, no wildcards. |
| mind_unset-004 | Define audit event schema. | `specs/mind_unset/outputs/audit_event.schema.json` | Required fields validated in unit test. |
| mind_unset-005 | Define package descriptor for NeuroDrop/TEAR export. | `specs/mind_unset/outputs/package_descriptor.json` | Descriptor hash appears in spec manifest. |
| mind_unset-006 | Define HUD widget contract for health/proof display. | `specs/mind_unset/outputs/hud_widget_contract.json` | Contract versioning validates semver format. |
| mind_unset-007 | Create proof-bundle checklist. | `specs/mind_unset/outputs/proof_bundle_checklist.md` | Checklist references verify scripts. |
| mind_unset-008 | Add verification notes and expected command flow. | `specs/mind_unset/outputs/verification_notes.md` | Command list matches package scripts. |

## Verification gate
- `npm run specs:verify`
