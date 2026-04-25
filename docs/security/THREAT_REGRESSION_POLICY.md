# Threat Model Regression Policy
**Version:** v1.0.1  
**Status:** SPEC_LOCKED (Enforceable)

## 1. Goal
Ensure that structural changes do not degrade the established security posture.

## 2. Regression Categories
A structural change is considered a regression if it:
- **Reduces AAD Binding:** Removal of `Record_ID` or `Schema_Version` from AEAD payloads.
- **Lowers KDF Iterations:** Reducing `Argon2id` or `PBKDF2` parameters below current baseline.
- **Weakens Key Length:** Switching from AES-256 to a shorter key length.
- **Removes Merkle Integrity:** Disabling the `calculate_merkle_root` check on batch operations.
- **Disables Auth on Sync:** Allowing P2P synchronization without Ed25519 signature verification.

## 3. Detection Method
Regressions are detected through static analysis of the following "frozen" specification files:
- `docs/security/CRYPTOGRAPHIC_ARCHITECTURE_SPEC.md`
- `docs/security/ANTI_ROLLBACK_PROTOCOL.md`
- `ARCHITECTURE_LOCK_STATE.md`

## 4. CI Enforcement Mechanism
1. **Spec Gate:** The `ci/spec_lock_check.js` job MUST fail if any of the above files are modified without an increment in `ARCHITECTURE_LOCK_STATE.md`.
2. **Version Gate:** The job MUST fail if a version field in `ARCHITECTURE_LOCK_STATE.md` is decremented.
3. **Artifact Gate:** Release builds MUST fail if `release/manifest.json` contains a `spec_version` mismatch relative to `ARCHITECTURE_LOCK_STATE.md`.

## 5. Failure Trigger
Any violation of the above checks results in an `EXIT(1)` status, blocking the PR/Build.
