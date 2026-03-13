"use strict";

const crypto = require('crypto');

/**
 * NEURAL CONSENSUS v1.0 (Phase 277)
 * --------------------------------
 * Unified voting protocol for mesh-wide decision making.
 * Ensures all nodes agree on "Intents" before execution.
 */

class NeuralConsensus {
    constructor(ghostSync) {
        this.ghostSync = ghostSync;
        this.votes = new Map(); // intentHash -> { nodeID: vote }
        this.log = (msg) => console.log(`[CONSENSUS] ${msg}`);
    }

    init() {
        this.ghostSync.onPacket('NEURAL_VOTE_PROPOSAL', (data, rinfo) => this.handleVoteProposal(data, rinfo));
        this.ghostSync.onPacket('NEURAL_VOTE_cast', (data, rinfo) => this.handleVoteCast(data, rinfo));
    }

    /**
     * Proposes a new intent for mesh-wide consensus.
     */
    propose(intent) {
        const intentHash = crypto.createHash('sha256').update(JSON.stringify(intent)).digest('hex');
        this.log(`Proposing intent ${intentHash.slice(0, 8)}...`);

        this.votes.set(intentHash, new Map());
        // Vote for our own proposal
        this.votes.get(intentHash).set(this.ghostSync.machineID, true);

        this.ghostSync.sendPacket('239.255.255.250', this.ghostSync.discoveryPort, {
            type: 'NEURAL_VOTE_PROPOSAL',
            intent,
            intentHash,
            proposerID: this.ghostSync.machineID
        });

        return intentHash;
    }

    /**
     * Handles an incoming vote proposal from a peer.
     */
    handleVoteProposal(data, rinfo) {
        this.log(`Incoming proposal ${data.intentHash.slice(0, 8)} from ${data.proposerID.slice(0, 8)}`);

        // In a sentient swarm, the Cognitive Engine would decide the vote.
        // For v1.0, we approve if the intent is well-formed.
        const vote = data.intent && data.intent.type;

        this.ghostSync.sendPacket(rinfo.address, rinfo.port, {
            type: 'NEURAL_VOTE_cast',
            intentHash: data.intentHash,
            voterID: this.ghostSync.machineID,
            vote
        });
    }

    /**
     * Collects votes from peers.
     */
    handleVoteCast(data, rinfo) {
        if (!this.votes.has(data.intentHash)) return;

        this.votes.get(data.intentHash).set(data.voterID, data.vote);
        const voteMap = this.votes.get(data.intentHash);

        this.log(`Vote cast for ${data.intentHash.slice(0, 8)}: ${data.voterID.slice(0, 8)} -> ${data.vote}`);

        // Check for Quorum (e.g., > 50% of known peers)
        const quorumSize = Math.max(1, Math.floor(this.ghostSync.dht.size / 2) + 1);
        const positiveVotes = Array.from(voteMap.values()).filter(v => !!v).length;

        if (positiveVotes >= quorumSize) {
            this.log(`✅ Quorum reached for ${data.intentHash.slice(0, 8)}. Intent AUTHORIZED.`);
            // Trigger actual execution here in a full implementation
        }
    }

    isAuthorized(intentHash) {
        const voteMap = this.votes.get(intentHash);
        if (!voteMap) return false;
        const quorumSize = Math.max(1, Math.floor(this.ghostSync.dht.size / 2) + 1);
        const positiveVotes = Array.from(voteMap.values()).filter(v => !!v).length;
        return positiveVotes >= quorumSize;
    }
}

module.exports = NeuralConsensus;
