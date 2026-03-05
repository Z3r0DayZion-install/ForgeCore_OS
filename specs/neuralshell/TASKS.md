# NeuralShell TASKS

All deliverables for this project stay under `specs/neuralshell/outputs/`.

## Atomic tasks

| ID | Task | Output | Test |
| --- | --- | --- | --- |
| neuralshell-001 | Define canonical API contract schema. | `specs/neuralshell/outputs/api_contract.schema.json` | JSON parses and keys stay stable. |
| neuralshell-002 | Create deterministic sample payload. | `specs/neuralshell/outputs/sample_payload.json` | SHA-256 unchanged across reruns. |
| neuralshell-003 | Define intent allowlist policy format. | `specs/neuralshell/outputs/intent_allowlist.json` | Entries are explicit, no wildcards. |
| neuralshell-004 | Define audit event schema. | `specs/neuralshell/outputs/audit_event.schema.json` | Required fields validated in unit test. |
| neuralshell-005 | Define package descriptor for NeuroDrop/TEAR export. | `specs/neuralshell/outputs/package_descriptor.json` | Descriptor hash appears in spec manifest. |
| neuralshell-006 | Define HUD widget contract for health/proof display. | `specs/neuralshell/outputs/hud_widget_contract.json` | Contract versioning validates semver format. |
| neuralshell-007 | Create proof-bundle checklist. | `specs/neuralshell/outputs/proof_bundle_checklist.md` | Checklist references verify scripts. |
| neuralshell-008 | Add verification notes and expected command flow. | `specs/neuralshell/outputs/verification_notes.md` | Command list matches package scripts. |

## Verification gate
- `npm run specs:verify`
