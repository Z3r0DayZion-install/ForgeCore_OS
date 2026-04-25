/**
 * State Management for ForgeCore OS
 * Encapsulates global mutable variables.
 */

class SystemState {
    constructor() {
        this.uiLocked = true;
        this.activeVault = '';
        this.activeTab = 'dashboard';
        this.selectedCID = '';
        this.forgeRepo = '';
        this.forgeDir = '/';
        this.forgePath = '';
        this.forgeSearch = '';
        this.neuralHubModule = 'dev_os';
        this.neuralEmpireStatus = null;
        this.swarmData = { peers: [] };
        this.activityData = [];
        this.bootTime = Date.now();
        this.ghostProtocol = false;
        this.shell = 'winshadow';

        // Settings
        this.theme = 'BloodNeon';
        this.matrixOpacity = 0.15;
        this.shadowMask = false;

        // Listeners
        this.listeners = new Set();
    }

    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    notify(key) {
        for (const fn of this.listeners) {
            fn(key, this);
        }
    }

    set(key, value) {
        this[key] = value;
        this.notify(key);
    }

    get(key) {
        return this[key];
    }
}

export const State = new SystemState();
