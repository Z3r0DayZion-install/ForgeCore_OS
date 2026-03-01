# ARCHITECTURE_LOCK_STATE
**Project:** NeuralCache  
**Version:** v3.1 (Current)  
**Status:** ARCHITECTURE_LOCKED

## Current Locked Versions:
- **schema_version:** v1
- **envelope_version:** v1
- **merkle_version:** v1
- **identity_version:** v1
- **kdf_version:** v1
- **pq_abstraction_version:** v0

## Protocols & Compliance:
- All changes to the above versions require **SPEC_FREEZE_PROTOCOL** compliance.
- Any reduction in these version numbers is prohibited by the **THREAT_REGRESSION_POLICY**.
- Version state MUST be synchronized with `release/manifest.json` on every production build.
