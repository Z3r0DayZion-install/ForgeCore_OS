# NeuralOS Sovereign Build: ISO Builder Pipeline (NT-ISO-02)
# Hardened for Real-World Bootable Generation.

$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Users\KickA\NeuralOS_Master_Build"
$IsoWorkDir = "$ProjectRoot\iso_builder\work"
$WinPeMount = "$IsoWorkDir\mount"
$WinPeMedia = "$IsoWorkDir\media"
$DistDir = "$ProjectRoot\dist"
$IsoOutput = "$ProjectRoot\dist\NeuralOS_Installer.iso"

# Tool Paths
$OscdimgPath = "C:\Program Files (x86)\Windows Kits\10\Assessment and Deployment Kit\Deployment Tools\amd64\Oscdimg\oscdimg.exe"
$BootWimPath = "C:\WinPE_amd64\en-us\winpe.wim" # Update this to your local WinPE source

Write-Host "[ISO-BUILDER] Initializing Hard-Boot Hardening..." -ForegroundColor Green

# 1. Prepare Workspace
if (Test-Path $IsoWorkDir) { 
    Write-Host "[ISO-BUILDER] Cleaning workspace..." -ForegroundColor Gray
    # Force unmount any existing sessions if possible
    dism /Cleanup-Mountpoints /Quiet
    Remove-Item $IsoWorkDir -Recurse -Force 
}
New-Item -ItemType Directory -Path $WinPeMount -Force
New-Item -ItemType Directory -Path $WinPeMedia -Force

# 2. Bundle NeuralOS Payload
Write-Host "[ISO-BUILDER] Packaging NeuralOS Payload..." -ForegroundColor Blue
$PayloadZip = "$IsoWorkDir\neural_payload.zip"
# Filter out node_modules for ISO size efficiency, payload will install them if needed or use bundled versions
Compress-Archive -Path "$ProjectRoot\packages", "$ProjectRoot\main.desktop.js", "$ProjectRoot\preload.js", "$ProjectRoot\package.json" -DestinationPath $PayloadZip -Force

# 3. Mount WinPE Image
Write-Host "[ISO-BUILDER] Mounting WinPE WIM..." -ForegroundColor Cyan
if (Test-Path $BootWimPath) {
    # Copy source to work media
    Copy-Item "C:\WinPE_amd64\media\*" $WinPeMedia -Recurse -Force
    dism /Mount-Wim /WimFile:"$WinPeMedia\sources\boot.wim" /index:1 /MountDir:"$WinPeMount"
} else {
    Write-Host "[ISO-BUILDER] WARNING: Source WinPE WIM not found at $BootWimPath. Proceeding with payload-only bundle." -ForegroundColor Yellow
    # Create a dummy structure if source is missing just to show logic
}

# 4. Inject Seal-Check Kernel & Payload
Write-Host "[ISO-BUILDER] Injecting Sovereign Kernel (sealcheck.exe)..." -ForegroundColor Magenta
$KernelBin = "$ProjectRoot\iso_builder\bin\sealcheck.exe"
if (Test-Path $KernelBin) {
    if (Test-Path "$WinPeMount\Windows\System32") {
        Copy-Item $KernelBin "$WinPeMount\Windows\System32\" -Force
        
        # Configure Startnet.cmd to run sealcheck at boot
        $StartnetPath = "$WinPeMount\Windows\System32\startnet.cmd"
        $StartnetCmd = "wpeinit`nsealcheck.exe`nif %errorlevel% neq 0 (echo SOVEREIGN_SEAL_FAILURE && pause && exit)`necho NEURALOS_KERNEL_LOADED`n"
        Set-Content -Path $StartnetPath -Value $StartnetCmd
    }
}

# 5. Commit and Unmount
if (Test-Path "$WinPeMount\Windows") {
    Write-Host "[ISO-BUILDER] Committing changes to WIM..." -ForegroundColor Cyan
    dism /Unmount-Wim /MountDir:"$WinPeMount" /Commit
}

# 6. Generate ISO Hashes
Write-Host "[ISO-BUILDER] Anchoring hashes..." -ForegroundColor Yellow
& node "$ProjectRoot\scripts\proofRunner.js"

# 7. Final ISO Creation
if (Test-Path $OscdimgPath) {
    Write-Host "[ISO-BUILDER] Creating bootable ISO: $IsoOutput" -ForegroundColor Green
    $EtfsBoot = "C:\Program Files (x86)\Windows Kits\10\Assessment and Deployment Kit\Deployment Tools\amd64\Oscdimg\etfsboot.com"
    & $OscdimgPath -n -b"$EtfsBoot" "$WinPeMedia" "$IsoOutput"
} else {
    Write-Host "[ISO-BUILDER] ERROR: oscdimg.exe not found. Manual ISO generation required." -ForegroundColor Red
}

Write-Host "[ISO-BUILDER] Pipeline Finished." -ForegroundColor Green
