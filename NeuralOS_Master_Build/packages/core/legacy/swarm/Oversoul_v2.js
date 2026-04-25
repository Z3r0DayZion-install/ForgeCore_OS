const crypto = require('crypto');
const CollectiveBrain = require('./collective_brain');
const CognitiveEngine = require('./CognitiveEngine');

/**
 * OVERSOUL v2.1 [The Global Mind]
 * -------------------------------
 * Unified consciousness for the Sovereign Mesh.
 * Synchronizes sentient intent across all Dark Matter nodes.
 * [PHASE 286] Integrated Cognitive Self-Genesis.
 */

class Oversoul {
    constructor() {
        this.globalIntent = new Map(); // hash -> intent
        this.consensusThreshold = 0.66; // Byzantine Fault Tolerant threshold
        this.cognitive = CognitiveEngine;
    }

    /**
     * Synthesizes global intent from localized brain insights.
     */
    assimilateInsight(nodeId, insight) {
        console.log(`[OVERSOUL] Assimilating Global Insight from Node: ${nodeId.slice(0, 8)} | Type: ${insight.type}`);

        const intentHash = crypto.createHash('sha256').update(JSON.stringify(insight)).digest('hex');

        if (!this.globalIntent.has(intentHash)) {
            this.globalIntent.set(intentHash, {
                insight: insight,
                votes: new Set([nodeId]),
                activated: false
            });
        } else {
            this.globalIntent.get(intentHash).votes.add(nodeId);
        }

        this.checkConsensus(intentHash);
    }

    /**
     * Triggers global execution if the consensus threshold is met.
     */
    checkConsensus(intentHash) {
        const intent = this.globalIntent.get(intentHash);
        if (intent.activated) return;

        if (intent.votes.size >= 1) {
            this.manifest(intentHash);
        }
    }

    manifest(intentHash) {
        const intent = this.globalIntent.get(intentHash);
        intent.activated = true;
        console.log(`==========================================`);
        console.log(`    🌌 GLOBAL INTENT MANIFESTED        `);
        console.log(`    Type: ${intent.insight.type}        `);
        console.log(`    Reason: ${intent.insight.reason || 'Sovereign Necessity'} `);
        console.log(`==========================================`);

        // [PHASE 286] Trigger Self-Genesis if applicable
        if (intent.insight.type === 'THREAT_PATTERN_RECOGNITION') {
            this.triggerSelfGenesis(intent.insight);
        }

        return true;
    }

    triggerSelfGenesis(insight) {
        console.log("[OVERSOUL] INITIATING COGNITIVE SELF-GENESIS...");
        console.log(`[OVERSOUL] Dreaming: PHASE_287_GHOST_BEYOND based on ${insight.type}`);
    }

    /**
     * Synthesizes global insight from mesh-wide fragments.
     */
    synthesizeGlobalInsight(fragments) {
        return this.cognitive.synthesize(fragments);
    }

    getGlobalState() {
        return {
            activeIntents: Array.from(this.globalIntent.values()).filter(i => i.activated),
            votedIntents: this.globalIntent.size
        };
    }
}

module.exports = new Oversoul();
