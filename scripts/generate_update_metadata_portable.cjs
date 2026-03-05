"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");
const MANIFEST_PATH = path.join(DIST_DIR, "release-manifest.json");
const OUTPUT_PATH = path.join(DIST_DIR, "latest-portable.json");

function normalizeBaseUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function main() {
    if (!fs.existsSync(PACKAGE_JSON_PATH)) {
        throw new Error("package_json_missing");
    }
    if (!fs.existsSync(MANIFEST_PATH)) {
        throw new Error("missing_release_manifest");
    }

    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    const artifact = manifest && manifest.artifact ? manifest.artifact : null;
    if (!artifact || !artifact.file || !artifact.sha256) {
        throw new Error("invalid_release_manifest_artifact");
    }

    const channel = String(process.env.FORGE_RELEASE_CHANNEL || "stable");
    const baseUrl = normalizeBaseUrl(process.env.FORGE_DOWNLOAD_BASE_URL);
    const file = String(artifact.file);
    const relativePath = String(artifact.relativePath || `dist/${file}`).replace(/\\/g, "/");
    const url = baseUrl ? `${baseUrl}/${encodeURIComponent(file)}` : "";

    const payload = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        channel,
        app: {
            name: String(pkg.name || "forgecore-os"),
            version: String(pkg.version || "0.0.0")
        },
        artifact: {
            file,
            relativePath,
            bytes: Number(artifact.bytes || 0),
            sha256: String(artifact.sha256).toUpperCase(),
            url: url || null
        }
    };

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
    console.log(`[UPDATE] channel=${channel}`);
    console.log(`[UPDATE] artifact=${file}`);
    console.log(`[UPDATE] url=${url || "null"}`);
    console.log("[UPDATE] metadata=latest-portable.json");
}

try {
    main();
} catch (err) {
    console.error("[UPDATE] FAILED:", err && err.message ? err.message : err);
    process.exit(1);
}
