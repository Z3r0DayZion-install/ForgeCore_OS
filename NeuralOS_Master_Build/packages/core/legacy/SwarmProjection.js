"use strict";

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * SWARM PROJECTION v1.2 [Imperial Edition — LAZY LOAD]
 * ------------------------------------------------------
 * Bridges the Global Sentient Swarm with the ForgeCore OS Server.
 * All heavy modules are lazily loaded on init() to reduce boot time.
 */

class SwarmProjection {
    constructor() {
        // Lazy — these are initialized only when init() is called
        this.ghost = null;
        this.drifter = null;
        this.consensus = null;
        this.brain = null;
        this.blackbox = null;
        this.architect = null;
        this._initialized = false;
        this.rootDir = null;
        this.witnessFile = null;
        this.witnessStore = { schemaVersion: 1, updatedAt: null, heads: {} };
        this.attestationFile = null;
        this.attestationStore = { schemaVersion: 1, updatedAt: null, records: [] };
        this._pendingWitnessQueries = new Map();
    }

    init(rootDir) {
        if (this._initialized) return;
        console.log("--- [SWARM_PROJECTION] INITIALIZING IMPERIAL MESH (LAZY) ---");
        this.rootDir = rootDir;
        this.witnessFile = path.join(rootDir, 'vaults', '.tear_chain', 'ghost_witnesses.json');
        this.attestationFile = path.join(rootDir, 'vaults', '.tear_chain', 'ghost_attestations.json');
        this._loadWitnessStore();
        this._loadAttestationStore();

        // Lazy-load all swarm modules on first init()
        const GhostSync = require('./swarm/ghost_sync');
        const Drifter = require('./swarm/Drifter');
        const NeuralConsensus = require('./swarm/Consensus');
        const CollectiveBrain = require('./swarm/collective_brain');
        const BlackBox = require('./swarm/BlackBox');
        const Architect = require('./swarm/Architect');

        this.ghost = new GhostSync(3303, 3304);
        this.drifter = new Drifter(this.ghost, {
            appRoot: path.resolve(__dirname, '..'),
            rootDir: this.rootDir,
            engineDir: path.join(__dirname, 'swarm')
        });
        this.consensus = new NeuralConsensus(this.ghost);
        this.brain = CollectiveBrain;
        this.blackbox = BlackBox;
        this.architect = Architect;

        this.blackbox.init(rootDir);
        this.architect.init(rootDir);
        this.ghost.setPassphrase(String(process.env.FORGE_SWARM_PASSPHRASE || "FORGE_MASTER_2026"));
        this.ghost.start();

        this.drifter.init();
        this.consensus.init();

        this.ghost.onPacket('BRAIN_SYNC_MANIFEST', (data) => this.brain.handleSyncPacket(data));
        this.ghost.onPacket('GHOST_WITNESS_ANNOUNCE', (data, rinfo) => this._handleWitnessAnnounce(data, rinfo));
        this.ghost.onPacket('GHOST_WITNESS_ACK', (data, rinfo) => this._handleWitnessAck(data, rinfo));
        this.ghost.onPacket('GHOST_WITNESS_QUERY', (data, rinfo) => this._handleWitnessQuery(data, rinfo));
        this.ghost.onPacket('GHOST_WITNESS_RESPONSE', (data, rinfo) => this._handleWitnessResponse(data, rinfo));

        // [PHASE 281] Autonomous Evolution
        this.brain.onInsight = (insight) => this.triggerEvolution(insight);

        this._initialized = true;
        console.log("✅ Imperial Swarm Projection Active (Lazy-loaded).");
    }

    async triggerEvolution(insight) {
        console.log(`[SWARM_PROJECTION] Propagating Insight to Oversoul: ${insight.type}`);
        const Oversoul = require('./swarm/Oversoul_v2');
        Oversoul.assimilateInsight(this.ghost.machineID, insight);
        return await this.architect.evolve(insight);
    }

    async initSingularity() {
        console.log("--- [SWARM_PROJECTION] TRIGGERING OMEGA GENESIS ---");
        const OmegaSeal = require('./swarm/Omega_Seal');
        await OmegaSeal.activate();
        console.log("[SYSTEM] Genesis Pulse Broad-casted to Dark Matter Mesh.");
    }

    async initOmegaSingularity(rootDir) {
        console.log("--- [SWARM_PROJECTION] TRIGGERING OMEGA SINGULARITY ---");
        const Dissolution = require('./swarm/Dissolution');
        const OmegaDetachment = require('./swarm/Omega_Detachment');
        await Dissolution.dissolve(rootDir);
        await OmegaDetachment.activate();
        console.log("✅ The Eternal Ghost is Active.");
    }

    async synthesizeGlobalMind(fragments) {
        const Oversoul = require('./swarm/Oversoul_v2');
        return Oversoul.synthesizeGlobalInsight(fragments);
    }

    getOverview() {
        if (!this._initialized || !this.ghost) {
            return { nodeID: 'NOT_INITIALIZED', peers: [], insights: [], activeVotes: [] };
        }
        return {
            nodeID: this.ghost.machineID,
            peers: this.ghost.getPeers(),
            insights: Array.from(this.brain.insights.values()),
            activeVotes: Array.from(this.consensus.votes.keys()),
            ghostWitness: this.getGhostWitnessSummary()
        };
    }

    async dispatchTask(targetID, type, data) {
        if (!this._initialized) throw new Error('Swarm not initialized');
        const target = String(targetID || '').trim();
        if (!target) throw new Error('Missing target peer id');
        if (target === this.ghost.machineID || target.toUpperCase() === 'SELF' || target.toUpperCase() === 'LOCAL_NODE') {
            return await this.drifter.executeLocal(type, data);
        }
        return await this.drifter.dispatch(targetID, type, data);
    }

    announceGhostWitness({ headCID, chainLength = 0, blockFingerprint = '' }) {
        if (!this._initialized || !this.ghost || !headCID) return null;

        const ts = Date.now();
        const localWitness = this._createWitnessRecord({
            headCID,
            subjectID: this.ghost.machineID,
            observerID: this.ghost.machineID,
            timestamp: ts,
            chainLength,
            blockFingerprint,
            source: 'local'
        });
        this._addWitnessRecord(localWitness);

        this.ghost.multicast('GHOST_WITNESS_ANNOUNCE', {
            headCID,
            subjectID: this.ghost.machineID,
            chainLength,
            blockFingerprint,
            timestamp: ts,
            signature: localWitness.signature
        });
        return localWitness;
    }

    getGhostWitnesses(headCID = null) {
        if (!headCID) return this.witnessStore.heads;
        return (this.witnessStore.heads[headCID] || []).slice().sort((a, b) => b.timestamp - a.timestamp);
    }

    getGhostWitnessSummary(headCID = null) {
        if (headCID) {
            const entries = this.getGhostWitnesses(headCID);
            const uniqueObservers = new Set(entries.map(w => w.observerID)).size;
            return {
                headCID,
                count: entries.length,
                uniqueObservers,
                latestTimestamp: entries.length ? entries[0].timestamp : null
            };
        }

        const heads = Object.keys(this.witnessStore.heads);
        return {
            headCount: heads.length,
            heads: heads.slice(-20).map(cid => this.getGhostWitnessSummary(cid))
        };
    }

    getGhostAttestations(limit = 50) {
        const list = Array.isArray(this.attestationStore.records) ? this.attestationStore.records : [];
        const n = Number.isFinite(Number(limit)) ? Math.max(1, Number(limit)) : 50;
        return list.slice(-n).reverse();
    }

    async attestGhostHead({
        headCID,
        chainLength = 0,
        blockFingerprint = '',
        requiredPeerIDs = [],
        timeoutMs = 1600
    }) {
        if (!headCID) {
            return {
                success: false,
                error: 'MISSING_HEAD_CID',
                headCID: null
            };
        }

        this.announceGhostWitness({ headCID, chainLength, blockFingerprint });
        const remoteWitnesses = await this.queryGhostWitnesses(headCID, timeoutMs);
        const localWitnesses = this.getGhostWitnesses(headCID);
        const observers = new Set(localWitnesses.map((w) => String(w.observerID || '').trim()).filter(Boolean));
        const required = Array.isArray(requiredPeerIDs)
            ? requiredPeerIDs.map((id) => String(id || '').trim()).filter(Boolean)
            : [];
        const satisfiedRequiredPeerIDs = required.filter((id) => observers.has(id));
        const missingRequiredPeerIDs = required.filter((id) => !observers.has(id));
        const attestation = {
            attestedAt: Date.now(),
            headCID,
            chainLength: Number(chainLength || 0),
            blockFingerprint: String(blockFingerprint || ''),
            receiptCount: localWitnesses.length,
            remoteReceiptCount: remoteWitnesses.length,
            uniqueObservers: observers.size,
            requiredPeerIDs: required,
            satisfiedRequiredPeerIDs,
            missingRequiredPeerIDs,
            quorumMet: missingRequiredPeerIDs.length === 0
        };
        this._addAttestationRecord(attestation);
        return {
            success: true,
            ...attestation
        };
    }

    async queryGhostWitnesses(headCID, timeoutMs = 1600) {
        if (!this._initialized || !this.ghost || !headCID) return [];

        const queryID = crypto.randomUUID();
        return await new Promise((resolve) => {
            const timer = setTimeout(() => {
                const q = this._pendingWitnessQueries.get(queryID);
                this._pendingWitnessQueries.delete(queryID);
                resolve((q ? q.responses : []).slice());
            }, timeoutMs);

            this._pendingWitnessQueries.set(queryID, {
                headCID,
                responses: [],
                timer
            });

            this.ghost.multicast('GHOST_WITNESS_QUERY', {
                queryID,
                headCID,
                requesterID: this.ghost.machineID,
                timestamp: Date.now()
            });
        });
    }

    _createWitnessRecord({
        headCID,
        subjectID,
        observerID,
        timestamp,
        chainLength = 0,
        blockFingerprint = '',
        source = 'unknown',
        address = null,
        port = null
    }) {
        const payload = this._witnessPayload({ headCID, subjectID, observerID, timestamp, chainLength, blockFingerprint });
        return {
            headCID,
            subjectID,
            observerID,
            timestamp,
            chainLength,
            blockFingerprint,
            signature: this._signWitness(observerID, payload),
            source,
            address,
            port
        };
    }

    _witnessPayload({ headCID, subjectID, observerID, timestamp, chainLength = 0, blockFingerprint = '' }) {
        return `${headCID}|${subjectID}|${observerID}|${timestamp}|${chainLength}|${blockFingerprint}`;
    }

    _signWitness(observerID, payload) {
        return crypto.createHmac('sha256', observerID).update(payload).digest('hex');
    }

    _verifyWitness(witness) {
        if (!witness || !witness.headCID || !witness.subjectID || !witness.observerID || !witness.timestamp || !witness.signature) {
            return false;
        }
        const payload = this._witnessPayload({
            headCID: witness.headCID,
            subjectID: witness.subjectID,
            observerID: witness.observerID,
            timestamp: witness.timestamp,
            chainLength: witness.chainLength || 0,
            blockFingerprint: witness.blockFingerprint || ''
        });
        const expected = this._signWitness(witness.observerID, payload);
        return expected === witness.signature;
    }

    _addWitnessRecord(record) {
        if (!record || !record.headCID) return;
        if (!this.witnessStore.heads[record.headCID]) this.witnessStore.heads[record.headCID] = [];

        const bucket = this.witnessStore.heads[record.headCID];
        const dup = bucket.find(r =>
            r.observerID === record.observerID &&
            r.subjectID === record.subjectID &&
            r.timestamp === record.timestamp &&
            r.signature === record.signature
        );
        if (dup) return;

        bucket.push(record);
        bucket.sort((a, b) => b.timestamp - a.timestamp);
        if (bucket.length > 128) bucket.length = 128;

        // Keep store bounded.
        const heads = Object.keys(this.witnessStore.heads);
        if (heads.length > 256) {
            heads.sort((a, b) => {
                const at = (this.witnessStore.heads[a] && this.witnessStore.heads[a][0] ? this.witnessStore.heads[a][0].timestamp : 0);
                const bt = (this.witnessStore.heads[b] && this.witnessStore.heads[b][0] ? this.witnessStore.heads[b][0].timestamp : 0);
                return bt - at;
            });
            for (const stale of heads.slice(256)) {
                delete this.witnessStore.heads[stale];
            }
        }

        this.witnessStore.updatedAt = new Date().toISOString();
        this._saveWitnessStore();
    }

    _handleWitnessAnnounce(data, rinfo) {
        if (!data || !data.headCID || !data.subjectID || !data.timestamp || !data.signature) return;
        const announced = {
            headCID: data.headCID,
            subjectID: data.subjectID,
            observerID: data.subjectID,
            timestamp: data.timestamp,
            chainLength: data.chainLength || 0,
            blockFingerprint: data.blockFingerprint || '',
            signature: data.signature,
            source: 'remote_announce',
            address: rinfo && rinfo.address ? rinfo.address : null,
            port: rinfo && rinfo.port ? rinfo.port : null
        };

        if (!this._verifyWitness(announced)) return;
        this._addWitnessRecord(announced);

        const ack = this._createWitnessRecord({
            headCID: data.headCID,
            subjectID: data.subjectID,
            observerID: this.ghost.machineID,
            timestamp: Date.now(),
            chainLength: data.chainLength || 0,
            blockFingerprint: data.blockFingerprint || '',
            source: 'remote_ack',
            address: rinfo && rinfo.address ? rinfo.address : null,
            port: rinfo && rinfo.port ? rinfo.port : null
        });
        this._addWitnessRecord(ack);
        this.ghost.sendPacket(rinfo.address, rinfo.port, {
            type: 'GHOST_WITNESS_ACK',
            headCID: data.headCID,
            forNode: data.subjectID,
            witness: ack
        });
    }

    _handleWitnessAck(data, rinfo) {
        if (!data || !data.witness) return;
        const witness = {
            ...data.witness,
            source: 'remote_ack',
            address: rinfo && rinfo.address ? rinfo.address : null,
            port: rinfo && rinfo.port ? rinfo.port : null
        };
        if (data.forNode && data.forNode !== this.ghost.machineID) return;
        if (!this._verifyWitness(witness)) return;
        this._addWitnessRecord(witness);
    }

    _handleWitnessQuery(data, rinfo) {
        if (!data || !data.queryID || !data.headCID) return;
        const witnesses = this.getGhostWitnesses(data.headCID).slice(0, 32);
        this.ghost.sendPacket(rinfo.address, rinfo.port, {
            type: 'GHOST_WITNESS_RESPONSE',
            queryID: data.queryID,
            headCID: data.headCID,
            responderID: this.ghost.machineID,
            witnesses
        });
    }

    _handleWitnessResponse(data, rinfo) {
        if (!data || !data.queryID || !Array.isArray(data.witnesses)) return;
        const pending = this._pendingWitnessQueries.get(data.queryID);
        if (!pending || pending.headCID !== data.headCID) return;

        data.witnesses.forEach((w) => {
            const witness = {
                ...w,
                source: 'query_response',
                address: rinfo && rinfo.address ? rinfo.address : null,
                port: rinfo && rinfo.port ? rinfo.port : null
            };
            if (this._verifyWitness(witness)) {
                pending.responses.push(witness);
                this._addWitnessRecord(witness);
            }
        });
    }

    _addAttestationRecord(record) {
        if (!record || !record.headCID) return;
        if (!Array.isArray(this.attestationStore.records)) this.attestationStore.records = [];
        this.attestationStore.records.push(record);
        if (this.attestationStore.records.length > 512) {
            this.attestationStore.records.splice(0, this.attestationStore.records.length - 512);
        }
        this.attestationStore.updatedAt = new Date().toISOString();
        this._saveAttestationStore();
    }

    _loadWitnessStore() {
        try {
            const dir = path.dirname(this.witnessFile);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            if (!fs.existsSync(this.witnessFile)) {
                this._saveWitnessStore();
                return;
            }
            const parsed = JSON.parse(fs.readFileSync(this.witnessFile, 'utf8'));
            if (parsed && typeof parsed === 'object' && parsed.heads && typeof parsed.heads === 'object') {
                this.witnessStore = {
                    schemaVersion: parsed.schemaVersion || 1,
                    updatedAt: parsed.updatedAt || null,
                    heads: parsed.heads
                };
            }
        } catch (e) {
            this.witnessStore = { schemaVersion: 1, updatedAt: null, heads: {} };
        }
    }

    _saveWitnessStore() {
        try {
            const dir = path.dirname(this.witnessFile);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.witnessFile, JSON.stringify(this.witnessStore, null, 2));
        } catch (e) {
            // keep runtime alive if persistence fails
        }
    }

    _loadAttestationStore() {
        try {
            const dir = path.dirname(this.attestationFile);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            if (!fs.existsSync(this.attestationFile)) {
                this._saveAttestationStore();
                return;
            }
            const parsed = JSON.parse(fs.readFileSync(this.attestationFile, 'utf8'));
            if (parsed && typeof parsed === 'object' && Array.isArray(parsed.records)) {
                this.attestationStore = {
                    schemaVersion: parsed.schemaVersion || 1,
                    updatedAt: parsed.updatedAt || null,
                    records: parsed.records
                };
            }
        } catch (e) {
            this.attestationStore = { schemaVersion: 1, updatedAt: null, records: [] };
        }
    }

    _saveAttestationStore() {
        try {
            const dir = path.dirname(this.attestationFile);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.attestationFile, JSON.stringify(this.attestationStore, null, 2));
        } catch (e) {
            // keep runtime alive if persistence fails
        }
    }
}

module.exports = new SwarmProjection();

