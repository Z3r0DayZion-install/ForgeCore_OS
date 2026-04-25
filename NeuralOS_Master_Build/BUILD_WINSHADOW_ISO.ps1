$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Ensure Administrator Privileges
if (!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Attempting to elevate privileges to install ADK and build the ISO..."
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$TempDir = "$env:TEMP\ADK_Install"
if (!(Test-Path $TempDir)) { New-Item -ItemType Directory -Force -Path $TempDir | Out-Null }

$ADKPath = "C:\Program Files (x86)\Windows Kits\10\Assessment and Deployment Kit"

# 1. Install ADK
if (!(Test-Path "$ADKPath\Deployment Tools")) {
    Write-Host "[1/6] Downloading Windows ADK..."
    curl.exe -L -o "$TempDir\adksetup.exe" "https://download.microsoft.com/download/8cf6cfec-5fa8-44cb-b7cc-a024482729d6/adk/adksetup.exe"
    
    Write-Host "[2/6] Installing Windows ADK (This will take several minutes)..."
    Start-Process -FilePath "$TempDir\adksetup.exe" -ArgumentList "/quiet /installpath `"C:\Program Files (x86)\Windows Kits\10`" /features OptionId.DeploymentTools" -Wait -NoNewWindow
} else {
    Write-Host "[1-2/6] Windows ADK Deployment Tools already installed."
}

# 2. Install WinPE Add-on
if (!(Test-Path "$ADKPath\Windows Preinstallation Environment")) {
    Write-Host "[3/6] Downloading WinPE Add-on..."
    curl.exe -L -o "$TempDir\adkwinpesetup.exe" "https://download.microsoft.com/download/17ac4263-5816-4f1b-8131-87c4d5a3331f/adkwinpeaddons/adkwinpesetup.exe"
    
    Write-Host "[4/6] Installing WinPE Add-on (This will take several minutes)..."
    Start-Process -FilePath "$TempDir\adkwinpesetup.exe" -ArgumentList "/quiet /installpath `"C:\Program Files (x86)\Windows Kits\10`" /features OptionId.WindowsPreinstallationEnvironment" -Wait -NoNewWindow
} else {
    Write-Host "[3-4/6] Windows PE Add-on already installed."
}

# 3. Build Sovereign Environment
Write-Host "[5/6] Building Sovereign WinPE Environment..."
$WinPEDir = "C:\WinPE_NeuralOS"
if (Test-Path $WinPEDir) { Remove-Item -Recurse -Force $WinPEDir }

# Run Copype to create the base WinPE environment
$CopyPeCmd = "`"$ADKPath\Deployment Tools\DandISetEnv.bat`" && copype amd64 C:\WinPE_NeuralOS"
cmd.exe /c $CopyPeCmd

# 4. Inject WinShadow
Write-Host "[6/6] Injecting WinShadow Shell into the OS..."
$MountCmd = "`"$ADKPath\Deployment Tools\DandISetEnv.bat`" && Dism /Mount-Image /ImageFile:`"C:\WinPE_NeuralOS\media\sources\boot.wim`" /index:1 /MountDir:`"C:\WinPE_NeuralOS\mount`""
cmd.exe /c $MountCmd

# Copy our portable WinShadow executable to the System32 directory of the new OS
$ExePath = "C:\Users\KickA\NeuralOS_Master_Build\dist\NeuralOS_Master_v1.0.0.exe"
Copy-Item -Path $ExePath -Destination "C:\WinPE_NeuralOS\mount\Windows\System32\WinShadow.exe" -Force

# Override the default Windows Shell (cmd.exe) with our WinShadow executable
$WinPeShl = "C:\WinPE_NeuralOS\mount\Windows\System32\winpeshl.ini"
"[LaunchApps]`r`n`"WinShadow.exe`", `"--no-sandbox`"" | Out-File -FilePath $WinPeShl -Encoding ascii

# Add basic packages to support graphical rendering
$OcsPath = "$ADKPath\Windows Preinstallation Environment\amd64\WinPE_OCs"
cmd.exe /c "Dism /Add-Package /Image:`"C:\WinPE_NeuralOS\mount`" /PackagePath:`"$OcsPath\WinPE-HTA.cab`""
cmd.exe /c "Dism /Add-Package /Image:`"C:\WinPE_NeuralOS\mount`" /PackagePath:`"$OcsPath\WinPE-WMI.cab`""
cmd.exe /c "Dism /Add-Package /Image:`"C:\WinPE_NeuralOS\mount`" /PackagePath:`"$OcsPath\WinPE-NetFx.cab`""

# Unmount and Commit the changes to the boot.wim
Write-Host "Committing OS changes..."
$UnmountCmd = "`"$ADKPath\Deployment Tools\DandISetEnv.bat`" && Dism /Unmount-Image /MountDir:`"C:\WinPE_NeuralOS\mount`" /commit"
cmd.exe /c $UnmountCmd

# 5. Make ISO
$IsoPath = "C:\Users\KickA\Desktop\WinShadow_Sovereign.iso"
Write-Host "Generating bootable ISO file at $IsoPath..."
$MakeIsoCmd = "`"$ADKPath\Deployment Tools\DandISetEnv.bat`" && MakeWinPEMedia /ISO C:\WinPE_NeuralOS `"$IsoPath`""
cmd.exe /c $MakeIsoCmd

Write-Host "========================================================="
Write-Host "SUCCESS: Your custom WinShadow ISO is ready!"
Write-Host "Location: $IsoPath"
Write-Host "You can now burn this to a USB drive using Rufus."
Write-Host "========================================================="
Read-Host -Prompt "Press Enter to exit"
