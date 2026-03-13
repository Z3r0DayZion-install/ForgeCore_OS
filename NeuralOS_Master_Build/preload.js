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
    },
    // NeuralPod Protocol™ P2P Bridge
    pod: {
        start: () => ipcRenderer.invoke('pod-start'),
        stop: () => ipcRenderer.invoke('pod-stop'),
        status: () => ipcRenderer.invoke('pod-status')
    },
    // NodeChain™ Reactive State Bridge
    state: {
        get: () => ipcRenderer.invoke('state-get'),
        set: (patch) => ipcRenderer.send('state-set', patch),
        onUpdate: (callback) => ipcRenderer.on('state-update', (event, data) => callback(data))
    },
    // Native PTY Bridge
    pty: {
        send: (data) => ipcRenderer.send('pty-input', data),
        onData: (callback) => ipcRenderer.on('pty-data', (event, data) => callback(data)),
        resize: (cols, rows) => ipcRenderer.send('pty-resize', { cols, rows })
    },
    // Global System Management
    system: {
        audit: () => ipcRenderer.invoke('system-audit'),
        launch: (path) => ipcRenderer.invoke('system-launch', path),
        metrics: () => ipcRenderer.invoke('system-metrics')
    }
});
