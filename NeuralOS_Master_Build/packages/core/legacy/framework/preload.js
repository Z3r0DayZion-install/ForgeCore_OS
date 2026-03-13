const { contextBridge, ipcRenderer } = require('electron');

/**
 * ForgeCore™ OS — Hardened Preload Script
 * ----------------------------------------
 * Context-isolated bridge between Electron main and renderer.
 * ZERO Node.js primitives are exposed. All channels are whitelisted.
 */

const VALID_CHANNELS_SEND = ['window-control', 'app-force-quit', 'app:get-version', 'theme:save', 'theme:load'];
const VALID_CHANNELS_INVOKE = ['app:get-info', 'theme:get'];

contextBridge.exposeInMainWorld('api', {
    /**
     * Window controls (minimize, maximize, close)
     */
    windowControl: (action) => {
        const validActions = ['minimize', 'maximize', 'close'];
        if (validActions.includes(action)) {
            ipcRenderer.send('window-control', action);
        }
    },

    /**
     * Emergency hard-exit path if renderer/UI is degraded.
     */
    forceQuit: () => {
        ipcRenderer.send('app-force-quit');
    },

    /**
     * Get application info (version, platform, etc.)
     * Returns a promise with sanitized app metadata.
     */
    getAppInfo: () => ipcRenderer.invoke('app:get-info'),

    /**
     * Theme persistence via main process
     */
    saveTheme: (themeName) => {
        if (typeof themeName === 'string' && themeName.length < 128) {
            ipcRenderer.send('theme:save', themeName);
        }
    },
    getTheme: () => ipcRenderer.invoke('theme:get'),

    /**
     * Generic safe send — strictly whitelisted channels only.
     */
    send: (channel, data) => {
        if (VALID_CHANNELS_SEND.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },

    /**
     * Generic safe invoke — strictly whitelisted channels only.
     */
    invoke: (channel, ...args) => {
        if (VALID_CHANNELS_INVOKE.includes(channel)) {
            return ipcRenderer.invoke(channel, ...args);
        }
        return Promise.reject(new Error(`Channel blocked: ${channel}`));
    }
});

// Also maintain backward compatibility with the old 'electron' namespace
contextBridge.exposeInMainWorld('electron', {
    send: (channel, data) => {
        if (VALID_CHANNELS_SEND.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    }
});
