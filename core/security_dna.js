"use strict";

const crypto = require('crypto');
const os = require('os');

/**
 * DNA LOCK v4.0 [PRODUCT_HARDENING]
 * Binds ForgeCore logic to the physical machine.
 */

const DNALock = {
    getMachineID() {
        // [HARDENED] Filter out Virtual, Docker, and Loopback interfaces
        const interfaces = os.networkInterfaces();
        const macs = Object.entries(interfaces)
            .filter(([name, _]) => !name.toLowerCase().includes('vethernet') && !name.toLowerCase().includes('docker') && !name.toLowerCase().includes('pseudo'))
            .map(([_, ifaces]) => ifaces)
            .flat()
            .filter(i => !i.internal && i.mac && i.mac !== '00:00:00:00:00:00')
            .map(i => i.mac);

        // [HARDENED] Static CPU Model (ignoring volatile speed)
        const cpu = os.cpus()[0].model;

        // [HARDENED] Capture Drive Serial (if available)
        let volSerial = '';
        try {
            volSerial = require('child_process').execSync('wmic diskdrive get serialnumber', { stdio: 'pipe' }).toString().replace(/\\s/g, '').trim();
        } catch (e) { /* Ignore error on unsupported platforms */ }

        const rawDNA = `${cpu}|${macs.sort().join('|')}|${volSerial}`;
        return crypto.createHash('sha256').update(rawDNA).digest('hex');
    },

    verify(storedSeal) {
        const currentDNA = this.getMachineID();
        return currentDNA === storedSeal;
    }
};

module.exports = DNALock;
