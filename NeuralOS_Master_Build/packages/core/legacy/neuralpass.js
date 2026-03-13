"use strict";

const TPMEnclave = require('./tpm_enclave');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const TelemetryLedger = require('./telemetry_ledger');

/**
 * NeuralPass™ — Sovereign Credential Manager
 * ------------------------------------------
 * Stores high-value secrets using TPM-enforced key wrapping.
 * Secrets never touch standard disk I/O without hardware signatures.
 */
class NeuralPass {
    constructor() {
        // In-memory enclave cache (wiped during Tier 5 Purge)
        this.secrets = new Map();
        this.storagePath = null;
        this.loaded = false;
    }

    configure(options = {}) {
        const candidate = options && typeof options.storagePath === 'string'
            ? String(options.storagePath).trim()
            : '';
        if (candidate) {
            this.storagePath = path.resolve(candidate);
        }
        this._ensureLoaded();
    }

    _normalizeId(identifier) {
        return String(identifier || '').trim();
    }

    _ensureLoaded() {
        if (this.loaded) return;
        this.loaded = true;
        if (!this.storagePath || !fs.existsSync(this.storagePath)) return;
        try {
            const raw = fs.readFileSync(this.storagePath, 'utf8');
            const parsed = raw ? JSON.parse(raw) : null;
            const items = parsed && parsed.items && typeof parsed.items === 'object'
                ? parsed.items
                : {};
            this.secrets = new Map();
            for (const [id, blob] of Object.entries(items)) {
                if (!id || !blob || typeof blob !== 'object') continue;
                if (typeof blob.iv !== 'string' || typeof blob.tag !== 'string' || typeof blob.data !== 'string') continue;
                this.secrets.set(id, {
                    iv: blob.iv,
                    tag: blob.tag,
                    data: blob.data,
                    timestamp: Number(blob.timestamp || Date.now())
                });
            }
        } catch (e) {
            console.warn(`[NEURALPASS] Failed to load persisted secrets: ${e.message}`);
        }
    }

    _persist() {
        if (!this.storagePath) return;
        const dir = path.dirname(this.storagePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const items = {};
        for (const [id, blob] of this.secrets.entries()) {
            items[id] = blob;
        }
        const payload = {
            schemaVersion: 1,
            updatedAt: new Date().toISOString(),
            items
        };
        const tmpPath = `${this.storagePath}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
        fs.renameSync(tmpPath, this.storagePath);
    }

    _encryptionKey() {
        const hwSig = TPMEnclave.hardwareSign("NEURALPASS_SALT");
        return crypto.createHash('sha256').update(hwSig).digest();
    }

    /**
     * Encrypts and stores a credential bound to the TPM.
     */
    storeSecret(identifier, plaintextSecret) {
        this._ensureLoaded();
        const normalizedId = this._normalizeId(identifier);
        const secretText = String(plaintextSecret || '');
        if (!normalizedId) return { success: false, error: 'INVALID_IDENTIFIER' };
        if (!secretText) return { success: false, error: 'EMPTY_SECRET' };
        if (normalizedId.length > 256) return { success: false, error: 'IDENTIFIER_TOO_LONG' };
        if (secretText.length > 8192) return { success: false, error: 'SECRET_TOO_LARGE' };
        console.log(`[NEURALPASS] Sealing credential: ${normalizedId}`);

        // 2. Generate a unique IV
        const iv = crypto.randomBytes(16);

        // 3. Encrypt using the hardware signature as the AES key
        const key = this._encryptionKey();
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

        const encrypted = Buffer.concat([cipher.update(secretText, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();

        // 4. Store the sealed blob
        const blob = {
            iv: iv.toString('hex'),
            tag: tag.toString('hex'),
            data: encrypted.toString('hex'),
            timestamp: Date.now()
        };

        this.secrets.set(normalizedId, blob);
        this._persist();
        TelemetryLedger.log("NEURALPASS_SEALED", { identifier: normalizedId });

        return { success: true, identifier: normalizedId, updated: true };
    }

    /**
     * Decrypts a credential, strictly requiring the TPM.
     */
    retrieveSecret(identifier) {
        this._ensureLoaded();
        const normalizedId = this._normalizeId(identifier);
        console.log(`[NEURALPASS] Requesting TPM decryption for: ${normalizedId}`);
        const blob = this.secrets.get(normalizedId);

        if (!blob) return { success: false, error: "Secret not found or purged." };

        try {
            const key = this._encryptionKey();
            const decipher = crypto.createDecipheriv(
                'aes-256-gcm',
                key,
                Buffer.from(blob.iv, 'hex')
            );
            decipher.setAuthTag(Buffer.from(blob.tag, 'hex'));

            const decrypted = Buffer.concat([
                decipher.update(Buffer.from(blob.data, 'hex')),
                decipher.final()
            ]);

            TelemetryLedger.log("NEURALPASS_ACCESSED", { identifier: normalizedId });
            return { success: true, secret: decrypted.toString('utf8') };
        } catch (e) {
            console.error(`[NEURALPASS] Hardware Decryption Failed: ${e.message}`);
            TelemetryLedger.log("NEURALPASS_VIOLATION", { identifier: normalizedId });
            return { success: false, error: "TPM_SIGNATURE_INVALID" };
        }
    }

    listSecrets() {
        this._ensureLoaded();
        const ids = Array.from(this.secrets.entries())
            .map(([id, blob]) => ({
                id,
                timestamp: Number(blob && blob.timestamp ? blob.timestamp : 0)
            }))
            .sort((a, b) => a.id.localeCompare(b.id));
        return { success: true, ids };
    }

    deleteSecret(identifier) {
        this._ensureLoaded();
        const normalizedId = this._normalizeId(identifier);
        if (!normalizedId) return { success: false, error: 'INVALID_IDENTIFIER' };
        const existed = this.secrets.delete(normalizedId);
        this._persist();
        TelemetryLedger.log("NEURALPASS_DELETE", { identifier: normalizedId, existed });
        return { success: existed, deleted: existed, identifier: normalizedId };
    }

    /**
     * Shreds the in-memory cache (invoked by NeuroDrop v3 wipe)
     */
    purge() {
        this._ensureLoaded();
        this.secrets.clear();
        this._persist();
        console.log("[NEURALPASS] All active secrets purged from memory.");
    }
}

module.exports = new NeuralPass();
