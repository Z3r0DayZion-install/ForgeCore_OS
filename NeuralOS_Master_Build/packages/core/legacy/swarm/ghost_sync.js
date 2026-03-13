"use strict";

const dgram = require('dgram');
const crypto = require('crypto');
const os = require('os');
const VaultCrypt = require('../vault_crypt');
const DNA = require('../security_dna');
const StegoNexus = require('./Stego_Nexus');

/**
 * GHOST_SYNC v2.2 [Imperial Edition]
 * ---------------------------------
 * Decentralized peer discovery and encrypted telemetry sync.
 * Ported to ForgeCore OS for Imperial Command.
 */

class GhostSync {
    constructor(discoveryPort = 3003, serverPort = 3004) {
        this.discoveryPort = discoveryPort;
        this.serverPort = serverPort;
        this.discoverySocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        this.serverSocket = dgram.createSocket('udp4');
        this.peers = new Map(); // id -> { address, port, lastSeen }
        this.dht = new Map(); // Global key-value state
        this.listeners = new Map(); // type -> Set<callback>

        this.machineID = String(process.env.FORGE_GHOST_NODE_ID || DNA.getMachineID());
        this.passphrase = "IMPERIAL_DEFAULT_2026";
        this.stealthMode = true; // [PHASE 283]
        this.log = (msg) => console.log(`[GHOST_SYNC] ${msg}`);
        this.debug = (msg) => { if (process.env.GHOST_DEBUG) console.log(`[GHOST_DEBUG] ${msg}`); };
    }

    setPassphrase(p) { this.passphrase = p; }

    start() {
        this.discoverySocket.on('message', (msg, rinfo) => this.handleMessage(msg, rinfo, true));
        this.serverSocket.on('message', (msg, rinfo) => this.handleMessage(msg, rinfo, false));

        this.discoverySocket.bind(this.discoveryPort, () => {
            this.discoverySocket.addMembership('239.255.255.250');
            this.log(`Multicast Discovery Active on port ${this.discoveryPort}`);
        });

        this.serverSocket.bind(this.serverPort, () => {
            this.log(`Direct Server Active on 0.0.0.0:${this.serverPort}`);
        });

        this.heartbeatInterval = setInterval(() => this.broadcastHeartbeat(), 5000);
        this.pruneInterval = setInterval(() => this.prunePeers(), 15000);
    }

    stop() {
        clearInterval(this.heartbeatInterval);
        clearInterval(this.pruneInterval);
        this.discoverySocket.close();
        this.serverSocket.close();
    }

    onPacket(type, callback) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(callback);
    }

    broadcastHeartbeat() {
        const payload = {
            type: 'HEARTBEAT',
            id: this.machineID,
            port: this.serverPort,
            timestamp: Date.now()
        };
        this.sendPacket('239.255.255.250', this.discoveryPort, payload);
    }

    sendPacket(address, port, payload) {
        try {
            let msg = this.pack(payload);
            if (this.stealthMode) {
                msg = StegoNexus.wrap(msg);
            }
            this.serverSocket.send(msg, 0, msg.length, port, address);
        } catch (e) {
            this.debug(`Send Error to ${address}:${port}: ${e.message}`);
        }
    }

    /**
     * Convenience multicast helper for swarm-wide packets.
     */
    multicast(type, payload = {}) {
        this.sendPacket('239.255.255.250', this.discoveryPort, {
            type,
            ...payload
        });
    }

    pack(payload) {
        const json = JSON.stringify({ ...payload, selfID: this.machineID });
        return VaultCrypt.encrypt(json, this.passphrase);
    }

    unpack(buffer) {
        try {
            let dataBuffer = buffer;
            if (this.stealthMode) {
                dataBuffer = StegoNexus.unwrap(buffer);
            }
            const json = VaultCrypt.decrypt(dataBuffer, this.passphrase);
            return JSON.parse(json);
        } catch (e) {
            this.debug(`Failed to decrypt packet: ${e.message}`);
            return null;
        }
    }

    handleMessage(msg, rinfo, isDiscovery) {
        const data = this.unpack(msg);
        if (!data) return;

        if (data.selfID === this.machineID) return;

        this.debug(`Inbound: type=${data.type}, id=${data.id}`);

        if (data.type === 'HEARTBEAT') {
            this.updatePeer(data.id, rinfo.address, data.port);
        }

        if (this.listeners.has(data.type)) {
            this.listeners.get(data.type).forEach(cb => cb(data, rinfo));
        }
    }

    updatePeer(id, address, port) {
        this.peers.set(id, { address, port, lastSeen: Date.now() });
        this.debug(`Peer Updated: ${id.slice(0, 8)} at ${address}:${port}`);
    }

    prunePeers() {
        const now = Date.now();
        for (const [id, peer] of this.peers.entries()) {
            if (now - peer.lastSeen > 30000) {
                this.peers.delete(id);
                this.log(`Peer Ejected: ${id.slice(0, 8)} (Timed Out)`);
            }
        }
    }

    getPeers() {
        return Array.from(this.peers.entries()).map(([id, peer]) => ({
            id,
            address: peer.address,
            port: peer.port,
            lastSeen: peer.lastSeen
        }));
    }
}

module.exports = GhostSync;
