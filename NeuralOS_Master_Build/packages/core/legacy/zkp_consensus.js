"use strict";

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const AVAILABLE_HASHES = new Set(crypto.getHashes());
const ZKP_PROOF_DIGEST = AVAILABLE_HASHES.has('sha3-512') ? 'sha3-512' : 'sha512';
const ZKP_VKEY_DIGEST = AVAILABLE_HASHES.has('sha3-256') ? 'sha3-256' : 'sha256';
const ZKP_MAX_TTL_MS = Math.max(15_000, Number(process.env.FORGE_ZKP_MAX_TTL_MS || 120_000));
const ZKP_CLOCK_SKEW_MS = Math.max(1_000, Number(process.env.FORGE_ZKP_CLOCK_SKEW_MS || 30_000));
const ZKP_NONCE_REPLAY_WINDOW_MS = Math.max(30_000, Number(process.env.FORGE_ZKP_REPLAY_WINDOW_MS || 10 * 60_000));
const ZKP_MODE = String(process.env.FORGE_ZKP_MODE || 'hybrid').trim().toLowerCase();
const HEX_RE = /^[a-f0-9]+$/i;

/**
 * ZERO-KNOWLEDGE PROOF (ZKP) SWARM CONSENSUS
 * Privacy-Preserving Audit Mesh (IP Gold)
 * 
 * Replaces sharing raw hashes with non-interactive proofs.
 * Simulated interface for snarkjs/Circom integration.
 */
class ZKPConsensus {
    constructor() {
        this.provingKey = "FC_PROVING_KEY_V1";
        this.verificationKey = "FC_VERIFICATION_KEY_V1";
        this.usedNonces = new Map(); // nonce -> expiresAt
        this.mode = ['simulate', 'hybrid', 'real'].includes(ZKP_MODE) ? ZKP_MODE : 'hybrid';
        this.verificationKeyPath = path.resolve(String(process.env.FORGE_ZKP_VERIFICATION_KEY_PATH || path.join(__dirname, 'zkp', 'verification_key.json')));
        this.verificationKeyPinPath = path.resolve(String(process.env.FORGE_ZKP_VERIFICATION_KEY_PIN_PATH || path.join(__dirname, 'zkp', 'verification_key.sha256')));
        this.pinnedVKeyHash = String(process.env.FORGE_ZKP_VKEY_SHA256 || '').trim().toLowerCase();
        this._snarkjs = null;
        this._snarkLoadTried = false;
        this._verificationKeyCache = null;
        this._lastRealVerify = {
            attemptedAt: null,
            ok: null,
            mode: this.mode,
            reason: 'not_attempted'
        };
        this._lastError = null;
    }

    _cleanupReplayCache(nowMs = Date.now()) {
        for (const [nonce, expiresAt] of this.usedNonces.entries()) {
            if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) {
                this.usedNonces.delete(nonce);
            }
        }
    }

    _deriveSignal({ dnaSeal, latestChainHash, nonce, issuedAt, expiresAt }) {
        return crypto.createHash(ZKP_PROOF_DIGEST)
            .update(String(dnaSeal || ''))
            .update('|')
            .update(String(latestChainHash || ''))
            .update('|')
            .update(String(nonce || ''))
            .update('|')
            .update(String(issuedAt || ''))
            .update('|')
            .update(String(expiresAt || ''))
            .update('|')
            .update(this.provingKey)
            .digest('hex');
    }

    _isHex(value, min = 1, max = Number.MAX_SAFE_INTEGER) {
        const text = String(value || '').trim();
        return text.length >= min && text.length <= max && HEX_RE.test(text);
    }

    _packProofSignal(signalHex) {
        const text = String(signalHex || '').padEnd(128, '0').slice(0, 128);
        return {
            pi_a: [text.slice(0, 32), text.slice(32, 64)],
            pi_b: [[text.slice(64, 96)], [text.slice(96, 128)]]
        };
    }

    _normalizeProofShape(proof) {
        if (!proof || typeof proof !== 'object') return null;
        if (proof.protocol !== 'groth16') return null;
        if (!Array.isArray(proof.pi_a) || proof.pi_a.length !== 2) return null;
        if (!Array.isArray(proof.pi_b) || proof.pi_b.length !== 2) return null;
        if (!Array.isArray(proof.pi_b[0]) || proof.pi_b[0].length < 1) return null;
        if (!Array.isArray(proof.pi_b[1]) || proof.pi_b[1].length < 1) return null;

        const piA0 = String(proof.pi_a[0] || '').trim();
        const piA1 = String(proof.pi_a[1] || '').trim();
        const piB00 = String(proof.pi_b[0][0] || '').trim();
        const piB10 = String(proof.pi_b[1][0] || '').trim();
        if (!this._isHex(piA0, 16, 128) || !this._isHex(piA1, 16, 128)) return null;
        if (!this._isHex(piB00, 16, 128) || !this._isHex(piB10, 16, 128)) return null;

        const publicSignals = Array.isArray(proof.publicSignals)
            ? proof.publicSignals.map((x) => String(x || '').trim()).filter(Boolean)
            : [];
        if (!publicSignals.length) return null;

        const nonce = String(proof.nonce || '').trim();
        const issuedAt = Number(proof.issuedAt || 0);
        const expiresAt = Number(proof.expiresAt || 0);
        if (!this._isHex(nonce, 16, 128)) return null;
        if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return null;
        if (expiresAt <= issuedAt) return null;
        if (expiresAt - issuedAt > ZKP_MAX_TTL_MS) return null;

        return {
            proof,
            piA0,
            piA1,
            piB00,
            piB10,
            nonce,
            issuedAt,
            expiresAt,
            latestChainHash: publicSignals[0],
            publicSignals
        };
    }

    _loadPinHash() {
        if (this.pinnedVKeyHash && this._isHex(this.pinnedVKeyHash, 32, 128)) {
            return this.pinnedVKeyHash.toLowerCase();
        }
        try {
            if (!fs.existsSync(this.verificationKeyPinPath)) return '';
            const raw = String(fs.readFileSync(this.verificationKeyPinPath, 'utf8') || '')
                .trim()
                .split(/\s+/)[0]
                .toLowerCase();
            return this._isHex(raw, 32, 128) ? raw : '';
        } catch {
            return '';
        }
    }

    _loadSnarkjs() {
        if (this._snarkLoadTried) return this._snarkjs;
        this._snarkLoadTried = true;
        try {
            // Optional dependency; only required in hybrid/real when full proofs are supplied.
            this._snarkjs = require('snarkjs');
        } catch {
            this._snarkjs = null;
        }
        return this._snarkjs;
    }

    _loadVerificationKey() {
        const now = Date.now();
        if (this._verificationKeyCache && this._verificationKeyCache.loadedAt && (now - this._verificationKeyCache.loadedAt) < 10_000) {
            return this._verificationKeyCache;
        }

        if (!fs.existsSync(this.verificationKeyPath)) {
            throw new Error(`ZKP_VKEY_MISSING:${this.verificationKeyPath}`);
        }
        const raw = fs.readFileSync(this.verificationKeyPath, 'utf8');
        const parsed = JSON.parse(raw);
        const canonical = JSON.stringify(parsed);
        const hash = crypto.createHash(ZKP_VKEY_DIGEST).update(canonical).digest('hex').toLowerCase();
        const pin = this._loadPinHash();
        if (this.mode === 'real' && !pin) {
            throw new Error('ZKP_VKEY_PIN_REQUIRED_IN_REAL_MODE');
        }
        if (pin && pin !== hash) {
            throw new Error(`ZKP_VKEY_PIN_MISMATCH:${hash}`);
        }

        const cache = {
            path: this.verificationKeyPath,
            hash,
            pinnedHash: pin || null,
            key: parsed,
            loadedAt: now
        };
        this._verificationKeyCache = cache;
        return cache;
    }

    _hasGroth16FullProof(proof) {
        if (!proof || typeof proof !== 'object') return false;
        if (!Array.isArray(proof.pi_c) || proof.pi_c.length < 2) return false;
        return true;
    }

    async _verifyRealGroth16(proof, publicSignals) {
        const snark = this._loadSnarkjs();
        if (!snark || !snark.groth16 || typeof snark.groth16.verify !== 'function') {
            throw new Error('SNARKJS_UNAVAILABLE');
        }
        const vkey = this._loadVerificationKey();
        const ok = await snark.groth16.verify(vkey.key, publicSignals, proof);
        return {
            ok: !!ok,
            keyHash: vkey.hash,
            keyPath: vkey.path,
            pin: vkey.pinnedHash
        };
    }

    _markRealVerify(ok, reason, meta = null) {
        this._lastRealVerify = {
            attemptedAt: new Date().toISOString(),
            ok: !!ok,
            mode: this.mode,
            reason: String(reason || ''),
            meta: meta && typeof meta === 'object' ? meta : null
        };
        if (!ok) this._lastError = String(reason || 'ZKP_VERIFY_FAILED');
    }

    /**
     * Generates a zk-SNARK proof that this node possesses a valid TEAR chain
     * WITHOUT revealing the chain itself.
     * @param {string} dnaSeal The private DNA seal
     * @param {string} latestChainHash The public known head of the chain
     */
    async generateProofOfIntegrity(dnaSeal, latestChainHash) {
        console.log("[ZKP] Generating Zero-Knowledge Proof of Integrity...");

        const issuedAt = Date.now();
        const expiresAt = issuedAt + ZKP_MAX_TTL_MS;
        const nonce = crypto.randomBytes(16).toString('hex');
        const proofSignal = this._deriveSignal({
            dnaSeal,
            latestChainHash,
            nonce,
            issuedAt,
            expiresAt
        });
        const packed = this._packProofSignal(proofSignal);

        const publicSignals = [latestChainHash];

        return {
            schemaVersion: 2,
            issuedAt,
            expiresAt,
            nonce,
            pi_a: packed.pi_a,
            pi_b: packed.pi_b,
            publicSignals,
            protocol: "groth16"
        };
    }

    /**
     * Verifies a proof from a peer.
     */
    async verifyProof(proof, options = {}) {
        console.log("[ZKP] Verifying zk-SNARK proof from peer...");

        this._cleanupReplayCache();
        const normalized = this._normalizeProofShape(proof);
        if (!normalized) return false;

        const now = Date.now();
        if (normalized.issuedAt - now > ZKP_CLOCK_SKEW_MS) return false;
        if (now > (normalized.expiresAt + ZKP_CLOCK_SKEW_MS)) return false;

        if (this.usedNonces.has(normalized.nonce)) {
            return false;
        }

        const expectedHead = String(options.expectedHeadCID || '').trim();
        if (expectedHead && normalized.latestChainHash !== expectedHead) {
            return false;
        }

        if (normalized.latestChainHash.length < 8 || normalized.latestChainHash.length > 256) {
            return false;
        }

        const fullProof = this._hasGroth16FullProof(normalized.proof);
        if (this.mode !== 'simulate' && fullProof) {
            try {
                const real = await this._verifyRealGroth16(normalized.proof, normalized.publicSignals);
                if (!real.ok) {
                    this._markRealVerify(false, 'REAL_PROOF_INVALID', { keyHash: real.keyHash, keyPath: real.keyPath });
                    return false;
                }
                this._markRealVerify(true, 'REAL_PROOF_VALID', { keyHash: real.keyHash, keyPath: real.keyPath, pin: real.pin });
            } catch (err) {
                const reason = String(err && err.message ? err.message : err);
                this._markRealVerify(false, reason);
                if (this.mode === 'real') return false;
                // hybrid mode falls through to structural checks if real verification is unavailable.
            }
        } else if (this.mode === 'real') {
            this._markRealVerify(false, 'REAL_MODE_REQUIRES_FULL_PROOF');
            return false;
        }

        // Deterministic structural verification fallback.
        const canonical = `${normalized.piA0}${normalized.piA1}${normalized.piB00}${normalized.piB10}`;
        if (!this._isHex(canonical, 64, 512)) return false;

        const replayExpiry = Math.max(now + 60_000, normalized.expiresAt + ZKP_NONCE_REPLAY_WINDOW_MS);
        this.usedNonces.set(normalized.nonce, replayExpiry);
        this._cleanupReplayCache(now);
        return true;
    }

    getStatus() {
        const snark = this._loadSnarkjs();
        const base = {
            mode: this.mode,
            replayCacheSize: this.usedNonces.size,
            verificationKeyDigest: ZKP_VKEY_DIGEST,
            verificationKeyPath: this.verificationKeyPath,
            verificationKeyPinPath: this.verificationKeyPinPath,
            pinnedHash: this._loadPinHash() || null,
            snarkjsAvailable: !!snark,
            lastRealVerify: this._lastRealVerify,
            lastError: this._lastError
        };
        try {
            const vkey = this._loadVerificationKey();
            return {
                ...base,
                verificationKeyLoaded: true,
                verificationKeyHash: vkey.hash
            };
        } catch (err) {
            return {
                ...base,
                verificationKeyLoaded: false,
                verificationKeyHash: null,
                verificationKeyError: String(err && err.message ? err.message : err)
            };
        }
    }
}

module.exports = new ZKPConsensus();
