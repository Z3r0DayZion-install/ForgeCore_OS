"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const NeuralShield = require(path.join(__dirname, "..", "core", "neuralshield.js"));
const {
    normalizeChannel,
    ensureFile,
    readJson,
    sha256File,
    parseSignatureList,
    dedupeSignaturesByKeyId,
    loadTrustRoot,
    resolveThreshold
} = require("./feed_trust_utils.cjs");

const ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const PRIVATE_KEY_PATH = path.join(ROOT, "core", "architect.key");

function signBuffer(privateKey, buffer) {
    return crypto.sign(null, buffer, privateKey).toString("hex");
}

function main() {
    const channel = normalizeChannel(process.env.FORGE_RELEASE_CHANNEL || "stable");
    const signerKeyId = String(process.env.FORGE_SIGNING_KEY_ID || "forgecore-architect-root").trim();
    const signerAlgorithm = String(process.env.FORGE_SIGNING_ALGORITHM || "ed25519").trim().toLowerCase();
    const signerKeyPath = path.resolve(process.env.FORGE_SIGNING_KEY_PATH || PRIVATE_KEY_PATH);
    const allowUntrustedSigner = String(process.env.FORGE_ALLOW_UNTRUSTED_SIGNER || "") === "1";
    const channelDir = path.join(DIST_DIR, "publish", channel);
    const latestPath = path.join(channelDir, "latest-portable.json");
    const indexPath = path.join(channelDir, "index.json");
    const trustRootSnapshotPath = path.join(channelDir, "trust-root.json");
    const signaturePath = path.join(channelDir, "signatures.json");
    const trust = loadTrustRoot(ROOT, NeuralShield.ROOT_PUBLIC_KEY);

    ensureFile(signerKeyPath, "signing_private_key");
    ensureFile(latestPath, "latest_metadata");
    ensureFile(indexPath, "index_metadata");

    if (!signerKeyId) {
        throw new Error("signer_key_id_missing");
    }
    const keyMeta = trust.keyMap.get(signerKeyId);
    if (!allowUntrustedSigner && !keyMeta) {
        throw new Error(`signer_not_in_trust_root:${signerKeyId}`);
    }
    if (trust.revoked.has(signerKeyId)) {
        throw new Error(`signer_revoked:${signerKeyId}`);
    }

    const previous = fs.existsSync(signaturePath) ? readJson(signaturePath, "signatures") : null;
    const privateKey = fs.readFileSync(signerKeyPath, "utf8");
    const now = new Date().toISOString();
    const sourceFiles = [latestPath, indexPath];
    if (fs.existsSync(trustRootSnapshotPath)) {
        sourceFiles.push(trustRootSnapshotPath);
    }

    const files = sourceFiles.map((absPath) => {
        const rel = path.relative(channelDir, absPath).replace(/\\/g, "/");
        const buffer = fs.readFileSync(absPath);
        const stat = fs.statSync(absPath);
        const previousEntry = previous && Array.isArray(previous.files)
            ? previous.files.find((entry) => String(entry && entry.file || "").replace(/\\/g, "/") === rel)
            : null;
        const carry = dedupeSignaturesByKeyId(
            parseSignatureList(previousEntry, previous && previous.signer)
                .filter((sig) => String(sig.keyId) !== signerKeyId)
        );
        const currentSignature = signBuffer(privateKey, buffer);
        const signatures = [
            ...carry,
            {
                keyId: signerKeyId,
                algorithm: signerAlgorithm,
                signedAt: now,
                signature: currentSignature
            }
        ];
        return {
            file: rel,
            bytes: stat.size,
            sha256: sha256File(absPath),
            keyId: signerKeyId,
            algorithm: signerAlgorithm,
            signature: currentSignature,
            signatures: dedupeSignaturesByKeyId(signatures)
        };
    });

    const threshold = resolveThreshold(previous, trust.policy);
    const signerSet = new Set();
    for (const entry of files) {
        for (const sig of entry.signatures) {
            signerSet.add(String(sig.keyId));
        }
    }

    const payload = {
        schemaVersion: 2,
        generatedAt: now,
        channel,
        threshold,
        signer: {
            keyId: signerKeyId,
            algorithm: signerAlgorithm
        },
        signers: Array.from(signerSet.values()).sort().map((keyId) => {
            const row = trust.keyMap.get(keyId);
            return {
                keyId,
                algorithm: row ? row.algorithm : "ed25519"
            };
        }),
        files
    };

    fs.writeFileSync(signaturePath, JSON.stringify(payload, null, 2) + "\n", "utf8");
    console.log(`[PUBSIG] channel=${channel}`);
    console.log(`[PUBSIG] signer=${signerKeyId}`);
    console.log(`[PUBSIG] threshold=${threshold}`);
    console.log(`[PUBSIG] files=${files.length}`);
    console.log(`[PUBSIG] trustRoot=${trust.path}`);
    console.log("[PUBSIG] output=signatures.json");
}

try {
    main();
} catch (err) {
    console.error("[PUBSIG] FAILED:", err && err.message ? err.message : err);
    process.exit(1);
}
