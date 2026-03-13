# ForgeCore™ OS — Manifest Generator
# v3.0 Quantum-Ready

$RootDir = Get-Item -Path ".."
$CoreDir = Get-Item -Path "."
$ManifestPath = Join-Path $CoreDir "manifest.json"

Write-Host "🚀 Generating ForgeCore™ Workspace Manifest..."

$FilesToInclude = @(
    "core/v3_sovereign_server.js",
    "core/intent_firewall.js",
    "core/omega_brokers.js",
    "core/omega_policy.json",
    "core/quantum_bridge.js",
    "core/forge_git.js",
    "core/TEAR_Engine.js",
    "core/vault_crypt.js",
    "core/security_dna.js",
    "core/security_audit.js",
    "core/lazarus.js",
    "core/kernel_resurrection.js",
    "core/telemetry_ledger.js",
    "core/SwarmProjection.js",
    "core/telemetry_stream.js",
    "core/gateway_proxy.js",
    "electron_main.js",
    "package.json"
)

$Manifest = @{
    version = "3.0.0-Quantum"
    timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    files = @()
}

foreach ($File in $FilesToInclude) {
    $FilePath = Join-Path $RootDir $File
    if (Test-Path $FilePath) {
        $Hash = (Get-FileHash $FilePath -Algorithm SHA256).Hash.ToLower()
        $Manifest.files += @{
            path = $File.Replace("\", "/")
            hash = $Hash
        }
        Write-Host "✅ Hashed: $File"
    } else {
        Write-Host "⚠️  Skipping missing: $File"
    }
}

$Manifest | ConvertTo-Json -Depth 10 | Set-Content $ManifestPath
Write-Host "DONE: Manifest generated."
