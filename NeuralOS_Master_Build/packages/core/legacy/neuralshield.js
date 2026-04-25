"use strict";

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const trustctl = require('./trustctl');

/**
 * NEURALSHIELD CLI v1.0
 * Handles signing and verification of ForgeCore™ manifests.
 */
const NeuralShield = {
    // Built-in Root Public Key for verification
    ROOT_PUBLIC_KEY: `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAFxlc+uXKRMXuujMUY35MvOgLglbgiWDx2T8nez6E8G0=
-----END PUBLIC KEY-----`,

    /**
     * Verify a manifest's signature and the integrity of its files using trustctl.
     */
    verify(manifestPath, rootDir) {
        console.log(`[NEURALSHIELD] Verifying manifest: ${manifestPath}`);
        
        const manifestStr = fs.readFileSync(manifestPath, 'utf8');
        const manifest = JSON.parse(manifestStr);
        
        if (!manifest.signature) {
            throw new Error("MANIFEST_UNSIGNED: No signature found in manifest.");
        }

        // 1. Verify Signature
        const signature = Buffer.from(manifest.signature, 'hex');
        const dataToVerify = JSON.stringify({
            version: manifest.version,
            timestamp: manifest.timestamp,
            files: manifest.files
        });

        const isVerified = crypto.verify(
            null,
            Buffer.from(dataToVerify),
            this.ROOT_PUBLIC_KEY,
            signature
        );

        if (!isVerified) {
            throw new Error("SIGNATURE_INVALID: Manifest signature verification failed.");
        }
        console.log("✅ SIGNATURE_VERIFIED: Manifest matches Architect Key.");

        // 2. Verify Files using trustctl Kernel
        const trustReport = trustctl.verifyBatch(manifest, rootDir);
        
        for (const file of trustReport.files) {
            if (file.status === 'OK') {
                console.log(`✅ VERIFIED: ${file.path}`);
            } else {
                console.error(`❌ ${file.status}: ${file.path} ${file.error || ''}`);
            }
        }

        if (!trustReport.valid) {
            throw new Error(`INTEGRITY_VIOLATION: Hardened verification failed.`);
        }

        console.log("🎯 ALL ARTIFACTS VERIFIED. System is safe.");
        return true;
    },

    /**
     * Sign a manifest with a private key.
     */
    sign(manifestPath, privateKeyPath) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

        const dataToSign = JSON.stringify({
            version: manifest.version,
            timestamp: manifest.timestamp,
            files: manifest.files
        });

        const signature = crypto.sign(
            null,
            Buffer.from(dataToSign),
            privateKey
        );

        manifest.signature = signature.toString('hex');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        console.log(`✅ SIGNED: Manifest signature added.`);
    }
};

// CLI entry point
if (require.main === module) {
    const args = process.argv.slice(2);
    const cmd = args[0];
    const target = args[1];

    try {
        if (cmd === 'verify') {
            const root = path.join(__dirname, '..');
            NeuralShield.verify(target, root);
        } else if (cmd === 'sign') {
            const key = args[2];
            if (!key) throw new Error("Missing private key path.");
            NeuralShield.sign(target, key);
        } else {
            console.log("Usage: node neuralshield.js verify <manifest.json>");
            console.log("       node neuralshield.js sign <manifest.json> <private.key>");
        }
    } catch (e) {
        console.error(`❌ ERROR: ${e.message}`);
        process.exit(1);
    }
}

module.exports = NeuralShield;
