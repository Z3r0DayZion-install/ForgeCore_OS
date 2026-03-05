"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");

function normalizeChannel(channel) {
    const fallback = "stable";
    const normalized = String(channel || fallback)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return normalized || fallback;
}

function resolveDefaultTargetRoot() {
    const userProfile = process.env.USERPROFILE || process.env.HOME || "C:\\Users\\KickA";
    return path.join(userProfile, "PROJECT_VAULT", "ForgeCore_Publish");
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function removeDirContents(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    for (const name of fs.readdirSync(dirPath)) {
        const abs = path.join(dirPath, name);
        fs.rmSync(abs, { recursive: true, force: true });
    }
}

function copyDirectory(src, dst) {
    ensureDir(dst);
    for (const name of fs.readdirSync(src, { withFileTypes: true })) {
        const srcAbs = path.join(src, name.name);
        const dstAbs = path.join(dst, name.name);
        if (name.isDirectory()) {
            copyDirectory(srcAbs, dstAbs);
        } else if (name.isFile()) {
            fs.copyFileSync(srcAbs, dstAbs);
        }
    }
}

function countFiles(dirPath) {
    let count = 0;
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const abs = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            count += countFiles(abs);
        } else if (entry.isFile()) {
            count += 1;
        }
    }
    return count;
}

function main() {
    const channel = normalizeChannel(process.env.FORGE_RELEASE_CHANNEL || "stable");
    const sourceDir = path.join(DIST_DIR, "publish", channel);
    const targetRoot = process.env.FORGE_PUBLISH_TARGET_ROOT
        ? path.resolve(process.env.FORGE_PUBLISH_TARGET_ROOT)
        : resolveDefaultTargetRoot();
    const targetDir = path.join(targetRoot, channel);

    if (!fs.existsSync(sourceDir)) {
        throw new Error(`publish_channel_missing:${sourceDir}`);
    }

    ensureDir(targetRoot);
    removeDirContents(targetDir);
    copyDirectory(sourceDir, targetDir);

    const receipt = {
        schemaVersion: 1,
        deployedAt: new Date().toISOString(),
        channel,
        source: sourceDir,
        target: targetDir,
        files: countFiles(targetDir)
    };
    fs.writeFileSync(
        path.join(targetDir, "DEPLOY_RECEIPT.json"),
        JSON.stringify(receipt, null, 2) + "\n",
        "utf8"
    );

    console.log(`[DEPLOY] channel=${channel}`);
    console.log(`[DEPLOY] source=${sourceDir}`);
    console.log(`[DEPLOY] target=${targetDir}`);
    console.log(`[DEPLOY] files=${receipt.files}`);
    console.log("[DEPLOY] receipt=DEPLOY_RECEIPT.json");
}

try {
    main();
} catch (err) {
    console.error("[DEPLOY] FAILED:", err && err.message ? err.message : err);
    process.exit(1);
}
