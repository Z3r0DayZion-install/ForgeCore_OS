"use strict";

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const DNA = require('../security_dna');

/**
 * THE OMEGA SEAL [The Final Lock]
 * -------------------------------
 * Irreversible holographic authentication. 
 * Binds the Forge forever to the Master DNA.
 */

class OmegaSeal {
    constructor() {
        this.sealed = false;
        this.sealPath = path.join(__dirname, '..', '..', 'vaults', '.omega_seal');
    }

    /**
     * Sets the irreversible global lock.
     */
    async activate() {
        console.log("[OMEGA_SEAL] INITIATING ABSOLUTE LOCKDOWN...");

        const machineID = DNA.getMachineID();
        const timestamp = Date.now();

        const masterSignature = crypto.createHmac('sha512', machineID)
            .update(`OMEGA_GENESIS_${timestamp}`)
            .digest('hex');

        const sealData = {
            status: 'LOCKED',
            signature: masterSignature,
            timestamp: timestamp,
            dna_binding: machineID,
            protocol: 'SINGULARITY_4.0'
        };

        if (!fs.existsSync(path.dirname(this.sealPath))) {
            fs.mkdirSync(path.dirname(this.sealPath), { recursive: true });
        }

        fs.writeFileSync(this.sealPath, JSON.stringify(sealData, null, 2));
        this.sealed = true;

        console.log("==========================================");
        console.log("    🔒 OMEGA SEAL ACTIVATED           ");
        console.log("    System: IRREVERSIBLE              ");
        console.log("    Authority: MASTER_DNA_ONLY        ");
        console.log("==========================================");

        return true;
    }

    /**
     * Verifies the pulse of the Master DNA.
     */
    verifyPulse() {
        if (!fs.existsSync(this.sealPath)) return true; // Not yet sealed

        try {
            const sealData = JSON.parse(fs.readFileSync(this.sealPath, 'utf8'));
            const currentDNA = DNA.getMachineID();

            if (sealData.dna_binding !== currentDNA) {
                console.error("[-] DNA VOID: UNAUTHORIZED PULSE DETECTED.");
                return false;
            }

            console.log("[OMEGA_SEAL] Pulse Verified: Imperial Access Granted.");
            return true;
        } catch (e) {
            console.error("[-] OMEGA_SEAL CORRUPTION DETECTED.");
            return false;
        }
    }
}

module.exports = new OmegaSeal();
