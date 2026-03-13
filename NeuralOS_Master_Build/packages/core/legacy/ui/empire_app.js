/**
 * Main Application Controller for ForgeCore OS
 */
import { State } from './empire_state.js';
import { API } from './empire_api.js';
import { CanvasRenderer } from './empire_canvas.js';
import { ForgeEditor } from './empire_forge.js';
import { CryptoDB } from './empire_crypto.js';

export let term = null;
export let fitAddon = null;
let commandStr = '';
const escapeActionArg = (value) => String(value == null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");

// --- [IP_GOLD] NEURAL RHYTHMS: COGNITIVE BIOMETRICS ---
const NeuralRhythms = {
    baselineFlightTime: 0,
    baselineDwellTime: 0,
    keystrokes: 0,
    lastKeyDown: 0,
    currentKeyDown: 0,
    tolerance: 0.45, // 45% variance allowed
    isCalibrating: true,
    anomalyCount: 0,
    
    recordKeyDown() {
        this.currentKeyDown = performance.now();
        if (this.lastKeyDown !== 0) {
            const flightTime = this.currentKeyDown - this.lastKeyDown;
            this.analyze(flightTime, 'flight');
        }
    },
    
    recordKeyUp() {
        const dwellTime = performance.now() - this.currentKeyDown;
        this.analyze(dwellTime, 'dwell');
        this.lastKeyDown = this.currentKeyDown;
    },

    analyze(time, type) {
        if (time > 1000) return; // Ignore long pauses
        
        if (this.isCalibrating) {
            this.keystrokes++;
            if (type === 'flight') {
                this.baselineFlightTime = ((this.baselineFlightTime * (this.keystrokes - 1)) + time) / this.keystrokes;
            } else {
                this.baselineDwellTime = ((this.baselineDwellTime * (this.keystrokes - 1)) + time) / this.keystrokes;
            }
            if (this.keystrokes > 100) {
                this.isCalibrating = false;
                log(`[NEURAL_RHYTHMS] Cognitive baseline established. Continuous biometric auth active.`, "OK");
            }
        } else {
            // Live verification
            const baseline = type === 'flight' ? this.baselineFlightTime : this.baselineDwellTime;
            if (baseline < 10) return; // Avoid dividing by zero or tiny baselines
            const variance = Math.abs(baseline - time) / baseline;
            
            if (variance > this.tolerance) {
                this.anomalyCount++;
                if (this.anomalyCount > 5) {
                    log(`[NEURAL_RHYTHMS] CRITICAL BIOMETRIC ANOMALY DETECTED.`, "CRITICAL");
                    API.request('/api/system/execute', 'POST', { commandString: 'wipe cache' });
                    document.getElementById('lockdown').style.display = 'flex';
                    State.set('uiLocked', true);
                    this.anomalyCount = 0; // Reset after lockdown
                }
            } else {
                // Decay anomaly count on normal typing
                if (this.anomalyCount > 0) this.anomalyCount -= 0.5; 
            }
        }
    }
};

export function log(msg, st = "SYS") {
    if (!term) return;
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    const colors = {
        "ERR": "\x1b[31m",
        "CRITICAL": "\x1b[1;31m",
        "OK": "\x1b[32m",
        "SYS": "\x1b[36m",
        "USER": "\x1b[37m",
        "KERN": "\x1b[33m",
        "HEARTBEAT": "\x1b[90m",
        "AUTH": "\x1b[35m",
        "WARN": "\x1b[33m"
    };
    const c = colors[st] || "\x1b[90m";
    const dim = "\x1b[90m";
    const reset = "\x1b[0m";
    term.writeln(`${dim}[${ts}]${reset}${c} [${st}] ${reset}${msg}`);
}

class App {
    constructor() {
        this.renderer = new CanvasRenderer();
        this.forge = new ForgeEditor();
        this._timersStarted = false;
        this._telemetryWs = null;
        this._telemetryReconnectTimer = null;
        this._releaseIntegrityTimer = null;
        this._ztInitialized = false;
        this._ztTargets = [];
        this._ztFilePicker = null;
        this._lastEscAt = 0;
        this._memoryReady = false;
        this._memoryHydrating = false;
        this._memoryPersistTimer = null;
        this._memoryPersistInFlight = false;
        this._memoryPersistQueued = false;
        this._memoryInterval = null;
        this._cryptoReady = false;
        this._unlockInFlight = false;
        this._emergencyCloseInFlight = false;
        this._runtimeReady = false;
        this._runtimeReadyProbeInFlight = false;
        this._runtimeReadyProbeTimer = null;
        this._runtimeReadyFailures = 0;
        this._runtimeBootstrapRequired = false;
        this._bootstrapPassphraseInFlight = false;
        this._recoverPassphraseInFlight = false;
        this._lockDiagTimer = null;
        this._lockDiagLastError = 'NONE';
        this._apiWatchdogLastEmitAt = 0;
        this._apiWatchdogDropCount = 0;
        this._apiWatchdogFailures = [];
        this._apiWatchdogMax = 120;
        this._apiWatchdogWindowMs = 60000;
        this._swarmRetryJobs = new Map();
        this._actionCaps = null;
        this._actionCapsById = new Map();
        this._actionCapsRefreshInFlight = false;
        this._actionCapsFetchedAt = 0;
        this._actionCapsRefreshTimer = null;
        this._actionCapsLastError = null;
        this._paneCapsById = new Map();
        this._actionProvenanceQueue = [];
        this._actionProvenanceTimer = null;
        this._actionProvenanceInFlight = false;
        this._actionProvenanceLastError = null;
        this._dialogState = {
            open: false,
            resolver: null,
            mode: 'confirm'
        };
        this.initTerminal();
        this.initDelegation();
        this.initPlatformHooks();
        this.initActionDialog();
        this.initZeroTrace();
        this.startRuntimeReadinessProbe();
        this.startLockDiagnosticsLoop();
        this._applyShell(State.get('shell'));
        this.refreshActionCapabilities('boot').catch(() => { });
    }

    switchShell(id) {
        if (!id) return;
        const current = State.get('shell');
        if (current === id) return;

        log(`SHELL_TRANSITION: ${current.toUpperCase()} -> ${id.toUpperCase()}`, "SYS");
        State.set('shell', id);
        this._applyShell(id);
        this.scheduleRuntimeMemoryPersist(`switch_shell:${id}`);
    }

    _applyShell(id) {
        const productTag = document.getElementById('productTag');
        if (!productTag) return;

        // UI Feedback: Update button active states
        document.querySelectorAll('.shell-btn').forEach(btn => {
            const action = btn.getAttribute('data-action') || '';
            btn.classList.toggle('active', action.includes(`'${id}'`));
        });

        // Theme & Branding Adjustments
        switch (id) {
            case 'winshadow':
                productTag.textContent = 'WIN_SHADOW™';
                document.body.style.setProperty('--accent', '#58a6ff'); // Blue
                document.body.style.fontFamily = "'Inter', sans-serif";
                break;
            case 'neuralmac':
                productTag.textContent = 'NEURAL_MAC™';
                document.body.style.setProperty('--accent', '#ff5a6f'); // Rose/Red
                document.body.style.fontFamily = "'Outfit', sans-serif";
                break;
            case 'neurallinux':
                productTag.textContent = 'NEURAL_LINUX™';
                document.body.style.setProperty('--accent', '#00ff41'); // Terminal Green
                document.body.style.fontFamily = "'JetBrains Mono', monospace";
                break;
        }

        // [NEURALOS_MASTER] Ritual UX: Pulse on shell change
        productTag.classList.add('pulsing');
        setTimeout(() => productTag.classList.remove('pulsing'), 2000);
    }

    initTerminal() {
        if (!window.Terminal) {
            setTimeout(() => this.initTerminal(), 200);
            return;
        }

        term = new window.Terminal({
            cursorBlink: true,
            theme: { background: '#0a0c10', foreground: '#e6edf3', cursor: '#00ff41' },
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: 12,
            lineHeight: 1.2
        });
        fitAddon = new window.FitAddon.FitAddon();
        term.loadAddon(fitAddon);

        const termElement = document.getElementById('term');
        if (termElement) {
            term.open(termElement);
            fitAddon.fit();

            term.writeln("\x1b[32m[READY] ForgeCore™ SINGULARITY-PRIME v3.0.0-Quantum initialized.\x1b[0m");
            term.writeln("\x1b[36m[OMEGA] Security Kernel Active. Brokers Engaged.\x1b[0m");
            term.writeln("\x1b[35m[QUANTUM] Bridge Connected. Lattice-based Crypto ARMED.\x1b[0m");
            term.write("\x1b[36mFORGE_OS>\x1b[0m ");

            // Handle terminal input
            term.onData(e => {
                if (State.get('uiLocked')) return;

                switch (e) {
                    case '\r': // Enter
                        term.writeln("");
                        if (commandStr.trim().length > 0) {
                            this.dispatchTerminalCommand(commandStr);
                        } else {
                            term.write("\x1b[36mFORGE_OS>\x1b[0m ");
                        }
                        commandStr = '';
                        break;
                    case '\x7F': // Backspace
                        if (commandStr.length > 0) {
                            term.write('\b \b');
                            commandStr = commandStr.substring(0, commandStr.length - 1);
                        }
                        break;
                    default:
                        // Ignore non-printable generic controls (arrows, etc for now)
                        if (e >= String.fromCharCode(0x20) && e <= String.fromCharCode(0x7E) || e >= '\u00a0') {
                            commandStr += e;
                            term.write(e);
                        }
                }
            });

            window.addEventListener('resize', () => {
                if (fitAddon) fitAddon.fit();
            });

            // [IP_GOLD] NEURAL RHYTHMS: Attach cognitive biometric listeners
            termElement.addEventListener('keydown', (e) => {
                if (!State.get('uiLocked')) NeuralRhythms.recordKeyDown();
            });
            termElement.addEventListener('keyup', (e) => {
                if (!State.get('uiLocked')) NeuralRhythms.recordKeyUp();
            });
        }
    }

    initPlatformHooks() {
        window.addEventListener('forgecore:auth-expired', () => {
            this.triggerLockdown();
        });
        window.addEventListener('forgecore:api-watchdog', (event) => {
            this.handleApiWatchdog(event && event.detail ? event.detail : null);
        });

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js').catch((err) => {
                    console.warn('Service worker registration failed:', err);
                });
            });
        }

        window.addEventListener('beforeunload', () => {
            if (this._telemetryReconnectTimer) {
                clearTimeout(this._telemetryReconnectTimer);
                this._telemetryReconnectTimer = null;
            }
            if (this._releaseIntegrityTimer) {
                clearInterval(this._releaseIntegrityTimer);
                this._releaseIntegrityTimer = null;
            }
            if (this._telemetryWs && this._telemetryWs.readyState <= 1) {
                this._telemetryWs.close();
            }
            if (this._memoryPersistTimer) {
                clearTimeout(this._memoryPersistTimer);
                this._memoryPersistTimer = null;
            }
            if (this._memoryInterval) {
                clearInterval(this._memoryInterval);
                this._memoryInterval = null;
            }
            if (this._actionCapsRefreshTimer) {
                clearTimeout(this._actionCapsRefreshTimer);
                this._actionCapsRefreshTimer = null;
            }
            if (this._actionProvenanceTimer) {
                clearTimeout(this._actionProvenanceTimer);
                this._actionProvenanceTimer = null;
            }
            if (this._runtimeReadyProbeTimer) {
                clearTimeout(this._runtimeReadyProbeTimer);
                this._runtimeReadyProbeTimer = null;
            }
            if (this._lockDiagTimer) {
                clearTimeout(this._lockDiagTimer);
                this._lockDiagTimer = null;
            }
            if (this._swarmRetryJobs && this._swarmRetryJobs.size) {
                for (const job of this._swarmRetryJobs.values()) {
                    if (job && job.timer) clearTimeout(job.timer);
                }
                this._swarmRetryJobs.clear();
            }
            this.flushActionProvenanceQueue();
            this.persistRuntimeMemoryLocal();
        });
    }

    // --- EVENT DELEGATION (CSP Compliant) ---
    initDelegation() {
        document.body.addEventListener('click', (e) => {
            const tempTarget = e.target.closest('[data-action]');
            if (!tempTarget) return;

            const actionStr = tempTarget.getAttribute('data-action');
            if (!actionStr) return;

            try {
                const parsed = this._parseAction(actionStr);
                if (!parsed) return;
                const { fnName, args } = parsed;
                if (!this._canExecuteAction(fnName, tempTarget, args)) return;
                const started = Date.now();
                this.recordActionProvenance(fnName, 'dispatch', {
                    activeTab: String(State.get('activeTab') || ''),
                    source: 'ui'
                });

                let actionResult = null;
                if (typeof this[fnName] === 'function') {
                    actionResult = this[fnName](...args, tempTarget);
                } else if (typeof this.forge[fnName] === 'function') {
                    actionResult = this.forge[fnName](...args);
                } else {
                    console.warn('Unknown action:', fnName);
                    log(`UI action not wired: ${fnName}`, "WARN");
                    this.recordActionProvenance(fnName, 'error', {
                        reason: 'UI_ACTION_NOT_WIRED',
                        activeTab: String(State.get('activeTab') || ''),
                        source: 'ui'
                    });
                    return;
                }

                Promise.resolve(actionResult).then(() => {
                    this.recordActionProvenance(fnName, 'ok', {
                        durationMs: Date.now() - started,
                        activeTab: String(State.get('activeTab') || ''),
                        source: 'ui'
                    });
                }).catch((err) => {
                    const reason = String(err && err.message ? err.message : err);
                    this.recordActionProvenance(fnName, 'error', {
                        durationMs: Date.now() - started,
                        reason: reason.slice(0, 240),
                        activeTab: String(State.get('activeTab') || ''),
                        source: 'ui'
                    });
                });
            } catch (err) {
                console.error("Delegation execution failed", err);
                log(`UI action dispatch failed: ${err.message}`, "ERR");
            }
        });

        // Keydown handlers
        document.body.addEventListener('keydown', (e) => {
            const target = e.target.closest('[data-keydown]');
            if (!target) return;
            const action = target.getAttribute('data-keydown');

            if (e.key === 'Enter') {
                if (action === 'unlock') {
                    if (this._canExecuteAction('unlock', target)) this.unlock();
                }
                if (action === 'forgeSearch') {
                    if (this._canExecuteAction('forgeSearch', target)) this.forgeSearch();
                }
            }
        });

        // Change handlers
        document.body.addEventListener('change', (e) => {
            const target = e.target.closest('[data-change]');
            if (!target) return;
            const action = target.getAttribute('data-change');
            if (action === 'vaultUploadFile') this.vaultUploadFile(e.target);
            if (action === 'applyTheme') this.applyTheme(e.target.value);
            if (action === 'toggleShadowMask') this.toggleShadowMask(e.target.checked);
            if (action === 'loadForgeTree') this.forge.loadTree();
        });

        // Input handlers
        document.body.addEventListener('input', (e) => {
            const target = e.target.closest('[data-input]');
            if (!target) return;
            const action = target.getAttribute('data-input');
            if (action === 'updateOpacity') {
                const el = document.getElementById('particles');
                if (el) el.style.opacity = e.target.value;
                const opacity = Number(e.target.value);
                if (Number.isFinite(opacity)) {
                    State.set('matrixOpacity', opacity);
                    this.scheduleRuntimeMemoryPersist('matrix_opacity');
                }
            }
        });

        // Ensure Monaco repaints on tab switch
        State.subscribe((key) => {
            if (key === 'activeTab' && State.get('activeTab') === 'forge') {
                this.forge.layout();
            }
        });

        // Anti-Tamper / DevTools Defense
        document.addEventListener('contextmenu', e => {
            e.preventDefault();
            log("TAMPER_ATTEMPT: Unauthorized Context Access Blocked.", "WARN");
        });

        document.addEventListener('keydown', e => {
            // F12 or Ctrl+Shift+I
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
                e.preventDefault();
                log("TAMPER_ATTEMPT: Diagnostic Interface Locked.", "CRITICAL");
                // Notify backend if necessary in future
                API.request('/api/system/tamper', 'POST', { type: 'DevTools' }).catch(() => { });
                return;
            }

            // Emergency fail-safe close: Ctrl+Shift+Q / Ctrl+Shift+W
            if (e.ctrlKey && e.shiftKey && (e.key === 'Q' || e.key === 'W')) {
                e.preventDefault();
                this.emergencyClose();
                return;
            }

            // Double-ESC force-close path
            if (e.key === 'Escape') {
                const now = Date.now();
                if (now - this._lastEscAt < 1200) {
                    e.preventDefault();
                    this.emergencyClose();
                    this._lastEscAt = 0;
                    return;
                }
                this._lastEscAt = now;
                log("Press ESC again to force close.", "WARN");
            }
        });
    }

    initActionDialog() {
        const overlay = document.getElementById('actionDialogOverlay');
        const title = document.getElementById('actionDialogTitle');
        const message = document.getElementById('actionDialogMessage');
        const input = document.getElementById('actionDialogInput');
        const confirmBtn = document.getElementById('actionDialogConfirm');
        const cancelBtn = document.getElementById('actionDialogCancel');
        if (!overlay || !title || !message || !input || !confirmBtn || !cancelBtn) return;

        this._dialogEls = { overlay, title, message, input, confirmBtn, cancelBtn };
        const resolveDialog = (confirmed) => {
            if (!this._dialogState.open) return;
            const resolver = this._dialogState.resolver;
            const mode = this._dialogState.mode;
            this._dialogState.open = false;
            this._dialogState.mode = 'confirm';
            this._dialogState.resolver = null;
            overlay.style.display = 'none';
            if (resolver) {
                if (!confirmed) {
                    resolver(mode === 'prompt' ? null : false);
                    return;
                }
                const value = mode === 'prompt' ? String(input.value || '').trim() : true;
                resolver(value);
            }
        };

        confirmBtn.addEventListener('click', () => {
            if (!this._dialogState.open) return;
            if (this._dialogState.mode === 'prompt') {
                const rule = this._dialogState.pattern;
                const text = String(input.value || '').trim();
                if (!text) return;
                if (rule && !rule.test(text)) {
                    message.textContent = this._dialogState.validationMessage || 'INVALID_INPUT_FORMAT';
                    return;
                }
            }
            resolveDialog(true);
        });

        cancelBtn.addEventListener('click', () => resolveDialog(false));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) resolveDialog(false);
        });

        document.addEventListener('keydown', (e) => {
            if (!this._dialogState.open) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                resolveDialog(false);
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmBtn.click();
            }
        });
    }

    async requestConfirmation(message, options = {}) {
        const text = String(message || '').trim() || 'CONFIRM_ACTION?';
        if (!this._dialogEls) {
            return !!window.confirm(text);
        }

        const { overlay, title, message: messageEl, input, confirmBtn, cancelBtn } = this._dialogEls;
        if (this._dialogState.open) return false;

        title.textContent = String(options.title || 'CONFIRM_ACTION');
        messageEl.textContent = text;
        input.style.display = 'none';
        input.value = '';
        confirmBtn.textContent = String(options.confirmLabel || 'CONFIRM');
        cancelBtn.textContent = String(options.cancelLabel || 'CANCEL');
        overlay.style.display = 'flex';

        return new Promise((resolve) => {
            this._dialogState = {
                open: true,
                mode: 'confirm',
                resolver: resolve,
                pattern: null,
                validationMessage: ''
            };
        });
    }

    async requestTextInput(message, options = {}) {
        const text = String(message || '').trim() || 'INPUT_REQUIRED';
        const useNative = options && options.native === true;
        if (useNative || !this._dialogEls) {
            const raw = window.prompt(text, String(options.defaultValue || ''));
            if (raw == null) return null;
            return String(raw).trim();
        }

        const { overlay, title, message: messageEl, input, confirmBtn, cancelBtn } = this._dialogEls;
        if (this._dialogState.open) return null;

        const rawPattern = options.pattern;
        const pattern = rawPattern instanceof RegExp
            ? rawPattern
            : (typeof rawPattern === 'string' && rawPattern.trim() ? new RegExp(rawPattern) : null);
        const defaultValue = String(options.defaultValue || '');

        title.textContent = String(options.title || 'INPUT_REQUIRED');
        messageEl.textContent = text;
        input.style.display = 'block';
        input.value = defaultValue;
        input.placeholder = String(options.placeholder || 'ENTER_VALUE');
        confirmBtn.textContent = String(options.confirmLabel || 'SUBMIT');
        cancelBtn.textContent = String(options.cancelLabel || 'CANCEL');
        overlay.style.display = 'flex';
        setTimeout(() => input.focus(), 0);

        return new Promise((resolve) => {
            this._dialogState = {
                open: true,
                mode: 'prompt',
                resolver: resolve,
                pattern,
                validationMessage: String(options.validationMessage || 'INVALID_INPUT_FORMAT')
            };
        });
    }

    _resolveActionProvenanceRoute(actionId) {
        const cap = this._getActionCapability(actionId);
        const probes = cap && Array.isArray(cap.probes) ? cap.probes : [];
        const probe = probes.find((row) => row && (row.normalizedPath || row.path)) || null;
        if (!probe) return '';
        return String(probe.normalizedPath || probe.path || '').slice(0, 2048);
    }

    recordActionProvenance(actionId, phase, details = {}) {
        const safeAction = String(actionId || '').replace(/[^A-Za-z0-9_\-\.]/g, '').slice(0, 128);
        if (!safeAction) return;
        const safePhase = String(phase || 'dispatch').toLowerCase();
        const allowed = new Set(['dispatch', 'ok', 'blocked', 'error', 'probe']);
        const payload = {
            actionId: safeAction,
            phase: allowed.has(safePhase) ? safePhase : 'dispatch',
            route: String(details.route || this._resolveActionProvenanceRoute(safeAction) || '').slice(0, 2048),
            reason: String(details.reason || '').slice(0, 512),
            activeTab: String(details.activeTab || State.get('activeTab') || '').slice(0, 128),
            durationMs: Number.isFinite(Number(details.durationMs)) ? Number(details.durationMs) : undefined,
            source: String(details.source || 'ui').slice(0, 64)
        };

        this._actionProvenanceQueue.push(payload);
        if (this._actionProvenanceQueue.length > 240) {
            this._actionProvenanceQueue.splice(0, this._actionProvenanceQueue.length - 240);
        }
        this.scheduleActionProvenanceFlush();
    }

    scheduleActionProvenanceFlush() {
        if (this._actionProvenanceTimer) return;
        this._actionProvenanceTimer = setTimeout(() => {
            this._actionProvenanceTimer = null;
            this.flushActionProvenanceQueue();
        }, 120);
    }

    async flushActionProvenanceQueue() {
        if (this._actionProvenanceInFlight) return;
        if (!this._actionProvenanceQueue.length) return;
        if (State.get('uiLocked')) {
            this._actionProvenanceQueue = [];
            return;
        }

        this._actionProvenanceInFlight = true;
        try {
            while (this._actionProvenanceQueue.length > 0) {
                const item = this._actionProvenanceQueue[0];
                const res = await API.recordActionProvenance(item);
                if (!res || res.success !== true) {
                    throw new Error(`ACTION_PROVENANCE_REJECTED:${res && res.error ? res.error : 'unknown'}`);
                }
                this._actionProvenanceQueue.shift();
            }
            this._actionProvenanceLastError = null;
        } catch (err) {
            const msg = String(err && err.message ? err.message : err);
            if (this._actionProvenanceLastError !== msg) {
                this._actionProvenanceLastError = msg;
                log(`ACTION_PROVENANCE_WARN:${msg}`, 'WARN');
            }
            this.scheduleActionProvenanceFlush();
        } finally {
            this._actionProvenanceInFlight = false;
        }
    }

    _parseAction(actionStr) {
        const raw = String(actionStr || '').trim();
        const match = raw.match(/^([a-zA-Z0-9_]+)(?:\(([\s\S]*)\))?$/);
        if (!match) return null;
        return {
            fnName: match[1],
            args: this._parseActionArgs(match[2] || '')
        };
    }

    _parseActionArgs(rawArgs) {
        if (!rawArgs || !rawArgs.trim()) return [];
        const args = [];
        let current = '';
        let quote = null;
        let escape = false;

        for (let i = 0; i < rawArgs.length; i++) {
            const ch = rawArgs[i];
            if (escape) {
                current += ch;
                escape = false;
                continue;
            }
            if (ch === '\\' && quote) {
                escape = true;
                continue;
            }
            if (quote) {
                if (ch === quote) {
                    quote = null;
                    continue;
                }
                current += ch;
                continue;
            }
            if (ch === '\'' || ch === '"') {
                quote = ch;
                continue;
            }
            if (ch === ',') {
                args.push(this._coerceActionArg(current.trim()));
                current = '';
                continue;
            }
            current += ch;
        }

        if (quote) throw new Error('Unterminated action argument');
        if (current.trim().length > 0 || rawArgs.trim().endsWith(',')) {
            args.push(this._coerceActionArg(current.trim()));
        }
        return args;
    }

    _coerceActionArg(value) {
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (value === 'null') return null;
        if (value === 'undefined') return undefined;
        if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
        return value;
    }

    _actionAllowlistWhenCapabilitiesMissing(actionId) {
        const key = String(actionId || '').trim();
        return key === 'unlock' ||
            key === 'bootstrapPassphrase' ||
            key === 'recoverPassphrase' ||
            key === 'switchTab' ||
            key === 'switchShell' ||
            key === 'windowControl' ||
            key === 'emergencyClose';
    }

    _optimisticAllowWithoutCapabilities(actionId) {
        const key = String(actionId || '').trim();
        if (!key) return false;
        if (this._actionAllowlistWhenCapabilitiesMissing(key)) return true;
        if (State.get('uiLocked')) return false;
        // If capability sync lags, allow click-through and let backend policy enforce final verdict.
        return key !== 'unlock';
    }

    _normalizeActionBlockReason(reason) {
        const text = String(reason || 'ACTION_DISABLED').trim().toUpperCase();
        if (text === 'AUTH_LOCKED') return 'AUTH_REQUIRED';
        if (text === 'GHOST_MODE_READ_ONLY') return 'DECOY_READ_ONLY';
        if (text === 'WITNESS_QUORUM_ENFORCED') return 'WITNESS_QUORUM_REQUIRED';
        return text || 'ACTION_DISABLED';
    }

    _setActionElementState(el, enabled, reason = '') {
        if (!el || !el.dataset) return;
        const isFormControl = el.matches('button, input, select, textarea');
        const blocked = !enabled;
        const safeReason = this._normalizeActionBlockReason(reason);

        el.dataset.actionState = blocked ? 'blocked' : 'ready';

        if (blocked) {
            el.classList.add('action-disabled');
            el.setAttribute('aria-disabled', 'true');
            el.dataset.actionBlocked = '1';
            el.dataset.actionReason = safeReason;
            if (isFormControl) el.disabled = true;
            if (!Object.prototype.hasOwnProperty.call(el.dataset, 'actionTitleBackup')) {
                el.dataset.actionTitleBackup = el.getAttribute('title') || '';
            }
            el.setAttribute('title', safeReason);
            return;
        }

        el.classList.remove('action-disabled');
        el.removeAttribute('aria-disabled');
        delete el.dataset.actionBlocked;
        delete el.dataset.actionReason;
        if (isFormControl && el.hasAttribute('disabled')) el.disabled = false;
        if (Object.prototype.hasOwnProperty.call(el.dataset, 'actionTitleBackup')) {
            const prior = String(el.dataset.actionTitleBackup || '');
            if (prior) el.setAttribute('title', prior);
            else el.removeAttribute('title');
            delete el.dataset.actionTitleBackup;
        }
    }

    _extractSwitchTabTarget(actionArgs) {
        if (!Array.isArray(actionArgs) || actionArgs.length === 0) return null;
        const raw = String(actionArgs[0] || '').trim();
        if (!raw) return null;
        if (raw === 'forgePane') return 'forge';
        return raw;
    }

    _getActionCapability(actionId) {
        const id = String(actionId || '').trim();
        if (!id || !this._actionCapsById) return null;
        return this._actionCapsById.get(id) || null;
    }

    _setTabState(tabEl, enabled, reason = '') {
        if (!tabEl || !tabEl.dataset) return;
        const safeReason = this._normalizeActionBlockReason(reason || 'PANE_DISABLED');
        tabEl.dataset.tabState = enabled ? 'ready' : 'blocked';
        if (!enabled) {
            tabEl.classList.add('tab-disabled');
            tabEl.setAttribute('aria-disabled', 'true');
            tabEl.dataset.tabReason = safeReason;
            tabEl.setAttribute('title', safeReason);
            return;
        }
        tabEl.classList.remove('tab-disabled');
        tabEl.removeAttribute('aria-disabled');
        delete tabEl.dataset.tabReason;
        if (tabEl.getAttribute('title') === safeReason) tabEl.removeAttribute('title');
    }

    _setPaneState(paneEl, enabled, reason = '') {
        if (!paneEl || !paneEl.dataset) return;
        const safeReason = this._normalizeActionBlockReason(reason || 'PANE_DISABLED');
        paneEl.dataset.paneState = enabled ? 'ready' : 'blocked';

        let overlay = paneEl.querySelector(':scope > .pane-lock-overlay');
        if (!enabled) {
            paneEl.classList.add('pane-disabled');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'pane-lock-overlay';
                paneEl.appendChild(overlay);
            }
            overlay.textContent = `UNAVAILABLE: ${safeReason}`;
            overlay.style.display = 'flex';
            return;
        }

        paneEl.classList.remove('pane-disabled');
        if (overlay) overlay.style.display = 'none';
    }

    _recomputePaneCapabilities() {
        const tabEls = document.querySelectorAll('.tab[data-action^="switchTab"]');
        const nextPaneCaps = new Map();

        tabEls.forEach((tabEl) => {
            const parsedTab = this._parseAction(tabEl.getAttribute('data-action') || '');
            const paneId = parsedTab && parsedTab.fnName === 'switchTab'
                ? this._extractSwitchTabTarget(parsedTab.args)
                : null;
            if (!paneId) return;

            const paneEl = document.getElementById(`${paneId}Pane`);
            if (!paneEl) return;

            const actionEls = paneEl.querySelectorAll('[data-action]');
            let total = 0;
            let enabledCount = 0;
            let backendTotal = 0;
            let backendEnabled = 0;
            let firstReason = '';

            actionEls.forEach((actionEl) => {
                const parsed = this._parseAction(actionEl.getAttribute('data-action') || '');
                const actionId = parsed && parsed.fnName ? parsed.fnName : '';
                if (!actionId || actionId === 'switchTab') return;
                total += 1;

                if (!this._actionCaps || !this._actionCapsById.size) {
                    if (this._optimisticAllowWithoutCapabilities(actionId)) {
                        enabledCount += 1;
                        backendTotal += 1;
                        backendEnabled += 1;
                    } else if (!firstReason) {
                        firstReason = 'ACTION_CAPABILITIES_UNAVAILABLE';
                    }
                    return;
                }

                const cap = this._getActionCapability(actionId);
                if (!cap || cap.registered !== true) {
                    if (!firstReason) firstReason = 'UNREGISTERED_ACTION';
                    return;
                }

                if (!cap.uiOnly) backendTotal += 1;
                if (cap.enabled) {
                    enabledCount += 1;
                    if (!cap.uiOnly) backendEnabled += 1;
                    return;
                }

                if (!firstReason) {
                    firstReason = Array.isArray(cap.reasons) && cap.reasons.length ? cap.reasons[0] : 'ACTION_DISABLED';
                }
            });

            let enabled = true;
            if (total > 0 && enabledCount === 0) enabled = false;
            if (backendTotal > 0 && backendEnabled === 0 && enabledCount === 0) enabled = false;

            const reason = enabled ? '' : (firstReason || 'PANE_ACTIONS_DISABLED');
            nextPaneCaps.set(paneId, {
                paneId,
                enabled,
                reason,
                totals: {
                    actions: total,
                    enabled: enabledCount,
                    backendActions: backendTotal,
                    backendEnabled
                }
            });

            this._setTabState(tabEl, enabled, reason);
            this._setPaneState(paneEl, enabled, reason);
        });

        this._paneCapsById = nextPaneCaps;
        const active = String(State.get('activeTab') || 'dashboard');
        const activePane = this._paneCapsById.get(active);
        if (activePane && activePane.enabled === false) {
            const fallback = this._paneCapsById.get('dashboard') && this._paneCapsById.get('dashboard').enabled
                ? 'dashboard'
                : (Array.from(this._paneCapsById.values()).find((row) => row.enabled) || {}).paneId;
            if (fallback && fallback !== active) {
                this.switchTab(fallback);
            }
        }
    }

    _updateActionCapabilityStatusHUD(stats) {
        const el = document.getElementById('actionCapabilityStatus');
        if (!el) return;
        const total = Number(stats && stats.total || 0);
        const enabled = Number(stats && stats.enabled || 0);
        const disabled = Number(stats && stats.disabled || 0);

        el.textContent = `${enabled}/${total}`;
        el.style.color = disabled > 0 ? 'var(--warn)' : 'var(--ok)';
        el.setAttribute('title', disabled > 0 ? `${disabled} actions blocked` : 'All actions enabled');
    }

    _updatePaneCapabilityStatusHUD() {
        const paneHealthEl = document.getElementById('paneHealthSummary');
        const paneBlockedEl = document.getElementById('paneBlockedCount');
        const paneBackendEl = document.getElementById('paneBackendSummary');
        if (!paneHealthEl && !paneBlockedEl && !paneBackendEl) return;

        const rows = Array.from(this._paneCapsById ? this._paneCapsById.values() : []);
        if (!rows.length) {
            if (paneHealthEl) {
                paneHealthEl.textContent = '--';
                paneHealthEl.style.color = 'var(--dim)';
                paneHealthEl.setAttribute('title', 'Pane capability telemetry unavailable');
            }
            if (paneBlockedEl) {
                paneBlockedEl.textContent = '--';
                paneBlockedEl.style.color = 'var(--dim)';
                paneBlockedEl.setAttribute('title', 'Pane capability telemetry unavailable');
            }
            if (paneBackendEl) {
                paneBackendEl.textContent = '--';
                paneBackendEl.style.color = 'var(--dim)';
                paneBackendEl.setAttribute('title', 'Pane capability telemetry unavailable');
            }
            return;
        }

        const total = rows.length;
        const enabled = rows.reduce((acc, row) => acc + (row && row.enabled ? 1 : 0), 0);
        const blocked = Math.max(0, total - enabled);
        const backendTotal = rows.reduce((acc, row) => acc + Number(row && row.totals ? row.totals.backendActions : 0), 0);
        const backendEnabled = rows.reduce((acc, row) => acc + Number(row && row.totals ? row.totals.backendEnabled : 0), 0);
        const blockedReasons = rows
            .filter((row) => row && row.enabled === false)
            .map((row) => `${row.paneId}:${this._normalizeActionBlockReason(row.reason || 'PANE_ACTIONS_DISABLED')}`)
            .slice(0, 4);
        const blockedReasonText = blockedReasons.length ? blockedReasons.join(' | ') : 'None';

        if (paneHealthEl) {
            paneHealthEl.textContent = `${enabled}/${total}`;
            paneHealthEl.style.color = blocked > 0 ? 'var(--warn)' : 'var(--ok)';
            paneHealthEl.setAttribute('title', `Enabled panes: ${enabled}/${total} | Blocked: ${blocked}`);
        }

        if (paneBlockedEl) {
            paneBlockedEl.textContent = String(blocked);
            paneBlockedEl.style.color = blocked > 0 ? 'var(--warn)' : 'var(--ok)';
            paneBlockedEl.setAttribute('title', `Blocked pane reasons: ${blockedReasonText}`);
        }

        if (paneBackendEl) {
            if (backendTotal > 0) {
                paneBackendEl.textContent = `${backendEnabled}/${backendTotal}`;
                paneBackendEl.style.color = backendEnabled < backendTotal ? 'var(--warn)' : 'var(--ok)';
                paneBackendEl.setAttribute('title', `Backend actions enabled across panes: ${backendEnabled}/${backendTotal}`);
            } else {
                paneBackendEl.textContent = '--';
                paneBackendEl.style.color = 'var(--dim)';
                paneBackendEl.setAttribute('title', 'No backend-bound pane actions detected');
            }
        }
    }

    _canExecuteAction(actionId, targetEl = null, actionArgs = []) {
        const id = String(actionId || '').trim();
        if (!id) return false;

        if (id === 'switchTab') {
            const paneId = this._extractSwitchTabTarget(actionArgs);
            if (paneId && this._paneCapsById && this._paneCapsById.has(paneId)) {
                const pane = this._paneCapsById.get(paneId);
                if (pane && pane.enabled === false) {
                    this._setActionElementState(targetEl, false, pane.reason || 'PANE_ACTIONS_DISABLED');
                    this.recordActionProvenance(id, 'blocked', {
                        reason: this._normalizeActionBlockReason(pane.reason || 'PANE_ACTIONS_DISABLED'),
                        activeTab: String(State.get('activeTab') || ''),
                        source: 'guard'
                    });
                    log(`ACTION_BLOCKED:switchTab:${paneId}:${this._normalizeActionBlockReason(pane.reason || 'PANE_ACTIONS_DISABLED')}`, 'WARN');
                    return false;
                }
            }
        }

        if (!this._actionCaps || !this._actionCapsById.size) {
            if (this._optimisticAllowWithoutCapabilities(id)) {
                this._setActionElementState(targetEl, true);
                this.scheduleActionCapabilitiesRefresh('missing_caps_allow');
                return true;
            }
            this._setActionElementState(targetEl, false, 'ACTION_CAPABILITIES_UNAVAILABLE');
            this.scheduleActionCapabilitiesRefresh('missing_caps');
            this.recordActionProvenance(id, 'blocked', {
                reason: 'ACTION_CAPABILITIES_UNAVAILABLE',
                activeTab: String(State.get('activeTab') || ''),
                source: 'guard'
            });
            log(`ACTION_BLOCKED:${id}:ACTION_CAPABILITIES_UNAVAILABLE`, 'WARN');
            return false;
        }

        const cap = this._getActionCapability(id);
        if (!cap || cap.registered !== true) {
            this._setActionElementState(targetEl, false, 'UNREGISTERED_ACTION');
            this.recordActionProvenance(id, 'blocked', {
                reason: 'UNREGISTERED_ACTION',
                activeTab: String(State.get('activeTab') || ''),
                source: 'guard'
            });
            log(`ACTION_BLOCKED:${id}:UNREGISTERED_ACTION`, 'WARN');
            return false;
        }

        if (!cap.enabled) {
            const reason = Array.isArray(cap.reasons) && cap.reasons.length ? cap.reasons[0] : 'ACTION_DISABLED';
            this._setActionElementState(targetEl, false, reason);
            this.recordActionProvenance(id, 'blocked', {
                reason: this._normalizeActionBlockReason(reason),
                activeTab: String(State.get('activeTab') || ''),
                source: 'guard'
            });
            log(`ACTION_BLOCKED:${id}:${this._normalizeActionBlockReason(reason)}`, 'WARN');
            return false;
        }

        this._setActionElementState(targetEl, true);
        return true;
    }

    applyActionCapabilitiesToDOM() {
        const nodes = document.querySelectorAll('[data-action]');
        if (!nodes || !nodes.length) return;

        const stats = {
            total: 0,
            enabled: 0,
            disabled: 0
        };

        nodes.forEach((node) => {
            const raw = node.getAttribute('data-action');
            const parsed = this._parseAction(raw);
            const actionId = parsed && parsed.fnName ? parsed.fnName : '';
            if (!actionId) {
                this._setActionElementState(node, false, 'INVALID_ACTION_ATTRIBUTE');
                stats.total += 1;
                stats.disabled += 1;
                return;
            }

            if (!this._actionCaps || !this._actionCapsById.size) {
                const allowed = this._optimisticAllowWithoutCapabilities(actionId);
                this._setActionElementState(node, allowed, allowed ? '' : 'ACTION_CAPABILITIES_UNAVAILABLE');
                stats.total += 1;
                if (allowed) stats.enabled += 1;
                else stats.disabled += 1;
                return;
            }

            const cap = this._getActionCapability(actionId);
            if (!cap || cap.registered !== true) {
                this._setActionElementState(node, false, 'UNREGISTERED_ACTION');
                stats.total += 1;
                stats.disabled += 1;
                return;
            }

            if (!cap.enabled) {
                const reason = Array.isArray(cap.reasons) && cap.reasons.length ? cap.reasons[0] : 'ACTION_DISABLED';
                this._setActionElementState(node, false, reason);
                stats.total += 1;
                stats.disabled += 1;
                return;
            }

            this._setActionElementState(node, true);
            stats.total += 1;
            stats.enabled += 1;
        });

        this._recomputePaneCapabilities();
        this._updateActionCapabilityStatusHUD(stats);
        this._updatePaneCapabilityStatusHUD();
    }

    scheduleActionCapabilitiesRefresh(reason = 'scheduled') {
        if (this._actionCapsRefreshTimer) clearTimeout(this._actionCapsRefreshTimer);
        this._actionCapsRefreshTimer = setTimeout(() => {
            this.refreshActionCapabilities(reason).catch(() => { });
        }, 250);
    }

    async refreshActionCapabilities(reason = 'manual', force = false) {
        if (this._actionCapsRefreshInFlight) return;
        const now = Date.now();
        if (!force && this._actionCapsFetchedAt > 0 && (now - this._actionCapsFetchedAt) < 2000) {
            return;
        }

        this._actionCapsRefreshInFlight = true;
        try {
            const caps = await API.getCapabilities();
            const actionTable = caps && caps.actions && typeof caps.actions === 'object' ? caps.actions : {};
            const map = new Map();
            for (const [id, meta] of Object.entries(actionTable)) {
                map.set(id, meta);
            }
            this._actionCaps = caps;
            this._actionCapsById = map;
            this._actionCapsFetchedAt = Date.now();
            this._actionCapsLastError = null;
            this.applyActionCapabilitiesToDOM();
            if (reason !== 'boot' && reason !== 'timer') {
                log(`ACTION_CAPABILITIES_SYNCED:${map.size}`, 'SYS');
            }
        } catch (err) {
            const msg = String(err && err.message ? err.message : err);
            if (this._actionCapsLastError !== msg) {
                this._actionCapsLastError = msg;
                log(`ACTION_CAPABILITIES_FAILED:${msg}`, 'WARN');
            }
            // Keep UI usable during transient capability fetch issues.
            this.applyActionCapabilitiesToDOM();
        } finally {
            this._actionCapsRefreshInFlight = false;
        }
    }

    async enablePersistentMemory() {
        if (this._memoryReady) return;
        this._memoryReady = true;

        const observedKeys = new Set([
            'activeVault',
            'activeTab',
            'selectedCID',
            'forgeRepo',
            'forgeDir',
            'forgePath',
            'forgeSearch',
            'theme',
            'matrixOpacity',
            'shadowMask',
            'neuralHubModule'
        ]);

        State.subscribe((key) => {
            if (!observedKeys.has(key)) return;
            this.scheduleRuntimeMemoryPersist(`state:${key}`);
        });

        this._memoryInterval = setInterval(() => {
            this.scheduleRuntimeMemoryPersist('interval');
        }, 15000);
    }

    getRuntimeMemorySnapshot() {
        const themeSelect = document.getElementById('themeSelect');
        const matrixOpacity = document.getElementById('matrixOpacity');
        const shadowMask = document.getElementById('shadowMaskToggle');
        const forgeRepo = document.getElementById('forgeRepoSelect');
        const forgeSearch = document.getElementById('forgeSearchInput');

        return {
            schemaVersion: 1,
            savedAt: new Date().toISOString(),
            session: {
                activeVault: State.get('activeVault') || '',
                activeTab: State.get('activeTab') || 'dashboard',
                selectedCID: State.get('selectedCID') || ''
            },
            ui: {
                theme: (themeSelect && themeSelect.value) || State.get('theme') || 'BloodNeon',
                matrixOpacity: Number((matrixOpacity && matrixOpacity.value) || State.get('matrixOpacity') || 0.15),
                shadowMask: (shadowMask && shadowMask.checked) || !!State.get('shadowMask')
            },
            forge: {
                repo: (forgeRepo && forgeRepo.value) || State.get('forgeRepo') || '',
                dir: State.get('forgeDir') || '/',
                path: State.get('forgePath') || '',
                query: (forgeSearch && forgeSearch.value) || State.get('forgeSearch') || ''
            },
            neuralHub: {
                module: State.get('neuralHubModule') || 'dev_os'
            }
        };
    }

    _memoryChecksum(value) {
        const text = typeof value === 'string' ? value : JSON.stringify(value);
        let hash = 2166136261;
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }

    _buildRuntimeMemoryEnvelope(snapshot, reason = 'auto') {
        const payload = JSON.stringify(snapshot || {});
        return {
            schemaVersion: 2,
            savedAt: new Date().toISOString(),
            reason: String(reason || 'auto'),
            checksum: this._memoryChecksum(payload),
            snapshot
        };
    }

    _extractRuntimeMemorySnapshot(candidate) {
        if (!candidate || typeof candidate !== 'object') return null;
        if (candidate.schemaVersion === 1 && candidate.session && candidate.ui) return candidate;
        if (candidate.schemaVersion !== 2 || !candidate.snapshot) return null;
        try {
            const payload = JSON.stringify(candidate.snapshot || {});
            const expected = String(candidate.checksum || '');
            const actual = this._memoryChecksum(payload);
            if (expected && expected !== actual) return null;
            const snap = candidate.snapshot;
            if (!snap || snap.schemaVersion !== 1) return null;
            return snap;
        } catch {
            return null;
        }
    }

    _readRuntimeMemoryJournalLocal() {
        try {
            const raw = localStorage.getItem('forge_runtime_memory_journal_v2');
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    persistRuntimeMemoryLocal(reason = 'local') {
        try {
            const snapshot = this.getRuntimeMemorySnapshot();
            localStorage.setItem('forge_runtime_memory_v1', JSON.stringify(snapshot));
            const envelope = this._buildRuntimeMemoryEnvelope(snapshot, reason);
            localStorage.setItem('forge_runtime_memory_v2', JSON.stringify(envelope));

            const journal = this._readRuntimeMemoryJournalLocal();
            journal.push(envelope);
            while (journal.length > 8) journal.shift();
            localStorage.setItem('forge_runtime_memory_journal_v2', JSON.stringify(journal));
            return snapshot;
        } catch {
            return null;
        }
    }

    scheduleRuntimeMemoryPersist(reason = 'auto') {
        if (!this._memoryReady || this._memoryHydrating || State.get('uiLocked')) return;
        this.persistRuntimeMemoryLocal(reason);
        if (this._memoryPersistTimer) clearTimeout(this._memoryPersistTimer);
        this._memoryPersistTimer = setTimeout(() => {
            this.persistRuntimeMemory(reason).catch(() => { });
        }, 650);
    }

    async persistRuntimeMemory(reason = 'manual') {
        if (!this._memoryReady || this._memoryHydrating) return;
        if (this._memoryPersistInFlight) {
            this._memoryPersistQueued = true;
            return;
        }
        this._memoryPersistInFlight = true;
        const snapshot = this.persistRuntimeMemoryLocal(reason);
        try {
            if (snapshot && this._cryptoReady) {
                const envelope = this._buildRuntimeMemoryEnvelope(snapshot, reason);
                await CryptoDB.set('RUNTIME_MEMORY_V1', snapshot);
                await CryptoDB.set('RUNTIME_MEMORY_V2', envelope);
            }
        } catch (e) {
            this._cryptoReady = false;
            log(`Runtime memory secure-save fallback: ${e.message}`, 'WARN');
        } finally {
            this._memoryPersistInFlight = false;
            if (this._memoryPersistQueued) {
                this._memoryPersistQueued = false;
                this.persistRuntimeMemory(`queued:${reason}`).catch(() => { });
            }
        }
    }

    async restoreRuntimeMemory() {
        if (!this._memoryReady) return false;
        let source = 'none';
        let snapshot = null;

        if (this._cryptoReady) {
            try {
                const secureV2 = await CryptoDB.get('RUNTIME_MEMORY_V2');
                snapshot = this._extractRuntimeMemorySnapshot(secureV2);
                if (snapshot) source = 'secure:v2';
            } catch {
                snapshot = null;
            }
            if (!snapshot) {
                try {
                    const secureV1 = await CryptoDB.get('RUNTIME_MEMORY_V1');
                    snapshot = this._extractRuntimeMemorySnapshot(secureV1);
                    if (snapshot) source = 'secure:v1';
                } catch {
                    snapshot = null;
                }
            }
        }

        if (!snapshot) {
            try {
                const rawV2 = localStorage.getItem('forge_runtime_memory_v2');
                const parsedV2 = rawV2 ? JSON.parse(rawV2) : null;
                snapshot = this._extractRuntimeMemorySnapshot(parsedV2);
                if (snapshot) source = 'local:v2';
            } catch {
                snapshot = null;
            }
        }

        if (!snapshot) {
            try {
                const journal = this._readRuntimeMemoryJournalLocal().slice().reverse();
                for (const entry of journal) {
                    const candidate = this._extractRuntimeMemorySnapshot(entry);
                    if (candidate) {
                        snapshot = candidate;
                        source = 'local:journal';
                        break;
                    }
                }
            } catch {
                snapshot = null;
            }
        }

        if (!snapshot) {
            try {
                const raw = localStorage.getItem('forge_runtime_memory_v1');
                const parsed = raw ? JSON.parse(raw) : null;
                snapshot = this._extractRuntimeMemorySnapshot(parsed);
                if (snapshot) source = 'local:v1';
            } catch {
                snapshot = null;
            }
        }
        if (!snapshot || snapshot.schemaVersion !== 1) return false;

        this._memoryHydrating = true;
        try {
            const ui = snapshot.ui || {};
            const session = snapshot.session || {};
            const forge = snapshot.forge || {};
            const neuralHub = snapshot.neuralHub || {};

            if (ui.theme) {
                this.applyTheme(ui.theme);
                const ts = document.getElementById('themeSelect');
                if (ts) ts.value = ui.theme;
            }
            if (ui.matrixOpacity !== undefined) {
                const opacity = Number(ui.matrixOpacity);
                const mo = document.getElementById('matrixOpacity');
                if (mo && Number.isFinite(opacity)) mo.value = String(opacity);
                const particles = document.getElementById('particles');
                if (particles && Number.isFinite(opacity)) particles.style.opacity = String(opacity);
                if (Number.isFinite(opacity)) State.set('matrixOpacity', opacity);
            }
            if (ui.shadowMask !== undefined) {
                const sm = document.getElementById('shadowMaskToggle');
                if (sm) sm.checked = !!ui.shadowMask;
                this.toggleShadowMask(!!ui.shadowMask);
            }

            if (session.activeVault) {
                await this.mountVault(session.activeVault);
            }
            if (session.selectedCID) State.set('selectedCID', session.selectedCID);
            if (session.activeTab) this.switchTab(session.activeTab);

            if (forge.repo) {
                State.set('forgeRepo', forge.repo);
                State.set('forgeDir', forge.dir || '/');
                State.set('forgePath', forge.path || '');
                State.set('forgeSearch', forge.query || '');
                const repoSel = document.getElementById('forgeRepoSelect');
                if (repoSel) repoSel.value = forge.repo;
                this.forge.loadTree(forge.repo, forge.dir || '/');
                if (forge.query) {
                    const searchInput = document.getElementById('forgeSearchInput');
                    if (searchInput) searchInput.value = forge.query;
                }
                if (forge.path) {
                    setTimeout(() => this.forge.loadFile(forge.repo, forge.path), 450);
                }
            }

            if (neuralHub.module) {
                State.set('neuralHubModule', neuralHub.module);
                if ((session.activeTab || '').toLowerCase() === 'neuralhub') {
                    this.openNeuralDashboard(neuralHub.module);
                }
            }

            log(`Runtime memory restored (${snapshot.savedAt || 'unknown time'}) via ${source}.`, 'OK');
            return true;
        } catch (e) {
            log(`Runtime memory restore failed: ${e.message}`, 'WARN');
            return false;
        } finally {
            this._memoryHydrating = false;
        }
    }

    // --- AUTHENTICATION ---
    _setRuntimeHeaderState(ready) {
        const statusEl = document.getElementById('statusText');
        if (!statusEl) return;
        if (ready === true || String(ready).toLowerCase() === 'ready') {
            statusEl.textContent = 'ONLINE';
            statusEl.style.color = 'var(--ok)';
            return;
        }
        if (String(ready).toLowerCase() === 'degraded') {
            statusEl.textContent = 'DEGRADED';
            statusEl.style.color = 'var(--warn)';
            return;
        }
        statusEl.textContent = 'BOOTING';
        statusEl.style.color = 'var(--warn)';
    }

    _setUnlockInteractivity(enabled) {
        const passEl = document.getElementById('passphrase');
        const lockBtn = document.querySelector('#lockdown [data-action="unlock"]');
        const recoverBtn = document.querySelector('#lockdown [data-action="recoverPassphrase"]');
        const isLocked = !!State.get('uiLocked');
        const allow = !!enabled && isLocked && !this._unlockInFlight && !this._recoverPassphraseInFlight;
        if (passEl) passEl.disabled = !allow;
        if (lockBtn) lockBtn.disabled = !allow;
        if (recoverBtn) recoverBtn.disabled = !allow;
    }

    _setBootstrapPanelVisible(visible) {
        const panel = document.getElementById('passphraseBootstrapPanel');
        if (!panel) return;
        panel.style.display = visible ? 'block' : 'none';
    }

    _updateLockDiagnosticsDom({ runtime = null, handshake = null, error = null } = {}) {
        const runtimeEl = document.getElementById('lockDiagRuntime');
        const handshakeEl = document.getElementById('lockDiagHandshake');
        const errorEl = document.getElementById('lockDiagError');
        if (runtimeEl && runtime != null) runtimeEl.textContent = String(runtime).toUpperCase();
        if (handshakeEl && handshake != null) handshakeEl.textContent = String(handshake).toUpperCase();
        if (errorEl && error != null) errorEl.textContent = String(error).slice(0, 80);
    }

    handleApiWatchdog(sample) {
        if (!sample || sample.ok) return;
        const now = Date.now();
        this._apiWatchdogFailures.push({
            ts: String(sample.ts || new Date(now).toISOString()),
            tsMs: now,
            endpoint: String(sample.endpoint || ''),
            method: String(sample.method || 'GET').toUpperCase(),
            status: Number(sample.status || 0),
            error: String(sample.error || '').slice(0, 120),
            durationMs: Number(sample.durationMs || 0)
        });
        if (this._apiWatchdogFailures.length > this._apiWatchdogMax) {
            this._apiWatchdogFailures.splice(0, this._apiWatchdogFailures.length - this._apiWatchdogMax);
        }
        this.renderApiWatchdogPanel();

        if (now - this._apiWatchdogLastEmitAt < 800) {
            this._apiWatchdogDropCount += 1;
            return;
        }
        this._apiWatchdogLastEmitAt = now;
        const dropped = this._apiWatchdogDropCount;
        this._apiWatchdogDropCount = 0;

        const statusCode = Number(sample.status || 0);
        const statusText = statusCode > 0 ? `HTTP_${statusCode}` : 'NETWORK';
        const endpoint = String(sample.endpoint || '');
        const method = String(sample.method || 'GET').toUpperCase();
        const reason = String(sample.error || '').slice(0, 96);
        const burst = dropped > 0 ? ` (+${dropped} suppressed)` : '';
        log(`API_WATCHDOG_FAIL: ${method} ${endpoint} -> ${statusText}${reason ? ` (${reason})` : ''}${burst}`, 'WARN');

        if (!State.get('uiLocked') && this._runtimeReady) {
            this._setRuntimeHeaderState('degraded');
            setTimeout(() => {
                if (!State.get('uiLocked') && this._runtimeReady) this._setRuntimeHeaderState(true);
            }, 1600);
        }
    }

    syncApiWatchdogFromBuffer() {
        if (!API || typeof API.getWatchdogTrace !== 'function') return;
        const trace = API.getWatchdogTrace(this._apiWatchdogMax);
        const failures = Array.isArray(trace)
            ? trace.filter((row) => row && row.ok === false).map((row) => ({
                ts: String(row.ts || new Date().toISOString()),
                tsMs: Date.parse(String(row.ts || '')) || Date.now(),
                endpoint: String(row.endpoint || ''),
                method: String(row.method || 'GET').toUpperCase(),
                status: Number(row.status || 0),
                error: String(row.error || '').slice(0, 120),
                durationMs: Number(row.durationMs || 0)
            }))
            : [];
        this._apiWatchdogFailures = failures.slice(-this._apiWatchdogMax);
        this.renderApiWatchdogPanel();
    }

    renderApiWatchdogPanel() {
        const feedEl = document.getElementById('apiWatchdogFeed');
        const countEl = document.getElementById('apiWatchdogFailureCount');
        if (!feedEl || !countEl) return;

        const now = Date.now();
        const retainMs = Math.max(this._apiWatchdogWindowMs * 5, 300000);
        this._apiWatchdogFailures = this._apiWatchdogFailures
            .filter((row) => row && Number(row.tsMs || 0) > 0 && (now - Number(row.tsMs || 0)) <= retainMs)
            .slice(-this._apiWatchdogMax);

        const recent = this._apiWatchdogFailures.filter((row) => (now - Number(row.tsMs || 0)) <= this._apiWatchdogWindowMs);
        countEl.textContent = String(recent.length);

        const rows = this._apiWatchdogFailures.slice(-10).reverse();
        if (!rows.length) {
            feedEl.innerHTML = '<div class="entry"><span class="ts">[OK]</span> <span class="kind">No API failures observed.</span></div>';
            return;
        }

        feedEl.innerHTML = rows.map((row) => {
            const statusCode = Number(row.status || 0);
            const sev = statusCode >= 500 || statusCode === 0 ? 'ERR' : 'WARN';
            const sevClass = sev === 'ERR' ? 'err' : 'warn';
            const stamp = String(row.ts || '').replace('T', ' ').replace('Z', '').slice(11, 19) || '--:--:--';
            const endpoint = String(row.endpoint || '').slice(0, 56);
            const statusText = statusCode > 0 ? `HTTP_${statusCode}` : 'NETWORK';
            const reason = row.error ? ` • ${String(row.error).slice(0, 60)}` : '';
            const latency = Number.isFinite(Number(row.durationMs)) ? `${Math.max(0, Number(row.durationMs)).toFixed(0)}ms` : '--';
            return `<div class="entry"><span class="ts">[${stamp}]</span><span class="sev ${sevClass}">${sev}</span><span class="kind">${row.method} ${endpoint} -> ${statusText} (${latency})${reason}</span></div>`;
        }).join('');
    }

    async probeRuntimeHealth() {
        try {
            const res = await API.request('/api/system/healthz', 'GET', null, { timeoutMs: 1200, retries: 0 });
            if (!res || res.status !== 200) {
                return {
                    ok: false,
                    reason: `status_${res ? res.status : 'none'}`,
                    status: 'UNAVAILABLE',
                    bootstrapRequired: false,
                    handshake: 'UNREACHABLE'
                };
            }
            const payload = await res.json();
            const healthy = !payload || payload.ok !== false;
            const bootstrapRequired = !!(payload && payload.auth && payload.auth.bootstrapRequired);
            let handshake = 'UNREACHABLE';
            let handshakeReady = false;
            try {
                const hs = await API.request('/api/handshake', 'GET', null, { timeoutMs: 1200, retries: 0 });
                if (hs.status === 401) {
                    handshake = 'CHALLENGE';
                    handshakeReady = true;
                } else if (hs.status === 200) {
                    handshake = 'READY';
                    handshakeReady = true;
                } else {
                    handshake = `HTTP_${hs.status}`;
                }
            } catch {
                handshake = 'UNREACHABLE';
            }
            const ok = healthy && handshakeReady;
            return {
                ok,
                reason: ok
                    ? String(payload.status || 'healthy').toUpperCase()
                    : (healthy ? `HANDSHAKE_${handshake}` : 'UNHEALTHY'),
                status: String(payload && payload.status ? payload.status : (healthy ? 'healthy' : 'unhealthy')).toUpperCase(),
                bootstrapRequired,
                handshake
            };
        } catch (err) {
            return {
                ok: false,
                reason: String(err && err.message ? err.message : err).slice(0, 96),
                status: 'UNREACHABLE',
                bootstrapRequired: false,
                handshake: 'UNREACHABLE'
            };
        }
    }

    startLockDiagnosticsLoop() {
        if (this._lockDiagTimer) return;
        const tick = async () => {
            try {
                if (!State.get('uiLocked')) {
                    this._lockDiagTimer = setTimeout(tick, 2500);
                    return;
                }
                const health = await this.probeRuntimeHealth();
                if (!health.ok) this._lockDiagLastError = String(health.reason || 'health_probe_failed');
                const handshakeStatus = String(health && health.handshake ? health.handshake : 'UNKNOWN');
                if (!health.ok && handshakeStatus === 'UNREACHABLE') this._lockDiagLastError = 'handshake_unreachable';
                this._updateLockDiagnosticsDom({
                    runtime: health.status || 'UNKNOWN',
                    handshake: handshakeStatus,
                    error: this._lockDiagLastError || 'NONE'
                });
            } finally {
                this._lockDiagTimer = setTimeout(tick, 2500);
            }
        };
        tick();
    }

    startRuntimeReadinessProbe() {
        if (this._runtimeReady) return;
        const tick = async () => {
            if (this._runtimeReadyProbeInFlight) return;
            this._runtimeReadyProbeInFlight = true;
            try {
                const health = await this.probeRuntimeHealth();
                this._runtimeBootstrapRequired = !!health.bootstrapRequired;
                this._setBootstrapPanelVisible(this._runtimeBootstrapRequired && State.get('uiLocked'));
                if (health.ok) {
                    this._runtimeReady = true;
                    this._runtimeReadyFailures = 0;
                    this._setRuntimeHeaderState(true);
                    if (State.get('uiLocked')) {
                        if (this._runtimeBootstrapRequired) {
                            this.setLockdownStatus('FIRST-RUN: ENTER PASSPHRASE TO INITIALIZE OR USE SETUP PANEL.', 'warn');
                            this._setUnlockInteractivity(true);
                        } else {
                            this.setLockdownStatus('RUNTIME READY. ENTER PASSPHRASE.', 'dim');
                            this._setUnlockInteractivity(true);
                        }
                    }
                    if (this._runtimeReadyProbeTimer) {
                        clearTimeout(this._runtimeReadyProbeTimer);
                        this._runtimeReadyProbeTimer = null;
                    }
                    return;
                }

                this._runtimeReady = false;
                this._runtimeReadyFailures += 1;
                this._setRuntimeHeaderState(false);
                if (State.get('uiLocked')) {
                    const reason = String(health && health.reason ? health.reason : 'BOOTING').slice(0, 42);
                    this.setLockdownStatus(`RUNTIME BOOTING... (${this._runtimeReadyFailures}) ${reason}`, 'warn');
                    this._setUnlockInteractivity(false);
                }
                if (this._runtimeReadyFailures === 1 || this._runtimeReadyFailures % 5 === 0) {
                    log(`RUNTIME_NOT_READY:${health.reason}`, 'WARN');
                }
                this._runtimeReadyProbeTimer = setTimeout(tick, 1200);
            } finally {
                this._runtimeReadyProbeInFlight = false;
            }
        };
        tick();
    }

    async bootstrapPassphrase() {
        if (this._bootstrapPassphraseInFlight) return;
        const passEl = document.getElementById('bootstrapPassphrase');
        const confirmEl = document.getElementById('bootstrapPassphraseConfirm');
        if (!passEl || !confirmEl) return;

        const passphrase = String(passEl.value || '').replace(/\r?\n/g, '').trim();
        const confirm = String(confirmEl.value || '').replace(/\r?\n/g, '').trim();
        if (!passphrase) {
            this.setLockdownStatus('MASTER PASSPHRASE REQUIRED.', 'warn');
            return;
        }
        if (passphrase.length < 12) {
            this.setLockdownStatus('MASTER PASSPHRASE MUST BE 12+ CHARS.', 'warn');
            return;
        }
        if (confirm && confirm !== passphrase) {
            this.setLockdownStatus('PASSPHRASE CONFIRMATION MISMATCH.', 'err');
            return;
        }

        this._bootstrapPassphraseInFlight = true;
        passEl.disabled = true;
        confirmEl.disabled = true;
        try {
            this.setLockdownStatus('INITIALIZING MASTER KEY...', 'dim');
            const res = await API.bootstrapPassphrase(passphrase, confirm);
            if (!res || res.success !== true) {
                const code = String(res && (res.error || res.code) ? (res.error || res.code) : 'BOOTSTRAP_FAILED');
                this._lockDiagLastError = `bootstrap:${code}`;
                this.setLockdownStatus(`BOOTSTRAP FAILED: ${code}`, 'err');
                return;
            }
            this._runtimeBootstrapRequired = false;
            this._setBootstrapPanelVisible(false);
            this.setLockdownStatus('MASTER PASSPHRASE INITIALIZED. ENTER PASSPHRASE TO UNLOCK.', 'ok');
            this._lockDiagLastError = 'NONE';
            passEl.value = '';
            confirmEl.value = '';
            this._setUnlockInteractivity(true);
            this.startRuntimeReadinessProbe();
        } catch (err) {
            const msg = String(err && err.message ? err.message : err);
            this._lockDiagLastError = `bootstrap:${msg}`;
            this.setLockdownStatus('BOOTSTRAP API UNAVAILABLE.', 'err');
        } finally {
            this._bootstrapPassphraseInFlight = false;
            passEl.disabled = false;
            confirmEl.disabled = false;
        }
    }

    async recoverPassphrase() {
        if (this._recoverPassphraseInFlight) return;
        if (!State.get('uiLocked')) {
            log('PASS_RECOVERY_AVAILABLE_ONLY_WHEN_LOCKED', 'WARN');
            return;
        }

        const acknowledged = await this.requestConfirmation(
            'Reset master passphrase and revoke all sessions?',
            {
                title: 'RECOVERY_RESET_CONFIRM',
                confirmLabel: 'RESET',
                cancelLabel: 'CANCEL'
            }
        );
        if (!acknowledged) return;

        const newPassphrase = await this.requestTextInput(
            'ENTER_NEW_MASTER_PASSPHRASE (12+ chars):',
            {
                title: 'RECOVERY_NEW_KEY',
                placeholder: 'NEW_MASTER_PASSPHRASE',
                native: true
            }
        );
        if (!newPassphrase) return;
        if (newPassphrase.length < 12) {
            this.setLockdownStatus('RECOVERY FAILED: PASSPHRASE TOO SHORT.', 'err');
            return;
        }

        const confirm = await this.requestTextInput(
            'CONFIRM_NEW_MASTER_PASSPHRASE:',
            {
                title: 'RECOVERY_CONFIRM_KEY',
                placeholder: 'CONFIRM_MASTER_PASSPHRASE',
                native: true
            }
        );
        if (!confirm) return;
        if (confirm !== newPassphrase) {
            this.setLockdownStatus('RECOVERY FAILED: CONFIRMATION MISMATCH.', 'err');
            return;
        }

        const phrase = await this.requestTextInput(
            'TYPE EXACTLY: RESET MASTER PASSPHRASE',
            {
                title: 'RECOVERY_CONFIRM_PHRASE',
                placeholder: 'RESET MASTER PASSPHRASE',
                native: true
            }
        );
        if (phrase !== 'RESET MASTER PASSPHRASE') {
            this.setLockdownStatus('RECOVERY FAILED: CONFIRM PHRASE INVALID.', 'err');
            return;
        }

        this._recoverPassphraseInFlight = true;
        this._setUnlockInteractivity(false);
        try {
            this.setLockdownStatus('APPLYING RECOVERY RESET...', 'warn');
            const data = await API.recoverPassphrase(newPassphrase, confirm, phrase);
            if (!data || !data.success) {
                const code = String(data && data.error ? data.error : 'RECOVERY_FAILED');
                this._lockDiagLastError = `recover:${code}`;
                this.setLockdownStatus(`RECOVERY FAILED: ${code}`, 'err');
                return;
            }

            this._runtimeBootstrapRequired = false;
            this._setBootstrapPanelVisible(false);
            const passEl = document.getElementById('passphrase');
            if (passEl) passEl.value = '';
            this._lockDiagLastError = 'NONE';
            this.setLockdownStatus('RECOVERY COMPLETE. ENTER NEW PASSPHRASE TO UNLOCK.', 'ok');
            log('MASTER_PASSPHRASE_RECOVERY_COMPLETE', 'OK');
        } catch (err) {
            const msg = String(err && err.message ? err.message : err);
            this._lockDiagLastError = `recover:${msg}`;
            this.setLockdownStatus('RECOVERY API UNAVAILABLE.', 'err');
        } finally {
            this._recoverPassphraseInFlight = false;
            this._setUnlockInteractivity(true);
        }
    }

    setLockdownStatus(message, tone = 'dim') {
        const el = document.getElementById('lockdownStatus');
        if (!el) return;
        const palette = {
            dim: 'var(--dim)',
            ok: 'var(--ok)',
            warn: 'var(--warn)',
            err: '#ff5a6f'
        };
        el.style.color = palette[tone] || palette.dim;
        el.textContent = message;
    }

    async _runBootstrapStep(label, fn, issues, fallback = null) {
        try {
            return await fn();
        } catch (err) {
            const msg = String(err && err.message ? err.message : err);
            issues.push(`${label}:${msg}`);
            log(`BOOTSTRAP_WARN:${label}:${msg}`, 'WARN');
            return fallback;
        }
    }

    async unlock() {
        const passEl = document.getElementById('passphrase');
        if (!passEl) return;
        if (this._unlockInFlight) return;
        if (!this._runtimeReady) {
            this.setLockdownStatus('RUNTIME NOT READY. WAIT FOR BOOTSTRAP.', 'warn');
            this.startRuntimeReadinessProbe();
            this._setUnlockInteractivity(false);
            return;
        }

        const lockBtn = document.querySelector('#lockdown [data-action="unlock"]');
        const passphrase = String(passEl.value || '').replace(/\r?\n/g, '').trim();
        if (!passphrase) {
            this.setLockdownStatus('PASSPHRASE REQUIRED', 'warn');
            return;
        }
        const unlockSecret = passphrase;

        this._unlockInFlight = true;
        passEl.disabled = true;
        if (lockBtn) lockBtn.disabled = true;
        this._cryptoReady = false;

        try {
            this.setLockdownStatus('AUTHENTICATING...', 'dim');
            const data = await API.unlock(passphrase);
            if (data.success) {
                this._lockDiagLastError = 'NONE';
                this._runtimeBootstrapRequired = false;
                this._setBootstrapPanelVisible(false);
                const ghostMode = !!data.ghost;
                this.setLockdownStatus('BOOTSTRAPPING_SECURE_RUNTIME...', 'dim');
                const issues = [];

                State.set('uiLocked', false);
                const lockdown = document.getElementById('lockdown');
                if (lockdown) lockdown.style.display = 'none';
                passEl.value = '';

                if (ghostMode) {
                    log("GHOST_PROTOCOL_ACTIVE: Decoy session unlocked.", "CRITICAL");
                } else {
                    log("Sovereign Handshake Established.", "AUTH");
                }

                await this._runBootstrapStep('crypto_init', async () => {
                    await CryptoDB.init();
                    await CryptoDB.deriveKey(unlockSecret);
                    this._cryptoReady = true;
                    log("Encrypted Sovereign Matrix Initialized.", "SYS");
                }, issues);

                await this._runBootstrapStep('persistent_memory_enable', async () => {
                    await this.enablePersistentMemory();
                }, issues);

                await this._runBootstrapStep('sync_settings', async () => {
                    await this.syncSettings();
                }, issues);

                await this._runBootstrapStep('ak_runtime_status', async () => {
                    await this.refreshAkRuntimeStatus(true);
                }, issues);

                await this._runBootstrapStep('action_capabilities', async () => {
                    await this.refreshActionCapabilities('post_unlock', true);
                }, issues);

                await this._runBootstrapStep('neural_empire_runtime', async () => {
                    await this.refreshNeuralEmpireRuntime(true);
                }, issues);

                await this._runBootstrapStep('load_engines', async () => {
                    await this.loadEngines();
                }, issues);

                await this._runBootstrapStep('start_dashboard', async () => {
                    this.startDashboard();
                }, issues);

                const restored = await this._runBootstrapStep('restore_runtime_memory', async () => {
                    return this.restoreRuntimeMemory();
                }, issues, false);

                if (!restored) {
                    await this._runBootstrapStep('mount_default_vault', async () => {
                        await this.mountVault(ghostMode ? 'user_backups' : 'INTEL_VAULT');
                    }, issues);
                }

                this.scheduleRuntimeMemoryPersist('post_unlock');
                this.applyActionCapabilitiesToDOM();
                if (issues.length > 0) {
                    const base = ghostMode ? 'DECOY SESSION ACTIVE' : 'AUTHENTICATION COMPLETE';
                    this.setLockdownStatus(`${base} • DEGRADED_BOOT(${issues.length})`, 'warn');
                } else if (ghostMode) {
                    this.setLockdownStatus('DECOY SESSION ACTIVE', 'warn');
                } else {
                    this.setLockdownStatus('AUTHENTICATION COMPLETE', 'ok');
                }
            } else {
                if (data && (data.bootstrapRequired || String(data.error || '').toUpperCase() === 'MASTER_PASSPHRASE_NOT_CONFIGURED')) {
                    this._runtimeBootstrapRequired = true;
                    this._setBootstrapPanelVisible(true);
                    this._lockDiagLastError = 'bootstrap_required';
                    this.setLockdownStatus('FIRST-RUN: ENTER PASSPHRASE TO INITIALIZE OR USE SETUP PANEL.', 'warn');
                    this._setUnlockInteractivity(true);
                    return;
                }
                log("Handshake Rejected: Invalid Passphrase", "ERR");
                const attempt = Number(data && data.attempt);
                const remaining = Number(data && data.remainingBeforeGhost);
                let status = 'AUTH FAILED: INVALID PASSPHRASE';
                if (Number.isFinite(attempt) && attempt > 0) status += ` • ATTEMPT ${attempt}`;
                if (Number.isFinite(remaining)) status += ` • GHOST ARM IN ${remaining}`;
                this.setLockdownStatus(status, 'err');
                this._lockDiagLastError = String(data && data.error ? data.error : 'invalid_passphrase');
                // UX: Shake animation on failed auth
                passEl.classList.add('auth-shake');
                setTimeout(() => passEl.classList.remove('auth-shake'), 600);
            }
        } catch (e) {
            log("Authentication service unavailable.", "ERR");
            this.setLockdownStatus('AUTH SERVICE UNAVAILABLE', 'err');
            this._lockDiagLastError = String(e && e.message ? e.message : 'unlock_exception').slice(0, 80);
        } finally {
            this._unlockInFlight = false;
            passEl.disabled = false;
            if (lockBtn) lockBtn.disabled = false;
            if (State.get('uiLocked')) {
                this._setUnlockInteractivity(this._runtimeReady);
            }
        }
    }

    async loadEngines() {
        try {
            const res = await API.request('/api/engines/discover');
            const data = await res.json();
            const list = document.getElementById('engineList');
            if (!list || !data.engines) return;

            if (data.engines.length === 0) {
                list.innerHTML = '<div style="color:var(--dim); font-size:0.75rem; padding-left:15px;">NO_ENGINES_FOUND</div>';
                return;
            }

            let html = '';
            data.engines.forEach(eng => {
                const name = eng.name.toUpperCase();
                const safeEngine = escapeActionArg(eng.name);
                // Engine pulse dots are "pulsing" by default for aesthetic,
                // we will refine health states later if server supports it.
                html += `<div class="nav-item engine" data-engine="${safeEngine}" data-action="launchEngine('${safeEngine}')">
                    <span class="engine-pulse-dot pulsing" id="p-${eng.name}"></span>
                    ${name}
                </div>`;
            });
            list.innerHTML = html;
            this.applyActionCapabilitiesToDOM();
        } catch (e) {
            console.error("Failed to load engines", e);
        }
    }

    triggerLockdown() {
        if (State.get('uiLocked')) return;
        this.persistRuntimeMemoryLocal('lockdown');
        State.set('uiLocked', true);
        const lock = document.getElementById('lockdown');
        if (lock) lock.style.display = 'flex';
        API.logout().catch(() => { /* best-effort logout */ });
        this.setLockdownStatus('SESSION EXPIRED. RE-AUTHENTICATION REQUIRED.', 'warn');
        this._setBootstrapPanelVisible(this._runtimeBootstrapRequired);
        this._setUnlockInteractivity(this._runtimeReady);
        log("SESSION_EXPIRED: Re-Authentication Required.", "WARN");
        this.refreshActionCapabilities('lockdown', true).catch(() => { });
    }

    async safeResetRuntime() {
        if (State.get('uiLocked')) {
            log('SAFE_RESET_BLOCKED: UI is locked.', 'WARN');
            return;
        }
        const confirmed = await this.requestConfirmation(
            'Reset runtime memory and UI state to baseline? This clears cached session layout and forge context.'
        );
        if (!confirmed) return;

        log('SAFE_RESET_RUNTIME: Purging local/secure runtime memory.', 'CRITICAL');
        if (this._memoryPersistTimer) {
            clearTimeout(this._memoryPersistTimer);
            this._memoryPersistTimer = null;
        }
        this._memoryPersistQueued = false;

        try {
            localStorage.removeItem('forge_runtime_memory_v1');
            localStorage.removeItem('forge_runtime_memory_v2');
            localStorage.removeItem('forge_runtime_memory_journal_v2');
            localStorage.removeItem('forge_theme');
        } catch {
            // Ignore local purge issues.
        }

        if (this._cryptoReady) {
            try {
                await CryptoDB.delete('RUNTIME_MEMORY_V1');
                await CryptoDB.delete('RUNTIME_MEMORY_V2');
            } catch (e) {
                log(`SAFE_RESET_SECURE_PURGE_WARN:${e.message || e}`, 'WARN');
            }
        }

        const defaults = {
            theme: 'BloodNeon',
            matrixOpacity: 0.15,
            shadowMask: false
        };

        try {
            await API.saveSettings(defaults);
        } catch (e) {
            log(`SAFE_RESET_SETTINGS_WARN:${e.message || e}`, 'WARN');
        }

        State.set('activeVault', '');
        State.set('activeTab', 'dashboard');
        State.set('selectedCID', '');
        State.set('forgeRepo', '');
        State.set('forgeDir', '/');
        State.set('forgePath', '');
        State.set('forgeSearch', '');
        State.set('neuralHubModule', 'dev_os');
        State.set('theme', defaults.theme);
        State.set('matrixOpacity', defaults.matrixOpacity);
        State.set('shadowMask', defaults.shadowMask);

        this.applyTheme(defaults.theme);
        this.toggleShadowMask(false);

        const matrixOpacity = document.getElementById('matrixOpacity');
        if (matrixOpacity) matrixOpacity.value = String(defaults.matrixOpacity);
        const particles = document.getElementById('particles');
        if (particles) particles.style.opacity = String(defaults.matrixOpacity);
        const shadowMaskToggle = document.getElementById('shadowMaskToggle');
        if (shadowMaskToggle) shadowMaskToggle.checked = false;

        this.switchTab('dashboard');
        await this.mountVault('INTEL_VAULT');
        this.scheduleRuntimeMemoryPersist('safe_reset_runtime');
        log('SAFE_RESET_RUNTIME_COMPLETE: Baseline restored.', 'OK');
    }

    dismissOversoul() {
        const alert = document.getElementById('oversoulAlert');
        if (alert) alert.style.display = 'none';
    }

    hideNeuralPassReveal() {
        const reveal = document.getElementById('npReveal');
        const plain = document.getElementById('npPlaintext');
        if (reveal) reveal.style.display = 'none';
        if (plain) plain.textContent = '';
    }

    forgeSearch() {
        return this.forge.search();
    }

    refreshActiveVault() {
        const activeVault = State.get('activeVault');
        if (!activeVault) {
            log("No active vault mounted.", "WARN");
            return;
        }
        this.mountVault(activeVault);
    }

    // --- TERMINAL ---
    async dispatchTerminalCommand(input) {
        log(`> ${input}`, "USER");

        try {
            // Send entire command to backend instead of splitting locally to prevent injection
            const res = await API.request('/api/system/execute', 'POST', { commandString: input });
            const data = await res.json();

            // [IP_GOLD] OVERSOUL INTERCEPT TRIGGER
            if (data.output && data.output.includes('[CRITICAL_ERR] Command blocked by AI Oversoul Security Kernel')) {
                document.getElementById('oversoulAlert').style.display = 'flex';
                // Extract reason if possible
                const reasonMatch = data.output.match(/Reason: (.*)/);
                if (reasonMatch && document.getElementById('oversoulReason')) {
                    document.getElementById('oversoulReason').textContent = reasonMatch[1];
                }
            }

            // [NEURODROP_V3] RITUAL UI UPDATE (Visual feedback on lockscreen if active)
            if (input.startsWith('setTier 3')) document.getElementById('ritualStep1').classList.add('active');
            if (input.startsWith('scan')) document.getElementById('ritualStep2').classList.add('active');
            if (input.startsWith('ritual init')) document.getElementById('ritualStep3').classList.add('active');
            if (input.startsWith('whoami')) document.getElementById('ritualStep4').classList.add('active');

            if (data.output === '__CLEAR__') {
                if (term) {
                    term.clear();
                    term.writeln("\x1b[32m[READY] Terminal cleared.\x1b[0m");
                }
                term.write("\x1b[36mFORGE_OS>\x1b[0m ");
                return;
            }

            const normalized = data.output.replace(/\\n/g, '\r\n');
            const lines = normalized.split('\r\n');
            lines.forEach(line => { if (line !== '') log(line, "KERN"); });

            term.write("\x1b[36mFORGE_OS>\x1b[0m ");
        } catch (err) {
            log("Execution Failed: " + err.message, "ERR");
            term.write("\x1b[36mFORGE_OS>\x1b[0m ");
        }
    }

    // --- SETTINGS ---
    async syncSettings() {
        try {
            const cfg = await API.getSettings();
            if (cfg.theme) this.applyTheme(cfg.theme);
            if (cfg.matrixOpacity) {
                const p = document.getElementById('particles');
                if (p) p.style.opacity = cfg.matrixOpacity;
                const opacity = Number(cfg.matrixOpacity);
                if (Number.isFinite(opacity)) State.set('matrixOpacity', opacity);
            }
            if (cfg.shadowMask !== undefined) this.toggleShadowMask(cfg.shadowMask);

            const ts = document.getElementById('themeSelect');
            if (ts) ts.value = cfg.theme || 'BloodNeon';

            const mo = document.getElementById('matrixOpacity');
            if (mo) mo.value = cfg.matrixOpacity || 0.15;

            const sm = document.getElementById('shadowMaskToggle');
            if (sm) sm.checked = !!cfg.shadowMask;
            this.scheduleRuntimeMemoryPersist('sync_settings');
        } catch (e) {
            log("Settings sync failed", "ERR");
        }
    }

    async saveSettings() {
        const theme = document.getElementById('themeSelect').value;
        const s = {
            theme: theme,
            matrixOpacity: Number(document.getElementById('matrixOpacity').value),
            shadowMask: document.getElementById('shadowMaskToggle').checked
        };
        try {
            await API.saveSettings(s);
            localStorage.setItem('forge_theme', theme); // Saved purely for FOUC boot prevention
            State.set('matrixOpacity', Number(s.matrixOpacity));
            State.set('shadowMask', !!s.shadowMask);
            this.scheduleRuntimeMemoryPersist('save_settings');
            log("Global Preferences Sealed.", "OK");
        } catch (e) {
            log("Settings save failed.", "ERR");
        }
    }

    applyTheme(t) {
        document.body.setAttribute('data-theme', t);
        State.set('theme', t);
        localStorage.setItem('forge_theme', t);
        log(`Theme: ${t}`);
    }

    toggleShadowMask(active) {
        State.set('shadowMask', !!active);
        const names = active ? ["system_logs", "temp_cache", "old_updates", "utility_dump"] : ["INTEL_VAULT", "RELEASE_VAULT", "CHAT_VAULT", "UTILITY_VAULT"];
        document.querySelectorAll('.repo-nav').forEach((el, i) => {
            const icon = el.textContent.split(' ')[0];
            el.textContent = `${icon} ${active ? ['INTEL', 'RELEASE', 'CHAT', 'UTIL'][i] + '_REPOS' : names[i].replace('_VAULT', '_REPOS')}`;
            el.setAttribute('data-action', `mountVault('${names[i]}')`);
        });
        this.scheduleRuntimeMemoryPersist('shadow_mask');
    }

    // --- TAB SWITCHING ---
    switchTab(id, triggerEl) {
        const normalizedId = id === 'forgePane' ? 'forge' : id;
        const panePolicy = this._paneCapsById && this._paneCapsById.get(normalizedId);
        if (panePolicy && panePolicy.enabled === false) {
            log(`PANE_BLOCKED:${normalizedId}:${this._normalizeActionBlockReason(panePolicy.reason || 'PANE_ACTIONS_DISABLED')}`, 'WARN');
            return;
        }

        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.pane').forEach(v => v.classList.remove('active'));

        if (triggerEl) triggerEl.classList.add('active');
        else {
            const tab = document.querySelector(`.tab[data-action*="${normalizedId}"]`);
            if (tab) tab.classList.add('active');
        }

        const pane = document.getElementById(normalizedId + 'Pane');
        if (pane) pane.classList.add('active');

        State.set('activeTab', normalizedId);
        this.scheduleRuntimeMemoryPersist(`switch_tab:${normalizedId}`);
        this.applyActionCapabilitiesToDOM();

        // Sub-loaders
        if (normalizedId === 'swarm') this.loadSwarm();
        if (normalizedId === 'matrix') this.loadMatrix();
        if (normalizedId === 'peers') this.loadPeers();
        if (normalizedId === 'xxxplorer') this.loadXxxplorer();
        if (normalizedId === 'neuralpass') this.loadNeuralPass();
        if (normalizedId === 'faraday') this.initFaraday();
        if (normalizedId === 'neuralhub') this.loadNeuralHub();
        if (normalizedId === 'zerotrace') this.initZeroTrace();
        if (normalizedId === 'settings') {
            this.refreshAkRuntimeStatus(true).catch(() => { });
            this.runRuntimeDoctor(true).catch(() => { });
        }
        if (normalizedId === 'forge') {
            State.set('activeTab', 'forge');
            this.forge.loadRepos();
        }
    }

    _setAkStatusTone(el, healthy) {
        if (!el) return;
        el.classList.remove('status-ok-text');
        el.classList.remove('status-warn-text');
        if (healthy === true) el.classList.add('status-ok-text');
        if (healthy === false) el.classList.add('status-warn-text');
    }

    _renderAkRuntimeStatus(status) {
        const enabledEl = document.getElementById('akRuntimeEnabled');
        const witnessEl = document.getElementById('akRuntimeWitness');
        const lastRunEl = document.getElementById('akRuntimeLastRun');
        const outputEl = document.getElementById('akRuntimeOutput');
        const releaseEl = document.getElementById('akRuntimeRelease');

        if (!status || typeof status !== 'object') {
            if (enabledEl) {
                enabledEl.textContent = 'UNAVAILABLE';
                this._setAkStatusTone(enabledEl, false);
            }
            if (witnessEl) {
                witnessEl.textContent = '--';
                this._setAkStatusTone(witnessEl, null);
            }
            if (lastRunEl) lastRunEl.textContent = '--';
            if (outputEl) outputEl.textContent = '--';
            if (releaseEl) {
                releaseEl.textContent = '--';
                this._setAkStatusTone(releaseEl, null);
            }
            return;
        }

        const enabled = !!status.enabled;
        const witnessHealthy = !!(status.witness && status.witness.healthy);
        const witnessReasons = status.witness && Array.isArray(status.witness.reasons) ? status.witness.reasons : [];
        const lastRun = status.lastRun && typeof status.lastRun === 'object' ? status.lastRun : null;
        const releaseMatch = !!(status.releaseIntegrity && status.releaseIntegrity.match);

        if (enabledEl) {
            enabledEl.textContent = enabled ? 'READY' : 'CLI_MISSING';
            this._setAkStatusTone(enabledEl, enabled);
        }
        if (witnessEl) {
            witnessEl.textContent = witnessHealthy
                ? 'HEALTHY'
                : (witnessReasons.length ? witnessReasons.join(' | ') : 'DEGRADED');
            this._setAkStatusTone(witnessEl, witnessHealthy);
        }
        if (lastRunEl) {
            if (lastRun && lastRun.at) {
                const ts = new Date(lastRun.at).toLocaleString();
                const mode = String(lastRun.mode || 'scenario').toUpperCase();
                const verdict = lastRun.ok === true ? 'PASS' : 'FAIL';
                lastRunEl.textContent = `${mode} ${verdict} @ ${ts}`;
                this._setAkStatusTone(lastRunEl, lastRun.ok === true);
            } else {
                lastRunEl.textContent = 'NO_RUN';
                this._setAkStatusTone(lastRunEl, null);
            }
        }

        if (outputEl) {
            const proofPath = lastRun && lastRun.proofPath ? String(lastRun.proofPath) : '';
            const reportPath = lastRun && lastRun.reportPath ? String(lastRun.reportPath) : '';
            const pathText = proofPath || reportPath || '';
            outputEl.textContent = pathText
                ? `OUTPUT: ${pathText.length > 88 ? `...${pathText.slice(-88)}` : pathText}`
                : 'OUTPUT: --';
        }

        if (releaseEl) {
            releaseEl.textContent = releaseMatch ? 'VERIFIED' : 'MISMATCH';
            this._setAkStatusTone(releaseEl, releaseMatch);
        }
    }

    _renderRuntimeDoctorStatus(payload) {
        const overallEl = document.getElementById('doctorOverall');
        const issueCountEl = document.getElementById('doctorIssueCount');
        const criticalCountEl = document.getElementById('doctorCriticalCount');
        const lastRunEl = document.getElementById('doctorLastRun');
        const statusEl = document.getElementById('doctorStatus');

        if (!payload || typeof payload !== 'object') {
            if (overallEl) {
                overallEl.textContent = 'UNAVAILABLE';
                this._setAkStatusTone(overallEl, false);
            }
            if (issueCountEl) issueCountEl.textContent = '--';
            if (criticalCountEl) criticalCountEl.textContent = '--';
            if (lastRunEl) lastRunEl.textContent = '--';
            if (statusEl) statusEl.textContent = 'STATUS: DOCTOR_UNAVAILABLE';
            return;
        }

        const overall = String(payload.overall || 'unknown').toUpperCase();
        const summary = payload.summary && typeof payload.summary === 'object' ? payload.summary : {};
        const issueCount = Number(summary.issueCount || 0);
        const criticalCount = Number(summary.criticalCount || 0);
        const generatedAt = payload.generatedAt ? new Date(payload.generatedAt).toLocaleString() : '--';
        const topIssue = Array.isArray(payload.issues) && payload.issues.length
            ? String(payload.issues[0] && payload.issues[0].message || '').slice(0, 96)
            : 'NO_ISSUES_DETECTED';

        if (overallEl) {
            overallEl.textContent = overall;
            this._setAkStatusTone(overallEl, overall === 'HEALTHY');
        }
        if (issueCountEl) {
            issueCountEl.textContent = String(issueCount);
            this._setAkStatusTone(issueCountEl, issueCount === 0);
        }
        if (criticalCountEl) {
            criticalCountEl.textContent = String(criticalCount);
            this._setAkStatusTone(criticalCountEl, criticalCount === 0);
        }
        if (lastRunEl) lastRunEl.textContent = generatedAt;
        if (statusEl) {
            statusEl.textContent = `STATUS: ${topIssue || 'NO_ISSUES_DETECTED'}`;
            this._setAkStatusTone(statusEl, issueCount === 0 && criticalCount === 0);
        }
    }

    async runRuntimeDoctor(silent = false) {
        if (State.get('uiLocked')) return;
        try {
            const payload = await API.getRuntimeDoctor();
            if (!payload || payload.success !== true || !payload.report) {
                throw new Error(payload && payload.error ? payload.error : 'DOCTOR_REPORT_INVALID');
            }
            this._renderRuntimeDoctorStatus(payload.report);
            if (!silent) {
                const summary = payload.report.summary || {};
                log(`RUNTIME_DOCTOR:${String(payload.report.overall || 'unknown').toUpperCase()}:issues=${Number(summary.issueCount || 0)}`, 'SYS');
            }
        } catch (e) {
            this._renderRuntimeDoctorStatus(null);
            if (!silent) log(`RUNTIME_DOCTOR_FAILED:${e.message}`, 'ERR');
        }
    }

    async repairRuntime() {
        if (State.get('uiLocked')) return;
        const confirmed = await this.requestConfirmation(
            'Run Runtime Doctor repair now? This will heal runtime state and refresh integrity caches.',
            {
                title: 'RUNTIME_REPAIR_CONFIRM',
                confirmLabel: 'REPAIR',
                cancelLabel: 'CANCEL'
            }
        );
        if (!confirmed) return;

        log('RUNTIME_DOCTOR_REPAIR: executing safe repair...', 'WARN');
        try {
            const payload = await API.repairRuntime('safe');
            if (!payload || payload.success !== true) {
                throw new Error(payload && payload.error ? payload.error : 'RUNTIME_REPAIR_FAILED');
            }
            if (payload.report) this._renderRuntimeDoctorStatus(payload.report);
            await this.refreshAkRuntimeStatus(true);
            await this.refreshActionCapabilities('runtime_repair', true);
            this.applyActionCapabilitiesToDOM();
            this.scheduleRuntimeMemoryPersist('runtime_repair');
            const repairCount = payload.repair && Array.isArray(payload.repair.repairs)
                ? payload.repair.repairs.length
                : 0;
            log(`RUNTIME_DOCTOR_REPAIR_COMPLETE: steps=${repairCount}`, 'OK');
        } catch (e) {
            log(`RUNTIME_DOCTOR_REPAIR_FAILED:${e.message}`, 'ERR');
            this.runRuntimeDoctor(true).catch(() => { });
        }
    }

    async refreshAkRuntimeStatus(silent = false) {
        if (State.get('uiLocked')) return;
        try {
            const payload = await API.getAkRuntimeStatus();
            if (!payload || payload.success !== true || !payload.status) {
                throw new Error(payload && payload.error ? payload.error : 'AK_STATUS_INVALID');
            }
            this._renderAkRuntimeStatus(payload.status);
            if (!silent) {
                const enabled = payload.status.enabled ? 'READY' : 'CLI_MISSING';
                const witness = payload.status.witness && payload.status.witness.healthy ? 'HEALTHY' : 'DEGRADED';
                log(`AK_RUNTIME_STATUS:${enabled}:${witness}`, 'SYS');
            }
        } catch (e) {
            this._renderAkRuntimeStatus(null);
            if (!silent) log(`AK_RUNTIME_STATUS_FAILED:${e.message}`, 'ERR');
        }
    }

    async runAkScenario() {
        if (State.get('uiLocked')) return;
        log('AK_RUNTIME_SCENARIO: starting deterministic A-K run...', 'SYS');
        try {
            const payload = await API.runAkScenario();
            if (!payload || payload.success !== true) {
                throw new Error(payload && payload.error ? payload.error : 'AK_SCENARIO_FAILED');
            }
            this._renderAkRuntimeStatus(payload.status || null);
            const scenario = payload.result || {};
            if (scenario.ok === true) {
                log(`AK_RUNTIME_SCENARIO: PASS (${scenario.reportPath || 'report ready'})`, 'OK');
            } else {
                log(`AK_RUNTIME_SCENARIO: FAIL (${scenario.reportPath || 'see report'})`, 'WARN');
            }
        } catch (e) {
            log(`AK_RUNTIME_SCENARIO_FAILED:${e.message}`, 'ERR');
            this.refreshAkRuntimeStatus(true).catch(() => { });
        }
    }

    async generateAkProof() {
        if (State.get('uiLocked')) return;
        log('AK_RUNTIME_PROOF: generating proof bundle...', 'SYS');
        try {
            const payload = await API.generateAkProof();
            if (!payload || payload.success !== true) {
                throw new Error(payload && payload.error ? payload.error : 'AK_PROOF_FAILED');
            }
            this._renderAkRuntimeStatus(payload.status || null);
            const result = payload.result || {};
            const proofPath = result.proofPath || '';
            log(`AK_RUNTIME_PROOF_READY:${proofPath || 'proof generated'}`, 'OK');
        } catch (e) {
            log(`AK_RUNTIME_PROOF_FAILED:${e.message}`, 'ERR');
            this.refreshAkRuntimeStatus(true).catch(() => { });
        }
    }

    // --- XXXPLORER ---
    async loadXxxplorer() {
        const v = State.get('activeVault') || 'INTEL_VAULT';
        log(`Navigating Merkle-DAG History: ${v}`, "SYS");
        
        // Initialize 3D renderer if not already done
        if (!this.dagRenderer && window.DAGRenderer) {
            this.dagRenderer = new window.DAGRenderer('dag3DViewer');
        }

        try {
            const data = await API.getXxxHistory(v);
            const list = document.getElementById('xxxHistory');
            if (!list) return;
            list.innerHTML = '';
            
            if (data.history && data.history.length > 0) {
                // Pass data to 3D Renderer
                if (this.dagRenderer) this.dagRenderer.updateGraph(data.history);

                data.history.reverse().forEach(h => {
                    const d = document.createElement('div');
                    d.className = 'cid-entry card';
                    d.style.cssText = 'padding:10px; margin-bottom:10px; cursor:pointer; font-size:0.6rem;';
                    d.innerHTML = `<span style="color:var(--accent)">CID:</span> ${h.cid.substring(0, 32)}...<br><span style="color:var(--dim)">TS: ${new Date(h.timestamp).toLocaleString()}</span>`;
                    d.onclick = () => {
                        State.set('selectedCID', h.cid);
                        document.getElementById('xxxPreview').textContent = `READY_TO_RESURRECT: ${h.cid}`;
                        // Highlight node in 3D
                        if (this.dagRenderer) {
                            this.dagRenderer.nodes.forEach(n => n.selected = false);
                            const tNode = this.dagRenderer.nodes.find(n => n.cid === h.cid);
                            if (tNode) tNode.selected = true;
                        }
                    };
                    list.appendChild(d);
                });
            } else {
                list.innerHTML = '<div style="color:var(--dim)">NO_TEMPORAL_STATES_FOUND</div>';
                if (this.dagRenderer) this.dagRenderer.updateGraph([]);
            }
        } catch (e) { log("XXXplorer failed to query DAG.", "ERR"); }
    }

    async triggerResurrection() {
        const cid = State.get('selectedCID');
        const v = State.get('activeVault');
        if (!cid || !v) return log("Select a CID to resurrect.", "WARN");
        log(`KERNEL_RESURRECTION: Pinned State ${cid.substring(0,8)} Engaged.`, "CRITICAL");
        try {
            const res = await API.resurrectState(v, cid);
            if (res.success) {
                log(`Vault ${v} Resurrected. Golden state restored.`, "OK");
                this.mountVault(v);
            }
        } catch (e) { log("Resurrection sequence failed.", "ERR"); }
    }

    // --- NEURALPASS ---
    async loadNeuralPass() {
        const list = document.getElementById('npList');
        if (!list) return;
        list.innerHTML = '';
        try {
            const res = await API.npList();
            if (!res || res.success !== true || !Array.isArray(res.ids)) {
                list.innerHTML = '<div style="color:var(--dim)">NEURALPASS_INDEX_UNAVAILABLE</div>';
                return;
            }
            if (!res.ids.length) {
                list.innerHTML = '<div style="color:var(--dim)">NO_SEALED_CREDENTIALS</div>';
                return;
            }

            res.ids.forEach((entry) => {
                const id = String(entry && entry.id ? entry.id : '').trim();
                if (!id) return;
                const ts = Number(entry && entry.timestamp ? entry.timestamp : 0);
                const d = document.createElement('div');
                d.className = 'card';
                d.style.cssText = 'padding:10px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:8px;';

                const left = document.createElement('div');
                left.style.cssText = 'display:flex; flex-direction:column; min-width:0;';
                const label = document.createElement('span');
                label.style.fontSize = '0.7rem';
                label.textContent = id;
                const meta = document.createElement('span');
                meta.style.cssText = 'font-size:0.5rem; color:var(--dim);';
                meta.textContent = ts > 0 ? new Date(ts).toLocaleString() : 'UNKNOWN_TS';
                left.appendChild(label);
                left.appendChild(meta);

                const safeId = escapeActionArg(id);
                const controls = document.createElement('div');
                controls.style.cssText = 'display:flex; gap:6px;';

                const accessBtn = document.createElement('button');
                accessBtn.className = 'btn-primary';
                accessBtn.style.fontSize = '0.5rem';
                accessBtn.textContent = 'ACCESS';
                accessBtn.setAttribute('data-action', `npRetrieve('${safeId}')`);

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn-logout';
                deleteBtn.style.cssText = 'font-size:0.5rem; padding:6px 8px;';
                deleteBtn.textContent = 'DELETE';
                deleteBtn.setAttribute('data-action', `npDelete('${safeId}')`);

                controls.appendChild(accessBtn);
                controls.appendChild(deleteBtn);
                d.appendChild(left);
                d.appendChild(controls);
                list.appendChild(d);
            });
            this.applyActionCapabilitiesToDOM();
        } catch (e) {
            list.innerHTML = '<div style="color:var(--warn)">NEURALPASS_LOAD_FAILED</div>';
            log(`NeuralPass index load failed: ${e.message}`, 'WARN');
        }
    }

    async npStore() {
        const idEl = document.getElementById('npId');
        const secretEl = document.getElementById('npSecret');
        const id = idEl ? String(idEl.value || '').trim() : '';
        const secret = secretEl ? String(secretEl.value || '').trim() : '';
        if (!id || !secret) return;
        log(`Sealing Credential to TPM: ${id}`, "SYS");
        try {
            const res = await API.npStore(id, secret);
            if (res.success) {
                log("Hardware Key-Wrap Complete.", "OK");
                if (idEl) idEl.value = '';
                if (secretEl) secretEl.value = '';
                await this.loadNeuralPass();
                return;
            }
            log(`NEURALPASS_STORE_FAILED: ${String(res && res.error ? res.error : 'UNKNOWN')}`, "WARN");
        } catch (e) { log(`NEURALPASS_STORE_FAILED: ${e.message}`, "WARN"); }
    }

    async npRetrieve(id) {
        log(`Retrieving Hardware Key: ${id}`, "AUTH");
        try {
            const res = await API.npRetrieve(id);
            if (res.success) {
                const reveal = document.getElementById('npReveal');
                const plain = document.getElementById('npPlaintext');
                reveal.style.display = 'block';
                plain.textContent = res.secret;
                log("Credential Revealed. Auto-shred in 10s.", "OK");
                setTimeout(() => reveal.style.display = 'none', 10000);
                return;
            }
            log(`NEURALPASS_RETRIEVE_FAILED: ${String(res && res.error ? res.error : 'UNKNOWN')}`, "ERR");
        } catch (e) { log(`NEURALPASS_RETRIEVE_FAILED: ${e.message}`, "ERR"); }
    }

    async npDelete(id) {
        const confirmed = await this.requestConfirmation(`Delete sealed credential ${id}?`);
        if (!confirmed) return;
        try {
            const res = await API.npDelete(id);
            if (res && res.success === true) {
                log(`Credential ${id} deleted.`, "OK");
                await this.loadNeuralPass();
                return;
            }
            log(`NEURALPASS_DELETE_FAILED: ${String(res && res.error ? res.error : 'UNKNOWN')}`, "WARN");
        } catch (e) {
            log(`NEURALPASS_DELETE_FAILED: ${e.message}`, "ERR");
        }
    }

    // --- ZEROTRACE ---
    initZeroTrace() {
        if (this._ztInitialized) return;

        const dropzone = document.getElementById('ztDropzone');
        const purgeBtn = document.getElementById('ztBtnPurge');
        if (!dropzone || !purgeBtn) return;

        this._ztInitialized = true;
        const picker = document.createElement('input');
        picker.type = 'file';
        picker.multiple = true;
        picker.style.display = 'none';
        document.body.appendChild(picker);
        this._ztFilePicker = picker;

        picker.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []);
            this._ingestZeroTraceFiles(files);
            picker.value = '';
        });

        dropzone.addEventListener('click', () => {
            if (this._ztFilePicker) this._ztFilePicker.click();
        });

        const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evt) => {
            dropzone.addEventListener(evt, stop);
        });

        dropzone.addEventListener('dragover', () => {
            dropzone.style.borderColor = 'var(--accent)';
            dropzone.style.background = 'rgba(var(--accent-rgb), 0.08)';
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.style.borderColor = 'rgba(var(--accent-rgb), 0.3)';
            dropzone.style.background = 'rgba(255,255,255,0.03)';
        });
        dropzone.addEventListener('drop', (e) => {
            dropzone.style.borderColor = 'rgba(var(--accent-rgb), 0.3)';
            dropzone.style.background = 'rgba(255,255,255,0.03)';
            const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
            this._ingestZeroTraceFiles(files);
        });

        this._renderZeroTraceFiles();
    }

    _ingestZeroTraceFiles(files) {
        if (!Array.isArray(files) || files.length === 0) return;
        const known = new Set(this._ztTargets.map((t) => t.path));
        let added = 0;

        for (const file of files) {
            const fullPath = file && typeof file.path === 'string' ? file.path : '';
            if (!fullPath) {
                this._ztAppendStatus(`[WARN] Path unavailable for ${file && file.name ? file.name : 'unknown file'}`, 'WARN');
                continue;
            }
            if (known.has(fullPath)) continue;
            known.add(fullPath);
            this._ztTargets.push({
                path: fullPath,
                name: file.name || fullPath.split(/[\\/]/).pop(),
                size: typeof file.size === 'number' ? file.size : 0
            });
            added++;
        }

        if (added > 0) {
            this._ztAppendStatus(`[SYSTEM] ${added} target artifact(s) queued for purge.`, 'SYS');
        }
        this._renderZeroTraceFiles();
    }

    _renderZeroTraceFiles() {
        const listPanel = document.getElementById('ztFileListPanel');
        const dropText = document.getElementById('ztDropText');
        const purgeBtn = document.getElementById('ztBtnPurge');
        if (!listPanel || !dropText || !purgeBtn) return;

        if (this._ztTargets.length === 0) {
            listPanel.style.display = 'none';
            listPanel.innerHTML = '';
            dropText.textContent = 'AWAITING TARGET ARTIFACTS';
            purgeBtn.style.display = 'none';
            return;
        }

        listPanel.style.display = 'block';
        purgeBtn.style.display = 'block';
        dropText.textContent = `${this._ztTargets.length} TARGET(S) QUEUED`;

        listPanel.innerHTML = this._ztTargets.map((t) => {
            const safePath = String(t.path).replace(/[&<>]/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[s]));
            const safeName = String(t.name).replace(/[&<>]/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[s]));
            const kb = (Number(t.size || 0) / 1024).toFixed(1);
            return `<div style="display:flex; justify-content:space-between; gap:10px; margin-bottom:6px;">
                <span style="color:#ddd; font-size:0.8rem;">${safeName}</span>
                <span style="color:#777; font-size:0.7rem;" title="${safePath}">${kb} KB</span>
            </div>`;
        }).join('');
    }

    _ztAppendStatus(message, tone = 'SYS') {
        const panel = document.getElementById('ztStatusPanel');
        if (!panel) return;
        const colors = {
            SYS: '#9aa6b2',
            OK: '#00ff88',
            WARN: '#ffcc00',
            ERR: '#ff6b6b'
        };
        const div = document.createElement('div');
        div.style.marginBottom = '4px';
        div.style.color = colors[tone] || colors.SYS;
        div.textContent = `> ${message}`;
        panel.appendChild(div);
        panel.scrollTop = panel.scrollHeight;
    }

    async zerotracePurge() {
        this.initZeroTrace();
        if (!this._ztTargets.length) {
            this._ztAppendStatus('[WARN] No artifacts queued for purge.', 'WARN');
            return;
        }
        const confirmed = await this.requestConfirmation(
            `PURGE ${this._ztTargets.length} artifact(s)? This is irreversible.`,
            { title: 'ZEROTRACE_CONFIRM', confirmLabel: 'PURGE', cancelLabel: 'CANCEL' }
        );
        if (!confirmed) return;

        const paths = this._ztTargets.map((t) => t.path);
        this._ztAppendStatus(`[SYSTEM] Purge initiated for ${paths.length} artifact(s)...`, 'SYS');
        log(`ZeroTrace purge requested for ${paths.length} artifact(s).`, 'WARN');

        try {
            const res = await API.request('/api/zerotrace/purge', 'POST', { paths });
            const data = await res.json();
            if (data && data.success) {
                this._ztAppendStatus(`[OK] Purge complete. Shredded: ${data.shredded || 0}`, 'OK');
                if (Array.isArray(data.errors) && data.errors.length) {
                    data.errors.forEach((err) => this._ztAppendStatus(`[ERR] ${err}`, 'ERR'));
                }
                this._ztTargets = [];
                this._renderZeroTraceFiles();
                log(`ZeroTrace purge complete. Shredded ${data.shredded || 0}.`, 'OK');
            } else {
                const err = data && data.error ? data.error : 'Purge failed';
                this._ztAppendStatus(`[ERR] ${err}`, 'ERR');
                log(`ZeroTrace purge failed: ${err}`, 'ERR');
            }
        } catch (e) {
            this._ztAppendStatus(`[ERR] ${e.message}`, 'ERR');
            log('ZeroTrace purge request failed.', 'ERR');
        }
    }

    // --- ZEROTRACE FORENSICS ---
    async generateCertificate() {
        this.initZeroTrace();
        log("Compiling ZeroTrace Forensic Ledger...", "SYS");
        try {
            const res = await API.getCertificate();
            if (res.success) {
                log("Sovereignty Certificate Generated & Signed via TPM.", "OK");
                
                // Create downloadable file
                const blob = new Blob([`${res.certificate}\n\nTPM_SIGNATURE:\n${res.signature}`], { type: 'text/plain' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `SOVEREIGNTY_CERT_${new Date().getTime()}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }
        } catch (e) { log("Certificate generation failed.", "ERR"); }
    }

    windowControl(action) {
        let handled = false;
        if (window.electron && window.electron.send) {
            // Still vulnerable but managed via preload ideally
            window.electron.send('window-control', action);
            handled = true;
        } else if (window.api && window.api.windowControl) {
            // V2 Safe Context Isolation pattern
            window.api.windowControl(action);
            handled = true;
        }

        if (handled) return true;

        if (action === 'close') {
            this._engageBrowserCloseFallback();
            return false;
        }

        log(`WINDOW_CONTROL_UNAVAILABLE:${String(action || '').toUpperCase()} (browser mode)`, 'WARN');
        return false;
    }

    dialogNoop() {
        // Intentionally empty for dialog UI buttons.
    }

    _engageBrowserCloseFallback() {
        this.persistRuntimeMemoryLocal();
        if (!State.get('uiLocked')) {
            this.triggerLockdown();
        } else {
            const lock = document.getElementById('lockdown');
            if (lock) lock.style.display = 'flex';
        }
        this.setLockdownStatus('EMERGENCY LOCKDOWN ACTIVE. CLOSE TAB WITH CTRL+W.', 'warn');

        try {
            window.close();
        } catch {
            // ignore close policy failures
        }

        setTimeout(() => {
            if (document.getElementById('browserCloseFallback')) return;
            const overlay = document.createElement('div');
            overlay.id = 'browserCloseFallback';
            overlay.style.cssText = [
                'position:fixed',
                'inset:0',
                'z-index:99999',
                'background:#05070c',
                'color:#cdd9e5',
                'display:flex',
                'align-items:center',
                'justify-content:center',
                'font-family:JetBrains Mono,monospace',
                'letter-spacing:.06em'
            ].join(';');
            overlay.textContent = 'SESSION LOCKED. CLOSE THIS TAB NOW (CTRL+W).';
            document.body.appendChild(overlay);
        }, 120);
    }

    emergencyClose() {
        if (this._emergencyCloseInFlight) return;
        this._emergencyCloseInFlight = true;
        log("EMERGENCY_CLOSE: Closing window with hard-quit fallback.", "CRITICAL");
        const nativeClose = this.windowControl('close');

        if (!nativeClose) {
            setTimeout(() => {
                this._emergencyCloseInFlight = false;
            }, 1200);
            return;
        }

        setTimeout(() => {
            try {
                if (window.api && typeof window.api.forceQuit === 'function') {
                    window.api.forceQuit();
                    return;
                }
                if (window.electron && window.electron.send) {
                    window.electron.send('app-force-quit');
                }
            } finally {
                this._emergencyCloseInFlight = false;
            }
        }, 1500);
    }

    // --- VAULTS ---
    async mountVault(v, btnEl) {
        State.set('activeVault', v);
        this.scheduleRuntimeMemoryPersist(`mount_vault:${v}`);
        if (btnEl) {
            document.querySelectorAll('.repo-nav').forEach(b => b.classList.remove('active'));
            btnEl.classList.add('active');
        }

        const vn = document.getElementById('currentVaultName');
        if (vn) vn.textContent = v.toUpperCase();

        try {
            // Show skeleton loaders while fetching
            const list = document.getElementById('fileList');
            if (list) {
                list.innerHTML = '';
                for (let i = 0; i < 6; i++) {
                    const skel = document.createElement('div');
                    skel.className = 'skeleton skeleton-card';
                    list.appendChild(skel);
                }
            }

            const files = await API.listVault(v);
            if (!list) return;

            list.innerHTML = '';

            if (files.length === 0) {
                const div = document.createElement('div');
                div.style.cssText = 'grid-column:1/-1; text-align:center; padding:50px; color:var(--dim); letter-spacing:2px; border:1px dashed var(--border);';
                div.textContent = 'VAULT_VACUUM_DETECTED';
                list.appendChild(div);
                this.switchTab('vaults');
                return;
            }

            files.forEach(f => {
                const div = document.createElement('div');
                div.className = 'file-card glass';
                const safeVault = escapeActionArg(v);
                const safeName = escapeActionArg(f.name);

                const metaDiv = document.createElement('div');
                metaDiv.style.cssText = 'flex:1; cursor:pointer;';
                metaDiv.setAttribute('data-action', `loadVaultFile('${safeVault}', '${safeName}')`);

                const title = document.createElement('div');
                title.style.cssText = 'font-size:0.7rem; color:#ccc;';
                title.textContent = `📄 ${f.name}`;

                const size = document.createElement('div');
                size.style.cssText = 'font-size:0.45rem; color:var(--dim); margin-top:2px;';
                size.textContent = `SIZE: ${f.size}`;

                metaDiv.appendChild(title);
                metaDiv.appendChild(size);

                const delBtn = document.createElement('div');
                delBtn.className = 'delete-icon';
                delBtn.style.cssText = 'color:var(--dim); cursor:pointer; font-size:0.7rem; padding:5px;';
                delBtn.textContent = '✕';
                delBtn.setAttribute('data-action', `vaultDeleteFile('${safeVault}', '${safeName}')`);

                div.appendChild(metaDiv);
                div.appendChild(delBtn);
                list.appendChild(div);
            });

            this.switchTab('vaults');
            this.applyActionCapabilitiesToDOM();
        } catch (e) {
            log("Vault sync failed.", "ERR");
        }
    }

    loadVaultFile(v, fName) {
        this.switchTab('forge');
        this.forge.loadFile('vaults', `/${v}/${fName}`);
    }

    // --- FORGE HELPERS ---
    initRepo() {
        this.forge.initRepo();
    }

    loadForgeTree(repo, dir) {
        this.forge.loadTree(repo, dir);
    }

    loadForgeFile(repo, path) {
        this.forge.loadFile(repo, path);
    }

    loadForgeDiff(repo, hash) {
        this.forge.loadDiff(repo, hash);
    }

    async vaultNewFile() {
        const name = await this.requestTextInput('ARTIFACT_ID_REQUIRED (e.g., config.json):', {
            title: 'NEW_ARTIFACT',
            placeholder: 'artifact_name.ext',
            pattern: '^[a-zA-Z0-9_\\-\\.]+$',
            validationMessage: 'INVALID_FILE_SIGNATURE',
            native: true
        });
        if (!name) return;

        if (!/^[a-zA-Z0-9_\-\.]+$/.test(name)) {
            log("Invalid File Signature.", "ERR");
            return;
        }

        log(`Creating Artifact: ${name}`, "SYS");
        try {
            const data = await API.createVaultFile(State.get('activeVault'), name);
            if (data.ok) {
                log("Artifact Manifest Created.", "OK");
                this.mountVault(State.get('activeVault'));
            } else log(`Err: ${data.error}`, "ERR");
        } catch (e) { log("Vault sync failed.", "ERR"); }
    }

    triggerUpload() {
        document.getElementById('vaultUploadInput').click();
    }

    async vaultUploadFile(el) {
        const file = el.files[0];
        if (!file) return;

        // Path Traversal Defense on client side
        if (!/^[a-zA-Z0-9_\-\.]+$/.test(file.name)) {
            log("Invalid File Signature layout.", "ERR");
            return;
        }

        log(`UPLOADING: ${file.name}`, "SYS");
        const reader = new FileReader();
        reader.onload = async (e) => {
            const b64 = e.target.result.split(',')[1];
            try {
                const data = await API.uploadVaultFile(State.get('activeVault'), file.name, b64);
                if (data.ok) {
                    log("Artifact Successfully Harvested.", "OK");
                    this.mountVault(State.get('activeVault'));
                } else log(`Err: ${data.error}`, "ERR");
            } catch (err) { log("Connection lost.", "ERR"); }
        };
        reader.readAsDataURL(file);
    }

    async vaultDeleteFile(v, f) {
        const confirmed = await this.requestConfirmation(`PURGE_ARTIFACT: ${f}?`, {
            title: 'VAULT_PURGE_CONFIRM',
            confirmLabel: 'PURGE',
            cancelLabel: 'CANCEL'
        });
        if (!confirmed) return;
        log(`Purging Artifact: ${f}`, "WARN");
        try {
            const data = await API.deleteVaultFile(v, f);
            if (data.ok) {
                log("Artifact Expunged.", "OK");
                this.mountVault(State.get('activeVault'));
            } else log(`Err: ${data.error}`, "ERR");
        } catch (e) { log("Purge sequence failed.", "ERR"); }
    }


    // --- SWARM ---
    async loadSwarm() {
        try {
            const res = await API.request('/api/swarm/status');
            const data = await res.json();
            State.set('swarmData', data);

            const insList = document.getElementById('insightList');
            if (insList) {
                insList.innerHTML = '';
                if (data.insights.length) {
                    data.insights.forEach(i => {
                        const d = document.createElement('div');
                        d.className = 'card';
                        d.style.cssText = 'margin-bottom:10px; padding:12px;';

                        const t = document.createElement('div');
                        t.style.cssText = 'font-size:0.55rem; color:var(--accent); letter-spacing:1px;';
                        t.textContent = i.type;

                        const r = document.createElement('div');
                        r.style.cssText = 'font-size:0.75rem; margin-top:5px;';
                        r.textContent = i.recommendation;

                        const rs = document.createElement('div');
                        rs.style.cssText = 'font-size:0.55rem; color:#444; margin-top:5px;';
                        rs.textContent = i.reason;

                        d.appendChild(t); d.appendChild(r); d.appendChild(rs);
                        insList.appendChild(d);
                    });
                } else {
                    insList.innerHTML = '<div style="color:#333; font-size:0.7rem;">No active insights. Synthesis nominal.</div>';
                }
            }

            const ghostList = document.getElementById('ghostNodeList');
            if (ghostList) {
                ghostList.innerHTML = '';
                if (data.peers.length) {
                    data.peers.forEach(p => {
                        const d = document.createElement('div');
                        d.className = 'card';
                        d.style.cssText = 'margin-bottom:8px; padding:10px; display:flex; justify-content:space-between; align-items:center;';

                        const left = document.createElement('div');
                        const id = document.createElement('div');
                        id.style.cssText = 'font-size:0.7rem;';
                        id.textContent = p.id.slice(0, 16) + '...';

                        const addr = document.createElement('div');
                        addr.style.cssText = 'font-size:0.55rem; color:#333;';
                        addr.textContent = `${p.address}:${p.port}`;

                        const dot = document.createElement('span');
                        dot.className = 'status-dot';
                        dot.style.background = 'var(--ok)';

                        left.appendChild(id); left.appendChild(addr);
                        d.appendChild(left); d.appendChild(dot);
                        ghostList.appendChild(d);
                    });
                } else {
                    ghostList.innerHTML = '<div style="color:#333; font-size:0.7rem;">No external ghost nodes.</div>';
                }
            }

            const man = document.getElementById('swarmManifest');
            if (man) man.textContent = `NODE_ID: ${data.nodeID}\nPEER_COUNT: ${data.peers.length}\nACTIVE_VOTES: ${data.activeVotes.length}\nBRAIN_DENSITY: ${(data.peers.length / 10).toFixed(2)}`;

            const pc = document.getElementById('peerCount');
            if (pc) pc.textContent = data.peers.length;

            const ic = document.getElementById('insightCount');
            if (ic) ic.textContent = data.insights.length;

            this._updateWitnessHud(data.ghostWitness, null);
        } catch (e) {
            // Silent error suppression on loop, only log occasional
        }
    }

    // --- MATRIX ---
    async loadMatrix() {
        try {
            const tRes = await API.request('/api/system/timeline');
            const timeline = await tRes.json();

            const tl = document.getElementById('timelineList');
            if (tl) {
                tl.innerHTML = '';
                timeline.forEach(i => {
                    const d = document.createElement('div');
                    d.className = 'card';
                    d.style.cssText = 'padding:12px; display:flex; justify-content:space-between; align-items:center;';
                    // ... create securely ...
                    const left = document.createElement('div');
                    const v = document.createElement('span');
                    v.style.cssText = 'color:var(--accent); font-size:0.5rem; letter-spacing:1px;';
                    v.textContent = i.vault;
                    const fl = document.createElement('div');
                    fl.style.cssText = 'font-size:0.8rem; margin-top:3px;';
                    fl.textContent = i.file;
                    left.appendChild(v); left.appendChild(fl);

                    const right = document.createElement('div');
                    right.style.cssText = 'text-align:right; font-size:0.55rem; color:#333;';
                    right.innerHTML = `${new Date(i.mtime).toLocaleString()}<br>${i.size}`;

                    d.appendChild(left); d.appendChild(right);
                    tl.appendChild(d);
                });
            }

            const lRes = await API.request('/api/system/ledger');
            const ledger = await lRes.json();
            const ll = document.getElementById('ledgerList');
            if (ll) {
                ll.innerHTML = '';
                ledger.reverse().forEach(l => {
                    const d = document.createElement('div');
                    d.style.cssText = 'margin-bottom:6px; padding-bottom:4px; border-bottom:1px solid #111;';

                    const ts = document.createElement('span');
                    ts.style.color = 'var(--ok)';
                    ts.textContent = `[${new Date(l.timestamp).toLocaleTimeString()}] `;

                    const evt = document.createElement('span');
                    evt.style.color = 'var(--text)';
                    evt.textContent = l.event + ' ';

                    const det = document.createElement('span');
                    det.style.color = '#333';
                    det.textContent = JSON.stringify(l.details);

                    d.appendChild(ts); d.appendChild(evt); d.appendChild(det);
                    ll.appendChild(d);
                });
            }

            const diagRes = await API.request('/api/system/diagnostics');
            const diagnostics = await diagRes.json();
            const auditEl = document.getElementById('actionAuditList');
            if (auditEl) {
                auditEl.innerHTML = '';
                const tail = diagnostics && diagnostics.actions && Array.isArray(diagnostics.actions.provenanceTail)
                    ? diagnostics.actions.provenanceTail.slice().reverse()
                    : [];
                if (!tail.length) {
                    auditEl.innerHTML = '<div style="color:var(--dim)">NO_ACTION_AUDIT_EVENTS</div>';
                } else {
                    tail.slice(0, 40).forEach((row) => {
                        const line = document.createElement('div');
                        line.style.cssText = 'margin-bottom:6px; padding-bottom:4px; border-bottom:1px solid #111;';
                        const ts = row && row.ts ? new Date(row.ts).toLocaleTimeString() : '--:--:--';
                        const phase = String(row && row.phase ? row.phase : 'dispatch').toUpperCase();
                        const action = String(row && row.actionId ? row.actionId : 'unknown');
                        const reason = row && row.reason ? ` • ${String(row.reason).slice(0, 60)}` : '';
                        line.textContent = `[${ts}] ${action} :: ${phase}${reason}`;
                        auditEl.appendChild(line);
                    });
                }
            }
        } catch (e) { log("Matrix load failed.", "ERR"); }
    }

    // --- PEERS ---
    async loadPeers() {
        try {
            const res = await API.request('/api/peers');
            const peers = await res.json();
            const pl = document.getElementById('peerList');
            if (!pl) return;

            pl.innerHTML = '';
            peers.forEach(p => {
                const d = document.createElement('div');
                d.className = 'card';
                d.style.position = 'relative';
                const safePeerId = escapeActionArg(p.id);

                const dotWrap = document.createElement('div');
                dotWrap.style.cssText = 'position:absolute; top:12px; right:12px;';
                const dot = document.createElement('span');
                dot.className = 'status-dot';
                dot.style.background = p.status === 'ACTIVE' ? 'var(--ok)' : '#300';
                dotWrap.appendChild(dot);

                const h3 = document.createElement('h3');
                h3.style.fontSize = '0.8rem';
                h3.textContent = p.id;

                const host = document.createElement('div');
                host.style.cssText = 'color:var(--dim); font-size:0.6rem; margin-top:5px;';
                host.textContent = `${p.host}:${p.port}`;

                const btn = document.createElement('button');
                btn.className = 'btn-primary';
                btn.style.cssText = 'margin-top:15px; width:100%; font-size:0.55rem;';
                btn.textContent = 'SYNC_VAULTS';
                btn.setAttribute('data-action', `syncPeer('${safePeerId}')`);
                if (p.status !== 'ACTIVE') btn.disabled = true;

                d.appendChild(dotWrap); d.appendChild(h3); d.appendChild(host); d.appendChild(btn);
                pl.appendChild(d);
            });
            this.applyActionCapabilitiesToDOM();
        } catch (e) { log("Peer discovery failed.", "ERR"); }
    }

    // --- DASHBOARD TELEMETRY LOOP ---
    startDashboard() {
        this.switchTab('dashboard');
        log('Type "help" for available commands.', 'SYS');
        this.refreshActionCapabilities('dashboard', true).catch(() => { });

        this.renderer.startRenderLoop();

        API.getHandshake().then(d => {
            if (d.seal) {
                const s = document.getElementById('coreSeal');
                if (s) s.textContent = d.seal;
            }
        }).catch(() => { });

        this.startTimers();
        this.syncApiWatchdogFromBuffer();
        this.refreshReleaseIntegrity();
        this.refreshAkRuntimeStatus(true).catch(() => { });
        this.refreshNeuralEmpireRuntime(true).catch(() => { });
    }

    startTimers() {
        this.initTimers();
    }

    initTimers() {
        if (this._timersStarted) return;
        this._timersStarted = true;

        // === WEBSOCKET TELEMETRY STREAM ===
        // Replaces 4+ setInterval HTTP polls with a single persistent connection.
        this._connectTelemetryStream();

        // Clock (Client-side, no server call needed)
        const pulseMsgs = ["CORE_STABLE", "VAULT_SYNCED", "SWARM_ACTIVE", "LINK_RELIANCE_OK"];
        setInterval(() => {
            if (State.get('uiLocked')) return;
            if (Math.random() > 0.8) {
                const msg = pulseMsgs[Math.floor(Math.random() * pulseMsgs.length)];
                log(msg, "HEARTBEAT");
            }
        }, 30000);

        // Clock (Client-side, no server call needed)
        setInterval(() => {
            const clock = document.getElementById('clockDisplay');
            if (clock) clock.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
        }, 1000);

        setInterval(() => {
            if (State.get('uiLocked')) return;
            this.refreshActionCapabilities('timer').catch(() => { });
        }, 15000);

        this._releaseIntegrityTimer = setInterval(() => {
            if (State.get('uiLocked')) return;
            this.refreshReleaseIntegrity();
        }, 45000);

        setInterval(() => {
            if (State.get('uiLocked')) return;
            this.renderApiWatchdogPanel();
        }, 3000);
    }

    _connectTelemetryStream() {
        const wsUrl = `ws://${location.host}/api/stream`;
        let ws = null;

        const connect = () => {
            if (this._telemetryReconnectTimer) {
                clearTimeout(this._telemetryReconnectTimer);
                this._telemetryReconnectTimer = null;
            }

            ws = new WebSocket(wsUrl);
            this._telemetryWs = ws;

            ws.onopen = () => {
                log('Telemetry stream connected.', 'OK');
            };

            ws.onmessage = (event) => {
                if (State.get('uiLocked')) return;

                try {
                    const frame = JSON.parse(event.data);
                    if (frame.type !== 'TELEMETRY') return;

                    // --- Hardware Metrics ---
                    const cpu = parseFloat(frame.hw.cpu) || 0;
                    const cpuEl = document.getElementById('cpu');
                    if (cpuEl) cpuEl.textContent = cpu.toFixed(1) + '%';

                    const cpuVal = document.getElementById('cpuGaugeVal');
                    if (cpuVal) cpuVal.textContent = cpu.toFixed(1) + '%';

                    const cpuArc = document.getElementById('cpuArc');
                    if (cpuArc) cpuArc.style.strokeDashoffset = 282.7 - (cpu / 100) * 282.7;

                    this.renderer.addActivityData(cpu);

                    if (frame.hw.locked) location.reload();

                    // --- SYSTEM ---
                    const mem = frame.system.memPercent || 0;
                    const memG = document.getElementById('memGaugeVal');
                    if (memG) memG.textContent = mem.toFixed(1) + '%';

                    const memArc = document.getElementById('memArc');
                    if (memArc) memArc.style.strokeDashoffset = 282.7 - (mem / 100) * 282.7;

                    const up = frame.system.uptimeSec || 0;
                    const m = Math.floor(up / 60); const s = up % 60;
                    const upD = document.getElementById('uptimeDisplay');
                    if (upD) upD.textContent = `UPTIME: ${m}m ${s}s`;

                    const ent = frame.system.entropy || "0.00";
                    const eVal = document.getElementById('entropyGaugeVal');
                    if (eVal) eVal.textContent = ent;

                    const eArc = document.getElementById('entropyArc');
                    if (eArc) eArc.style.strokeDashoffset = 282.7 - (parseFloat(ent) / 10) * 282.7;

                    // --- SECURE GATEWAY INTELLIGENCE ---
                    if (frame.system.gateway) {
                        this._updateGatewayUI(frame.system.gateway);
                    }

                    // --- SWARM ---
                    this._updateSwarmFromFrame(frame.swarm);
                    this._updateWitnessHud(frame.swarm ? frame.swarm.ghostWitness : null, frame.system ? frame.system.autoHeal : null);

                    // --- TEAR ---
                    if (frame.tear) {
                        const badge = document.getElementById('tearBadge');
                        if (badge) badge.textContent = `TEAR: ${frame.tear.integrity} (#${frame.tear.chainLength})`;

                        const cl = document.getElementById('tearChainLen');
                        if (cl) cl.textContent = frame.tear.chainLength;
                    }

                    // --- LATENCY ---
                    const latency = Date.now() - frame.ts;
                    const latEl = document.getElementById('latencyDisplay');
                    if (latEl) latEl.textContent = `${latency}ms`;
                } catch (e) { /* malformed frame, ignore */ }
            };

            ws.onclose = () => {
                log('Telemetry stream disconnected. Reconnecting...', 'WARN');
                this._telemetryReconnectTimer = setTimeout(connect, 3000);
            };

            ws.onerror = () => {
                ws.close();
            };
        };

        connect();
    }

    _updateSwarmFromFrame(swarm) {
        if (!swarm) return;
        const pl = document.getElementById('peerList');
        if (!pl) return;

        const peers = swarm.peers || [];
        pl.innerHTML = '';

        if (peers.length === 0) {
            pl.textContent = 'No peers detected.';
            return;
        }

        peers.forEach(p => {
            const d = document.createElement('div');
            d.className = 'glass';
            d.style.cssText = 'padding:18px; border-radius:8px;';

            const dotWrap = document.createElement('div');
            dotWrap.style.cssText = 'display:flex; align-items:center; gap:6px; margin-bottom:8px;';
            const dot = document.createElement('div');
            dot.style.cssText = `width:8px; height:8px; border-radius:50%; background:${p.status === 'ACTIVE' ? 'var(--ok)' : 'var(--dim)'}`;
            const label = document.createElement('span');
            label.style.cssText = 'font-size:0.5rem; color:var(--dim);';
            label.textContent = p.status || 'UNKNOWN';
            dotWrap.appendChild(dot);
            dotWrap.appendChild(label);

            const h3 = document.createElement('h3');
            h3.style.cssText = 'color:#ccc; font-size:0.7rem;';
            h3.textContent = p.id || 'PEER';

            d.appendChild(dotWrap);
            d.appendChild(h3);
            pl.appendChild(d);
        });
    }

    _updateWitnessHud(ghostWitness, autoHeal) {
        const headCountEl = document.getElementById('witnessHeadCount');
        const observerCountEl = document.getElementById('witnessObserverCount');
        const lastHeadEl = document.getElementById('witnessLastHead');
        const healStateEl = document.getElementById('autoHealState');
        const healEventEl = document.getElementById('autoHealLastEvent');

        const heads = ghostWitness && Array.isArray(ghostWitness.heads) ? ghostWitness.heads : [];
        const latest = heads.length ? heads[heads.length - 1] : null;

        if (headCountEl) headCountEl.textContent = String(ghostWitness && typeof ghostWitness.headCount === 'number' ? ghostWitness.headCount : 0);
        if (observerCountEl) observerCountEl.textContent = String(latest && typeof latest.uniqueObservers === 'number' ? latest.uniqueObservers : 0);
        if (lastHeadEl) lastHeadEl.textContent = latest && latest.headCID ? `${latest.headCID.slice(0, 24)}...` : 'NONE';

        if (autoHeal && autoHeal.timestamp) {
            if (healStateEl) {
                healStateEl.textContent = 'HEALED';
                healStateEl.classList.remove('status-warn-text');
                healStateEl.classList.add('status-ok-text');
            }
            if (healEventEl) {
                const ts = new Date(autoHeal.timestamp).toLocaleTimeString();
                healEventEl.textContent = `${autoHeal.vault || 'UNKNOWN'} @ ${ts}`;
            }
        } else {
            if (healStateEl) {
                healStateEl.textContent = 'NOMINAL';
                healStateEl.classList.remove('status-warn-text');
                healStateEl.classList.add('status-ok-text');
            }
            if (healEventEl) healEventEl.textContent = 'NONE';
        }
    }

    async refreshReleaseIntegrity() {
        try {
            const res = await API.request('/api/system/release-integrity');
            if (!res || res.status !== 200) return;
            const data = await res.json();
            const statusEl = document.getElementById('releaseIntegrityState');
            const hashEl = document.getElementById('releaseHashShort');

            if (statusEl) {
                if (data && data.match) {
                    statusEl.textContent = 'VERIFIED';
                    statusEl.classList.add('status-ok-text');
                    statusEl.classList.remove('status-warn-text');
                } else {
                    statusEl.textContent = 'MISMATCH';
                    statusEl.classList.add('status-warn-text');
                    statusEl.classList.remove('status-ok-text');
                }
            }

            if (hashEl) {
                const hash = data && data.expected ? String(data.expected) : '--';
                hashEl.textContent = hash === '--' ? '--' : `${hash.slice(0, 8)}...`;
            }
        } catch (e) {
            // keep dashboard stable
        }
    }

    _updateGatewayUI(gateway) {
        const statusEl = document.getElementById('vipnStatus');
        if (statusEl) {
            statusEl.textContent = `> GATEWAY_STATE: ${gateway.state}`;
            statusEl.style.color = gateway.state === 'CONNECTED' ? '#00e5ff' : (gateway.state === 'ARMED' ? 'var(--ok)' : 'var(--dim)');
        }

        const proxyEl = document.getElementById('proxyMetrics');
        if (proxyEl) {
            proxyEl.style.display = gateway.state === 'CONNECTED' ? 'block' : 'none';
            if (gateway.proxy) {
                const endpointEl = document.getElementById('proxyEndpoint');
                if (endpointEl) endpointEl.textContent = `${gateway.proxy.host}:${gateway.proxy.port}`;
            }
        }

        if (gateway.state === 'CONNECTED') {
            document.body.classList.add('stealth-active');
        } else {
            document.body.classList.remove('stealth-active');
        }
    }

    async gatewayInitialize() {
        try {
            const res = await API.request('/api/vipn/arm', 'POST');
            const data = await res.json();
            if (data.success) log("GATEWAY_CONTROL: Security Kernel Handshake Complete. Filters Engaged.", "OK");
        } catch (e) { log("GATEWAY_INIT_FAILED", "ERR"); }
    }

    async gatewayEngage() {
        try {
            const res = await API.request('/api/vipn/connect', 'POST');
            const data = await res.json();
            if (data.success) log("GATEWAY_CONTROL: Secure Persistent Tunnel Established.", "OK");
            else if (data.error === 'MUST_ARM_FIRST') log("GATEWAY_SECURITY: Access Denied. Initialize filters first.", "WARN");
        } catch (e) { log("GATEWAY_ENGAGE_FAILED", "ERR"); }
    }

    async gatewayBypass() {
        try {
            const res = await API.request('/api/vipn/disconnect', 'POST');
            const data = await res.json();
            if (data.success) log("GATEWAY_CONTROL: Active Tunnel Terminated. Reverting to Standard Routing.", "SYS");
        } catch (e) { log("GATEWAY_BYPASS_FAILED", "ERR"); }
    }

    async gatewayFlush() {
        try {
            const res = await API.request('/api/vipn/restore', 'POST');
            const data = await res.json();
            if (data.success) log("GATEWAY_CONTROL: Network Stack Restored. All active filters purged.", "OK");
        } catch (e) { log("GATEWAY_FLUSH_FAILED", "ERR"); }
    }

    _queueSwarmRetry(peerID, vault, attempt = 1) {
        const maxAttempts = 3;
        if (attempt > maxAttempts) {
            log(`SWARM_SYNC: ${peerID} retry budget exhausted.`, 'WARN');
            return;
        }
        const key = `${peerID}:${vault}`;
        if (this._swarmRetryJobs.has(key)) return;
        const delayMs = attempt * 5000;
        log(`SWARM_SYNC: queued retry ${attempt}/${maxAttempts} for ${peerID} in ${delayMs / 1000}s.`, 'WARN');
        const timer = setTimeout(async () => {
            this._swarmRetryJobs.delete(key);
            try {
                const res = await API.request('/api/swarm/dispatch', 'POST', {
                    target: peerID,
                    type: 'SYNC_VAULTS',
                    data: { vault }
                });
                const data = await res.json();
                if (res.status === 409) {
                    this._queueSwarmRetry(peerID, vault, attempt + 1);
                    return;
                }
                if (data && !data.error) {
                    log(`SWARM_SYNC_RETRY_OK: ${peerID} acknowledged task.`, 'OK');
                    return;
                }
                log(`SWARM_SYNC_RETRY_FAILED: ${data && data.error ? data.error : 'Unknown error'}`, 'ERR');
            } catch (err) {
                log(`SWARM_SYNC_RETRY_FAILED: ${err.message}`, 'ERR');
            }
        }, delayMs);
        this._swarmRetryJobs.set(key, { timer, attempt });
    }

    async syncPeer(peerID) {
        if (!peerID) return;
        const vault = State.get('activeVault') || 'INTEL_VAULT';
        try {
            const peersRes = await API.request('/api/peers');
            const peers = await peersRes.json();
            const peer = Array.isArray(peers) ? peers.find((p) => p && p.id === peerID) : null;
            if (!peer) {
                log(`SWARM_SYNC: Peer ${peerID} is unknown.`, 'WARN');
                return;
            }
            if (String(peer.status || '').toUpperCase() !== 'ACTIVE') {
                log(`SWARM_SYNC: Peer ${peerID} is offline.`, 'WARN');
                return;
            }
        } catch {
            // Continue and let dispatch return authoritative status.
        }

        log(`SWARM_SYNC: Dispatching ${vault} sync task to ${peerID}.`, 'SYS');
        try {
            const res = await API.request('/api/swarm/dispatch', 'POST', {
                target: peerID,
                type: 'SYNC_VAULTS',
                data: { vault }
            });
            const data = await res.json();
            if (res.status === 409) {
                log(`SWARM_SYNC: ${peerID} is offline or unreachable.`, 'WARN');
                this._queueSwarmRetry(peerID, vault, 1);
                return;
            }
            if (data && !data.error) {
                log(`SWARM_SYNC: ${peerID} acknowledged task.`, 'OK');
            } else {
                log(`SWARM_SYNC_FAILED: ${data && data.error ? data.error : 'Unknown error'}`, 'ERR');
            }
        } catch (e) {
            log(`SWARM_SYNC_FAILED: ${e.message}`, 'ERR');
        }
    }

    async launchEngine(id) {
        if (!id) return;
        const dot = document.getElementById(`p-${id}`);
        if (dot) {
            dot.classList.add('pulsing');
            dot.style.background = '#f0ad4e';
        }
        log(`ENGINE_INIT: ${id.toUpperCase()} launch requested.`, "SYS");
        try {
            const res = await API.request('/api/engines/launch', 'POST', {
                engine: id,
                payload: {
                    activeVault: State.get('activeVault') || null,
                    activeTab: State.get('activeTab') || null
                }
            });
            const data = await res.json();
            if (data && data.success) {
                if (dot) dot.style.background = 'var(--ok)';
                log(`ENGINE_READY: ${id.toUpperCase()} [${data.mode || 'loaded'}].`, "OK");
            } else {
                if (dot) dot.style.background = '#d9534f';
                log(`ENGINE_INIT_FAILED: ${data && data.error ? data.error : 'Unknown error'}`, "ERR");
            }
        } catch (e) {
            if (dot) dot.style.background = '#d9534f';
            log(`ENGINE_INIT_FAILED: ${e.message}`, "ERR");
        }
    }

    // --- NEURAL HUB ---
    loadNeuralHub() {
        this.openNeuralDashboard(State.get('neuralHubModule') || 'dev_os');
    }

    async refreshNeuralEmpireRuntime(silent = true) {
        if (State.get('uiLocked')) return null;
        try {
            const status = await API.getNeuralEmpireStatus();
            State.set('neuralEmpireStatus', status && status.runtime ? status.runtime : null);
            return status;
        } catch (e) {
            if (!silent) log(`NEURAL_EMPIRE_STATUS_FAIL:${e.message}`, 'WARN');
            return null;
        }
    }

    async _decorateNeuralHubMeta(moduleKey, target) {
        const meta = document.getElementById('neuralHubMeta');
        if (!meta) return;

        const base = `MODULE: ${moduleKey.toUpperCase()}\nPATH: ${target}`;
        meta.textContent = base;
        if (State.get('uiLocked')) return;

        const [status, modules] = await Promise.all([
            this.refreshNeuralEmpireRuntime(true),
            API.getNeuralEmpireModules().catch(() => null)
        ]);
        const runtime = status && status.runtime ? status.runtime : null;
        const kernel = runtime && runtime.kernel ? runtime.kernel : null;
        const moduleRows = modules && modules.moduleLoader && Array.isArray(modules.moduleLoader.modules)
            ? modules.moduleLoader.modules
            : [];

        const moduleLive = moduleRows.some((row) => String(row && row.id || '').toLowerCase() === String(moduleKey).toLowerCase());
        const bootFlag = runtime && runtime.booted ? 'BOOTED' : (runtime && runtime.error ? 'FAILED' : 'UNKNOWN');
        const moduleCount = kernel && Number.isFinite(Number(kernel.moduleCount))
            ? Number(kernel.moduleCount)
            : moduleRows.length;
        const signalSeq = kernel && Number.isFinite(Number(kernel.signalSequence))
            ? Number(kernel.signalSequence)
            : 0;
        meta.textContent = `${base}\nRUNTIME: ${bootFlag}\nMODULE_STATE: ${moduleLive ? 'REGISTERED' : 'UNREGISTERED'}\nMODULE_COUNT: ${moduleCount}\nSIGNAL_SEQ: ${signalSeq}`;
    }

    openNeuralDashboard(moduleKey = 'dev_os') {
        const routes = {
            dev_os: '/neural_empire/dev_os/dashboard/index.html',
            control_grid: '/neural_empire/control_grid/dashboard/index.html',
            intelligence_engine: '/neural_empire/intelligence_engine/dashboard/index.html',
            forgecore: '/neural_empire/forgecore/dashboard/index.html',
            signal_bus: '/neural_empire/signal_bus/dashboard/index.html',
            agent_framework: '/neural_empire/agent_framework/dashboard/index.html',
            hypersnatch: '/neural_empire/hypersnatch/dashboard/index.html',
            neuraltube: '/neural_empire/neuraltube/dashboard/index.html'
        };

        const target = routes[moduleKey] || routes.dev_os;
        State.set('neuralHubModule', moduleKey);
        const frame = document.getElementById('neuralHubFrame');
        const meta = document.getElementById('neuralHubMeta');

        if (frame) frame.src = target;
        if (meta) {
            meta.textContent = `MODULE: ${moduleKey.toUpperCase()}\nPATH: ${target}`;
        }
        this._decorateNeuralHubMeta(moduleKey, target).catch(() => { });

        document.querySelectorAll('.neuralhub-btn').forEach((btn) => {
            const action = btn.getAttribute('data-action') || '';
            btn.classList.toggle('active', action.includes(`'${moduleKey}'`));
        });

        this.scheduleRuntimeMemoryPersist(`neuralhub:${moduleKey}`);
        log(`NEURAL_HUB mounted: ${moduleKey}`, "SYS");
    }

    // --- FARADAY BRIDGE ---
    initFaraday() {
        const status = document.getElementById('faradayStatus');
        if (status) status.textContent = "READY_FOR_HANDSHAKE";
        const container = document.getElementById('faradayQRContainer');
        if (container) container.style.display = 'none';
    }

    async triggerFaraday() {
        log("Initiating Faraday Optical Sync Protocol...", "SYS");
        const status = document.getElementById('faradayStatus');
        const container = document.getElementById('faradayQRContainer');
        const visual = document.getElementById('faradayVisual');
        
        if (status) status.textContent = "ENCODING_MERKLE_STATE...";
        
        try {
            const res = await API.getFaradayStream();
            if (res.output && res.output.includes('FC_OPTICAL')) {
                // Extract frames from output (simple split for prototype)
                const frames = res.output.split('\n').filter(l => l.startsWith('FC_OPTICAL'));
                
                if (container) container.style.display = 'block';
                if (status) status.textContent = `STREAMING_${frames.length}_FRAMES_AT_30FPS`;
                
                let currentFrame = 0;
                const interval = setInterval(() => {
                    if (currentFrame >= frames.length) {
                        clearInterval(interval);
                        if (status) status.textContent = "STREAM_COMPLETE";
                        return;
                    }
                    
                    // High-speed visualizer: In a real app this renders a QR code
                    // Here we flicker colors to simulate high-density optical data
                    if (visual) {
                        visual.innerHTML = '';
                        for(let i=0; i<256; i++) {
                            const bit = document.createElement('div');
                            bit.style.background = Math.random() > 0.5 ? '#000' : '#fff';
                            visual.appendChild(bit);
                        }
                    }
                    currentFrame++;
                }, 33); // ~30fps
            }
        } catch(e) { 
            if (status) status.textContent = "DIODE_FAIL: Swarm unreachable.";
            log("Faraday optical diode failure.", "ERR"); 
        }
    }
}

// Bootstrap
window.EmpireOS = new App();
