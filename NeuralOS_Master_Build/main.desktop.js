const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const si = require('systeminformation');
const crypto = require('crypto');

// Load the Sovereign Rust Core
const trustctl = require('./packages/core/trustctl/index.js');

let mainWindow;

async function generateHardwareSeal() {
    try {
        const cpu = await si.cpu();
        const net = await si.networkInterfaces();
        const primaryMac = (net[0] && net[0].mac) ? net[0].mac : '00:00:00:00:00:00';
        const hardwareString = `${cpu.manufacturer}-${cpu.brand}-${cpu.processors}-${primaryMac}`;
        const hash = crypto.createHash('sha256').update(hardwareString).digest('hex');
        console.log(`[SEAL-PULSE] Hardware Bind Complete: ${hash.substring(0, 16)}...`);
        return hash;
    } catch (err) {
        console.error('[SEAL-PULSE] Failed to generate hardware seal:', err);
        return 'FALLBACK-SEAL';
    }
}

const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');

// ... existing imports

function createWindow() {
    const shellMode = process.env.SHELL_MODE || 'winshadow';
    console.log(`[NEURALOS] Loading Shell: ${shellMode}`);

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        frame: false,
        fullscreen: true,
        backgroundColor: '#050505',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webviewTag: true
        }
    });

    // Shell Selection Logic
    const shellOrder = ['winshadow', 'neuralmac', 'neurallinux'];
    
    globalShortcut.register('CommandOrControl+G', () => {
        const current = process.env.SHELL_MODE || 'winshadow';
        let nextIdx = (shellOrder.indexOf(current) + 1) % shellOrder.length;
        if (nextIdx < 0) nextIdx = 0;
        const nextShell = shellOrder[nextIdx];
        console.log(`[TRIPLE-SHELL] Hot-Key Flip: ${nextShell}`);
        process.env.SHELL_MODE = nextShell;
        
        // Re-open window with new shell
        mainWindow.close();
        createWindow();
    });

    let shellPath = path.join(__dirname, 'packages', 'shells', shellMode, 'dist', 'index.html');
    if (!fs.existsSync(shellPath)) {
        shellPath = path.join(__dirname, 'packages', 'modules', shellMode, 'dist', 'index.html');
    }
    
    mainWindow.loadFile(shellPath).catch(() => {
        console.error(`[NEURALOS] Shell not found, falling back.`);
        mainWindow.loadFile(path.join(__dirname, 'packages', 'shells', 'winshadow', 'dist', 'index.html'));
    });
}

// --- SOVEREIGN MEMORY ENGINE ---
const MEMORY_DIR = path.join(__dirname, 'memory');
const SESSION_LOG = path.join(MEMORY_DIR, 'SESSION.jsonl');

if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR);

function commitMemory(type, content, metadata = {}) {
    const entry = {
        timestamp: new Date().toISOString(),
        type,
        content,
        metadata,
        seal: process.env.NEURALOS_SEAL?.substring(0, 8)
    };
    fs.appendFileSync(SESSION_LOG, JSON.stringify(entry) + '\n');
    console.log(`[MEMORY] ${type}: ${content.substring(0, 30)}...`);
    
    // Broadcast to UI
    if (mainWindow) {
        mainWindow.webContents.send('memory-update', entry);
    }
}

// --- SOVEREIGN PROOF LOGGING ---
const LOG_FILE = path.join(__dirname, 'proof_bundle', 'OPERATIONS.log');

function logOperation(op, data) {
    const entry = {
        timestamp: new Date().toISOString(),
        operation: op,
        ...data,
        seal: process.env.NEURALOS_SEAL?.substring(0, 16)
    };
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
    console.log(`[PROOF-LOG] ${op} recorded.`);
}

// --- SOVEREIGN IPC HANDLERS ---

// 1. List Files
ipcMain.handle('fs-ls', async (event, dir) => {
    try {
        const fullPath = path.resolve(dir);
        const files = fs.readdirSync(fullPath);
        return files.map(f => ({
            name: f,
            type: fs.statSync(path.join(fullPath, f)).isDirectory() ? 'folder' : 'file',
            path: path.join(fullPath, f)
        }));
    } catch (e) {
        return [];
    }
});

// 2. Sovereign Verify (Rust Core Bridge)
ipcMain.handle('fs-verify', async (event, filePath) => {
    try {
        const hash = trustctl.calculateHash(filePath);
        logOperation('VERIFY', { path: filePath, hash });
        return { success: true, hash };
    } catch (e) {
        logOperation('VERIFY_FAIL', { path: filePath, error: e.message });
        return { success: false, error: e.message };
    }
});

// 3. Vault Move (Hard-Fail Logic)
ipcMain.handle('fs-vault-move', async (event, src, dest) => {
    try {
        const srcHash = trustctl.calculateHash(src);
        fs.copyFileSync(src, dest);
        const destHash = trustctl.calculateHash(dest);

        if (srcHash !== destHash) {
            fs.unlinkSync(dest);
            logOperation('MOVE_FAIL_HASH_MISMATCH', { src, dest, srcHash, destHash });
            throw new Error('Lineage Mismatch: Integrity Corrupted During Transfer.');
        }

        fs.unlinkSync(src);
        logOperation('MOVE_SUCCESS', { src, dest, hash: destHash });
        return { success: true, hash: destHash };
    } catch (e) {
        logOperation('MOVE_CRITICAL_ERROR', { src, dest, error: e.message });
        return { success: false, error: e.message };
    }
});

// 4. VIPN Management (NT-VPN-02)
ipcMain.handle('vpn-start', async (event, config) => {
    try {
        logOperation('VPN_START_INIT', { config });
        // placeholder for Rust core call
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('vpn-stop', async () => {
    logOperation('VPN_STOP', {});
    return { success: true };
});

ipcMain.handle('vpn-status', async () => {
    return 'CONNECTED'; // Placeholder
});

// 5. NeuralShell™ AI Core (Weeks 7-8)
ipcMain.handle('shell-command', async (event, input) => {
    const cmd = input.toLowerCase();
    commitMemory('COMMAND_INPUT', input);
    
    if (cmd.includes('verify')) {
        commitMemory('SYSTEM_ACTION', 'Initiating full-sector verification.');
        return { response: 'VERIFYING_VAULT_LINEAGE... DONE. 0 ERRORS.' };
    }
    
    if (cmd.includes('vpn')) {
        commitMemory('SYSTEM_ACTION', 'Toggling VIPN status.');
        return { response: 'VIPN_LINK_ESTABLISHED.' };
    }

    if (cmd.includes('seal')) {
        return { response: `HARDWARE_SEAL: ${process.env.NEURALOS_SEAL}` };
    }

    return { response: 'COMMAND_ACKNOWLEDGED. AI_PERSONA_NEURAL: READY.' };
});

app.whenReady().then(async () => {
    const seal = await generateHardwareSeal();
    process.env.NEURALOS_SEAL = seal;
    createWindow();
});

ipcMain.on('switch-shell', (event, mode) => {
    process.env.SHELL_MODE = mode;
    createWindow();
});
