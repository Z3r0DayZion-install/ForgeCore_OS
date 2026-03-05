"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const NeuralShield = require(path.join(__dirname, "..", "core", "neuralshield.js"));
const {
    normalizeChannel,
    ensureFile,
    readJson,
    sha256File,
    assertSafeRelativePath,
    assertFreshMetadata,
    loadTrustRoot,
    resolveThreshold,
    resolveMaxMetadataAgeDays,
    assertChannelAllowed,
    verifySignedMetadataFile
} = require("./feed_trust_utils.cjs");

const ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
    const out = {
        verifyOnly: false,
        launch: false,
        allowDowngrade: false
    };
    for (let i = 0; i < argv.length; i++) {
        const token = String(argv[i] || "");
        if (token === "--verify-only") out.verifyOnly = true;
        else if (token === "--launch") out.launch = true;
        else if (token === "--allow-downgrade") out.allowDowngrade = true;
        else if (token === "--channel") out.channel = String(argv[++i] || "");
        else if (token === "--feed-root") out.feedRoot = String(argv[++i] || "");
        else if (token === "--target-root") out.targetRoot = String(argv[++i] || "");
    }
    return out;
}

function defaultFeedRoot() {
    const userHome = process.env.USERPROFILE || process.env.HOME || "C:\\Users\\KickA";
    return path.join(userHome, "PROJECT_VAULT", "ForgeCore_Publish");
}

function defaultTargetRoot() {
    return path.join(os.homedir(), "Downloads", "ForgeCore_Install");
}

function verifyChecksumEntry(checksumPath, artifactFileName, expectedSha) {
    ensureFile(checksumPath, "checksum_file");
    const lines = fs.readFileSync(checksumPath, "utf8").split(/\r?\n/);
    const row = lines
        .map((line) => /^([A-Fa-f0-9]{64})\s+\*(.+)$/.exec(String(line).trim()))
        .find(Boolean);
    if (!row) {
        throw new Error("checksum_file_invalid");
    }
    const hash = String(row[1]).toUpperCase();
    const file = String(row[2]);
    if (file !== artifactFileName) {
        throw new Error("checksum_artifact_name_mismatch");
    }
    if (hash !== expectedSha) {
        throw new Error("checksum_artifact_hash_mismatch");
    }
}

function writeReceipt(targetDir, payload) {
    fs.mkdirSync(targetDir, { recursive: true });
    const receiptPath = path.join(targetDir, "INSTALL_RECEIPT.json");
    fs.writeFileSync(receiptPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
    return receiptPath;
}

function parseSemver(input) {
    const raw = String(input || "").trim();
    const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(raw);
    if (!m) return null;
    return {
        major: Number(m[1]),
        minor: Number(m[2]),
        patch: Number(m[3]),
        prerelease: m[4] ? m[4].split(".") : []
    };
}

function compareSemver(a, b) {
    const av = parseSemver(a);
    const bv = parseSemver(b);
    if (!av || !bv) return null;

    if (av.major !== bv.major) return av.major > bv.major ? 1 : -1;
    if (av.minor !== bv.minor) return av.minor > bv.minor ? 1 : -1;
    if (av.patch !== bv.patch) return av.patch > bv.patch ? 1 : -1;

    const ap = av.prerelease;
    const bp = bv.prerelease;
    if (!ap.length && !bp.length) return 0;
    if (!ap.length && bp.length) return 1;
    if (ap.length && !bp.length) return -1;

    const len = Math.max(ap.length, bp.length);
    for (let i = 0; i < len; i++) {
        const ax = ap[i];
        const bx = bp[i];
        if (ax === undefined) return -1;
        if (bx === undefined) return 1;
        if (ax === bx) continue;

        const an = /^\d+$/.test(ax) ? Number(ax) : null;
        const bn = /^\d+$/.test(bx) ? Number(bx) : null;
        if (an !== null && bn !== null) return an > bn ? 1 : -1;
        if (an !== null && bn === null) return -1;
        if (an === null && bn !== null) return 1;
        return ax > bx ? 1 : -1;
    }
    return 0;
}

function readInstallState(statePath, channel) {
    if (!fs.existsSync(statePath)) {
        return {
            schemaVersion: 1,
            channel,
            lastInstalledVersion: null,
            lastInstalledAt: null,
            history: []
        };
    }
    const state = readJson(statePath, "install_state");
    const history = Array.isArray(state.history) ? state.history : [];
    return {
        schemaVersion: 1,
        channel,
        lastInstalledVersion: state.lastInstalledVersion ? String(state.lastInstalledVersion) : null,
        lastInstalledAt: state.lastInstalledAt ? String(state.lastInstalledAt) : null,
        history: history
            .filter((row) => row && typeof row.version === "string")
            .slice(0, 50)
    };
}

function writeInstallState(statePath, state) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf8");
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const channel = normalizeChannel(args.channel || process.env.FORGE_RELEASE_CHANNEL || "stable");
    const feedRoot = path.resolve(args.feedRoot || process.env.FORGE_FEED_ROOT || defaultFeedRoot());
    const targetRoot = path.resolve(args.targetRoot || process.env.FORGE_INSTALL_TARGET_ROOT || defaultTargetRoot());
    const feedChannelDir = path.join(feedRoot, channel);
    const allowDowngrade = args.allowDowngrade || String(process.env.FORGE_ALLOW_DOWNGRADE || "") === "1";

    const trust = loadTrustRoot(ROOT, NeuralShield.ROOT_PUBLIC_KEY);
    assertChannelAllowed(channel, trust.policy);
    const maxMetadataAgeDays = resolveMaxMetadataAgeDays(trust.policy);

    const latestPath = path.join(feedChannelDir, "latest-portable.json");
    const indexPath = path.join(feedChannelDir, "index.json");
    const trustRootSnapshotPath = path.join(feedChannelDir, "trust-root.json");
    const signaturesPath = path.join(feedChannelDir, "signatures.json");

    const latest = readJson(latestPath, "latest_metadata");
    const index = readJson(indexPath, "index_metadata");
    const signatures = readJson(signaturesPath, "signatures_metadata");

    const effectiveThreshold = resolveThreshold(signatures, trust.policy);
    const latestSig = verifySignedMetadataFile({
        channelDir: feedChannelDir,
        fileName: "latest-portable.json",
        signaturesDoc: signatures,
        trust,
        threshold: effectiveThreshold
    });
    const indexSig = verifySignedMetadataFile({
        channelDir: feedChannelDir,
        fileName: "index.json",
        signaturesDoc: signatures,
        trust,
        threshold: effectiveThreshold
    });
    let trustRootSig = null;
    if (fs.existsSync(trustRootSnapshotPath)) {
        trustRootSig = verifySignedMetadataFile({
            channelDir: feedChannelDir,
            fileName: "trust-root.json",
            signaturesDoc: signatures,
            trust,
            threshold: effectiveThreshold
        });
        if (fs.existsSync(trust.path)) {
            const localTrustHash = sha256File(trust.path);
            const snapshotTrustHash = sha256File(trustRootSnapshotPath);
            const allowTrustRootMismatch = String(process.env.FORGE_ALLOW_TRUST_ROOT_MISMATCH || "") === "1";
            if (localTrustHash !== snapshotTrustHash && !allowTrustRootMismatch) {
                throw new Error(`trust_root_snapshot_mismatch:local=${localTrustHash}:snapshot=${snapshotTrustHash}`);
            }
        }
    }

    assertFreshMetadata(maxMetadataAgeDays, "latest_metadata", latest.generatedAt);
    assertFreshMetadata(maxMetadataAgeDays, "index_metadata", index.generatedAt);
    assertFreshMetadata(maxMetadataAgeDays, "signatures_metadata", signatures.generatedAt);

    const appVersion = String(latest && latest.app && latest.app.version || "");
    const indexLatest = String(index && index.latestVersion || "");
    if (!appVersion || !indexLatest || appVersion !== indexLatest) {
        throw new Error(`latest_version_mismatch:latest=${appVersion}:index=${indexLatest}`);
    }

    const artifact = latest && latest.artifact ? latest.artifact : null;
    if (!artifact || !artifact.file || !artifact.relativePath || !artifact.sha256) {
        throw new Error("latest_artifact_missing_fields");
    }

    const artifactFile = String(artifact.file);
    const artifactRel = assertSafeRelativePath(artifact.relativePath, "artifact");
    const artifactSha = String(artifact.sha256).toUpperCase();
    if (!/^[A-F0-9]{64}$/.test(artifactSha)) {
        throw new Error("latest_artifact_invalid_sha");
    }

    const artifactSource = path.join(feedChannelDir, artifactRel);
    ensureFile(artifactSource, "artifact");
    const artifactActualSha = sha256File(artifactSource);
    if (artifactActualSha !== artifactSha) {
        throw new Error("artifact_hash_mismatch");
    }

    const matchingVersion = Array.isArray(index.versions)
        ? index.versions.find((row) => String(row && row.version || "") === appVersion)
        : null;
    if (!matchingVersion) {
        throw new Error(`index_missing_version:${appVersion}`);
    }

    const indexArtifactRel = assertSafeRelativePath(
        matchingVersion && matchingVersion.artifact && matchingVersion.artifact.relativePath,
        "index_artifact"
    );
    const indexArtifactSha = String(
        matchingVersion && matchingVersion.artifact && matchingVersion.artifact.sha256 || ""
    ).toUpperCase();
    if (indexArtifactRel !== artifactRel || indexArtifactSha !== artifactSha) {
        throw new Error("index_latest_artifact_mismatch");
    }

    const checksumRel = matchingVersion && matchingVersion.checksum
        ? assertSafeRelativePath(matchingVersion.checksum.relativePath, "checksum")
        : "";
    if (checksumRel) {
        const checksumPath = path.join(feedChannelDir, checksumRel);
        verifyChecksumEntry(checksumPath, artifactFile, artifactSha);
    }

    const channelTargetDir = path.join(targetRoot, channel);
    const statePath = path.join(channelTargetDir, "INSTALL_STATE.json");
    const installState = readInstallState(statePath, channel);
    const priorVersion = installState.lastInstalledVersion;
    if (priorVersion) {
        const cmp = compareSemver(appVersion, priorVersion);
        if (cmp === null && !allowDowngrade) {
            throw new Error(`rollback_check_failed_unparseable_version:new=${appVersion}:old=${priorVersion}`);
        }
        if (cmp !== null && cmp < 0 && !allowDowngrade) {
            throw new Error(`rollback_blocked:new=${appVersion}:installed=${priorVersion}`);
        }
    }

    const versionTarget = path.join(targetRoot, channel, appVersion);
    const stagedArtifactPath = path.join(versionTarget, artifactFile);
    const receipt = {
        schemaVersion: 1,
        completedAt: new Date().toISOString(),
        channel,
        version: appVersion,
        feedRoot,
        feedChannelDir,
        verifyOnly: Boolean(args.verifyOnly),
        allowDowngrade,
        priorVersion,
        trust: {
            trustRootPath: trust.path,
            threshold: effectiveThreshold,
            latestSigners: latestSig.validSigners,
            indexSigners: indexSig.validSigners,
            trustRootSigners: trustRootSig ? trustRootSig.validSigners : []
        },
        policy: {
            rollbackProtection: true,
            maxMetadataAgeDays: Number.isFinite(maxMetadataAgeDays) && maxMetadataAgeDays > 0
                ? maxMetadataAgeDays
                : null
        },
        artifact: {
            file: artifactFile,
            source: artifactSource,
            target: stagedArtifactPath,
            sha256: artifactSha
        }
    };

    if (!args.verifyOnly) {
        fs.mkdirSync(versionTarget, { recursive: true });
        fs.copyFileSync(artifactSource, stagedArtifactPath);
        const stagedHash = sha256File(stagedArtifactPath);
        if (stagedHash !== artifactSha) {
            throw new Error("staged_artifact_hash_mismatch");
        }
        const nextHistory = [
            {
                version: appVersion,
                installedAt: receipt.completedAt,
                artifactSha256: artifactSha
            },
            ...installState.history.filter((row) => String(row.version) !== appVersion)
        ].slice(0, 25);
        writeInstallState(statePath, {
            schemaVersion: 1,
            channel,
            lastInstalledVersion: appVersion,
            lastInstalledAt: receipt.completedAt,
            history: nextHistory
        });
        receipt.deployed = true;
    } else {
        receipt.deployed = false;
    }

    const receiptPath = writeReceipt(versionTarget, receipt);
    console.log(`[INSTALL] channel=${channel}`);
    console.log(`[INSTALL] version=${appVersion}`);
    console.log(`[INSTALL] verifyOnly=${String(args.verifyOnly)}`);
    console.log(`[INSTALL] priorVersion=${priorVersion || "none"}`);
    console.log(`[INSTALL] threshold=${effectiveThreshold}`);
    console.log(`[INSTALL] latestSigners=${latestSig.validSigners.join(",")}`);
    console.log(`[INSTALL] indexSigners=${indexSig.validSigners.join(",")}`);
    if (trustRootSig) {
        console.log(`[INSTALL] trustRootSigners=${trustRootSig.validSigners.join(",")}`);
    }
    console.log(`[INSTALL] artifact=${artifactFile}`);
    console.log(`[INSTALL] sha256=${artifactSha}`);
    console.log(`[INSTALL] target=${versionTarget}`);
    console.log(`[INSTALL] state=${statePath}`);
    console.log(`[INSTALL] receipt=${receiptPath}`);

    if (!args.verifyOnly && args.launch) {
        spawn(stagedArtifactPath, [], {
            detached: true,
            windowsHide: true,
            stdio: "ignore"
        }).unref();
        console.log("[INSTALL] launch=started");
    }
}

try {
    main();
} catch (err) {
    console.error("[INSTALL] FAILED:", err && err.message ? err.message : err);
    process.exit(1);
}
