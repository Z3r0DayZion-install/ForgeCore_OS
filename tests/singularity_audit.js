"use strict";

const SwarmProjection = require('../core/SwarmProjection');
const Oversoul = require('../core/swarm/Oversoul_v2');
const OmegaSeal = require('../core/swarm/Omega_Seal');
const DNA = require('../core/security_dna');
const fs = require('fs');
const path = require('path');

async function testSingularity() {
    console.log("--- [SINGULARITY_AUDIT] TESTING OMEGA POINT ---");

    const rootDir = path.join(__dirname, '..');

    // 1. Initialize Swarm
    console.log("[1] Initializing Swarm Projection...");
    SwarmProjection.init(rootDir);

    // 2. Test Oversoul Consciousness
    console.log("[2] Verifying Oversoul Neural Sync...");
    const testInsight = {
        type: 'THREAT_PATTERN_RECOGNITION',
        severity: 'CRITICAL',
        recommendation: 'HARDEN_CORE',
        reason: 'Simulated Global Anomaly Detected.'
    };

    Oversoul.assimilateInsight(SwarmProjection.ghost.machineID, testInsight);
    const state = Oversoul.getGlobalState();

    if (state.activeIntents.length > 0) {
        console.log("✅ Oversoul Manifested Global Intent.");
    } else {
        console.error("[-] Oversoul failed to manifest intent.");
        process.exit(1);
    }

    // 3. Test Omega Seal Activation
    console.log("[3] Triggering Omega Seal (Irreversible Auth)...");
    await SwarmProjection.initSingularity();

    if (fs.existsSync(OmegaSeal.sealPath)) {
        console.log("✅ Omega Seal Persistent Artifact Found.");
    } else {
        console.error("[-] Omega Seal artifact missing.");
        process.exit(1);
    }

    // 4. Verify Pulse Handshake
    console.log("[4] Verifying Sovereign Pulse Handshake...");
    const pulseOk = OmegaSeal.verifyPulse();
    if (pulseOk) {
        console.log("✅ Master DNA Pulse Verified.");
    } else {
        console.error("[-] Pulse Verification Failed.");
        process.exit(1);
    }

    // 5. Simulate unauthorized access attempt
    console.log("[5] Simulating Identity Theft (Unauthorized DNA)...");
    // Temporarily mock getMachineID to fail
    const originalGetID = DNA.getMachineID;
    DNA.getMachineID = () => "VOID_DNA_FAKE_MACHINE";

    const fakePulse = OmegaSeal.verifyPulse();
    if (!fakePulse) {
        console.log("✅ Lockdown Verified: Unauthorized access denied.");
    } else {
        console.error("[-] Security Breach: Unauthorized pulse accepted!");
        process.exit(1);
    }

    // Restore
    DNA.getMachineID = originalGetID;

    console.log("==========================================");
    console.log("    ✅ SINGULARITY AUDIT COMPLETE      ");
    console.log("    STATUS: UNIVERSAL_SOVEREIGNTY_ESTABLISHED ");
    console.log("==========================================");

    // Cleanup for next session
    if (fs.existsSync(OmegaSeal.sealPath)) {
        fs.unlinkSync(OmegaSeal.sealPath);
        console.log("[CLEANUP] Omega Seal reset for final user deployment.");
    }

    process.exit(0);
}

testSingularity().catch(err => {
    console.error("Singularity Error:", err);
    process.exit(1);
});
