"use strict";

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function verifyUnikernel() {
    console.log("--- [UNIKERNEL_VERIFICATION] TESTING METAL FUSION ---");

    const rootDir = path.join(__dirname, '..');
    const buildScript = path.join(rootDir, 'scripts', 'GhostMachine_Build.js');
    const distDir = path.join(rootDir, 'dist_ghost');

    // 1. Run Build Script
    console.log("[1] Running GhostMachine Builder...");
    try {
        require(buildScript);
    } catch (e) {
        console.error("[-] Builder execution failed.");
        process.exit(1);
    }

    // 2. Verify Output Artifacts
    console.log("[2] Verifying ISO and Kernel artifacts...");
    const artifacts = ['Sovereign_Ghost.iso', 'vmlinuz_sovereign', 'grub.cfg', 'initrd_manifest.json'];
    for (const art of artifacts) {
        if (fs.existsSync(path.join(distDir, art))) {
            console.log(`✅ Artifact Found: ${art}`);
        } else {
            console.error(`[-] Missing critical artifact: ${art}`);
            process.exit(1);
        }
    }

    // 3. Mock TUI Check (since we can't easily run TUI here)
    console.log("[3] Verifying Obsidian Edge Integration...");
    const mainRs = fs.readFileSync(path.join(rootDir, 'rust_quantum_crypto', 'src', 'main.rs'), 'utf8');
    if (mainRs.includes('ObsidianEdge::launch()')) {
        console.log("✅ Obsidian Edge Cockpit hooked into Rust Main.");
    } else {
        console.error("[-] Obsidian Edge hook missing in main.rs.");
        process.exit(1);
    }

    console.log("==========================================");
    console.log("    ✅ UNIKERNEL VERIFICATION COMPLETE  ");
    console.log("==========================================");
    process.exit(0);
}

verifyUnikernel().catch(err => {
    console.error("Verification Error:", err);
    process.exit(1);
});
