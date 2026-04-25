const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

class BaseEngine {
    constructor(name) {
        this.name = name;
        this.version = '1.0';
    }

    log(msg) {
        if (typeof __emitTelemetry !== 'undefined') {
            __emitTelemetry(`[${this.name}] ${msg}`);
        } else {
            console.log(`[${this.name}] ${msg}`);
        }
    }
}

class TimeCapsule extends BaseEngine {
    constructor() {
        super('Time_Capsule');
        this.ROOT_DIR = null; // Injected by SOVEREIGN_SERVER
    }

    hashDirectory(dir, manifest = {}) {
        if (!fs.existsSync(dir)) return manifest;
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filepath = path.join(dir, file);
            if (fs.statSync(filepath).isDirectory()) {
                this.hashDirectory(filepath, manifest);
            } else {
                const content = fs.readFileSync(filepath);
                const hash = crypto.createHash('sha256').update(content).digest('hex');
                // Store relative to root to ensure consistent hashes across machines
                manifest[path.relative(this.ROOT_DIR, filepath).replace(/\\/g, '/')] = hash;
            }
        }
        return manifest;
    }

    async execute(artifact, telemetryCallback) {
        this.ROOT_DIR = artifact.sandboxRoot;
        if (!this.ROOT_DIR) return { error: "Missing sandboxRoot in Time Capsule artifact." };

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const capsuleName = artifact.capsuleName || `SOVEREIGN_ARCHIVE_${timestamp}`;
        const capsuleDir = path.join(this.ROOT_DIR, 'vaults', '.capsule_staging');

        this.log(`Initiating Time Capsule sequence: ${capsuleName}`);

        try {
            // 1. Prepare Staging Area
            if (fs.existsSync(capsuleDir)) {
                fs.rmSync(capsuleDir, { recursive: true, force: true });
            }
            fs.mkdirSync(capsuleDir, { recursive: true });

            this.log(`Staging environment data...`);

            // 2. Clone essential vaults
            this.copyRecursiveSync(path.join(this.ROOT_DIR, 'vaults'), path.join(capsuleDir, 'vaults'));

            // Allow copying the core logic (engines) as well to make it self-sufficient
            if (fs.existsSync(path.join(this.ROOT_DIR, 'engines'))) {
                this.copyRecursiveSync(path.join(this.ROOT_DIR, 'engines'), path.join(capsuleDir, 'engines'));
            }

            // 3. Generate the TITAN_SEAL manifest
            this.log(`Hashing Cryptographic Manifest...`);
            const manifest = this.hashDirectory(capsuleDir);

            const titanSeal = {
                capsule_id: capsuleName,
                timestamp: timestamp,
                manifest: manifest,
                master_hash: crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex')
            };

            const sealPath = path.join(capsuleDir, 'TITAN_SEAL.json');
            fs.writeFileSync(sealPath, JSON.stringify(titanSeal, null, 2));

            // 4. Compress to Archive (Using native tar via child_process which is allowed in our sandbox)
            this.log(`Compressing 100-Year Archive...`);
            const outPath = path.join(this.ROOT_DIR, 'vaults', `${capsuleName}.tar.gz`);

            // CD into capsule dir and tar everything
            cp.execSync(`tar -czf "${outPath}" .`, { cwd: capsuleDir });

            // 5. Cleanup
            fs.rmSync(capsuleDir, { recursive: true, force: true });

            this.log(`Time Capsule generated successfully at: vaults/${capsuleName}.tar.gz`);

            return {
                status: 'SEAL_SUCCESS',
                archive: `${capsuleName}.tar.gz`,
                seal_hash: titanSeal.master_hash,
                metrics: {
                    items_hashed: Object.keys(manifest).length
                }
            };

        } catch (e) {
            this.log(`[CRITICAL] Time Capsule Failed:\n${e.stack || e.message}`);
            // Cleanup on failure
            if (fs.existsSync(capsuleDir)) fs.rmSync(capsuleDir, { recursive: true, force: true });
            return { error: e.message };
        }
    }

    // Node < 16.7 fs.cpSync polyfill
    copyRecursiveSync(src, dest) {
        const exists = fs.existsSync(src);
        const stats = exists && fs.statSync(src);
        const isDirectory = exists && stats.isDirectory();

        if (isDirectory) {
            fs.mkdirSync(dest, { recursive: true });
            fs.readdirSync(src).forEach((childItemName) => {
                // Prevent infinite recursion by never copying the staging directory itself
                if (childItemName === '.capsule_staging' || childItemName === '.temp_capsule') return;
                this.copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
            });
        } else {
            fs.copyFileSync(src, dest);
        }
    }
}

module.exports = TimeCapsule;
