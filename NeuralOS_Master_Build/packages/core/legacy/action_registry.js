"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function normalizeMethod(method) {
    return String(method || "GET").trim().toUpperCase() || "GET";
}

function normalizeProbePath(route) {
    const text = String(route || "").trim();
    if (!text.startsWith("/")) return "";
    const q = text.indexOf("?");
    return q >= 0 ? text.slice(0, q) : text;
}

function readJson(filePath) {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
}

function computeHash(text) {
    return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

class ActionRegistry {
    constructor(contractPath) {
        this.contractPath = path.resolve(contractPath);
        this._cache = null;
    }

    _load() {
        const stat = fs.statSync(this.contractPath);
        if (this._cache && this._cache.mtimeMs === stat.mtimeMs) {
            return this._cache.payload;
        }

        const raw = fs.readFileSync(this.contractPath, "utf8");
        const parsed = JSON.parse(raw);
        const actions = parsed && parsed.actions && typeof parsed.actions === "object"
            ? parsed.actions
            : {};

        const normalizedActions = {};
        for (const [actionId, cfg] of Object.entries(actions)) {
            const uiOnly = !!(cfg && cfg.uiOnly);
            const probes = Array.isArray(cfg && cfg.probes) ? cfg.probes : [];
            normalizedActions[actionId] = {
                actionId,
                uiOnly,
                probes: probes.map((probe) => ({
                    id: String(probe && probe.id || `${actionId}:${normalizeMethod(probe && probe.method)}:${String(probe && probe.path || "")}`),
                    method: normalizeMethod(probe && probe.method),
                    path: String(probe && probe.path || ""),
                    normalizedPath: normalizeProbePath(probe && probe.path),
                    requiresAuth: probe && probe.requiresAuth === false ? false : true,
                    expectedStatus: Array.isArray(probe && probe.expectedStatus)
                        ? probe.expectedStatus.map((code) => Number(code)).filter((code) => Number.isFinite(code))
                        : []
                }))
            };
        }

        const payload = {
            schemaVersion: Number(parsed && parsed.schemaVersion || 1),
            actions: normalizedActions,
            actionCount: Object.keys(normalizedActions).length,
            contractHash: computeHash(raw)
        };
        this._cache = {
            mtimeMs: stat.mtimeMs,
            payload
        };
        return payload;
    }

    getContractSnapshot() {
        return this._load();
    }

    hasAction(actionId) {
        const contract = this._load();
        return Object.prototype.hasOwnProperty.call(contract.actions, String(actionId || ""));
    }

    getAction(actionId) {
        const contract = this._load();
        const key = String(actionId || "");
        return Object.prototype.hasOwnProperty.call(contract.actions, key)
            ? contract.actions[key]
            : null;
    }

    _isMutatingAction(action) {
        if (!action || action.uiOnly) return false;
        if (!Array.isArray(action.probes) || action.probes.length === 0) return false;
        return action.probes.some((probe) => {
            const method = normalizeMethod(probe && probe.method);
            return !(method === "GET" || method === "HEAD" || method === "OPTIONS");
        });
    }

    buildCapabilities(options = {}) {
        const contract = this._load();
        const uiLocked = !!options.uiLocked;
        const ghostMode = !!options.ghostMode;
        const witnessMode = String(options.witnessMode || "warn").toLowerCase();
        const witnessHealthy = options.witnessHealthy !== false;
        const allowWhenLocked = new Set(["unlock", "bootstrapPassphrase", "recoverPassphrase", "windowControl", "emergencyClose"]);
        const actions = {};

        for (const [actionId, action] of Object.entries(contract.actions)) {
            const requiresAuth = Array.isArray(action.probes)
                ? action.probes.some((probe) => probe && probe.requiresAuth !== false)
                : false;
            const mutating = this._isMutatingAction(action);
            const reasons = [];
            let enabled = true;

            if (uiLocked && requiresAuth && !allowWhenLocked.has(actionId)) {
                enabled = false;
                reasons.push("AUTH_LOCKED");
            }
            if (ghostMode && mutating) {
                enabled = false;
                reasons.push("GHOST_MODE_READ_ONLY");
            }
            if (witnessMode === "enforce" && !witnessHealthy && mutating) {
                enabled = false;
                reasons.push("WITNESS_QUORUM_ENFORCED");
            }

            actions[actionId] = {
                actionId,
                registered: true,
                uiOnly: !!action.uiOnly,
                enabled,
                reasons,
                requiresAuth,
                mutating,
                probes: action.probes
            };
        }

        return {
            schemaVersion: 1,
            generatedAt: new Date().toISOString(),
            contract: {
                schemaVersion: contract.schemaVersion,
                actionCount: contract.actionCount,
                hash: contract.contractHash,
                path: this.contractPath
            },
            policy: {
                uiLocked,
                ghostMode,
                witnessMode,
                witnessHealthy
            },
            actions
        };
    }
}

module.exports = ActionRegistry;
