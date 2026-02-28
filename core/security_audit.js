"use strict";

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * FORGECORE SECURITY AUDIT v1.0
 * Performs deep recursive integrity sealing of the platform core.
 */

const SecurityAudit = {
    seal(dir) {
        const hashes = [];
        const files = fs.readdirSync(dir);
        
        files.forEach(f => {
            const p = path.join(dir, f);
            const s = fs.statSync(p);
            if (s.isDirectory()) {
                if (f !== '.history' && f !== '.forge_history') {
                    hashes.push(this.seal(p));
                }
            } else {
                const content = fs.readFileSync(p);
                hashes.push(crypto.createHash('sha256').update(content).digest('hex'));
            }
        });
        
        return crypto.createHash('sha256').update(hashes.sort().join('|')).digest('hex');
    },

    verify(dir, storedHash) {
        return this.seal(dir) === storedHash;
    }
};

module.exports = SecurityAudit;
