param(
    [int]$Users = 8,
    [int]$MessagesPerConversation = 120,
    [int]$Concurrency = 24,
    [double]$MaxErrorRate = 0.01,
    [double]$MaxP95Ms = 250
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "backend"
$portablePython = "C:\Users\smash\.ssc-tools\python312\python.exe"

if (Test-Path $portablePython) {
    $pythonExe = $portablePython
} else {
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonCmd) {
        throw "Python executable not found. Install Python or provide C:\Users\smash\.ssc-tools\python312\python.exe"
    }
    $pythonExe = $pythonCmd.Path
}

Push-Location $backendDir
try {
    & $pythonExe scripts/message_soak_test.py `
        --users $Users `
        --messages-per-conversation $MessagesPerConversation `
        --concurrency $Concurrency `
        --max-error-rate $MaxErrorRate `
        --max-p95-ms $MaxP95Ms
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
