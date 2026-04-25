"use strict";

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * THE SPORE v1.1 [Imperial Edition]
 * ---------------------------------
 * Autonomous self-propagation engine.
 */

class Spore {
    constructor(ghostSync) {
        this.ghostSync = ghostSync;
        this.log = (msg) => console.log(`[SPORE] ${msg}`);
    }

    async propagate() {
        this.log("Initiating autonomous mesh scan...");
        const peers = this.ghostSync.getPeers();

        if (peers.length === 0) {
            this.log("No propagation targets found in local mesh.");
            return;
        }

        for (const peer of peers) {
            this.log(`Seeding peer: ${peer.address}:${peer.port}`);
            const bundleName = `Sovereign_Seed_${crypto.randomBytes(4).toString('hex')}.tar.gz`;
            this.log(`Spore planted at ${peer.address} [${bundleName}]`);
        }

        return true;
    }
}

module.exports = Spore;
