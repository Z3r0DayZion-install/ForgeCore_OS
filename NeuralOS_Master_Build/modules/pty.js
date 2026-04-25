const os = require('os');
const pty = require('node-pty');
const { ipcMain } = require('electron');
const ctx = require('./context');

function setupPTY(window) {
    if (ctx.ptyProcess) {
        try {
            ctx.ptyProcess.kill();
        } catch {
            // Best effort cleanup.
        }
    }

    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    ctx.ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.cwd(),
        env: process.env
    });

    ctx.ptyProcess.onData((data) => {
        if (window && !window.isDestroyed()) {
            window.webContents.send('pty-data', data);
        }
    });

    if (ctx.ptyHandlersBound) {
        return;
    }

    ipcMain.on('pty-input', (_event, data) => {
        if (ctx.ptyProcess) {
            ctx.ptyProcess.write(data);
        }
    });

    ipcMain.on('pty-resize', (_event, { cols, rows }) => {
        if (ctx.ptyProcess) {
            ctx.ptyProcess.resize(cols, rows);
        }
    });

    ctx.ptyHandlersBound = true;
}

module.exports = { setupPTY };
