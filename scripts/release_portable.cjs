"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");

function sha256File(filePath) {
    const hash = crypto.createHash("sha256");
    hash.update(fs.readFileSync(filePath));
    return hash.digest("hex").toUpperCase();
}

function findPortableExe(distDir, pkg) {
    const files = fs.readdirSync(distDir)
        .filter((f) => f.toLowerCase().endsWith(".exe"))
        .map((name) => {
            const abs = path.join(distDir, name);
            const stat = fs.statSync(abs);
            return { name, abs, stat };
        });

    if (!files.length) {
        throw new Error("no_exe_found_in_dist");
    }

    const pkgName = String(pkg.name || "").toLowerCase();
    const pkgVersion = String(pkg.version || "").toLowerCase();

    const preferred = files.filter((f) => {
        const lower = f.name.toLowerCase();
        if (lower.includes("zerotrace")) return false;
        const nameMatch = pkgName ? lower.includes(pkgName) : true;
        const versionMatch = pkgVersion ? lower.includes(pkgVersion) : true;
        return nameMatch && versionMatch;
    });

    const pool = preferred.length ? preferred : files.filter((f) => !f.name.toLowerCase().includes("zerotrace"));
    const sorted = (pool.length ? pool : files)
        .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

    return sorted[0];
}

function main() {
    if (!fs.existsSync(DIST_DIR)) {
        throw new Error("dist_directory_missing");
    }

    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
    const artifact = findPortableExe(DIST_DIR, pkg);
    const hash = sha256File(artifact.abs);

    const checksumFileName = `${pkg.name}-${pkg.version}.sha256.txt`;
    const checksumPath = path.join(DIST_DIR, checksumFileName);
    fs.writeFileSync(checksumPath, `${hash} *${artifact.name}\n`, "utf8");

    const manifest = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        package: {
            name: pkg.name,
            version: pkg.version
        },
        artifact: {
            file: artifact.name,
            relativePath: path.join("dist", artifact.name).replace(/\\/g, "/"),
            bytes: artifact.stat.size,
            sha256: hash
        },
        checksumFile: checksumFileName
    };

    const manifestPath = path.join(DIST_DIR, "release-manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

    console.log(`[RELEASE] portable=${artifact.name}`);
    console.log(`[RELEASE] sha256=${hash}`);
    console.log(`[RELEASE] checksum=${checksumFileName}`);
    console.log("[RELEASE] manifest=release-manifest.json");
}

try {
    main();
} catch (err) {
    console.error("[RELEASE] FAILED:", err && err.message ? err.message : err);
    process.exit(1);
}
