"use strict";

const crypto = require("crypto");
const path = require("path");

const ROOT_DIR = path.join(__dirname, "..");
const GhostSync = require(path.join(ROOT_DIR, "core", "swarm", "ghost_sync"));

const DISCOVERY_PORT = Number(process.env.FORGE_SWARM_DISCOVERY_PORT || 3303);
const SERVER_PORT = Number(process.env.FORGE_SWARM_SERVER_PORT || 3314);
const PASSPHRASE = String(process.env.FORGE_SWARM_PASSPHRASE || "FORGE_MASTER_2026");
const NODE_ID = String(process.env.FORGE_GHOST_NODE_ID || "NODE_ALPHA_WITNESS");

process.env.FORGE_GHOST_NODE_ID = NODE_ID;

const ghost = new GhostSync(DISCOVERY_PORT, SERVER_PORT);
ghost.setPassphrase(PASSPHRASE);

const headStore = new Map(); // headCID -> witness[]

function payloadFor(witness) {
    return `${witness.headCID}|${witness.subjectID}|${witness.observerID}|${witness.timestamp}|${witness.chainLength || 0}|${witness.blockFingerprint || ""}`;
}

function signWitness(observerID, payload) {
    return crypto.createHmac("sha256", observerID).update(payload).digest("hex");
}

function verifyWitness(witness) {
    if (!witness || !witness.headCID || !witness.subjectID || !witness.observerID || !witness.timestamp || !witness.signature) {
        return false;
    }
    const expected = signWitness(witness.observerID, payloadFor(witness));
    return expected === witness.signature;
}

function addWitness(record) {
    const list = headStore.get(record.headCID) || [];
    const dup = list.find((item) =>
        item.signature === record.signature &&
        item.observerID === record.observerID &&
        item.subjectID === record.subjectID &&
        item.timestamp === record.timestamp
    );
    if (!dup) {
        list.push(record);
        list.sort((a, b) => b.timestamp - a.timestamp);
        if (list.length > 64) list.length = 64;
        headStore.set(record.headCID, list);
    }
}

ghost.onPacket("GHOST_WITNESS_ANNOUNCE", (data, rinfo) => {
    const announced = {
        headCID: data.headCID,
        subjectID: data.subjectID,
        observerID: data.subjectID,
        timestamp: data.timestamp,
        chainLength: data.chainLength || 0,
        blockFingerprint: data.blockFingerprint || "",
        signature: data.signature
    };

    if (!verifyWitness(announced)) return;
    addWitness(announced);

    const ack = {
        headCID: data.headCID,
        subjectID: data.subjectID,
        observerID: ghost.machineID,
        timestamp: Date.now(),
        chainLength: data.chainLength || 0,
        blockFingerprint: data.blockFingerprint || "",
        signature: null
    };
    ack.signature = signWitness(ack.observerID, payloadFor(ack));
    addWitness(ack);

    ghost.sendPacket(rinfo.address, rinfo.port, {
        type: "GHOST_WITNESS_ACK",
        headCID: data.headCID,
        forNode: data.subjectID,
        witness: ack
    });
});

ghost.onPacket("GHOST_WITNESS_QUERY", (data, rinfo) => {
    if (!data || !data.queryID || !data.headCID) return;
    const witnesses = (headStore.get(data.headCID) || []).slice(0, 32);
    ghost.sendPacket(rinfo.address, rinfo.port, {
        type: "GHOST_WITNESS_RESPONSE",
        queryID: data.queryID,
        headCID: data.headCID,
        responderID: ghost.machineID,
        witnesses
    });
});

ghost.start();
console.log(`[WITNESS_PEER] id=${ghost.machineID} discovery=${DISCOVERY_PORT} server=${SERVER_PORT}`);

const shutdown = () => {
    try { ghost.stop(); } catch (e) { /* no-op */ }
    process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
