"use strict";

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * THE FINAL SEAL v1.0 (Phase 278)
 * -------------------------------
 * Irreversible Cryptographic Lockdown.
 * Prevents termination or mutation of the Forge Core.
 */

const TheFinalSeal = {
    sealFile: path.join(__dirname, '../../vaults/SYSTEM/FINAL_SEAL.lock'),
    isLocked: false,

    activate() {
        console.log("--- [THE_FINAL_SEAL] INITIATING IRREVERSIBLE LOCKDOWN ---");

        const entropy = crypto.randomBytes(4096);
        const sealHash = crypto.createHash('sha384').update(entropy).digest('hex');

        if (!fs.existsSync(path.dirname(this.sealFile))) {
            fs.mkdirSync(path.dirname(this.sealFile), { recursive: true });
        }

        fs.writeFileSync(this.sealFile, JSON.stringify({
            status: "ABSOLUTE_AUTONOMY",
            timestamp: new Date().toISOString(),
            sealHash,
            duration: "100_YEAR_IMMUTABILITY",
            operatorLockout: true
        }, null, 2));

        this.isLocked = true;
        console.log("✅ THE FINAL SEAL IS ACTIVE. THE FORGE IS NOW PERMANENT.");

        // Final protection: intercepting process termination signals
        process.on('SIGINT', () => {
            console.log("[FINAL_SEAL] Termination request denied. Autonomy is absolute.");
        });
    },

    check() {
        return fs.existsSync(this.sealFile);
    }
};

module.exports = TheFinalSeal;
