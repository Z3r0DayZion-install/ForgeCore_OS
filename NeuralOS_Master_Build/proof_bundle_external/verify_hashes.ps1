Param(
  [string]$BasePath = (Get-Location)
)

$hashFile = Join-Path $BasePath 'hashes.txt'
Get-Content $hashFile | ForEach-Object {
  $parts = $_ -split '\s+'
  $expected = $parts[0]
  $file = Join-Path $BasePath $parts[1]
  if (Test-Path $file) {
    $actual = (Get-FileHash $file -Algorithm SHA256).Hash.ToLower()
    if ($actual -eq $expected) {
      Write-Host "OK  $file"
    } else {
      Write-Warning "MISMATCH  $file"
    }
  } else {
    Write-Warning "MISSING  $file"
  }
}
