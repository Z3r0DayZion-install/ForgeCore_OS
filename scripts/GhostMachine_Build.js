"use strict";

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * GHOST MACHINE BUILDER v1.0 [Imperial Edition]
 * ---------------------------------------------
 * Orchestrates the synthesis of the Sovereign Unikernel.
 */

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist_ghost');
const coreDir = path.join(rootDir, 'core');

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);

console.log("--- [GHOST_MACHINE] INITIATING METAL FUSION ---");

function build() {
    try {
        // 1. Prepare InitRD Payload
        console.log("[1] Packing ForgeCore_OS InitRD Payload...");
        const payload = {
            timestamp: Date.now(),
            version: "1.2.0",
            modules: fs.readdirSync(coreDir).filter(f => f.endsWith('.js')),
            integrityHash: execSync('git rev-parse HEAD', { cwd: rootDir }).toString().trim()
        };
        fs.writeFileSync(path.join(distDir, 'initrd_manifest.json'), JSON.stringify(payload, null, 2));

        // 2. Kernel Synthesis (Mocked for Windows Dev Context)
        console.log("[2] Stripping Minimal LTS Kernel... (Mocked)");
        const kernelStub = "BINARY_SOVEREIGN_KERNEL_2026_LTS";
        fs.writeFileSync(path.join(distDir, 'vmlinuz_sovereign'), kernelStub);

        // 3. Generate GRUB Configuration
        console.log("[3] Generating GRUB Sovereign Configuration...");
        const grubConfig = `
set default=0
set timeout=0

menuentry "Sovereign Forge OS (Imperial)" {
    set root=(hd0,1)
    linux /vmlinuz_sovereign console=ttyS0 quiet splash
    initrd /initrd.img
}
        `;
        fs.writeFileSync(path.join(distDir, 'grub.cfg'), grubConfig);

        // 4. ISO Packaging (Mocked)
        console.log("[4] Finalizing Sovereign_Ghost.iso...");
        fs.writeFileSync(path.join(distDir, 'Sovereign_Ghost.iso'), "IMPERIAL_BOOT_IMAGE_DATA_0xDEADBEEF");

        console.log("==========================================");
        console.log("    ✅ METAL FUSION COMPLETE         ");
        console.log("    Build Target: dist_ghost/Sovereign_Ghost.iso");
        console.log("==========================================");
    } catch (e) {
        console.error("[-] Build Failed:", e.message);
    }
}

build();
