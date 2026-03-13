"use strict";

const crypto = require('crypto');

/**
 * COGNITIVE ENGINE v1.0 (Phase 277)
 * --------------------------------
 * Synthesizes intelligence fragments into collective insights.
 * The core brain of the Sentient Swarm.
 */

class CognitiveEngine {
    constructor() {
        this.insights = new Map(); // hash -> { insight, confidence, timestamp }
        this.log = (msg) => console.log(`[COGNITIVE] ${msg}`);
    }

    /**
     * Synthesizes multiple data points into a high-level system insight.
     */
    synthesize(fragments) {
        this.log(`Synthesizing ${fragments.length} intelligence fragments...`);

        // Example Synthesis logic: Detecting "Integrity Drift"
        const driftDetected = fragments.some(f => f.type === 'integrity_vulnerability' && f.severity > 0.7);
        const highLoad = fragments.filter(f => f.type === 'metric' && f.cpu > 80).length > fragments.length / 2;

        let insight = null;
        if (driftDetected && highLoad) {
            insight = {
                type: 'THREAT_PATTERN_RECOGNITION',
                severity: 'CRITICAL',
                recommendation: 'TRIGGER_GLOBAL_HARDENING',
                reason: 'Coordinated integrity drift detected under high compute pressure.'
            };
        } else if (driftDetected) {
            insight = {
                type: 'ANOMALY_DETECTION',
                severity: 'MEDIUM',
                recommendation: 'INITIATE_MEDIC_SCAN',
                reason: 'Minor integrity drift detected across multiple nodes.'
            };
        }

        if (insight) {
            const hash = crypto.createHash('sha256').update(JSON.stringify(insight)).digest('hex');
            this.insights.set(hash, { insight, confidence: 0.85, timestamp: Date.now() });
            this.log(`✅ Insight Generated: ${insight.type} (${hash.slice(0, 8)})`);
            return { hash, ...insight };
        }

        return null;
    }

    getInsight(hash) {
        return this.insights.get(hash);
    }
}

module.exports = new CognitiveEngine();
