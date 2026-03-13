"use strict";

const crypto = require('crypto');
const CognitiveEngine = require('./CognitiveEngine');

/**
 * COLLECTIVE BRAIN v1.2 [Imperial Edition]
 * ----------------------------------------
 * Manages synchronized intelligence states across the mesh.
 */

class CollectiveBrain {
    constructor() {
        this.intelligenceState = new Map(); // hash -> pattern
        this.insights = new Map(); // hash -> insight
        this.machineID = require('../security_dna').getMachineID();
        this.log = (msg) => console.log(`[COLLECTIVE_BRAIN] ${msg}`);
    }

    assimilate(pattern) {
        const hash = crypto.createHash('sha256').update(JSON.stringify(pattern)).digest('hex');
        this.intelligenceState.set(hash, pattern);
        this.log(`Pattern Assimilated: ${hash.slice(0, 8)}`);

        this.triggerSynthesis();
        return hash;
    }

    triggerSynthesis() {
        const fragments = Array.from(this.intelligenceState.values());
        const insight = CognitiveEngine.synthesize(fragments);

        if (insight) {
            this.insights.set(insight.hash, insight);
            this.log(`Sentient Insight Broad-casted: ${insight.type}`);
            if (this.onInsight) this.onInsight(insight);
        }
    }

    startSync(ghostSync) {
        this.log("Broadcasting Sync Manifest...");
        const hashes = Array.from(this.intelligenceState.keys());

        ghostSync.sendPacket('239.255.255.250', ghostSync.discoveryPort, {
            type: 'BRAIN_SYNC_MANIFEST',
            machineID: this.machineID,
            manifest: hashes
        });
    }

    handleSyncPacket(packet) {
        if (packet.type === 'BRAIN_SYNC_MANIFEST') {
            this.log(`Received Manifest from ${packet.machineID.slice(0, 8)}: ${packet.manifest.length} items.`);
        }
    }
}

module.exports = new CollectiveBrain();
