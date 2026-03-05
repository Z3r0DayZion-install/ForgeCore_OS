const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const NeuralShield = require('./core/neuralshield');

let mainWindow;
let serverProcess;
const BOOT_LOG_PATH = path.join(os.tmpdir(), 'forgecore_packaged_boot.log');
const SERVER_URL = 'http://localhost:3000';
const SERVER_READY_ROUTE = '/api/handshake';
const SERVER_READY_TIMEOUT_MS = 70000;
const UI_LOAD_RETRY_DELAY_MS = 1500;
const UI_LOAD_MAX_RETRIES = 30;

function bootLog(message) {
    try {
        fs.appendFileSync(BOOT_LOG_PATH, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
    } catch {
        // Best-effort logging only.
    }
}

function verifyBootIntegrity() {
    console.log('[SECURITY] Performing NeuralShield Boot Integrity Check...');
    bootLog('verifyBootIntegrity:start');
    if (app.isPackaged) {
        console.warn('[SECURITY] PACKAGED_MODE: strict manifest file-hash verification bypassed.');
        bootLog('verifyBootIntegrity:packaged_bypass');
        return true;
    }
    try {
        const manifestPath = path.join(__dirname, 'core', 'manifest.json');
        const rootDir = __dirname;
        NeuralShield.verify(manifestPath, rootDir);
        console.log('[SECURITY] Integrity Verified. Proceeding to boot.');
        return true;
    } catch (e) {
        console.error('[CRITICAL] BOOT_INTEGRITY_FAILURE:', e.message);
        // Using a basic console log if dialog isn't ready,
        // but app.quit() is the most important part.
        app.quit();
        return false;
    }
}

function startServer() {
    console.log('[ELECTRON] Starting Quantum Sovereign Server v3.0...');
    const serverEntry = resolveServerEntry();
    console.log(`[ELECTRON] Server entry: ${serverEntry}`);
    bootLog(`startServer:entry=${serverEntry}`);

    if (app.isPackaged) {
        try {
            require(serverEntry);
            serverProcess = null;
            bootLog('startServer:packaged_inprocess_ok');
        } catch (err) {
            bootLog(`startServer:packaged_inprocess_error=${String(err && err.message ? err.message : err)}`);
            app.quit();
        }
        return;
    }

    try {
        serverProcess = spawn(process.execPath, [serverEntry], {
            stdio: 'inherit',
            windowsHide: true,
            env: {
                ...process.env,
                ELECTRON_RUN_AS_NODE: '1'
            }
        });
    } catch (err) {
        bootLog(`startServer:fork_throw=${String(err && err.message ? err.message : err)}`);
        app.quit();
        return;
    }
    bootLog(`startServer:pid=${serverProcess.pid}`);

    serverProcess.on('error', (err) => {
        bootLog(`startServer:error=${String(err && err.message ? err.message : err)}`);
    });
    serverProcess.on('exit', (code) => {
        console.log(`[ELECTRON] Server process exited with code ${code}`);
        bootLog(`startServer:exit=${code}`);
        if (app.isReady()) app.quit();
    });
}

function probeServerReady(timeoutMs = 1200) {
    return new Promise((resolve) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: 3000,
            path: SERVER_READY_ROUTE,
            method: 'GET',
            timeout: timeoutMs
        }, (res) => {
            // Any HTTP response means server socket is up.
            res.resume();
            resolve((res.statusCode || 0) > 0);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
        req.end();
    });
}

async function waitForServerReady(maxMs = SERVER_READY_TIMEOUT_MS) {
    const started = Date.now();
    while (Date.now() - started < maxMs) {
        const ok = await probeServerReady();
        if (ok) return true;
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return false;
}

function loadServerUI(win) {
    if (!win || win.isDestroyed()) return;
    win.loadURL(SERVER_URL);
}

function loadBootFailure(win) {
    if (!win || win.isDestroyed()) return;
    const html = [
        '<!doctype html>',
        '<html><head><meta charset="utf-8"><title>ForgeCore Boot</title></head>',
        '<body style="margin:0;padding:24px;font-family:Segoe UI,Arial,sans-serif;background:#0a0f16;color:#d7e2f0;">',
        '<h2 style="margin:0 0 8px 0;">ForgeCore server did not become ready.</h2>',
        '<p style="margin:0 0 12px 0;">The app will keep retrying in the background.</p>',
        `<p style="opacity:.8;margin:0;">Boot log: ${BOOT_LOG_PATH}</p>`,
        '</body></html>'
    ].join('');
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

async function loadUIWhenReady(win) {
    bootLog('ui_load:waiting_for_server');
    const ready = await waitForServerReady();
    if (!ready) {
        bootLog('ui_load:server_timeout');
        loadBootFailure(win);
        return;
    }
    bootLog('ui_load:server_ready');
    loadServerUI(win);
}

function resolveServerEntry() {
    const devPath = path.join(__dirname, 'core', 'v3_sovereign_server.js');
    if (!app.isPackaged) {
        return devPath;
    }

    const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'core', 'v3_sovereign_server.js');
    if (fs.existsSync(unpackedPath)) {
        return unpackedPath;
    }

    const asarPath = path.join(process.resourcesPath, 'app.asar', 'core', 'v3_sovereign_server.js');
    return asarPath;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        frame: false, // Frameless for "Premium" feel
        backgroundColor: '#030508',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'core', 'framework', 'preload.js') // We'll create this if needed
        }
    });

    let loadRetries = 0;
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        if (!String(validatedURL || '').startsWith(SERVER_URL)) return;
        if (loadRetries >= UI_LOAD_MAX_RETRIES) {
            bootLog(`ui_load:give_up code=${errorCode} reason=${errorDescription}`);
            loadBootFailure(mainWindow);
            return;
        }
        loadRetries += 1;
        bootLog(`ui_load:retry=${loadRetries} code=${errorCode} reason=${errorDescription}`);
        setTimeout(() => loadServerUI(mainWindow), UI_LOAD_RETRY_DELAY_MS);
    });

    loadUIWhenReady(mainWindow);

    mainWindow.on('closed', function () {
        mainWindow = null;
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

app.on('ready', () => {
    bootLog('app:ready');
    if (verifyBootIntegrity()) {
        startServer();
        createWindow();
    }
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
    if (mainWindow === null) createWindow();
});

ipcMain.on('window-control', (event, arg) => {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    if (arg === 'minimize') win.minimize();
    if (arg === 'maximize') {
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
    }
    if (arg === 'close') win.close();
});

app.on('before-quit', () => {
    bootLog('app:before-quit');
    if (serverProcess) {
        serverProcess.kill('SIGINT');
    }
});
