param(
    [string]$Owner = "Z3r0DayZion-install",
    [string]$Repo = "NeuralShell",
    [string]$Domain = "getneuralshell.com",
    [switch]$Enforce,
    [switch]$AuditOnly
)

$ErrorActionPreference = "Stop"

function Write-Section {
    param([string]$Text)
    Write-Host ""
    Write-Host "=== $Text ==="
}

function Get-PagesState {
    param([string]$Owner, [string]$Repo)
    $raw = gh api "repos/$Owner/$Repo/pages"
    return $raw | ConvertFrom-Json
}

function Set-PagesState {
    param([string]$Owner, [string]$Repo, [string]$Domain)
    $null = gh api --method PUT "repos/$Owner/$Repo/pages" -f cname="$Domain" -F https_enforced=true
}

function Invoke-Head {
    param([string]$Url)

    $out = curl.exe -s -o NUL -w "%{http_code}|%{redirect_url}" -I $Url
    $parts = $out -split "\|", 2

    [PSCustomObject]@{
        Url = $Url
        StatusCode = $parts[0]
        RedirectTo = if ($parts.Count -gt 1) { $parts[1] } else { "" }
    }
}

function Invoke-GetCode {
    param([string]$Url)

    $code = curl.exe -s -o NUL -w "%{http_code}" $Url
    return [PSCustomObject]@{
        Url = $Url
        StatusCode = $code
    }
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI (gh) is required but not found in PATH."
}

Write-Section "GitHub Auth"
$authStatus = gh auth status 2>&1
$authStatus | ForEach-Object { Write-Host $_ }

Write-Section "Current Pages State"
$before = Get-PagesState -Owner $Owner -Repo $Repo
$before | Select-Object status, cname, html_url, build_type, https_enforced | Format-List

if (-not $AuditOnly -and ($Enforce -or -not $before.https_enforced -or $before.cname -ne $Domain)) {
    Write-Section "Applying Control Settings"
    Set-PagesState -Owner $Owner -Repo $Repo -Domain $Domain
    Write-Host "Applied: cname=$Domain, https_enforced=true"
}

Write-Section "Final Pages State"
$after = Get-PagesState -Owner $Owner -Repo $Repo
$after | Select-Object status, cname, html_url, build_type, https_enforced | Format-List

Write-Section "Header Checks"
$headChecks = @(
    "http://$Domain/",
    "https://$Domain/",
    "http://www.$Domain/",
    "https://www.$Domain/",
    "http://$Owner.github.io/$Repo/",
    "https://$Owner.github.io/$Repo/"
) | ForEach-Object { Invoke-Head -Url $_ }
$headChecks | Format-Table -AutoSize

Write-Section "Smoke Checks"
$smokeChecks = @(
    "https://$Domain/",
    "https://$Domain/proof.html",
    "https://$Domain/pricing.html",
    "https://$Domain/onboarding.html",
    "https://$Domain/screenshots/ui_session_restored.png"
) | ForEach-Object { Invoke-GetCode -Url $_ }
$smokeChecks | Format-Table -AutoSize

$failedSmoke = $smokeChecks | Where-Object { $_.StatusCode -ne "200" }
if ($failedSmoke) {
    Write-Error "One or more smoke endpoints failed."
    exit 2
}

Write-Section "Result"
Write-Host "Pages control run completed successfully."
exit 0
