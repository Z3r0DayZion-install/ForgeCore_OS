"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const NeuralShield = require(path.join(ROOT, "core", "neuralshield.js"));
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

function verifyMetadataLinkage(channelDir, latest, index) {
    const latestVersion = String(latest && latest.app && latest.app.version || "");
    const indexLatestVersion = String(index && index.latestVersion || "");
    if (!latestVersion || !indexLatestVersion || latestVersion !== indexLatestVersion) {
        throw new Error(`latest_version_mismatch:latest=${latestVersion}:index=${indexLatestVersion}`);
    }

    const artifact = latest && latest.artifact ? latest.artifact : null;
    if (!artifact || !artifact.relativePath || !artifact.sha256) {
        throw new Error("latest_metadata_missing_artifact");
    }

    const relPath = assertSafeRelativePath(artifact.relativePath, "latest_metadata");
    const expectedSha = String(artifact.sha256).toUpperCase();
    if (!/^[A-F0-9]{64}$/.test(expectedSha)) {
        throw new Error(`latest_metadata_invalid_sha:${expectedSha}`);
    }

    const artifactPath = path.join(channelDir, relPath);
    ensureFile(artifactPath, "published_artifact");
    const actualSha = sha256File(artifactPath);
    if (actualSha !== expectedSha) {
        throw new Error(`published_artifact_hash_mismatch:expected=${expectedSha}:actual=${actualSha}`);
    }

    const versions = Array.isArray(index && index.versions) ? index.versions : [];
    const matching = versions.find((v) => String(v && v.version || "") === latestVersion);
    if (!matching) {
        throw new Error(`index_missing_latest_version:${latestVersion}`);
    }
    const idxRel = String(matching.artifact && matching.artifact.relativePath || "").replace(/\\/g, "/");
    const idxSha = String(matching.artifact && matching.artifact.sha256 || "").toUpperCase();
    if (idxRel !== relPath || idxSha !== expectedSha) {
        throw new Error("index_latest_artifact_mismatch");
    }
}

function main() {
    const channel = normalizeChannel(process.env.FORGE_RELEASE_CHANNEL || "stable");
    const channelDir = path.join(DIST_DIR, "publish", channel);
    const latestPath = path.join(channelDir, "latest-portable.json");
    const indexPath = path.join(channelDir, "index.json");
    const trustRootSnapshotPath = path.join(channelDir, "trust-root.json");
    const signaturesPath = path.join(channelDir, "signatures.json");
    const trust = loadTrustRoot(ROOT, NeuralShield.ROOT_PUBLIC_KEY);
    assertChannelAllowed(channel, trust.policy);

    const latest = readJson(latestPath, "latest_metadata");
    const index = readJson(indexPath, "index_metadata");
    const signatures = readJson(signaturesPath, "signatures");
    const maxMetadataAgeDays = resolveMaxMetadataAgeDays(trust.policy);
    assertFreshMetadata(maxMetadataAgeDays, "latest_metadata", latest.generatedAt);
    assertFreshMetadata(maxMetadataAgeDays, "index_metadata", index.generatedAt);
    assertFreshMetadata(maxMetadataAgeDays, "signatures_metadata", signatures.generatedAt);

    const threshold = resolveThreshold(signatures, trust.policy);
    const latestSig = verifySignedMetadataFile({
        channelDir,
        fileName: "latest-portable.json",
        signaturesDoc: signatures,
        trust,
        threshold
    });
    const indexSig = verifySignedMetadataFile({
        channelDir,
        fileName: "index.json",
        signaturesDoc: signatures,
        trust,
        threshold
    });
    let trustRootSig = null;
    if (fs.existsSync(trustRootSnapshotPath)) {
        trustRootSig = verifySignedMetadataFile({
            channelDir,
            fileName: "trust-root.json",
            signaturesDoc: signatures,
            trust,
            threshold
        });
    }
    verifyMetadataLinkage(channelDir, latest, index);

    console.log(`[PUBVERIFY] channel=${channel}`);
    console.log(`[PUBVERIFY] threshold=${threshold}`);
    console.log(`[PUBVERIFY] latestSigners=${latestSig.validSigners.join(",")}`);
    console.log(`[PUBVERIFY] indexSigners=${indexSig.validSigners.join(",")}`);
    if (trustRootSig) {
        console.log(`[PUBVERIFY] trustRootSigners=${trustRootSig.validSigners.join(",")}`);
    }
    console.log(`[PUBVERIFY] latestVersion=${String(latest.app && latest.app.version || "unknown")}`);
    console.log(`[PUBVERIFY] trustRoot=${trust.path}`);
    console.log("[PUBVERIFY] status=OK");
}

try {
    main();
} catch (err) {
    console.error("[PUBVERIFY] FAILED:", err && err.message ? err.message : err);
    process.exit(1);
}
