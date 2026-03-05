"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { spawn, execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const MANIFEST_PATH = path.join(DIST_DIR, "release-manifest.json");
const BASE = "http://127.0.0.1:3000";

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestJson(route) {
    return new Promise((resolve, reject) => {
        const req = http.request(`${BASE}${route}`, { method: "GET" }, (res) => {
            let raw = "";
            res.on("data", (chunk) => raw += chunk.toString("utf8"));
            res.on("end", () => {
                let json = null;
                try {
                    json = raw ? JSON.parse(raw) : {};
                } catch {
                    json = { raw };
                }
                resolve({ statusCode: res.statusCode || 0, json });
            });
        });
        req.on("error", reject);
        req.end();
    });
}

function resolveArtifactPath() {
    if (fs.existsSync(MANIFEST_PATH)) {
        const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
        const file = manifest && manifest.artifact ? manifest.artifact.file : "";
        if (file) {
            const abs = path.join(DIST_DIR, file);
            if (fs.existsSync(abs)) {
                return abs;
            }
        }
    }

    const exes = fs.readdirSync(DIST_DIR)
        .filter((f) => f.toLowerCase().endsWith(".exe"))
        .filter((f) => !f.toLowerCase().includes("zerotrace"))
        .map((name) => ({
            name,
            abs: path.join(DIST_DIR, name),
            mtimeMs: fs.statSync(path.join(DIST_DIR, name)).mtimeMs
        }))
        .sort((a, b) => b.mtimeMs - a.mtimeMs);

    if (!exes.length) {
        throw new Error("no_portable_exe_found");
    }
    return exes[0].abs;
}

async function assertNoPreexistingServer() {
    try {
        const res = await requestJson("/api/handshake");
        if (res.statusCode > 0) {
            throw new Error("port_3000_already_in_use_by_running_instance");
        }
    } catch (err) {
        const msg = String(err && err.message ? err.message : err);
        if (msg === "port_3000_already_in_use_by_running_instance") {
            throw err;
        }
        // Connection refused is expected when nothing is running.
    }
}

function solvePoiChallenge(target, difficulty = "000", maxAttempts = 5_000_000) {
    for (let nonce = 0; nonce < maxAttempts; nonce++) {
        const digest = crypto.createHash("sha256").update(String(target) + String(nonce)).digest("hex");
        if (digest.startsWith(difficulty)) {
            return String(nonce);
        }
    }
    throw new Error("poi_nonce_not_found");
}

async function waitForHandshake(maxMs = 60000) {
    const started = Date.now();
    while (Date.now() - started < maxMs) {
        try {
            const res = await requestJson("/api/handshake");
            if (res.statusCode === 200) {
                return res.json;
            }
            if (res.statusCode === 401 && res.json && res.json.status === "CHALLENGE" && res.json.target) {
                const difficulty = typeof res.json.difficulty === "string" ? res.json.difficulty : "000";
                const nonce = solvePoiChallenge(res.json.target, difficulty);
                const route = `/api/handshake?target=${encodeURIComponent(res.json.target)}&nonce=${encodeURIComponent(nonce)}`;
                const solved = await requestJson(route);
                if (solved.statusCode === 200) {
                    return solved.json;
                }
            }
        } catch {
            // retry
        }
        await sleep(500);
    }
    throw new Error("handshake_timeout");
}

async function assertStaticAssets() {
    const routes = [
        "/",
        "/ui/empire_app.js",
        "/ui/empire_api.js",
        "/vendor/xterm.js",
        "/vendor/xterm-addon-fit.js",
        "/vendor/monaco/min/vs/loader.js",
        "/THEME_ENGINE.css"
    ];

    for (const route of routes) {
        const res = await requestJson(route);
        if (res.statusCode !== 200) {
            throw new Error(`asset_unavailable:${route}:status=${res.statusCode}`);
        }
    }
}

function killTree(pid) {
    if (!pid) return;
    try {
        execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
        // Ignore if process already exited.
    }
}

async function main() {
    if (!fs.existsSync(DIST_DIR)) {
        throw new Error("dist_directory_missing");
    }
    const artifactPath = resolveArtifactPath();
    await assertNoPreexistingServer();

    const child = spawn(artifactPath, [], {
        cwd: ROOT,
        detached: false,
        windowsHide: true,
        stdio: "ignore"
    });

    try {
        const handshake = await waitForHandshake(70000);
        if (!handshake || typeof handshake !== "object") {
            throw new Error("invalid_handshake_payload");
        }
        await assertStaticAssets();
        console.log(`[SMOKE] exe=${path.basename(artifactPath)}`);
        console.log(`[SMOKE] handshakeStatus=${String(handshake.status || "unknown")}`);
        console.log(`[SMOKE] seal=${String(handshake.seal || "").slice(0, 16)}`);
        console.log("[SMOKE] status=OK");
    } finally {
        killTree(child.pid);
    }
}

main().catch((err) => {
    console.error("[SMOKE] FAILED:", err && err.message ? err.message : err);
    process.exit(1);
});
