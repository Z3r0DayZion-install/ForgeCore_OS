"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SPECS_DIR = path.join(ROOT, "specs");
const DIST_DIR = path.join(ROOT, "dist");

function fail(message) {
    console.error(`[specs:verify] ${message}`);
    process.exit(1);
}

function readJson(absPath) {
    return JSON.parse(fs.readFileSync(absPath, "utf8"));
}

function sha256Buffer(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function sha256Text(text) {
    return sha256Buffer(Buffer.from(text, "utf8"));
}

function ensureDir(absPath) {
    if (!fs.existsSync(absPath)) {
        fs.mkdirSync(absPath, { recursive: true });
    }
}

function writeAtomic(absPath, text) {
    const tmpPath = `${absPath}.tmp-${process.pid}`;
    fs.writeFileSync(tmpPath, text, "utf8");
    fs.renameSync(tmpPath, absPath);
}

function lockVersion(lock, dep) {
    if (lock.packages && lock.packages[`node_modules/${dep}`]) {
        return String(lock.packages[`node_modules/${dep}`].version || "");
    }
    if (lock.dependencies && lock.dependencies[dep]) {
        return String(lock.dependencies[dep].version || "");
    }
    return "";
}

function verifyDependencyPins() {
    const pinsPath = path.join(SPECS_DIR, "dependency-pins.json");
    const lockPath = path.join(ROOT, "package-lock.json");
    if (!fs.existsSync(pinsPath)) fail(`Missing ${path.relative(ROOT, pinsPath)}`);
    if (!fs.existsSync(lockPath)) fail(`Missing ${path.relative(ROOT, lockPath)}`);

    const pins = readJson(pinsPath);
    const lock = readJson(lockPath);
    const names = Object.keys((pins && pins.pins) || {}).sort((a, b) => a.localeCompare(b));
    if (!names.length) fail("dependency-pins.json has no pins");

    const mismatches = [];
    for (const dep of names) {
        const expected = String(pins.pins[dep] || "");
        const actual = lockVersion(lock, dep);
        if (!actual) {
            mismatches.push(`${dep}: missing in package-lock.json`);
        } else if (expected !== actual) {
            mismatches.push(`${dep}: expected ${expected}, actual ${actual}`);
        }
    }

    if (mismatches.length) {
        fail(`Dependency pin mismatch:\n - ${mismatches.join("\n - ")}`);
    }

    return {
        lockfile: "package-lock.json",
        pinCount: names.length
    };
}

function collectRequiredPaths(index) {
    const required = new Set([
        "specs/README.md",
        "specs/PROJECT_INDEX.json",
        "specs/SOURCE_MANIFEST.json",
        "specs/DEPENDENCY_POLICY.md",
        "specs/dependency-pins.json"
    ]);

    for (const row of index) {
        required.add(row.spec);
        required.add(row.tasks);
        required.add(path.posix.join(row.outputs, "README.md"));
    }
    return Array.from(required).sort((a, b) => a.localeCompare(b));
}

function collectAllSpecsFiles() {
    const out = [];
    function walk(dirPath) {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true })
            .sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of entries) {
            const abs = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                walk(abs);
            } else if (entry.isFile()) {
                const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
                out.push(rel);
            }
        }
    }
    walk(SPECS_DIR);
    return out.sort((a, b) => a.localeCompare(b));
}

function collectFileManifest(relPaths) {
    const files = [];
    for (const relPath of relPaths) {
        const absPath = path.join(ROOT, relPath);
        if (!fs.existsSync(absPath)) {
            fail(`Missing required file: ${relPath}`);
        }
        const stat = fs.statSync(absPath);
        if (!stat.isFile()) {
            fail(`Expected file, got non-file: ${relPath}`);
        }
        const bytes = fs.readFileSync(absPath);
        files.push({
            path: relPath,
            bytes: stat.size,
            sha256: sha256Buffer(bytes)
        });
    }
    return files;
}

function main() {
    if (!fs.existsSync(SPECS_DIR)) {
        fail("Missing specs directory. Run: npm run specs:generate");
    }

    const indexPath = path.join(SPECS_DIR, "PROJECT_INDEX.json");
    const sourcePath = path.join(SPECS_DIR, "SOURCE_MANIFEST.json");
    if (!fs.existsSync(indexPath)) fail("Missing specs/PROJECT_INDEX.json");
    if (!fs.existsSync(sourcePath)) fail("Missing specs/SOURCE_MANIFEST.json");

    const index = readJson(indexPath);
    if (!Array.isArray(index) || index.length !== 10) {
        fail(`Expected 10 projects in specs/PROJECT_INDEX.json, got ${Array.isArray(index) ? index.length : "invalid"}`);
    }

    const sourceManifest = readJson(sourcePath);
    const depPolicy = verifyDependencyPins();
    const relPaths = collectAllSpecsFiles();
    const required = collectRequiredPaths(index);
    const relSet = new Set(relPaths);
    for (const req of required) {
        if (!relSet.has(req)) {
            fail(`Missing required specs file: ${req}`);
        }
    }
    const fileManifest = collectFileManifest(relPaths);

    const manifest = {
        schemaVersion: 1,
        bundle: "forgecore-specs",
        projectCount: index.length,
        sourceBundleSha256: String(sourceManifest.bundleSha256 || ""),
        dependencyPolicy: depPolicy,
        files: fileManifest
    };

    ensureDir(DIST_DIR);
    const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
    const manifestSha = sha256Text(manifestText);
    const sigStub = {
        schemaVersion: 1,
        artifact: "dist/specs-manifest.json",
        algorithm: "SHA-256",
        digest: manifestSha,
        signature: null,
        signerHint: "Attach detached signature from Forge trust root private key."
    };

    const manifestOut = path.join(DIST_DIR, "specs-manifest.json");
    const hashOut = path.join(DIST_DIR, "specs-manifest.sha256.txt");
    const sigStubOut = path.join(DIST_DIR, "specs-manifest.sig.stub.json");
    writeAtomic(manifestOut, manifestText);
    writeAtomic(hashOut, `${manifestSha} *specs-manifest.json\n`);
    writeAtomic(sigStubOut, `${JSON.stringify(sigStub, null, 2)}\n`);

    console.log(`[specs:verify] project_count=${index.length}`);
    console.log(`[specs:verify] files=${fileManifest.length}`);
    console.log(`[specs:verify] manifest_sha256=${manifestSha}`);
    console.log("[specs:verify] status=OK");
}

try {
    main();
} catch (err) {
    fail(err.message || String(err));
}
