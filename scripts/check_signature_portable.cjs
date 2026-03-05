"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const MANIFEST_PATH = path.join(DIST_DIR, "release-manifest.json");

function loadManifest() {
    if (!fs.existsSync(MANIFEST_PATH)) {
        throw new Error("missing_release_manifest");
    }
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

function resolveArtifact(manifest) {
    const file = manifest && manifest.artifact ? String(manifest.artifact.file || "") : "";
    if (!file) {
        throw new Error("invalid_manifest_artifact");
    }
    const abs = path.join(DIST_DIR, file);
    if (!fs.existsSync(abs)) {
        throw new Error(`artifact_missing:${file}`);
    }
    return { file, abs };
}

function checkAuthenticode(filePath) {
    const scriptPath = path.join(os.tmpdir(), `forgecore-sign-check-${process.pid}-${Date.now()}.ps1`);
    const script = [
        "param([string]$FilePath)",
        "$sig = Get-AuthenticodeSignature -FilePath $FilePath",
        "[pscustomobject]@{",
        "  Status = [string]$sig.Status",
        "  StatusMessage = [string]$sig.StatusMessage",
        "  Subject = if ($sig.SignerCertificate) { [string]$sig.SignerCertificate.Subject } else { '' }",
        "  Issuer = if ($sig.SignerCertificate) { [string]$sig.SignerCertificate.Issuer } else { '' }",
        "  Thumbprint = if ($sig.SignerCertificate) { [string]$sig.SignerCertificate.Thumbprint } else { '' }",
        "} | ConvertTo-Json -Compress"
    ].join("\r\n");

    fs.writeFileSync(scriptPath, script, "utf8");
    try {
        const raw = execFileSync(
            "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
            ["-NoProfile", "-File", scriptPath, "-FilePath", filePath],
            { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
        ).trim();

        if (!raw) {
            throw new Error("signature_check_empty_output");
        }
        return JSON.parse(raw);
    } finally {
        try {
            fs.unlinkSync(scriptPath);
        } catch {
            // Best effort cleanup.
        }
    }
}

function main() {
    const manifest = loadManifest();
    const artifact = resolveArtifact(manifest);
    const sig = checkAuthenticode(artifact.abs);
    const status = String(sig.Status || "Unknown");
    const requireSigned = String(process.env.FORGE_REQUIRE_SIGNED || "") === "1";

    console.log(`[SIGN] artifact=${artifact.file}`);
    console.log(`[SIGN] status=${status}`);
    if (sig.Subject) console.log(`[SIGN] subject=${sig.Subject}`);
    if (sig.Issuer) console.log(`[SIGN] issuer=${sig.Issuer}`);
    if (sig.Thumbprint) console.log(`[SIGN] thumbprint=${sig.Thumbprint}`);

    if (requireSigned && status !== "Valid") {
        throw new Error(`signature_required_but_invalid:${status}`);
    }

    console.log(`[SIGN] policy=${requireSigned ? "require_signed" : "best_effort"}`);
    console.log("[SIGN] status=OK");
}

try {
    main();
} catch (err) {
    console.error("[SIGN] FAILED:", err && err.message ? err.message : err);
    process.exit(1);
}
