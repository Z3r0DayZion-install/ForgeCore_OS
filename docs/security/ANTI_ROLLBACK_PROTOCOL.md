# Anti-Rollback Protocol (ARP) Specification
**Version:** v1.0.1  
**Status:** SPEC_LOCKED (Binding)

## 1. Goal
Prevent state-rewind attacks by ensuring the vault cannot be reverted to a previously signed cryptographic state.

## 2. Component Definitions
- **VaultEpoch (u64):** A monotonic counter stored in the SQLite `vault_metadata` table. It increments on every database commit that modifies the `MerkleRoot`.
- **Checkpoint (u64):** The last known valid `VaultEpoch`, stored in the OS-protected `%APPDATA%\com.neuralcache.app\rollback_checkpoint.json`.
- **EpochSignature:** `Ed25519_Sign(Device_Private_Key, VaultEpoch || MerkleRoot)`.

## 3. Storage Location
- **In-Vault:** `vault_metadata` (Table: `key='current_epoch'`, `key='epoch_signature'`).
- **External (Local):** `%APPDATA%\com.neuralcache.app\rollback_checkpoint.json` (Field: `last_known_epoch`).

## 4. Verification Sequence (Open-Time)
On application launch, before unlocking the SQLite vault:
1. **Load Checkpoint:** Read `last_known_epoch` from the external checkpoint file.
2. **Load Metadata:** Read `VaultEpoch` and `EpochSignature` from the vault.
3. **Verify Signature:** Confirm `EpochSignature` is valid for the current `VaultEpoch` and `MerkleRoot` using the `Device_Public_Key`.
4. **Compare:**
   - If `VaultEpoch < last_known_epoch` → **ROLLBACK_DETECTION_FAILURE**.
   - If `VaultEpoch == last_known_epoch` → **VALID_STATE**.
   - If `VaultEpoch > last_known_epoch` → **VALID_UPDATE** (Update checkpoint after successful unlock).

## 5. Failure & Recovery
- **Signature Mismatch:** The vault is considered tampered. Access is **DENIED**.
- **Rollback Detected:** The system enters **Safe Mode**.
  - **Safe Mode Behavior:** Read-only access to a memory-mapped snapshot. P2P Sync and persistence are disabled.
- **Recovery Override:** To reset a checkpoint, the user must provide a `RECOVERY_BLOB` signed by the original `Device_Private_Key` containing the new target epoch.

## 6. Version Interaction
- **merkle_version / envelope_version:** A version bump in either field resets the `VaultEpoch` to 0. This transition MUST be signed by the previous version's key to maintain the chain of trust.
