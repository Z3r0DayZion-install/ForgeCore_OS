"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const NeuralShield = require(path.join(__dirname, "..", "core", "neuralshield.js"));
const {
    loadTrustRoot
} = require("./feed_trust_utils.cjs");

const ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const MANIFEST_PATH = path.join(DIST_DIR, "specs-manifest.json");
const SIGNATURES_PATH = path.join(DIST_DIR, "specs-manifest.signatures.json");

const DEFAULT_KEY_PATHS = {
    "forgecore-architect-root": path.join(ROOT, "core", "architect.key"),
    "forgecore-cosigner-01": path.join(ROOT, "core", "keys", "forgecore-cosigner-01.key")
};

function parsePositiveInt(value, fallback) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0 && Math.floor(n) === n) return n;
    return fallback;
}

function parseSignerList(rawValue) {
    const out = [];
    const raw = String(rawValue || "").trim();
    if (!raw) return out;
    const entries = raw.split(",").map((v) => v.trim()).filter(Boolean);
    for (const entry of entries) {
        const idx = entry.indexOf("=");
        if (idx <= 0) {
            throw new Error(`invalid_signer_entry:${entry}`);
        }
        const keyId = entry.slice(0, idx).trim();
        const keyPath = entry.slice(idx + 1).trim();
        if (!keyId || !keyPath) {
            throw new Error(`invalid_signer_entry:${entry}`);
        }
        out.push({ keyId, keyPath: path.resolve(keyPath) });
    }
    return out;
}

function resolveSigners(trust) {
    const envSigners = parseSignerList(process.env.FORGE_SPECS_SIGNER_KEYS || "");
    if (envSigners.length) return envSigners;

    const required = Array.isArray(trust.policy.requiredSignerKeyIds)
        ? trust.policy.requiredSignerKeyIds
        : [];
    const targets = required.length ? required : ["forgecore-architect-root"];
    const out = [];
    for (const keyId of targets) {
        const keyPath = DEFAULT_KEY_PATHS[keyId];
        if (keyPath && fs.existsSync(keyPath)) {
            out.push({ keyId, keyPath });
        }
    }

    if (!out.length) {
        const fallback = DEFAULT_KEY_PATHS["forgecore-architect-root"];
        if (fs.existsSync(fallback)) {
            out.push({ keyId: "forgecore-architect-root", keyPath: fallback });
        }
    }
    return out;
}

function signBuffer(privateKey, buffer) {
    return crypto.sign(null, buffer, privateKey).toString("hex");
}

function loadPreviousSignatureMap() {
    if (!fs.existsSync(SIGNATURES_PATH)) {
        return {
            generatedAt: "",
            map: new Map(),
            requiredSignerKeyIds: [],
            sha256: "",
            threshold: 0
        };
    }
    try {
        const parsed = JSON.parse(fs.readFileSync(SIGNATURES_PATH, "utf8"));
        const files = Array.isArray(parsed.files) ? parsed.files : [];
        const entry = files.find((row) => String(row && row.file || "") === "specs-manifest.json");
        const signatures = entry && Array.isArray(entry.signatures) ? entry.signatures : [];
        const map = new Map();
        for (const sig of signatures) {
            const keyId = String(sig && sig.keyId || "").trim();
            const signature = String(sig && sig.signature || "").trim();
            const signedAt = String(sig && sig.signedAt || "").trim();
            if (!keyId || !signature || !signedAt) continue;
            map.set(keyId, { signature, signedAt });
        }
        return {
            generatedAt: String(parsed.generatedAt || "").trim(),
            map,
            requiredSignerKeyIds: Array.isArray(parsed.requiredSignerKeyIds)
                ? parsed.requiredSignerKeyIds.map((v) => String(v || "").trim()).filter(Boolean)
                : [],
            sha256: String(entry && entry.sha256 || "").trim().toUpperCase(),
            threshold: parsePositiveInt(parsed.threshold, 0)
        };
    } catch {
        return {
            generatedAt: "",
            map: new Map(),
            requiredSignerKeyIds: [],
            sha256: "",
            threshold: 0
        };
    }
}

function main() {
    if (!fs.existsSync(MANIFEST_PATH)) {
        throw new Error("specs_manifest_missing:run npm run specs:verify first");
    }

    const trust = loadTrustRoot(ROOT, NeuralShield.ROOT_PUBLIC_KEY);
    const signers = resolveSigners(trust);
    if (!signers.length) {
        throw new Error("no_signers_resolved:set FORGE_SPECS_SIGNER_KEYS or provide default key files");
    }

    const allowUntrusted = String(process.env.FORGE_ALLOW_UNTRUSTED_SIGNER || "") === "1";
    const requiredSigners = Array.isArray(trust.policy.requiredSignerKeyIds)
        ? trust.policy.requiredSignerKeyIds
        : [];
    const previous = loadPreviousSignatureMap();

    const buffer = fs.readFileSync(MANIFEST_PATH);
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex").toUpperCase();
    const signatures = [];
    const now = new Date().toISOString();

    for (const signer of signers) {
        const keyId = String(signer.keyId || "").trim();
        const keyPath = path.resolve(String(signer.keyPath || "").trim());
        if (!keyId) throw new Error("signer_key_id_missing");
        if (!fs.existsSync(keyPath)) throw new Error(`signer_private_key_missing:${keyPath}`);
        if (trust.revoked.has(keyId)) throw new Error(`signer_revoked:${keyId}`);

        const keyMeta = trust.keyMap.get(keyId);
        if (!allowUntrusted) {
            if (!keyMeta) throw new Error(`signer_not_in_trust_root:${keyId}`);
            if (String(keyMeta.status || "").toLowerCase() !== "active") {
                throw new Error(`signer_not_active:${keyId}`);
            }
        }

        const privateKey = fs.readFileSync(keyPath, "utf8");
        const signature = signBuffer(privateKey, buffer);
        const previousSig = previous.map.get(keyId);
        const signedAt = previousSig && previousSig.signature === signature ? previousSig.signedAt : now;

        if (keyMeta && keyMeta.publicKey) {
            const verified = crypto.verify(
                null,
                buffer,
                keyMeta.publicKey,
                Buffer.from(signature, "hex")
            );
            if (!verified) {
                throw new Error(`signer_key_mismatch:${keyId}`);
            }
        }

        signatures.push({
            algorithm: "ed25519",
            keyId,
            signature,
            signedAt
        });
    }

    const validSignerIds = signatures.map((sig) => sig.keyId);
    for (const requiredKeyId of requiredSigners) {
        if (!validSignerIds.includes(requiredKeyId)) {
            throw new Error(`required_signer_missing:${requiredKeyId}`);
        }
    }

    const threshold = parsePositiveInt(
        process.env.FORGE_SPECS_SIGNATURE_THRESHOLD,
        Math.max(parsePositiveInt(trust.policy.minimumSignatures, 1), requiredSigners.length || 1)
    );
    const sameRequired = JSON.stringify(requiredSigners) === JSON.stringify(previous.requiredSignerKeyIds);
    const sameThreshold = threshold === previous.threshold;
    const sameManifestSha = sha256 === previous.sha256;
    const allSignaturesStable = signatures.every((sig) => {
        const row = previous.map.get(sig.keyId);
        return row && row.signature === sig.signature;
    });
    const generatedAt = (sameRequired && sameThreshold && sameManifestSha && allSignaturesStable && previous.generatedAt)
        ? previous.generatedAt
        : now;

    const payload = {
        schemaVersion: 2,
        generatedAt,
        threshold,
        requiredSignerKeyIds: requiredSigners,
        signers: signatures.map((sig) => ({
            algorithm: sig.algorithm,
            keyId: sig.keyId
        })),
        files: [
            {
                bytes: fs.statSync(MANIFEST_PATH).size,
                file: "specs-manifest.json",
                sha256,
                signatures
            }
        ]
    };

    fs.writeFileSync(SIGNATURES_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`[specs:sign] manifest=dist/specs-manifest.json`);
    console.log(`[specs:sign] signatures=${signatures.length}`);
    console.log(`[specs:sign] threshold=${threshold}`);
    console.log(`[specs:sign] output=dist/specs-manifest.signatures.json`);
}

try {
    main();
} catch (err) {
    console.error(`[specs:sign] FAIL: ${err.message}`);
    process.exit(1);
}
