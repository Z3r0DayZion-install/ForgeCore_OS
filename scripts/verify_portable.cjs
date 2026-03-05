"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const MANIFEST_PATH = path.join(DIST_DIR, "release-manifest.json");

function sha256File(filePath) {
    const hash = crypto.createHash("sha256");
    hash.update(fs.readFileSync(filePath));
    return hash.digest("hex").toUpperCase();
}

function parseChecksumLine(line) {
    const trimmed = String(line || "").trim();
    const m = /^([A-Fa-f0-9]{64})\s+\*(.+)$/.exec(trimmed);
    if (!m) return null;
    return {
        hash: m[1].toUpperCase(),
        file: m[2]
    };
}

function main() {
    if (!fs.existsSync(MANIFEST_PATH)) {
        throw new Error("missing_release_manifest");
    }

    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    const artifactFile = manifest && manifest.artifact ? manifest.artifact.file : "";
    const expectedHash = manifest && manifest.artifact ? String(manifest.artifact.sha256 || "").toUpperCase() : "";
    const expectedBytes = Number(manifest && manifest.artifact ? manifest.artifact.bytes : 0);
    const checksumFile = String(manifest.checksumFile || "");

    if (!artifactFile || !expectedHash || !/^[A-F0-9]{64}$/.test(expectedHash)) {
        throw new Error("invalid_manifest_artifact");
    }
    if (!checksumFile) {
        throw new Error("invalid_manifest_checksum_file");
    }

    const artifactPath = path.join(DIST_DIR, artifactFile);
    const checksumPath = path.join(DIST_DIR, checksumFile);

    if (!fs.existsSync(artifactPath)) {
        throw new Error(`artifact_missing:${artifactFile}`);
    }
    if (!fs.existsSync(checksumPath)) {
        throw new Error(`checksum_missing:${checksumFile}`);
    }

    const stat = fs.statSync(artifactPath);
    if (expectedBytes > 0 && stat.size !== expectedBytes) {
        throw new Error(`artifact_size_mismatch:expected=${expectedBytes}:actual=${stat.size}`);
    }

    const actualHash = sha256File(artifactPath);
    if (actualHash !== expectedHash) {
        throw new Error(`artifact_hash_mismatch:expected=${expectedHash}:actual=${actualHash}`);
    }

    const checksumRaw = fs.readFileSync(checksumPath, "utf8")
        .split(/\r?\n/)
        .map((line) => parseChecksumLine(line))
        .filter(Boolean);
    if (!checksumRaw.length) {
        throw new Error("checksum_file_empty_or_invalid");
    }
    const entry = checksumRaw.find((x) => x.file === artifactFile);
    if (!entry) {
        throw new Error("checksum_entry_not_found_for_artifact");
    }
    if (entry.hash !== actualHash) {
        throw new Error(`checksum_hash_mismatch:expected=${actualHash}:file=${entry.hash}`);
    }

    console.log(`[VERIFY] artifact=${artifactFile}`);
    console.log(`[VERIFY] bytes=${stat.size}`);
    console.log(`[VERIFY] sha256=${actualHash}`);
    console.log("[VERIFY] status=OK");
}

try {
    main();
} catch (err) {
    console.error("[VERIFY] FAILED:", err && err.message ? err.message : err);
    process.exit(1);
}
