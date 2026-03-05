# NeuralTube TASKS

All deliverables for this project stay under `specs/neuraltube/outputs/`.

## Atomic tasks

| ID | Task | Output | Test |
| --- | --- | --- | --- |
| neuraltube-001 | Define canonical API contract schema. | `specs/neuraltube/outputs/api_contract.schema.json` | JSON parses and keys stay stable. |
| neuraltube-002 | Create deterministic sample payload. | `specs/neuraltube/outputs/sample_payload.json` | SHA-256 unchanged across reruns. |
| neuraltube-003 | Define intent allowlist policy format. | `specs/neuraltube/outputs/intent_allowlist.json` | Entries are explicit, no wildcards. |
| neuraltube-004 | Define audit event schema. | `specs/neuraltube/outputs/audit_event.schema.json` | Required fields validated in unit test. |
| neuraltube-005 | Define package descriptor for NeuroDrop/TEAR export. | `specs/neuraltube/outputs/package_descriptor.json` | Descriptor hash appears in spec manifest. |
| neuraltube-006 | Define HUD widget contract for health/proof display. | `specs/neuraltube/outputs/hud_widget_contract.json` | Contract versioning validates semver format. |
| neuraltube-007 | Create proof-bundle checklist. | `specs/neuraltube/outputs/proof_bundle_checklist.md` | Checklist references verify scripts. |
| neuraltube-008 | Add verification notes and expected command flow. | `specs/neuraltube/outputs/verification_notes.md` | Command list matches package scripts. |

## Verification gate
- `npm run specs:verify`
