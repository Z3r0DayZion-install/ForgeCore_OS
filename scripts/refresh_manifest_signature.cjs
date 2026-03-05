"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(ROOT, "core", "manifest.json");
const PRIVATE_KEY_PATH = path.join(ROOT, "core", "architect.key");
const MUTABLE_PACKAGED_PATHS = new Set([
    "package.json"
]);

function sha256File(filePath) {
    const hash = crypto.createHash("sha256");
    hash.update(fs.readFileSync(filePath));
    return hash.digest("hex");
}

function main() {
    if (!fs.existsSync(MANIFEST_PATH)) {
        throw new Error("manifest_missing");
    }
    if (!fs.existsSync(PRIVATE_KEY_PATH)) {
        throw new Error("architect_private_key_missing");
    }

    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    if (!Array.isArray(manifest.files) || !manifest.files.length) {
        throw new Error("manifest_files_missing");
    }

    const updatedFiles = manifest.files
        .filter((entry) => !MUTABLE_PACKAGED_PATHS.has(String(entry.path || "").replace(/\\/g, "/")))
        .map((entry) => {
        const rel = String(entry.path || "").replace(/\\/g, "/");
        if (!rel || rel.includes("..")) {
            throw new Error(`invalid_manifest_path:${rel}`);
        }
        const abs = path.join(ROOT, rel);
        if (!fs.existsSync(abs)) {
            throw new Error(`manifest_file_missing:${rel}`);
        }
        return {
            path: rel,
            hash: sha256File(abs)
        };
    });

    manifest.files = updatedFiles;
    manifest.timestamp = new Date().toISOString();

    const dataToSign = JSON.stringify({
        version: manifest.version,
        timestamp: manifest.timestamp,
        files: manifest.files
    });
    const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, "utf8");
    const signature = crypto.sign(null, Buffer.from(dataToSign), privateKey).toString("hex");
    manifest.signature = signature;

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    console.log(`[MANIFEST] refreshed files=${manifest.files.length}`);
    console.log(`[MANIFEST] timestamp=${manifest.timestamp}`);
}

try {
    main();
} catch (err) {
    console.error("[MANIFEST] FAILED:", err && err.message ? err.message : err);
    process.exit(1);
}
