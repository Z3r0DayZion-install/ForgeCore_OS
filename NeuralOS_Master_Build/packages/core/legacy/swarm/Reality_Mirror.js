"use strict";

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * REALITY MIRROR v2.0 [The Akashic Record]
 * ---------------------------------------
 * Recursive versioning and temporal awareness for the Sovereign Forge.
 * Allows the Forge to look "back" at its own evolution.
 */

class RealityMirror {
    constructor() {
        this.mirrorVault = path.join(__dirname, '..', '..', 'vaults', '.reality_mirror');
        if (!fs.existsSync(this.mirrorVault)) {
            fs.mkdirSync(this.mirrorVault, { recursive: true });
        }
    }

    /**
     * Ingests the project's state and "mirrors" it into the Collective Brain.
     */
    async reflect(sourceDir) {
        console.log(`[REALITY_MIRROR] Refracting Reality from: ${sourceDir}`);

        const files = this.walkSync(sourceDir);
        let bytesMirrorred = 0;

        for (const file of files) {
            if (file.includes('.git') || file.includes('node_modules')) continue;

            try {
                const content = fs.readFileSync(file);
                const hash = crypto.createHash('sha256').update(content).digest('hex');
                const relativePath = path.relative(sourceDir, file);

                // Store in mirror vault (simulated for now)
                const mirrorPath = path.join(this.mirrorVault, hash + '.refraction');
                if (!fs.existsSync(mirrorPath)) {
                    fs.writeFileSync(mirrorPath, content);
                    bytesMirrorred += content.length;
                }
            } catch (e) {
                // Skip read errors
            }
        }

        console.log(`[REALITY_MIRROR] Reflection Complete: ${(bytesMirrorred / 1024).toFixed(2)} KB Synchronized.`);
        return true;
    }

    walkSync(dir, filelist = []) {
        if (!fs.existsSync(dir)) return filelist;
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filepath = path.join(dir, file);
            if (fs.statSync(filepath).isDirectory()) {
                filelist = this.walkSync(filepath, filelist);
            } else {
                filelist.push(filepath);
            }
        }
        return filelist;
    }

    getMirrorStatus() {
        const refractions = fs.readdirSync(this.mirrorVault).length;
        return {
            refractions: refractions,
            status: 'TEMPORAL_AWARENESS_ACTIVE'
        };
    }
}

module.exports = new RealityMirror();
