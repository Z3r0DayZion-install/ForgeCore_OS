# Scamazon TASKS

All deliverables for this project stay under `specs/scamazon/outputs/`.

## Atomic tasks

| ID | Task | Output | Test |
| --- | --- | --- | --- |
| scamazon-001 | Define canonical API contract schema. | `specs/scamazon/outputs/api_contract.schema.json` | JSON parses and keys stay stable. |
| scamazon-002 | Create deterministic sample payload. | `specs/scamazon/outputs/sample_payload.json` | SHA-256 unchanged across reruns. |
| scamazon-003 | Define intent allowlist policy format. | `specs/scamazon/outputs/intent_allowlist.json` | Entries are explicit, no wildcards. |
| scamazon-004 | Define audit event schema. | `specs/scamazon/outputs/audit_event.schema.json` | Required fields validated in unit test. |
| scamazon-005 | Define package descriptor for NeuroDrop/TEAR export. | `specs/scamazon/outputs/package_descriptor.json` | Descriptor hash appears in spec manifest. |
| scamazon-006 | Define HUD widget contract for health/proof display. | `specs/scamazon/outputs/hud_widget_contract.json` | Contract versioning validates semver format. |
| scamazon-007 | Create proof-bundle checklist. | `specs/scamazon/outputs/proof_bundle_checklist.md` | Checklist references verify scripts. |
| scamazon-008 | Add verification notes and expected command flow. | `specs/scamazon/outputs/verification_notes.md` | Command list matches package scripts. |

## Verification gate
- `npm run specs:verify`
