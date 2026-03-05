"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function normalizeChannel(channel) {
    const fallback = "stable";
    const normalized = String(channel || fallback)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return normalized || fallback;
}

function ensureFile(filePath, label) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`${label}_missing:${filePath}`);
    }
}

function readJson(filePath, label) {
    ensureFile(filePath, label);
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

function assertSafeRelativePath(relPath, label) {
    const rel = String(relPath || "").replace(/\\/g, "/");
    if (!rel || rel.includes("..") || rel.startsWith("/")) {
        throw new Error(`${label}_invalid_relative_path:${rel}`);
    }
    return rel;
}

function assertFreshMetadata(maxAgeDays, label, isoString) {
    if (!Number.isFinite(maxAgeDays) || maxAgeDays <= 0) return;
    const ts = Date.parse(String(isoString || ""));
    if (!Number.isFinite(ts)) {
        throw new Error(`${label}_invalid_timestamp:${isoString}`);
    }
    const ageMs = Date.now() - ts;
    const limitMs = maxAgeDays * 24 * 60 * 60 * 1000;
    if (ageMs > limitMs) {
        throw new Error(`${label}_stale:maxAgeDays=${maxAgeDays}:value=${isoString}`);
    }
}

function parseSignatureList(fileEntry, docSigner) {
    const out = [];
    const signer = docSigner && typeof docSigner === "object" ? docSigner : null;

    if (Array.isArray(fileEntry && fileEntry.signatures)) {
        for (const sig of fileEntry.signatures) {
            if (!sig) continue;
            const keyId = String(sig.keyId || "").trim();
            const signature = String(sig.signature || "").trim();
            const algorithm = String(sig.algorithm || "ed25519").trim();
            if (!keyId || !signature) continue;
            out.push({ keyId, signature, algorithm });
        }
    }

    if (!out.length && fileEntry && fileEntry.signature) {
        const keyId = String(fileEntry.keyId || signer && signer.keyId || "forgecore-architect-root").trim();
        const signature = String(fileEntry.signature || "").trim();
        const algorithm = String(fileEntry.algorithm || signer && signer.algorithm || "ed25519").trim();
        if (keyId && signature) {
            out.push({ keyId, signature, algorithm });
        }
    }

    return out;
}

function dedupeSignaturesByKeyId(signatureList) {
    const map = new Map();
    for (const sig of signatureList) {
        if (!sig || !sig.keyId) continue;
        map.set(String(sig.keyId), sig);
    }
    return Array.from(map.values());
}

function parsePositiveInt(value, fallback) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0 && Math.floor(n) === n) return n;
    return fallback;
}

function loadTrustRoot(rootDir, fallbackPublicKey) {
    const configuredPath = String(process.env.FORGE_TRUST_ROOT_PATH || "").trim();
    const trustRootPath = configuredPath
        ? path.resolve(configuredPath)
        : path.join(rootDir, "core", "trust_root.json");

    let doc = null;
    if (fs.existsSync(trustRootPath)) {
        doc = readJson(trustRootPath, "trust_root");
    } else {
        doc = {
            schemaVersion: 1,
            keys: [
                {
                    keyId: "forgecore-architect-root",
                    algorithm: "ed25519",
                    status: "active",
                    roles: ["feed-metadata"],
                    publicKey: String(fallbackPublicKey || "")
                }
            ],
            revokedKeyIds: [],
            policy: {
                minimumSignatures: 1,
                maxMetadataAgeDays: 30,
                allowedChannels: ["stable"]
            }
        };
    }

    const keys = Array.isArray(doc.keys) ? doc.keys : [];
    const revoked = new Set(
        (Array.isArray(doc.revokedKeyIds) ? doc.revokedKeyIds : [])
            .map((v) => String(v || "").trim())
            .filter(Boolean)
    );

    const keyMap = new Map();
    for (const row of keys) {
        if (!row) continue;
        const keyId = String(row.keyId || "").trim();
        const publicKey = String(row.publicKey || "").trim();
        const algorithm = String(row.algorithm || "ed25519").trim().toLowerCase();
        const status = String(row.status || "active").trim().toLowerCase();
        const roles = Array.isArray(row.roles) ? row.roles.map((r) => String(r || "").trim()) : [];
        if (!keyId || !publicKey) continue;
        keyMap.set(keyId, { keyId, publicKey, algorithm, status, roles });
    }

    const policy = doc && typeof doc.policy === "object" && doc.policy ? doc.policy : {};
    const allowedChannels = Array.isArray(policy.allowedChannels)
        ? policy.allowedChannels.map((c) => normalizeChannel(c)).filter(Boolean)
        : [];
    const requiredSignerKeyIds = Array.isArray(policy.requiredSignerKeyIds)
        ? policy.requiredSignerKeyIds.map((k) => String(k || "").trim()).filter(Boolean)
        : [];

    return {
        path: trustRootPath,
        doc,
        keyMap,
        revoked,
        policy: {
            minimumSignatures: parsePositiveInt(policy.minimumSignatures, 1),
            maxMetadataAgeDays: parsePositiveInt(policy.maxMetadataAgeDays, 0),
            allowedChannels,
            requiredSignerKeyIds
        }
    };
}

function resolveThreshold(signaturesDoc, trustPolicy) {
    const envThreshold = parsePositiveInt(process.env.FORGE_SIGNATURE_THRESHOLD, 0);
    if (envThreshold > 0) return envThreshold;
    const docThreshold = parsePositiveInt(signaturesDoc && signaturesDoc.threshold, 1);
    const policyThreshold = parsePositiveInt(trustPolicy && trustPolicy.minimumSignatures, 1);
    return Math.max(docThreshold, policyThreshold);
}

function resolveMaxMetadataAgeDays(trustPolicy) {
    const envAge = parsePositiveInt(process.env.FORGE_MAX_METADATA_AGE_DAYS, 0);
    if (envAge > 0) return envAge;
    return parsePositiveInt(trustPolicy && trustPolicy.maxMetadataAgeDays, 0);
}

function assertChannelAllowed(channel, trustPolicy) {
    const allowed = Array.isArray(trustPolicy && trustPolicy.allowedChannels)
        ? trustPolicy.allowedChannels
        : [];
    if (allowed.length > 0 && !allowed.includes(channel)) {
        throw new Error(`channel_not_allowed:${channel}`);
    }
}

function findFileSignatureEntry(signaturesDoc, fileName) {
    const files = Array.isArray(signaturesDoc && signaturesDoc.files) ? signaturesDoc.files : [];
    return files.find((row) => String(row && row.file || "").replace(/\\/g, "/") === fileName) || null;
}

function verifySignedMetadataFile(options) {
    const {
        channelDir,
        fileName,
        signaturesDoc,
        trust,
        threshold
    } = options;

    const entry = findFileSignatureEntry(signaturesDoc, fileName);
    if (!entry) {
        throw new Error(`signature_entry_missing:${fileName}`);
    }

    const absPath = path.join(channelDir, fileName);
    ensureFile(absPath, `signed_file:${fileName}`);
    const expectedSha = String(entry.sha256 || "").toUpperCase();
    const expectedBytes = Number(entry.bytes || 0);
    if (!/^[A-F0-9]{64}$/.test(expectedSha)) {
        throw new Error(`signature_entry_invalid_sha:${fileName}`);
    }

    const actualSha = sha256File(absPath);
    const actualBytes = fs.statSync(absPath).size;
    if (actualSha !== expectedSha) {
        throw new Error(`signed_file_hash_mismatch:${fileName}:expected=${expectedSha}:actual=${actualSha}`);
    }
    if (expectedBytes > 0 && actualBytes !== expectedBytes) {
        throw new Error(`signed_file_size_mismatch:${fileName}:expected=${expectedBytes}:actual=${actualBytes}`);
    }

    const signatures = dedupeSignaturesByKeyId(parseSignatureList(entry, signaturesDoc && signaturesDoc.signer));
    if (!signatures.length) {
        throw new Error(`signed_file_signatures_missing:${fileName}`);
    }

    const requiredSigners = new Set(
        Array.isArray(trust && trust.policy && trust.policy.requiredSignerKeyIds)
            ? trust.policy.requiredSignerKeyIds
            : []
    );

    const validKeyIds = new Set();
    const buffer = fs.readFileSync(absPath);
    for (const sig of signatures) {
        const keyId = String(sig.keyId || "");
        const signatureHex = String(sig.signature || "");
        if (!/^[a-fA-F0-9]+$/.test(signatureHex)) continue;
        if (trust.revoked.has(keyId)) continue;
        const keyRow = trust.keyMap.get(keyId);
        if (!keyRow) continue;
        if (String(keyRow.status || "").toLowerCase() !== "active") continue;
        if (Array.isArray(keyRow.roles) && keyRow.roles.length > 0 && !keyRow.roles.includes("feed-metadata")) continue;
        const verified = crypto.verify(
            null,
            buffer,
            keyRow.publicKey,
            Buffer.from(signatureHex, "hex")
        );
        if (verified) {
            validKeyIds.add(keyId);
        }
    }

    if (validKeyIds.size < threshold) {
        throw new Error(`signed_file_threshold_not_met:${fileName}:required=${threshold}:valid=${validKeyIds.size}`);
    }
    for (const required of requiredSigners) {
        if (!validKeyIds.has(required)) {
            throw new Error(`signed_file_missing_required_signer:${fileName}:${required}`);
        }
    }

    return {
        fileName,
        validSigners: Array.from(validKeyIds),
        validCount: validKeyIds.size
    };
}

module.exports = {
    normalizeChannel,
    ensureFile,
    readJson,
    sha256File,
    assertSafeRelativePath,
    assertFreshMetadata,
    parseSignatureList,
    dedupeSignaturesByKeyId,
    loadTrustRoot,
    resolveThreshold,
    resolveMaxMetadataAgeDays,
    assertChannelAllowed,
    verifySignedMetadataFile,
    findFileSignatureEntry
};
