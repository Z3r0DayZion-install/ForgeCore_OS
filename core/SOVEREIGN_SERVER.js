"use strict";

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');
const os = require('os');
const DNALock = require('./security_dna');
const SecurityAudit = require('./security_audit');
const VaultCrypt = require('./vault_crypt');
const Lazarus = require('./lazarus');
const KernelResurrection = require('./kernel_resurrection');
const TelemetryLedger = require('./telemetry_ledger');

/**
 * FORGECORE™ OS // v2.0 IMMORTAL EDITION [SINGULARITY-PRIME]
 * --------------------------------------
 * DESIGNED FOR 20-YEAR PERSISTENCE.
 */

const CONFIG_PATH = path.join(__dirname, 'config.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const CORE_DIR = __dirname;
const ROOT_DIR = path.join(CORE_DIR, '..');
const VAULT_DIR = path.join(ROOT_DIR, 'vaults');
const GOLD_SEAL_DIR = path.join(ROOT_DIR, 'vaults', 'INTEL_VAULT', 'SEAL');

// 0. BOOT SEQUENCE
TelemetryLedger.init(ROOT_DIR);
if (fs.existsSync(GOLD_SEAL_DIR)) {
    const repairedCount = KernelResurrection.verifyAndHeal(CORE_DIR, GOLD_SEAL_DIR);
    if (repairedCount > 0) {
        console.log(`[RESURRECTOR] ${repairedCount} core artifacts restored.`);
        TelemetryLedger.log("KERNEL_RESURRECTION", { repairedCount });
    }
}
TelemetryLedger.log("SYSTEM_BOOT", { version: Lazarus.version, codename: "Singularity-Prime" });

// 1. PHYSICAL DNA FUSION
const machineID = DNALock.getMachineID();
if (!CONFIG.security.dnaSeal) {
    CONFIG.security.dnaSeal = machineID;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(CONFIG, null, 2));
} else if (CONFIG.security.dnaSeal !== machineID) {
    console.error("[CRITICAL] DNA_VIOLATION.");
    process.exit(1);
}

// 2. CORE INTEGRITY SEAL
const CORE_HASH = SecurityAudit.seal(CORE_DIR);
console.log(`[IMMORTAL] CORE_SEAL: ${CORE_HASH.substring(0, 16)}`);

let sessionPassphrase = null;
let failedAttempts = 0;
let GHOST_MODE = false;

// SHADOW MASKING MAP
const SHADOW_MAP = {
    "system_logs": "INTEL_VAULT",
    "temp_cache": "RELEASE_VAULT",
    "old_updates": "CHAT_VAULT",
    "utility_dump": "UTILITY_VAULT"
};

const DECOY_VAULTS = {
    "user_backups": ["photos_2024.zip", "taxes_v3.pdf", "resume_final.docx"],
    "temp_cache": ["session_001.tmp", "cache_manifest.log"],
    "downloads": ["manual.pdf", "installer.exe"]
};

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:3000`);
    res.setHeader('Access-Control-Allow-Origin', '*');

    const clientIP = req.connection.remoteAddress || req.socket.remoteAddress;

    // Phase 12: Proof-of-Integrity (PoI)
    // Require callers to solve a SHA-256 partial collision (e.g. hash starts with '000')
    const verifyPoI = (targetHash, nonce) => {
        const attempt = crypto.createHash('sha256').update(targetHash + nonce).digest('hex');
        return attempt.startsWith('000'); // Tune difficulty here
    };

    // [API] Final Handshake
    if (url.pathname === '/api/handshake') {
        const target = url.searchParams.get('target');
        const nonce = url.searchParams.get('nonce');

        // If connecting without a solved PoI, issue a random challenge target
        if (!target || !nonce || !verifyPoI(target, nonce)) {
            const newTarget = crypto.randomBytes(8).toString('hex');
            res.writeHead(401);
            return res.end(JSON.stringify({
                status: "CHALLENGE",
                target: newTarget,
                difficulty: "000"
            }));
        }

        return res.end(JSON.stringify({
            status: GHOST_MODE ? "DECOY_ACTIVE" : (sessionPassphrase ? "AUTHORIZED" : "LOCKED"),
            seal: GHOST_MODE ? "CORRUPTED" : CORE_HASH.substring(0, 16),
            version: Lazarus.version
        }));
    }

    // [API] Hardware Health
    if (url.pathname === '/api/hw') {
        const load = os.loadavg()[0];
        const cpuUsage = Math.min(100, (load * 10).toFixed(1));
        return res.end(JSON.stringify({ cpu: cpuUsage, locked: GHOST_MODE || !DNALock.verify(CONFIG.security.dnaSeal) }));
    }

    // [API] Peer Discovery
    if (url.pathname === '/api/peers') {
        if (GHOST_MODE) return res.end(JSON.stringify([{ id: "UPDATE_SERVER", host: "127.0.0.1", port: 8080, status: "ACTIVE" }]));
        return res.end(JSON.stringify(CONFIG.peers || []));
    }

    // [API] System Timeline
    if (url.pathname === '/api/system/timeline') {
        if (!sessionPassphrase || GHOST_MODE) { res.writeHead(401); return res.end("LOCKED"); }
        const timeline = [];
        const vaults = fs.readdirSync(VAULT_DIR);
        vaults.forEach(v => {
            const vPath = path.join(VAULT_DIR, v);
            if (fs.statSync(vPath).isDirectory()) {
                const files = fs.readdirSync(vPath);
                files.forEach(f => {
                    const fPath = path.join(vPath, f);
                    const s = fs.statSync(fPath);
                    if (!s.isDirectory()) {
                        timeline.push({ vault: v, file: f, mtime: s.mtime, size: (s.size / 1024).toFixed(2) + ' KB' });
                    }
                });
            }
        });
        timeline.sort((a, b) => b.mtime - a.mtime);
        return res.end(JSON.stringify(timeline.slice(0, 20)));
    }

    // [API] Telemetry Ledger Read
    if (url.pathname === '/api/system/ledger') {
        if (!sessionPassphrase || GHOST_MODE) { res.writeHead(401); return res.end("LOCKED"); }
        return res.end(JSON.stringify(TelemetryLedger.read(sessionPassphrase)));
    }

    // [API] Secure Unlock
    if (url.pathname === '/api/system/unlock') {
        let body = ''; req.on('data', c => body += c);
        req.on('end', () => {
            const { passphrase } = JSON.parse(body);
            // Master Key Verification
            if (passphrase === "FORGE_MASTER_2026") {
                sessionPassphrase = passphrase;
                failedAttempts = 0;
                GHOST_MODE = false;
                TelemetryLedger.log("SYSTEM_UNLOCK", { success: true });
                res.end(JSON.stringify({ success: true }));
            } else {
                failedAttempts++;
                TelemetryLedger.log("AUTH_FAILURE", { attempt: failedAttempts });
                if (failedAttempts >= 3) GHOST_MODE = true;
                res.writeHead(401);
                res.end(JSON.stringify({ success: false, ghost: GHOST_MODE }));
            }
        });
        return;
    }

    // [API] Command Execution
    if (url.pathname === '/api/system/execute') {
        if (!sessionPassphrase || GHOST_MODE) { res.writeHead(401); return res.end("DENIED"); }
        let body = ''; req.on('data', c => body += c);
        req.on('end', async () => {
            const { command, args } = JSON.parse(body);
            TelemetryLedger.log("COMMAND_EXEC", { command, args }, sessionPassphrase);
            try {
                let output = "";
                if (command === "resurrect") {
                    const count = KernelResurrection.verifyAndHeal(CORE_DIR, GOLD_SEAL_DIR);
                    output = `[HEALER] Restored ${count} artifacts.`;
                } else if (command === "audit") {
                    output = `[AUDITOR] Current Core Seal: ${SecurityAudit.seal(CORE_DIR)}`;
                } else if (command === "hotload") {
                    const artifact = fs.readFileSync(path.join(VAULT_DIR, 'UTILITY_VAULT', args[0]), 'utf8');
                    const result = await Lazarus.process(artifact, (a) => eval(a));
                    output = `[LAZARUS] Hot-load result: ${JSON.stringify(result.result)}`;
                } else {
                    output = `[ERR] Unknown command: ${command}`;
                }
                res.end(JSON.stringify({ output }));
            } catch (e) { res.end(JSON.stringify({ output: `[ERR] ${e.message}` })); }
        });
        return;
    }

    // [API] Settings Management
    if (url.pathname === '/api/system/settings') {
        if (req.method === 'POST') {
            let body = ''; req.on('data', c => body += c);
            req.on('end', () => {
                const newSettings = JSON.parse(body);
                Object.assign(CONFIG.ui, newSettings);
                fs.writeFileSync(CONFIG_PATH, JSON.stringify(CONFIG, null, 2));
                res.end(JSON.stringify({ success: true }));
            });
        } else {
            return res.end(JSON.stringify(CONFIG.ui));
        }
        return;
    }

    // [API] I/O
    if (url.pathname === '/api/list') {
        let v = url.searchParams.get('vault') || '';
        if (GHOST_MODE) {
            const files = (DECOY_VAULTS[v] || DECOY_VAULTS["user_backups"]).map(f => ({ name: f, size: "1.2 MB", isDir: false }));
            return res.end(JSON.stringify(files));
        }
        if (CONFIG.ui.shadowMask && SHADOW_MAP[v]) v = SHADOW_MAP[v];
        const target = path.join(VAULT_DIR, v);
        if (!target.startsWith(VAULT_DIR)) { res.writeHead(403); return res.end("FORBIDDEN"); }
        try {
            const files = fs.readdirSync(target).map(f => {
                const s = fs.statSync(path.join(target, f));
                return { name: f, size: (s.size / 1024).toFixed(2) + ' KB', isDir: s.isDirectory() };
            });
            return res.end(JSON.stringify(files));
        } catch (e) { res.writeHead(404); res.end("NOT_FOUND"); }
        return;
    }

    if (url.pathname === '/api/raw') {
        if (!sessionPassphrase) { res.writeHead(401); return res.end("LOCKED"); }
        if (GHOST_MODE) return res.end(crypto.randomBytes(1024)); // Tier 3: Holographic Noise
        let reqPath = url.searchParams.get('path') || '';
        if (CONFIG.ui.shadowMask) {
            for (const [mask, real] of Object.entries(SHADOW_MAP)) {
                if (reqPath.startsWith(`vaults/${mask}`)) reqPath = reqPath.replace(`vaults/${mask}`, `vaults/${real}`);
            }
        }
        const p = path.join(ROOT_DIR, reqPath);
        if (!p.startsWith(ROOT_DIR)) { res.writeHead(403); return res.end("FORBIDDEN"); }
        try {
            // Tier 3: Direct Buffer I/O for VaultCrypt
            if (reqPath.includes('/vaults/')) {
                const encryptedBuf = fs.readFileSync(p);
                return res.end(VaultCrypt.decrypt(encryptedBuf, sessionPassphrase));
            }
            const raw = fs.readFileSync(p, 'utf8');
            return res.end(raw);
        } catch (e) { res.end("FAIL"); }
        return;
    }

    if (url.pathname === '/api/save') {
        if (!sessionPassphrase || GHOST_MODE) { res.writeHead(401); return res.end("LOCKED"); }
        let body = ''; req.on('data', c => body += c);
        req.on('end', () => {
            let { path: reqPath, content } = JSON.parse(body);
            if (CONFIG.ui.shadowMask) {
                for (const [mask, real] of Object.entries(SHADOW_MAP)) {
                    if (reqPath.startsWith(`vaults/${mask}`)) reqPath = reqPath.replace(`vaults/${mask}`, `vaults/${real}`);
                }
            }
            const p = path.join(ROOT_DIR, reqPath);
            if (!p.startsWith(ROOT_DIR)) { res.writeHead(403); return res.end("FORBIDDEN"); }
            try {
                // Tier 3: Buffer writing for Holographic encryption
                // Use the absolute path `p` to check if it's going into the vaults, overcoming any mask bypass
                if (p.includes('vaults')) {
                    const encryptedBuf = VaultCrypt.encrypt(content, sessionPassphrase);
                    fs.writeFileSync(p, encryptedBuf, { encoding: null }); // Force binary write
                } else {
                    fs.writeFileSync(p, content, 'utf8');
                }
                res.end(JSON.stringify({ success: true }));
            } catch (e) { res.writeHead(500); res.end("FAIL"); }
        });
        return;
    }

    // Static Assets
    let filePath = path.join(CORE_DIR, url.pathname === '/' ? 'EMPIRE_HUD.html' : url.pathname);
    if (!filePath.startsWith(CORE_DIR)) filePath = path.join(ROOT_DIR, url.pathname);
    if (!filePath.startsWith(CORE_DIR) && !filePath.startsWith(ROOT_DIR)) { res.writeHead(403); return res.end("FORBIDDEN"); }

    fs.readFile(filePath, (err, content) => {
        if (err) { res.writeHead(404); res.end(); }
        else {
            const ext = path.extname(filePath).toLowerCase();
            const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
            res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
            res.end(content);
        }
    });
});

server.listen(3000, '127.0.0.1', () => {
    console.log(`[SINGULARITY] ForgeCore v2.0.0 Running at http://localhost:3000`);
});
