const { contextBridge, ipcRenderer } = require('electron');

function bindRendererEvent(channel, callback) {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => {
        ipcRenderer.removeListener(channel, handler);
    };
}

contextBridge.exposeInMainWorld('neuralos', {
    shell: {
        switch: (mode) => ipcRenderer.send('switch-shell', mode),
        getMode: () => process.env.SHELL_MODE || 'winshadow',
        execute: (cmd) => ipcRenderer.invoke('shell-command', cmd),
        onMemoryUpdate: (callback) => bindRendererEvent('memory-update', callback)
    },
    core: {
        getSeal: async () => process.env.NEURALOS_SEAL || ''
    },
    fs: {
        ls: (dir) => ipcRenderer.invoke('fs-ls', dir),
        verify: (filePath) => ipcRenderer.invoke('fs-verify', filePath),
        vaultMove: (src, dest) => ipcRenderer.invoke('fs-vault-move', src, dest)
    },
    vpn: {
        start: (config) => ipcRenderer.invoke('vpn-start', config),
        stop: () => ipcRenderer.invoke('vpn-stop'),
        status: () => ipcRenderer.invoke('vpn-status')
    },
    pod: {
        start: () => ipcRenderer.invoke('pod-start'),
        stop: () => ipcRenderer.invoke('pod-stop'),
        status: () => ipcRenderer.invoke('pod-status')
    },
    state: {
        get: () => ipcRenderer.invoke('state-get'),
        set: (patch) => ipcRenderer.send('state-set', patch),
        onUpdate: (callback) => bindRendererEvent('state-update', callback)
    },
    pty: {
        send: (data) => ipcRenderer.send('pty-input', data),
        onData: (callback) => bindRendererEvent('pty-data', callback),
        resize: (cols, rows) => ipcRenderer.send('pty-resize', { cols, rows })
    },
    system: {
        audit: () => ipcRenderer.invoke('system-audit'),
        launch: (appPath) => ipcRenderer.invoke('system-launch', appPath),
        metrics: () => ipcRenderer.invoke('system-metrics')
    }
});
