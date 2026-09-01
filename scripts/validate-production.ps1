$ErrorActionPreference = "Stop"

$Website = "https://ramaverse.omsaravanabhava.org"
$Api = "https://api-ramaverse.omsaravanabhava.org"
$ExpectedService = "ramaverse-api"

$checks = [ordered]@{}

$site = Invoke-WebRequest -Uri "$Website/?validation=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())" -TimeoutSec 20
$checks.Website = $site.StatusCode -eq 200

$style = Invoke-WebRequest -Uri "$Website/css/style.css?validation=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())" -TimeoutSec 20
$checks.Stylesheet = $style.StatusCode -eq 200 -and $style.Content.Length -gt 100

$config = Invoke-WebRequest -Uri "$Website/js/config.js?validation=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())" -TimeoutSec 20
$checks.FrontendConfig = $config.StatusCode -eq 200 -and $config.Content.Contains("$Api/api/v1")

$statusResponse = Invoke-WebRequest -Uri "$Api/api/v1/status?validation=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())" -Headers @{ Origin = $Website; "Cache-Control" = "no-cache" } -TimeoutSec 20
$status = $statusResponse.Content | ConvertFrom-Json

$checks.Http200 = $statusResponse.StatusCode -eq 200
$checks.Status = $status.status -eq "ok"
$checks.Service = $status.service -eq $ExpectedService
$checks.Environment = $status.environment -eq "production"
$checks.Version = $status.version -eq "1.0.0"
$checks.ApiVersion = $status.apiVersion -eq "v1"
$checks.RequestId = -not [string]::IsNullOrWhiteSpace($statusResponse.Headers["X-Request-ID"])
$checks.Cors = $statusResponse.Headers["Access-Control-Allow-Origin"] -eq $Website

$result = foreach ($entry in $checks.GetEnumerator()) {
    [PSCustomObject]@{
        Check = $entry.Key
        Result = if ($entry.Value) { "PASS" } else { "FAIL" }
    }
}

$result | Format-Table -AutoSize

if ($checks.Values -contains $false) {
    throw "RamaVerse production validation failed."
}

Write-Host "RamaVerse production validation passed." -ForegroundColor Green
