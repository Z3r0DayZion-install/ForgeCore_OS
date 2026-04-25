"use strict";

const BaseEngine = require('../framework/base_engine');
const http = require('http');
const https = require('https');

/**
 * PROPULSION_V1 ENGINE
 * A high-intensity network fetch proxy for stress testing and telemetry gathering.
 */
class Propulsion_V1 extends BaseEngine {
    constructor() {
        super('Propulsion_V1', '1.0.0');
    }

    getSchema() {
        return {
            type: "object",
            properties: {
                target: { type: "string" },
                intensity: { type: "number" },
                method: { type: "string" }
            },
            required: ["target"]
        };
    }

    async execute(artifact) {
        const target = artifact.target;
        const intensity = artifact.intensity || 1;
        const method = artifact.method || 'GET';

        console.log(`[PROPULSION_V1] Initiating sequence... Target: ${target}, Intensity: ${intensity}, Method: ${method}`);

        const results = {
            success: 0,
            failed: 0,
            avgLatency: 0,
            errors: []
        };

        const promises = [];
        const startTime = Date.now();

        for (let i = 0; i < intensity; i++) {
            promises.push(new Promise((resolve) => {
                const reqTime = Date.now();
                const client = target.startsWith('https') ? https : http;

                const req = client.request(target, { method }, (res) => {
                    res.on('data', () => { }); // Consume data
                    res.on('end', () => {
                        results.success++;
                        resolve(Date.now() - reqTime);
                    });
                });

                req.on('error', (err) => {
                    results.failed++;
                    if (results.errors.length < 5) results.errors.push(err.message);
                    resolve(Date.now() - reqTime);
                });

                req.setTimeout(5000, () => {
                    req.destroy();
                    results.failed++;
                    if (results.errors.length < 5) results.errors.push("Timeout");
                    resolve(Date.now() - reqTime);
                });

                req.end();
            }));
        }

        const latencies = await Promise.all(promises);
        const totalDuration = Date.now() - startTime;

        if (latencies.length > 0) {
            results.avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        }

        console.log(`[PROPULSION_V1] Sequence Complete. Duration: ${totalDuration}ms`);

        return {
            engine: this.name,
            version: this.version,
            target: target,
            intensity: intensity,
            metrics: {
                successCount: results.success,
                failCount: results.failed,
                avgLatencyMs: Math.round(results.avgLatency),
                totalDurationMs: totalDuration,
                sampleErrors: results.errors
            }
        };
    }
}

module.exports = Propulsion_V1;
