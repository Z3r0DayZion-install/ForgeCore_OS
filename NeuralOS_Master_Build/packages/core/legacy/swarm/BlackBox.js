"use strict";

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * BLACK BOX v1.2 [Imperial Edition]
 * ---------------------------------
 * Immutable audit ledger for Sovereign actions.
 * Ported to ForgeCore OS.
 */

class BlackBox {
    constructor() {
        this.logFile = null;
        this.currentChain = [];
        this.machineID = require('../security_dna').getMachineID();
    }

    init(rootDir) {
        const logDir = path.join(rootDir, 'logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        this.logFile = path.join(logDir, 'SOVEREIGN_AUDIT.ledger');

        if (fs.existsSync(this.logFile)) {
            try {
                this.currentChain = JSON.parse(fs.readFileSync(this.logFile, 'utf8'));
                console.log(`[BLACK_BOX] Re-synchronized with local ledger (${this.currentChain.length} events).`);
            } catch (e) {
                console.warn("[BLACK_BOX] Local ledger corrupted. Resetting.");
                this.currentChain = [];
            }
        }
    }

    commit(event, details) {
        const prevHash = this.currentChain.length > 0
            ? this.currentChain[this.currentChain.length - 1].hash
            : "0".repeat(64);

        const block = {
            timestamp: Date.now(),
            machineID: this.machineID,
            event,
            details,
            prevHash
        };

        block.hash = crypto.createHash('sha256').update(JSON.stringify(block)).digest('hex');

        this.currentChain.push(block);
        this.logToDisk(block);
        console.log(`[BLACK_BOX] Event Committed: ${event} (${block.hash.slice(0, 8)})`);
        return block;
    }

    logToDisk(block) {
        try {
            fs.writeFileSync(this.logFile, JSON.stringify(this.currentChain, null, 2));
        } catch (e) {
            console.error(`[BLACK_BOX] IO Error: ${e.message}`);
        }
    }

    receiveRemoteBlock(block) {
        // Ensure we don't duplicate blocks
        if (this.currentChain.some(b => b.hash === block.hash)) return false;

        this.currentChain.push(block);
        this.logToDisk(block);
        console.log(`[BLACK_BOX] Assimilated Peer Block: ${block.hash.slice(0, 8)}... (from ${block.machineID.slice(0, 8)})`);
        return true;
    }

    verifyIntegrity() {
        for (let i = 1; i < this.currentChain.length; i++) {
            const prev = this.currentChain[i - 1];
            const curr = this.currentChain[i];
            if (curr.prevHash !== prev.hash) return false;

            const { hash, ...blockData } = curr;
            const checkHash = crypto.createHash('sha256').update(JSON.stringify(blockData)).digest('hex');
            if (checkHash !== hash) return false;
        }
        return true;
    }
}

module.exports = new BlackBox();
