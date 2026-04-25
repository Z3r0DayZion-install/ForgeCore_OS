"use strict";

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const MerkleDagFS = require('./merkle_dag_fs');
const TelemetryLedger = require('./telemetry_ledger');

/**
 * XXXplorer™ Engine — Merkle-DAG Navigator
 * ----------------------------------------
 * Translates standard file exploration into Content-Addressable Storage navigation.
 * Allows "Time Travel" through Vault history using CIDs.
 */
class XXXplorer {
    constructor(rootDir) {
        this.rootDir = rootDir;
        this.vaultDir = path.join(rootDir, 'vaults');
        this.mirrorDir = path.join(this.vaultDir, '.reality_mirror');
        this.historyFile = path.join(this.mirrorDir, 'xxx_history.json');
        this.dag = new MerkleDagFS(rootDir);
        this.vaultHistory = new Map(); // vaultName -> [{cid, timestamp, reason, fileCount}, ...]
        this._loadHistory();
    }

    /**
     * Registers a new DAG state for a vault.
     */
    recordState(vaultName, stateObject, opts = {}) {
        const cid = opts.precomputedCID || this.dag.commitVaultState(vaultName, stateObject);
        this._appendHistory(vaultName, {
            cid,
            timestamp: Date.now(),
            reason: opts.reason || 'MANUAL_RECORD',
            fileCount: stateObject && stateObject.files ? Object.keys(stateObject.files).length : undefined
        });
        TelemetryLedger.log("XXXPLORER_STATE_RECORDED", { vault: vaultName, cid, reason: opts.reason || 'MANUAL_RECORD' });
        return cid;
    }

    sealVaultState(vaultName, reason = 'AUTO_SNAPSHOT') {
        const state = this._buildVaultState(vaultName, reason);
        const cid = this.dag.commitVaultState(vaultName, state);
        this._appendHistory(vaultName, {
            cid,
            timestamp: state.timestamp,
            reason,
            fileCount: state.fileCount
        });
        TelemetryLedger.log("XXXPLORER_STATE_RECORDED", { vault: vaultName, cid, reason, fileCount: state.fileCount });
        return { cid, state };
    }

    /**
     * Gets the temporal history of a specific Vault.
     */
    getHistory(vaultName, limit = 200) {
        const history = this.vaultHistory.get(vaultName) || [];
        if (!Number.isFinite(limit) || limit <= 0) return history.slice();
        return history.slice(-limit);
    }

    getLatestCID(vaultName) {
        const history = this.vaultHistory.get(vaultName) || [];
        if (!history.length) return null;
        return history[history.length - 1].cid;
    }

    verifyVault(vaultName, targetCID = null) {
        const expectedCID = targetCID || this.getLatestCID(vaultName);
        if (!expectedCID) {
            return { ok: true, reason: 'NO_BASELINE', targetCID: null, mismatch: { changed: [], missing: [], unexpected: [] } };
        }

        const state = this.dag.checkout(expectedCID);
        if (!state || state.schema !== 'forge-vault-state-v1' || !state.files) {
            return { ok: false, reason: 'STATE_SCHEMA_UNSUPPORTED', targetCID: expectedCID, mismatch: { changed: [], missing: [], unexpected: [] } };
        }

        const vaultPath = this._getVaultPath(vaultName);
        const currentFiles = this._listVaultFiles(vaultPath);
        const expectedFiles = Object.keys(state.files);
        const expectedSet = new Set(expectedFiles);
        const currentSet = new Set(currentFiles);

        const changed = [];
        const missing = [];
        const unexpected = [];

        expectedFiles.forEach((rel) => {
            const meta = state.files[rel];
            const full = path.join(vaultPath, rel);
            if (!fs.existsSync(full)) {
                missing.push(rel);
                return;
            }
            const digest = this._sha256(fs.readFileSync(full));
            if (digest !== meta.digest) {
                changed.push(rel);
            }
        });

        currentFiles.forEach((rel) => {
            if (!expectedSet.has(rel)) unexpected.push(rel);
        });

        return {
            ok: changed.length === 0 && missing.length === 0 && unexpected.length === 0,
            reason: 'VERIFIED',
            targetCID: expectedCID,
            mismatch: { changed, missing, unexpected, expectedCount: expectedFiles.length, currentCount: currentSet.size }
        };
    }

    verifyAndAutoHeal(vaultName, opts = {}) {
        const { autoHeal = true, reason = 'AUTO_HEAL_CHECK' } = opts;
        const verdict = this.verifyVault(vaultName);
        if (verdict.ok || verdict.reason === 'NO_BASELINE') {
            return { ...verdict, healed: false };
        }
        if (!autoHeal) {
            return { ...verdict, healed: false };
        }

        const heal = this.resurrect(vaultName, verdict.targetCID, { removeUnexpected: true });
        if (heal.success) {
            TelemetryLedger.log("MERKLE_AUTO_HEAL", {
                vault: vaultName,
                reason,
                targetCID: verdict.targetCID,
                mismatch: verdict.mismatch,
                restoredFiles: heal.restoredFiles,
                removedFiles: heal.removedFiles
            });
            return {
                ok: true,
                healed: true,
                reason: 'AUTO_HEAL_APPLIED',
                targetCID: verdict.targetCID,
                mismatch: verdict.mismatch,
                restoredFiles: heal.restoredFiles,
                removedFiles: heal.removedFiles
            };
        }

        return { ...verdict, healed: false, healError: heal.error };
    }

    /**
     * "Time Travel" — Resurrects a Vault to a specific CID state.
     */
    resurrect(vaultName, targetCID, opts = {}) {
        console.log(`[XXXPLORER] Initiating Temporal Resurrection for ${vaultName} to CID: ${targetCID}`);
        try {
            const state = this.dag.checkout(targetCID);
            const vaultPath = this._getVaultPath(vaultName);
            fs.mkdirSync(vaultPath, { recursive: true });

            // Legacy fallback if this CID is not a full vault snapshot.
            if (!state || state.schema !== 'forge-vault-state-v1' || !state.files) {
                TelemetryLedger.log("XXXPLORER_RESURRECTION", { vault: vaultName, cid: targetCID, mode: 'LEGACY' });
                return { success: true, vault: vaultName, state, restoredFiles: 0, removedFiles: 0, legacy: true };
            }

            let restoredFiles = 0;
            let removedFiles = 0;
            const removeUnexpected = opts.removeUnexpected !== false;
            const expected = new Set(Object.keys(state.files));

            Object.entries(state.files).forEach(([relPath, meta]) => {
                const fullPath = path.join(vaultPath, relPath);
                fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                const content = this.dag.read(meta.blobCID);
                fs.writeFileSync(fullPath, content);
                restoredFiles++;
            });

            if (removeUnexpected) {
                const current = this._listVaultFiles(vaultPath);
                current.forEach((relPath) => {
                    if (!expected.has(relPath)) {
                        const fullPath = path.join(vaultPath, relPath);
                        fs.unlinkSync(fullPath);
                        removedFiles++;
                    }
                });
                this._pruneEmptyDirs(vaultPath);
            }

            TelemetryLedger.log("XXXPLORER_RESURRECTION", {
                vault: vaultName,
                cid: targetCID,
                restoredFiles,
                removedFiles,
                mode: 'FULL_SNAPSHOT'
            });
            return { success: true, vault: vaultName, cid: targetCID, restoredFiles, removedFiles };
        } catch (e) {
            console.error(`[XXXPLORER] Resurrection failed: ${e.message}`);
            return { success: false, error: e.message };
        }
    }

    /**
     * Inspect a specific holographic file blob via its CID without mounting it.
     */
    inspectHologram(cid) {
        try {
            const buffer = this.dag.read(cid);
            return { success: true, size: buffer.length, cid };
        } catch (e) {
            return { success: false, error: "Hologram not found in DAG." };
        }
    }

    _buildVaultState(vaultName, reason) {
        const vaultPath = this._getVaultPath(vaultName);
        fs.mkdirSync(vaultPath, { recursive: true });
        const files = this._listVaultFiles(vaultPath);
        const manifest = {};

        files.forEach((relPath) => {
            const fullPath = path.join(vaultPath, relPath);
            const content = fs.readFileSync(fullPath);
            const blobCID = this.dag.write(content);
            manifest[relPath] = {
                blobCID,
                digest: this._sha256(content),
                size: content.length
            };
        });

        return {
            schema: 'forge-vault-state-v1',
            vault: vaultName,
            reason,
            timestamp: Date.now(),
            fileCount: files.length,
            files: manifest
        };
    }

    _getVaultPath(vaultName) {
        return path.join(this.vaultDir, vaultName);
    }

    _listVaultFiles(baseDir) {
        if (!fs.existsSync(baseDir)) return [];
        const out = [];

        const walk = (dir, prefix) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            entries.forEach((entry) => {
                if (entry.name.startsWith('.')) return;
                const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(full, rel);
                } else if (entry.isFile()) {
                    out.push(rel.replace(/\\/g, '/'));
                }
            });
        };

        walk(baseDir, '');
        out.sort();
        return out;
    }

    _pruneEmptyDirs(baseDir) {
        if (!fs.existsSync(baseDir)) return;
        const walk = (dir) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            entries.forEach((entry) => {
                if (entry.isDirectory()) {
                    walk(path.join(dir, entry.name));
                }
            });
            const rest = fs.readdirSync(dir);
            if (rest.length === 0 && dir !== baseDir) {
                fs.rmdirSync(dir);
            }
        };
        walk(baseDir);
    }

    _sha256(buffer) {
        return crypto.createHash('sha256').update(buffer).digest('hex');
    }

    _appendHistory(vaultName, entry) {
        if (!this.vaultHistory.has(vaultName)) this.vaultHistory.set(vaultName, []);
        const history = this.vaultHistory.get(vaultName);
        const last = history[history.length - 1];
        if (last && last.cid === entry.cid) return;
        history.push(entry);
        if (history.length > 500) history.splice(0, history.length - 500);
        this._saveHistory();
    }

    _loadHistory() {
        try {
            if (!fs.existsSync(this.mirrorDir)) fs.mkdirSync(this.mirrorDir, { recursive: true });
            if (!fs.existsSync(this.historyFile)) {
                this._saveHistory();
                return;
            }
            const parsed = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
            if (parsed && typeof parsed === 'object' && parsed.vaults && typeof parsed.vaults === 'object') {
                Object.entries(parsed.vaults).forEach(([vault, entries]) => {
                    if (Array.isArray(entries)) this.vaultHistory.set(vault, entries);
                });
            }
        } catch (e) {
            this.vaultHistory = new Map();
        }
    }

    _saveHistory() {
        try {
            if (!fs.existsSync(this.mirrorDir)) fs.mkdirSync(this.mirrorDir, { recursive: true });
            const vaults = {};
            for (const [vault, entries] of this.vaultHistory.entries()) {
                vaults[vault] = entries;
            }
            fs.writeFileSync(this.historyFile, JSON.stringify({
                schemaVersion: 1,
                updatedAt: new Date().toISOString(),
                vaults
            }, null, 2));
        } catch (e) {
            // keep runtime alive if persistence fails
        }
    }
}

module.exports = XXXplorer;
