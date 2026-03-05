# Refund Ops TASKS

All deliverables for this project stay under `specs/refund_ops/outputs/`.

## Atomic tasks

| ID | Task | Output | Test |
| --- | --- | --- | --- |
| refund_ops-001 | Define canonical API contract schema. | `specs/refund_ops/outputs/api_contract.schema.json` | JSON parses and keys stay stable. |
| refund_ops-002 | Create deterministic sample payload. | `specs/refund_ops/outputs/sample_payload.json` | SHA-256 unchanged across reruns. |
| refund_ops-003 | Define intent allowlist policy format. | `specs/refund_ops/outputs/intent_allowlist.json` | Entries are explicit, no wildcards. |
| refund_ops-004 | Define audit event schema. | `specs/refund_ops/outputs/audit_event.schema.json` | Required fields validated in unit test. |
| refund_ops-005 | Define package descriptor for NeuroDrop/TEAR export. | `specs/refund_ops/outputs/package_descriptor.json` | Descriptor hash appears in spec manifest. |
| refund_ops-006 | Define HUD widget contract for health/proof display. | `specs/refund_ops/outputs/hud_widget_contract.json` | Contract versioning validates semver format. |
| refund_ops-007 | Create proof-bundle checklist. | `specs/refund_ops/outputs/proof_bundle_checklist.md` | Checklist references verify scripts. |
| refund_ops-008 | Add verification notes and expected command flow. | `specs/refund_ops/outputs/verification_notes.md` | Command list matches package scripts. |

## Verification gate
- `npm run specs:verify`
