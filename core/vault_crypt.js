"use strict";

const crypto = require('crypto');

/**
 * VAULT_CRYPT v1.0 [AES-256-GCM]
 * Handles military-grade encryption for Sovereign Vaults.
 */

const VaultCrypt = {
    algorithm: 'aes-256-gcm',

    encrypt(text, passphraseStr) {
        // Enforce Buffer usage for shredding
        const passphrase = Buffer.from(passphraseStr, 'utf8');
        const salt = crypto.randomBytes(64);
        const iv = crypto.randomBytes(16);
        const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
        const cipher = crypto.createCipheriv(this.algorithm, key, iv);

        const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();

        // Tier 3: Autonomous Shredding (Zeroing Memory instantly)
        passphrase.fill(0);
        key.fill(0);

        // Tier 3: Deniable Storage (Holographic Blob)
        // Format: [SALT:64][IV:16][TAG:16][PAYLOAD:X]
        return Buffer.concat([salt, iv, tag, encrypted]);
    },

    decrypt(packBuffer, passphraseStr) {
        const passphrase = Buffer.from(passphraseStr, 'utf8');

        // Ensure minimum length: salt(64) + iv(16) + tag(16) = 96 bytes
        if (packBuffer.length < 96) throw new Error("Holographic blob corrupted.");

        const salt = packBuffer.subarray(0, 64);
        const iv = packBuffer.subarray(64, 80);
        const tag = packBuffer.subarray(80, 96);
        const payload = packBuffer.subarray(96);

        const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
        const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
        decipher.setAuthTag(tag);

        try {
            const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
            // Tier 3: Autonomous Shredding
            passphrase.fill(0);
            key.fill(0);
            return decrypted.toString('utf8');
        } catch (e) {
            passphrase.fill(0);
            key.fill(0);
            throw e;
        }
    }
};

module.exports = VaultCrypt;
