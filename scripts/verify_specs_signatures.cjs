"use strict";

const path = require("path");
const NeuralShield = require(path.join(__dirname, "..", "core", "neuralshield.js"));
const {
    assertFreshMetadata,
    loadTrustRoot,
    readJson,
    resolveMaxMetadataAgeDays,
    resolveThreshold,
    verifySignedMetadataFile
} = require("./feed_trust_utils.cjs");

const ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const SIGNATURES_PATH = path.join(DIST_DIR, "specs-manifest.signatures.json");

function main() {
    const trust = loadTrustRoot(ROOT, NeuralShield.ROOT_PUBLIC_KEY);
    const signatures = readJson(SIGNATURES_PATH, "specs_signatures");
    const maxAge = resolveMaxMetadataAgeDays(trust.policy);
    assertFreshMetadata(maxAge, "specs_signatures", signatures.generatedAt);

    const threshold = resolveThreshold(signatures, trust.policy);
    const result = verifySignedMetadataFile({
        channelDir: DIST_DIR,
        fileName: "specs-manifest.json",
        signaturesDoc: signatures,
        threshold,
        trust
    });

    console.log(`[specs:verify:signatures] threshold=${threshold}`);
    console.log(`[specs:verify:signatures] signers=${result.validSigners.join(",")}`);
    console.log("[specs:verify:signatures] status=OK");
}

try {
    main();
} catch (err) {
    console.error(`[specs:verify:signatures] FAIL: ${err.message}`);
    process.exit(1);
}
