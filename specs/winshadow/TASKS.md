# WinShadow TASKS

All deliverables for this project stay under `specs/winshadow/outputs/`.

## Atomic tasks

| ID | Task | Output | Test |
| --- | --- | --- | --- |
| winshadow-001 | Define canonical API contract schema. | `specs/winshadow/outputs/api_contract.schema.json` | JSON parses and keys stay stable. |
| winshadow-002 | Create deterministic sample payload. | `specs/winshadow/outputs/sample_payload.json` | SHA-256 unchanged across reruns. |
| winshadow-003 | Define intent allowlist policy format. | `specs/winshadow/outputs/intent_allowlist.json` | Entries are explicit, no wildcards. |
| winshadow-004 | Define audit event schema. | `specs/winshadow/outputs/audit_event.schema.json` | Required fields validated in unit test. |
| winshadow-005 | Define package descriptor for NeuroDrop/TEAR export. | `specs/winshadow/outputs/package_descriptor.json` | Descriptor hash appears in spec manifest. |
| winshadow-006 | Define HUD widget contract for health/proof display. | `specs/winshadow/outputs/hud_widget_contract.json` | Contract versioning validates semver format. |
| winshadow-007 | Create proof-bundle checklist. | `specs/winshadow/outputs/proof_bundle_checklist.md` | Checklist references verify scripts. |
| winshadow-008 | Add verification notes and expected command flow. | `specs/winshadow/outputs/verification_notes.md` | Command list matches package scripts. |

## Verification gate
- `npm run specs:verify`
