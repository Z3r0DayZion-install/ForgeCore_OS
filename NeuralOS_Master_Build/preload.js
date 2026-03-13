const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('neuralos', {
    shell: {
        switch: (mode) => ipcRenderer.send('switch-shell', mode),
        getMode: () => process.env.SHELL_MODE || 'winshadow'
    },
    core: {
        getSeal: () => process.env.NEURALOS_SEAL
    },
    // XXXplorer Sovereign FS Bridge
    fs: {
        ls: (dir) => ipcRenderer.invoke('fs-ls', dir),
        verify: (filePath) => ipcRenderer.invoke('fs-verify', filePath),
        vaultMove: (src, dest) => ipcRenderer.invoke('fs-vault-move', src, dest)
    }
    // VIPN Sovereign VPN Bridge
    vpn: {
        start: (config) => ipcRenderer.invoke('vpn-start', config),
        stop: () => ipcRenderer.invoke('vpn-stop'),
        status: () => ipcRenderer.invoke('vpn-status')
    },
    // NeuralShell AI & Memory Core
    shell: {
        execute: (cmd) => ipcRenderer.invoke('shell-command', cmd),
        onMemoryUpdate: (callback) => ipcRenderer.on('memory-update', (event, data) => callback(data))
    }
});
