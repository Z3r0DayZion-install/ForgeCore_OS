"use strict";

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * DRIFTER v1.1 [Imperial Edition]
 * -------------------------------
 * Remote task dispatcher for the Sovereign Mesh.
 * Ported to ForgeCore OS.
 */

class Drifter {
    constructor(ghostSync, options = {}) {
        this.ghostSync = ghostSync;
        this.pendingTasks = new Map(); // id -> { resolve, reject, timeout }
        this.log = (msg) => console.log(`[DRIFTER] ${msg}`);
        this.appRoot = path.resolve(String(options.appRoot || path.join(__dirname, '..', '..')));
        this.rootDir = path.resolve(String(options.rootDir || path.join(this.appRoot, 'vaults')));
        this.engineDir = path.resolve(String(options.engineDir || path.join(this.appRoot, 'core', 'swarm')));
        this.maxTaskMs = Math.max(5000, Number(options.maxTaskMs || 15000));
    }

    init() {
        this.ghostSync.onPacket('DRIFTER_TASK_EXEC', (data, rinfo) => this.handleRemoteTask(data, rinfo));
        this.ghostSync.onPacket('DRIFTER_TASK_RESULT', (data, rinfo) => this.handleTaskResult(data, rinfo));
    }

    /**
     * Dispatches a task to a specific peer.
     */
    async dispatch(targetPeerID, engineName, artifact) {
        const peer = this.ghostSync.peers.get(targetPeerID);
        if (!peer) throw new Error(`Target peer ${targetPeerID} not found or offline.`);

        const taskID = crypto.randomBytes(16).toString('hex');
        this.log(`Dispatching task ${taskID.slice(0, 8)} [${engineName}] to peer ${targetPeerID.slice(0, 8)}`);

        const executionPacket = {
            type: 'DRIFTER_TASK_EXEC',
            taskID,
            engineName,
            artifact
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingTasks.delete(taskID);
                reject(new Error(`Task ${taskID.slice(0, 8)} timed out on peer ${targetPeerID.slice(0, 8)}`));
            }, this.maxTaskMs);

            this.pendingTasks.set(taskID, { resolve, reject, timeout });
            this.ghostSync.sendPacket(peer.address, peer.port, executionPacket);
        });
    }

    _sanitizeEngineName(engineName) {
        const cleaned = String(engineName || '').trim().replace(/\.js$/i, '');
        if (!/^[A-Za-z0-9_\-]+$/.test(cleaned)) {
            throw new Error('INVALID_ENGINE_NAME');
        }
        return cleaned;
    }

    _resolveEnginePath(engineName) {
        const safeName = this._sanitizeEngineName(engineName);
        const target = path.resolve(this.engineDir, `${safeName}.js`);
        if (!target.startsWith(this.engineDir)) {
            throw new Error('ENGINE_PATH_VIOLATION');
        }
        if (!fs.existsSync(target)) {
            throw new Error(`ENGINE_NOT_FOUND:${safeName}`);
        }
        return target;
    }

    _isBuiltinTask(engineName) {
        return String(engineName || '').trim().toUpperCase() === 'SYNC_VAULTS';
    }

    async executeLocal(engineName, artifact) {
        const execution = this._isBuiltinTask(engineName)
            ? await this._runBuiltinTask(engineName, artifact)
            : await this._runEngineTask(engineName, artifact);
        return {
            ok: true,
            local: true,
            node: this.ghostSync.machineID,
            engine: String(engineName || '').trim(),
            mode: execution.mode,
            result: execution.result
        };
    }

    async _runBuiltinTask(engineName, artifact) {
        const name = String(engineName || '').trim().toUpperCase();
        if (name === 'SYNC_VAULTS') {
            const vault = artifact && typeof artifact === 'object'
                ? String(artifact.vault || '').trim()
                : '';
            return {
                mode: 'builtin',
                result: {
                    status: 'SYNC_ACCEPTED',
                    vault: vault || 'INTEL_VAULT',
                    applied: false
                }
            };
        }
        throw new Error(`UNSUPPORTED_BUILTIN_TASK:${name}`);
    }

    async _runEngineTask(engineName, artifact) {
        const enginePath = this._resolveEnginePath(engineName);
        const resolved = require.resolve(enginePath);
        delete require.cache[resolved];
        const mod = require(enginePath);
        const payload = artifact && typeof artifact === 'object' ? artifact : {};
        const ctx = {
            rootDir: this.rootDir,
            appRoot: this.appRoot,
            coreDir: path.join(this.appRoot, 'core'),
            machineID: this.ghostSync.machineID,
            remote: true
        };

        let mode = 'loaded';
        let result = null;
        if (mod && typeof mod.run === 'function') {
            mode = 'run';
            result = await Promise.resolve(mod.run(payload, ctx));
        } else if (mod && typeof mod.start === 'function') {
            mode = 'start';
            result = await Promise.resolve(mod.start(payload, ctx));
        } else if (mod && typeof mod.init === 'function') {
            mode = 'init';
            result = await Promise.resolve(mod.init(this.rootDir, payload, ctx));
        } else if (typeof mod === 'function') {
            mode = 'function';
            result = await Promise.resolve(mod(payload, ctx));
        }

        let safeResult = null;
        try {
            safeResult = result === undefined ? null : JSON.parse(JSON.stringify(result));
        } catch {
            safeResult = result === undefined ? null : String(result);
        }
        return {
            mode,
            result: safeResult
        };
    }

    /**
     * Handles incoming tasks from the mesh.
     */
    async handleRemoteTask(data, rinfo) {
        const taskID = String(data && data.taskID || '').trim();
        const engineName = String(data && data.engineName || '').trim();
        if (!taskID || !engineName) return;
        this.log(`Remote Task Request: ${taskID.slice(0, 8)} [${engineName}] from ${rinfo.address}`);

        try {
            const execution = this._isBuiltinTask(engineName)
                ? await this._runBuiltinTask(engineName, data.artifact)
                : await this._runEngineTask(engineName, data.artifact);

            this.ghostSync.sendPacket(rinfo.address, rinfo.port, {
                type: 'DRIFTER_TASK_RESULT',
                taskID,
                ok: true,
                node: this.ghostSync.machineID,
                engine: engineName,
                mode: execution.mode,
                result: execution.result
            });
        } catch (e) {
            const msg = String(e && e.message ? e.message : e);
            this.log(`Task Execution Error: ${msg}`);
            this.ghostSync.sendPacket(rinfo.address, rinfo.port, {
                type: 'DRIFTER_TASK_RESULT',
                taskID,
                ok: false,
                node: this.ghostSync.machineID,
                engine: engineName,
                error: msg
            });
        }
    }

    /**
     * Handles task results returning from the mesh.
     */
    handleTaskResult(data, rinfo) {
        const task = this.pendingTasks.get(data.taskID);
        if (task) {
            clearTimeout(task.timeout);
            this.pendingTasks.delete(data.taskID);
            if (data && data.ok === false) {
                const msg = String(data.error || `Task ${String(data.taskID || '').slice(0, 8)} failed on peer ${rinfo.address}`);
                this.log(`❌ Task ${String(data.taskID || '').slice(0, 8)} Error: ${msg}`);
                task.reject(new Error(msg));
                return;
            }
            this.log(`✅ Task ${String(data.taskID || '').slice(0, 8)} Result Received.`);
            task.resolve(data && Object.prototype.hasOwnProperty.call(data, 'result') ? data.result : data);
        }
    }
}

module.exports = Drifter;
