# ForgeCore™ OS — Integrity Verification Script
# v3.0 Quantum-Ready

$RootDir = Get-Item -Path ".."
$CoreDir = Get-Item -Path "."
$ManifestPath = Join-Path $CoreDir "manifest.json"

Write-Host "🚀 Starting Integrity Verification for ForgeCore™ Workspace..." -ForegroundColor Cyan

# 1. Check for Manifest
if (-not (Test-Path $ManifestPath)) {
    Write-Host "❌ CRITICAL: manifest.json not found. Integrity cannot be verified." -ForegroundColor Red
    exit 1
}

$Manifest = Get-Content $ManifestPath | ConvertFrom-Json

# 2. Verify Files in Manifest
Write-Host "🔍 Verifying artifact hashes..." -ForegroundColor Yellow
$ViolationCount = 0

foreach ($Entry in $Manifest.files) {
    $FilePath = Join-Path $RootDir $Entry.path
    if (-not (Test-Path $FilePath)) {
        Write-Host "❌ MISSING: $($Entry.path)" -ForegroundColor Red
        $ViolationCount++
        continue
    }

    $CurrentHash = (Get-FileHash $FilePath -Algorithm SHA256).Hash.ToLower()
    if ($CurrentHash -ne $Entry.hash.ToLower()) {
        Write-Host "❌ TAMPERED: $($Entry.path)" -ForegroundColor Red
        Write-Host "   Expected: $($Entry.hash)" -ForegroundColor Gray
        Write-Host "   Actual:   $CurrentHash" -ForegroundColor Gray
        $ViolationCount++
    } else {
        Write-Host "✅ VERIFIED: $($Entry.path)" -ForegroundColor Green
    }
}

# 3. Summary
if ($ViolationCount -eq 0) {
    Write-Host "`n🎯 INTEGRITY VERIFIED. System is safe to boot." -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n⚠️  INTEGRITY VIOLATION DETECTED! Found $ViolationCount tampered or missing artifacts." -ForegroundColor Red
    exit 1
}
