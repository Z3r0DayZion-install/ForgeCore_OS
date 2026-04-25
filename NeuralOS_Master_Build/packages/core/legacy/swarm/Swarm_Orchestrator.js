const crypto = require('crypto');
const http = require('http');

class BaseEngine {
    constructor(name) {
        this.name = name;
        this.version = '1.0';
    }

    log(msg) {
        if (typeof __emitTelemetry !== 'undefined') {
            __emitTelemetry(`[${this.name}] ${msg}`);
        } else {
            console.log(`[${this.name}] ${msg}`);
        }
    }
}

class SwarmOrchestrator extends BaseEngine {
    constructor() {
        super('Swarm_Orchestrator');
        // Retrieve peer list from the localized GhostSync or IPC state.
        // For the sandbox, we assume the host passes peer targets via artifact.
    }

    async postToPeer(peerHost, chunkData) {
        return new Promise((resolve) => {
            const payload = JSON.stringify({
                engineName: 'Swarm_Worker_Task',
                artifact: chunkData
            });

            const req = http.request(`http://${peerHost}:3002/api/engine/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // The orchestration requires a valid token mapped from the host
                    'Authorization': chunkData.token
                }
            }, (res) => {
                let body = '';
                res.on('data', d => body += d);
                res.on('end', () => {
                    try {
                        resolve({ peer: peerHost, ok: true, data: JSON.parse(body) });
                    } catch (e) {
                        resolve({ peer: peerHost, ok: false, error: 'Parse Error' });
                    }
                });
            });

            req.on('error', (e) => {
                resolve({ peer: peerHost, ok: false, error: e.message });
            });

            req.setTimeout(10000, () => {
                req.destroy();
                resolve({ peer: peerHost, ok: false, error: 'Timeout' });
            });

            req.write(payload);
            req.end();
        });
    }

    async execute(artifact, telemetryCallback) {
        if (!artifact) return { error: "Artifact missing" };
        this.log("Initializing Swarm Orchestrator...");

        // artifact should contain { peers: ["192.168.1.10", "192.168.1.11"], taskType: "hash_crack", payload: [...], token: "session_token" }
        const peers = artifact.peers || ['127.0.0.1'];
        const chunkCount = peers.length;

        if (!artifact.payload || !Array.isArray(artifact.payload)) {
            return { error: "Payload must be an array of data points to distribute." };
        }

        this.log(`Distributing task across ${chunkCount} swarm nodes...`);

        // Naive chunking for demonstration
        const chunkSize = Math.ceil(artifact.payload.length / chunkCount);
        const tasks = [];

        for (let i = 0; i < chunkCount; i++) {
            const chunk = artifact.payload.slice(i * chunkSize, (i + 1) * chunkSize);
            if (chunk.length > 0) {
                const targetPeer = peers[i];
                this.log(`Dispatching chunk ${i} (${chunk.length} items) to ${targetPeer}`);

                const hiveContract = {
                    taskId: crypto.randomBytes(4).toString('hex'),
                    type: artifact.taskType || 'generic_compute',
                    data: chunk,
                    token: artifact.token // Pass the auth token so the peer accepts the IPC/API command
                };

                tasks.push(this.postToPeer(targetPeer, hiveContract));
            }
        }

        this.log("Awaiting Swarm responses...");

        const results = await Promise.all(tasks);

        let successCount = 0;
        let failureCount = 0;
        const aggregated = [];

        results.forEach(res => {
            if (res.ok) {
                successCount++;
                if (res.data.result) aggregated.push(res.data.result);
            } else {
                failureCount++;
                this.log(`[Swarm Warning] Node ${res.peer} failed: ${res.error}`);
            }
        });

        this.log(`Swarm execution complete. Success: ${successCount}, Failures: ${failureCount}`);

        return {
            status: 'ORCHESTRATION_COMPLETE',
            successNodes: successCount,
            failedNodes: failureCount,
            aggregatedResults: aggregated
        };
    }
}

module.exports = SwarmOrchestrator;
