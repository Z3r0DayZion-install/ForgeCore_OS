"use strict";

const http = require("http");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const ROOT_DIR = path.join(__dirname, "..");
const SERVER_FILE = path.join(ROOT_DIR, "core", "v3_sovereign_server.js");
const PEER_FILE = path.join(ROOT_DIR, "scripts", "ghost_witness_peer.cjs");
const HOST = "127.0.0.1";
const PORT = 3000;
const MASTER = String(process.env.FORGE_MASTER_PASSPHRASE || "FORGE_MASTER_2026");
const PEER_ID = String(process.env.FORGE_PROOF_PEER_ID || "NODE_ALPHA_PROOF");

let sessionToken = null;
let peerProc = null;
let serverProc = null;

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(route, method = "GET", body = null, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const headers = {};
        if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
        if (body) headers["Content-Type"] = "application/json";

        const req = http.request({
            hostname: HOST,
            port: PORT,
            path: route,
            method,
            headers,
            timeout: timeoutMs
        }, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => {
                let parsed = null;
                try {
                    parsed = data ? JSON.parse(data) : null;
                } catch {
                    parsed = data;
                }
                resolve({ status: res.statusCode, body: parsed });
            });
        });

        req.on("error", reject);
        req.on("timeout", () => {
            req.destroy(new Error("Request timeout"));
        });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function waitForServer(maxAttempts = 40) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const res = await request("/api/handshake", "GET", null, 1200);
            if (res.status >= 200 && res.status < 500) return true;
        } catch {
            // wait and retry
        }
        await wait(500);
    }
    return false;
}

function getHeadSet(summaryBody) {
    const list = summaryBody && summaryBody.localSummary && Array.isArray(summaryBody.localSummary.heads)
        ? summaryBody.localSummary.heads
        : [];
    const set = new Set();
    list.forEach((item) => {
        if (item && item.headCID) set.add(item.headCID);
    });
    return set;
}

function pickNewestHead(summaryBody, beforeSet) {
    const list = summaryBody && summaryBody.localSummary && Array.isArray(summaryBody.localSummary.heads)
        ? summaryBody.localSummary.heads
        : [];
    for (let i = list.length - 1; i >= 0; i--) {
        const cid = list[i] && list[i].headCID;
        if (cid && !beforeSet.has(cid)) return cid;
    }
    return null;
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg);
}

async function stopProcess(proc) {
    if (!proc || proc.exitCode !== null || !proc.pid) return;

    try {
        proc.kill("SIGTERM");
    } catch {
        return;
    }

    const start = Date.now();
    while (proc.exitCode === null && Date.now() - start < 1800) {
        await wait(120);
    }

    if (proc.exitCode !== null) return;

    if (process.platform === "win32") {
        spawnSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
        try { proc.kill("SIGKILL"); } catch {}
    }
}

async function queryRemoteWitnesses(headCID, attempts = 4) {
    let lastErr = null;
    for (let i = 0; i < attempts; i += 1) {
        try {
            const remote = await request(
                `/api/tear/witnesses?head=${encodeURIComponent(headCID)}&remote=1&timeoutMs=4500`,
                "GET",
                null,
                12000
            );
            if (remote.status === 200) {
                const rows = Array.isArray(remote.body && remote.body.remoteWitnesses)
                    ? remote.body.remoteWitnesses
                    : [];
                if (rows.length > 0) return rows;
            }
        } catch (err) {
            lastErr = err;
        }
        await wait(900);
    }
    if (lastErr) throw lastErr;
    return [];
}

async function main() {
    console.log("[PROOF] Starting Ghost-Witness proof harness...");

    peerProc = spawn(process.execPath, [PEER_FILE], {
        cwd: ROOT_DIR,
        env: {
            ...process.env,
            FORGE_GHOST_NODE_ID: PEER_ID,
            FORGE_SWARM_DISCOVERY_PORT: "3303",
            FORGE_SWARM_SERVER_PORT: "3314",
            FORGE_SWARM_PASSPHRASE: String(process.env.FORGE_SWARM_PASSPHRASE || MASTER)
        },
        stdio: ["ignore", "pipe", "pipe"]
    });
    peerProc.stdout.on("data", (d) => process.stdout.write(String(d)));
    peerProc.stderr.on("data", (d) => process.stderr.write(String(d)));

    await wait(1200);

    serverProc = spawn(process.execPath, [SERVER_FILE], {
        cwd: ROOT_DIR,
        env: {
            ...process.env,
            FORGE_SWARM_PASSPHRASE: String(process.env.FORGE_SWARM_PASSPHRASE || MASTER)
        },
        stdio: ["ignore", "pipe", "pipe"]
    });
    serverProc.stdout.on("data", (d) => process.stdout.write(String(d)));
    serverProc.stderr.on("data", (d) => process.stderr.write(String(d)));

    const ready = await waitForServer();
    assert(ready, "Server did not become reachable on port 3000.");
    console.log("[PROOF] Server reachable.");

    const unlock = await request("/api/system/unlock", "POST", { passphrase: MASTER });
    assert(unlock.status === 200, `Unlock failed with status ${unlock.status}`);
    assert(unlock.body && unlock.body.token, "Unlock response missing token.");
    sessionToken = unlock.body.token;
    console.log("[PROOF] Authenticated.");

    const beforeSummary = await request("/api/tear/witnesses");
    assert(beforeSummary.status === 200, `Failed pre-summary with status ${beforeSummary.status}`);
    const beforeSet = getHeadSet(beforeSummary.body);

    const proofCommands = ["help", "status", "witness"];
    let targetHead = null;
    for (const proofCommand of proofCommands) {
        const execRes = await request("/api/system/execute", "POST", { commandString: proofCommand }, 10000);
        assert(execRes.status === 200, `Command execution failed with status ${execRes.status}`);
        console.log(`[PROOF] Executed '${proofCommand}', waiting for witness propagation...`);
        await wait(1800);
        const afterSummary = await request("/api/tear/witnesses");
        assert(afterSummary.status === 200, `Failed post-summary with status ${afterSummary.status}`);
        targetHead = pickNewestHead(afterSummary.body, beforeSet);
        if (targetHead) break;
    }
    assert(targetHead, "No new execution head found for witness proof.");
    console.log(`[PROOF] Target head: ${targetHead}`);

    const remoteWitnesses = await queryRemoteWitnesses(targetHead);
    assert(remoteWitnesses.length > 0, "No remote witness responses received.");

    const matched = remoteWitnesses.find((w) => w && w.observerID === PEER_ID);
    assert(Boolean(matched), `Remote witness from ${PEER_ID} not found.`);

    console.log(`[PROOF] PASS remoteWitnesses=${remoteWitnesses.length} matchedObserver=${PEER_ID}`);
}

main()
    .catch((err) => {
        console.error(`[PROOF] FAIL ${err.message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await wait(250);
        await stopProcess(serverProc);
        await stopProcess(peerProc);
    });
