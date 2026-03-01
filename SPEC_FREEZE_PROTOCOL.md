# SPEC_FREEZE_PROTOCOL

Purpose:
Ensure core architecture changes are deliberate and traceable.

---

## Freeze Levels

Level 0 — Cosmetic
- Formatting
- Comment clarity
- Typo fixes

Level 1 — Behavioral Non-Security
- UI tweaks
- Performance optimizations
- Logging improvements

Level 2 — Structural
- Schema updates
- Manifest schema expansion
- Sync state machine adjustments

Level 3 — Cryptographic / Integrity
- Cipher changes
- KDF changes
- Envelope format changes
- Merkle rules changes
- Anti-rollback model changes

---

## Level 3 Changes Require:

1. SPEC document update
2. Version increment (envelope_version, merkle_version, etc.)
3. Migration path doc
4. Updated test coverage
5. Explicit risk analysis entry
6. CI gate approval

No Level 3 changes without founder approval.
