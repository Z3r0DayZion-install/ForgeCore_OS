const fs = require('fs');
const { STATE_FILE, DEFAULT_SYSTEM_STATE } = require('./config');
const ctx = require('./context');

function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(base, patch) {
    const output = { ...base };
    for (const [key, patchValue] of Object.entries(patch)) {
        const baseValue = output[key];
        if (isPlainObject(baseValue) && isPlainObject(patchValue)) {
            output[key] = deepMerge(baseValue, patchValue);
            continue;
        }
        output[key] = patchValue;
    }
    return output;
}

function normalizeState(candidate) {
    const normalized = deepMerge(
        DEFAULT_SYSTEM_STATE,
        isPlainObject(candidate) ? candidate : {}
    );
    if (!Array.isArray(normalized.notifications)) {
        normalized.notifications = [];
    }
    if (typeof normalized.activeShell !== 'string') {
        normalized.activeShell = DEFAULT_SYSTEM_STATE.activeShell;
    }
    return normalized;
}

function loadSystemState() {
    try {
        if (!fs.existsSync(STATE_FILE)) {
            return normalizeState(DEFAULT_SYSTEM_STATE);
        }
        const raw = fs.readFileSync(STATE_FILE, 'utf-8');
        return normalizeState(JSON.parse(raw));
    } catch (err) {
        console.error('[NODECHAIN] Failed to load state file, using defaults.', err);
        return normalizeState(DEFAULT_SYSTEM_STATE);
    }
}

function persistSystemState(systemState) {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(systemState, null, 2), 'utf-8');
    } catch (err) {
        console.error('[NODECHAIN] Failed to persist state file.', err);
    }
}

/**
 * Merge a patch into the global system state, persist to disk,
 * and push the update to the renderer if a window is available.
 */
function updateState(patch = {}) {
    if (!isPlainObject(patch)) {
        return ctx.systemState;
    }

    ctx.systemState = normalizeState(deepMerge(ctx.systemState, patch));

    if (isPlainObject(patch.lastOperation)) {
        const event = { id: Date.now(), ...patch.lastOperation };
        const history = Array.isArray(ctx.systemState.notifications) ? ctx.systemState.notifications : [];
        ctx.systemState.notifications = [event, ...history].slice(0, 10);
    }

    persistSystemState(ctx.systemState);
    console.log('[NODECHAIN] Global Sync:', patch);

    if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.webContents.send('state-update', ctx.systemState);
    }

    return ctx.systemState;
}

module.exports = {
    isPlainObject,
    deepMerge,
    normalizeState,
    loadSystemState,
    persistSystemState,
    updateState,
};
