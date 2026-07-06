# Load SSC Android signing env from %USERPROFILE%\.ssc\android-signing.env

$envFile = Join-Path $env:USERPROFILE ".ssc\android-signing.env"
if (-not (Test-Path $envFile)) {
    return $false
}

Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { return }
    $name = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim()
    if ($name) {
        Set-Item -Path "Env:$name" -Value $value
    }
}

return $true