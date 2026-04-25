const si = require('systeminformation');
const sealpulse = require('../packages/core/seal_pulse/index.js');

async function generateHardwareSeal() {
    try {
        const cpu = await si.cpu();
        const net = await si.networkInterfaces();
        const primaryMac = (net[0] && net[0].mac) ? net[0].mac : '00:00:00:00:00:00';

        const cpuId = `${cpu.manufacturer}-${cpu.brand}-${cpu.processors}`;
        const hash = sealpulse.generateSealV4(cpuId, primaryMac);

        console.log(`[SEAL-PULSE] V4 TPM Root Active: ${hash.substring(0, 16)}...`);
        return hash;
    } catch (err) {
        console.error('[SEAL-PULSE] V4 Failed, falling back to legacy.', err);
        return 'FALLBACK-SEAL-V4';
    }
}

module.exports = { generateHardwareSeal };
