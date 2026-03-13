"use strict";

const fs = require("fs");
const path = require("path");

const migrationModules = [
    require("./migrations/20260306_001_seed_state_layout"),
    require("./migrations/20260306_002_backfill_state_manifest")
];

class StateMigrations {
    constructor(stateRoot) {
        this.stateRoot = path.resolve(stateRoot);
        this.metaPath = path.join(this.stateRoot, ".state_schema.json");
        this.migrations = migrationModules
            .map((entry) => ({
                id: String(entry && entry.id ? entry.id : "").trim(),
                description: String(entry && entry.description ? entry.description : "").trim(),
                up: entry && typeof entry.up === "function" ? entry.up : null
            }))
            .filter((entry) => entry.id && entry.up)
            .sort((a, b) => a.id.localeCompare(b.id));
    }

    _ensureStateRoot() {
        if (!fs.existsSync(this.stateRoot)) {
            fs.mkdirSync(this.stateRoot, { recursive: true });
        }
    }

    _readMeta() {
        this._ensureStateRoot();
        if (!fs.existsSync(this.metaPath)) {
            return {
                schemaVersion: 0,
                applied: [],
                updatedAt: null
            };
        }
        try {
            const parsed = JSON.parse(fs.readFileSync(this.metaPath, "utf8"));
            return {
                schemaVersion: Number(parsed && parsed.schemaVersion ? parsed.schemaVersion : 0),
                applied: Array.isArray(parsed && parsed.applied) ? parsed.applied.map(String) : [],
                updatedAt: parsed && parsed.updatedAt ? String(parsed.updatedAt) : null
            };
        } catch {
            return {
                schemaVersion: 0,
                applied: [],
                updatedAt: null
            };
        }
    }

    _writeMeta(meta) {
        const payload = {
            schemaVersion: Number(meta && meta.schemaVersion ? meta.schemaVersion : 0),
            applied: Array.isArray(meta && meta.applied) ? meta.applied.map(String) : [],
            updatedAt: new Date().toISOString()
        };
        fs.writeFileSync(this.metaPath, JSON.stringify(payload, null, 2), "utf8");
        return payload;
    }

    current() {
        const meta = this._readMeta();
        return {
            schemaVersion: meta.schemaVersion,
            appliedCount: meta.applied.length,
            applied: meta.applied.slice(),
            totalKnownMigrations: this.migrations.length
        };
    }

    applyPending() {
        const meta = this._readMeta();
        const appliedSet = new Set(meta.applied);
        const executed = [];

        for (const migration of this.migrations) {
            if (appliedSet.has(migration.id)) continue;

            migration.up({
                stateRoot: this.stateRoot,
                fs,
                path
            });

            appliedSet.add(migration.id);
            executed.push({
                id: migration.id,
                description: migration.description
            });
        }

        const applied = [...appliedSet].sort((a, b) => a.localeCompare(b));
        const nextMeta = this._writeMeta({
            schemaVersion: applied.length,
            applied
        });

        return {
            appliedCount: executed.length,
            applied: executed,
            schemaVersion: nextMeta.schemaVersion,
            totalKnownMigrations: this.migrations.length
        };
    }
}

module.exports = StateMigrations;
