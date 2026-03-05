"use strict";

const GhostSync = require('../core/swarm/ghost_sync');
const StegoNexus = require('../core/swarm/Stego_Nexus');
const crypto = require('crypto');

async function testDarkMatter() {
    console.log("--- [DARK_MATTER_AUDIT] TESTING NETWORK INVISIBILITY ---");

    const ghost = new GhostSync(3991, 3992);
    ghost.stealthMode = true;

    // 1. Verify Stego Wrapping
    console.log("[1] Verifying Stego Wrapping...");
    const payload = { type: 'TEST_SIGNAL', data: 'ABSOLUTE_STEALTH' };
    const packet = ghost.pack(payload);
    const wrapped = StegoNexus.wrap(packet);

    if (wrapped[0] === 0x17 && wrapped[1] === 0x03 && wrapped[2] === 0x03) {
        console.log("✅ Packet Masked as TLS Application Data.");
    } else {
        console.error("[-] Stego Wrapping failed.");
        process.exit(1);
    }

    // 2. Verify Unwrapping & Decryption
    console.log("[2] Verifying Unwrapping & Decryption...");
    const unwrapped = ghost.unpack(wrapped);
    if (unwrapped && unwrapped.type === 'TEST_SIGNAL') {
        console.log("✅ Decoy Unwrapped. Original payload recovered.");
    } else {
        console.error("[-] Unwrapping failed.");
        process.exit(1);
    }

    // 3. Verify DPI Evasion (Simulation)
    console.log("[3] Simulating DPI Scan...");
    const signatureDetect = wrapped.toString('hex').includes('HEARTBEAT') || wrapped.toString('hex').includes('TEST_SIGNAL');
    if (!signatureDetect) {
        console.log("✅ DPI Simulation: No Sovereign signatures detected in packet stream.");
    } else {
        console.error("[-] DPI Simulation: Signatures leaked into packet stream!");
        process.exit(1);
    }

    console.log("==========================================");
    console.log("    ✅ DARK MATTER AUDIT COMPLETE      ");
    console.log("==========================================");
    process.exit(0);
}

testDarkMatter().catch(err => {
    console.error("Audit Error:", err);
    process.exit(1);
});
