"use strict";

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * TEAR_Engine.js — Transparent Evidence Analysis & Resurrection
 * ForgeCore™ Native TEAR Protocol v3.2.0
 * 
 * Implements:
 *   seal()     — Create signed TEAR-AUDIT-CHAIN containers
 *   verify()   — Validate .tear.json integrity (signature + fingerprint + merkle)
 *   bundle()   — Package assets into hs-tear-bundle-1 format
 */

const MerkleDagFS = require('./merkle_dag_fs');
const ExecutionChain = require('./execution_chain'); // [IP_GOLD]

class TEAR_Engine {
    constructor(rootDir, dnaModule) {
        this.rootDir = rootDir;
        this.dna = dnaModule;
        this.chainDir = path.join(rootDir, 'vaults', '.tear_chain');
        this.version = '3.2.0';
        this.buildId = `FC-SINGULARITY-${new Date().toISOString().split('T')[0]}`;
        this.engineVersion = '2.0.0-Omega';
        this._chainCache = null; // In-memory cache, lazy-loaded
        this.onNewBlock = null; // Callback for P2P sync
        
        // [IP_GOLD] Execution Chain Integration
        this.executionChain = new ExecutionChain(rootDir);

        if (!fs.existsSync(this.chainDir)) {
            fs.mkdirSync(this.chainDir, { recursive: true });
        }
    }

    /**
     * Commits a command execution to the Merkle Timeline.
     */
    async sealExecution(data) {
        const result = await this.executionChain.commit({
            ...data,
            machineFingerprint: this.dna.getMachineID()
        });

        // Also log to the general TEAR audit chain
        this.seal('EXECUTION_COMMIT', {
            blockCID: result.blockCID,
            rawCommand: data.rawCommand
        }, { title: `Execution: ${data.rawCommand.substring(0, 20)}` });

        return result;
    }

    /**
     * Generate a deterministic Merkle root from an array of data items.
     */
    merkleRoot(items) {
        if (!items || items.length === 0) return crypto.createHash('sha256').update('EMPTY').digest('hex');

        let hashes = items.map(item =>
            crypto.createHash('sha256').update(
                typeof item === 'string' ? item : JSON.stringify(item)
            ).digest('hex')
        );

        while (hashes.length > 1) {
            const next = [];
            for (let i = 0; i < hashes.length; i += 2) {
                const left = hashes[i];
                const right = i + 1 < hashes.length ? hashes[i + 1] : left;
                next.push(crypto.createHash('sha256').update(left + right).digest('hex'));
            }
            hashes = next;
        }

        return hashes[0];
    }

    /**
     * Get hardware vector for binding.
     */
    getHwVector() {
        const os = require('os');
        return `${os.hostname()}|${os.cpus().length}|${os.arch()}|${os.platform()}|${this.dna.getMachineID()}`;
    }

    /**
     * Create a HMAC-SHA256 signature bound to machine DNA.
     */
    sign(data) {
        const key = this.dna.getMachineID();
        return crypto.createHmac('sha256', key)
            .update(typeof data === 'string' ? data : JSON.stringify(data))
            .digest('hex');
    }

    /**
     * Generate a SHA-256 fingerprint of the entire container (minus fingerprint field).
     */
    fingerprint(container) {
        const clone = { ...container };
        delete clone.fingerprint;
        return crypto.createHash('sha256')
            .update(JSON.stringify(clone))
            .digest('hex');
    }

    /**
     * SEAL — Create a TEAR-AUDIT-CHAIN v3.2.0 container.
     * 
     * @param {string} kind — The operation type (e.g., 'VAULT_SEAL', 'COMMAND_EXEC', 'SYSTEM_BOOT')
     * @param {object} payload — The data to seal
     * @param {object} [opts] — Optional: { title, duration }
     * @returns {object} The sealed .tear.json container
     */
    seal(kind, payload, opts = {}) {
        const start = Date.now();
        const sessionId = crypto.randomUUID();
        const timestamp = new Date().toISOString();

        // Build evidence items for merkle tree
        const evidenceItems = Array.isArray(payload) ? payload : [payload];
        const root = this.merkleRoot(evidenceItems);

        const container = {
            header: {
                format: 'TEAR-AUDIT-CHAIN',
                version: this.version,
                sessionId,
                timestamp,
                buildId: this.buildId,
                engineVersion: this.engineVersion,
                merkleRoot: root,
                hw_vector: this.getHwVector()
            },
            evidence: {
                kind,
                items: evidenceItems,
                rootHash: root
            },
            telemetry: {
                op_type: kind,
                duration: opts.duration || (Date.now() - start),
                title: opts.title || kind,
                prev_hash: this._getLastHash()
            },
            signature: null,
            fingerprint: null
        };

        // Sign the container (excluding signature and fingerprint)
        container.signature = this.sign(container);

        // Fingerprint the signed container (excluding fingerprint)
        container.fingerprint = this.fingerprint(container);

        // Persist to chain
        this._appendToChain(container);

        // Notify Swarm for P2P Sync
        if (typeof this.onNewBlock === 'function') {
            this.onNewBlock(container);
        }

        return container;
    }

    /**
     * VERIFY — Validate a .tear.json container's integrity.
     * 
     * @param {object|string} input — The container object or file path
     * @returns {object} { valid: boolean, checks: {...} }
     */
    verify(input) {
        let container;
        if (typeof input === 'string') {
            const raw = fs.readFileSync(input, 'utf8');
            container = JSON.parse(raw);
        } else {
            container = input;
        }

        const checks = {
            format: false,
            merkle: false,
            signature: false,
            fingerprint: false,
            hwBinding: false
        };

        // 1. Format check
        checks.format = container.header &&
            container.header.format === 'TEAR-AUDIT-CHAIN' &&
            container.header.version === this.version;

        // 2. Merkle root verification
        if (container.evidence && container.evidence.items) {
            const recalcRoot = this.merkleRoot(container.evidence.items);
            checks.merkle = recalcRoot === container.header.merkleRoot &&
                recalcRoot === container.evidence.rootHash;
        }

        // 3. Signature verification
        const sigCopy = { ...container };
        const savedSig = sigCopy.signature;
        const savedFp = sigCopy.fingerprint;
        sigCopy.signature = null;
        sigCopy.fingerprint = null;
        const expectedSig = this.sign(sigCopy);
        checks.signature = expectedSig === savedSig;

        // 4. Fingerprint verification
        sigCopy.signature = savedSig;
        const expectedFp = this.fingerprint(sigCopy);
        checks.fingerprint = expectedFp === savedFp;

        // 5. Hardware binding check
        if (container.header.hw_vector) {
            checks.hwBinding = container.header.hw_vector === this.getHwVector();
        }

        const valid = Object.values(checks).every(v => v);

        return { valid, checks };
    }

    /**
     * BUNDLE — Package vault assets into hs-tear-bundle-1 format.
     * 
     * @param {string} vaultName — Name of the vault to bundle
     * @param {object} [opts] — Optional: { description, author }
     * @returns {object} The bundle container
     */
    bundle(vaultName, opts = {}) {
        const vaultPath = path.join(this.rootDir, 'vaults', vaultName);
        if (!fs.existsSync(vaultPath)) {
            throw new Error(`Vault not found: ${vaultName}`);
        }

        const files = fs.readdirSync(vaultPath).filter(f => {
            return fs.statSync(path.join(vaultPath, f)).isFile();
        });

        const assets = files.map(f => {
            const fp = path.join(vaultPath, f);
            const content = fs.readFileSync(fp);
            const digest = crypto.createHash('sha256').update(content).digest('hex');
            const stat = fs.statSync(fp);
            const ext = path.extname(f).toLowerCase();
            let type = 'data';
            if (['.js', '.mjs'].includes(ext)) type = 'script';
            else if (['.css'].includes(ext)) type = 'style';
            else if (['.png', '.jpg', '.svg', '.webp'].includes(ext)) type = 'image';
            else if (['.json', '.yaml', '.toml'].includes(ext)) type = 'config';

            return {
                name: f,
                path: `./${f}`,
                type,
                digest,
                size: stat.size
            };
        });

        // Bundle digest = merkle root of all asset digests
        const bundleDigest = this.merkleRoot(assets.map(a => a.digest));

        const bundle = {
            format: 'hs-tear-bundle-1',
            schemaVersion: 1,
            app: 'ForgeCore',
            appVersion: '2.0.0',
            manifest: {
                name: vaultName,
                description: opts.description || `Sealed vault: ${vaultName}`,
                version: '1.0.0',
                permissions: ['vault:read', 'vault:write', 'tear:seal'],
                author: opts.author || 'ARCHITECT_ZERO'
            },
            assets,
            digest: bundleDigest,
            signature: {
                algorithm: 'HMAC-SHA256',
                publicKey: this.dna.getMachineID().substring(0, 32),
                signature: null,
                timestamp: new Date().toISOString()
            },
            createdAt: new Date().toISOString()
        };

        // Sign the bundle
        bundle.signature.signature = this.sign(bundle);

        // Save bundle
        const bundlePath = path.join(this.chainDir, `${vaultName}.tear-bundle.json`);
        fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));

        // Also create an audit chain entry for this bundle operation
        this.seal('VAULT_BUNDLE', {
            vault: vaultName,
            assetCount: assets.length,
            digest: bundleDigest,
            bundlePath
        }, { title: `Bundle: ${vaultName}` });

        return bundle;
    }

    /**
     * Get the chain — all sealed TEAR entries.
     * Uses in-memory cache after first load (OPT-04).
     */
    getChain() {
        if (this._chainCache !== null) return this._chainCache;

        const chainFile = path.join(this.chainDir, 'audit_chain.json');
        if (!fs.existsSync(chainFile)) {
            this._chainCache = [];
            return this._chainCache;
        }
        try {
            this._chainCache = JSON.parse(fs.readFileSync(chainFile, 'utf8'));
            return this._chainCache;
        } catch (e) {
            this._chainCache = [];
            return this._chainCache;
        }
    }

    /**
     * Get chain stats for the dashboard.
     * Reads from in-memory cache — O(1) instead of O(n) disk scan.
     */
    getStats() {
        const chain = this.getChain();
        const lastEntry = chain.length > 0 ? chain[chain.length - 1] : null;
        return {
            chainLength: chain.length,
            lastSeal: lastEntry ? lastEntry.header.timestamp : null,
            lastKind: lastEntry ? lastEntry.evidence.kind : null,
            lastMerkle: lastEntry ? lastEntry.header.merkleRoot.substring(0, 16) : null,
            integrity: chain.length > 0 ? 'SEALED' : 'EMPTY'
        };
    }

    // === INTERNAL ===

    _getLastHash() {
        const chain = this.getChain();
        if (chain.length === 0) return '0'.repeat(64);
        return chain[chain.length - 1].fingerprint;
    }

    _appendToChain(container) {
        const chainFile = path.join(this.chainDir, 'audit_chain.json');
        // Update in-memory cache first
        const chain = this.getChain();
        chain.push(container);
        // Then persist to disk
        fs.writeFileSync(chainFile, JSON.stringify(chain, null, 2));
    }
}

module.exports = TEAR_Engine;
