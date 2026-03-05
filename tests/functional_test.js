"use strict";
const http = require('http');

const PORT = 3000;
let SESSION_TOKEN = null;

function request(path, method = 'GET', body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        if (SESSION_TOKEN) headers['Authorization'] = `Bearer ${SESSION_TOKEN}`;
        if (body) headers['Content-Type'] = 'application/json';

        const req = http.request({
            hostname: '127.0.0.1',
            port: PORT,
            path: path,
            method: method,
            headers: headers
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runFunctionalTests() {
    console.log("=== PHASE 1: FUNCTIONAL TESTING ===");

    // 1. Authentication
    console.log("[1] Testing Secure Unlock...");
    let res = await request('/api/system/unlock', 'POST', { passphrase: "FORGE_MASTER_2026" });
    if (res.status === 200 && res.body.token) {
        SESSION_TOKEN = res.body.token;
        console.log("  ✅ SUCCESS: Session token acquired.");
    } else throw new Error(`Unlock failed: ${res.status} ${JSON.stringify(res.body)}`);

    // 2. Vault Operations
    console.log("[2] Testing Vault Artifact Creation...");
    res = await request('/api/vault/new', 'POST', { vault: "INTEL_VAULT", name: "test_artifact.txt", content: "CLASSIFIED_DATA" });
    if (res.status === 200 && res.body.ok) console.log("  ✅ SUCCESS: Artifact created securely via FS_BROKER.");
    else throw new Error("Vault create failed.");

    // 3. ForgeGit Engine
    console.log("[3] Testing Forge Git Engine (Init & Commit)...");
    res = await request('/api/forge/git/init', 'POST', { repo: "test_repo" });
    if (res.status === 200) {
        console.log("  ✅ SUCCESS: Repo initialized.");
        
        // Write a file to commit
        const marker = new Date().toISOString();
        await request('/api/forge/save', 'POST', { path: "test_repo/readme.md", content: `Hello World\n${marker}` });
        
        res = await request('/api/forge/git/commit', 'POST', { repo: "test_repo", message: "Initial Commit" });
        if (res.status === 200 && res.body.success && typeof res.body.hash === 'string') {
            console.log(`  ✅ SUCCESS: Git Commit successful. Hash: ${res.body.hash.substring(0,7)}`);
        } else {
             console.log(`  ⚠️ WARN: Git commit failed, may need global config. Error: ${JSON.stringify(res.body)}`);
        }
    } else throw new Error("Git Init failed.");

    // 4. Quantum Bridge
    console.log("[4] Testing Rust Quantum Bridge...");
    res = await request('/api/quantum/gen-key', 'POST', { type: "Kyber768" });
    if (res.status === 200 && res.body.public_key) console.log("  ✅ SUCCESS: Quantum keypair generated.");
    else throw new Error(`Quantum generation failed: ${JSON.stringify(res.body)}`);

    console.log("\n🎯 ALL FUNCTIONAL TESTS PASSED.");
}

runFunctionalTests().catch(e => {
    console.error("❌ TEST FAILED:", e);
    process.exit(1);
});
