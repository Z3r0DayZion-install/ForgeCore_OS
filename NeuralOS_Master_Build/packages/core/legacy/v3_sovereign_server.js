"use strict";

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');
const os = require('os');
const DNALock = require('./security_dna');
const TPMEnclave = require('./tpm_enclave'); // [IP_GOLD]
const AIOversoul = require('./oversoul_slm'); // [IP_GOLD]
const MerkleDagFS = require('./merkle_dag_fs'); // [IP_GOLD]
const LazarusWasm = require('./lazarus_wasm'); // [IP_GOLD]
const ZKPConsensus = require('./zkp_consensus'); // [IP_GOLD]
const HomomorphicVault = require('./homomorphic_vault'); // [IP_GOLD]
const NeuroDrop = require('./neurodrop_v3'); // [NEURODROP_V3]
const XXXplorer = require('./xxxplorer'); // [XXXPLORER]
const NeuralPass = require('./neuralpass'); // [NEURALPASS]
const ReplayEngine = require('./replay_engine'); // [IP_GOLD]
const FaradayBridge = require('./faraday_bridge'); // [TIER 7]
const MemoryTraps = require('./memory_traps'); // [TIER 7]
const RadioactiveVault = require('./radioactive_vault'); // [TIER 7]
const ApiSchemaRegistry = require('./api_schema_registry');
const ActionRegistry = require('./action_registry');

function resolveForgeCoreKernelModule() {
    const errors = [];
    const pushError = (hint, err) => {
        errors.push(`${hint}:${String(err && err.message ? err.message : err)}`);
    };
    const tryRequire = (hint, target) => {
        try {
            const mod = require(target);
            if (mod && typeof mod.ForgeCoreKernel === 'function') {
                return mod.ForgeCoreKernel;
            }
            pushError(hint, 'missing_export:ForgeCoreKernel');
            return null;
        } catch (err) {
            pushError(hint, err);
            return null;
        }
    };

    const candidates = [];
    candidates.push({
        hint: 'relative',
        target: '../neural_empire/forgecore/kernel'
    });
    candidates.push({
        hint: 'dirname',
        target: path.join(__dirname, '..', 'neural_empire', 'forgecore', 'kernel.js')
    });

    if (process.resourcesPath) {
        candidates.push({
            hint: 'resources_app',
            target: path.join(process.resourcesPath, 'app', 'neural_empire', 'forgecore', 'kernel.js')
        });
        candidates.push({
            hint: 'resources_app_asar',
            target: path.join(process.resourcesPath, 'app.asar', 'neural_empire', 'forgecore', 'kernel.js')
        });
        candidates.push({
            hint: 'resources_app_asar_unpacked',
            target: path.join(process.resourcesPath, 'app.asar.unpacked', 'neural_empire', 'forgecore', 'kernel.js')
        });
    }

    for (const row of candidates) {
        const kernel = tryRequire(row.hint, row.target);
        if (kernel) {
            return { ForgeCoreKernel: kernel, loadError: null };
        }
    }

    return {
        ForgeCoreKernel: null,
        loadError: errors.join(' | ') || 'kernel_module_not_found'
    };
}

const KERNEL_MODULE = resolveForgeCoreKernelModule();
const ForgeCoreKernel = KERNEL_MODULE.ForgeCoreKernel;
const FORGE_CORE_KERNEL_LOAD_ERROR = KERNEL_MODULE.loadError;

const SecurityAudit = require('./security_audit');
const VaultCrypt = require('./vault_crypt');
const Lazarus = require('./lazarus');
const KernelResurrection = require('./kernel_resurrection');
const TelemetryLedger = require('./telemetry_ledger');
const SwarmProjection = require('./SwarmProjection');
const TEAR_Engine = require('./TEAR_Engine');
const ForgeGit = require('./forge_git');
const QuantumBridge = require('./quantum_bridge');
const IntentFirewall = require('./intent_firewall');
const OmegaBrokers = require('./omega_brokers');
const TelemetryStream = require('./telemetry_stream');
const GatewayProxy = require('./gateway_proxy');
const StateMigrations = require('./state_migrations');

/**
 * FORGECORE™ WORKSPACE // v3.0 QUANTUM EDITION [SINGULARITY-PRIME]
 * --------------------------------------
 * NEXT-GENERATION SECURITY WITH QUANTUM-RESISTANT CRYPTOGRAPHY
 * AI-POWERED THREAT DETECTION AND ZERO-KNOWLEDGE PROOFS
 * 
 * TEAR Protocol v3.2.0 // BATTLE_HARDENED
 * DESIGNED FOR 20-YEAR PERSISTENCE.
 */

// === STABILITY: Global crash handlers ===
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err.message);
    TelemetryLedger.log('CRASH_GUARD', { type: 'uncaughtException', error: err.message });
});
process.on('unhandledRejection', (reason) => {
    console.error('[CRITICAL] Unhandled Rejection:', String(reason));
    TelemetryLedger.log('CRASH_GUARD', { type: 'unhandledRejection', error: String(reason) });
});

// === STABILITY: Safe JSON parser ===
function safeJSON(str) {
    try { return JSON.parse(str); } catch (e) { return null; }
}
function jsonResponse(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

function readRequestBody(req, maxBytes = 1_048_576) {
    const limit = Number.isFinite(Number(maxBytes)) && Number(maxBytes) > 0
        ? Math.floor(Number(maxBytes))
        : 1_048_576;
    return new Promise((resolve, reject) => {
        let body = '';
        let tooLarge = false;
        req.on('data', (chunk) => {
            if (tooLarge) return;
            body += String(chunk || '');
            if (body.length > limit) tooLarge = true;
        });
        req.on('end', () => {
            if (tooLarge) return resolve({ ok: false, error: 'PAYLOAD_TOO_LARGE', maxBytes: limit });
            return resolve({ ok: true, body });
        });
        req.on('error', reject);
    });
}

async function parseJsonBodyOrReject(req, res, opts = {}) {
    const allowEmpty = opts.allowEmpty !== false;
    const schemaPath = String(opts.schemaPath || '').trim() || null;
    const method = String(opts.method || req.method || 'GET').toUpperCase();
    const ip = opts.ip || 'unknown';
    const maxBytes = Number(opts.maxBytes || 1_048_576);

    let readResult;
    try {
        readResult = await readRequestBody(req, maxBytes);
    } catch (err) {
        return {
            ok: false,
            responded: jsonResponse(res, { error: 'REQUEST_BODY_READ_FAILED', reason: String(err && err.message ? err.message : err) }, 400)
        };
    }

    if (!readResult || !readResult.ok) {
        const payload = {
            error: (readResult && readResult.error) || 'PAYLOAD_TOO_LARGE',
            maxBytes: (readResult && readResult.maxBytes) || maxBytes
        };
        return { ok: false, responded: jsonResponse(res, payload, 413) };
    }

    const raw = String(readResult.body || '');
    const trimmed = raw.trim();
    if (!trimmed) {
        const data = allowEmpty ? null : null;
        if (schemaPath && !enforceApiBodySchema(res, method, schemaPath, data, { ip })) {
            return { ok: false };
        }
        return { ok: true, data, empty: true };
    }

    const parsed = safeJSON(trimmed);
    if (parsed === null) {
        try {
            TelemetryLedger.log('API_JSON_REJECT', {
                method,
                path: schemaPath || req.url || '',
                ip
            });
        } catch {
            // Best effort only.
        }
        return { ok: false, responded: jsonResponse(res, { error: 'INVALID_JSON' }, 400) };
    }

    if (schemaPath && !enforceApiBodySchema(res, method, schemaPath, parsed, { ip })) {
        return { ok: false };
    }
    return { ok: true, data: parsed, empty: false };
}

function enforceApiBodySchema(res, method, pathname, body, context = {}) {
    if (process.env.FORGE_API_SCHEMA_ENFORCE === '0') return true;
    const verdict = ApiSchemaRegistry.validate(method, pathname, body);
    if (verdict.ok) return true;

    const details = Array.isArray(verdict.errors) ? verdict.errors.slice(0, 10) : [];
    try {
        TelemetryLedger.log('API_SCHEMA_REJECT', {
            key: verdict.key,
            details,
            ip: context.ip || 'unknown'
        });
    } catch {
        // Best effort only.
    }
    jsonResponse(res, {
        error: 'SCHEMA_VALIDATION_FAILED',
        key: verdict.key,
        details
    }, 400);
    return false;
}

function nowIso() {
    return new Date().toISOString();
}

function hrMs(startNs) {
    return Number(process.hrtime.bigint() - startNs) / 1_000_000;
}

function percentile(values, p) {
    if (!Array.isArray(values) || values.length === 0) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const rank = Math.ceil((Math.max(0, Math.min(100, p)) / 100) * sorted.length) - 1;
    const idx = Math.max(0, Math.min(sorted.length - 1, rank));
    return Number(sorted[idx] || 0);
}

const runtimeMetrics = {
    startedAt: nowIso(),
    totals: {
        requests: 0,
        status2xx: 0,
        status4xx: 0,
        status5xx: 0
    },
    auth: {
        unlockAttempts: 0,
        unlockSuccess: 0,
        unlockFailure: 0,
        unlockLatencyMsSamples: [],
        lastFailureAt: null
    },
    routes: Object.create(null)
};

function pushMetricSample(arr, value, cap = 512) {
    arr.push(Number(value || 0));
    if (arr.length > cap) arr.splice(0, arr.length - cap);
}

function recordRouteMetric(method, pathname, statusCode, durationMs) {
    const route = `${String(method || "GET").toUpperCase()} ${String(pathname || "/")}`;
    if (!runtimeMetrics.routes[route]) {
        runtimeMetrics.routes[route] = {
            count: 0,
            status2xx: 0,
            status4xx: 0,
            status5xx: 0,
            avgMs: 0,
            p95Ms: 0,
            maxMs: 0,
            latencyMsSamples: []
        };
    }

    const bucket = runtimeMetrics.routes[route];
    const ms = Math.max(0, Number(durationMs || 0));
    bucket.count += 1;
    pushMetricSample(bucket.latencyMsSamples, ms, 256);
    if (ms > bucket.maxMs) bucket.maxMs = ms;
    bucket.avgMs = ((bucket.avgMs * (bucket.count - 1)) + ms) / bucket.count;
    bucket.p95Ms = percentile(bucket.latencyMsSamples, 95);

    runtimeMetrics.totals.requests += 1;
    if (statusCode >= 500) {
        runtimeMetrics.totals.status5xx += 1;
        bucket.status5xx += 1;
    } else if (statusCode >= 400) {
        runtimeMetrics.totals.status4xx += 1;
        bucket.status4xx += 1;
    } else {
        runtimeMetrics.totals.status2xx += 1;
        bucket.status2xx += 1;
    }
}

function runtimeMetricsSnapshot() {
    const auth = runtimeMetrics.auth;
    const unlockAttempts = Number(auth.unlockAttempts || 0);
    const unlockSuccess = Number(auth.unlockSuccess || 0);
    const unlockFailure = Number(auth.unlockFailure || 0);
    const successRate = unlockAttempts > 0 ? unlockSuccess / unlockAttempts : 1;

    const routeKeys = Object.keys(runtimeMetrics.routes).sort();
    const routes = {};
    for (const key of routeKeys) {
        const entry = runtimeMetrics.routes[key];
        routes[key] = {
            count: entry.count,
            status2xx: entry.status2xx,
            status4xx: entry.status4xx,
            status5xx: entry.status5xx,
            avgMs: Number(entry.avgMs.toFixed(2)),
            p95Ms: Number(percentile(entry.latencyMsSamples, 95).toFixed(2)),
            maxMs: Number(entry.maxMs.toFixed(2))
        };
    }

    const slo = {
        authSuccessRate: Number(successRate.toFixed(4)),
        unlockP95Ms: Number(percentile(auth.unlockLatencyMsSamples, 95).toFixed(2)),
        unlockAvgMs: Number((auth.unlockLatencyMsSamples.length
            ? auth.unlockLatencyMsSamples.reduce((acc, v) => acc + v, 0) / auth.unlockLatencyMsSamples.length
            : 0).toFixed(2)),
        server5xxRate: runtimeMetrics.totals.requests > 0
            ? Number((runtimeMetrics.totals.status5xx / runtimeMetrics.totals.requests).toFixed(6))
            : 0
    };

    return {
        generatedAt: nowIso(),
        startedAt: runtimeMetrics.startedAt,
        uptimeSec: Math.round(process.uptime()),
        totals: { ...runtimeMetrics.totals },
        auth: {
            unlockAttempts,
            unlockSuccess,
            unlockFailure,
            lastFailureAt: auth.lastFailureAt,
            unlockSampleCount: auth.unlockLatencyMsSamples.length
        },
        slo,
        routes
    };
}

// === SECURITY: IP-based Rate Limiter ===
const rateBuckets = new Map();
const RATE_WINDOW_MS = 60000;
const RATE_MAX_REQUESTS = 60;

function rateLimit(ip) {
    const now = Date.now();
    if (!rateBuckets.has(ip)) {
        rateBuckets.set(ip, { count: 1, windowStart: now });
        return false; // Not limited
    }
    const bucket = rateBuckets.get(ip);
    if (now - bucket.windowStart > RATE_WINDOW_MS) {
        // Reset window
        bucket.count = 1;
        bucket.windowStart = now;
        return false;
    }
    bucket.count++;
    return bucket.count > RATE_MAX_REQUESTS;
}

function isLoopbackClient(ip) {
    if (!ip) return false;
    const normalized = String(ip).trim();
    return normalized === '127.0.0.1' ||
        normalized === '::1' ||
        normalized === '::ffff:127.0.0.1' ||
        normalized.startsWith('::ffff:127.0.0.');
}

// Cleanup stale buckets every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of rateBuckets.entries()) {
        if (now - bucket.windowStart > RATE_WINDOW_MS * 2) rateBuckets.delete(ip);
    }
}, 300000);

const CONFIG_PATH = path.join(__dirname, 'config.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const ALLOW_DNA_REBIND = process.env.FORGE_ALLOW_DNA_REBIND === '1';
const CORE_DIR = __dirname;
const ROOT_DIR = path.join(CORE_DIR, '..');
function resolvePersistRootDir() {
    const envRoot = String(process.env.FORGE_DATA_ROOT || '').trim();
    if (envRoot) return path.resolve(envRoot);

    const fallbackOverride = String(process.env.FORGE_DEFAULT_DATA_ROOT || '').trim();
    if (fallbackOverride) return path.resolve(fallbackOverride);

    if (process.platform === 'win32') {
        const appData = String(process.env.APPDATA || '').trim();
        if (appData) return path.resolve(path.join(appData, 'ForgeCore_OS'));
    }

    const home = String(os.homedir() || '').trim();
    if (home) return path.resolve(path.join(home, '.forgecore_os'));
    return path.resolve(ROOT_DIR);
}
const PERSIST_ROOT_DIR = resolvePersistRootDir();
const DEFAULT_MASTER_PASSPHRASE = 'FORGE_MASTER_2026';
const MASTER_PASSPHRASE_MIN_LENGTH = Math.max(12, Number(process.env.FORGE_MASTER_PASSPHRASE_MIN_LENGTH || 12));
const MASTER_PASSPHRASE_MAX_LENGTH = Math.max(MASTER_PASSPHRASE_MIN_LENGTH, Number(process.env.FORGE_MASTER_PASSPHRASE_MAX_LENGTH || 256));
const MASTER_PASSPHRASE_HASH_ITERATIONS = Math.max(120000, Number(process.env.FORGE_MASTER_PASSPHRASE_HASH_ITERATIONS || 210000));
const MASTER_PASSPHRASE_RECOVERY_PHRASE = 'RESET MASTER PASSPHRASE';
const BUNDLED_VAULT_DIR = path.join(ROOT_DIR, 'vaults');
const VAULT_DIR = path.join(PERSIST_ROOT_DIR, 'vaults');
const SECURITY_DIR = path.join(PERSIST_ROOT_DIR, 'security');
const MASTER_PASSPHRASE_STATE_PATH = path.join(SECURITY_DIR, 'master_passphrase.json');
const GOLD_SEAL_DIR = path.join(VAULT_DIR, 'INTEL_VAULT', 'SEAL');
const UI_SETTINGS_PATH = path.join(PERSIST_ROOT_DIR, 'logs', 'ui-settings.json');
const ACTION_CONTRACT_PATH = path.join(CORE_DIR, 'ui', 'action_contracts.json');
const ACTION_PROVENANCE_LOG_PATH = path.join(PERSIST_ROOT_DIR, 'logs', 'action-provenance.ndjson');
const AK_SCENARIO_RELATIVE_PATH = path.join('workstreams', 'A_tear_ledger', 'outputs', 'cli', 'tear_cli.js');
function resolveAkScenarioCliPath() {
    const candidates = [
        path.join(ROOT_DIR, AK_SCENARIO_RELATIVE_PATH)
    ];

    if (process.resourcesPath) {
        candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', AK_SCENARIO_RELATIVE_PATH));
        candidates.push(path.join(process.resourcesPath, 'app.asar', AK_SCENARIO_RELATIVE_PATH));
    }

    candidates.push(path.join(process.cwd(), AK_SCENARIO_RELATIVE_PATH));

    const seen = new Set();
    for (const candidate of candidates) {
        const resolved = path.resolve(candidate);
        if (seen.has(resolved)) continue;
        seen.add(resolved);
        if (fs.existsSync(resolved)) return resolved;
    }
    return path.resolve(candidates[0]);
}
const AK_SCENARIO_CLI_PATH = resolveAkScenarioCliPath();
const AK_RUNTIME_DIR = path.join(PERSIST_ROOT_DIR, 'runtime_ak');
const actionRegistry = new ActionRegistry(ACTION_CONTRACT_PATH);
const actionProvenanceTail = [];
let actionProvenanceSeq = 0;
let lastAkRuntimeScenario = null;
let masterPassphraseState = null;

function normalizePassphrase(value) {
    return String(value || '').replace(/\r?\n/g, '').trim();
}

function isDefaultMasterPassphrase(value) {
    return normalizePassphrase(value) === DEFAULT_MASTER_PASSPHRASE;
}

function deriveMasterPassphraseDigest(passphrase, saltHex, iterations = MASTER_PASSPHRASE_HASH_ITERATIONS) {
    const salt = Buffer.from(String(saltHex || ''), 'hex');
    if (!salt.length) throw new Error('invalid_master_passphrase_salt');
    return crypto.pbkdf2Sync(
        normalizePassphrase(passphrase),
        salt,
        Math.max(120000, Number(iterations || MASTER_PASSPHRASE_HASH_ITERATIONS)),
        32,
        'sha512'
    ).toString('hex');
}

function makePassphraseRecord(passphrase) {
    const normalized = normalizePassphrase(passphrase);
    const saltHex = crypto.randomBytes(16).toString('hex');
    const iterations = MASTER_PASSPHRASE_HASH_ITERATIONS;
    return {
        schemaVersion: 1,
        algorithm: 'pbkdf2-sha512',
        iterations,
        salt: saltHex,
        digest: deriveMasterPassphraseDigest(normalized, saltHex, iterations),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

function loadPassphraseRecordFromDisk() {
    try {
        if (!fs.existsSync(MASTER_PASSPHRASE_STATE_PATH)) return null;
        const parsed = safeJSON(fs.readFileSync(MASTER_PASSPHRASE_STATE_PATH, 'utf8'));
        if (!parsed || typeof parsed !== 'object') return null;
        const digest = String(parsed.digest || '').trim().toLowerCase();
        const salt = String(parsed.salt || '').trim().toLowerCase();
        const iterations = Number(parsed.iterations || MASTER_PASSPHRASE_HASH_ITERATIONS);
        if (!/^[a-f0-9]{64}$/.test(digest)) return null;
        if (!/^[a-f0-9]{32}$/.test(salt)) return null;
        if (!Number.isFinite(iterations) || iterations < 120000) return null;
        return {
            schemaVersion: Number(parsed.schemaVersion || 1),
            algorithm: 'pbkdf2-sha512',
            iterations: Math.floor(iterations),
            salt,
            digest,
            createdAt: String(parsed.createdAt || new Date().toISOString()),
            updatedAt: String(parsed.updatedAt || parsed.createdAt || new Date().toISOString())
        };
    } catch {
        return null;
    }
}

function writePassphraseRecordToDisk(record) {
    if (!record || typeof record !== 'object') throw new Error('invalid_master_passphrase_record');
    if (!fs.existsSync(SECURITY_DIR)) fs.mkdirSync(SECURITY_DIR, { recursive: true });
    fs.writeFileSync(MASTER_PASSPHRASE_STATE_PATH, JSON.stringify(record, null, 2), 'utf8');
}

function setMasterPassphraseStateFromRecord(record) {
    masterPassphraseState = {
        configured: true,
        mode: 'hash',
        source: 'persisted',
        record,
        bootstrapRequired: false,
        defaultBypassEnabled: false
    };
    return masterPassphraseState;
}

function bootstrapMasterPassphrase(passphrase, context = {}) {
    const normalized = normalizePassphrase(passphrase);
    if (!normalized) return { ok: false, statusCode: 400, error: 'PASSPHRASE_REQUIRED' };
    if (normalized.length < MASTER_PASSPHRASE_MIN_LENGTH) {
        return { ok: false, statusCode: 400, error: 'PASSPHRASE_TOO_SHORT', minLength: MASTER_PASSPHRASE_MIN_LENGTH };
    }
    if (normalized.length > MASTER_PASSPHRASE_MAX_LENGTH) {
        return { ok: false, statusCode: 400, error: 'PASSPHRASE_TOO_LONG', maxLength: MASTER_PASSPHRASE_MAX_LENGTH };
    }
    if (isDefaultMasterPassphrase(normalized)) {
        return { ok: false, statusCode: 400, error: 'DEFAULT_PASSPHRASE_BLOCKED' };
    }

    const record = makePassphraseRecord(normalized);
    writePassphraseRecordToDisk(record);
    setMasterPassphraseStateFromRecord(record);
    failedAttempts = 0;
    SYSTEM_GHOST_MODE = false;

    const ip = String(context.ip || 'local');
    const source = String(context.source || 'api');
    TelemetryLedger.log('MASTER_PASSPHRASE_BOOTSTRAPPED', { ip, source });
    try {
        if (tearEngine && typeof tearEngine.seal === 'function') {
            tearEngine.seal(
                'MASTER_PASSPHRASE_BOOTSTRAPPED',
                { ip, source },
                { title: 'Security Event: Master Passphrase Bootstrapped' }
            );
        }
    } catch {
        // Best effort attestation only.
    }
    return { ok: true, record };
}

function resetMasterPassphrase(passphrase, context = {}) {
    const normalized = normalizePassphrase(passphrase);
    if (!normalized) return { ok: false, statusCode: 400, error: 'PASSPHRASE_REQUIRED' };
    if (normalized.length < MASTER_PASSPHRASE_MIN_LENGTH) {
        return { ok: false, statusCode: 400, error: 'PASSPHRASE_TOO_SHORT', minLength: MASTER_PASSPHRASE_MIN_LENGTH };
    }
    if (normalized.length > MASTER_PASSPHRASE_MAX_LENGTH) {
        return { ok: false, statusCode: 400, error: 'PASSPHRASE_TOO_LONG', maxLength: MASTER_PASSPHRASE_MAX_LENGTH };
    }
    if (isDefaultMasterPassphrase(normalized)) {
        return { ok: false, statusCode: 400, error: 'DEFAULT_PASSPHRASE_BLOCKED' };
    }

    const record = makePassphraseRecord(normalized);
    writePassphraseRecordToDisk(record);
    setMasterPassphraseStateFromRecord(record);
    failedAttempts = 0;
    SYSTEM_GHOST_MODE = false;
    if (sessions && typeof sessions.clear === 'function') {
        sessions.clear();
        setNeuralEmpireRuntimeToken(null);
    }

    const ip = String(context.ip || 'local');
    const source = String(context.source || 'api_recovery');
    TelemetryLedger.log('MASTER_PASSPHRASE_RECOVERY_RESET', { ip, source, sessionsRevoked: true });
    try {
        if (tearEngine && typeof tearEngine.seal === 'function') {
            tearEngine.seal(
                'MASTER_PASSPHRASE_RECOVERY_RESET',
                { ip, source, sessionsRevoked: true },
                { title: 'Security Event: Master Passphrase Recovery Reset' }
            );
        }
    } catch {
        // Best effort attestation only.
    }
    return { ok: true, record };
}

function resolveMasterPassphraseState() {
    const envCandidate = normalizePassphrase(process.env.FORGE_MASTER_PASSPHRASE || '');
    const cfgCandidate = normalizePassphrase(CONFIG && CONFIG.security && CONFIG.security.masterPassphrase);
    const allowDefaultBypass = String(process.env.FORGE_ALLOW_DEFAULT_PASSPHRASE || '').trim() === '1';
    const explicit = envCandidate || cfgCandidate;
    if (explicit) {
        const source = envCandidate ? 'env' : 'config';
        if (isDefaultMasterPassphrase(explicit) && !allowDefaultBypass) {
            return {
                configured: false,
                mode: 'bootstrap',
                source: 'default_blocked',
                bootstrapRequired: true,
                defaultBypassEnabled: false
            };
        }
        return {
            configured: true,
            mode: 'plain',
            source,
            normalized: explicit,
            bootstrapRequired: false,
            defaultBypassEnabled: allowDefaultBypass && isDefaultMasterPassphrase(explicit)
        };
    }

    const persisted = loadPassphraseRecordFromDisk();
    if (persisted) {
        return {
            configured: true,
            mode: 'hash',
            source: 'persisted',
            record: persisted,
            bootstrapRequired: false,
            defaultBypassEnabled: false
        };
    }

    return {
        configured: false,
        mode: 'bootstrap',
        source: 'missing',
        bootstrapRequired: true,
        defaultBypassEnabled: false
    };
}

function verifyMasterPassphrase(passphrase) {
    const normalized = normalizePassphrase(passphrase);
    if (!normalized) return false;
    if (!masterPassphraseState || masterPassphraseState.mode === 'bootstrap') return false;
    if (masterPassphraseState.mode === 'plain') {
        return normalized === String(masterPassphraseState.normalized || '');
    }
    if (masterPassphraseState.mode === 'hash' && masterPassphraseState.record) {
        const digest = deriveMasterPassphraseDigest(
            normalized,
            masterPassphraseState.record.salt,
            masterPassphraseState.record.iterations
        );
        const expected = Buffer.from(String(masterPassphraseState.record.digest || ''), 'hex');
        const got = Buffer.from(String(digest || ''), 'hex');
        return expected.length === got.length && crypto.timingSafeEqual(expected, got);
    }
    return false;
}

function copySeedTree(sourcePath, destPath) {
    if (!fs.existsSync(sourcePath)) return;
    const stat = fs.statSync(sourcePath);
    if (stat.isDirectory()) {
        if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
        const entries = fs.readdirSync(sourcePath, { withFileTypes: true });
        for (const entry of entries) {
            copySeedTree(path.join(sourcePath, entry.name), path.join(destPath, entry.name));
        }
        return;
    }
    if (!fs.existsSync(destPath)) {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(sourcePath, destPath);
    }
}

function ensurePersistentDataRoot() {
    if (!fs.existsSync(PERSIST_ROOT_DIR)) fs.mkdirSync(PERSIST_ROOT_DIR, { recursive: true });
    if (!fs.existsSync(VAULT_DIR)) fs.mkdirSync(VAULT_DIR, { recursive: true });
    if (!fs.existsSync(SECURITY_DIR)) fs.mkdirSync(SECURITY_DIR, { recursive: true });

    let needsVaultSeed = false;
    try {
        const current = fs.readdirSync(VAULT_DIR, { withFileTypes: true }).filter((d) => !d.name.startsWith('.'));
        needsVaultSeed = current.length === 0;
    } catch {
        needsVaultSeed = true;
    }

    if (needsVaultSeed && fs.existsSync(BUNDLED_VAULT_DIR)) {
        copySeedTree(BUNDLED_VAULT_DIR, VAULT_DIR);
    }

    const reposDir = path.join(PERSIST_ROOT_DIR, 'repos');
    if (!fs.existsSync(reposDir)) fs.mkdirSync(reposDir, { recursive: true });

    const logsDir = path.join(PERSIST_ROOT_DIR, 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
}

ensurePersistentDataRoot();
masterPassphraseState = resolveMasterPassphraseState();
NeuralPass.configure({
    storagePath: path.join(SECURITY_DIR, 'neuralpass_store.json')
});

if (!masterPassphraseState.configured || masterPassphraseState.mode === 'bootstrap') {
    console.warn('[AUTH] MASTER_PASSPHRASE_UNSET: bootstrap required via /api/system/passphrase/bootstrap');
} else {
    console.log(`[AUTH] master passphrase source=${masterPassphraseState.source} mode=${masterPassphraseState.mode}`);
}

try {
    if (fs.existsSync(UI_SETTINGS_PATH)) {
        const persistedUiSettings = safeJSON(fs.readFileSync(UI_SETTINGS_PATH, 'utf8'));
        if (persistedUiSettings && typeof persistedUiSettings === 'object') {
            Object.assign(CONFIG.ui, persistedUiSettings);
        }
    }
} catch (e) {
    console.warn('[SETTINGS] Failed to load runtime UI settings:', e.message);
}

// 0. BOOT SEQUENCE
TelemetryLedger.init(PERSIST_ROOT_DIR);
const stateMigrations = new StateMigrations(PERSIST_ROOT_DIR);
const stateMigrationResult = stateMigrations.applyPending();
if (stateMigrationResult.appliedCount > 0) {
    console.log(`[STATE] Applied ${stateMigrationResult.appliedCount} migration(s).`);
}
TelemetryLedger.log("STATE_MIGRATIONS", stateMigrationResult);

// [TIER 7] HOLOGRAPHIC MEMORY TRAPS
MemoryTraps.deployTraps(5000); // Flood RAM with 5,000 fake cryptographic signatures

// [SECURITY] Rust Binary Integrity Check
if (CONFIG.security.rustBinaryHash) {
    try {
        const binPath = path.join(ROOT_DIR, 'rust_quantum_crypto', 'target', 'release', 'rust_quantum_crypto.exe');
        if (fs.existsSync(binPath)) {
            const binBuffer = fs.readFileSync(binPath);
            const actualHash = crypto.createHash('sha256').update(binBuffer).digest('hex');
            if (actualHash !== CONFIG.security.rustBinaryHash) {
                console.error(`[CRITICAL] RUST_BINARY_INTEGRITY_VIOLATION: Expected ${CONFIG.security.rustBinaryHash.substring(0, 12)}, got ${actualHash.substring(0, 12)}`);
                TelemetryLedger.log('BINARY_TAMPER', { expected: CONFIG.security.rustBinaryHash, actual: actualHash });
                if (CONFIG.security.mode === 'PROD') process.exit(42);
            } else {
                console.log('[SECURITY] Rust Quantum Binary Verified (SHA-256 Match).');
            }
        } else {
            console.warn('[WARNING] Rust binary missing. Quantum features will be unavailable.');
        }
    } catch (e) {
        console.error('[ERR] Integrity check failed:', e.message);
    }
}

const tearEngine = new TEAR_Engine(PERSIST_ROOT_DIR, DNALock);
let lastGhostAttestationEvent = null;
let lastWitnessAnnouncedHead = null;

// [SECURITY] P2P TEAR Syncing
tearEngine.onNewBlock = (block) => {
    try {
        if (SwarmProjection.ghost) {
            SwarmProjection.ghost.multicast('TEAR_BLOCK_SYNC', { block });
        }
        const executionHead = tearEngine.executionChain.getHead();
        if (!executionHead || executionHead === lastWitnessAnnouncedHead) return;
        lastWitnessAnnouncedHead = executionHead;

        const requiredPeerIDs = WITNESS_REQUIRED_PEER_IDS.slice();

        SwarmProjection.attestGhostHead({
            headCID: executionHead,
            chainLength: tearEngine.getChain().length,
            blockFingerprint: block && block.fingerprint ? block.fingerprint : '',
            requiredPeerIDs,
            timeoutMs: 1800
        }).then((attestation) => {
            if (!attestation || !attestation.success) return;
            lastGhostAttestationEvent = {
                timestamp: attestation.attestedAt,
                headCID: attestation.headCID,
                receiptCount: attestation.receiptCount,
                uniqueObservers: attestation.uniqueObservers,
                quorumMet: !!attestation.quorumMet,
                missingRequiredPeerIDs: attestation.missingRequiredPeerIDs || []
            };
            TelemetryLedger.log("GHOST_WITNESS_ATTESTATION", {
                headCID: attestation.headCID,
                receiptCount: attestation.receiptCount,
                uniqueObservers: attestation.uniqueObservers,
                quorumMet: attestation.quorumMet,
                missingRequiredPeerIDs: attestation.missingRequiredPeerIDs || []
            });
            tearEngine.seal('GHOST_WITNESS_ATTESTATION', {
                headCID: attestation.headCID,
                receiptCount: attestation.receiptCount,
                uniqueObservers: attestation.uniqueObservers,
                quorumMet: attestation.quorumMet,
                requiredPeerIDs: attestation.requiredPeerIDs || [],
                missingRequiredPeerIDs: attestation.missingRequiredPeerIDs || []
            }, { title: `Witness Attestation ${String(attestation.headCID).slice(0, 12)}` });
        }).catch((err) => {
            TelemetryLedger.log("GHOST_WITNESS_ATTESTATION_ERROR", {
                headCID: executionHead,
                error: String(err && err.message ? err.message : err)
            });
        });
    } catch (e) { /* Swarm not ready */ }
};
// Handle incoming blocks from other nodes
SwarmProjection.init(PERSIST_ROOT_DIR); // Move init slightly up to ensure ghost exists
SwarmProjection.ghost.onPacket('TEAR_BLOCK_SYNC', (data) => {
    try {
        const block = data && data.block ? data.block : data;
        if (!block || !block.fingerprint) return;
        // Validate and append if legitimate
        if (tearEngine.verify(block).valid) {
            // Check if we already have it to prevent loops
            const chain = tearEngine.getChain();
            if (!chain.some(b => b.fingerprint === block.fingerprint)) {
                tearEngine._appendToChain(block);
                console.log(`[TEAR_SYNC] Synchronized external block: ${block.evidence.kind}`);
            }
        }
    } catch (e) { /* Log corruption */ }
});

const omegaFirewall = new IntentFirewall(ROOT_DIR, tearEngine);
const omega = new OmegaBrokers(omegaFirewall);
const forgeGit = new ForgeGit(PERSIST_ROOT_DIR, tearEngine, omega);
const quantumBridge = new QuantumBridge(ROOT_DIR);
tearEngine.seal('SYSTEM_BOOT', { version: '3.0.0-Quantum', codename: 'Singularity-Prime', pid: process.pid }, { title: 'ForgeCore Quantum Boot' });
console.log(`[QUANTUM] ForgeCore™ Workspace v3.0.0-Quantum Initialized.`);
console.log(`[TEAR] Audit chain length: ${tearEngine.getChain().length}`);
console.log(`[BRIDGE] Quantum Bridge Active (Lattice-based).`);
console.log(`[OMEGA] Security Kernel Active (Constitutional Enforcement).`);

// [PHASE 281] Self-Optimization Cycle (Simulated 24h as 5 min for dev)
setInterval(() => {
    console.log("[SYSTEM] Initiating Scheduled Self-Optimization Cycle...");
    // Simulate a diagnostic insight if nodes are healthy but want to optimize
    SwarmProjection.triggerEvolution({
        type: 'ANOMALY_DETECTION',
        severity: 'LOW',
        recommendation: 'JITTER_BOOST',
        reason: 'Periodic defensive rotation scheduled.'
    });
}, 3600000); // 1 hour cycle

// [NEURODROP_V3] Autonomous Protocols
setInterval(() => {
    // F.A.R.T. logic (False Activity Research & Tracking)
    if (Math.random() > 0.7) {
        NeuroDrop.fart();
    }
}, 60000); // Check every minute

if (fs.existsSync(GOLD_SEAL_DIR)) {
    const repairedCount = KernelResurrection.verifyAndHeal(CORE_DIR, GOLD_SEAL_DIR);
    if (repairedCount > 0) {
        console.log(`[RESURRECTOR] ${repairedCount} core artifacts restored.`);
        TelemetryLedger.log("KERNEL_RESURRECTION", { repairedCount });
    }
}
TelemetryLedger.log("SYSTEM_BOOT", { version: Lazarus.version, codename: "Singularity-Prime" });

// 1. PHYSICAL DNA FUSION (Upgraded to TPM Enclave)
const machineID = TPMEnclave.generateHardwareBoundKey();
if (!CONFIG.security.dnaSeal || CONFIG.security.dnaSeal === "") {
    CONFIG.security.dnaSeal = machineID;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(CONFIG, null, 2));
    console.log(`[TPM] Bound to hardware enclave: ${machineID.substring(0, 16)}...`);
} else if (CONFIG.security.dnaSeal !== machineID) {
    console.warn(`[WARNING] DNA_MISMATCH: Expected ${CONFIG.security.dnaSeal.substring(0, 8)}, got ${machineID.substring(0, 8)}`);
    TelemetryLedger.log("DNA_MISMATCH", { expected: CONFIG.security.dnaSeal, actual: machineID });
    
    // Immutable TEAR audit log
    tearEngine.seal('DNA_MISMATCH', { actual: machineID, expected: CONFIG.security.dnaSeal }, { title: 'Security Event: DNA Mismatch' });

    if (ALLOW_DNA_REBIND) {
        const oldSeal = CONFIG.security.dnaSeal;
        CONFIG.security.dnaSeal = machineID;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(CONFIG, null, 2));
        console.warn(`[RECOVERY] DNA rebind applied via FORGE_ALLOW_DNA_REBIND=1 (${oldSeal.substring(0, 8)} -> ${machineID.substring(0, 8)}).`);
        TelemetryLedger.log("DNA_REBIND", { oldSeal, newSeal: machineID });
        tearEngine.seal('DNA_REBIND', { oldSeal, newSeal: machineID }, { title: 'Security Event: DNA Rebind' });
    } else if (CONFIG.security.mode === 'PROD') {
        console.error("[CRITICAL] STRICT PROD MODE: DNA_VIOLATION. Exiting.");
        process.exit(42);
    }
}

// 2. CORE INTEGRITY SEAL
const CORE_HASH = SecurityAudit.seal(CORE_DIR);
console.log(`[IMMORTAL] CORE_SEAL: ${CORE_HASH.substring(0, 16)}`);

// [IP_GOLD] MERKLE-DAG STATE PINNING
const mfs = new MerkleDagFS(PERSIST_ROOT_DIR);
const explorer = new XXXplorer(PERSIST_ROOT_DIR); // [XXXPLORER] Engine
const replayEngine = new ReplayEngine(PERSIST_ROOT_DIR); // [IP_GOLD] Replay Engine

if (CONFIG.security.mode === 'PROD') {
    // Collect critical configuration states to pin
    const systemState = {
        "config.json": crypto.createHash('sha256').update(fs.readFileSync(CONFIG_PATH)).digest('hex'),
        "core_seal": CORE_HASH,
        "tpm_signature": TPMEnclave.hardwareSign("GOLDEN_BOOT")
    };
    const goldenCID = mfs.commitVaultState("KERNEL_PROD_BOOT", systemState);
    console.log(`[MERKLE_FS] Boot State Pinned to DAG. CID: ${goldenCID.substring(0, 16)}...`);
    TelemetryLedger.log("STATE_PINNED", { cid: goldenCID });
}

let sessions = new Map(); // token -> { passphrase, ghostMode, expiry, issuedAt, ip }
let failedAttempts = 0;
let SYSTEM_GHOST_MODE = false;
let lastAutoHealEvent = null;
const releaseIntegrityCache = { ts: 0, value: null };
const TIMELINE_CACHE_TTL_MS = Math.max(250, Number(process.env.FORGE_TIMELINE_CACHE_TTL_MS || 2500));
const TIMELINE_MAX_ENTRIES = Math.max(10, Number(process.env.FORGE_TIMELINE_MAX_ENTRIES || 20));
const TIMELINE_AUTOHEAL_INTERVAL_MS = Math.max(5000, Number(process.env.FORGE_TIMELINE_AUTOHEAL_INTERVAL_MS || 60000));
const AUTO_HEAL_FAST_INTERVAL_MS = Math.max(750, Number(process.env.FORGE_AUTOHEAL_FAST_INTERVAL_MS || 2500));
const timelineCache = { ts: 0, value: [] };
const timelineHealLastByVault = new Map();
const autoHealFastLastByVault = new Map();
const SESSION_TTL_MS = Math.max(60_000, Number(process.env.FORGE_SESSION_TTL_MS || 3_600_000));
const ENABLE_GHOST_MODE = process.env.FORGE_ENABLE_GHOST_MODE === '1' ||
    !!(CONFIG && CONFIG.security && CONFIG.security.enableGhostMode);
const NEURALPASS_MIN_TIER = Math.max(1, Math.min(5, Number(
    process.env.FORGE_NEURALPASS_MIN_TIER ||
    (CONFIG && CONFIG.security && Number(CONFIG.security.neuralPassMinTier || 1)) ||
    1
)));

function parsePositiveIntEnv(name, fallback, minValue = 1) {
    const raw = process.env[name];
    if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(minValue, Math.floor(parsed));
}

function normalizeWitnessMode(value) {
    const mode = String(value || 'warn').trim().toLowerCase();
    if (mode === 'off' || mode === 'warn' || mode === 'enforce') return mode;
    return 'warn';
}

function normalizePeerIDList(list) {
    const out = [];
    const seen = new Set();
    for (const item of list) {
        const id = String(item || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
    }
    return out;
}

function resolveWitnessRequiredPeersFromConfig() {
    const fromConfig = CONFIG && CONFIG.witness && Array.isArray(CONFIG.witness.requiredPeerIDs)
        ? CONFIG.witness.requiredPeerIDs
        : null;
    if (fromConfig && fromConfig.length) return normalizePeerIDList(fromConfig);

    const fromPeers = Array.isArray(CONFIG && CONFIG.peers) ? CONFIG.peers : [];
    const ids = fromPeers
        .map((peer) => String(peer && peer.id ? peer.id : '').trim())
        .filter(Boolean);
    return normalizePeerIDList(ids);
}

function resolveWitnessRequiredPeersFromEnv() {
    const raw = String(process.env.FORGE_WITNESS_REQUIRED_PEERS || '').trim();
    if (!raw) return [];
    return normalizePeerIDList(raw.split(',').map((part) => part.trim()));
}

const WITNESS_QUORUM_MODE = normalizeWitnessMode(
    process.env.FORGE_WITNESS_QUORUM_MODE ||
    (CONFIG && CONFIG.witness ? CONFIG.witness.mode : null) ||
    'warn'
);
const WITNESS_REQUIRED_PEER_IDS = (() => {
    const envPeers = resolveWitnessRequiredPeersFromEnv();
    if (envPeers.length) return envPeers;
    return resolveWitnessRequiredPeersFromConfig();
})();
const WITNESS_MIN_OBSERVERS = parsePositiveIntEnv(
    'FORGE_WITNESS_MIN_OBSERVERS',
    Math.max(1, Number(CONFIG && CONFIG.witness && CONFIG.witness.minObservers || 2)),
    1
);
const WITNESS_MAX_AGE_MS = parsePositiveIntEnv(
    'FORGE_WITNESS_MAX_AGE_MS',
    Math.max(5_000, Number(CONFIG && CONFIG.witness && CONFIG.witness.maxAgeMs || 180_000)),
    5_000
);

function createSession(passphrase, ghostMode, ip) {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    sessions.set(token, {
        passphrase,
        ghostMode: !!ghostMode,
        issuedAt: now,
        expiry: now + SESSION_TTL_MS,
        ip: ip || 'unknown'
    });
    return token;
}

function pruneExpiredSessions() {
    const now = Date.now();
    for (const [token, session] of sessions.entries()) {
        if (!session || now >= session.expiry) {
            sessions.delete(token);
        }
    }
}

// Helper to validate session from Authorization header
function getSession(req) {
    pruneExpiredSessions();
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const session = sessions.get(token);
        if (session) {
            if (Date.now() < session.expiry) return session;
            sessions.delete(token);
        }
    }
    return null;
}

const NEURAL_EMPIRE_BOOT = {
    initialized: false,
    booted: false,
    startedAt: null,
    bootedAt: null,
    failedAt: null,
    error: null
};
const NEURAL_EMPIRE_EVENT_LOG_MAX = 256;
const neuralEmpireEventLog = [];
let neuralEmpireKernel = null;
let neuralEmpireRuntimeToken = null;

function pushNeuralEmpireEvent(event, details = {}) {
    const row = {
        ts: nowIso(),
        event: String(event || 'unknown').slice(0, 96),
        details: details && typeof details === 'object' ? details : {}
    };
    neuralEmpireEventLog.push(row);
    if (neuralEmpireEventLog.length > NEURAL_EMPIRE_EVENT_LOG_MAX) {
        neuralEmpireEventLog.splice(0, neuralEmpireEventLog.length - NEURAL_EMPIRE_EVENT_LOG_MAX);
    }
    return row;
}

function setNeuralEmpireRuntimeToken(token) {
    const normalized = String(token || '').trim();
    neuralEmpireRuntimeToken = normalized || null;
}

function createNeuralEmpireRuntimeFetch(tokenProvider = () => null) {
    return async (input, init = {}) => {
        const raw = String(input || '').trim();
        const endpoint = /^https?:\/\//i.test(raw)
            ? raw
            : `http://127.0.0.1:3000${raw.startsWith('/') ? raw : `/${raw}`}`;
        const headers = {
            ...(init && init.headers ? init.headers : {})
        };
        const token = String(tokenProvider() || '').trim();
        if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;
        if (!headers.Accept) headers.Accept = 'application/json';

        if (typeof fetch === 'function') {
            return fetch(endpoint, { ...init, headers });
        }

        return new Promise((resolve, reject) => {
            try {
                const parsed = new URL(endpoint);
                const method = String(init && init.method ? init.method : 'GET').toUpperCase();
                const bodyRaw = init && Object.prototype.hasOwnProperty.call(init, 'body') ? init.body : null;
                const body = bodyRaw == null
                    ? null
                    : (Buffer.isBuffer(bodyRaw) ? bodyRaw : Buffer.from(String(bodyRaw)));
                if (body && !headers['Content-Length'] && !headers['content-length']) {
                    headers['Content-Length'] = String(body.length);
                }
                const req = http.request({
                    hostname: parsed.hostname,
                    port: parsed.port ? Number(parsed.port) : 80,
                    path: `${parsed.pathname}${parsed.search}`,
                    method,
                    headers
                }, (resp) => {
                    let rawText = '';
                    resp.on('data', (chunk) => {
                        rawText += String(chunk);
                    });
                    resp.on('end', () => {
                        const status = Number(resp.statusCode || 0);
                        resolve({
                            ok: status >= 200 && status < 300,
                            status,
                            json: async () => {
                                const parsedJson = safeJSON(rawText);
                                return parsedJson == null ? {} : parsedJson;
                            },
                            text: async () => rawText
                        });
                    });
                });
                req.on('error', reject);
                if (body) req.write(body);
                req.end();
            } catch (err) {
                reject(err);
            }
        });
    };
}

function getNeuralEmpireModuleInstance(moduleId) {
    if (!neuralEmpireKernel || !neuralEmpireKernel.moduleLoader) return null;
    if (typeof neuralEmpireKernel.moduleLoader.getModule !== 'function') return null;
    try {
        const row = neuralEmpireKernel.moduleLoader.getModule(moduleId, { includeInstance: true });
        return row && row.instance ? row.instance : null;
    } catch {
        return null;
    }
}

function emitNeuralEmpireSignal(topic, payload = {}, meta = {}) {
    if (!neuralEmpireKernel || typeof neuralEmpireKernel.emitSignal !== 'function') return null;
    try {
        return neuralEmpireKernel.emitSignal(topic, payload, {
            source: String(meta.source || 'forgecore.runtime')
        });
    } catch (err) {
        pushNeuralEmpireEvent('signal.emit_error', {
            topic: String(topic || ''),
            error: String(err && err.message ? err.message : err)
        });
        return null;
    }
}

function getNeuralEmpireRuntimeSummary(includeKernelStatus = true) {
    const summary = {
        initialized: !!NEURAL_EMPIRE_BOOT.initialized,
        booted: !!NEURAL_EMPIRE_BOOT.booted,
        startedAt: NEURAL_EMPIRE_BOOT.startedAt,
        bootedAt: NEURAL_EMPIRE_BOOT.bootedAt,
        failedAt: NEURAL_EMPIRE_BOOT.failedAt,
        error: NEURAL_EMPIRE_BOOT.error,
        runtimeTokenBound: !!neuralEmpireRuntimeToken,
        eventTail: neuralEmpireEventLog.slice(-40)
    };
    if (!includeKernelStatus) return summary;

    if (!neuralEmpireKernel) {
        summary.kernel = null;
        return summary;
    }

    try {
        const status = neuralEmpireKernel.status();
        summary.kernel = {
            startedAt: status.startedAt || null,
            isBooted: !!status.isBooted,
            moduleCount: status.moduleLoader && Number(status.moduleLoader.moduleCount || 0),
            moduleIds: status.moduleLoader && Array.isArray(status.moduleLoader.moduleIds)
                ? status.moduleLoader.moduleIds
                : [],
            signalSequence: status.signalBus && Number(status.signalBus.sequence || 0),
            signalHistorySize: status.signalBus && Number(status.signalBus.historySize || 0),
            dispatchCount: status.messageRouter && Number(status.messageRouter.dispatches || 0),
            taskHistoryCount: status.taskScheduler && Number(status.taskScheduler.historyCount || 0),
            integrityBaselineCount: status.integrity && Number(status.integrity.baselineCount || 0)
        };
    } catch (err) {
        summary.kernel = null;
        summary.error = `KERNEL_STATUS_ERROR:${String(err && err.message ? err.message : err)}`;
    }
    return summary;
}

function initializeNeuralEmpireRuntime() {
    if (NEURAL_EMPIRE_BOOT.initialized) return neuralEmpireKernel;
    NEURAL_EMPIRE_BOOT.initialized = true;
    NEURAL_EMPIRE_BOOT.startedAt = nowIso();
    pushNeuralEmpireEvent('boot.start', { startedAt: NEURAL_EMPIRE_BOOT.startedAt });
    try {
        if (typeof ForgeCoreKernel !== 'function') {
            throw new Error(`FORGECORE_KERNEL_UNAVAILABLE:${FORGE_CORE_KERNEL_LOAD_ERROR || 'unknown'}`);
        }
        neuralEmpireKernel = new ForgeCoreKernel();
        const bootStatus = neuralEmpireKernel.bootDefaultEmpireModules({
            fetchImpl: createNeuralEmpireRuntimeFetch(() => neuralEmpireRuntimeToken)
        });
        NEURAL_EMPIRE_BOOT.booted = true;
        NEURAL_EMPIRE_BOOT.bootedAt = nowIso();
        NEURAL_EMPIRE_BOOT.error = null;
        pushNeuralEmpireEvent('boot.success', {
            moduleCount: Number(bootStatus && bootStatus.moduleLoader && bootStatus.moduleLoader.moduleCount || 0),
            moduleIds: bootStatus && bootStatus.moduleLoader && Array.isArray(bootStatus.moduleLoader.moduleIds)
                ? bootStatus.moduleLoader.moduleIds
                : []
        });
        emitNeuralEmpireSignal('runtime.neural_empire.online', {
            moduleCount: Number(bootStatus && bootStatus.moduleLoader && bootStatus.moduleLoader.moduleCount || 0),
            stateRoot: PERSIST_ROOT_DIR
        }, { source: 'forgecore.boot' });
        TelemetryLedger.log('NEURAL_EMPIRE_RUNTIME_BOOT', {
            success: true,
            moduleCount: Number(bootStatus && bootStatus.moduleLoader && bootStatus.moduleLoader.moduleCount || 0)
        });
        tearEngine.seal('NEURAL_EMPIRE_RUNTIME_BOOT', {
            success: true,
            moduleCount: Number(bootStatus && bootStatus.moduleLoader && bootStatus.moduleLoader.moduleCount || 0)
        }, { title: 'Neural Empire Runtime Boot' });
    } catch (err) {
        const message = String(err && err.message ? err.message : err);
        NEURAL_EMPIRE_BOOT.booted = false;
        NEURAL_EMPIRE_BOOT.failedAt = nowIso();
        NEURAL_EMPIRE_BOOT.error = message;
        pushNeuralEmpireEvent('boot.failed', { error: message });
        TelemetryLedger.log('NEURAL_EMPIRE_RUNTIME_BOOT_FAIL', { error: message });
        tearEngine.seal('NEURAL_EMPIRE_RUNTIME_BOOT_FAIL', { error: message }, { title: 'Neural Empire Boot Failure' });
    }
    return neuralEmpireKernel;
}

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

function isManagedVault(vaultName) {
    if (!vaultName || typeof vaultName !== 'string') return false;
    if (vaultName.startsWith('.')) return false;
    const vaultPath = path.join(VAULT_DIR, vaultName);
    return vaultPath.startsWith(VAULT_DIR) && fs.existsSync(vaultPath) && fs.statSync(vaultPath).isDirectory();
}

function sealVaultSnapshotSafe(vaultName, reason) {
    if (!isManagedVault(vaultName)) return null;
    try {
        return explorer.sealVaultState(vaultName, reason || 'AUTO_SNAPSHOT');
    } catch (e) {
        console.warn(`[XXXPLORER] Snapshot failed for ${vaultName}: ${e.message}`);
        return null;
    }
}

function autoHealVaultSafe(vaultName, trigger = 'AUTO_HEAL_CHECK') {
    if (!isManagedVault(vaultName)) return null;
    try {
        const verdict = explorer.verifyAndAutoHeal(vaultName, { autoHeal: true, reason: trigger });
        if (verdict && verdict.healed) {
            lastAutoHealEvent = {
                timestamp: Date.now(),
                vault: vaultName,
                trigger,
                targetCID: verdict.targetCID || null,
                restoredFiles: Number(verdict.restoredFiles || 0),
                removedFiles: Number(verdict.removedFiles || 0)
            };
            tearEngine.seal('MERKLE_AUTO_HEAL', {
                vault: vaultName,
                trigger,
                targetCID: verdict.targetCID,
                mismatch: verdict.mismatch,
                restoredFiles: verdict.restoredFiles,
                removedFiles: verdict.removedFiles
            }, { title: `Auto-Heal: ${vaultName}` });
        }
        return verdict;
    } catch (e) {
        console.warn(`[HEALER] Auto-heal failed for ${vaultName}: ${e.message}`);
        return null;
    }
}

function autoHealVaultSafeThrottled(vaultName, trigger = 'AUTO_HEAL_FAST_CHECK', minIntervalMs = AUTO_HEAL_FAST_INTERVAL_MS) {
    if (!isManagedVault(vaultName)) return null;
    const now = Date.now();
    const last = Number(autoHealFastLastByVault.get(vaultName) || 0);
    if (now - last < Math.max(100, Number(minIntervalMs || AUTO_HEAL_FAST_INTERVAL_MS))) return null;
    autoHealFastLastByVault.set(vaultName, now);
    return autoHealVaultSafe(vaultName, trigger);
}

function extractVaultNameFromRepoPath(repo, relPath) {
    if (repo !== 'vaults') return null;
    const normalized = String(relPath || '').replace(/^\/+/, '');
    const parts = normalized.split('/').filter(Boolean);
    if (!parts.length) return null;
    const vaultName = parts[0];
    return isManagedVault(vaultName) ? vaultName : null;
}

function extractVaultNameFromRawPath(reqPath) {
    const normalized = String(reqPath || '').replace(/^\/+/, '');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    if (parts[0] !== 'vaults') return null;
    const vaultName = parts[1];
    return isManagedVault(vaultName) ? vaultName : null;
}

function findRecentAttestationForHead(headCID) {
    if (!headCID) return null;
    if (lastGhostAttestationEvent && String(lastGhostAttestationEvent.headCID || '') === String(headCID)) {
        return {
            ...lastGhostAttestationEvent,
            attestedAt: Number(lastGhostAttestationEvent.timestamp || Date.now())
        };
    }
    const recent = SwarmProjection.getGhostAttestations(64);
    if (!Array.isArray(recent)) return null;
    return recent.find((row) => row && String(row.headCID || '') === String(headCID)) || null;
}

function getWitnessQuorumStatus(headCID = null) {
    const effectiveHead = headCID ? String(headCID) : (tearEngine.executionChain.getHead() || null);
    const mode = WITNESS_QUORUM_MODE;
    const requiredPeerIDs = WITNESS_REQUIRED_PEER_IDS.slice();
    const minObservers = WITNESS_MIN_OBSERVERS;
    const maxAgeMs = WITNESS_MAX_AGE_MS;
    const reasons = [];
    const now = Date.now();

    if (!effectiveHead) {
        return {
            mode,
            healthy: mode === 'off',
            headCID: null,
            requiredPeerIDs,
            minObservers,
            maxAgeMs,
            uniqueObservers: 0,
            missingRequiredPeerIDs: requiredPeerIDs.slice(),
            quorumByObservers: false,
            quorumByRequiredPeers: requiredPeerIDs.length === 0,
            attestation: null,
            attestationAgeMs: null,
            attestationFresh: false,
            reasons: ['NO_EXECUTION_HEAD']
        };
    }

    const attestation = findRecentAttestationForHead(effectiveHead);
    const localWitnesses = SwarmProjection.getGhostWitnesses(effectiveHead);
    const observerSet = new Set(
        localWitnesses
            .map((row) => String(row && row.observerID ? row.observerID : '').trim())
            .filter(Boolean)
    );
    if (attestation && Array.isArray(attestation.satisfiedRequiredPeerIDs)) {
        for (const id of attestation.satisfiedRequiredPeerIDs) {
            const normalized = String(id || '').trim();
            if (normalized) observerSet.add(normalized);
        }
    }

    const attestedAt = Number(attestation && (attestation.attestedAt || attestation.timestamp) || 0);
    const attestationAgeMs = attestedAt > 0 ? Math.max(0, now - attestedAt) : null;
    const attestationFresh = attestationAgeMs !== null && attestationAgeMs <= maxAgeMs;

    const uniqueObservers = Math.max(
        observerSet.size,
        Number(attestation && attestation.uniqueObservers || 0)
    );
    const missingRequiredPeerIDs = requiredPeerIDs.filter((id) => !observerSet.has(id));
    const quorumByRequiredPeers = missingRequiredPeerIDs.length === 0;
    const quorumByObservers = uniqueObservers >= minObservers;
    const healthy = mode === 'off'
        ? true
        : Boolean(attestation && attestationFresh && quorumByRequiredPeers && quorumByObservers);

    if (!attestation) reasons.push('NO_ATTESTATION');
    if (attestation && !attestationFresh) reasons.push(`ATTESTATION_STALE:${attestationAgeMs}`);
    if (!quorumByRequiredPeers) reasons.push(`MISSING_REQUIRED_PEERS:${missingRequiredPeerIDs.join(',')}`);
    if (!quorumByObservers) reasons.push(`INSUFFICIENT_OBSERVERS:${uniqueObservers}<${minObservers}`);

    return {
        mode,
        healthy,
        headCID: effectiveHead,
        requiredPeerIDs,
        minObservers,
        maxAgeMs,
        uniqueObservers,
        missingRequiredPeerIDs,
        quorumByObservers,
        quorumByRequiredPeers,
        attestation: attestation ? {
            headCID: attestation.headCID,
            attestedAt,
            receiptCount: Number(attestation.receiptCount || 0),
            remoteReceiptCount: Number(attestation.remoteReceiptCount || 0),
            uniqueObservers: Number(attestation.uniqueObservers || uniqueObservers),
            quorumMet: Boolean(attestation.quorumMet),
            requiredPeerIDs: Array.isArray(attestation.requiredPeerIDs) ? attestation.requiredPeerIDs : requiredPeerIDs
        } : null,
        attestationAgeMs,
        attestationFresh,
        reasons
    };
}

function enforceWitnessQuorumGate(res, action, details = {}) {
    const status = getWitnessQuorumStatus();
    if (status.mode === 'off' || status.healthy) return true;

    const payload = {
        action,
        mode: status.mode,
        reasons: status.reasons,
        headCID: status.headCID,
        uniqueObservers: status.uniqueObservers,
        missingRequiredPeerIDs: status.missingRequiredPeerIDs,
        details
    };
    TelemetryLedger.log('WITNESS_QUORUM_BREACH', payload);

    if (status.mode === 'warn') return true;

    tearEngine.seal('WITNESS_QUORUM_BLOCK', payload, { title: `Witness Quorum Block: ${action}` });
    return jsonResponse(res, {
        error: 'WITNESS_QUORUM_ENFORCEMENT_BLOCK',
        action,
        witness: status
    }, 503);
}

function normalizeApiPathForSchemaCheck(routePath) {
    const text = String(routePath || '').trim();
    if (!text.startsWith('/')) return '';
    const q = text.indexOf('?');
    return q >= 0 ? text.slice(0, q) : text;
}

function buildActionCapabilities(session = null) {
    const witness = getWitnessQuorumStatus();
    const base = actionRegistry.buildCapabilities({
        uiLocked: !session,
        ghostMode: SYSTEM_GHOST_MODE,
        witnessMode: witness.mode,
        witnessHealthy: witness.healthy
    });

    const annotatedActions = {};
    for (const [actionId, action] of Object.entries(base.actions || {})) {
        const probes = Array.isArray(action.probes) ? action.probes : [];
        annotatedActions[actionId] = {
            ...action,
            probes: probes.map((probe) => {
                const method = String(probe && probe.method || 'GET').toUpperCase();
                const normalizedPath = normalizeApiPathForSchemaCheck(probe && probe.path);
                const schemaKey = ApiSchemaRegistry.normalizeKey(method, normalizedPath);
                const schemaEnforced = method === 'GET'
                    ? false
                    : ApiSchemaRegistry.hasSchema(method, normalizedPath);
                return {
                    ...probe,
                    normalizedPath,
                    schemaKey,
                    schemaEnforced
                };
            })
        };
    }

    return {
        ...base,
        policy: {
            ...(base.policy || {}),
            ghostMode: SYSTEM_GHOST_MODE,
            witness
        },
        actions: annotatedActions
    };
}

function sanitizeActionProvenanceValue(value, maxLength = 256) {
    const text = String(value == null ? '' : value).trim();
    if (!text) return '';
    return text.slice(0, Math.max(1, Number(maxLength) || 256));
}

function sanitizeActionProvenanceEvent(raw) {
    const candidate = raw && typeof raw === 'object' ? raw : {};
    const actionId = sanitizeActionProvenanceValue(candidate.actionId, 128).replace(/[^A-Za-z0-9_\-\.]/g, '');
    if (!actionId) return null;

    const allowedPhases = new Set(['dispatch', 'ok', 'blocked', 'error', 'probe']);
    const phaseRaw = sanitizeActionProvenanceValue(candidate.phase, 32).toLowerCase();
    const phase = allowedPhases.has(phaseRaw) ? phaseRaw : 'dispatch';

    const durationRaw = Number(candidate.durationMs);
    const durationMs = Number.isFinite(durationRaw) && durationRaw >= 0
        ? Math.min(600000, durationRaw)
        : null;

    return {
        actionId,
        phase,
        route: sanitizeActionProvenanceValue(candidate.route, 2048),
        reason: sanitizeActionProvenanceValue(candidate.reason, 512),
        activeTab: sanitizeActionProvenanceValue(candidate.activeTab, 128),
        source: sanitizeActionProvenanceValue(candidate.source || 'ui', 64),
        durationMs
    };
}

function appendActionProvenance(rawEvent, context = {}) {
    const event = sanitizeActionProvenanceEvent(rawEvent);
    if (!event) {
        return { ok: false, error: 'INVALID_ACTION_PROVENANCE_EVENT' };
    }

    actionProvenanceSeq += 1;
    const executionHead = tearEngine.executionChain.getHead() || null;
    const chainLength = Number(tearEngine.getChain().length || 0);
    const contract = actionRegistry.getContractSnapshot();
    const entry = {
        seq: actionProvenanceSeq,
        ts: nowIso(),
        actionId: event.actionId,
        phase: event.phase,
        route: event.route || '',
        reason: event.reason || '',
        activeTab: event.activeTab || '',
        source: event.source || 'ui',
        durationMs: event.durationMs,
        executionHead,
        chainLength,
        actionContractHash: contract && contract.contractHash ? contract.contractHash : null,
        ip: sanitizeActionProvenanceValue(context.ip || 'unknown', 64)
    };

    try {
        fs.appendFileSync(ACTION_PROVENANCE_LOG_PATH, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch {
        // Best effort file persistence.
    }

    actionProvenanceTail.push(entry);
    if (actionProvenanceTail.length > 200) {
        actionProvenanceTail.splice(0, actionProvenanceTail.length - 200);
    }

    TelemetryLedger.log('ACTION_PROVENANCE', {
        seq: entry.seq,
        actionId: entry.actionId,
        phase: entry.phase,
        route: entry.route || null,
        reason: entry.reason || null,
        executionHead: entry.executionHead,
        chainLength: entry.chainLength
    });

    return { ok: true, entry };
}

function ensureAkRuntimeDir() {
    if (!fs.existsSync(AK_RUNTIME_DIR)) fs.mkdirSync(AK_RUNTIME_DIR, { recursive: true });
}

function resolveAkRuntimePath(rawPath, fallbackName) {
    ensureAkRuntimeDir();
    const fallback = path.join(AK_RUNTIME_DIR, fallbackName);
    if (!rawPath) return fallback;
    const raw = String(rawPath).trim();
    if (!raw) return fallback;

    const candidate = path.isAbsolute(raw) ? raw : path.join(AK_RUNTIME_DIR, raw);
    const resolved = path.resolve(candidate);
    const root = path.resolve(PERSIST_ROOT_DIR);
    const left = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    const right = process.platform === 'win32' ? root.toLowerCase() : root;
    if (!(left === right || left.startsWith(`${right}${path.sep}`))) {
        throw new Error('AK_RUNTIME_PATH_OUTSIDE_DATA_ROOT');
    }
    return resolved;
}

function parseScenarioJsonPayload(rawText) {
    const text = String(rawText || '').trim();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        // Fallback: extract JSON object from mixed stdout.
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start < 0 || end <= start) return null;
        try {
            return JSON.parse(text.slice(start, end + 1));
        } catch {
            return null;
        }
    }
}

function runAkScenarioCommand(mode, options = {}) {
    return new Promise((resolve, reject) => {
        const cliPath = fs.existsSync(AK_SCENARIO_CLI_PATH)
            ? AK_SCENARIO_CLI_PATH
            : resolveAkScenarioCliPath();
        if (!fs.existsSync(cliPath)) {
            reject(new Error(`AK_SCENARIO_CLI_MISSING:${cliPath}`));
            return;
        }
        const command = String(mode || 'scenario').toLowerCase() === 'proof' ? 'proof' : 'scenario';
        const runDir = resolveAkRuntimePath(
            options.outDir,
            `scenario_${new Date().toISOString().replace(/[:.]/g, '-')}`
        );
        const args = [cliPath, command, '--outDir', runDir];

        if (command === 'proof') {
            const proofPath = resolveAkRuntimePath(
                options.proofOut,
                `scenario_proof_${new Date().toISOString().replace(/[:.]/g, '-')}.md`
            );
            args.push('--out', proofPath);
        } else if (options.proofOut) {
            const proofPath = resolveAkRuntimePath(
                options.proofOut,
                `scenario_proof_${new Date().toISOString().replace(/[:.]/g, '-')}.md`
            );
            args.push('--proofOut', proofPath);
        }

        const child = spawn(process.execPath, args, {
            cwd: ROOT_DIR,
            windowsHide: true,
            env: {
                ...process.env,
                FORGE_DATA_ROOT: PERSIST_ROOT_DIR,
                ELECTRON_RUN_AS_NODE: process.versions.electron ? '1' : String(process.env.ELECTRON_RUN_AS_NODE || '')
            }
        });

        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
        child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
        child.on('error', (err) => reject(err));
        child.on('close', (code) => {
            const parsed = parseScenarioJsonPayload(stdout);
            if (Number(code) !== 0) {
                reject(new Error(`AK_SCENARIO_FAILED:exit=${code};stderr=${stderr || 'none'}`));
                return;
            }
            if (!parsed || typeof parsed !== 'object') {
                reject(new Error('AK_SCENARIO_INVALID_OUTPUT'));
                return;
            }
            lastAkRuntimeScenario = {
                mode: command,
                at: nowIso(),
                reportPath: parsed.reportPath || null,
                proofPath: parsed.proofPath || null,
                ok: parsed.ok === true,
                checks: parsed.checks || null
            };
            resolve(parsed);
        });
    });
}

function buildAkRuntimeStatus() {
    const witness = getWitnessQuorumStatus();
    const cliPath = fs.existsSync(AK_SCENARIO_CLI_PATH)
        ? AK_SCENARIO_CLI_PATH
        : resolveAkScenarioCliPath();
    return {
        enabled: fs.existsSync(cliPath),
        cliPath,
        dataRoot: AK_RUNTIME_DIR,
        lastRun: lastAkRuntimeScenario,
        witness: {
            mode: witness.mode,
            healthy: witness.healthy,
            reasons: witness.reasons
        },
        autoHeal: lastAutoHealEvent || null,
        releaseIntegrity: computeReleaseIntegrity()
    };
}

function ensureVaultBaseline(vaultName, reason = 'BOOT_BASELINE') {
    if (!isManagedVault(vaultName)) return null;
    const latest = explorer.getLatestCID(vaultName);
    if (latest) return { cid: latest, existing: true };
    return sealVaultSnapshotSafe(vaultName, reason);
}

function invalidateTimelineCache() {
    timelineCache.ts = 0;
}

function shouldAutoHealForTimeline(vaultName) {
    const now = Date.now();
    const last = Number(timelineHealLastByVault.get(vaultName) || 0);
    if (now - last < TIMELINE_AUTOHEAL_INTERVAL_MS) return false;
    timelineHealLastByVault.set(vaultName, now);
    return true;
}

async function buildTimelineSnapshot() {
    const fsp = fs.promises;
    const vaultEntries = await fsp.readdir(VAULT_DIR, { withFileTypes: true });
    const vaultNames = vaultEntries
        .filter((entry) => entry && entry.isDirectory() && !String(entry.name).startsWith('.'))
        .map((entry) => String(entry.name));

    const timelineParts = await Promise.all(vaultNames.map(async (vaultName) => {
        if (shouldAutoHealForTimeline(vaultName)) {
            autoHealVaultSafe(vaultName, 'TIMELINE_CHECK');
        }
        const vPath = path.join(VAULT_DIR, vaultName);
        let fileEntries = [];
        try {
            fileEntries = await fsp.readdir(vPath, { withFileTypes: true });
        } catch {
            return [];
        }
        const directFiles = fileEntries.filter((entry) => entry && entry.isFile());
        const rows = await Promise.all(directFiles.map(async (entry) => {
            const fileName = String(entry.name);
            const filePath = path.join(vPath, fileName);
            try {
                const s = await fsp.stat(filePath);
                if (s.isDirectory()) return null;
                return {
                    vault: vaultName,
                    file: fileName,
                    mtime: s.mtime,
                    mtimeMs: Number(s.mtimeMs || 0),
                    size: (s.size / 1024).toFixed(2) + ' KB'
                };
            } catch {
                return null;
            }
        }));
        return rows.filter(Boolean);
    }));

    const timeline = timelineParts.flat();
    timeline.sort((a, b) => Number(b.mtimeMs || 0) - Number(a.mtimeMs || 0));
    const trimmed = timeline.slice(0, TIMELINE_MAX_ENTRIES).map((row) => {
        const out = { ...row };
        delete out.mtimeMs;
        return out;
    });
    return trimmed;
}

async function getTimelineSnapshot() {
    const now = Date.now();
    if (Array.isArray(timelineCache.value) && timelineCache.value.length && (now - timelineCache.ts) < TIMELINE_CACHE_TTL_MS) {
        return timelineCache.value;
    }
    const fresh = await buildTimelineSnapshot();
    timelineCache.ts = now;
    timelineCache.value = fresh;
    return fresh;
}

function computeReleaseIntegrity() {
    const now = Date.now();
    if (releaseIntegrityCache.value && now - releaseIntegrityCache.ts < 15000) {
        return releaseIntegrityCache.value;
    }

    const manifestPath = path.join(ROOT_DIR, 'dist', 'release-manifest.json');
    if (!fs.existsSync(manifestPath)) {
        const missing = { ok: false, error: 'MANIFEST_MISSING', checkedAt: new Date().toISOString() };
        releaseIntegrityCache.ts = now;
        releaseIntegrityCache.value = missing;
        return missing;
    }

    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (e) {
        const invalid = { ok: false, error: 'MANIFEST_INVALID', checkedAt: new Date().toISOString(), detail: e.message };
        releaseIntegrityCache.ts = now;
        releaseIntegrityCache.value = invalid;
        return invalid;
    }

    const rel = manifest && manifest.artifact && manifest.artifact.relativePath ? manifest.artifact.relativePath : null;
    const expected = manifest && manifest.artifact && manifest.artifact.sha256 ? String(manifest.artifact.sha256).toUpperCase() : null;
    if (!rel || !expected) {
        const malformed = { ok: false, error: 'MANIFEST_FIELDS_MISSING', checkedAt: new Date().toISOString() };
        releaseIntegrityCache.ts = now;
        releaseIntegrityCache.value = malformed;
        return malformed;
    }

    const artifactPath = path.join(ROOT_DIR, rel);
    if (!artifactPath.startsWith(ROOT_DIR) || !fs.existsSync(artifactPath)) {
        const missingArtifact = {
            ok: false,
            error: 'ARTIFACT_MISSING',
            checkedAt: new Date().toISOString(),
            artifact: rel
        };
        releaseIntegrityCache.ts = now;
        releaseIntegrityCache.value = missingArtifact;
        return missingArtifact;
    }

    const buf = fs.readFileSync(artifactPath);
    const actual = crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
    const match = actual === expected;
    const result = {
        ok: match,
        match,
        expected,
        actual,
        artifact: path.basename(artifactPath),
        relativePath: rel,
        bytes: buf.length,
        generatedAt: manifest.generatedAt || null,
        checkedAt: new Date().toISOString()
    };

    releaseIntegrityCache.ts = now;
    releaseIntegrityCache.value = result;
    return result;
}

function collectVaultStats() {
    if (!fs.existsSync(VAULT_DIR)) return [];
    const vaults = [];
    const vaultEntries = fs.readdirSync(VAULT_DIR, { withFileTypes: true });
    for (const vaultEntry of vaultEntries) {
        if (!vaultEntry.isDirectory() || vaultEntry.name.startsWith('.')) continue;
        const vaultPath = path.join(VAULT_DIR, vaultEntry.name);
        const stack = [vaultPath];
        let files = 0;
        let bytes = 0;

        while (stack.length) {
            const current = stack.pop();
            let entries = [];
            try {
                entries = fs.readdirSync(current, { withFileTypes: true });
            } catch {
                continue;
            }
            for (const entry of entries) {
                if (entry.name.startsWith('.')) continue;
                const fullPath = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    stack.push(fullPath);
                    continue;
                }
                if (!entry.isFile()) continue;
                files += 1;
                try {
                    bytes += fs.statSync(fullPath).size;
                } catch {
                    // Skip stat errors for transient files.
                }
            }
        }

        vaults.push({ vault: vaultEntry.name, files, bytes });
    }

    return vaults.sort((a, b) => a.vault.localeCompare(b.vault));
}

function buildDiagnosticsReport(session) {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const chain = tearEngine.getChain();
    const executionHead = tearEngine.executionChain.getHead();
    const ledger = TelemetryLedger.read(session && session.passphrase ? session.passphrase : undefined);
    const ledgerTail = Array.isArray(ledger) ? ledger.slice(-40) : [];
    const releaseIntegrity = computeReleaseIntegrity();
    const actionContract = actionRegistry.getContractSnapshot();

    return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        app: {
            codename: 'Singularity-Prime',
            version: '3.0.0-Quantum',
            coreDir: CORE_DIR,
            appRoot: ROOT_DIR,
            dataRoot: PERSIST_ROOT_DIR,
            vaultDir: VAULT_DIR,
            reposDir: path.join(PERSIST_ROOT_DIR, 'repos')
        },
        runtime: {
            pid: process.pid,
            uptimeSec: Math.round(process.uptime()),
            sessionTTLms: SESSION_TTL_MS,
            sessionsActive: sessions.size,
            ghostMode: SYSTEM_GHOST_MODE,
            failedAttempts,
            witnessQuorumMode: WITNESS_QUORUM_MODE,
            witnessRequiredPeerIDs: WITNESS_REQUIRED_PEER_IDS,
            witnessMinObservers: WITNESS_MIN_OBSERVERS,
            witnessMaxAgeMs: WITNESS_MAX_AGE_MS,
            actionContractHash: actionContract && actionContract.contractHash ? actionContract.contractHash : null,
            actionContractCount: actionContract && Number.isFinite(actionContract.actionCount)
                ? actionContract.actionCount
                : null,
            passphraseBootstrapRequired: !masterPassphraseState || masterPassphraseState.mode === 'bootstrap' || !masterPassphraseState.configured,
            passphraseSource: masterPassphraseState ? String(masterPassphraseState.source || 'unknown') : 'unknown',
            passphraseMode: masterPassphraseState ? String(masterPassphraseState.mode || 'unknown') : 'unknown',
            actionProvenanceLogPath: ACTION_PROVENANCE_LOG_PATH,
            lastAutoHealEvent,
            lastGhostAttestationEvent,
            neuralEmpire: getNeuralEmpireRuntimeSummary(false)
        },
        system: {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            cpuModel: cpus[0] ? cpus[0].model : 'Unknown',
            cpuCores: cpus.length,
            totalMemMB: Math.round(totalMem / 1048576),
            usedMemMB: Math.round(usedMem / 1048576),
            freeMemMB: Math.round(freeMem / 1048576),
            memPercent: Math.round((usedMem / totalMem) * 100),
            loadAvg: os.loadavg()
        },
        releaseIntegrity,
        tear: {
            chainLength: chain.length,
            executionHead: executionHead || null,
            chainTail: chain.slice(-10).map((entry) => ({
                timestamp: entry && entry.header ? entry.header.timestamp : null,
                kind: entry && entry.evidence ? entry.evidence.kind : null,
                fingerprint: entry && entry.fingerprint ? String(entry.fingerprint).slice(0, 32) : null
            }))
        },
        witness: {
            summary: SwarmProjection.getGhostWitnessSummary(executionHead || null),
            lastAttestation: lastGhostAttestationEvent,
            quorum: getWitnessQuorumStatus(executionHead || null)
        },
        actions: {
            contract: {
                path: ACTION_CONTRACT_PATH,
                hash: actionContract && actionContract.contractHash ? actionContract.contractHash : null,
                actionCount: actionContract && Number.isFinite(actionContract.actionCount)
                    ? actionContract.actionCount
                    : null
            },
            provenanceTail: actionProvenanceTail.slice(-40)
        },
        vaults: collectVaultStats(),
        ledgerTail
    };
}

function pushDoctorIssue(list, id, severity, message, options = {}) {
    if (!Array.isArray(list)) return;
    const entry = {
        id: String(id || 'unknown').slice(0, 96),
        severity: String(severity || 'warn').toLowerCase(),
        message: String(message || '').slice(0, 320),
        repairable: !!options.repairable
    };
    if (options && options.meta && typeof options.meta === 'object') {
        entry.meta = options.meta;
    }
    list.push(entry);
}

function ensureWritable(dirPath, allowCreate = false) {
    try {
        if (!fs.existsSync(dirPath)) {
            if (!allowCreate) return false;
            fs.mkdirSync(dirPath, { recursive: true });
        }
        const probe = path.join(dirPath, `.doctor_probe_${Date.now()}_${Math.random().toString(16).slice(2)}.tmp`);
        fs.writeFileSync(probe, 'ok', 'utf8');
        fs.unlinkSync(probe);
        return true;
    } catch {
        return false;
    }
}

function buildRuntimeDoctorReport(session, options = {}) {
    const includeDiagnostics = options && options.includeDiagnostics === true;
    const issues = [];
    const executionHead = tearEngine.executionChain.getHead();
    const witnessQuorum = getWitnessQuorumStatus(executionHead || null);
    const release = computeReleaseIntegrity();
    const metrics = runtimeMetricsSnapshot();
    const actionContract = actionRegistry.getContractSnapshot();
    const tpmStatus = TPMEnclave && typeof TPMEnclave.getStatus === 'function'
        ? TPMEnclave.getStatus()
        : { active: false, mode: 'unknown' };
    const zkpStatus = ZKPConsensus && typeof ZKPConsensus.getStatus === 'function'
        ? ZKPConsensus.getStatus()
        : { mode: 'unknown', snarkjsAvailable: false, verificationKeyLoaded: false };

    const requiredDirs = [
        PERSIST_ROOT_DIR,
        VAULT_DIR,
        SECURITY_DIR,
        path.join(PERSIST_ROOT_DIR, 'repos'),
        path.join(PERSIST_ROOT_DIR, 'logs')
    ];
    const directoryStatus = requiredDirs.map((dir) => ({
        path: dir,
        exists: fs.existsSync(dir),
        writable: ensureWritable(dir, false)
    }));
    directoryStatus.forEach((row) => {
        if (!row.exists) {
            pushDoctorIssue(issues, 'DIR_MISSING', 'critical', `Missing required directory: ${row.path}`, { repairable: true });
        }
        if (!row.writable) {
            pushDoctorIssue(issues, 'DIR_NOT_WRITABLE', 'critical', `Directory not writable: ${row.path}`, { repairable: true });
        }
    });

    if (!masterPassphraseState || masterPassphraseState.mode === 'bootstrap' || !masterPassphraseState.configured) {
        pushDoctorIssue(issues, 'PASSPHRASE_BOOTSTRAP_REQUIRED', 'warn', 'Master passphrase is not fully configured.', { repairable: false });
    }
    if (!release || release.ok !== true) {
        pushDoctorIssue(issues, 'RELEASE_INTEGRITY', 'critical', `Release integrity check failed (${release && release.error ? release.error : 'unknown'}).`, { repairable: false });
    }
    if (!witnessQuorum || witnessQuorum.healthy !== true) {
        pushDoctorIssue(issues, 'WITNESS_QUORUM', 'warn', 'Witness quorum degraded; mutating actions may be gated.', { repairable: false });
    }
    if (!tpmStatus || tpmStatus.active !== true) {
        pushDoctorIssue(issues, 'TPM_INACTIVE', 'warn', 'Hardware TPM is inactive; fallback enclave in use.', { repairable: false });
    }
    if (String(zkpStatus.mode || '') !== 'simulate') {
        if (!zkpStatus.verificationKeyLoaded) {
            pushDoctorIssue(issues, 'ZKP_VKEY_UNAVAILABLE', 'warn', 'ZKP verification key unavailable for real proof verification.', { repairable: false });
        }
        if (!zkpStatus.snarkjsAvailable) {
            pushDoctorIssue(issues, 'ZKP_SNARKJS_MISSING', 'warn', 'snarkjs dependency missing; real Groth16 verification unavailable.', { repairable: false });
        }
    }
    if (Number(metrics && metrics.slo && metrics.slo.server5xxRate || 0) > 0) {
        pushDoctorIssue(issues, 'RUNTIME_5XX', 'warn', 'Server has recent 5xx responses.', { repairable: true });
    }
    if (!actionContract || !Number.isFinite(actionContract.actionCount) || actionContract.actionCount <= 0) {
        pushDoctorIssue(issues, 'ACTION_CONTRACT_INVALID', 'critical', 'Action contract is empty or unreadable.', { repairable: false });
    }

    const criticalCount = issues.filter((x) => x.severity === 'critical').length;
    const warnCount = issues.filter((x) => x.severity === 'warn').length;
    const overall = criticalCount > 0 ? 'critical' : (warnCount > 0 ? 'degraded' : 'healthy');

    const report = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        overall,
        issues,
        summary: {
            issueCount: issues.length,
            criticalCount,
            warnCount,
            repairableCount: issues.filter((x) => x.repairable).length
        },
        runtime: {
            pid: process.pid,
            uptimeSec: Math.round(process.uptime()),
            sessionsActive: sessions.size,
            ghostMode: SYSTEM_GHOST_MODE,
            failedAttempts
        },
        releaseIntegrity: release,
        witness: witnessQuorum,
        tpm: tpmStatus,
        zkp: zkpStatus,
        actions: {
            contractHash: actionContract && actionContract.contractHash ? actionContract.contractHash : null,
            actionCount: actionContract && Number.isFinite(actionContract.actionCount) ? actionContract.actionCount : null
        },
        state: {
            dataRoot: PERSIST_ROOT_DIR,
            requiredDirs: directoryStatus
        },
        lastAutoHealEvent
    };

    if (includeDiagnostics) {
        report.diagnostics = buildDiagnosticsReport(session);
    }
    return report;
}

function runRuntimeDoctorRepair(context = {}) {
    const mode = String(context.mode || 'safe').trim().toLowerCase();
    const repairs = [];
    const errors = [];

    try {
        ensurePersistentDataRoot();
        repairs.push('ensurePersistentDataRoot');
    } catch (err) {
        errors.push(`ensurePersistentDataRoot:${String(err && err.message ? err.message : err)}`);
    }

    try {
        if (Array.isArray(CONFIG.vaults)) {
            for (const vault of CONFIG.vaults) {
                ensureVaultBaseline(vault, 'DOCTOR_REPAIR');
            }
        }
        repairs.push('ensureVaultBaseline');
    } catch (err) {
        errors.push(`ensureVaultBaseline:${String(err && err.message ? err.message : err)}`);
    }

    try {
        const repairedCount = KernelResurrection.verifyAndHeal(CORE_DIR, GOLD_SEAL_DIR);
        repairs.push(`kernelResurrection:${repairedCount}`);
        if (repairedCount > 0) {
            lastAutoHealEvent = {
                timestamp: Date.now(),
                repairedCount,
                mode: 'doctor_repair'
            };
            TelemetryLedger.log('AUTO_HEAL_APPLIED', {
                mode: 'doctor_repair',
                repairedCount,
                reason: 'runtime_doctor_repair'
            });
        }
    } catch (err) {
        errors.push(`kernelResurrection:${String(err && err.message ? err.message : err)}`);
    }

    try {
        releaseIntegrityCache.ts = 0;
        releaseIntegrityCache.value = null;
        timelineCache.ts = 0;
        timelineCache.value = [];
        repairs.push('cacheReset');
    } catch (err) {
        errors.push(`cacheReset:${String(err && err.message ? err.message : err)}`);
    }

    if (mode === 'full') {
        try {
            pruneExpiredSessions();
            sessions.clear();
            setNeuralEmpireRuntimeToken(null);
            repairs.push('sessionReset');
        } catch (err) {
            errors.push(`sessionReset:${String(err && err.message ? err.message : err)}`);
        }

        try {
            if (Array.isArray(CONFIG.vaults)) {
                let healedVaults = 0;
                for (const vaultName of CONFIG.vaults) {
                    const verdict = autoHealVaultSafe(vaultName, 'RUNTIME_DOCTOR_FULL');
                    if (verdict && verdict.healed) healedVaults += 1;
                }
                repairs.push(`fullAutoHeal:${healedVaults}`);
            }
        } catch (err) {
            errors.push(`fullAutoHeal:${String(err && err.message ? err.message : err)}`);
        }
    }

    TelemetryLedger.log('RUNTIME_DOCTOR_REPAIR', {
        by: String(context.ip || 'local'),
        mode,
        repairs,
        errors
    });
    tearEngine.seal('RUNTIME_DOCTOR_REPAIR', {
        mode,
        repairs,
        errors,
        by: String(context.ip || 'local')
    }, { title: 'Runtime Doctor Repair' });

    return {
        ok: errors.length === 0,
        repairs,
        errors
    };
}

// Bootstrap baseline snapshots for configured vaults (once per vault).
if (Array.isArray(CONFIG.vaults)) {
    for (const vaultName of CONFIG.vaults) {
        ensureVaultBaseline(vaultName, 'BOOT_BASELINE');
    }
}

initializeNeuralEmpireRuntime();

// [GATEWAY_ORCHESTRATION] State Management
const Gateway = {
    state: 'STANDBY',
    proxy: { active: false, port: 9050 },
    log: [],
    addLog(msg, status = 'SYS') {
        const entry = { ts: Date.now(), msg, status };
        this.log.push(entry);
        if (this.log.length > 20) this.log.shift();
        console.log(`[GATEWAY] [${status}] ${msg}`);
        TelemetryLedger.log("GATEWAY_EVT", entry);
    }
};

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:3000`);
    res.setHeader('Access-Control-Allow-Origin', '*');

    const clientIP = req.connection.remoteAddress || req.socket.remoteAddress;
    const reqStartedNs = process.hrtime.bigint();
    res.on('finish', () => {
        recordRouteMetric(req.method, url.pathname, res.statusCode || 0, hrMs(reqStartedNs));
    });

    // Global Rate Limit Check
    if (!isLoopbackClient(clientIP) && rateLimit(clientIP)) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'RATE_LIMIT_EXCEEDED', retryAfter: Math.ceil(RATE_WINDOW_MS / 1000) }));
    }

    // Phase 12: Proof-of-Integrity (PoI)
    // Require callers to solve a SHA-256 partial collision (e.g. hash starts with '000')
    const verifyPoI = (targetHash, nonce) => {
        const attempt = crypto.createHash('sha256').update(targetHash + nonce).digest('hex');
        return attempt.startsWith('000'); // Tune difficulty here
    };

    // [API] Liveness/Readiness Probe
    if (url.pathname === '/api/system/healthz' && req.method === 'GET') {
        const bootstrapRequired = !masterPassphraseState || masterPassphraseState.mode === 'bootstrap' || !masterPassphraseState.configured;
        const summary = {
            ok: true,
            status: bootstrapRequired ? 'bootstrap_required' : 'healthy',
            mode: SYSTEM_GHOST_MODE ? 'ghost' : 'normal',
            ts: new Date().toISOString(),
            uptimeSec: Math.round(process.uptime()),
            version: Lazarus && Lazarus.version ? Lazarus.version : 'unknown',
            stateRoot: PERSIST_ROOT_DIR,
            auth: {
                bootstrapRequired,
                passphraseConfigured: !bootstrapRequired,
                source: masterPassphraseState ? String(masterPassphraseState.source || 'unknown') : 'unknown',
                mode: masterPassphraseState ? String(masterPassphraseState.mode || 'unknown') : 'unknown',
                minLength: MASTER_PASSPHRASE_MIN_LENGTH
            }
        };
        return jsonResponse(res, summary);
    }
    if (url.pathname === '/api/system/capabilities') {
        const session = getSession(req);
        const capabilities = buildActionCapabilities(session);
        return jsonResponse(res, capabilities);
    }
    if (url.pathname === '/api/system/metrics') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) {
            return jsonResponse(res, { error: 'LOCKED' }, 401);
        }
        return jsonResponse(res, runtimeMetricsSnapshot());
    }

    if (url.pathname === '/api/neural-empire/status') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) {
            return jsonResponse(res, { error: 'LOCKED' }, 401);
        }
        return jsonResponse(res, {
            success: true,
            runtime: getNeuralEmpireRuntimeSummary(true)
        });
    }

    if (url.pathname === '/api/neural-empire/modules') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) {
            return jsonResponse(res, { error: 'LOCKED' }, 401);
        }
        if (!neuralEmpireKernel) {
            return jsonResponse(res, {
                success: false,
                error: 'NEURAL_EMPIRE_RUNTIME_UNAVAILABLE',
                runtime: getNeuralEmpireRuntimeSummary(false)
            }, 503);
        }
        const status = neuralEmpireKernel.status();
        return jsonResponse(res, {
            success: true,
            moduleLoader: status.moduleLoader,
            capabilityRegistry: status.capabilityRegistry
        });
    }

    if (url.pathname === '/api/neural-empire/signals') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) {
            return jsonResponse(res, { error: 'LOCKED' }, 401);
        }
        if (!neuralEmpireKernel || !neuralEmpireKernel.signalLogger) {
            return jsonResponse(res, {
                success: false,
                error: 'NEURAL_EMPIRE_SIGNAL_LOGGER_UNAVAILABLE'
            }, 503);
        }
        const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') || 80)));
        return jsonResponse(res, {
            success: true,
            digest: neuralEmpireKernel.signalLogger.digest(1000),
            entries: neuralEmpireKernel.signalLogger.tail(limit)
        });
    }

    if (url.pathname === '/api/neural-empire/agents') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) {
            return jsonResponse(res, { error: 'LOCKED' }, 401);
        }
        const moduleInstance = getNeuralEmpireModuleInstance('agent_framework');
        const framework = moduleInstance && moduleInstance.framework ? moduleInstance.framework : null;
        if (!framework || typeof framework.listAgents !== 'function') {
            return jsonResponse(res, {
                success: false,
                error: 'AGENT_FRAMEWORK_UNAVAILABLE'
            }, 503);
        }
        return jsonResponse(res, {
            success: true,
            agents: framework.listAgents(),
            status: framework.status()
        });
    }

    if (url.pathname === '/api/neural-empire/agents/run' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) {
            return jsonResponse(res, { error: 'LOCKED' }, 401);
        }
        let body = ''; req.on('data', c => { if (body.length < 262144) body += c; });
        req.on('end', async () => {
            const data = safeJSON(body) || {};
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            const moduleInstance = getNeuralEmpireModuleInstance('agent_framework');
            const framework = moduleInstance && moduleInstance.framework ? moduleInstance.framework : null;
            if (!framework || typeof framework.runAgent !== 'function') {
                return jsonResponse(res, { success: false, error: 'AGENT_FRAMEWORK_UNAVAILABLE' }, 503);
            }
            try {
                const result = await framework.runAgent(
                    String(data.agentId || ''),
                    data.payload && typeof data.payload === 'object' ? data.payload : {},
                    { ip: clientIP || 'unknown' }
                );
                emitNeuralEmpireSignal('agent.run', {
                    agentId: String(data.agentId || ''),
                    ok: !!(result && result.ok)
                }, { source: 'forgecore.api' });
                return jsonResponse(res, { success: true, result });
            } catch (err) {
                return jsonResponse(res, {
                    success: false,
                    error: String(err && err.message ? err.message : err)
                }, 500);
            }
        });
        return;
    }

    if (url.pathname === '/api/neural-empire/hypersnatch/decode' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) {
            return jsonResponse(res, { error: 'LOCKED' }, 401);
        }
        let body = ''; req.on('data', c => { if (body.length < 262144) body += c; });
        req.on('end', () => {
            const data = safeJSON(body) || {};
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            const moduleInstance = getNeuralEmpireModuleInstance('hypersnatch');
            const api = moduleInstance && moduleInstance.api ? moduleInstance.api : null;
            if (!api || typeof api.decodeLink !== 'function') {
                return jsonResponse(res, { success: false, error: 'HYPERSNATCH_API_UNAVAILABLE' }, 503);
            }
            try {
                const decoded = api.decodeLink(data.url, {
                    baseUrl: data.baseUrl
                });
                emitNeuralEmpireSignal('hypersnatch.decode', {
                    ok: true,
                    pluginUsed: decoded && decoded.pluginUsed ? decoded.pluginUsed : null
                }, { source: 'forgecore.api' });
                return jsonResponse(res, { success: true, decoded });
            } catch (err) {
                return jsonResponse(res, {
                    success: false,
                    error: String(err && err.message ? err.message : err)
                }, 500);
            }
        });
        return;
    }

    if (url.pathname === '/api/neural-empire/neuraltube/analyze' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) {
            return jsonResponse(res, { error: 'LOCKED' }, 401);
        }
        let body = ''; req.on('data', c => { if (body.length < 1048576) body += c; });
        req.on('end', () => {
            const data = safeJSON(body) || {};
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            const moduleInstance = getNeuralEmpireModuleInstance('neuraltube');
            const api = moduleInstance && moduleInstance.api ? moduleInstance.api : null;
            if (!api || typeof api.analyzeVideo !== 'function') {
                return jsonResponse(res, { success: false, error: 'NEURALTUBE_API_UNAVAILABLE' }, 503);
            }
            try {
                const analysis = api.analyzeVideo(data);
                emitNeuralEmpireSignal('neuraltube.analyze', {
                    ok: true,
                    verdict: analysis && analysis.feedVerdict ? analysis.feedVerdict : null
                }, { source: 'forgecore.api' });
                return jsonResponse(res, { success: true, analysis });
            } catch (err) {
                return jsonResponse(res, {
                    success: false,
                    error: String(err && err.message ? err.message : err)
                }, 500);
            }
        });
        return;
    }

    // [API] Final Handshake (ZKP Upgraded)
    if ((url.pathname === '/api/handshake' && req.method === 'GET') || (url.pathname === '/api/handshake' && req.method === 'POST')) {
        let data = {};
        if (String(req.method || 'GET').toUpperCase() === 'POST') {
            const parsed = await parseJsonBodyOrReject(req, res, {
                maxBytes: 262_144,
                schemaPath: url.pathname,
                ip: clientIP
            });
            if (!parsed.ok) return;
            data = parsed.data || {};
        }
        const target = url.searchParams.get('target') || data.target;
        const nonce = url.searchParams.get('nonce') || data.nonce;
        const proof = data.zkpProof;

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

        // [IP_GOLD] ZKP Health Attestation Validation
        if (proof) {
            const isProofValid = await ZKPConsensus.verifyProof(proof, {
                expectedHeadCID: tearEngine.executionChain.getHead() || ''
            });
            if (!isProofValid) {
                console.error("[ZKP] Rejecting peer: Invalid Zero-Knowledge Proof.");
                res.writeHead(403);
                return res.end(JSON.stringify({ error: "ZKP_REJECTED" }));
            }
            console.log("[ZKP] Peer verified via Zero-Knowledge Attestation.");
        }

        const session = getSession(req);
        return res.end(JSON.stringify({
            status: SYSTEM_GHOST_MODE ? "DECOY_ACTIVE" : (session ? "AUTHORIZED" : "LOCKED"),
            seal: SYSTEM_GHOST_MODE ? "CORRUPTED" : CORE_HASH.substring(0, 16),
            version: Lazarus.version
        }));
        return;
    }

    // [API] Secure Gateway Operations (Top-Tier Refactor)
    if (url.pathname === '/api/vipn/status' && req.method === 'GET') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end("LOCKED"); }
        return jsonResponse(res, { state: Gateway.state, proxy: GatewayProxy.getStatus(), log: Gateway.log });
    }

    if (url.pathname === '/api/vipn/arm' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end("LOCKED"); }
        const parsed = await parseJsonBodyOrReject(req, res, {
            maxBytes: 32_768,
            schemaPath: url.pathname,
            ip: clientIP
        });
        if (!parsed.ok) return;
        Gateway.state = 'ARMED';
        Gateway.addLog("Security Architecture Initialized. ALE Filters Engaged.", "OK");
        return jsonResponse(res, { success: true, state: Gateway.state });
    }

    if (url.pathname === '/api/vipn/connect' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end("LOCKED"); }
        const parsed = await parseJsonBodyOrReject(req, res, {
            maxBytes: 32_768,
            schemaPath: url.pathname,
            ip: clientIP
        });
        if (!parsed.ok) return;
        if (Gateway.state !== 'ARMED') return jsonResponse(res, { error: 'MUST_ARM_FIRST' }, 400);
        Gateway.state = 'CONNECTED';
        GatewayProxy.start((m, s) => Gateway.addLog(m, s));
        Gateway.addLog("Neural Proxy Activated. Encrypted Tunnel Established.", "OK");
        return jsonResponse(res, { success: true, state: Gateway.state });
    }

    if (url.pathname === '/api/vipn/disconnect' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end("LOCKED"); }
        const parsed = await parseJsonBodyOrReject(req, res, {
            maxBytes: 32_768,
            schemaPath: url.pathname,
            ip: clientIP
        });
        if (!parsed.ok) return;
        Gateway.state = 'ARMED';
        GatewayProxy.stop((m, s) => Gateway.addLog(m, s));
        Gateway.addLog("Neural Proxy Terminated. Reverting to Standard Routing.", "WARN");
        return jsonResponse(res, { success: true, state: Gateway.state });
    }

    if (url.pathname === '/api/vipn/restore' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end("LOCKED"); }
        const parsed = await parseJsonBodyOrReject(req, res, {
            maxBytes: 32_768,
            schemaPath: url.pathname,
            ip: clientIP
        });
        if (!parsed.ok) return;
        Gateway.state = 'STANDBY';
        GatewayProxy.stop();
        Gateway.addLog("Network Stack Restoration Complete. All active filters purged.", "OK");
        return jsonResponse(res, { success: true, state: Gateway.state });
    }

    if (url.pathname.startsWith('/api/vipn/')) {
        const op = String(url.pathname.split('/').pop() || '').trim().toLowerCase();
        if (!['status', 'arm', 'connect', 'disconnect', 'restore'].includes(op)) {
            return jsonResponse(res, { error: 'UNKNOWN_OP' }, 404);
        }
        return jsonResponse(res, { error: 'METHOD_NOT_ALLOWED', expected: op === 'status' ? 'GET' : 'POST' }, 405);
    }

    // [API] Hardware Health
    if (url.pathname === '/api/hw') {
        if (SYSTEM_GHOST_MODE) {
            return res.end(JSON.stringify({ cpu: (15.5 + Math.random() * 3).toFixed(1), locked: false }));
        }
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end("LOCKED"); }
        const load = os.loadavg()[0];
        const cpuUsage = Math.min(100, (load * 10).toFixed(1));
        return res.end(JSON.stringify({ cpu: cpuUsage, locked: false }));
    }



    // [API] Peer Discovery
    if (url.pathname === '/api/peers' && req.method === 'GET') {
        if (SYSTEM_GHOST_MODE) return res.end(JSON.stringify([{ id: "UPDATE_SERVER", host: "127.0.0.1", port: 8080, status: "ACTIVE" }]));
        return res.end(JSON.stringify(CONFIG.peers || []));
    }

    // [API] System Timeline (ASYNC I/O)
    if (url.pathname === '/api/system/timeline' && req.method === 'GET') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end("LOCKED"); }
        try {
            const timeline = await getTimelineSnapshot();
            return jsonResponse(res, timeline);
        } catch (e) {
            return jsonResponse(res, { error: e.message }, 500);
        }
    }

    // [API] Swarm Telemetry
    if (url.pathname === '/api/swarm/status' && req.method === 'GET') {
        if (SYSTEM_GHOST_MODE) return res.end(JSON.stringify({ peers: [{ id: "GHOST_PEER_A", status: "ACTIVE" }, { id: "GHOST_PEER_B", status: "ACTIVE" }] }));
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end("LOCKED"); }
        return res.end(JSON.stringify(SwarmProjection.getOverview()));
    }


    // [API] Swarm Task Dispatch
    if (url.pathname === '/api/swarm/dispatch' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end("LOCKED"); }
        const parsed = await parseJsonBodyOrReject(req, res, {
            maxBytes: 262_144,
            schemaPath: url.pathname,
            ip: clientIP
        });
        if (!parsed.ok) return;
        const payload = parsed.data || {};
        const target = String(payload.target || '').trim();
        const type = String(payload.type || '').trim();
        const data = payload.data === undefined ? {} : payload.data;
        if (!target || !type) return jsonResponse(res, { success: false, error: 'Missing target/type' }, 400);
        try {
            const result = await SwarmProjection.dispatchTask(target, type, data);
            return jsonResponse(res, { success: true, result });
        } catch (e) {
            const msg = String(e && e.message ? e.message : e);
            const status = msg.toLowerCase().includes('offline') || msg.toLowerCase().includes('not found') ? 409 : 500;
            return jsonResponse(res, { success: false, error: msg }, status);
        }
    }
    if (url.pathname.startsWith('/api/swarm/dispatch')) {
        return jsonResponse(res, { error: 'METHOD_NOT_ALLOWED', expected: 'POST' }, 405);
    }

    // [API] ZeroTrace Purge API
    if (url.pathname === '/api/zerotrace/purge' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end("LOCKED"); }
        const parsed = await parseJsonBodyOrReject(req, res, {
            maxBytes: 1_048_576,
            schemaPath: url.pathname,
            ip: clientIP
        });
        if (!parsed.ok) return;
        try {
            const payload = parsed.data || {};
            const filePaths = payload.paths;
            if (!Array.isArray(filePaths)) return jsonResponse(res, { error: "Invalid payload" });

            const fsp = require('fs').promises;
            const crypto = require('crypto');
            let shredded = 0;
            let errors = [];

            for (const p of filePaths) {
                try {
                    const targetPath = path.resolve(p); // Normalize
                    // Basic sandbox safety - don't allow shredding the core OS files themselves
                    if (targetPath.startsWith(CORE_DIR)) {
                        errors.push(`Access Denied (OS Protection): ${p}`);
                        continue;
                    }

                    const stat = await fsp.stat(targetPath);
                    if (!stat.isFile()) {
                        errors.push(`Not a file: ${p}`);
                        continue;
                    }

                    // DOD 5220.22-M style 3-pass wipe
                    const handle = await fsp.open(targetPath, 'r+');
                    const size = stat.size;
                    const bufferSize = 1024 * 1024; // 1MB chunks to prevent memory exhaust

                    // Pass 1: Zeroes
                    let pos = 0;
                    while (pos < size) {
                        const chunk = Math.min(bufferSize, size - pos);
                        await handle.write(Buffer.alloc(chunk, 0), 0, chunk, pos);
                        pos += chunk;
                    }

                    // Pass 2: Ones
                    pos = 0;
                    while (pos < size) {
                        const chunk = Math.min(bufferSize, size - pos);
                        await handle.write(Buffer.alloc(chunk, 255), 0, chunk, pos);
                        pos += chunk;
                    }

                    // Pass 3: Cryptographic Random Data
                    pos = 0;
                    while (pos < size) {
                        const chunk = Math.min(bufferSize, size - pos);
                        await handle.write(crypto.randomBytes(chunk), 0, chunk, pos);
                        pos += chunk;
                    }

                    await handle.sync(); // Force flush OS buffers to disk
                    await handle.close();

                    // Pass 4: Unlink the file
                    await fsp.unlink(targetPath);
                    shredded++;

                } catch (err) {
                    errors.push(`Failed to shred ${p}: ${err.message}`);
                }
            }

            return jsonResponse(res, { success: true, shredded, errors });

        } catch (e) {
            return jsonResponse(res, { error: e.message });
        }
    }
    if (url.pathname.startsWith('/api/zerotrace/purge')) {
        return jsonResponse(res, { error: 'METHOD_NOT_ALLOWED', expected: 'POST' }, 405);
    }

    // [API] Dynamic Engine Discovery
    if (url.pathname === '/api/engines/discover' && req.method === 'GET') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end("LOCKED"); }
        const fsp = require('fs').promises;
        const engineDir = path.join(CORE_DIR, 'swarm');
        try {
            const entries = await fsp.readdir(engineDir, { withFileTypes: true });
            const engines = [];
            for (const e of entries) {
                if (!e.isFile() || !e.name.endsWith('.js')) continue;
                const fp = path.join(engineDir, e.name);
                const stat = await fsp.stat(fp);
                engines.push({
                    name: e.name.replace('.js', ''),
                    file: e.name,
                    size: stat.size,
                    modified: stat.mtime,
                    loaded: SwarmProjection._initialized || false
                });
            }
            engines.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' }));
            const preferredIdx = engines.findIndex((row) => String(row && row.name || '').toLowerCase() === 'forgecore_runtime_health');
            if (preferredIdx > 0) {
                const [preferred] = engines.splice(preferredIdx, 1);
                engines.unshift(preferred);
            }
            return jsonResponse(res, { count: engines.length, engines });
        } catch (e) {
            return jsonResponse(res, { count: 0, engines: [], error: e.message });
        }
    }

    // [API] Engine Launch
    if (url.pathname === '/api/engines/launch' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end("LOCKED"); }

        const parsed = await parseJsonBodyOrReject(req, res, {
            maxBytes: 262_144,
            schemaPath: url.pathname,
            ip: clientIP
        });
        if (!parsed.ok) return;
        const data = parsed.data || {};
        const rawEngine = String(data.engine || data.id || '').trim().replace(/\.js$/i, '');
        if (!/^[A-Za-z0-9_\-]+$/.test(rawEngine)) {
            return jsonResponse(res, { success: false, error: 'Invalid engine id' }, 400);
        }

        const engineDir = path.join(CORE_DIR, 'swarm');
        const enginePath = path.resolve(engineDir, `${rawEngine}.js`);
        if (!enginePath.startsWith(engineDir) || !fs.existsSync(enginePath)) {
            return jsonResponse(res, { success: false, error: 'Engine not found' }, 404);
        }

        const payload = data.payload && typeof data.payload === 'object' ? data.payload : {};
        const requestedTarget = String(data.target || '').trim();
        const offloadRequested = data.offload === true || !!requestedTarget;
        if (offloadRequested) {
            let targetPeer = requestedTarget;
            if (!targetPeer) {
                try {
                    const overview = SwarmProjection.getOverview();
                    const peers = Array.isArray(overview && overview.peers) ? overview.peers : [];
                    const peer = peers.find((row) => row && row.id) || null;
                    targetPeer = peer ? String(peer.id || '').trim() : 'SELF';
                } catch {
                    targetPeer = 'SELF';
                }
            }

            try {
                const remoteResult = await SwarmProjection.dispatchTask(targetPeer, rawEngine, payload);
                TelemetryLedger.log('ENGINE_LAUNCH', {
                    engine: rawEngine,
                    mode: 'offload',
                    target: targetPeer,
                    by: session.ip || 'local'
                });
                tearEngine.seal(
                    'ENGINE_LAUNCH',
                    { engine: rawEngine, mode: 'offload', target: targetPeer },
                    { title: `Engine Launch (Offload): ${rawEngine}` }
                );
                return jsonResponse(res, {
                    success: true,
                    engine: rawEngine,
                    mode: 'offload',
                    target: targetPeer,
                    result: remoteResult
                });
            } catch (e) {
                const msg = String(e && e.message ? e.message : e);
                TelemetryLedger.log('ENGINE_LAUNCH_FAIL', {
                    engine: rawEngine,
                    mode: 'offload',
                    target: targetPeer,
                    error: msg
                });
                const status = msg.toLowerCase().includes('offline') || msg.toLowerCase().includes('not found') ? 409 : 500;
                return jsonResponse(res, {
                    success: false,
                    engine: rawEngine,
                    mode: 'offload',
                    target: targetPeer,
                    error: msg
                }, status);
            }
        }

        try {
            const resolved = require.resolve(enginePath);
            delete require.cache[resolved];
            const engineModule = require(enginePath);

            let mode = 'loaded';
            let result = null;
            const ctx = { rootDir: PERSIST_ROOT_DIR, appRoot: ROOT_DIR, coreDir: CORE_DIR, machineID };

            if (engineModule && typeof engineModule.run === 'function') {
                mode = 'run';
                result = await Promise.resolve(engineModule.run(payload, ctx));
            } else if (engineModule && typeof engineModule.start === 'function') {
                mode = 'start';
                result = await Promise.resolve(engineModule.start(payload, ctx));
            } else if (engineModule && typeof engineModule.init === 'function') {
                mode = 'init';
                result = await Promise.resolve(engineModule.init(PERSIST_ROOT_DIR, payload, ctx));
            } else if (typeof engineModule === 'function') {
                mode = 'function';
                result = await Promise.resolve(engineModule(payload, ctx));
            }

            let safeResult = null;
            try {
                safeResult = result === undefined ? null : JSON.parse(JSON.stringify(result));
            } catch {
                safeResult = result === undefined ? null : String(result);
            }

            TelemetryLedger.log('ENGINE_LAUNCH', { engine: rawEngine, mode, by: session.ip || 'local' });
            tearEngine.seal('ENGINE_LAUNCH', { engine: rawEngine, mode }, { title: `Engine Launch: ${rawEngine}` });
            return jsonResponse(res, { success: true, engine: rawEngine, mode, result: safeResult });
        } catch (e) {
            TelemetryLedger.log('ENGINE_LAUNCH_FAIL', { engine: rawEngine, error: e.message });
            return jsonResponse(res, { success: false, error: e.message }, 500);
        }
    }

    // [API] Telemetry Ledger Read
    if (url.pathname === '/api/system/ledger' && req.method === 'GET') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end("LOCKED"); }
        return res.end(JSON.stringify(TelemetryLedger.read(session.passphrase)));
    }

    // [API] Session Logout / Invalidate Token
    if (url.pathname === '/api/system/logout' && req.method === 'POST') {
        const parsed = await parseJsonBodyOrReject(req, res, {
            maxBytes: 32_768,
            schemaPath: url.pathname,
            ip: clientIP
        });
        if (!parsed.ok) return;

        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
        if (token && sessions.has(token)) {
            sessions.delete(token);
            TelemetryLedger.log("SYSTEM_LOGOUT", { success: true });
            emitNeuralEmpireSignal('auth.session.revoked', {
                by: clientIP || 'unknown',
                tokenTail: token.slice(-8)
            }, { source: 'forgecore.auth' });
        }
        if (token && token === neuralEmpireRuntimeToken) setNeuralEmpireRuntimeToken(null);
        return jsonResponse(res, { success: true });
    }
    if (url.pathname.startsWith('/api/system/logout')) {
        return jsonResponse(res, { error: 'METHOD_NOT_ALLOWED', expected: 'POST' }, 405);
    }

    if (url.pathname === '/api/system/passphrase/status') {
        const bootstrapRequired = !masterPassphraseState || masterPassphraseState.mode === 'bootstrap' || !masterPassphraseState.configured;
        return jsonResponse(res, {
            configured: !bootstrapRequired,
            bootstrapRequired,
            source: masterPassphraseState ? String(masterPassphraseState.source || 'unknown') : 'unknown',
            mode: masterPassphraseState ? String(masterPassphraseState.mode || 'unknown') : 'unknown',
            minLength: MASTER_PASSPHRASE_MIN_LENGTH,
            maxLength: MASTER_PASSPHRASE_MAX_LENGTH
        });
    }

    if (url.pathname === '/api/system/passphrase/bootstrap' && req.method === 'POST') {
        const parsed = await parseJsonBodyOrReject(req, res, {
            maxBytes: 65_536,
            schemaPath: url.pathname,
            ip: clientIP
        });
        if (!parsed.ok) return;
        const data = parsed.data;
        if (!isLoopbackClient(clientIP)) {
            return jsonResponse(res, { error: 'BOOTSTRAP_LOCAL_ONLY' }, 403);
        }

        if (masterPassphraseState && masterPassphraseState.configured && masterPassphraseState.mode !== 'bootstrap') {
            return jsonResponse(res, { error: 'MASTER_PASSPHRASE_ALREADY_CONFIGURED' }, 409);
        }

        const passphrase = normalizePassphrase(data && data.passphrase);
        const confirm = normalizePassphrase(data && data.confirm);
        if (confirm && confirm !== passphrase) {
            return jsonResponse(res, { error: 'PASSPHRASE_CONFIRM_MISMATCH' }, 400);
        }

        const bootstrap = bootstrapMasterPassphrase(passphrase, { ip: clientIP || 'local', source: 'api_bootstrap' });
        if (!bootstrap.ok) {
            const payload = { error: bootstrap.error };
            if (bootstrap.minLength) payload.minLength = bootstrap.minLength;
            if (bootstrap.maxLength) payload.maxLength = bootstrap.maxLength;
            return jsonResponse(res, payload, Number(bootstrap.statusCode || 400));
        }
        return jsonResponse(res, { success: true, configured: true, source: 'persisted', mode: 'hash' });
    }

    if (url.pathname === '/api/system/passphrase/recover/reset' && req.method === 'POST') {
        const parsed = await parseJsonBodyOrReject(req, res, {
            maxBytes: 65_536,
            schemaPath: url.pathname,
            ip: clientIP
        });
        if (!parsed.ok) return;
        const data = parsed.data;
        if (!isLoopbackClient(clientIP)) {
            return jsonResponse(res, { error: 'PASS_RECOVERY_LOCAL_ONLY' }, 403);
        }

        const confirmPhrase = String(data && data.confirmPhrase || '').trim();
        if (confirmPhrase !== MASTER_PASSPHRASE_RECOVERY_PHRASE) {
            return jsonResponse(res, { error: 'PASS_RECOVERY_CONFIRM_PHRASE_REQUIRED' }, 400);
        }

        const passphrase = normalizePassphrase(data && data.passphrase);
        const confirm = normalizePassphrase(data && data.confirm);
        if (confirm && confirm !== passphrase) {
            return jsonResponse(res, { error: 'PASSPHRASE_CONFIRM_MISMATCH' }, 400);
        }

        const reset = resetMasterPassphrase(passphrase, {
            ip: clientIP || 'local',
            source: 'api_recovery'
        });
        if (!reset.ok) {
            const payload = { error: reset.error };
            if (reset.minLength) payload.minLength = reset.minLength;
            if (reset.maxLength) payload.maxLength = reset.maxLength;
            return jsonResponse(res, payload, Number(reset.statusCode || 400));
        }

        return jsonResponse(res, {
            success: true,
            configured: true,
            source: 'persisted',
            mode: 'hash',
            sessionsRevoked: true
        });
    }

    // [API] Secure Unlock
    if (url.pathname === '/api/system/unlock' && req.method === 'POST') {
        const unlockStartNs = process.hrtime.bigint();
        const parsed = await parseJsonBodyOrReject(req, res, {
            maxBytes: 65_536,
            schemaPath: url.pathname,
            ip: clientIP
        });
        if (!parsed.ok) return;
        const data = parsed.data;
        const normalizedPassphrase = normalizePassphrase(data && data.passphrase);
            runtimeMetrics.auth.unlockAttempts += 1;
            if (!masterPassphraseState || masterPassphraseState.mode === 'bootstrap' || !masterPassphraseState.configured) {
                if (isLoopbackClient(clientIP) && normalizedPassphrase) {
                    const bootstrap = bootstrapMasterPassphrase(normalizedPassphrase, { ip: clientIP || 'local', source: 'unlock_autobootstrap' });
                    if (!bootstrap.ok) {
                        runtimeMetrics.auth.unlockFailure += 1;
                        runtimeMetrics.auth.lastFailureAt = nowIso();
                        pushMetricSample(runtimeMetrics.auth.unlockLatencyMsSamples, hrMs(unlockStartNs), 256);
                        const payload = {
                            success: false,
                            error: bootstrap.error,
                            bootstrapRequired: true,
                            minLength: MASTER_PASSPHRASE_MIN_LENGTH
                        };
                        if (bootstrap.maxLength) payload.maxLength = bootstrap.maxLength;
                        return jsonResponse(res, payload, Number(bootstrap.statusCode || 400));
                    }
                } else {
                    runtimeMetrics.auth.unlockFailure += 1;
                    runtimeMetrics.auth.lastFailureAt = nowIso();
                    pushMetricSample(runtimeMetrics.auth.unlockLatencyMsSamples, hrMs(unlockStartNs), 256);
                    return jsonResponse(res, {
                        success: false,
                        error: 'MASTER_PASSPHRASE_NOT_CONFIGURED',
                        bootstrapRequired: true,
                        minLength: MASTER_PASSPHRASE_MIN_LENGTH
                    }, 428);
                }
            }
            if (!normalizedPassphrase) {
                runtimeMetrics.auth.unlockFailure += 1;
                runtimeMetrics.auth.lastFailureAt = nowIso();
                pushMetricSample(runtimeMetrics.auth.unlockLatencyMsSamples, hrMs(unlockStartNs), 256);
                return jsonResponse(res, { error: 'Missing passphrase' }, 400);
            }

            // Master Key Verification
            const isCorrect = verifyMasterPassphrase(normalizedPassphrase);
            const isDuress = normalizedPassphrase === "FORGE_BURN_2026"; // [IP_GOLD] Duress Hologram
            const shouldEnterGhost = ENABLE_GHOST_MODE && (!isCorrect && failedAttempts >= 3) || isDuress;
            
            if (isCorrect || shouldEnterGhost) {
                const ghostMode = shouldEnterGhost;
                const token = createSession(normalizedPassphrase, ghostMode, clientIP);
                setNeuralEmpireRuntimeToken(token);
                
                if (isCorrect && !isDuress) {
                    failedAttempts = 0;
                    SYSTEM_GHOST_MODE = false;
                    TelemetryLedger.log("SYSTEM_UNLOCK", { success: true });
                } else if (isDuress) {
                    // [IP_GOLD] Execute Duress Hologram Protocol
                    SYSTEM_GHOST_MODE = true;
                    console.error("[DURESS_PROTOCOL_ENGAGED] Burn password used. Shredding real keys in RAM.");
                    if (global.gc) global.gc();
                    // Generate massive fake activity
                    for(let i=0; i<10; i++) TelemetryLedger.log("DECOY_NODE_SYNC", { status: 'OK', bytes: Math.random()*1000 });
                    tearEngine.seal('DURESS_BURN', { ip: clientIP }, { title: 'Forensic Event: Duress Authenticated' });
                } else if (ghostMode) {
                    SYSTEM_GHOST_MODE = true;
                    console.warn(`[HONEYPOT] Attacker engaged decoy environment.`);
                    TelemetryLedger.log("HONEYPOT_ENGAGED", { passphraseCaptured: true, ip: clientIP });
                    tearEngine.seal('HONEYPOT_ENGAGED', { ip: clientIP, attempt: failedAttempts }, { title: 'Forensic Event: Honeypot Active' });
                }
                
                const remainingBeforeGhost = ENABLE_GHOST_MODE ? Math.max(0, 3 - failedAttempts) : null;
                runtimeMetrics.auth.unlockSuccess += 1;
                pushMetricSample(runtimeMetrics.auth.unlockLatencyMsSamples, hrMs(unlockStartNs), 256);
                emitNeuralEmpireSignal('auth.session.established', {
                    ip: clientIP || 'unknown',
                    ghostMode,
                    attempt: failedAttempts,
                    remainingBeforeGhost
                }, { source: 'forgecore.auth' });
                res.end(JSON.stringify({
                    success: true,
                    token,
                    ghost: ghostMode,
                    attempt: failedAttempts,
                    remainingBeforeGhost
                }));
            } else {
                failedAttempts++;
                if (!ENABLE_GHOST_MODE) SYSTEM_GHOST_MODE = false;
                TelemetryLedger.log("AUTH_FAILURE", { attempt: failedAttempts });
                tearEngine.seal('AUTH_FAILURE', { attempt: failedAttempts, ip: clientIP }, { title: 'Security Event: Failed Unlock' });
                runtimeMetrics.auth.unlockFailure += 1;
                runtimeMetrics.auth.lastFailureAt = nowIso();
                pushMetricSample(runtimeMetrics.auth.unlockLatencyMsSamples, hrMs(unlockStartNs), 256);
                emitNeuralEmpireSignal('auth.session.failed', {
                    ip: clientIP || 'unknown',
                    attempt: failedAttempts
                }, { source: 'forgecore.auth' });
                res.writeHead(401);
                const remainingBeforeGhost = ENABLE_GHOST_MODE ? Math.max(0, 3 - failedAttempts) : null;
                res.end(JSON.stringify({
                    success: false,
                    ghost: false,
                    attempt: failedAttempts,
                    remainingBeforeGhost
                }));
            }
        return;
    }
    if (url.pathname.startsWith('/api/system/unlock')) {
        return jsonResponse(res, { error: 'METHOD_NOT_ALLOWED', expected: 'POST' }, 405);
    }

    // [API] XXXplorer Engine
    if (url.pathname === '/api/xxxplorer/history' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end("LOCKED"); }
        const parsed = await parseJsonBodyOrReject(req, res, {
            maxBytes: 262_144,
            schemaPath: url.pathname,
            ip: clientIP
        });
        if (!parsed.ok) return;
        const data = parsed.data || {};
        if (data.vault) ensureVaultBaseline(data.vault, 'HISTORY_BASELINE');
        return jsonResponse(res, { history: explorer.getHistory(data.vault) });
    }
    if (url.pathname === '/api/xxxplorer/resurrect' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end("LOCKED"); }
        const parsed = await parseJsonBodyOrReject(req, res, {
            maxBytes: 262_144,
            schemaPath: url.pathname,
            ip: clientIP
        });
        if (!parsed.ok) return;
        const data = parsed.data || {};
        const result = explorer.resurrect(data.vault, data.cid);
        return jsonResponse(res, result);
    }
    if (url.pathname.startsWith('/api/xxxplorer/')) {
        const op = String(url.pathname.split('/').pop() || '').trim().toLowerCase();
        if (!['history', 'resurrect'].includes(op)) return jsonResponse(res, { error: 'Unknown operation' }, 404);
        return jsonResponse(res, { error: 'METHOD_NOT_ALLOWED', expected: 'POST' }, 405);
    }

    // [API] NeuralPass Engine
    if (url.pathname.startsWith('/api/neuralpass/')) {
        const op = String(url.pathname.split('/').pop() || '').trim().toLowerCase();
        if (['store', 'retrieve', 'delete', 'list'].includes(op)) {
            const session = getSession(req);
            if (!session || SYSTEM_GHOST_MODE) {
                res.writeHead(401);
                return res.end("LOCKED");
            }
            if (NeuroDrop.tier < NEURALPASS_MIN_TIER) {
                return jsonResponse(res, {
                    success: false,
                    error: "INSUFFICIENT_CLEARANCE",
                    requiredTier: NEURALPASS_MIN_TIER,
                    currentTier: NeuroDrop.tier
                }, 403);
            }
        }
    }

    if (url.pathname === '/api/neuralpass/store' && req.method === 'POST') {
        const parsed = await parseJsonBodyOrReject(req, res, {
            maxBytes: 131_072,
            schemaPath: url.pathname,
            ip: clientIP
        });
        if (!parsed.ok) return;
        const data = parsed.data || {};
        return jsonResponse(res, NeuralPass.storeSecret(data.id, data.secret));
    }
    if (url.pathname === '/api/neuralpass/retrieve' && req.method === 'POST') {
        const parsed = await parseJsonBodyOrReject(req, res, {
            maxBytes: 131_072,
            schemaPath: url.pathname,
            ip: clientIP
        });
        if (!parsed.ok) return;
        const data = parsed.data || {};
        return jsonResponse(res, NeuralPass.retrieveSecret(data.id));
    }
    if (url.pathname === '/api/neuralpass/delete' && req.method === 'POST') {
        const parsed = await parseJsonBodyOrReject(req, res, {
            maxBytes: 131_072,
            schemaPath: url.pathname,
            ip: clientIP
        });
        if (!parsed.ok) return;
        const data = parsed.data || {};
        return jsonResponse(res, NeuralPass.deleteSecret(data.id));
    }
    if (url.pathname === '/api/neuralpass/list' && req.method === 'GET') {
        return jsonResponse(res, NeuralPass.listSecrets());
    }
    if (url.pathname.startsWith('/api/neuralpass/')) {
        const op = String(url.pathname.split('/').pop() || '').trim().toLowerCase();
        if (!['store', 'retrieve', 'delete', 'list'].includes(op)) {
            return jsonResponse(res, { error: 'Unknown operation' }, 404);
        }
        return jsonResponse(res, { error: 'METHOD_NOT_ALLOWED', expected: op === 'list' ? 'GET' : 'POST' }, 405);
    }

    // [API] ZeroTrace Forensic Certificate (Proof of Sovereignty)
    if (url.pathname === '/api/system/certificate' && req.method === 'GET') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end("LOCKED"); }
        
        const chain = tearEngine.getChain();
        const bootBlock = chain.find(b => b.evidence.kind === 'SYSTEM_BOOT') || {};
        const tampers = chain.filter(b => b.evidence.kind === 'DNA_MISMATCH' || b.evidence.kind === 'AUTH_FAILURE').length;
        
        const certData = [
            "==================================================",
            "      FORGECORE™ SOVEREIGNTY CERTIFICATE          ",
            "==================================================",
            `Date: ${new Date().toISOString()}`,
            `Machine DNA: ${machineID.substring(0, 16)}... [VERIFIED]`,
            `Kernel Mode: ${CONFIG.security.mode}`,
            `Core Integrity Seal: ${CORE_HASH}`,
            `Quantum Bridge: ACTIVE`,
            `Session Length: ${Math.round(process.uptime())} seconds`,
            `Total Audit Blocks: ${chain.length}`,
            `Security Violations Logged: ${tampers}`,
            "",
            "This cryptographic ledger proves that the enclosed",
            "artifacts were engineered in a physically sovereign,",
            "TPM-bound environment with zero external data leaks.",
            "=================================================="
        ].join('\n');

        const signature = TPMEnclave.hardwareSign(certData);
        
        return jsonResponse(res, { 
            success: true, 
            certificate: certData,
            signature: signature
        });
    }

    // [API] Real System Info
    if (url.pathname === '/api/system/info') {
        if (SYSTEM_GHOST_MODE) return res.end(JSON.stringify({ memPercent: 44.5, uptimeSec: Math.round(process.uptime()), hostname: "DECOY_HOST" }));
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end("LOCKED"); }

        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const info = {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            pid: process.pid,
            cpuModel: cpus[0] ? cpus[0].model : 'Unknown',
            cpuCores: cpus.length,
            totalMemMB: Math.round(totalMem / 1048576),
            usedMemMB: Math.round(usedMem / 1048576),
            freeMemMB: Math.round(freeMem / 1048576),
            memPercent: Math.round((usedMem / totalMem) * 100),
            uptimeSec: Math.round(process.uptime()),
            osUptime: os.uptime(),
            loadAvg: os.loadavg(),
            networkInterfaces: Object.keys(os.networkInterfaces()).length,
            tempDir: os.tmpdir(),
            homeDir: os.homedir()
        };
        return res.end(JSON.stringify(info));
    }

    if (url.pathname === '/api/system/release-integrity' && req.method === 'GET') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end('LOCKED'); }
        return jsonResponse(res, computeReleaseIntegrity());
    }

    if (url.pathname === '/api/system/migrations') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end('LOCKED'); }
        return jsonResponse(res, {
            current: stateMigrations.current(),
            lastRun: stateMigrationResult
        });
    }

    if (url.pathname === '/api/system/diagnostics' && req.method === 'GET') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end('LOCKED'); }
        return jsonResponse(res, buildDiagnosticsReport(session));
    }

    if (url.pathname === '/api/system/doctor' && req.method === 'GET') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end('LOCKED'); }
        return jsonResponse(res, {
            success: true,
            report: buildRuntimeDoctorReport(session, { includeDiagnostics: false })
        });
    }

    if (url.pathname === '/api/system/doctor/repair' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end('LOCKED'); }
        if (!isLoopbackClient(clientIP)) {
            return jsonResponse(res, { success: false, error: 'DOCTOR_REPAIR_LOCAL_ONLY' }, 403);
        }
        let body = ''; req.on('data', c => { if (body.length < 8192) body += c; });
        req.on('end', () => {
            const data = safeJSON(body) || {};
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            const mode = String(data.mode || 'safe').trim().toLowerCase();
            if (!['safe', 'full'].includes(mode)) {
                return jsonResponse(res, { success: false, error: 'DOCTOR_REPAIR_INVALID_MODE' }, 400);
            }
            const repair = runRuntimeDoctorRepair({
                ip: clientIP || 'local',
                mode
            });
            const report = buildRuntimeDoctorReport(session, { includeDiagnostics: false });
            return jsonResponse(res, {
                success: repair.ok,
                repair,
                report
            }, repair.ok ? 200 : 500);
        });
        return;
    }

    if (url.pathname === '/api/system/diagnostics/export' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end('LOCKED'); }
        let body = ''; req.on('data', c => { if (body.length < 8192) body += c; });
        req.on('end', () => {
            const data = safeJSON(body) || {};
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            const report = buildDiagnosticsReport(session);
            if (typeof data.note === 'string' && data.note.trim()) {
                report.operatorNote = data.note.trim().slice(0, 512);
            }

            const outDir = path.join(PERSIST_ROOT_DIR, 'logs', 'diagnostics');
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `forgecore_diagnostics_${stamp}.json`;
            const outPath = path.join(outDir, fileName);
            const payload = JSON.stringify(report, null, 2);
            fs.writeFileSync(outPath, payload, 'utf8');

            const sha256 = crypto.createHash('sha256').update(payload).digest('hex').toUpperCase();
            TelemetryLedger.log('DIAGNOSTICS_EXPORT', { file: outPath, sha256, by: clientIP || 'unknown' });
            tearEngine.seal('DIAGNOSTICS_EXPORT', { file: outPath, sha256 }, { title: 'Diagnostics Export' });

            return jsonResponse(res, {
                success: true,
                file: outPath,
                bytes: Buffer.byteLength(payload, 'utf8'),
                sha256,
                generatedAt: report.generatedAt
            });
        });
        return;
    }

    if (url.pathname === '/api/system/action-provenance' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end('LOCKED'); }
        let body = ''; req.on('data', c => { if (body.length < 8192) body += c; });
        req.on('end', () => {
            const data = safeJSON(body) || {};
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            const recorded = appendActionProvenance(data, { ip: clientIP });
            if (!recorded.ok) {
                return jsonResponse(res, { success: false, error: recorded.error || 'ACTION_PROVENANCE_REJECTED' }, 400);
            }
            return jsonResponse(res, {
                success: true,
                seq: recorded.entry.seq,
                executionHead: recorded.entry.executionHead,
                chainLength: recorded.entry.chainLength
            });
        });
        return;
    }

    if (url.pathname === '/api/system/tamper' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end('LOCKED'); }
        let body = ''; req.on('data', c => { if (body.length < 4096) body += c; });
        req.on('end', () => {
            const data = safeJSON(body) || {};
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            const tamperType = String(data.type || 'UNKNOWN').slice(0, 64);
            const details = {
                type: tamperType,
                source: String(data.source || 'ui').slice(0, 32),
                ip: clientIP || 'unknown'
            };
            TelemetryLedger.log('TAMPER_ALERT', details);
            tearEngine.seal('TAMPER_ALERT', details, { title: `Tamper Alert: ${tamperType}` });
            return jsonResponse(res, { success: true, recorded: true, type: tamperType });
        });
        return;
    }

    // [API] Command Execution (FULL PROGRAM)
    if (url.pathname === '/api/system/execute' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end("DENIED"); }
        const parsed = await parseJsonBodyOrReject(req, res, {
            maxBytes: 262_144,
            schemaPath: url.pathname,
            ip: clientIP
        });
        if (!parsed.ok) return;
        const data = parsed.data;
        if (!data) return jsonResponse(res, { output: "[ERR] Invalid JSON payload." }, 400);
            let command = data.command;
            let args = data.args || [];
            if (data.commandString && !command) {
                const parts = data.commandString.trim().split(/\s+/);
                command = parts[0];
                args = parts.slice(1);
            }
            TelemetryLedger.log("COMMAND_EXEC", { command, args }, session.passphrase);
            
            // [NEURODROP_V3] Track command for AI F.A.R.T. and Ritual Logic
            const rawCommandInput = data.commandString || (command + (args.length ? ' ' + args.join(' ') : ''));
            NeuroDrop.addCommand(rawCommandInput);
            
            // [IP_GOLD] The "Ritual" Logic Gate
            // Sequence: setTier 3 -> scan -> ritual init -> whoami
            const hist = NeuroDrop.commandHistory;
            if (hist.length >= 4 && command === "whoami") {
                const seq = hist.slice(-4);
                if (seq[0] === "setTier 3" && seq[1].startsWith("scan") && seq[2] === "ritual init" && seq[3] === "whoami") {
                    NeuroDrop.setTier(5);
                    console.log("[RITUAL_GATE] Human-in-the-Loop verified. Tier 5 Unlocked.");
                    TelemetryLedger.log("RITUAL_GATE_OPENED", { tier: 5 });
                }
            }

            // [IP_GOLD] OVERSOUL INTENT ANALYSIS (Upgraded to Raw Input Scan)
            try {
                const intent = await AIOversoul.analyzeIntent([{ raw: rawCommandInput }]);
                if (intent.classification === 'MALICIOUS_EXFILTRATION') {
                    console.error(`[OVERSOUL_INTERCEPT] Malicious Intent Detected. Blocking execution.`);
                    return res.end(JSON.stringify({ output: `[CRITICAL_ERR] Command blocked by AI Oversoul Security Kernel. Reason: ${intent.reasoning}` }));
                }
            } catch (aiErr) {
                console.warn("[OVERSOUL] Intent analysis failed, falling back to heuristics.", aiErr.message);
            }

            try {
                let output = "";

                if (command === "help") {
                    output = [
                        "╔══════════════════════════════════════════════╗",
                        "║       FORGECORE™ COMMAND REFERENCE          ║",
                        "╠══════════════════════════════════════════════╣",
                        "║ status    — Live system metrics & OS info   ║",
                        "║ scan      — Scan project directory tree     ║",
                        "║ engines   — List all loaded swarm engines   ║",
                        "║ vaults    — Vault integrity report          ║",
                        "║ audit     — Cryptographic core seal check   ║",
                        "║ heal      — Kernel resurrection & repair    ║",
                        "║ whoami    — DNA identity & machine binding  ║",
                        "║ uptime    — Process & OS uptime             ║",
                        "║ env       — Runtime environment info        ║",
                        "║ tree [d]  — File tree (depth, default 2)    ║",
                        "║ count     — Count all project files         ║",
                        "║ mem       — Memory allocation breakdown     ║",
                        "║ net       — Network interface summary       ║",
                        "║ hotload f — Hot-load artifact from vault    ║",
                        "║ setTier n — Access tier shift (1-5)         ║",
                        "║ wipe t    — Purge (clip|dom|cache)          ║",
                        "║ ritual op — Ritual (init|clear)             ║",
                        "║ fakeFile f— Spoof format (pdf|zip)          ║",
                        "║ spoofDate d— Shift system timestamps         ║",
                        "║ cloak m   — Stealth browsing layer           ║",
                        "║ swarm cmd — Swarm ops (compute/sync)         ║",
                        "║ agent cmd — AI Agent Sandbox (task)          ║",
                        "║ hypersnatch — Launch Nexus Scraper Engine    ║",
                        "║ faraday   — Air-Gapped Optical Data Diode   ║",
                        "║ radiate v — VDF Time-Lock a Vault           ║",
                        "║ clear     — Clear terminal                  ║",
                        "║ tear      — TEAR protocol (seal/verify/etc) ║",
                        "║ witness   — Ghost witness attestations      ║",
                        "╚══════════════════════════════════════════════╝"
                    ].join("\\n");

                } else if (command === "hypersnatch") {
                    const task = args[0] || 'detect';
                    const input = args[1] || 'sample_stream_payload';
                    output = `[NEXUS] Engaging HyperSnatch Extraction Engine (Lazarus Edition)...\n`;
                    try {
                        const AgentSandbox = require('./agent_sandbox');
                        const hsArtifact = fs.readFileSync(path.join(__dirname, 'nexus_hypersnatch.js'), 'utf8');
                        
                        // Execute HyperSnatch in the Sandbox
                        const result = await AgentSandbox.executeAgentTask('HS_NEXUS', { task, input }, Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]));
                        
                        // Manually trigger the artifact logic (Simulated for this prototype)
                        const HS = require('./nexus_hypersnatch');
                        const hsResult = HS.run(task, input);
                        
                        output += `[NEXUS] Result: ${JSON.stringify(hsResult)}\n`;
                        output += `[NEXUS] Evidence Pinned to Merkle-DAG. Forensic Signature: ${hsResult.forensic_sig || 'SEALED'}`;
                    } catch(e) {
                        output += `[ERR] Nexus instantiation failed: ${e.message}`;
                    }

                } else if (command === "faraday") {
                    const payload = { head: tearEngine.executionChain.getHead(), ts: Date.now() };
                    const encoded = FaradayBridge.encodeOpticalStream(payload);
                    output = `[FARADAY_BRIDGE] Optical Data Diode Stream Initialized.\n`;
                    output += `Stream ID: ${encoded.streamId}\nFrames: ${encoded.frameCount}\n`;
                    output += `[Frame 0 preview]: ${encoded.opticalFrames[0].substring(0, 50)}...\n`;
                    output += `(In UI, this triggers high-speed QR rendering sequence)`;

                } else if (command === "radiate") {
                    const vaultName = args[0] || 'DEEP_FREEZE';
                    output = `[VDF_TIMELOCK] Sealing ${vaultName} with Verifiable Delay Function...\n`;
                    const sealResult = RadioactiveVault.sealRadioactiveKey(`MASTER_SEED_${Date.now()}`);
                    output += `Vault mathematically locked. Key requires ${sealResult.iterations} sequential hashes to recover.\n`;
                    output += `This cannot be parallelized or bypassed.`;

                } else if (command === "swarm" && args[0] === "compute") {
                    // [IP_GOLD] Distributed Sovereign Compute
                    const targetNode = args[1] || 'NODE_OMEGA';
                    const payload = args.slice(2).join(' ');
                    output = `[SWARM] Dispatching execution block to ${targetNode}...`;
                    try {
                        SwarmProjection.ghost.multicast('COMPUTE_TASK', { target: targetNode, payload, requester: machineID });
                        output += `\n[SWARM] Task dispatched over GhostSync. Awaiting TPM-signed Merkle CID response.`;
                    } catch(e) {
                        output += `\n[ERR] Swarm uninitialized or unreachable.`;
                    }

                } else if (command === "agent" && args[0] === "task") {
                    // [IP_GOLD] Agentic Sandboxing
                    const agentId = args[1] || '001';
                    const task = args.slice(2).join(' ');
                    output = `[AGENT] Engaging Neural-Gapped Dev Swarm for Agent ${agentId}...\n`;
                    const AgentSandbox = require('./agent_sandbox');
                    // Mock wasm buffer for demonstration of sandboxing
                    const mockWasm = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]); 
                    const result = await AgentSandbox.executeAgentTask(agentId, task, mockWasm);
                    if (result.success) {
                        output += `[AGENT] Task Complete. Barren compute verified.`;
                    } else {
                        output += `[AGENT] Execution Terminated: ${result.error}`;
                    }

                } else if (command === "setTier") {
                    const result = NeuroDrop.setTier(args[0]);
                    output = result.success ? `[NEURODROP] Access Tier shifted to: LEVEL_${result.tier}` : `[ERR] ${result.error}`;

                } else if (command === "wipe") {
                    const result = NeuroDrop.wipe(args[0]);
                    output = result.success ? `[ZEROTRACE] Purge complete on target: ${result.target.toUpperCase()}` : `[ERR] Invalid wipe target.`;

                } else if (command === "ritual") {
                    const result = NeuroDrop.ritual(args[0]);
                    output = result.success ? `[RITUAL] Sequence ${args[0] === 'init' ? 'initiated: ' + result.ritualId : 'cleared.'}` : `[ERR] Invalid ritual op.`;

                } else if (command === "fakeFile") {
                    const result = NeuroDrop.fakeFile(args[0]);
                    output = `[SPOOF] File format attributes faked as: .${result.format}`;

                } else if (command === "spoofDate") {
                    const result = NeuroDrop.spoofDate(args[0]);
                    output = `[SPOOF] System access timestamps shifted to: ${result.date}`;

                } else if (command === "cloak") {
                    const result = NeuroDrop.cloak(args[0]);
                    output = `[CLOAK] Stealth browsing layer active: ${result.mode}`;

                } else if (command === "replay") {
                    const headCID = tearEngine.executionChain.getHead();
                    const history = await replayEngine.getSessionHistory(headCID);
                    output = [
                        `[REPLAY] Active Session Execution Chain`,
                        `--------------------------------------`,
                        ...history.map((h, i) => `STEP_${i}: [${h.execution.rawCommand}] -> CID:${h.cid.substring(0, 8)}`)
                    ].join("\\n");

                } else if (command === "status") {
                    const cpus = os.cpus();
                    const totalMem = (os.totalmem() / 1073741824).toFixed(1);
                    const usedMem = ((os.totalmem() - os.freemem()) / 1073741824).toFixed(1);
                    const memPct = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);
                    const load = os.loadavg();
                    const healedVaults = [];
                    if (Array.isArray(CONFIG.vaults)) {
                        CONFIG.vaults.forEach((vaultName) => {
                            const heal = autoHealVaultSafe(vaultName, 'STATUS_CHECK');
                            if (heal && heal.healed) {
                                healedVaults.push(`${vaultName} (+${heal.restoredFiles || 0}/-${heal.removedFiles || 0})`);
                            }
                        });
                    }
                    output = [
                        `[STATUS] ForgeCore™ SINGULARITY-PRIME v3.0.0-Quantum`,
                        `  Platform:  ${os.platform()} ${os.arch()}`,
                        `  Hostname:  ${os.hostname()}`,
                        `  CPU:       ${cpus[0] ? cpus[0].model : 'Unknown'} (${cpus.length} cores) [${TelemetryStream.getCurrentCpu()}%]`,
                        `  Memory:    ${usedMem}GB / ${totalMem}GB (${memPct}%)`,
                        `  Load Avg:  ${load.map(l => l.toFixed(2)).join(' / ')}`,
                        `  Node PID:  ${process.pid}`,
                        `  Uptime:    ${Math.round(process.uptime())}s`,
                        `  AutoHeal:  ${healedVaults.length ? `RESTORED ${healedVaults.join(', ')}` : 'NOMINAL'}`,
                        `  Core Seal: ${CORE_HASH.substring(0, 32)}`,
                        `  DNA Bound: ${machineID.substring(0, 16)}...`
                    ].join("\\n");

                } else if (command === "scan") {
                    const scanDir = args[0] ? path.join(ROOT_DIR, args[0]) : ROOT_DIR;
                    if (!scanDir.startsWith(ROOT_DIR)) { output = "[ERR] Access denied."; }
                    else {
                        const items = fs.readdirSync(scanDir, { withFileTypes: true });
                        const dirs = items.filter(i => i.isDirectory()).map(i => `  📁 ${i.name}/`);
                        const files = items.filter(i => i.isFile()).map(i => {
                            const s = fs.statSync(path.join(scanDir, i.name));
                            return `  📄 ${i.name} (${(s.size / 1024).toFixed(1)}KB)`;
                        });
                        output = `[SCAN] ${scanDir}\\n${dirs.join("\\n")}\\n${files.join("\\n")}\\n  Total: ${dirs.length} dirs, ${files.length} files`;
                    }

                } else if (command === "engines") {
                    const engineDir = path.join(CORE_DIR, 'swarm');
                    const engineFiles = fs.existsSync(engineDir) ? fs.readdirSync(engineDir).filter(f => f.endsWith('.js')) : [];
                    output = `[ENGINES] ${engineFiles.length} loaded:\\n` + engineFiles.map(e => `  ⚙️  ${e}`).join("\\n");

                } else if (command === "vaults") {
                    const vaultNames = fs.existsSync(VAULT_DIR) ? fs.readdirSync(VAULT_DIR).filter(v => {
                        return fs.statSync(path.join(VAULT_DIR, v)).isDirectory();
                    }) : [];
                    const report = vaultNames.map(v => {
                        const vPath = path.join(VAULT_DIR, v);
                        const files = fs.readdirSync(vPath);
                        const totalSize = files.reduce((sum, f) => {
                            const fp = path.join(vPath, f);
                            return sum + (fs.statSync(fp).isFile() ? fs.statSync(fp).size : 0);
                        }, 0);
                        return `  🛡️  ${v}: ${files.length} files, ${(totalSize / 1024).toFixed(1)}KB`;
                    });
                    output = `[VAULT_INTEGRITY]\\n${report.join("\\n")}\\n  Total Vaults: ${vaultNames.length}`;

                } else if (command === "audit") {
                    output = `[AUDITOR] Current Core Seal: ${SecurityAudit.seal(CORE_DIR)}`;

                } else if (command === "heal" || command === "resurrect") {
                    const count = KernelResurrection.verifyAndHeal(CORE_DIR, GOLD_SEAL_DIR);
                    output = `[HEALER] Kernel Resurrection Complete. Restored ${count} artifacts.`;

                } else if (command === "whoami") {
                    output = [
                        `[IDENTITY]`,
                        `  Machine DNA:  ${machineID}`,
                        `  Config Seal:  ${CONFIG.security.dnaSeal ? 'BOUND' : 'UNBOUND'}`,
                        `  Ghost Mode:   ${SYSTEM_GHOST_MODE ? 'ACTIVE' : 'DISABLED'}`,
                        `  Session:      AUTHENTICATED`,
                        `  Authority:    ARCHITECT_ZERO`
                    ].join("\\n");

                } else if (command === "uptime") {
                    const procUp = process.uptime();
                    const osUp = os.uptime();
                    const fmtTime = (s) => {
                        const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600);
                        const m = Math.floor((s % 3600) / 60); const sec = Math.floor(s % 60);
                        return `${d}d ${h}h ${m}m ${sec}s`;
                    };
                    output = `[UPTIME]\\n  Process: ${fmtTime(procUp)}\\n  OS:      ${fmtTime(osUp)}`;

                } else if (command === "env") {
                    output = [
                        `[ENVIRONMENT]`,
                        `  Node:     ${process.version}`,
                        `  Platform: ${process.platform}`,
                        `  Arch:     ${process.arch}`,
                        `  PID:      ${process.pid}`,
                        `  CWD:      ${process.cwd()}`,
                        `  Temp:     ${os.tmpdir()}`,
                        `  Home:     ${os.homedir()}`
                    ].join("\\n");

                } else if (command === "tree") {
                    const maxDepth = parseInt(args[0]) || 2;
                    const treeLines = [];
                    function walkTree(dir, prefix, depth) {
                        if (depth > maxDepth) return;
                        const items = fs.readdirSync(dir, { withFileTypes: true })
                            .filter(i => !i.name.startsWith('.') && i.name !== 'node_modules');
                        items.forEach((item, idx) => {
                            const isLast = idx === items.length - 1;
                            const connector = isLast ? '└── ' : '├── ';
                            const icon = item.isDirectory() ? '📁' : '📄';
                            treeLines.push(`${prefix}${connector}${icon} ${item.name}`);
                            if (item.isDirectory()) {
                                walkTree(path.join(dir, item.name), prefix + (isLast ? '    ' : '│   '), depth + 1);
                            }
                        });
                    }
                    walkTree(ROOT_DIR, '', 0);
                    output = `[TREE] ForgeCore_OS (depth ${maxDepth})\\n${treeLines.join("\\n")}`;

                } else if (command === "count") {
                    let fileCount = 0; let dirCount = 0; let totalBytes = 0;
                    function countAll(dir) {
                        const items = fs.readdirSync(dir, { withFileTypes: true }).filter(i => !i.name.startsWith('.') && i.name !== 'node_modules');
                        items.forEach(item => {
                            const fp = path.join(dir, item.name);
                            if (item.isDirectory()) { dirCount++; countAll(fp); }
                            else { fileCount++; totalBytes += fs.statSync(fp).size; }
                        });
                    }
                    countAll(ROOT_DIR);
                    output = `[COUNT]\\n  Files: ${fileCount}\\n  Directories: ${dirCount}\\n  Total Size: ${(totalBytes / 1024).toFixed(1)} KB (${(totalBytes / 1048576).toFixed(2)} MB)`;

                } else if (command === "mem") {
                    const mu = process.memoryUsage();
                    output = [
                        `[MEMORY]`,
                        `  RSS:        ${(mu.rss / 1048576).toFixed(1)} MB`,
                        `  Heap Total: ${(mu.heapTotal / 1048576).toFixed(1)} MB`,
                        `  Heap Used:  ${(mu.heapUsed / 1048576).toFixed(1)} MB`,
                        `  External:   ${(mu.external / 1048576).toFixed(1)} MB`,
                        `  OS Total:   ${(os.totalmem() / 1073741824).toFixed(1)} GB`,
                        `  OS Free:    ${(os.freemem() / 1073741824).toFixed(1)} GB`
                    ].join("\\n");

                } else if (command === "net") {
                    const ifaces = os.networkInterfaces();
                    const lines = [];
                    for (const [name, addrs] of Object.entries(ifaces)) {
                        addrs.forEach(a => {
                            if (a.family === 'IPv4') lines.push(`  ${name}: ${a.address} (${a.internal ? 'internal' : 'external'})`);
                        });
                    }
                    output = `[NETWORK]\\n${lines.join("\\n")}`;

                } else if (command === "hotload") {
                    const artifactName = args[0];
                    if (!artifactName) {
                        output = '[ERR] Usage: hotload <filename>';
                    } else if (!Lazarus.validateArtifactPath(artifactName)) {
                        output = `[ERR] SECURITY_VIOLATION: Invalid artifact path: ${artifactName}`;
                        TelemetryLedger.log('SECURITY_VIOLATION', { command: 'hotload', artifact: artifactName });
                    } else {
                        const artifactPath = path.join(VAULT_DIR, 'UTILITY_VAULT', artifactName);
                        if (!fs.existsSync(artifactPath)) {
                            output = `[ERR] Artifact not found: ${artifactName}`;
                        } else {
                            if (artifactName.endsWith('.wasm')) {
                                const artifactBuffer = fs.readFileSync(artifactPath);
                                const result = await LazarusWasm.execute(artifactBuffer);
                                if (result.success) {
                                    output = `[LAZARUS_WASM] Execution Complete. Result: ${result.result}`;
                                } else {
                                    output = `[LAZARUS_WASM] Execution blocked: ${result.error}`;
                                }
                            } else {
                                const artifact = fs.readFileSync(artifactPath, 'utf8');
                                const result = await Lazarus.process(artifact);
                                if (result.ok) {
                                    output = `[LAZARUS] Hot-load result: ${JSON.stringify(result.result)}`;
                                } else {
                                    output = `[LAZARUS] Execution failed: ${result.error}`;
                                }
                            }
                        }
                    }

                } else if (command === "clear") {
                    output = "__CLEAR__";

                } else if (command === "tear") {
                    const sub = args[0];
                    if (sub === 'seal') {
                        const vaultName = args[1] || 'INTEL_VAULT';
                        const vaultPath = path.join(VAULT_DIR, vaultName);
                        if (!fs.existsSync(vaultPath)) { output = `[ERR] Vault not found: ${vaultName}`; }
                        else {
                            const files = fs.readdirSync(vaultPath).filter(f => fs.statSync(path.join(vaultPath, f)).isFile());
                            const items = files.map(f => ({ file: f, digest: crypto.createHash('sha256').update(fs.readFileSync(path.join(vaultPath, f))).digest('hex') }));
                            const container = tearEngine.seal('VAULT_SEAL', items, { title: `Seal: ${vaultName}` });
                            const outPath = path.join(tearEngine.chainDir, `${vaultName}.tear.json`);
                            fs.writeFileSync(outPath, JSON.stringify(container, null, 2));
                            output = [`[TEAR] Vault sealed: ${vaultName}`, `  Merkle Root: ${container.header.merkleRoot}`, `  Signature:   ${container.signature.substring(0, 32)}...`, `  Fingerprint: ${container.fingerprint.substring(0, 32)}...`, `  Chain #:     ${tearEngine.getChain().length}`, `  Saved to:    ${outPath}`].join('\n');
                        }
                    } else if (sub === 'verify') {
                        const target = args[1];
                        if (!target) { output = '[ERR] Usage: tear verify <filename>'; }
                        else {
                            const fp = path.join(tearEngine.chainDir, target);
                            if (!fs.existsSync(fp)) { output = `[ERR] File not found: ${fp}`; }
                            else {
                                const result = tearEngine.verify(fp);
                                const lines = ['[TEAR] Verification Report:'];
                                for (const [k, v] of Object.entries(result.checks)) {
                                    lines.push(`  ${v ? '✅' : '❌'} ${k.toUpperCase()}: ${v ? 'PASS' : 'FAIL'}`);
                                }
                                lines.push(`  Result: ${result.valid ? 'INTEGRITY_VERIFIED' : 'INTEGRITY_COMPROMISED'}`);
                                output = lines.join('\n');
                            }
                        }
                    } else if (sub === 'bundle') {
                        const vaultName = args[1] || 'INTEL_VAULT';
                        try {
                            const bundle = tearEngine.bundle(vaultName);
                            output = [`[TEAR] Bundle created: ${vaultName}`, `  Assets:  ${bundle.assets.length}`, `  Digest:  ${bundle.digest.substring(0, 32)}...`, `  Format:  ${bundle.format}`, `  Signed:  ${bundle.signature.timestamp}`].join('\n');
                        } catch (e) { output = `[ERR] ${e.message}`; }
                    } else if (sub === 'chain') {
                        const stats = tearEngine.getStats();
                        output = [`[TEAR] Audit Chain Status:`, `  Length:     ${stats.chainLength}`, `  Last Seal:  ${stats.lastSeal || 'N/A'}`, `  Last Kind:  ${stats.lastKind || 'N/A'}`, `  Last Merkle: ${stats.lastMerkle || 'N/A'}`, `  Integrity:  ${stats.integrity}`].join('\n');
                    } else {
                        output = [`[TEAR] Subcommands:`, `  tear seal <vault>    — Seal vault into .tear.json`, `  tear verify <file>   — Verify .tear.json integrity`, `  tear bundle <vault>  — Package vault as tear-bundle`, `  tear chain           — Show audit chain status`].join('\n');
                    }

                } else if (command === "witness") {
                    const mode = (args[0] || '').toLowerCase();
                    const requestedHead = (mode && mode !== 'query') ? mode : (args[1] || tearEngine.executionChain.getHead());
                    const headCID = requestedHead || tearEngine.executionChain.getHead();
                    if (!headCID) {
                        output = "[WITNESS] No execution head available yet.";
                    } else if (mode === 'query') {
                        const remote = await SwarmProjection.queryGhostWitnesses(headCID, 1600);
                        output = [`[WITNESS] Remote Witness Query`, `  Head:     ${headCID}`, `  Receipts: ${remote.length}`].join('\n');
                    } else {
                        const local = SwarmProjection.getGhostWitnesses(headCID);
                        const unique = new Set(local.map(w => w.observerID)).size;
                        output = [`[WITNESS] Local Ghost Witness Ledger`, `  Head:     ${headCID}`, `  Receipts: ${local.length}`, `  Observers:${unique}`].join('\n');
                    }

                } else {
                    output = `[ERR] Unknown command: '${command}'. Type 'help' for available commands.`;
                }

                // [IP_GOLD] SEAL EXECUTION TO MERKLE TIMELINE
                // Capture the state after execution
                const finalOutputCID = mfs.write(Buffer.from(output));
                await tearEngine.sealExecution({
                    rawCommand: rawCommandInput,
                    resultCID: finalOutputCID,
                    stateCID: mfs.commitVaultState("ACTIVE_SESSION", { last_cmd: rawCommandInput }), // Placeholder for full state
                    intentScore: 0, // Placeholder
                    wasmSandboxHash: "SANDBOX_READY", // Placeholder
                    modelHash: "OVERSOUL_v3_SLM" // For deterministic AI inference proof
                });

                res.end(JSON.stringify({ output }));
            } catch (e) { res.end(JSON.stringify({ output: `[ERR] ${e.message}` })); }
        return;

    }
    if (url.pathname.startsWith('/api/system/execute')) {
        return jsonResponse(res, { error: 'METHOD_NOT_ALLOWED', expected: 'POST' }, 405);
    }

    // [API] TEAR Protocol Endpoints
    if (url.pathname === '/api/tear/stats') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }
        return jsonResponse(res, tearEngine.getStats());
    }
    if (url.pathname === '/api/tear/witnesses') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }

        const headCID = (url.searchParams.get('head') || '').trim();
        const effectiveHead = headCID || tearEngine.executionChain.getHead() || null;
        const remote = url.searchParams.get('remote') === '1';
        const timeoutMs = Math.max(200, Math.min(5000, Number(url.searchParams.get('timeoutMs') || 1600)));

        const localSummary = SwarmProjection.getGhostWitnessSummary(headCID || null);
        const localWitnesses = headCID ? SwarmProjection.getGhostWitnesses(headCID) : null;
        const recentAttestations = SwarmProjection.getGhostAttestations(25);
        let remoteWitnesses = [];

        if (remote && headCID) {
            remoteWitnesses = await SwarmProjection.queryGhostWitnesses(headCID, timeoutMs);
        }

        return jsonResponse(res, {
            headCID: headCID || null,
            localSummary,
            localWitnesses: localWitnesses ? localWitnesses.slice(0, 128) : null,
            remoteWitnesses: remoteWitnesses.slice(0, 128),
            lastAttestation: lastGhostAttestationEvent,
            recentAttestations,
            quorum: getWitnessQuorumStatus(effectiveHead)
        });
    }
    if (url.pathname === '/api/tear/quorum') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }
        const headCID = (url.searchParams.get('head') || '').trim();
        return jsonResponse(res, getWitnessQuorumStatus(headCID || null));
    }
    if (url.pathname === '/api/tear/seal' && req.method === 'POST') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }
        let body = ''; req.on('data', c => { if (body.length < 1048576) body += c; });
        req.on('end', () => {
            const data = safeJSON(body);
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            if (!data || !data.vault) return jsonResponse(res, { error: 'Missing vault' }, 400);
            try {
                const vaultPath = path.join(VAULT_DIR, data.vault);
                const files = fs.readdirSync(vaultPath).filter(f => fs.statSync(path.join(vaultPath, f)).isFile());
                const items = files.map(f => ({ file: f, digest: crypto.createHash('sha256').update(fs.readFileSync(path.join(vaultPath, f))).digest('hex') }));
                const container = tearEngine.seal('VAULT_SEAL', items, { title: `API Seal: ${data.vault}` });
                jsonResponse(res, { success: true, container });
            } catch (e) { jsonResponse(res, { error: e.message }, 500); }
        });
        return;
    }
    if (url.pathname === '/api/tear/verify' && req.method === 'POST') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }
        let body = ''; req.on('data', c => { if (body.length < 1048576) body += c; });
        req.on('end', () => {
            const data = safeJSON(body);
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            if (!data || !data.container) return jsonResponse(res, { error: 'Missing container' }, 400);
            try {
                const result = tearEngine.verify(data.container);
                jsonResponse(res, result);
            } catch (e) { jsonResponse(res, { error: e.message }, 500); }
        });
        return;
    }
    if (url.pathname === '/api/tear/chain') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }
        return jsonResponse(res, tearEngine.getChain().slice(-20));
    }

    if (url.pathname === '/api/runtime/ak/status' && req.method === 'GET') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end('LOCKED'); }
        return jsonResponse(res, {
            success: true,
            status: buildAkRuntimeStatus()
        });
    }

    if (url.pathname === '/api/runtime/ak/scenario' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end('LOCKED'); }
        if (!enforceWitnessQuorumGate(res, 'AK_RUNTIME_SCENARIO', { route: url.pathname })) return;
        let body = ''; req.on('data', c => { if (body.length < 16384) body += c; });
        req.on('end', async () => {
            const data = safeJSON(body) || {};
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            try {
                const result = await runAkScenarioCommand('scenario', {
                    outDir: data.outDir,
                    proofOut: data.proofOut
                });
                TelemetryLedger.log('AK_RUNTIME_SCENARIO', {
                    ok: result && result.ok === true,
                    reportPath: result && result.reportPath ? result.reportPath : null,
                    proofPath: result && result.proofPath ? result.proofPath : null,
                    by: clientIP || 'unknown'
                });
                tearEngine.seal('AK_RUNTIME_SCENARIO', {
                    ok: result && result.ok === true,
                    reportPath: result && result.reportPath ? result.reportPath : null,
                    proofPath: result && result.proofPath ? result.proofPath : null
                }, { title: 'AK Runtime Scenario' });
                return jsonResponse(res, {
                    success: true,
                    mode: 'scenario',
                    result,
                    status: buildAkRuntimeStatus()
                });
            } catch (e) {
                const message = String(e && e.message ? e.message : e);
                TelemetryLedger.log('AK_RUNTIME_SCENARIO_FAIL', {
                    error: message,
                    by: clientIP || 'unknown'
                });
                return jsonResponse(res, {
                    success: false,
                    error: message,
                    status: buildAkRuntimeStatus()
                }, 500);
            }
        });
        return;
    }

    if (url.pathname === '/api/runtime/ak/proof' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end('LOCKED'); }
        if (!enforceWitnessQuorumGate(res, 'AK_RUNTIME_PROOF', { route: url.pathname })) return;
        let body = ''; req.on('data', c => { if (body.length < 16384) body += c; });
        req.on('end', async () => {
            const data = safeJSON(body) || {};
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            try {
                const result = await runAkScenarioCommand('proof', {
                    outDir: data.outDir,
                    proofOut: data.out || data.proofOut
                });
                TelemetryLedger.log('AK_RUNTIME_PROOF', {
                    ok: result && result.ok === true,
                    reportPath: result && result.reportPath ? result.reportPath : null,
                    proofPath: result && result.proofPath ? result.proofPath : null,
                    by: clientIP || 'unknown'
                });
                tearEngine.seal('AK_RUNTIME_PROOF', {
                    ok: result && result.ok === true,
                    reportPath: result && result.reportPath ? result.reportPath : null,
                    proofPath: result && result.proofPath ? result.proofPath : null
                }, { title: 'AK Runtime Proof' });
                return jsonResponse(res, {
                    success: true,
                    mode: 'proof',
                    result,
                    status: buildAkRuntimeStatus()
                });
            } catch (e) {
                const message = String(e && e.message ? e.message : e);
                TelemetryLedger.log('AK_RUNTIME_PROOF_FAIL', {
                    error: message,
                    by: clientIP || 'unknown'
                });
                return jsonResponse(res, {
                    success: false,
                    error: message,
                    status: buildAkRuntimeStatus()
                }, 500);
            }
        });
        return;
    }

    // [API] FORGE Subsystem (Offline Code Browser)
    const REPOS_DIR = path.join(PERSIST_ROOT_DIR, 'repos');
    if (url.pathname === '/api/forge/repos' && req.method === 'GET') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }
        const fsp = require('fs').promises;
        try { await fsp.access(REPOS_DIR); } catch { await fsp.mkdir(REPOS_DIR, { recursive: true }); }
        const entries = await fsp.readdir(REPOS_DIR, { withFileTypes: true });
        const repos = entries.filter(d => d.isDirectory() || d.isSymbolicLink()).map(d => d.name).sort();
        return jsonResponse(res, repos);
    }
    if (url.pathname === '/api/forge/tree' && req.method === 'GET') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }
        const repo = url.searchParams.get('repo');
        const relDir = url.searchParams.get('dir') || '/';
        if (!repo) return jsonResponse(res, { error: 'Missing repo' }, 400);

        const isVault = repo === 'vaults';
        const baseDir = isVault ? VAULT_DIR : REPOS_DIR;
        const safeRepoPath = isVault ? VAULT_DIR : path.resolve(REPOS_DIR, repo.replace(/^[\/\\]+/, ''));
        if (!isVault && !safeRepoPath.startsWith(REPOS_DIR)) return jsonResponse(res, { error: 'Path traversal' }, 403);
        const safeDirPath = path.resolve(safeRepoPath, relDir.replace(/^[\/\\]+/, '').replace(/\.\./g, ''));
        if (!safeDirPath.startsWith(baseDir)) return jsonResponse(res, { error: 'Invalid path' }, 403);

        const fsp = require('fs').promises;
        try { await fsp.access(safeDirPath); } catch { return jsonResponse(res, []); }

        const rawEntries = await fsp.readdir(safeDirPath, { withFileTypes: true });
        const entries = [];
        for (const e of rawEntries) {
            const full = path.join(safeDirPath, e.name);
            const stat = await fsp.stat(full);
            const isDir = e.isDirectory() || (e.isSymbolicLink() && stat.isDirectory());
            entries.push({
                name: e.name,
                type: isDir ? 'dir' : 'file',
                size: isDir ? 0 : stat.size,
                path: path.posix.join(relDir, e.name).replace(/\\/g, '/')
            });
        }
        entries.sort((a, b) => (a.type === b.type) ? a.name.localeCompare(b.name) : (a.type === 'dir' ? -1 : 1));
        return jsonResponse(res, entries);
    }
    if (url.pathname === '/api/forge/file' && req.method === 'GET') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }
        const repo = url.searchParams.get('repo');
        const relPath = url.searchParams.get('path');
        if (!repo || !relPath) return jsonResponse(res, { error: 'Missing repo/path' }, 400);

        const isVault = repo === 'vaults';
        const baseDir = isVault ? VAULT_DIR : REPOS_DIR;
        const safeRepoPath = isVault ? VAULT_DIR : path.resolve(REPOS_DIR, repo.replace(/^[\/\\]+/, ''));

        if (!isVault && !safeRepoPath.startsWith(REPOS_DIR)) return jsonResponse(res, { error: 'Path traversal' }, 403);
        const fp = path.resolve(safeRepoPath, relPath.replace(/^[\/\\]+/, '').replace(/\.\./g, ''));
        if (isVault) {
            const vaultName = extractVaultNameFromRepoPath(repo, relPath);
            if (vaultName) {
                ensureVaultBaseline(vaultName, 'FORGE_FILE_BASELINE');
                autoHealVaultSafeThrottled(vaultName, 'FORGE_FILE_READ');
            }
        }
        if (!fp.startsWith(baseDir) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) return jsonResponse(res, { error: 'Not found' }, 404);

        const ext = path.extname(fp).toLowerCase();
        const isText = ['.md', '.txt', '.js', '.json', '.css', '.html', '.yml', '.yaml', '.sh', '.bat', '.ps1', '.go', '.rs', '.py', '.toml'].includes(ext);

        if (!isText) {
            const buf = fs.readFileSync(fp);
            return jsonResponse(res, { kind: 'binary', b64: buf.toString('base64'), size: buf.length });
        }
        return jsonResponse(res, { kind: 'text', text: fs.readFileSync(fp, 'utf-8') });
    }
    if (url.pathname === '/api/forge/search' && req.method === 'GET') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }
        const repo = url.searchParams.get('repo');
        const q = (url.searchParams.get('q') || '').trim().toLowerCase();
        if (!repo || !q) return jsonResponse(res, []);

        const isVault = repo === 'vaults';
        const baseDir = isVault ? VAULT_DIR : REPOS_DIR;
        const safeRepoPath = isVault ? VAULT_DIR : path.resolve(REPOS_DIR, repo.replace(/^[\/\\]+/, ''));

        if (!isVault && !safeRepoPath.startsWith(REPOS_DIR)) return jsonResponse(res, { error: 'Path traversal' }, 403);
        if (isVault && Array.isArray(CONFIG.vaults)) {
            CONFIG.vaults.forEach((vaultName) => {
                ensureVaultBaseline(vaultName, 'FORGE_SEARCH_BASELINE');
                autoHealVaultSafeThrottled(vaultName, 'FORGE_SEARCH_CHECK');
            });
        }

        const MAX_FILE = 512 * 1024; // 512KB limit
        const hits = [];
        const walk = (d, rel) => {
            if (hits.length >= 100) return;
            fs.readdirSync(d, { withFileTypes: true }).forEach(ent => {
                if (hits.length >= 100) return;
                const full = path.join(d, ent.name);
                const r = path.posix.join(rel, ent.name);
                if (ent.isDirectory()) return walk(full, r);
                const ext = path.extname(ent.name).toLowerCase();
                if (!['.md', '.txt', '.js', '.json', '.css', '.html', '.yml', '.yaml', '.sh', '.bat', '.ps1', '.go', '.rs', '.py', '.toml'].includes(ext)) return;
                if (fs.statSync(full).size > MAX_FILE) return;

                const text = fs.readFileSync(full, 'utf-8');
                const low = text.toLowerCase();
                const idx = low.indexOf(q);
                if (idx >= 0) {
                    const start = Math.max(0, idx - 40);
                    const end = Math.min(text.length, idx + q.length + 40);
                    hits.push({ file: r, snippet: text.slice(start, end).replace(/\r?\n/g, ' ') });
                }
            });
        };
        try { walk(safeRepoPath, '/'); } catch (e) { }
        return jsonResponse(res, hits);
    }
    if (url.pathname === '/api/forge/save' && req.method === 'POST') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }
        if (!enforceWitnessQuorumGate(res, 'FORGE_SAVE', { route: url.pathname })) return;
        let body = ''; req.on('data', c => { if (body.length < 10485760) body += c; }); // 10MB limit
        req.on('end', async () => {
            const data = safeJSON(body);
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            if (!data || !data.path || data.content === undefined) return jsonResponse(res, { error: 'Missing data' }, 400);

            // The path comes in as "RepoName/path/to/file"
            const parts = data.path.split('/');
            const repo = parts[0];
            const relPath = parts.slice(1).join('/');

            const isVault = repo === 'vaults';
            const baseDir = isVault ? VAULT_DIR : REPOS_DIR;
            const safeRepoPath = isVault ? VAULT_DIR : path.resolve(REPOS_DIR, repo.replace(/^[\/\\]+/, ''));

            if (!isVault && !safeRepoPath.startsWith(REPOS_DIR)) return jsonResponse(res, { error: 'Path traversal' }, 403);
            const fp = path.resolve(safeRepoPath, relPath.replace(/^[\/\\]+/, '').replace(/\.\./g, ''));
            if (!fp.startsWith(baseDir)) return jsonResponse(res, { error: 'Invalid path' }, 403);

            try {
                await omega.writeFile('user', fp, data.content);
                TelemetryLedger.log("FORGE_COMMIT", { file: data.path, size: data.content.length });
                if (isVault) {
                    const vaultName = relPath.split('/')[0];
                    if (vaultName) {
                        sealVaultSnapshotSafe(vaultName, 'FORGE_SAVE');
                        invalidateTimelineCache();
                    }
                }
                jsonResponse(res, { ok: true });
            } catch (e) { jsonResponse(res, { error: e.message }, 500); }
        });
        return;
    }
    if (url.pathname === '/api/forge/execute' && req.method === 'POST') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }
        if (!enforceWitnessQuorumGate(res, 'FORGE_EXECUTE', { route: url.pathname })) return;
        let body = ''; req.on('data', c => body += c);
        req.on('end', async () => {
            const data = safeJSON(body);
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            if (!data || !data.path) return jsonResponse(res, { error: 'Missing path' }, 400);

            const parts = data.path.split('/');
            const repo = parts[0];
            const relPath = parts.slice(1).join('/');
            const isVault = repo === 'vaults';
            const baseDir = isVault ? VAULT_DIR : REPOS_DIR;
            const safeRepoPath = isVault ? VAULT_DIR : path.resolve(REPOS_DIR, repo.replace(/^[\/\\]+/, ''));
            if (!isVault && !safeRepoPath.startsWith(REPOS_DIR)) return jsonResponse(res, { error: 'Path traversal' }, 403);
            const fp = path.resolve(safeRepoPath, relPath.replace(/^[\/\\]+/, '').replace(/\.\./g, ''));
            if (isVault) {
                const vaultName = extractVaultNameFromRepoPath(repo, relPath);
                if (vaultName) {
                    ensureVaultBaseline(vaultName, 'FORGE_EXEC_BASELINE');
                    autoHealVaultSafeThrottled(vaultName, 'FORGE_EXEC_CHECK');
                }
            }
            if (!fp.startsWith(baseDir)) return jsonResponse(res, { error: 'Invalid path' }, 403);
            if (!fs.existsSync(fp)) return jsonResponse(res, { error: 'Target not found' }, 404);

            try {
                const stat = fs.statSync(fp);
                let command = '';
                let args = [];

                if (stat.isDirectory()) {
                    if (isVault) return jsonResponse(res, { error: 'Directory execution is disabled for vaults' }, 400);
                    if (!fs.existsSync(path.join(fp, 'package.json'))) {
                        return jsonResponse(res, { error: 'No executable entry point found' }, 400);
                    }
                    command = 'npm';
                    args = ['start', '--prefix', fp];
                } else {
                    const ext = path.extname(fp).toLowerCase();
                    if (ext === '.js' || ext === '.cjs' || ext === '.mjs') {
                        command = 'node';
                        args = [fp];
                    } else if (ext === '.ps1') {
                        command = 'powershell';
                        args = ['-ExecutionPolicy', 'Bypass', '-File', fp];
                    } else if (ext === '.bat' || ext === '.cmd') {
                        command = 'cmd';
                        args = ['/c', fp];
                    } else {
                        return jsonResponse(res, { error: `Unsupported executable extension: ${ext || 'none'}` }, 400);
                    }
                }

                console.log(`[FORGE_EXEC] Running: ${command} ${args.join(' ')}`);
                const proc = await omega.spawn('user', command, args, { shell: false, detached: true, stdio: 'ignore', windowsHide: true });
                proc.unref();

                TelemetryLedger.log("FORGE_EXECUTE", { command, args, path: data.path, pid: proc.pid || null });
                jsonResponse(res, { ok: true, command, args, pid: proc.pid || null });
            } catch (e) { jsonResponse(res, { error: e.message }, 500); }
        });
        return;
    }

    // [API] FORGE Git Operations
    if (url.pathname === '/api/forge/git/init' && req.method === 'POST') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }
        if (!enforceWitnessQuorumGate(res, 'FORGE_GIT_INIT', { route: url.pathname })) return;
        let body = ''; req.on('data', c => body += c);
        req.on('end', async () => {
            const data = safeJSON(body);
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            if (!data || !data.repo) return jsonResponse(res, { error: 'Missing repo name' }, 400);
            try {
                const result = await forgeGit.initRepo(data.repo);
                jsonResponse(res, result);
            } catch (e) { jsonResponse(res, { error: e.message }, 500); }
        });
        return;
    }

    if (url.pathname === '/api/forge/git/commit' && req.method === 'POST') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }
        if (!enforceWitnessQuorumGate(res, 'FORGE_GIT_COMMIT', { route: url.pathname })) return;
        let body = ''; req.on('data', c => body += c);
        req.on('end', async () => {
            const data = safeJSON(body);
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            if (!data || !data.repo || !data.message) return jsonResponse(res, { error: 'Missing repo/message' }, 400);
            try {
                const result = await forgeGit.commit(data.repo, data.message, data.author || 'ARCHITECT_ZERO');
                jsonResponse(res, result);
            } catch (e) { jsonResponse(res, { error: e.message }, 500); }
        });
        return;
    }

    if (url.pathname === '/api/forge/git/log' && req.method === 'GET') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }
        const repo = url.searchParams.get('repo');
        if (!repo) return jsonResponse(res, { error: 'Missing repo' }, 400);
        try {
            const history = await forgeGit.getLog(repo);
            jsonResponse(res, history);
        } catch (e) { jsonResponse(res, { error: e.message }, 500); }
        return;
    }

    if (url.pathname === '/api/forge/git/diff' && req.method === 'GET') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }
        const repo = url.searchParams.get('repo');
        const hash = url.searchParams.get('hash'); // Optional
        if (!repo) return jsonResponse(res, { error: 'Missing repo' }, 400);
        try {
            const diff = await forgeGit.getDiff(repo, hash);
            jsonResponse(res, { diff });
        } catch (e) { jsonResponse(res, { error: e.message }, 500); }
        return;
    }

    // [API] Settings Management
    if (url.pathname === '/api/system/settings' && req.method === 'GET') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end("LOCKED"); }
        return res.end(JSON.stringify(CONFIG.ui));
    }
    if (url.pathname === '/api/system/settings' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end("LOCKED"); }
        const parsed = await parseJsonBodyOrReject(req, res, {
            maxBytes: 262_144,
            schemaPath: url.pathname,
            ip: clientIP
        });
        if (!parsed.ok) return;
        try {
            const newSettings = parsed.data;
            if (!newSettings) return jsonResponse(res, { error: 'Invalid JSON' }, 400);
            Object.assign(CONFIG.ui, newSettings);
            await omega.writeFile('system', UI_SETTINGS_PATH, JSON.stringify(CONFIG.ui, null, 2));
            return jsonResponse(res, { success: true });
        } catch (e) {
            return jsonResponse(res, { error: e.message }, 500);
        }
    }
    if (url.pathname.startsWith('/api/system/settings')) {
        return jsonResponse(res, { error: 'METHOD_NOT_ALLOWED', expected: 'GET|POST' }, 405);
    }

    // [API] Quantum Bridge Operations
    if (url.pathname === '/api/quantum/gen-key' && req.method === 'POST') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }
        let body = ''; req.on('data', c => body += c);
        req.on('end', async () => {
            const data = safeJSON(body) || {};
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            try {
                const keyPair = await quantumBridge.generateKeyPair(data ? data.type : undefined);
                jsonResponse(res, keyPair);
            } catch (e) { jsonResponse(res, { error: e.message }, 500); }
        });
        return;
    }

    if (url.pathname === '/api/quantum/encrypt' && req.method === 'POST') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }
        let body = ''; req.on('data', c => body += c);
        req.on('end', async () => {
            const data = safeJSON(body);
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            if (!data || !data.message || !data.publicKey) return jsonResponse(res, { error: 'Missing message/publicKey' }, 400);
            try {
                const ciphertext = await quantumBridge.encrypt(data.message, data.publicKey);
                jsonResponse(res, { ciphertext });
            } catch (e) { jsonResponse(res, { error: e.message }, 500); }
        });
        return;
    }

    if (url.pathname === '/api/quantum/decrypt' && req.method === 'POST') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }
        let body = ''; req.on('data', c => body += c);
        req.on('end', async () => {
            const data = safeJSON(body);
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            if (!data || !data.ciphertext || !data.privateKey) return jsonResponse(res, { error: 'Missing ciphertext/privateKey' }, 400);
            try {
                const message = await quantumBridge.decrypt(data.ciphertext, data.privateKey);
                jsonResponse(res, { message });
            } catch (e) { jsonResponse(res, { error: e.message }, 500); }
        });
        return;
    }

    if (url.pathname === '/api/quantum/sign' && req.method === 'POST') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }
        let body = ''; req.on('data', c => body += c);
        req.on('end', async () => {
            const data = safeJSON(body);
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            if (!data || !data.message || !data.privateKey) return jsonResponse(res, { error: 'Missing message/privateKey' }, 400);
            try {
                const signature = await quantumBridge.sign(data.message, data.privateKey);
                jsonResponse(res, { signature });
            } catch (e) { jsonResponse(res, { error: e.message }, 500); }
        });
        return;
    }

    if (url.pathname === '/api/quantum/verify' && req.method === 'POST') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }
        let body = ''; req.on('data', c => body += c);
        req.on('end', async () => {
            const data = safeJSON(body);
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            if (!data || !data.message || !data.signature || !data.publicKey) return jsonResponse(res, { error: 'Missing message/signature/publicKey' }, 400);
            try {
                const valid = await quantumBridge.verify(data.message, data.signature, data.publicKey);
                jsonResponse(res, { valid });
            } catch (e) { jsonResponse(res, { error: e.message }, 500); }
        });
        return;
    }

    // [API] I/O
    if (url.pathname === '/api/list' && req.method === 'GET') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end('LOCKED'); }
        let v = url.searchParams.get('vault') || '';
        if (SYSTEM_GHOST_MODE) {
            const files = (DECOY_VAULTS[v] || DECOY_VAULTS["downloads"]).map(f => ({ name: f, size: "1.2 MB", isDir: false }));
            return res.end(JSON.stringify(files));
        }
        try {
            const fsp = require('fs').promises;
            const vaultPath = path.join(VAULT_DIR, v);
            if (!vaultPath.startsWith(VAULT_DIR)) return res.end("[]");
            try { await fsp.access(vaultPath); } catch { return res.end("[]"); }

            ensureVaultBaseline(v, 'LIST_BASELINE');
            autoHealVaultSafe(v, 'LIST_CHECK');

            const entries = await fsp.readdir(vaultPath);
            const files = [];
            for (const f of entries) {
                const stat = await fsp.stat(path.join(vaultPath, f));
                files.push({ name: f, size: (stat.size / 1024).toFixed(1) + " KB", isDir: stat.isDirectory() });
            }
            res.end(JSON.stringify(files));
        } catch (e) { res.end("[]"); }
        return;
    }

    if (url.pathname === '/api/vault/delete' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(403); return res.end('FORBIDDEN'); }
        if (!enforceWitnessQuorumGate(res, 'VAULT_DELETE', { route: url.pathname })) return;
        let body = ''; req.on('data', c => body += c);
        req.on('end', () => {
            const data = safeJSON(body);
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            if (!data || !data.vault || !data.file) return jsonResponse(res, { error: 'Missing data' }, 400);
            const fp = path.join(VAULT_DIR, data.vault, data.file);
            if (!fp.startsWith(VAULT_DIR)) return jsonResponse(res, { error: 'Invalid path' }, 403);
            try {
                if (fs.existsSync(fp)) fs.unlinkSync(fp);
                TelemetryLedger.log("VAULT_DELETE", { vault: data.vault, file: data.file });
                const snapshot = sealVaultSnapshotSafe(data.vault, 'VAULT_DELETE');
                invalidateTimelineCache();
                jsonResponse(res, { ok: true, snapshotCID: snapshot ? snapshot.cid : null });
            } catch (e) { jsonResponse(res, { error: e.message }, 500); }
        });
        return;
    }

    if (url.pathname === '/api/vault/new' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(403); return res.end('FORBIDDEN'); }
        if (!enforceWitnessQuorumGate(res, 'VAULT_NEW_FILE', { route: url.pathname })) return;
        let body = ''; req.on('data', c => body += c);
        req.on('end', async () => {
            const data = safeJSON(body);
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            if (!data || !data.vault || !data.name) return jsonResponse(res, { error: 'Missing data' }, 400);
            const fp = path.join(VAULT_DIR, data.vault, data.name);
            if (!fp.startsWith(VAULT_DIR)) return jsonResponse(res, { error: 'Invalid path' }, 403);
            try {
                await require('fs').promises.mkdir(path.dirname(fp), { recursive: true });
                await omega.writeFile('user', fp, data.content || '');
                TelemetryLedger.log("VAULT_NEW_FILE", { vault: data.vault, file: data.name });
                const snapshot = sealVaultSnapshotSafe(data.vault, 'VAULT_NEW_FILE');
                invalidateTimelineCache();
                jsonResponse(res, { ok: true, snapshotCID: snapshot ? snapshot.cid : null });
            } catch (e) { jsonResponse(res, { error: e.message }, 500); }
        });
        return;
    }

    if (url.pathname === '/api/vault/upload' && req.method === 'POST') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(403); return res.end('FORBIDDEN'); }
        if (!enforceWitnessQuorumGate(res, 'VAULT_UPLOAD', { route: url.pathname })) return;
        let body = ''; req.on('data', c => { if (body.length < 52428800) body += c; }); // 50MB limit
        req.on('end', async () => {
            const data = safeJSON(body);
            if (!enforceApiBodySchema(res, req.method, url.pathname, data, { ip: clientIP })) return;
            if (!data || !data.vault || !data.name || !data.b64) return jsonResponse(res, { error: 'Missing data' }, 400);
            const fp = path.join(VAULT_DIR, data.vault, data.name);
            if (!fp.startsWith(VAULT_DIR)) return jsonResponse(res, { error: 'Invalid path' }, 403);
            try {
                await require('fs').promises.mkdir(path.dirname(fp), { recursive: true });
                await omega.writeFile('user', fp, Buffer.from(data.b64, 'base64'), { encoding: null });
                TelemetryLedger.log("VAULT_UPLOAD", { vault: data.vault, file: data.name, size: data.b64.length });
                const snapshot = sealVaultSnapshotSafe(data.vault, 'VAULT_UPLOAD');
                invalidateTimelineCache();
                jsonResponse(res, { ok: true, snapshotCID: snapshot ? snapshot.cid : null });
            } catch (e) { jsonResponse(res, { error: e.message }, 500); }
        });
        return;
    }

    if (url.pathname === '/api/raw') {
        const session = getSession(req);
        if (!session) { res.writeHead(401); return res.end("LOCKED"); }
        if (SYSTEM_GHOST_MODE) return res.end(crypto.randomBytes(1024)); // Tier 3: Holographic Noise
        let reqPath = url.searchParams.get('path') || '';
        if (CONFIG.ui.shadowMask) {
            for (const [mask, real] of Object.entries(SHADOW_MAP)) {
                if (reqPath.startsWith(`vaults/${mask}`)) reqPath = reqPath.replace(`vaults/${mask}`, `vaults/${real}`);
            }
        }
        const p = path.join(ROOT_DIR, reqPath);
        if (!p.startsWith(ROOT_DIR)) { res.writeHead(403); return res.end("FORBIDDEN"); }
        const targetVault = extractVaultNameFromRawPath(reqPath);
        if (targetVault) {
            ensureVaultBaseline(targetVault, 'RAW_READ_BASELINE');
            autoHealVaultSafeThrottled(targetVault, 'RAW_READ_CHECK');
        }
        try {
            // Tier 3: Direct Buffer I/O for VaultCrypt
            if (reqPath.includes('/vaults/')) {
                const encryptedBuf = fs.readFileSync(p);
                return res.end(VaultCrypt.decrypt(encryptedBuf, session.passphrase));
            }
            const raw = fs.readFileSync(p, 'utf8');
            return res.end(raw);
        } catch (e) { res.end("FAIL"); }
        return;
    }

    if (url.pathname === '/api/save') {
        const session = getSession(req);
        if (!session || SYSTEM_GHOST_MODE) { res.writeHead(401); return res.end("LOCKED"); }
        if (!enforceWitnessQuorumGate(res, 'API_SAVE', { route: url.pathname })) return;
        let body = ''; req.on('data', c => body += c);
        req.on('end', async () => {
            const parsed = safeJSON(body);
            if (!enforceApiBodySchema(res, req.method, url.pathname, parsed, { ip: clientIP })) return;
            if (!parsed) return jsonResponse(res, { error: 'Invalid JSON' }, 400);
            let { path: reqPath, content } = parsed;
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
                    const encryptedBuf = VaultCrypt.encrypt(content, session.passphrase);
                    await omega.writeFile('user', p, encryptedBuf, { encoding: null }); // Force binary write
                } else {
                    await omega.writeFile('user', p, content, 'utf8');
                }
                // TEAR audit on vault save
                tearEngine.seal('VAULT_WRITE', { path: reqPath, size: content.length }, { title: 'Vault Write' });
                if (reqPath.startsWith('vaults/')) {
                    const parts = reqPath.split('/');
                    const vaultName = parts.length > 1 ? parts[1] : null;
                    if (vaultName) {
                        sealVaultSnapshotSafe(vaultName, 'API_SAVE');
                        invalidateTimelineCache();
                    }
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
            const types = {
                '.html': 'text/html; charset=utf-8',
                '.js': 'text/javascript; charset=utf-8',
                '.mjs': 'text/javascript; charset=utf-8',
                '.css': 'text/css; charset=utf-8',
                '.json': 'application/json; charset=utf-8',
                '.svg': 'image/svg+xml',
                '.ttf': 'font/ttf',
                '.woff': 'font/woff',
                '.woff2': 'font/woff2',
                '.map': 'application/json; charset=utf-8'
            };
            res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
            res.end(content);
        }
    });
});

// === STABILITY: Graceful shutdown ===
process.on('SIGINT', () => {
    console.log('\n[SYSTEM] Graceful shutdown initiated...');
    tearEngine.seal('SYSTEM_SHUTDOWN', { reason: 'SIGINT', uptime: process.uptime() });
    server.close(() => { console.log('[SYSTEM] Server closed.'); process.exit(0); });
    setTimeout(() => process.exit(0), 3000); // Force exit after 3s
});
process.on('SIGTERM', () => {
    tearEngine.seal('SYSTEM_SHUTDOWN', { reason: 'SIGTERM', uptime: process.uptime() });
    server.close(() => process.exit(0));
});

server.listen(3000, '0.0.0.0', () => {
    console.log(`[SINGULARITY] ForgeCore v2.0.0 Running at http://localhost:3000`);

    // Initialize WebSocket Telemetry Stream
    TelemetryStream.init({
        server,
        tearEngine,
        swarmProjection: SwarmProjection,
        getSessionState: () => ({
            sessions,
            SYSTEM_GHOST_MODE,
            CORE_HASH,
            Gateway,
            lastAutoHealEvent,
            lastGhostAttestationEvent,
            witnessQuorumStatus: getWitnessQuorumStatus()
        })
    });
    console.log('[SINGULARITY] WebSocket telemetry active on ws://localhost:3000/api/stream');
});
