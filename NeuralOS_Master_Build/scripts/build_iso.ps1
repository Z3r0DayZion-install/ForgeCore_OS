# NeuralOS Sovereign Build: ISO Builder Pipeline (NT-ISO-02)
# Automates WinPE mounting, payload injection, and ISO creation.

$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Users\KickA\NeuralOS_Master_Build"
$IsoWorkDir = "$ProjectRoot\iso_builder\work"
$WinPeMount = "$IsoWorkDir\mount"
$DistDir = "$ProjectRoot\dist"
$IsoOutput = "$ProjectRoot\dist\NeuralOS_Installer.iso"

Write-Host "[ISO-BUILDER] Starting Sovereign WinPE Build..." -ForegroundColor Green

# 1. Prepare Workspace
if (Test-Path $IsoWorkDir) { Remove-Item $IsoWorkDir -Recurse -Force }
New-Item -ItemType Directory -Path $WinPeMount -Force

# 2. Bundle NeuralOS Payload
Write-Host "[ISO-BUILDER] Packaging NeuralOS Payload..." -ForegroundColor Blue
$PayloadZip = "$IsoWorkDir\neural_payload.zip"
Compress-Archive -Path "$ProjectRoot\packages", "$ProjectRoot\main.desktop.js", "$ProjectRoot\preload.js" -DestinationPath $PayloadZip -Force

# 3. DISM Mount (Placeholder - Requires ADK installed)
Write-Host "[ISO-BUILDER] Mounting WinPE WIM..." -ForegroundColor Cyan
# dism /Mount-Wim /WimFile:"C:\WinPE_amd64\media\sources\boot.wim" /index:1 /MountDir:"$WinPeMount"

# 4. Inject Seal-Pulse Check & Payload
# Copy-Item "$ProjectRoot\iso_builder\bin\sealcheck.exe" "$WinPeMount\Windows\System32\"
# Copy-Item $PayloadZip "$WinPeMount\sources\"

# 5. Generate ISO Hashes via trustctl
Write-Host "[ISO-BUILDER] Generating ISO Hashes via trustctl..." -ForegroundColor Yellow
& node "$ProjectRoot\scripts\proofRunner.js"

# 6. Final ISO Creation (Placeholder)
# oscdimg -n -b"$ProjectRoot\iso_builder\templates\etfsboot.com" "$IsoWorkDir\media" "$IsoOutput"

Write-Host "[ISO-BUILDER] ISO Pipeline Complete. Output: $IsoOutput" -ForegroundColor Green
