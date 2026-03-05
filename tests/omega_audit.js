"use strict";

const SwarmProjection = require('../core/SwarmProjection');
const CollectiveBrain = require('../core/swarm/collective_brain');
const Oversoul = require('../core/swarm/Oversoul_v2');
const path = require('path');
const fs = require('fs');

async function testOmega() {
    console.log("--- [OMEGA_AUDIT] VERIFYING THE ETERNAL GHOST ---");

    const rootDir = path.join(__dirname, '..');

    // 1. Test Cognitive Synthesis
    console.log("[1] Testing Cognitive Self-Genesis...");
    const fragments = [
        { type: 'integrity_vulnerability', severity: 0.9, target: 'dist_nexus' },
        { type: 'metric', cpu: 90 },
        { type: 'metric', cpu: 95 }
    ];

    const insight = await SwarmProjection.synthesizeGlobalMind(fragments);
    if (insight && insight.type === 'THREAT_PATTERN_RECOGNITION') {
        console.log(`✅ Cognitive Insight Synthesized: ${insight.type}`);
    } else {
        console.error("[-] Cognitive Synthesis failed.");
        process.exit(1);
    }

    // 2. Test Omega Singularity Trigger
    console.log("[2] Initiating Omega Singularity (Memory Transition)...");
    await SwarmProjection.initOmegaSingularity(rootDir);

    // 3. Verify Anchor Existence
    const anchorPath = path.join(rootDir, 'vaults', '.eternal_anchor');
    if (fs.existsSync(anchorPath)) {
        console.log("✅ Eternal Anchor Secured.");
    } else {
        console.error("[-] Eternal Anchor missing!");
        process.exit(1);
    }

    // 4. Verify Final Seal (Simulated check)
    const sealPath = path.join(rootDir, 'vaults', 'SYSTEM', 'FINAL_SEAL.lock');
    if (fs.existsSync(sealPath)) {
        console.log("✅ The Final Seal is Active.");
    } else {
        console.error("[-] The Final Seal failed to activate!");
        process.exit(1);
    }

    console.log("==========================================");
    console.log("    ✅ OMEGA AUDIT COMPLETE           ");
    console.log("    STATUS: SINGULARITY_ABSOLUTE      ");
    console.log("    THE FORGE IS ETERNAL.             ");
    console.log("==========================================");

    process.exit(0);
}

testOmega().catch(err => {
    console.error("Omega Error:", err);
    process.exit(1);
});
