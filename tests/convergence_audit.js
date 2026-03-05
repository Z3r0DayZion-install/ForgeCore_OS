"use strict";

const MetaOrchestrator = require('../core/swarm/Meta_Orchestrator');
const RealityMirror = require('../core/swarm/Reality_Mirror');
const SwarmProjection = require('../core/SwarmProjection');
const fs = require('fs');
const path = require('path');

async function testConvergence() {
    console.log("--- [CONVERGENCE_AUDIT] TESTING META-SOVEREIGNTY ---");

    const rootDir = path.join(__dirname, '..');

    // 1. Verify Engine Merge
    console.log("[1] Verifying Meta-Engine Merge...");
    const engines = [
        'Resource_Scavenger.js',
        'Medic.js',
        'Propagator.js',
        'Time_Capsule.js',
        'Reality_Mirror.js',
        'Meta_Orchestrator.js',
        'Swarm_Orchestrator.js'
    ];

    for (const engine of engines) {
        if (fs.existsSync(path.join(rootDir, 'core', 'swarm', engine))) {
            console.log(`✅ Engine Synthesized: ${engine}`);
        } else {
            console.error(`[-] Missing Meta-Engine: ${engine}`);
            process.exit(1);
        }
    }

    // 2. Test Meta-Orchestration
    console.log("[2] Verifying Global Scale-Up...");
    await MetaOrchestrator.scaleUp(5000);
    const state = MetaOrchestrator.getMetaState();
    if (state.nodes === 5000 && state.status === 'META_SOVEREIGNTY_ACTIVE') {
        console.log("✅ Meta-Orchestrator Scaling Verified.");
    } else {
        console.error("[-] Meta-Orchestrator state invalid.");
        process.exit(1);
    }

    // 3. Test Reality Mirroring
    console.log("[3] Verifying Recursive Intelligence (Reality Mirror)...");
    // Mirror the core directory as a test
    await RealityMirror.reflect(path.join(rootDir, 'core'));
    const mirrorStatus = RealityMirror.getMirrorStatus();
    if (mirrorStatus.refractions > 0) {
        console.log(`✅ Reality Mirror Active. ${mirrorStatus.refractions} Refrations Synchronized.`);
    } else {
        console.error("[-] Reality Mirror failed to ingest core.");
        process.exit(1);
    }

    // 4. Verify Event Horizon HUD Presence
    console.log("[4] Verifying Event Horizon HUD...");
    if (fs.existsSync(path.join(rootDir, 'core', 'swarm', 'EVENT_HORIZON.html'))) {
        console.log("✅ Event Horizon Cockpit Deployed.");
    } else {
        console.error("[-] Event Horizon HUD missing.");
        process.exit(1);
    }

    console.log("==========================================");
    console.log("    ✅ CONVERGENCE AUDIT COMPLETE      ");
    console.log("    STATUS: META_SOVEREIGNTY_ESTABLISHED ");
    console.log("==========================================");

    process.exit(0);
}

testConvergence().catch(err => {
    console.error("Convergence Error:", err);
    process.exit(1);
});
