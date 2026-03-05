"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const KEY_DIR = path.join(ROOT, "core", "keys");

function sanitizeKeyId(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function defaultKeyId() {
    const now = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    return `forgecore-signer-${now}`;
}

function ensureMissing(filePath, label) {
    if (fs.existsSync(filePath)) {
        throw new Error(`${label}_already_exists:${filePath}`);
    }
}

function main() {
    const requested = process.env.FORGE_NEW_KEY_ID || defaultKeyId();
    const keyId = sanitizeKeyId(requested);
    if (!keyId) {
        throw new Error("invalid_key_id");
    }

    fs.mkdirSync(KEY_DIR, { recursive: true });
    const privatePath = path.join(KEY_DIR, `${keyId}.key`);
    const publicPath = path.join(KEY_DIR, `${keyId}.pub.pem`);
    ensureMissing(privatePath, "private_key");
    ensureMissing(publicPath, "public_key");

    const pair = crypto.generateKeyPairSync("ed25519");
    const privatePem = pair.privateKey.export({ type: "pkcs8", format: "pem" });
    const publicPem = pair.publicKey.export({ type: "spki", format: "pem" });

    fs.writeFileSync(privatePath, privatePem, { encoding: "utf8", mode: 0o600 });
    fs.writeFileSync(publicPath, publicPem, { encoding: "utf8" });

    console.log(`[KEYGEN] keyId=${keyId}`);
    console.log(`[KEYGEN] private=${privatePath}`);
    console.log(`[KEYGEN] public=${publicPath}`);
    console.log("[KEYGEN] next1=Add public key to trust root:");
    console.log(`[KEYGEN] cmd1=node scripts/trust_root_manage.cjs add-key --key-id ${keyId} --public-key-path "${publicPath}"`);
    console.log("[KEYGEN] next2=Sign publish channel with new key:");
    console.log(`[KEYGEN] cmd2=cmd /c "set FORGE_SIGNING_KEY_ID=${keyId}&& set FORGE_SIGNING_KEY_PATH=${privatePath}&& npm run publish:sign:portable"`);
    console.log("[KEYGEN] status=OK");
}

try {
    main();
} catch (err) {
    console.error("[KEYGEN] FAILED:", err && err.message ? err.message : err);
    process.exit(1);
}
