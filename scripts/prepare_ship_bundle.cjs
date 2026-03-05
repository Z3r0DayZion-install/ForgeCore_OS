"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const outDir = path.join(root, "release", "ship_ready");

function ensureDir(p) {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function copyIfExists(src, dst) {
    if (!fs.existsSync(src)) return false;
    ensureDir(path.dirname(dst));
    fs.copyFileSync(src, dst);
    return true;
}

function copyDirRecursive(srcDir, dstDir) {
    if (!fs.existsSync(srcDir)) return false;
    ensureDir(dstDir);
    const entries = fs.readdirSync(srcDir, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
        const src = path.join(srcDir, entry.name);
        const dst = path.join(dstDir, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(src, dst);
        } else if (entry.isFile()) {
            copyIfExists(src, dst);
        }
    }
    return true;
}

function readManifest() {
    const manifestPath = path.join(dist, "release-manifest.json");
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Missing ${manifestPath}`);
    }
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function writeCommandsFile(targetPath) {
    const commands = [
        "npm run specs:generate",
        "npm run specs:materialize:obey",
        "npm run specs:materialize:mind_unset",
        "npm run test:specs:obey",
        "npm run test:specs:mind_unset",
        "npm run specs:check",
        "npm run specs:verify",
        "npm run specs:sign",
        "npm run specs:verify:signatures",
        "npm run build:portable",
        "node scripts/release_portable.cjs",
        "npm run release:align:stable",
        "npm run smoke:portable",
        "npm run verify:portable",
        "npm run verify:release",
        "npm run founder:ops"
    ];
    fs.writeFileSync(targetPath, `${commands.join("\n")}\n`, "utf8");
}

function main() {
    const manifest = readManifest();
    const rel = manifest.artifact && manifest.artifact.relativePath;
    const checksumName = manifest.checksumFile || "forgecore-os-2.0.0.sha256.txt";
    if (!rel) throw new Error("Manifest missing artifact.relativePath");

    const artifactSrc = path.join(root, rel);
    const checksumSrc = path.join(dist, checksumName);
    const manifestSrc = path.join(dist, "release-manifest.json");
    const chainSrc = path.join(dist, "artifact_hashes.txt");
    const specsManifestSrc = path.join(dist, "specs-manifest.json");
    const specsManifestHashSrc = path.join(dist, "specs-manifest.sha256.txt");
    const specsSignaturesSrc = path.join(dist, "specs-manifest.signatures.json");
    const specsSigStubSrc = path.join(dist, "specs-manifest.sig.stub.json");
    const alignmentSrc = path.join(dist, "release-feed-alignment.json");
    const proofSrc = path.join(root, "CHATGPT_PROOF_FILE.md");
    const opsSrc = path.join(root, "docs", "SHIP_OPERATIONS.md");
    const specsDirSrc = path.join(root, "specs");

    ensureDir(outDir);
    ensureDir(path.join(outDir, "dist"));
    ensureDir(path.join(outDir, "docs"));
    ensureDir(path.join(outDir, "specs"));

    if (!copyIfExists(artifactSrc, path.join(outDir, "dist", path.basename(artifactSrc)))) {
        throw new Error(`Missing artifact: ${artifactSrc}`);
    }
    if (!copyIfExists(checksumSrc, path.join(outDir, "dist", path.basename(checksumSrc)))) {
        throw new Error(`Missing checksum: ${checksumSrc}`);
    }
    if (!copyIfExists(manifestSrc, path.join(outDir, "dist", "release-manifest.json"))) {
        throw new Error("Missing release manifest");
    }
    copyIfExists(chainSrc, path.join(outDir, "dist", "artifact_hashes.txt"));
    if (!copyIfExists(specsManifestSrc, path.join(outDir, "dist", "specs-manifest.json"))) {
        throw new Error(`Missing specs manifest: ${specsManifestSrc}`);
    }
    if (!copyIfExists(specsManifestHashSrc, path.join(outDir, "dist", "specs-manifest.sha256.txt"))) {
        throw new Error(`Missing specs hash file: ${specsManifestHashSrc}`);
    }
    if (!copyIfExists(specsSignaturesSrc, path.join(outDir, "dist", "specs-manifest.signatures.json"))) {
        throw new Error(`Missing specs signatures file: ${specsSignaturesSrc}`);
    }
    copyIfExists(specsSigStubSrc, path.join(outDir, "dist", "specs-manifest.sig.stub.json"));
    copyIfExists(alignmentSrc, path.join(outDir, "dist", "release-feed-alignment.json"));
    if (!copyDirRecursive(specsDirSrc, path.join(outDir, "specs"))) {
        throw new Error(`Missing specs directory: ${specsDirSrc}`);
    }
    copyIfExists(proofSrc, path.join(outDir, "CHATGPT_PROOF_FILE.md"));
    copyIfExists(opsSrc, path.join(outDir, "docs", "SHIP_OPERATIONS.md"));
    writeCommandsFile(path.join(outDir, "COMMAND_SEQUENCE.txt"));

    console.log(`[ship-ready] output=${outDir}`);
    console.log(`[ship-ready] artifact=${path.basename(artifactSrc)}`);
    console.log(`[ship-ready] status=OK`);
}

try {
    main();
} catch (err) {
    console.error(`[ship-ready] FAIL: ${err.message}`);
    process.exit(1);
}
