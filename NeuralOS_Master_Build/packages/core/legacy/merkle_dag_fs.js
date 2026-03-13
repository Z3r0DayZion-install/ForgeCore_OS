"use strict";

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * MERKLE-DAG VERSIONED FILESYSTEM
 * Immutable Infrastructure / Content-Addressable Storage (IP Gold)
 * 
 * Files are not stored by name, but by their SHA-256 hash.
 * A Vault is a DAG node pointing to file hashes.
 */
class MerkleDagFS {
    constructor(rootDir) {
        this.objectsDir = path.join(rootDir, 'vaults', '.objects');
        if (!fs.existsSync(this.objectsDir)) {
            fs.mkdirSync(this.objectsDir, { recursive: true });
        }
    }

    /**
     * Write data to the CAS (Content Addressable Storage)
     * @returns {string} The SHA-256 hash (CID)
     */
    write(buffer) {
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');
        const objectPath = path.join(this.objectsDir, hash);
        
        if (!fs.existsSync(objectPath)) {
            fs.writeFileSync(objectPath, buffer);
        }
        return hash;
    }

    /**
     * Read data from the CAS using its CID
     */
    read(hash) {
        const objectPath = path.join(this.objectsDir, hash);
        if (!fs.existsSync(objectPath)) throw new Error(`Object not found: ${hash}`);
        return fs.readFileSync(objectPath);
    }

    /**
     * Create a new Vault state (Tree)
     * @param {Object} state Map of filename -> hash
     * @returns {string} The Root Hash of this vault state
     */
    commitVaultState(vaultName, state) {
        // State example: { "config.json": "abc...", "main.js": "def..." }
        const stateBuffer = Buffer.from(JSON.stringify(state, null, 2));
        const rootHash = this.write(stateBuffer);
        
        console.log(`[MERKLE_FS] Vault ${vaultName} committed. Root CID: ${rootHash}`);
        return rootHash;
    }

    /**
     * Resurrect an entire vault to a specific Root Hash
     */
    checkout(rootHash) {
        const stateBuffer = this.read(rootHash);
        return JSON.parse(stateBuffer.toString('utf8'));
    }
}

module.exports = MerkleDagFS;
