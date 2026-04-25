"use strict";

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

/**
 * PROPAGATOR ENGINE v1.0 (The Fusion Protocol)
 * -------------------------------------------
 * Autonomous Self-Replication logic.
 * Packs the current Singularity Release and propagates it to authenticated peers.
 */

class Propagator {
    constructor() {
        this.log = (msg) => console.log(`[PROPAGATOR] ${msg}`);
        this.nexusDir = path.join(__dirname, '../dist_nexus');
        this.stageDir = path.join(__dirname, '../.propagation_staging');
    }

    async execute(params = {}) {
        this.log("Initiating Autonomous Propagation Protocol...");

        try {
            // 1. Verify Nexus Existence
            if (!fs.existsSync(this.nexusDir)) {
                throw new Error("Singularity Release (dist_nexus) not found. Run nexus_seal.js first.");
            }

            // 2. Prepare Staging
            if (fs.existsSync(this.stageDir)) fs.rmSync(this.stageDir, { recursive: true, force: true });
            fs.mkdirSync(this.stageDir, { recursive: true });

            // 3. Create Seeding Package (Universal Bundle)
            const bundleName = `Sovereign_Seed_${Date.now()}.tar.gz`;
            const bundlePath = path.join(this.stageDir, bundleName);

            this.log(`Packing universal seed: ${bundleName}...`);
            execSync(`tar -czf ${bundlePath} -C ${this.nexusDir} .`, { stdio: 'inherit' });

            // 4. Generate Propagation Manifest
            const manifest = {
                origin_dna: require('../core/security_dna').getMachineID(),
                timestamp: new Date().toISOString(),
                bundle_hash: crypto.createHash('sha256').update(fs.readFileSync(bundlePath)).digest('hex'),
                protocol_version: "FUSION_V1"
            };
            fs.writeFileSync(path.join(this.stageDir, 'PROPAGATION_MANIFEST.json'), JSON.stringify(manifest, null, 2));

            // 5. Secure Seeding (Mock Transmission)
            // In a real mesh, we would stream this bundle to peers discovered via GhostSync.
            const targetPeer = params.targetPeer || "VIRTUAL_MESH_PEER_01";
            this.log(`Seeding bundle to ${targetPeer}...`);

            // For now, we move the bundle to a 'seeds' vault for archival
            const seedsVault = path.join(__dirname, '../vaults/PROPAGATION_SEEDS');
            if (!fs.existsSync(seedsVault)) fs.mkdirSync(seedsVault, { recursive: true });

            fs.copyFileSync(bundlePath, path.join(seedsVault, bundleName));
            fs.copyFileSync(path.join(this.stageDir, 'PROPAGATION_MANIFEST.json'), path.join(seedsVault, `manifest_${bundleName}.json`));

            this.log("✅ Propagation Successful. Seed active in vaults.");

            // Cleanup Staging
            fs.rmSync(this.stageDir, { recursive: true, force: true });

            return {
                ok: true,
                bundle: bundleName,
                hash: manifest.bundle_hash
            };

        } catch (e) {
            this.log(`[CRITICAL] Propagation Failed: ${e.message}`);
            if (fs.existsSync(this.stageDir)) fs.rmSync(this.stageDir, { recursive: true, force: true });
            return { ok: false, error: e.message };
        }
    }
}

module.exports = new Propagator();
