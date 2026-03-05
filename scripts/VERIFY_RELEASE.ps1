$ErrorActionPreference = "Stop"

Write-Host "[verify] Delegating to node scripts/verify_release.cjs"
node "$PSScriptRoot\\verify_release.cjs"
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
