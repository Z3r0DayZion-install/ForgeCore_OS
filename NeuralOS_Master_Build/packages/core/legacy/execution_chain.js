"use strict";

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const MerkleDagFS = require('./merkle_dag_fs');

/**
 * EXECUTION_CHAIN Module (IP Gold)
 * --------------------------------
 * Manages the cryptographically linked timeline of all system operations.
 * Each block chains to the previous execution hash, creating a Merkle Timeline.
 */
class ExecutionChain {
    constructor(rootDir) {
        this.rootDir = rootDir;
        this.dag = new MerkleDagFS(rootDir);
        this.headCID = null; // Pointer to the latest execution CID
        this.chainLength = 0;
        this.metaFile = path.join(rootDir, 'vaults', '.tear_chain', 'execution_chain_head.json');
        this._loadMeta();
    }

    /**
     * Commits a new execution event to the chain.
     */
    async commit(data) {
        const {
            rawCommand,
            intentScore,
            wasmSandboxHash,
            resultCID,
            stateCID,
            machineFingerprint,
            modelHash // For deterministic AI inference proof
        } = data;

        const block = {
            parentCID: this.headCID,
            timestamp: Date.now(),
            execution: {
                rawCommand,
                intentScore,
                wasmSandboxHash,
                modelHash
            },
            state: {
                resultCID,
                stateCID
            },
            origin: {
                machineFingerprint
            }
        };

        // Store block in Merkle-DAG (CAS)
        const blockBuffer = Buffer.from(JSON.stringify(block));
        const blockCID = this.dag.write(blockBuffer);
        
        this.headCID = blockCID;
        this.chainLength += 1;
        this._saveMeta();
        
        console.log(`[EXEC_CHAIN] Committed Block CID: ${blockCID.substring(0, 16)}...`);
        
        return {
            blockCID,
            block,
            chainLength: this.chainLength
        };
    }

    getHead() {
        return this.headCID;
    }

    getMeta() {
        return {
            headCID: this.headCID,
            chainLength: this.chainLength
        };
    }

    _loadMeta() {
        try {
            const dir = path.dirname(this.metaFile);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            if (!fs.existsSync(this.metaFile)) {
                this._saveMeta();
                return;
            }
            const parsed = JSON.parse(fs.readFileSync(this.metaFile, 'utf8'));
            const headCID = parsed && parsed.headCID ? String(parsed.headCID) : null;
            const chainLength = Number(parsed && parsed.chainLength ? parsed.chainLength : 0);
            if (headCID) {
                try {
                    this.dag.read(headCID);
                    this.headCID = headCID;
                } catch {
                    this.headCID = null;
                }
            }
            this.chainLength = Number.isFinite(chainLength) && chainLength >= 0 ? chainLength : 0;
        } catch {
            this.headCID = null;
            this.chainLength = 0;
        }
    }

    _saveMeta() {
        try {
            const dir = path.dirname(this.metaFile);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.metaFile, JSON.stringify({
                schemaVersion: 1,
                updatedAt: new Date().toISOString(),
                headCID: this.headCID,
                chainLength: this.chainLength
            }, null, 2));
        } catch {
            // keep runtime alive if persistence fails
        }
    }
}

module.exports = ExecutionChain;
