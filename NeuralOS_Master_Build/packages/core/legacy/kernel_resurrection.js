"use strict";

const fs = require('fs');
const path = require('path');
const SecurityAudit = require('./security_audit');

/**
 * KERNEL_RESURRECTION v1.0
 * Detects core corruption and restores from Gold-Seal history.
 */

const KernelResurrection = {
    verifyAndHeal(coreDir, historyDir) {
        console.log("[HEALER] Commencing Core Integrity Scan...");
        const files = fs.readdirSync(coreDir);
        let healed = 0;

        files.forEach(f => {
            const current = path.join(coreDir, f);
            const backup = path.join(historyDir, f);
            
            if (fs.existsSync(backup)) {
                const currentHash = fs.readFileSync(current, 'utf8');
                const backupHash = fs.readFileSync(backup, 'utf8');
                
                if (currentHash !== backupHash) {
                    console.warn(`[HEALER] Corruption detected in ${f}. Resurrecting...`);
                    fs.copyFileSync(backup, current);
                    healed++;
                }
            }
        });

        return healed;
    }
};

module.exports = KernelResurrection;
