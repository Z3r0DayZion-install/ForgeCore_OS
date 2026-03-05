# TEAR_SPEC_v1.md — Sovereign Container Format

## 📋 EXECUTIVE SUMMARY
**STATUS**: 🛠️ DRAFT v1.0
The TEAR Container is an encrypted, tier-gated, and self-verifying package format for offline distribution within the Neural Empire.

---

## 📦 CONTAINER STRUCTURE

A TEAR container (`.tear`) is a binary bundle with three distinct sections:

### 1. THE HEADER (UNENCRYPTED)
- **MAGIC**: `TEAR`
- **VERSION**: `0x01`
- **TIER_CLAIM**: (e.g. `OMEGA`, `SOVEREIGN`, `PILOT`)
- **MANIFEST_HASH**: SHA-256 of the internal manifest.

### 2. THE PAYLOAD (ENCRYPTED)
- **Format**: AES-256-GCM.
- **Key**: Derived from Hardware DNA + Tier Secret.
- **Content**: Compressed artifact blob.

### 3. THE PROOF (SIGNED)
- **Signature**: Ed25519 signature of (Header + Payload).
- **Audit Hash**: The Merkle Root of the previous TEAR chain entry.

---

## 🛡️ SECURITY INVARIANTS
1.  **Hardware Binding**: A container can be locked to a specific Machine DNA.
2.  **Tier Gating**: Decryption only succeeds if the local DNA matches the tier's authorization level.
3.  **Deterministic Packing**: Packing the same files always produces the same binary hash.

---

## 🚀 ROADMAP (v1.0)
1. **[DONE]** Spec Formulation.
2. **[TODO]** Implementation of `tear_packer.js`.
3. **[TODO]** Integration into `v3_sovereign_server.js` for vault exports.
