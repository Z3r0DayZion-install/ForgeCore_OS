const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const RUNTIME_ROOT = process.env.NEURALOS_RUNTIME_DIR
    ? path.resolve(process.env.NEURALOS_RUNTIME_DIR)
    : app.isPackaged
        ? app.getPath('userData')
        : path.resolve(__dirname, '..');

const MEMORY_DIR = path.join(RUNTIME_ROOT, 'memory');
const SESSION_LOG = path.join(MEMORY_DIR, 'SESSION.jsonl');
const STATE_FILE = process.env.NEURALOS_STATE_FILE
    ? path.resolve(process.env.NEURALOS_STATE_FILE)
    : path.join(MEMORY_DIR, 'NODECHAIN_STATE.json');
const PROOF_DIR = path.join(RUNTIME_ROOT, 'proof_bundle');
const LOG_FILE = path.join(PROOF_DIR, 'OPERATIONS.log');

const DEFAULT_SYSTEM_STATE = {
    activeShell: 'winshadow',
    vaultStatus: 'LOCKED',
    lastOperation: null,
    notifications: [],
    settings: {
        desktop: {
            windows: { explorer: true, vpn: false, panel: false },
            commandDraft: '',
            lastCommand: ''
        },
        xxxplorer: {
            theme: 'dark',
            leftRootPath: '.',
            rightRootPath: './packages'
        }
    }
};

const NATIVE_LAUNCH_TARGETS = new Map([
    ['calc', { command: 'calc.exe' }],
    ['calculator', { command: 'calc.exe' }],
    ['calc.exe', { command: 'calc.exe' }],
    ['notepad', { command: 'notepad.exe' }],
    ['notepad.exe', { command: 'notepad.exe' }],
    ['paint', { command: 'mspaint.exe' }],
    ['mspaint', { command: 'mspaint.exe' }],
    ['mspaint.exe', { command: 'mspaint.exe' }],
    ['task-manager', { command: 'taskmgr.exe' }],
    ['windows-task-manager', { command: 'taskmgr.exe' }],
    ['taskmgr', { command: 'taskmgr.exe' }],
    ['taskmgr.exe', { command: 'taskmgr.exe' }],
    ['explorer', { command: 'explorer.exe' }],
    ['explorer.exe', { command: 'explorer.exe' }],
    ['windows-settings', { external: 'ms-settings:' }],
    ['settings', { external: 'ms-settings:' }]
]);

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Ensure required directories exist on import.
ensureDir(MEMORY_DIR);
ensureDir(path.dirname(STATE_FILE));
ensureDir(PROOF_DIR);

module.exports = {
    RUNTIME_ROOT,
    MEMORY_DIR,
    SESSION_LOG,
    STATE_FILE,
    PROOF_DIR,
    LOG_FILE,
    DEFAULT_SYSTEM_STATE,
    NATIVE_LAUNCH_TARGETS,
    ensureDir,
};
