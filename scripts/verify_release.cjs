"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const manifestPath = path.join(dist, "release-manifest.json");

function fail(msg) {
    console.error(`[verify-release] ${msg}`);
    process.exit(1);
}

if (!fs.existsSync(manifestPath)) {
    fail(`Manifest missing: ${manifestPath}`);
}

let manifest;
try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch (err) {
    fail(`Manifest parse error: ${err.message}`);
}

const relPath = manifest && manifest.artifact ? manifest.artifact.relativePath : null;
const expected = manifest && manifest.artifact ? String(manifest.artifact.sha256 || "").toUpperCase() : "";
if (!relPath || !expected) {
    fail("Manifest missing artifact.relativePath or artifact.sha256");
}

const artifactPath = path.join(root, relPath);
if (!fs.existsSync(artifactPath)) {
    fail(`Artifact missing: ${artifactPath}`);
}

const actual = crypto.createHash("sha256").update(fs.readFileSync(artifactPath)).digest("hex").toUpperCase();
console.log(`[verify-release] artifact=${artifactPath}`);
console.log(`[verify-release] expected=${expected}`);
console.log(`[verify-release] actual=${actual}`);

if (actual !== expected) {
    fail("HASH_MISMATCH");
}

const hashOut = path.join(dist, "artifact_hashes.txt");
const hashLines = [`${actual} *${path.basename(artifactPath)}`];

const specsManifestPath = path.join(dist, "specs-manifest.json");
if (fs.existsSync(specsManifestPath)) {
    const specsHash = crypto.createHash("sha256").update(fs.readFileSync(specsManifestPath)).digest("hex").toUpperCase();
    hashLines.push(`${specsHash} *${path.basename(specsManifestPath)}`);
    console.log(`[verify-release] specs_manifest=${specsManifestPath}`);
    console.log(`[verify-release] specs_sha256=${specsHash}`);
}

const specsSignaturesPath = path.join(dist, "specs-manifest.signatures.json");
if (fs.existsSync(specsSignaturesPath)) {
    const sigHash = crypto.createHash("sha256").update(fs.readFileSync(specsSignaturesPath)).digest("hex").toUpperCase();
    hashLines.push(`${sigHash} *${path.basename(specsSignaturesPath)}`);
    console.log(`[verify-release] specs_signatures=${specsSignaturesPath}`);
    console.log(`[verify-release] specs_signatures_sha256=${sigHash}`);
}

fs.writeFileSync(hashOut, `${hashLines.join("\n")}\n`, "utf8");
console.log(`[verify-release] hash chain written: ${hashOut}`);
console.log("[verify-release] status=OK");
