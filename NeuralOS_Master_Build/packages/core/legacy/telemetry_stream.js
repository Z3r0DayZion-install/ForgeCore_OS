"use strict";

/**
 * ForgeCore™ OS — WebSocket Telemetry Server
 * -------------------------------------------
 * Handles WebSocket upgrade on the existing HTTP server.
 * Pushes a unified telemetry frame every 1s to all connected clients.
 * Eliminates 240+ HTTP requests/min from polling.
 *
 * Protocol: Native Node.js WebSocket (no ws dependency required).
 * Uses raw HTTP upgrade + crypto for Sec-WebSocket-Accept handshake.
 */

const crypto = require('crypto');
const os = require('os');

const WS_MAGIC = '258EAFA5-E914-47DA-95CA-5AB0DC29E11B';

class TelemetryStream {
    constructor() {
        this.clients = new Set();
        this.tearEngine = null;
        this.swarmProjection = null;
        this.getSessionState = null; // Function returning { sessionPassphrase, GHOST_MODE, CORE_HASH }
        this._interval = null;
        this._prevTicks = this._getTickDelta();
    }

    _getTickDelta() {
        const cpus = os.cpus();
        let idle = 0;
        let total = 0;
        cpus.forEach(cpu => {
            for (let type in cpu.times) {
                total += cpu.times[type];
            }
            idle += cpu.times.idle;
        });
        return { idle, total };
    }

    /**
     * Initialize the telemetry stream with system references.
     */
    init({ server, tearEngine, swarmProjection, getSessionState }) {
        this.tearEngine = tearEngine;
        this.swarmProjection = swarmProjection;
        this.getSessionState = getSessionState;

        server.on('upgrade', (req, socket, head) => {
            const url = new URL(req.url, 'http://localhost');
            if (url.pathname !== '/api/stream') {
                socket.destroy();
                return;
            }

            const key = req.headers['sec-websocket-key'];
            if (!key) { socket.destroy(); return; }

            const accept = crypto.createHash('sha1')
                .update(key + WS_MAGIC)
                .digest('base64');

            socket.write([
                'HTTP/1.1 101 Switching Protocols',
                'Upgrade: websocket',
                'Connection: Upgrade',
                `Sec-WebSocket-Accept: ${accept}`,
                '',
                ''
            ].join('\r\n'));

            this.clients.add(socket);
            console.log(`[WS] Client connected. Total: ${this.clients.size}`);

            socket.on('close', () => {
                this.clients.delete(socket);
                console.log(`[WS] Client disconnected. Total: ${this.clients.size}`);
            });

            socket.on('error', () => {
                this.clients.delete(socket);
            });

            // Handle incoming messages (for future bidirectional commands)
            socket.on('data', (buf) => {
                try {
                    const msg = this._decode(buf);
                    if (msg === null) return; // Close frame or unmasked
                    // Future: handle client → server WS messages here
                } catch (e) { /* ignore malformed */ }
            });
        });

        // Start unified telemetry push loop
        this._interval = setInterval(() => this._pushTelemetry(), 1000);
        console.log('[WS] Telemetry stream initialized on /api/stream');
    }

    /**
     * Push a unified telemetry frame to all connected WebSocket clients.
     */
    _pushTelemetry() {
        if (this.clients.size === 0) return;

        const state = this.getSessionState ? this.getSessionState() : { sessionPassphrase: null, GHOST_MODE: false };
        if (!state.sessionPassphrase && !state.GHOST_MODE) return;

        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        const currentCpu = this._calculateCpuUsage();
        this._lastCpu = currentCpu;

        const frame = {
            type: 'TELEMETRY',
            ts: Date.now(),
            hw: {
                cpu: state.GHOST_MODE ? (15.5 + Math.random() * 3).toFixed(1) : this._calculateCpuUsage(),
                locked: false
            },
            system: {
                hostname: state.GHOST_MODE ? 'DECOY_HOST' : os.hostname(),
                memPercent: state.GHOST_MODE ? 44.5 : Math.round((usedMem / totalMem) * 100),
                uptimeSec: Math.round(process.uptime()),
                cpuModel: cpus[0] ? cpus[0].model : 'Unknown',
                cpuCores: cpus.length,
                totalMemMB: Math.round(totalMem / 1048576),
                freeMemMB: Math.round(freeMem / 1048576),
                entropy: this._calculateEntropy(),
                gateway: state.Gateway ? {
                    state: state.Gateway.state,
                    log: state.Gateway.log,
                    proxy: state.Gateway.proxy
                } : null,
                autoHeal: state.lastAutoHealEvent || null,
                ghostAttestation: state.lastGhostAttestationEvent || null,
                witnessQuorum: state.witnessQuorumStatus || null
            },
            swarm: this._safeSwarm(state),
            tear: this._safeTear(state)
        };

        const payload = JSON.stringify(frame);
        const encoded = this._encode(payload);

        for (const client of this.clients) {
            try {
                client.write(encoded);
            } catch (e) {
                this.clients.delete(client);
            }
        }
    }

    _calculateCpuUsage() {
        const currentTicks = this._getTickDelta();
        const deltaIdle = currentTicks.idle - this._prevTicks.idle;
        const deltaTotal = currentTicks.total - this._prevTicks.total;

        this._prevTicks = currentTicks;

        if (deltaTotal === 0) return "0.0";
        const usage = 100 * (1 - deltaIdle / deltaTotal);
        return usage.toFixed(1);
    }

    _calculateEntropy() {
        const start = process.hrtime.bigint();
        for (let i = 0; i < 500; i++) { }
        const end = process.hrtime.bigint();
        const jitter = Number(end - start);
        // Scale jitter to a tactical 7.95-8.10 range
        return (7.95 + (jitter % 150) / 1000).toFixed(2);
    }

    getCurrentCpu() {
        return this._lastCpu || "0.0";
    }

    _safeSwarm(state) {
        try {
            if (state.GHOST_MODE) {
                return { peers: [{ id: 'GHOST_PEER_A' }, { id: 'GHOST_PEER_B' }], insights: [], activeVotes: [] };
            }
            return this.swarmProjection.getOverview();
        } catch (e) {
            return { peers: [], insights: [], activeVotes: [], nodeID: 'UNKNOWN' };
        }
    }

    _safeTear(state) {
        try {
            return this.tearEngine.getStats();
        } catch (e) {
            return { chainLength: 0, integrity: 'UNKNOWN' };
        }
    }

    /**
     * Encode a string payload into a WebSocket frame (RFC 6455).
     */
    _encode(data) {
        const payload = Buffer.from(data, 'utf8');
        const len = payload.length;

        let header;
        if (len < 126) {
            header = Buffer.alloc(2);
            header[0] = 0x81; // FIN + TEXT
            header[1] = len;
        } else if (len < 65536) {
            header = Buffer.alloc(4);
            header[0] = 0x81;
            header[1] = 126;
            header.writeUInt16BE(len, 2);
        } else {
            header = Buffer.alloc(10);
            header[0] = 0x81;
            header[1] = 127;
            header.writeBigUInt64BE(BigInt(len), 2);
        }

        return Buffer.concat([header, payload]);
    }

    /**
     * Decode a WebSocket frame from a client (RFC 6455).
     * Returns null for close frames or unmasked data.
     */
    _decode(buf) {
        if (buf.length < 2) return null;
        const opcode = buf[0] & 0x0F;
        if (opcode === 0x08) return null; // Close frame

        const masked = (buf[1] & 0x80) !== 0;
        let payloadLen = buf[1] & 0x7F;
        let offset = 2;

        if (payloadLen === 126) {
            payloadLen = buf.readUInt16BE(2);
            offset = 4;
        } else if (payloadLen === 127) {
            payloadLen = Number(buf.readBigUInt64BE(2));
            offset = 10;
        }

        if (!masked) return null;

        const mask = buf.slice(offset, offset + 4);
        offset += 4;

        const data = Buffer.alloc(payloadLen);
        for (let i = 0; i < payloadLen; i++) {
            data[i] = buf[offset + i] ^ mask[i % 4];
        }

        return data.toString('utf8');
    }

    destroy() {
        if (this._interval) clearInterval(this._interval);
        for (const client of this.clients) {
            try { client.destroy(); } catch (e) { }
        }
        this.clients.clear();
    }
}

module.exports = new TelemetryStream();
