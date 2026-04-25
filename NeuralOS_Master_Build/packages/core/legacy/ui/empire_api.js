/**
 * API Interface for ForgeCore OS
 */
import { State } from './empire_state.js';

// Replaces individual fetching with a unified API class
export class API {
    static _handshakeSolveInflight = new Map();
    static _watchdogBuffer = [];
    static _watchdogMax = 240;

    static get token() {
        return localStorage.getItem('forgecore_session_token');
    }

    static set token(value) {
        if (value) localStorage.setItem('forgecore_session_token', value);
        else localStorage.removeItem('forgecore_session_token');
    }

    static async request(endpoint, method = 'GET', body = null, opts = {}) {
        const methodText = String(method || 'GET').toUpperCase();
        const timeoutRaw = Number(opts && opts.timeoutMs);
        const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? Math.floor(timeoutRaw) : 15000;
        const retriesRaw = Number(opts && opts.retries);
        const retries = Number.isFinite(retriesRaw)
            ? Math.max(0, Math.floor(retriesRaw))
            : (methodText === 'GET' ? 1 : 0);

        let attempt = 0;
        while (attempt <= retries) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(new Error(`API_TIMEOUT:${timeoutMs}ms`)), timeoutMs);
            const startedAt = Date.now();
            try {
                const options = {
                    method: methodText,
                    headers: {},
                    signal: controller.signal
                };
                const endpointText = String(endpoint || '');
                const isHandshakeRoute = endpointText === '/api/handshake' || endpointText.startsWith('/api/handshake?');

                // Add Session Token
                if (this.token) {
                    options.headers.Authorization = `Bearer ${this.token}`;
                }

                if (body !== null && body !== undefined) {
                    options.headers['Content-Type'] = 'application/json';
                    options.body = JSON.stringify(body);
                }

                const res = await fetch(endpoint, options);
                this._emitWatchdog({
                    ts: new Date().toISOString(),
                    endpoint: endpointText,
                    method: methodText,
                    status: Number(res.status || 0),
                    ok: res.status >= 200 && res.status < 400,
                    attempt: attempt + 1,
                    maxAttempts: retries + 1,
                    durationMs: Math.max(0, Date.now() - startedAt)
                });
                if (res.status === 401 && !State.get('uiLocked') && !isHandshakeRoute) {
                    // If we get 401, clear token and trigger lockdown
                    this.token = null;
                    State.set('uiLocked', true);
                    window.dispatchEvent(new CustomEvent('forgecore:auth-expired'));
                }
                return res;
            } catch (e) {
                const isAbort = e && (e.name === 'AbortError' || String(e.message || '').includes('API_TIMEOUT'));
                const canRetry = attempt < retries && (isAbort || methodText === 'GET');
                if (canRetry) {
                    attempt += 1;
                    continue;
                }
                this._emitWatchdog({
                    ts: new Date().toISOString(),
                    endpoint: String(endpoint || ''),
                    method: methodText,
                    status: 0,
                    ok: false,
                    attempt: attempt + 1,
                    maxAttempts: retries + 1,
                    durationMs: Math.max(0, Date.now() - startedAt),
                    error: String(e && e.message ? e.message : e)
                });
                console.error(`API Error [${endpoint}] attempt=${attempt + 1}/${retries + 1}:`, e);
                throw e;
            } finally {
                clearTimeout(timer);
            }
        }
        throw new Error(`API_REQUEST_FAILED:${String(endpoint)}`);
    }

    static _emitWatchdog(sample) {
        if (!sample || typeof sample !== 'object') return;
        this._watchdogBuffer.push(sample);
        if (this._watchdogBuffer.length > this._watchdogMax) {
            this._watchdogBuffer.splice(0, this._watchdogBuffer.length - this._watchdogMax);
        }
        try {
            window.__FORGE_API_WATCHDOG = this._watchdogBuffer.slice(-this._watchdogMax);
            window.dispatchEvent(new CustomEvent('forgecore:api-watchdog', { detail: sample }));
        } catch {
            // Watchdog is best-effort only.
        }
    }

    static getWatchdogTrace(limit = 40) {
        const n = Math.max(1, Math.min(500, Number(limit || 40)));
        return this._watchdogBuffer.slice(-n);
    }

    // Auth
    static async unlock(passphrase) {
        const res = await fetch('/api/system/unlock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passphrase })
        });
        const raw = await res.text();
        let data;
        try {
            data = raw ? JSON.parse(raw) : {};
        } catch {
            data = { success: false, error: `UNPARSEABLE_UNLOCK_RESPONSE:${res.status}` };
        }
        if (typeof data.success !== 'boolean') {
            data.success = res.status >= 200 && res.status < 300;
        }
        if (data.success && data.token) {
            this.token = data.token;
        }
        return data;
    }

    static async getPassphraseStatus() {
        const res = await this.request('/api/system/passphrase/status', 'GET', null, { timeoutMs: 8000, retries: 1 });
        return res.json();
    }

    static async bootstrapPassphrase(passphrase, confirm = "") {
        const payload = { passphrase };
        if (String(confirm || '').trim()) payload.confirm = String(confirm);
        const res = await this.request('/api/system/passphrase/bootstrap', 'POST', payload, { timeoutMs: 12000, retries: 0 });
        return res.json();
    }

    static async recoverPassphrase(passphrase, confirm = "", confirmPhrase = "RESET MASTER PASSPHRASE") {
        const payload = {
            passphrase,
            confirmPhrase: String(confirmPhrase || "RESET MASTER PASSPHRASE")
        };
        if (String(confirm || '').trim()) payload.confirm = String(confirm);
        const res = await this.request('/api/system/passphrase/recover/reset', 'POST', payload, { timeoutMs: 12000, retries: 0 });
        return res.json();
    }

    static async logout() {
        try {
            await this.request('/api/system/logout', 'POST');
        } finally {
            this.token = null;
        }
    }

    static async getHandshake() {
        // Handshake can intentionally return 401 challenge frames (PoI bootstrap).
        // Solve challenge locally, then reattempt so callers get authoritative status/seal.
        const res = await this.request('/api/handshake', 'GET', null, { timeoutMs: 12000, retries: 1 });
        const frame = await res.json();
        if (frame && frame.status === 'CHALLENGE' && frame.target) {
            const solved = await this.solveHandshakeChallenge(frame.target, frame.difficulty || '000');
            const solvedRes = await this.request('/api/handshake', 'POST', {
                target: frame.target,
                nonce: solved
            }, { timeoutMs: 12000, retries: 0 });
            return solvedRes.json();
        }
        return frame;
    }

    static async solveHandshakeChallenge(target, difficulty = '000') {
        const challengeTarget = String(target || '');
        const prefix = String(difficulty || '000');
        const key = `${challengeTarget}|${prefix}`;
        if (this._handshakeSolveInflight.has(key)) {
            return this._handshakeSolveInflight.get(key);
        }

        const promise = (async () => {
            const maxIterations = 3_000_000;
            for (let nonce = 0; nonce < maxIterations; nonce += 1) {
                const digest = await this.sha256Hex(`${challengeTarget}${nonce}`);
                if (digest.startsWith(prefix)) {
                    return String(nonce);
                }
                if (nonce > 0 && nonce % 2500 === 0) {
                    await new Promise((resolve) => setTimeout(resolve, 0));
                }
            }
            throw new Error(`POI_SOLVE_TIMEOUT:${prefix}`);
        })();
        this._handshakeSolveInflight.set(key, promise);

        try {
            return await promise;
        } finally {
            this._handshakeSolveInflight.delete(key);
        }
    }

    static async sha256Hex(input) {
        const encoded = new TextEncoder().encode(String(input));
        const digest = await crypto.subtle.digest('SHA-256', encoded);
        const bytes = new Uint8Array(digest);
        let hex = '';
        for (let i = 0; i < bytes.length; i += 1) {
            hex += bytes[i].toString(16).padStart(2, '0');
        }
        return hex;
    }

    // System
    static async executeCommand(command, args) {
        const res = await this.request('/api/system/execute', 'POST', { command, args });
        return res.json();
    }

    static async getSettings() {
        const res = await this.request('/api/system/settings');
        return res.json();
    }

    static async saveSettings(settings) {
        return this.request('/api/system/settings', 'POST', settings);
    }

    // Vaults
    static async listVault(vault) {
        const res = await this.request(`/api/list?vault=${vault}`);
        return res.json();
    }

    static async createVaultFile(vault, name) {
        const res = await this.request('/api/vault/new', 'POST', { vault, name });
        return res.json();
    }

    static async uploadVaultFile(vault, name, b64) {
        const res = await this.request('/api/vault/upload', 'POST', { vault, name, b64 });
        return res.json();
    }

    static async deleteVaultFile(vault, file) {
        const res = await this.request('/api/vault/delete', 'POST', { vault, file });
        return res.json();
    }

    // XXXplorer (Merkle-DAG)
    static async getXxxHistory(vault) {
        const res = await this.request('/api/xxxplorer/history', 'POST', { vault });
        return res.json();
    }

    static async resurrectState(vault, cid) {
        const res = await this.request('/api/xxxplorer/resurrect', 'POST', { vault, cid });
        return res.json();
    }

    // NeuralPass (TPM Vault)
    static async npStore(id, secret) {
        const res = await this.request('/api/neuralpass/store', 'POST', { id, secret });
        return res.json();
    }

    static async npRetrieve(id) {
        const res = await this.request('/api/neuralpass/retrieve', 'POST', { id });
        return res.json();
    }

    static async npDelete(id) {
        const res = await this.request('/api/neuralpass/delete', 'POST', { id });
        return res.json();
    }

    static async npList() {
        const res = await this.request('/api/neuralpass/list', 'GET');
        return res.json();
    }

    // ZeroTrace Forensic Auditor
    static async getCertificate() {
        const res = await this.request('/api/system/certificate', 'GET');
        return res.json();
    }

    static async getDiagnostics() {
        const res = await this.request('/api/system/diagnostics', 'GET');
        return res.json();
    }

    static async getRuntimeDoctor() {
        const res = await this.request('/api/system/doctor', 'GET', null, { timeoutMs: 15000, retries: 0 });
        return res.json();
    }

    static async repairRuntime(mode = 'safe') {
        const safeMode = String(mode || 'safe').trim().toLowerCase();
        const res = await this.request('/api/system/doctor/repair', 'POST', { mode: safeMode }, { timeoutMs: 60000, retries: 0 });
        return res.json();
    }

    static async getCapabilities() {
        const res = await this.request('/api/system/capabilities', 'GET', null, { timeoutMs: 10000, retries: 1 });
        return res.json();
    }

    static async getNeuralEmpireStatus() {
        const res = await this.request('/api/neural-empire/status', 'GET', null, { timeoutMs: 12000, retries: 0 });
        return res.json();
    }

    static async getNeuralEmpireModules() {
        const res = await this.request('/api/neural-empire/modules', 'GET', null, { timeoutMs: 12000, retries: 0 });
        return res.json();
    }

    static async getNeuralEmpireSignals(limit = 80) {
        const n = Math.max(1, Math.min(500, Number(limit || 80)));
        const res = await this.request(`/api/neural-empire/signals?limit=${n}`, 'GET', null, { timeoutMs: 12000, retries: 0 });
        return res.json();
    }

    static async getNeuralEmpireAgents() {
        const res = await this.request('/api/neural-empire/agents', 'GET', null, { timeoutMs: 12000, retries: 0 });
        return res.json();
    }

    static async runNeuralEmpireAgent(agentId, payload = {}) {
        const res = await this.request('/api/neural-empire/agents/run', 'POST', {
            agentId,
            payload: payload && typeof payload === 'object' ? payload : {}
        }, { timeoutMs: 15000, retries: 0 });
        return res.json();
    }

    static async hypersnatchDecode(url, baseUrl = '') {
        const payload = { url: String(url || '') };
        if (String(baseUrl || '').trim()) payload.baseUrl = String(baseUrl || '').trim();
        const res = await this.request('/api/neural-empire/hypersnatch/decode', 'POST', payload, { timeoutMs: 12000, retries: 0 });
        return res.json();
    }

    static async neuraltubeAnalyze(payload = {}) {
        const body = payload && typeof payload === 'object' ? payload : {};
        const res = await this.request('/api/neural-empire/neuraltube/analyze', 'POST', body, { timeoutMs: 20000, retries: 0 });
        return res.json();
    }

    static async getAkRuntimeStatus() {
        const res = await this.request('/api/runtime/ak/status', 'GET', null, { timeoutMs: 12000, retries: 0 });
        return res.json();
    }

    static async runAkScenario(options = {}) {
        const payload = {};
        if (options && typeof options === 'object') {
            if (typeof options.outDir === 'string' && options.outDir.trim()) payload.outDir = options.outDir.trim();
            if (typeof options.proofOut === 'string' && options.proofOut.trim()) payload.proofOut = options.proofOut.trim();
        }
        const res = await this.request('/api/runtime/ak/scenario', 'POST', payload, { timeoutMs: 180000, retries: 0 });
        return res.json();
    }

    static async generateAkProof(options = {}) {
        const payload = {};
        if (options && typeof options === 'object') {
            if (typeof options.outDir === 'string' && options.outDir.trim()) payload.outDir = options.outDir.trim();
            if (typeof options.out === 'string' && options.out.trim()) payload.out = options.out.trim();
            if (typeof options.proofOut === 'string' && options.proofOut.trim()) payload.proofOut = options.proofOut.trim();
        }
        const res = await this.request('/api/runtime/ak/proof', 'POST', payload, { timeoutMs: 180000, retries: 0 });
        return res.json();
    }

    static async exportDiagnostics(note = '') {
        const res = await this.request('/api/system/diagnostics/export', 'POST', { note });
        return res.json();
    }

    static async recordActionProvenance(event) {
        const res = await this.request('/api/system/action-provenance', 'POST', event, { timeoutMs: 8000, retries: 0 });
        return res.json();
    }

    // Faraday Bridge
    static async getFaradayStream() {
        const res = await this.request('/api/system/execute', 'POST', { commandString: 'faraday' });
        return res.json();
    }
}
