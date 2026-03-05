"use strict";

const path = require("path");
const NeuralShield = require(path.join(__dirname, "..", "core", "neuralshield.js"));
const { loadTrustRoot } = require("./feed_trust_utils.cjs");

const ROOT = path.resolve(__dirname, "..");

function main() {
    const trust = loadTrustRoot(ROOT, NeuralShield.ROOT_PUBLIC_KEY);
    const activeFeedKeys = Array.from(trust.keyMap.values())
        .filter((k) => String(k.status || "").toLowerCase() === "active")
        .filter((k) => !trust.revoked.has(k.keyId))
        .filter((k) => !Array.isArray(k.roles) || k.roles.length === 0 || k.roles.includes("feed-metadata"));

    if (!activeFeedKeys.length) {
        throw new Error("no_active_feed_metadata_keys");
    }

    const threshold = Number(trust.policy.minimumSignatures || 1);
    if (threshold > activeFeedKeys.length) {
        throw new Error(`threshold_exceeds_active_keys:threshold=${threshold}:active=${activeFeedKeys.length}`);
    }

    const requiredSigners = Array.isArray(trust.policy.requiredSignerKeyIds)
        ? trust.policy.requiredSignerKeyIds
        : [];
    for (const keyId of requiredSigners) {
        const key = trust.keyMap.get(keyId);
        if (!key || trust.revoked.has(keyId) || String(key.status || "").toLowerCase() !== "active") {
            throw new Error(`required_signer_not_active:${keyId}`);
        }
    }

    console.log(`[TRUST] path=${trust.path}`);
    console.log(`[TRUST] keys=${trust.keyMap.size}`);
    console.log(`[TRUST] activeFeedKeys=${activeFeedKeys.length}`);
    console.log(`[TRUST] revoked=${trust.revoked.size}`);
    console.log(`[TRUST] minimumSignatures=${threshold}`);
    console.log(`[TRUST] allowedChannels=${trust.policy.allowedChannels.join(",") || "any"}`);
    console.log(`[TRUST] requiredSigners=${requiredSigners.join(",") || "none"}`);
    console.log("[TRUST] status=OK");
}

try {
    main();
} catch (err) {
    console.error("[TRUST] FAILED:", err && err.message ? err.message : err);
    process.exit(1);
}
