"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
    const out = { command: String(argv[0] || "list").toLowerCase() };
    for (let i = 1; i < argv.length; i++) {
        const token = String(argv[i] || "");
        if (token === "--key-id") out.keyId = String(argv[++i] || "");
        else if (token === "--public-key-path") out.publicKeyPath = String(argv[++i] || "");
        else if (token === "--status") out.status = String(argv[++i] || "");
        else if (token === "--roles") out.roles = String(argv[++i] || "");
        else if (token === "--minimum-signatures") out.minimumSignatures = String(argv[++i] || "");
        else if (token === "--max-metadata-age-days") out.maxMetadataAgeDays = String(argv[++i] || "");
        else if (token === "--required-signers") out.requiredSigners = String(argv[++i] || "");
        else if (token === "--allowed-channels") out.allowedChannels = String(argv[++i] || "");
        else if (token === "--trust-root-path") out.trustRootPath = String(argv[++i] || "");
    }
    return out;
}

function sanitizeKeyId(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function resolveTrustRootPath(cliPath) {
    const configured = String(cliPath || process.env.FORGE_TRUST_ROOT_PATH || "").trim();
    if (configured) return path.resolve(configured);
    return path.join(ROOT, "core", "trust_root.json");
}

function loadTrustRootDoc(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`trust_root_missing:${filePath}`);
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const doc = JSON.parse(raw);
    if (!Array.isArray(doc.keys)) doc.keys = [];
    if (!Array.isArray(doc.revokedKeyIds)) doc.revokedKeyIds = [];
    if (!doc.policy || typeof doc.policy !== "object") doc.policy = {};
    if (!Array.isArray(doc.policy.allowedChannels)) doc.policy.allowedChannels = ["stable"];
    if (!Array.isArray(doc.policy.requiredSignerKeyIds)) doc.policy.requiredSignerKeyIds = [];
    if (!Number.isFinite(Number(doc.policy.minimumSignatures))) doc.policy.minimumSignatures = 1;
    if (!Number.isFinite(Number(doc.policy.maxMetadataAgeDays))) doc.policy.maxMetadataAgeDays = 30;
    return doc;
}

function saveTrustRootDoc(filePath, doc) {
    doc.schemaVersion = Number(doc.schemaVersion || 1);
    doc.updatedAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(doc, null, 2) + "\n", "utf8");
}

function listKeys(filePath, doc) {
    console.log(`[TRUSTCTL] path=${filePath}`);
    console.log(`[TRUSTCTL] keys=${doc.keys.length}`);
    for (const key of doc.keys) {
        const roles = Array.isArray(key.roles) ? key.roles.join(",") : "";
        console.log(
            `[TRUSTCTL] key=${key.keyId} status=${key.status || "active"} roles=${roles || "feed-metadata"}`
        );
    }
    console.log(`[TRUSTCTL] revoked=${doc.revokedKeyIds.join(",") || "none"}`);
    console.log(`[TRUSTCTL] minimumSignatures=${doc.policy.minimumSignatures}`);
    console.log(`[TRUSTCTL] maxMetadataAgeDays=${doc.policy.maxMetadataAgeDays}`);
    console.log(`[TRUSTCTL] requiredSigners=${doc.policy.requiredSignerKeyIds.join(",") || "none"}`);
    console.log(`[TRUSTCTL] allowedChannels=${doc.policy.allowedChannels.join(",") || "any"}`);
    console.log("[TRUSTCTL] status=OK");
}

function addKey(filePath, doc, args) {
    const keyId = sanitizeKeyId(args.keyId || process.env.FORGE_NEW_KEY_ID || "");
    const publicKeyPath = String(args.publicKeyPath || process.env.FORGE_NEW_PUBLIC_KEY_PATH || "").trim();
    const status = String(args.status || process.env.FORGE_NEW_KEY_STATUS || "active").trim().toLowerCase();
    const rolesRaw = String(args.roles || process.env.FORGE_NEW_KEY_ROLES || "feed-metadata").trim();
    const roles = rolesRaw.split(",").map((r) => r.trim()).filter(Boolean);

    if (!keyId) throw new Error("add_key_missing_key_id");
    if (!publicKeyPath) throw new Error("add_key_missing_public_key_path");

    const publicPath = path.resolve(publicKeyPath);
    if (!fs.existsSync(publicPath)) throw new Error(`add_key_public_key_missing:${publicPath}`);
    const publicKey = fs.readFileSync(publicPath, "utf8");
    if (!publicKey.includes("BEGIN PUBLIC KEY")) throw new Error("add_key_invalid_public_key_pem");

    const existing = doc.keys.find((k) => String(k && k.keyId || "") === keyId);
    if (existing) {
        existing.publicKey = publicKey;
        existing.algorithm = "ed25519";
        existing.status = status || "active";
        existing.roles = roles.length ? roles : ["feed-metadata"];
    } else {
        doc.keys.push({
            keyId,
            algorithm: "ed25519",
            status: status || "active",
            roles: roles.length ? roles : ["feed-metadata"],
            publicKey
        });
    }

    doc.revokedKeyIds = doc.revokedKeyIds.filter((id) => String(id) !== keyId);
    saveTrustRootDoc(filePath, doc);
    console.log(`[TRUSTCTL] added=${keyId}`);
    console.log(`[TRUSTCTL] path=${filePath}`);
    console.log("[TRUSTCTL] status=OK");
}

function revokeKey(filePath, doc, args) {
    const keyId = sanitizeKeyId(args.keyId || process.env.FORGE_REVOKE_KEY_ID || "");
    if (!keyId) throw new Error("revoke_key_missing_key_id");

    const existing = doc.keys.find((k) => String(k && k.keyId || "") === keyId);
    if (!existing) throw new Error(`revoke_key_not_found:${keyId}`);
    existing.status = "revoked";

    if (!doc.revokedKeyIds.includes(keyId)) {
        doc.revokedKeyIds.push(keyId);
    }
    doc.policy.requiredSignerKeyIds = doc.policy.requiredSignerKeyIds
        .filter((id) => String(id) !== keyId);

    saveTrustRootDoc(filePath, doc);
    console.log(`[TRUSTCTL] revoked=${keyId}`);
    console.log(`[TRUSTCTL] path=${filePath}`);
    console.log("[TRUSTCTL] status=OK");
}

function setPolicy(filePath, doc, args) {
    const minimumSignatures = Number(
        String(args.minimumSignatures || process.env.FORGE_MINIMUM_SIGNATURES || "").trim() || doc.policy.minimumSignatures || 1
    );
    const maxMetadataAgeDays = Number(
        String(args.maxMetadataAgeDays || process.env.FORGE_MAX_METADATA_AGE_DAYS || "").trim() || doc.policy.maxMetadataAgeDays || 30
    );

    const requiredRaw = String(args.requiredSigners || process.env.FORGE_REQUIRED_SIGNERS || "").trim();
    const channelRaw = String(args.allowedChannels || process.env.FORGE_ALLOWED_CHANNELS || "").trim();

    if (!Number.isFinite(minimumSignatures) || minimumSignatures <= 0) {
        throw new Error("set_policy_invalid_minimum_signatures");
    }
    if (!Number.isFinite(maxMetadataAgeDays) || maxMetadataAgeDays <= 0) {
        throw new Error("set_policy_invalid_max_metadata_age_days");
    }

    const requiredSigners = requiredRaw
        ? requiredRaw.split(",").map((k) => sanitizeKeyId(k)).filter(Boolean)
        : doc.policy.requiredSignerKeyIds || [];
    const allowedChannels = channelRaw
        ? channelRaw.split(",").map((c) => String(c || "").trim().toLowerCase()).filter(Boolean)
        : doc.policy.allowedChannels || ["stable"];

    for (const keyId of requiredSigners) {
        const existing = doc.keys.find((k) => String(k && k.keyId || "") === keyId);
        if (!existing) {
            throw new Error(`set_policy_required_signer_not_found:${keyId}`);
        }
        if (String(existing.status || "").toLowerCase() !== "active") {
            throw new Error(`set_policy_required_signer_not_active:${keyId}`);
        }
    }

    doc.policy.minimumSignatures = minimumSignatures;
    doc.policy.maxMetadataAgeDays = maxMetadataAgeDays;
    doc.policy.requiredSignerKeyIds = Array.from(new Set(requiredSigners));
    doc.policy.allowedChannels = Array.from(new Set(allowedChannels));

    saveTrustRootDoc(filePath, doc);
    console.log(`[TRUSTCTL] policy.minimumSignatures=${doc.policy.minimumSignatures}`);
    console.log(`[TRUSTCTL] policy.maxMetadataAgeDays=${doc.policy.maxMetadataAgeDays}`);
    console.log(`[TRUSTCTL] policy.requiredSigners=${doc.policy.requiredSignerKeyIds.join(",") || "none"}`);
    console.log(`[TRUSTCTL] policy.allowedChannels=${doc.policy.allowedChannels.join(",") || "any"}`);
    console.log(`[TRUSTCTL] path=${filePath}`);
    console.log("[TRUSTCTL] status=OK");
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const filePath = resolveTrustRootPath(args.trustRootPath);
    const doc = loadTrustRootDoc(filePath);

    if (args.command === "list") {
        listKeys(filePath, doc);
        return;
    }
    if (args.command === "add-key") {
        addKey(filePath, doc, args);
        return;
    }
    if (args.command === "revoke-key") {
        revokeKey(filePath, doc, args);
        return;
    }
    if (args.command === "set-policy") {
        setPolicy(filePath, doc, args);
        return;
    }

    throw new Error(`unknown_command:${args.command}`);
}

try {
    main();
} catch (err) {
    console.error("[TRUSTCTL] FAILED:", err && err.message ? err.message : err);
    process.exit(1);
}
