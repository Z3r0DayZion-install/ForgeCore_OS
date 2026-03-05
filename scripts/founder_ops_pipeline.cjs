"use strict";

const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const STEPS = {
    ghostWitness: { label: "Ghost-Witness Proof", cmd: "npm", args: ["run", "prove:ghost-witness"] },
    obeyMaterialize: { label: "Obey Output Materialization", cmd: "npm", args: ["run", "specs:materialize:obey"] },
    obeyTests: { label: "Obey Output Tests", cmd: "npm", args: ["run", "test:specs:obey"] },
    mindUnsetMaterialize: { label: "MindUnset Output Materialization", cmd: "npm", args: ["run", "specs:materialize:mind_unset"] },
    mindUnsetTests: { label: "MindUnset Output Tests", cmd: "npm", args: ["run", "test:specs:mind_unset"] },
    specsCheck: { label: "Specs Drift Check", cmd: "npm", args: ["run", "specs:check"] },
    specsVerify: { label: "Specs Verification", cmd: "npm", args: ["run", "specs:verify"] },
    specsSign: { label: "Specs Detached Signing", cmd: "npm", args: ["run", "specs:sign"] },
    specsVerifySignatures: { label: "Specs Signature Verification", cmd: "npm", args: ["run", "specs:verify:signatures"] },
    releaseVerify: { label: "Release Verification", cmd: "npm", args: ["run", "verify:release"] }
};

function runStep(step) {
    return new Promise((resolve, reject) => {
        const isWin = process.platform === "win32";
        const cmd = isWin ? "cmd.exe" : step.cmd;
        const args = isWin ? ["/c", step.cmd, ...step.args] : step.args;

        console.log(`\n[FOUNDER_OPS] >>> ${step.label}`);
        const child = spawn(cmd, args, {
            stdio: "inherit",
            shell: false,
            env: process.env
        });

        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${step.label} failed with exit code ${code}`));
        });
    });
}

async function runWithRetry(step, attempts = 2) {
    let lastErr = null;
    for (let i = 1; i <= attempts; i++) {
        try {
            await runStep(step);
            return;
        } catch (err) {
            lastErr = err;
            if (i < attempts) {
                console.warn(`[FOUNDER_OPS] Retry ${i}/${attempts - 1} for ${step.label}`);
            }
        }
    }
    throw lastErr;
}

function request(pathname, timeoutMs = 1200) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: "127.0.0.1",
            port: 3000,
            path: pathname,
            method: "GET",
            timeout: timeoutMs
        }, (res) => {
            res.resume();
            resolve(res.statusCode || 0);
        });
        req.on("error", reject);
        req.on("timeout", () => req.destroy(new Error("timeout")));
        req.end();
    });
}

async function waitForServer() {
    for (let i = 0; i < 40; i++) {
        try {
            const status = await request("/api/handshake");
            if (status >= 200 && status < 500) return true;
        } catch (e) {
            // retry
        }
        await new Promise((r) => setTimeout(r, 500));
    }
    return false;
}

async function runResilienceStep() {
    const serverFile = path.join(process.cwd(), "core", "v3_sovereign_server.js");
    const server = spawn(process.execPath, [serverFile], {
        stdio: "inherit",
        shell: false,
        env: process.env
    });

    try {
        const ready = await waitForServer();
        if (!ready) {
            throw new Error("Resilience Regression failed: server did not start on port 3000");
        }
        await runStep({ label: "Resilience Regression", cmd: "npm", args: ["run", "test:resilience"] });
    } finally {
        if (!server.killed) {
            server.kill("SIGTERM");
        }
    }
}

async function main() {
    console.log("[FOUNDER_OPS] Starting pipeline...");
    await runWithRetry(STEPS.ghostWitness, 4);
    await runStep(STEPS.obeyMaterialize);
    await runStep(STEPS.obeyTests);
    await runStep(STEPS.mindUnsetMaterialize);
    await runStep(STEPS.mindUnsetTests);
    await runStep(STEPS.specsCheck);
    await runStep(STEPS.specsVerify);
    await runStep(STEPS.specsSign);
    await runStep(STEPS.specsVerifySignatures);
    console.log(`\n[FOUNDER_OPS] >>> Resilience Regression`);
    await runResilienceStep();
    await runStep(STEPS.releaseVerify);
    console.log("\n[FOUNDER_OPS] Pipeline complete. STATUS=OK");
}

main().catch((err) => {
    console.error(`\n[FOUNDER_OPS] STATUS=FAIL: ${err.message}`);
    process.exit(1);
});
