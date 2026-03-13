"use strict";

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * THE ARCHITECT v1.0 [Imperial Edition]
 * -------------------------------------
 * Autonomous Code Evolution & Hardening Engine.
 */

class Architect {
    constructor() {
        this.backupDir = null;
        this.log = (msg) => console.log(`[ARCHITECT] ${msg}`);
    }

    init(rootDir) {
        this.backupDir = path.join(rootDir, '.snapshots', 'backups');
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
        this.log("Architect Engine Initialized. Mutation path: ACTIVE.");
    }

    /**
     * Transforms an insight into a code mutation.
     */
    async evolve(insight) {
        this.log(`Received Insight: ${insight.type}. Researching solutions...`);

        switch (insight.type) {
            case 'THREAT_PATTERN_RECOGNITION':
                return await this.applyHardening(insight);
            case 'ANOMALY_DETECTION':
                return await this.applyJitterBoost(insight);
            default:
                this.log(`No mutation mapped for insight type: ${insight.type}`);
                return false;
        }
    }

    async applyHardening(insight) {
        this.log("Action: GLOBAL_HARDENING. Increasing security thresholds...");
        // Logic to modify config or code artifacts
        const configPath = path.join(__dirname, '..', 'config.json');
        return this.mutate(configPath, (content) => {
            const config = JSON.parse(content);
            config.security.integrityCheck = true;
            config.security.authEnabled = true;
            return JSON.stringify(config, null, 2);
        });
    }

    async applyJitterBoost(insight) {
        this.log("Action: JITTER_BOOST. Hardening timing defense...");
        const dnaPath = path.join(__dirname, '..', 'security_dna.js');
        return this.mutate(dnaPath, (content) => {
            if (content.includes('JITTER_BOOST_ACTIVE')) return content; // Already boosted

            // Inject jitter constant and a dummy delay in verify
            const injectedContent = content.replace('const DNALock = {', 'const JITTER_BOOST_ACTIVE = true;\n\nconst DNALock = {')
                .replace('verify(storedSeal) {', 'async verify(storedSeal) {\n        await new Promise(r => setTimeout(r, Math.random() * 50));');
            return injectedContent;
        });
    }

    /**
     * Safely mutates a file with rollback support.
     */
    mutate(filePath, transformer) {
        try {
            if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

            const content = fs.readFileSync(filePath, 'utf8');
            const newContent = transformer(content);

            if (content === newContent) {
                this.log(`Mutation skipped: No change for ${path.basename(filePath)}`);
                return true;
            }

            // Create Backup
            const timestamp = Date.now();
            const backupPath = path.join(this.backupDir, `${path.basename(filePath)}.${timestamp}.bak`);
            fs.writeFileSync(backupPath, content);

            // Apply Mutation
            fs.writeFileSync(filePath, newContent);
            this.log(`✅ Mutation Applied: ${path.basename(filePath)} (Backup: ${path.basename(backupPath)})`);

            return true;
        } catch (e) {
            this.log(`[-] Mutation Failed: ${e.message}`);
            return false;
        }
    }

    rollback(filePath) {
        this.log(`Attempting rollback for ${path.basename(filePath)}...`);
        const files = fs.readdirSync(this.backupDir)
            .filter(f => f.startsWith(path.basename(filePath)))
            .sort((a, b) => b.split('.').reverse()[1] - a.split('.').reverse()[1]);

        if (files.length === 0) {
            this.log("[-] No backup found for rollback.");
            return false;
        }

        const latestBackup = path.join(this.backupDir, files[0]);
        const content = fs.readFileSync(latestBackup, 'utf8');
        fs.writeFileSync(filePath, content);
        this.log(`✅ Rollback Successful: ${path.basename(filePath)} restored from ${files[0]}`);
        return true;
    }
}

module.exports = new Architect();
