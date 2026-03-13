"use strict";

const fs = require("fs");
const path = require("path");

function countEntries(dirPath) {
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        return entries.filter((entry) => !entry.name.startsWith(".")).length;
    } catch {
        return 0;
    }
}

async function run(payload = {}, ctx = {}) {
    const rootDir = String(ctx && ctx.rootDir ? ctx.rootDir : process.cwd());
    const vaultDir = path.join(rootDir, "vaults");
    const reposDir = path.join(rootDir, "repos");
    const logsDir = path.join(rootDir, "logs");

    return {
        ok: true,
        engine: "forgecore_runtime_health",
        machineID: String(ctx && ctx.machineID ? ctx.machineID : "").slice(0, 16),
        runtime: {
            pid: process.pid,
            uptimeSec: Math.round(process.uptime()),
            node: process.version
        },
        state: {
            rootDir,
            vaultsPresent: fs.existsSync(vaultDir),
            reposPresent: fs.existsSync(reposDir),
            logsPresent: fs.existsSync(logsDir),
            vaultEntryCount: countEntries(vaultDir),
            repoEntryCount: countEntries(reposDir)
        },
        request: {
            activeVault: payload && payload.activeVault ? String(payload.activeVault) : null,
            activeTab: payload && payload.activeTab ? String(payload.activeTab) : null
        }
    };
}

module.exports = { run };
