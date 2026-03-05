"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const NeuralShield = require(path.join(__dirname, "..", "core", "neuralshield.js"));
const { normalizeChannel, loadTrustRoot } = require("./feed_trust_utils.cjs");

const ROOT = path.resolve(__dirname, "..");
const SIGN_SCRIPT = path.join(__dirname, "sign_publish_channel.cjs");

function sanitizeForEnvSegment(keyId) {
    return String(keyId || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function readSigningPathMap() {
    const json = String(process.env.FORGE_SIGNING_KEY_MAP || "").trim();
    if (!json) return {};
    try {
        const parsed = JSON.parse(json);
        if (!parsed || typeof parsed !== "object") return {};
        return parsed;
    } catch {
        return {};
    }
}

function resolvePrivateKeyPath(keyId, signingPathMap) {
    const envDirect = process.env[`FORGE_SIGNING_KEY_PATH__${sanitizeForEnvSegment(keyId)}`];
    if (envDirect && String(envDirect).trim()) {
        return path.resolve(String(envDirect).trim());
    }

    if (signingPathMap && typeof signingPathMap[keyId] === "string" && signingPathMap[keyId].trim()) {
        return path.resolve(signingPathMap[keyId].trim());
    }

    if (keyId === "forgecore-architect-root") {
        return path.join(ROOT, "core", "architect.key");
    }

    return path.join(ROOT, "core", "keys", `${keyId}.key`);
}

function hasFeedRole(keyMeta) {
    const roles = Array.isArray(keyMeta && keyMeta.roles) ? keyMeta.roles : [];
    return roles.length === 0 || roles.includes("feed-metadata");
}

function runSigner(channel, keyId, keyPath) {
    const env = {
        ...process.env,
        FORGE_RELEASE_CHANNEL: channel,
        FORGE_SIGNING_KEY_ID: keyId,
        FORGE_SIGNING_KEY_PATH: keyPath
    };
    const result = spawnSync(process.execPath, [SIGN_SCRIPT], {
        cwd: ROOT,
        env,
        stdio: "inherit"
    });
    return result.status === 0;
}

function main() {
    const channel = normalizeChannel(process.env.FORGE_RELEASE_CHANNEL || "stable");
    const trust = loadTrustRoot(ROOT, NeuralShield.ROOT_PUBLIC_KEY);
    const signingPathMap = readSigningPathMap();

    const activeFeedKeys = Array.from(trust.keyMap.values())
        .filter((k) => String(k.status || "").toLowerCase() === "active")
        .filter((k) => !trust.revoked.has(k.keyId))
        .filter((k) => hasFeedRole(k));

    if (!activeFeedKeys.length) {
        throw new Error("no_active_feed_signers_in_trust_root");
    }

    const requiredSigners = new Set(
        Array.isArray(trust.policy.requiredSignerKeyIds) ? trust.policy.requiredSignerKeyIds : []
    );

    const orderedSigners = [
        ...activeFeedKeys.filter((k) => requiredSigners.has(k.keyId)),
        ...activeFeedKeys.filter((k) => !requiredSigners.has(k.keyId))
    ];

    const signedKeyIds = [];
    const missingRequired = [];
    for (const key of orderedSigners) {
        const keyId = key.keyId;
        const keyPath = resolvePrivateKeyPath(keyId, signingPathMap);
        const exists = fs.existsSync(keyPath);

        if (!exists) {
            if (requiredSigners.has(keyId)) {
                missingRequired.push(keyId);
            }
            console.log(`[COSIGN] skip_missing_private_key keyId=${keyId} path=${keyPath}`);
            continue;
        }

        console.log(`[COSIGN] signing keyId=${keyId} path=${keyPath}`);
        const ok = runSigner(channel, keyId, keyPath);
        if (!ok) {
            if (requiredSigners.has(keyId)) {
                throw new Error(`required_signer_failed:${keyId}`);
            }
            console.log(`[COSIGN] skip_failed_signer keyId=${keyId}`);
            continue;
        }
        signedKeyIds.push(keyId);
    }

    if (missingRequired.length) {
        throw new Error(`missing_required_private_keys:${missingRequired.join(",")}`);
    }
    for (const keyId of requiredSigners) {
        if (!signedKeyIds.includes(keyId)) {
            throw new Error(`required_signer_not_signed:${keyId}`);
        }
    }

    const threshold = Number(trust.policy.minimumSignatures || 1);
    if (signedKeyIds.length < threshold) {
        throw new Error(`threshold_not_met:signed=${signedKeyIds.length}:required=${threshold}`);
    }

    console.log(`[COSIGN] channel=${channel}`);
    console.log(`[COSIGN] signed=${signedKeyIds.join(",")}`);
    console.log(`[COSIGN] threshold=${threshold}`);
    console.log("[COSIGN] status=OK");
}

try {
    main();
} catch (err) {
    console.error("[COSIGN] FAILED:", err && err.message ? err.message : err);
    process.exit(1);
}
