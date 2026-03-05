"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");
const RELEASE_MANIFEST_PATH = path.join(DIST_DIR, "release-manifest.json");
const UPDATE_METADATA_PATH = path.join(DIST_DIR, "latest-portable.json");
const TRUST_ROOT_PATH = path.join(ROOT, "core", "trust_root.json");

function ensureFileExists(filePath, label) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`${label}_missing:${filePath}`);
    }
}

function readJson(filePath, label) {
    ensureFileExists(filePath, label);
    const raw = fs.readFileSync(filePath, "utf8");
    try {
        return JSON.parse(raw);
    } catch (err) {
        throw new Error(`${label}_invalid_json:${err && err.message ? err.message : err}`);
    }
}

function sha256File(filePath) {
    const hash = crypto.createHash("sha256");
    hash.update(fs.readFileSync(filePath));
    return hash.digest("hex").toUpperCase();
}

function copyFileVerified(src, dst, expectedSha256) {
    fs.copyFileSync(src, dst);
    if (expectedSha256) {
        const actual = sha256File(dst);
        const expected = String(expectedSha256).toUpperCase();
        if (actual !== expected) {
            throw new Error(`copy_hash_mismatch:expected=${expected}:actual=${actual}:dst=${dst}`);
        }
    }
}

function normalizeChannel(channel) {
    const fallback = "stable";
    const normalized = String(channel || fallback)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return normalized || fallback;
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function main() {
    const pkg = readJson(PACKAGE_JSON_PATH, "package_json");
    const releaseManifest = readJson(RELEASE_MANIFEST_PATH, "release_manifest");
    const updateMetadata = readJson(UPDATE_METADATA_PATH, "update_metadata");

    const packageName = String(pkg.name || releaseManifest.package && releaseManifest.package.name || "forgecore-os");
    const packageVersion = String(pkg.version || releaseManifest.package && releaseManifest.package.version || "0.0.0");
    const channel = normalizeChannel(process.env.FORGE_RELEASE_CHANNEL || updateMetadata.channel || "stable");

    const artifactFile = String(releaseManifest.artifact && releaseManifest.artifact.file || "");
    const artifactSha256 = String(releaseManifest.artifact && releaseManifest.artifact.sha256 || "").toUpperCase();
    const checksumFile = String(releaseManifest.checksumFile || "");

    if (!artifactFile || !/^[A-F0-9]{64}$/.test(artifactSha256) || !checksumFile) {
        throw new Error("release_manifest_missing_required_fields");
    }

    const artifactSrc = path.join(DIST_DIR, artifactFile);
    const checksumSrc = path.join(DIST_DIR, checksumFile);
    ensureFileExists(artifactSrc, "artifact");
    ensureFileExists(checksumSrc, "checksum");

    const publishRoot = path.join(DIST_DIR, "publish", channel);
    const versionDir = path.join(publishRoot, packageVersion);
    ensureDir(versionDir);

    const artifactDst = path.join(versionDir, artifactFile);
    const checksumDst = path.join(versionDir, checksumFile);
    const releaseManifestDst = path.join(versionDir, "release-manifest.json");

    copyFileVerified(artifactSrc, artifactDst, artifactSha256);
    fs.copyFileSync(checksumSrc, checksumDst);
    fs.copyFileSync(RELEASE_MANIFEST_PATH, releaseManifestDst);

    const trustRootDst = path.join(publishRoot, "trust-root.json");
    if (fs.existsSync(TRUST_ROOT_PATH)) {
        fs.copyFileSync(TRUST_ROOT_PATH, trustRootDst);
    }

    const downloadBaseUrl = String(process.env.FORGE_DOWNLOAD_BASE_URL || "").trim().replace(/\/+$/, "");
    const relativeArtifactPath = `${packageVersion}/${artifactFile}`.replace(/\\/g, "/");
    const relativeChecksumPath = `${packageVersion}/${checksumFile}`.replace(/\\/g, "/");
    const publishedArtifactUrl = downloadBaseUrl
        ? `${downloadBaseUrl}/${channel}/${encodeURIComponent(packageVersion)}/${encodeURIComponent(artifactFile)}`
        : `./${relativeArtifactPath}`;

    const publishedLatest = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        channel,
        app: {
            name: packageName,
            version: packageVersion
        },
        artifact: {
            file: artifactFile,
            relativePath: relativeArtifactPath,
            bytes: fs.statSync(artifactDst).size,
            sha256: artifactSha256,
            url: publishedArtifactUrl
        },
        checksum: {
            file: checksumFile,
            relativePath: relativeChecksumPath
        }
    };

    const latestPath = path.join(publishRoot, "latest-portable.json");
    fs.writeFileSync(latestPath, JSON.stringify(publishedLatest, null, 2) + "\n", "utf8");

    const indexPath = path.join(publishRoot, "index.json");
    const existingIndex = fs.existsSync(indexPath) ? readJson(indexPath, "publish_index") : null;
    const existingVersions = Array.isArray(existingIndex && existingIndex.versions) ? existingIndex.versions : [];

    const currentEntry = {
        version: packageVersion,
        releasedAt: new Date().toISOString(),
        artifact: {
            file: artifactFile,
            relativePath: relativeArtifactPath,
            sha256: artifactSha256
        },
        checksum: {
            file: checksumFile,
            relativePath: relativeChecksumPath
        }
    };

    const dedup = new Map();
    for (const item of existingVersions) {
        if (item && typeof item.version === "string" && item.version) {
            dedup.set(item.version, item);
        }
    }
    dedup.set(currentEntry.version, currentEntry);

    const versions = Array.from(dedup.values()).sort((a, b) => {
        const ta = Date.parse(String(a.releasedAt || 0));
        const tb = Date.parse(String(b.releasedAt || 0));
        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });

    const publishIndex = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        channel,
        latestVersion: packageVersion,
        latestMetadata: "latest-portable.json",
        versions
    };

    fs.writeFileSync(indexPath, JSON.stringify(publishIndex, null, 2) + "\n", "utf8");

    console.log(`[PUBLISH] channel=${channel}`);
    console.log(`[PUBLISH] version=${packageVersion}`);
    console.log(`[PUBLISH] artifact=${relativeArtifactPath}`);
    console.log(`[PUBLISH] latest=${path.relative(DIST_DIR, latestPath).replace(/\\/g, "/")}`);
    console.log(`[PUBLISH] index=${path.relative(DIST_DIR, indexPath).replace(/\\/g, "/")}`);
    if (fs.existsSync(trustRootDst)) {
        console.log(`[PUBLISH] trustRoot=${path.relative(DIST_DIR, trustRootDst).replace(/\\/g, "/")}`);
    }
}

try {
    main();
} catch (err) {
    console.error("[PUBLISH] FAILED:", err && err.message ? err.message : err);
    process.exit(1);
}
