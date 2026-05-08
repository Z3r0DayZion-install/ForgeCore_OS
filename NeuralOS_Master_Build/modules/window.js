const path = require('path');
const fs = require('fs');
const { BrowserWindow, globalShortcut, session } = require('electron');
const ctx = require('./context');
const { updateState } = require('./state');
const { setupPTY } = require('./pty');

const ROOT_DIR = path.resolve(__dirname, '..');

function resolveShellPath(shellMode) {
    const candidates = [
        path.join(ROOT_DIR, 'packages', 'shells', shellMode, 'dist', 'index.html'),
        path.join(ROOT_DIR, 'packages', 'modules', shellMode, 'dist', 'index.html'),
        path.join(ROOT_DIR, 'packages', 'shells', 'winshadow', 'dist', 'index.html'),
        path.join(ROOT_DIR, 'packages', 'modules', 'xxxplorer', 'dist', 'index.html')
    ];
    return candidates.find((c) => fs.existsSync(c)) || candidates[candidates.length - 1];
}

const ALLOWED_PERMISSIONS = new Set(['clipboard-read', 'clipboard-sanitized-write']);

/**
 * Inject Content-Security-Policy headers on every response flowing
 * into the default session.  Only local file:// origins and inline
 * styles/scripts used by the shell front-ends are permitted.
 */
function applyCSPHeaders() {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self' file:; " +
                        "script-src  'self' file: 'unsafe-inline'; " +
                        "style-src   'self' file: 'unsafe-inline'; " +
                        "img-src     'self' file: data:; " +
                        "font-src    'self' file: data:; " +
                        "connect-src 'self'; " +
                        "object-src  'none'; " +
                        "base-uri    'none'; " +
                        "form-action 'none';"
                ]
            }
        });
    });
}

/**
 * Restrict which renderer-side permission requests are honoured.
 * Only clipboard access is permitted; everything else (camera, mic,
 * geolocation, notifications, midi, etc.) is denied outright.
 */
function applyPermissionHandler() {
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        if (ALLOWED_PERMISSIONS.has(permission)) {
            callback(true);
        } else {
            console.warn(`[SECURITY] Denied permission request: ${permission}`);
            callback(false);
        }
    });
    session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
        return ALLOWED_PERMISSIONS.has(permission);
    });
}

function registerShellShortcut() {
    globalShortcut.unregister('CommandOrControl+G');
    globalShortcut.register('CommandOrControl+G', () => {
        const shellOrder = ['winshadow', 'neuralmac', 'neurallinux'];
        const current = process.env.SHELL_MODE || ctx.systemState.activeShell || 'winshadow';
        let nextIdx = (shellOrder.indexOf(current) + 1) % shellOrder.length;
        if (nextIdx < 0) {
            nextIdx = 0;
        }
        const nextShell = shellOrder[nextIdx];
        console.log(`[TRIPLE-SHELL] Hot-Key Flip: ${nextShell}`);
        process.env.SHELL_MODE = nextShell;
        createWindow();
    });
}

let securityApplied = false;

function createWindow() {
    if (!securityApplied) {
        applyCSPHeaders();
        applyPermissionHandler();
        securityApplied = true;
    }

    const shellMode = process.env.SHELL_MODE || (ctx.systemState && ctx.systemState.activeShell) || 'winshadow';
    process.env.SHELL_MODE = shellMode;
    console.log(`[NEURALOS] Loading Shell: ${shellMode}`);

    const previousWindow = ctx.mainWindow && !ctx.mainWindow.isDestroyed() ? ctx.mainWindow : null;
    const nextWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        frame: false,
        fullscreen: true,
        backgroundColor: '#050505',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(ROOT_DIR, 'preload.js'),
            webviewTag: false,
            webSecurity: true
        }
    });

    ctx.mainWindow = nextWindow;

    nextWindow.on('closed', () => {
        if (ctx.mainWindow === nextWindow) {
            ctx.mainWindow = null;
        }
    });

    registerShellShortcut();

    const shellPath = resolveShellPath(shellMode);
    nextWindow.loadFile(shellPath).catch((err) => {
        console.error('[NEURALOS] Failed to load shell:', shellPath, err);
    });

    setupPTY(nextWindow);
    updateState({ activeShell: shellMode });

    if (previousWindow) {
        previousWindow.destroy();
    }
}

module.exports = { resolveShellPath, createWindow, applyCSPHeaders, applyPermissionHandler };
