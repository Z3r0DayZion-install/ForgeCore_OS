"use strict";

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CORE_DIR = __dirname;
const ROOT_DIR = path.join(CORE_DIR, '..');
const MANIFEST_PATH = path.join(CORE_DIR, 'manifest.json');

const FilesToInclude = [
    "core/v3_sovereign_server.js",
    "core/intent_firewall.js",
    "core/omega_brokers.js",
    "core/omega_policy.json",
    "core/quantum_bridge.js",
    "core/forge_git.js",
    "core/TEAR_Engine.js",
    "core/vault_crypt.js",
    "core/security_dna.js",
    "core/security_audit.js",
    "core/lazarus.js",
    "core/kernel_resurrection.js",
    "core/telemetry_ledger.js",
    "core/SwarmProjection.js",
    "core/telemetry_stream.js",
    "core/gateway_proxy.js",
    "electron_main.js",
    "package.json"
];

console.log("🚀 Generating ForgeCore™ Workspace Manifest (Node.js)...");

const manifest = {
    version: "3.0.0-Quantum",
    timestamp: new Date().toISOString(),
    files: []
};

for (const file of FilesToInclude) {
    const filePath = path.join(ROOT_DIR, file);
    if (fs.existsSync(filePath)) {
        const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toLowerCase();
        manifest.files.push({
            path: file.replace(/\\/g, '/'),
            hash: hash
        });
        console.log(`✅ Hashed: ${file}`);
    } else {
        console.warn(`⚠️  Skipping missing: ${file}`);
    }
}

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
console.log(`\n🎯 Manifest generated successfully at ${MANIFEST_PATH}`);
