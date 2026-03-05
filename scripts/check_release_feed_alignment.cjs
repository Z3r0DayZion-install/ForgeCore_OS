"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");

function parseArgs(argv) {
    const out = {
        channel: "",
        distOnly: false,
        feedRoot: "",
        requireDeployed: false
    };
    for (let i = 0; i < argv.length; i += 1) {
        const token = String(argv[i] || "");
        if (token === "--channel") out.channel = String(argv[++i] || "");
        else if (token === "--feed-root") out.feedRoot = String(argv[++i] || "");
        else if (token === "--dist-only") out.distOnly = true;
        else if (token === "--require-deployed") out.requireDeployed = true;
    }
    return out;
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

function defaultFeedRoot() {
    const home = process.env.USERPROFILE || process.env.HOME || "C:\\Users\\KickA";
    return path.join(home, "PROJECT_VAULT", "ForgeCore_Publish");
}

function readJson(absPath, label) {
    if (!fs.existsSync(absPath)) {
        throw new Error(`${label}_missing:${absPath}`);
    }
    try {
        return JSON.parse(fs.readFileSync(absPath, "utf8"));
    } catch (err) {
        throw new Error(`${label}_invalid_json:${err.message}`);
    }
}

function assertEq(actual, expected, label) {
    if (String(actual) !== String(expected)) {
        throw new Error(`mismatch:${label}:expected=${expected}:actual=${actual}`);
    }
}

function findVersionEntry(indexDoc, version) {
    const rows = Array.isArray(indexDoc && indexDoc.versions) ? indexDoc.versions : [];
    return rows.find((row) => String(row && row.version || "") === String(version || "")) || null;
}

function checkPublishChannel(publishDir, expected, labelPrefix) {
    const latestPath = path.join(publishDir, "latest-portable.json");
    const indexPath = path.join(publishDir, "index.json");
    const latest = readJson(latestPath, `${labelPrefix}_latest`);
    const index = readJson(indexPath, `${labelPrefix}_index`);

    const latestVersion = String(latest && latest.app && latest.app.version || "");
    assertEq(latestVersion, expected.version, `${labelPrefix}.latest.version`);
    assertEq(String(index && index.latestVersion || ""), expected.version, `${labelPrefix}.index.latestVersion`);

    const latestArtifact = latest && latest.artifact ? latest.artifact : {};
    assertEq(String(latestArtifact.file || ""), expected.file, `${labelPrefix}.latest.artifact.file`);
    assertEq(String(latestArtifact.sha256 || "").toUpperCase(), expected.sha256, `${labelPrefix}.latest.artifact.sha256`);

    const versionEntry = findVersionEntry(index, expected.version);
    if (!versionEntry) {
        throw new Error(`missing:${labelPrefix}.index.version:${expected.version}`);
    }
    const idxArtifact = versionEntry.artifact || {};
    assertEq(String(idxArtifact.file || ""), expected.file, `${labelPrefix}.index.artifact.file`);
    assertEq(String(idxArtifact.sha256 || "").toUpperCase(), expected.sha256, `${labelPrefix}.index.artifact.sha256`);

    return {
        indexPath,
        latestPath,
        latestVersion
    };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const channel = normalizeChannel(args.channel || process.env.FORGE_RELEASE_CHANNEL || "stable");
    const releaseManifestPath = path.join(DIST_DIR, "release-manifest.json");
    const releaseManifest = readJson(releaseManifestPath, "dist_release_manifest");
    const expected = {
        file: String(releaseManifest && releaseManifest.artifact && releaseManifest.artifact.file || ""),
        sha256: String(releaseManifest && releaseManifest.artifact && releaseManifest.artifact.sha256 || "").toUpperCase(),
        version: String(releaseManifest && releaseManifest.package && releaseManifest.package.version || "")
    };

    if (!expected.file || !expected.version || !/^[A-F0-9]{64}$/.test(expected.sha256)) {
        throw new Error("dist_release_manifest_missing_required_fields");
    }

    const distPublishDir = path.join(DIST_DIR, "publish", channel);
    if (!fs.existsSync(distPublishDir)) {
        throw new Error(`dist_publish_channel_missing:${distPublishDir}`);
    }

    const distCheck = checkPublishChannel(distPublishDir, expected, "dist_publish");
    const distVersionManifestPath = path.join(distPublishDir, expected.version, "release-manifest.json");
    const distVersionManifest = readJson(distVersionManifestPath, "dist_publish_version_manifest");
    assertEq(
        String(distVersionManifest && distVersionManifest.artifact && distVersionManifest.artifact.sha256 || "").toUpperCase(),
        expected.sha256,
        "dist_publish.version_manifest.sha256"
    );

    const report = {
        schemaVersion: 1,
        channel,
        dist: {
            publishDir: distPublishDir,
            releaseManifestPath,
            sha256: expected.sha256,
            version: expected.version
        },
        checks: {
            distPublish: {
                latestPath: distCheck.latestPath,
                indexPath: distCheck.indexPath,
                status: "OK"
            }
        }
    };

    if (!args.distOnly) {
        const feedRoot = path.resolve(args.feedRoot || process.env.FORGE_FEED_ROOT || defaultFeedRoot());
        const deployedDir = path.join(feedRoot, channel);
        if (!fs.existsSync(deployedDir)) {
            if (args.requireDeployed) {
                throw new Error(`deployed_feed_missing:${deployedDir}`);
            }
            report.checks.deployedPublish = {
                path: deployedDir,
                status: "SKIPPED_MISSING"
            };
        } else {
            const deployedCheck = checkPublishChannel(deployedDir, expected, "deployed_publish");
            report.checks.deployedPublish = {
                latestPath: deployedCheck.latestPath,
                indexPath: deployedCheck.indexPath,
                status: "OK"
            };
        }
    }

    const outPath = path.join(DIST_DIR, "release-feed-alignment.json");
    fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`[align] channel=${channel}`);
    console.log(`[align] version=${expected.version}`);
    console.log(`[align] sha256=${expected.sha256}`);
    console.log(`[align] report=${outPath}`);
    console.log("[align] status=OK");
}

try {
    main();
} catch (err) {
    console.error(`[align] FAIL: ${err.message}`);
    process.exit(1);
}
