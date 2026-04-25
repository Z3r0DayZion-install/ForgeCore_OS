const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const si = require('systeminformation');
const crypto = require('crypto');

let mainWindow;

// Hardware Binding: Seal-Pulse V3 (CPU + MAC Address)
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

function createBootWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false,
        fullscreen: true,
        backgroundColor: '#050505',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Start with the WinShadow Boot Ritual
    mainWindow.loadFile(path.join(__dirname, 'core', 'ui', 'boot_ritual.html'));
}

app.whenReady().then(async () => {
    const seal = await generateHardwareSeal();
    process.env.NEURALOS_SEAL = seal;
    createBootWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createBootWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('ritual-complete', (event) => {
    console.log('[NEURAL-ENGINE] Ritual Complete. Transitioning to Sovereign Shell.');
    mainWindow.loadFile(path.join(__dirname, 'core', 'ui', 'triple_os_desktop.html'));
});
