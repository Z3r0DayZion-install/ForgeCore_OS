const path = require('path');
const fs = require('fs');
const { BrowserWindow, globalShortcut } = require('electron');
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

function createWindow() {
    const shellMode = process.env.SHELL_MODE || (ctx.systemState && ctx.systemState.activeShell) || 'winshadow';
    process.env.SHELL_MODE = shellMode;
    console.log(`[NEURALOS] Loading Shell: ${shellMode}`);

    if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.destroy();
    }

    ctx.mainWindow = new BrowserWindow({
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

    ctx.mainWindow.on('closed', () => {
        ctx.mainWindow = null;
    });

    registerShellShortcut();

    const shellPath = resolveShellPath(shellMode);
    ctx.mainWindow.loadFile(shellPath).catch((err) => {
        console.error('[NEURALOS] Failed to load shell:', shellPath, err);
    });

    setupPTY(ctx.mainWindow);
    updateState({ activeShell: shellMode });
}

module.exports = { resolveShellPath, createWindow };
