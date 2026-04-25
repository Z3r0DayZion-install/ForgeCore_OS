/**
 * NeuralOS — Sovereign Desktop Runtime
 *
 * This is the Electron main-process entry point.  All domain logic lives in
 * the ./modules/ directory; this file simply wires the pieces together and
 * manages the application lifecycle.
 */

const { app, BrowserWindow, globalShortcut } = require('electron');

const ctx = require('./modules/context');
const { loadSystemState } = require('./modules/state');
const { generateHardwareSeal } = require('./modules/hardware');
const { createWindow } = require('./modules/window');
const { registerIpcHandlers } = require('./modules/ipc');

// --- Bootstrap global state ---
ctx.systemState = loadSystemState();

// --- Register all IPC handlers ---
registerIpcHandlers();

// --- App lifecycle ---
app.whenReady().then(async () => {
    const seal = await generateHardwareSeal();
    process.env.NEURALOS_SEAL = seal;
    createWindow();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    if (ctx.ptyProcess) {
        try {
            ctx.ptyProcess.kill();
        } catch {
            // Best effort cleanup.
        }
    }
});
