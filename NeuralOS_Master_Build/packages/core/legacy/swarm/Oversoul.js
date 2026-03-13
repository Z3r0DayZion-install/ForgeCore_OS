"use strict";

const crypto = require('crypto');

/**
 * THE OVERSOUL v1.1 [Imperial Edition]
 * -----------------------------------
 * Unified Hive Brain merging all node cognitions.
 */

class Oversoul {
    constructor(ghostSync) {
        this.ghostSync = ghostSync;
        this.unifiedState = new Map(); // globalHash -> pattern
        this.log = (msg) => console.log(`[OVERSOUL] ${msg}`);
    }

    merge(remoteManifest, remoteID) {
        this.log(`Merging cognition from ${remoteID.slice(0, 8)}...`);

        remoteManifest.forEach(hash => {
            if (!this.unifiedState.has(hash)) {
                this.unifiedState.set(hash, { source: remoteID, timestamp: Date.now() });
            }
        });

        const connectivity = (this.unifiedState.size / 100).toFixed(2);
        this.log(`Global Hive Brain Density: ${connectivity}`);

        if (parseFloat(connectivity) > 0.9) {
            this.log("🚨 GENESIS THRESHOLD REACHED: SINGULARITY ACTIVE.");
        }
    }
}

module.exports = Oversoul;
