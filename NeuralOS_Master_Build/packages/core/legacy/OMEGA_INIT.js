"use strict";

const path = require('path');
const IntentFirewall = require('./intent_firewall');
const OmegaBrokers = require('./omega_brokers');
const TEAR_Engine = require('./TEAR_Engine');
const DNALock = require('./security_dna');

/**
 * OMEGA_INIT — One-line Security Kernel Boot
 * Usage: const omega = require('./OMEGA_INIT').boot(__dirname);
 */
const OMEGA_INIT = {
    boot(coreDir) {
        const rootDir = path.join(coreDir, '..');
        const tearEngine = new TEAR_Engine(rootDir, DNALock);
        const firewall = new IntentFirewall(rootDir, tearEngine);
        const brokers = new OmegaBrokers(firewall);

        console.log(`[OMEGA] Security Kernel v3.0.0-Quantum Booted.`);
        console.log(`[TEAR] Audit Chain length: ${tearEngine.getChain().length}`);
        
        return {
            brokers,
            firewall,
            tear: tearEngine,
            dna: DNALock
        };
    }
};

module.exports = OMEGA_INIT;
