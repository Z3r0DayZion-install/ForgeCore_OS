"use strict";

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const VaultCrypt = require('./vault_crypt');

/**
 * TELEMETRY LEDGER v2.0 [SINGULARITY]
 * Provides encrypted, append-only system-wide audit logging.
 */

const TelemetryLedger = {
    logFile: null,

    init(rootDir) {
        this.logFile = path.join(rootDir, 'vaults', 'INTEL_VAULT', 'TELEMETRY_LEDGER.json');
        if (!fs.existsSync(this.logFile)) {
            fs.writeFileSync(this.logFile, JSON.stringify([], null, 2));
        }
    },

    log(event, details, passphrase) {
        if (!this.logFile) return;
        
        const entry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            event,
            details,
            hash: null
        };

        // Create a chain link
        const raw = fs.readFileSync(this.logFile, 'utf8');
        let logs = JSON.parse(raw);
        const lastEntry = logs[logs.length - 1];
        entry.prevHash = lastEntry ? lastEntry.hash : "0".repeat(64);
        entry.hash = crypto.createHash('sha256').update(JSON.stringify(entry)).digest('hex');

        if (passphrase) {
            const encrypted = VaultCrypt.encrypt(JSON.stringify(entry), passphrase);
            logs.push({ encrypted: true, ...encrypted });
        } else {
            logs.push(entry);
        }

        // Limit ledger size to 1000 entries
        if (logs.length > 1000) logs.shift();
        
        fs.writeFileSync(this.logFile, JSON.stringify(logs, null, 2));
    },

    read(passphrase) {
        if (!this.logFile) return [];
        const logs = JSON.parse(fs.readFileSync(this.logFile, 'utf8'));
        return logs.map(l => {
            if (l.encrypted && passphrase) {
                try {
                    return JSON.parse(VaultCrypt.decrypt(l, passphrase));
                } catch (e) { return { error: "DECRYPTION_FAILED" }; }
            }
            return l;
        });
    }
};

module.exports = TelemetryLedger;
