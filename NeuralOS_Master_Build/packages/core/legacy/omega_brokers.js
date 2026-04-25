"use strict";

const fs = require('fs');
const { exec, spawn } = require('child_process');

/**
 * OMEGA_BROKERS Module
 * Capability brokers that enforce IntentFirewall policies before action.
 */
class OmegaBrokers {
    constructor(firewall) {
        this.firewall = firewall;
    }

    /**
     * FS_BROKER: Read a file
     */
    async readFile(entity, filePath, options = 'utf8') {
        const decision = this.firewall.evaluate({ entity, action: 'fs:read', resource: filePath });
        if (!decision.allowed) throw new Error(`OMEGA_FS_VIOLATION: ${decision.reason}`);
        
        return fs.readFileSync(filePath, options);
    }

    /**
     * FS_BROKER: Write a file
     */
    async writeFile(entity, filePath, content, options = 'utf8') {
        const decision = this.firewall.evaluate({ entity, action: 'fs:write', resource: filePath });
        if (!decision.allowed) throw new Error(`OMEGA_FS_VIOLATION: ${decision.reason}`);
        
        return fs.writeFileSync(filePath, content, options);
    }

    /**
     * EXEC_BROKER: Run a command
     */
    async spawn(entity, command, args, options = {}) {
        const decision = this.firewall.evaluate({ entity, action: 'exec:spawn', resource: command });
        if (!decision.allowed) throw new Error(`OMEGA_EXEC_VIOLATION: ${decision.reason}`);
        
        return spawn(command, args, options);
    }

    /**
     * EXEC_BROKER: Execute a command (Promise wrapper)
     */
    async exec(entity, command, options = {}) {
        // Extract command name for policy check (e.g., 'git' from 'git status')
        const cmdName = command.trim().split(' ')[0];
        const decision = this.firewall.evaluate({ entity, action: 'exec:spawn', resource: cmdName });
        if (!decision.allowed) throw new Error(`OMEGA_EXEC_VIOLATION: ${decision.reason}`);
        
        return new Promise((resolve, reject) => {
            exec(command, options, (error, stdout, stderr) => {
                if (error) reject(stderr || error.message);
                else resolve(stdout);
            });
        });
    }

    /**
     * CRYPTO_BROKER: Call Quantum Bridge
     */
    async callQuantum(entity, bridge, command, params) {
        const decision = this.firewall.evaluate({ entity, action: 'crypto:call', resource: command });
        if (!decision.allowed) throw new Error(`OMEGA_CRYPTO_VIOLATION: ${decision.reason}`);
        
        return await bridge.call(command, params);
    }
}

module.exports = OmegaBrokers;
