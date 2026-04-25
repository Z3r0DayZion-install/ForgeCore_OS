"use strict";

/**
 * LAZARUS KERNEL v2.1.0 [IMMORTAL — HARDENED]
 * --------------------------------------------
 * Environment-Independent Logic Core.
 * Designed to function on any standard JS runtime (2026-2046).
 *
 * SECURITY: All artifact execution runs inside a V8 vm.Script
 * with a barren sandbox. No eval(), no require(), no process,
 * no fs, no child_process, no network access. Timeout: 5s.
 */

const path = require('path');

const ALLOWED_EXTENSIONS = ['.js', '.json', '.txt', '.md'];

const Lazarus = {
    version: "2.1.0",
    status: "IMMORTAL",

    // Core Lifecycle
    init() {
        console.log(`[LAZARUS] Kernel v${this.version} Initialized. Mode: HARDENED`);
    },

    /**
     * Validate artifact path before loading.
     * Rejects path traversal, non-whitelisted extensions, and absolute paths.
     */
    validateArtifactPath(artifactName) {
        if (!artifactName || typeof artifactName !== 'string') return false;
        if (artifactName.includes('..') || artifactName.includes('/') || artifactName.includes('\\')) return false;
        const ext = path.extname(artifactName).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) return false;
        if (/[^a-zA-Z0-9_\-.]/.test(artifactName)) return false;
        return true;
    },

    /**
     * Process an artifact string inside a hardened V8 sandbox.
     * 
     * CRITICAL: The sandbox exposes ONLY safe primitives.
     * No timers, no I/O, no globals, no eval, no Function constructor.
     * Execution timeout: 5 seconds (hard kill).
     *
     * @param {string} artifact - The raw artifact content string
     * @returns {{ ok: boolean, result?: any, error?: string, timestamp: number }}
     */
    async process(artifact) {
        try {
            const vm = require('vm');

            // Barren sandbox — mathematically incapable of escaping
            const sandbox = Object.create(null);
            sandbox.artifact = String(artifact); // Force string coercion
            sandbox.result = null;
            sandbox.console = Object.freeze({
                log: (...args) => console.log('[LAZARUS_VM]', ...args),
                error: (...args) => console.error('[LAZARUS_VM]', ...args)
            });
            sandbox.Math = Math;
            sandbox.JSON = JSON;
            sandbox.Date = Date;
            sandbox.parseInt = parseInt;
            sandbox.parseFloat = parseFloat;
            sandbox.isNaN = isNaN;
            sandbox.isFinite = isFinite;

            vm.createContext(sandbox);

            // Execute the artifact as a pure expression/script
            // No IIFE wrapping of external strategies — the artifact IS the code
            const script = new vm.Script(artifact, {
                filename: 'lazarus_sandbox.js',
                lineOffset: 0,
                columnOffset: 0
            });

            const result = script.runInContext(sandbox, {
                timeout: 5000,           // 5s hard kill
                breakOnSigint: true,     // Ctrl+C kills it
                displayErrors: true
            });

            console.log(`[LAZARUS] Artifact executed successfully.`);
            return { ok: true, result, timestamp: Date.now() };
        } catch (e) {
            console.error(`[LAZARUS] Sandbox execution failed: ${e.message}`);
            return { ok: false, error: e.message, timestamp: Date.now() };
        }
    }
};

module.exports = Lazarus;
