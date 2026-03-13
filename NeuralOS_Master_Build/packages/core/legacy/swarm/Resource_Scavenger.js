"use strict";

const BaseEngine = require('../framework/base_engine');
const os = require('os');

/**
 * RESOURCE_SCAVENGER v1.0 [IGNITION]
 * ---------------------------------
 * Field engine for hardware telemetry and resource tokenization.
 */

class Resource_Scavenger extends BaseEngine {
    constructor() {
        super("Resource_Scavenger", "1.0.0");
    }

    getSchema() {
        return {
            type: "object",
            properties: {
                interval: { type: "number", default: 5000 },
                emitClaims: { type: "boolean", default: true }
            }
        };
    }

    /**
     * Periodically gathers hardware metrics and emits telemetry.
     */
    async execute(artifact, emitTelemetry = null) {
        const interval = artifact.interval || 5000;
        const emitClaims = artifact.emitClaims !== false;

        console.log(`[RESOURCE_SCAVENGER] Starting hardware discovery loop (${interval}ms)...`);

        const scavenge = () => {
            const freeMem = os.freemem();
            const totalMem = os.totalmem();
            const cpuUsage = os.loadavg();

            const stats = {
                engine: this.name,
                timestamp: Date.now(),
                memory: {
                    freeMB: Math.round(freeMem / 1024 / 1024),
                    totalMB: Math.round(totalMem / 1024 / 1024),
                    usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100)
                },
                load: {
                    "1m": cpuUsage[0].toFixed(2),
                    "5m": cpuUsage[1].toFixed(2),
                    "15m": cpuUsage[2].toFixed(2)
                },
                // [PHASE 267] Economic Claim
                claim: emitClaims ? {
                    units: "CREDIT",
                    amount: Math.max(0.1, (100 - Math.round(((totalMem - freeMem) / totalMem) * 100)) / 10),
                    type: "IDLE_CAPACITY"
                } : null
            };

            if (emitTelemetry) {
                emitTelemetry(stats);
            }
        };

        // Initial scavenge
        scavenge();

        // We return the interval reference so the loader can manage execution if needed
        // For now, we manually manage the interval in the sandbox
        const timer = setInterval(scavenge, interval);

        return {
            status: "SCAVENGING_ACTIVE",
            interval,
            initialMetrics: os.loadavg()
        };
    }
}

module.exports = Resource_Scavenger;
