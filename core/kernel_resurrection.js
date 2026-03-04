"use strict";

const crypto = require('crypto');
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
                const currentContent = fs.readFileSync(current);
                const backupContent = fs.readFileSync(backup);
                const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');
                const backupHash = crypto.createHash('sha256').update(backupContent).digest('hex');
                
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
