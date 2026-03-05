"use strict";

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function testImperialCommand() {
    console.log("--- [IMPERIAL_VERIFICATION] TESTING UNIFIED SOVEREIGNTY ---");

    const rootDir = path.join(__dirname, '..');
    const serverPath = path.join(rootDir, 'core', 'SOVEREIGN_SERVER.js');

    // 1. Launch Imperial Server
    console.log("[1] Launching Imperial Server...");
    const server = spawn('node', [serverPath], {
        cwd: rootDir,
        env: { ...process.env, GHOST_DEBUG: '1' }
    });

    server.stdout.on('data', (data) => console.log(`[STDOUT] ${data}`));
    server.stderr.on('data', (data) => console.error(`[STDERR] ${data}`));

    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for boot

    // 2. Unlock System
    console.log("[2] Attempting Secure Unlock...");
    const unlockRes = await fetch('http://localhost:3000/api/system/unlock', {
        method: 'POST',
        body: JSON.stringify({ passphrase: "FORGE_MASTER_2026" })
    });
    const unlockData = await unlockRes.json();
    if (unlockData.success) {
        console.log("✅ Imperial Handshake Established.");
    } else {
        console.error("[-] Unlock Failed.");
        server.kill();
        process.exit(1);
    }

    // 3. Verify Swarm Status
    console.log("[3] Verifying Swarm Telemetry...");
    const swarmRes = await fetch('http://localhost:3000/api/swarm/status');
    const swarmData = await swarmRes.json();

    console.log(`[STATUS] Node ID: ${swarmData.nodeID}`);
    console.log(`[STATUS] Peers: ${swarmData.peers.length}`);

    if (swarmData.nodeID) {
        console.log("✅ Swarm Projection Logic Verified.");
    } else {
        console.error("[-] Swarm Telemetry missing Node ID.");
        server.kill();
        process.exit(1);
    }

    // 4. Verify HUD Integration
    console.log("[4] Checking EMPIRE_HUD for Swarm Hooks...");
    const hudPath = path.join(rootDir, 'core', 'EMPIRE_HUD.html');
    const hudContent = fs.readFileSync(hudPath, 'utf8');
    if (hudContent.includes('loadSwarm') && hudContent.includes('swarmPane')) {
        console.log("✅ EMPIRE_HUD Synthesis Verified.");
    } else {
        console.error("[-] EMPIRE_HUD missing Swarm components.");
        server.kill();
        process.exit(1);
    }

    console.log("==========================================");
    console.log("    ✅ IMPERIAL COMMAND VERIFIED        ");
    console.log("==========================================");

    server.kill();
    process.exit(0);
}

// Fetch polyfill if needed (Node 18+ has it)
if (!global.fetch) {
    const http = require('http');
    global.fetch = (url, options = {}) => {
        return new Promise((resolve, reject) => {
            const req = http.request(url, options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        json: () => Promise.resolve(JSON.parse(data)),
                        text: () => Promise.resolve(data)
                    });
                });
            });
            req.on('error', reject);
            if (options.body) req.write(options.body);
            req.end();
        });
    };
}

testImperialCommand().catch(err => {
    console.error("Test Error:", err);
    process.exit(1);
});
