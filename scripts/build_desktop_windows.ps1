# Build native SSC Windows Qt client (Android-parity UI + libsignal crypto worker).
# Does NOT build Electron.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Desktop = Join-Path $Root "desktop"
$Version = "0.4.0"

Write-Host "=== SSC Desktop Qt Windows build v$Version ==="

# Resolve Qt
$QtPrefix = $env:CMAKE_PREFIX_PATH
if (-not $QtPrefix) { $QtPrefix = $env:SSC_QT_PREFIX }
if (-not $QtPrefix) {
    $candidates = @(
        "C:\Qt\6.7.3\mingw_64",
        "C:\Qt\6.7.2\mingw_64",
        "C:\Qt\6.6.3\mingw_64",
        "C:\Qt\6.8.0\mingw_64",
        "$env:USERPROFILE\Qt\6.7.3\mingw_64",
        "$env:LOCALAPPDATA\Qt\6.7.3\mingw_64",
        "$Root\.ssc-tools\Qt\6.7.3\mingw_64"
    )
    foreach ($c in $candidates) {
        if (Test-Path (Join-Path $c "lib\cmake\Qt6\Qt6Config.cmake")) {
            $QtPrefix = $c
            break
        }
    }
}
if (-not $QtPrefix -or -not (Test-Path $QtPrefix)) {
    Write-Host "Qt 6 not found. Install with:"
    Write-Host "  python -m pip install aqtinstall"
    Write-Host "  python -m aqt install-qt windows desktop 6.7.3 win64_mingw -O $Root\.ssc-tools\Qt"
    Write-Host "  python -m aqt install-tool windows desktop tools_mingw1310 -O $Root\.ssc-tools\Qt"
    Write-Host "Then set SSC_QT_PREFIX to the mingw_64 folder."
    exit 1
}
Write-Host "Qt: $QtPrefix"

# Crypto worker deps
$Worker = Join-Path $Desktop "crypto-worker"
Push-Location $Worker
if (-not (Test-Path "node_modules\@signalapp\libsignal-client")) {
    Write-Host "npm install crypto-worker..."
    npm install
    if ($LASTEXITCODE -ne 0) { throw "crypto-worker npm install failed" }
}
Pop-Location

# CMake
$cmake = Get-Command cmake -ErrorAction SilentlyContinue
if (-not $cmake) {
    try {
        $cmakeDir = python -c "import cmake; print(cmake.CMAKE_BIN_DIR)"
        $env:PATH = "$cmakeDir;$env:PATH"
    } catch {}
}
if (-not (Get-Command cmake -ErrorAction SilentlyContinue)) {
    throw "cmake not found on PATH"
}

$BuildDir = Join-Path $Desktop "build"
New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null

# Prefer Ninja or MinGW Makefiles
$generator = $env:SSC_CMAKE_GENERATOR
if (-not $generator) {
    if (Get-Command ninja -ErrorAction SilentlyContinue) { $generator = "Ninja" }
    elseif (Get-Command mingw32-make -ErrorAction SilentlyContinue) { $generator = "MinGW Makefiles" }
    else { $generator = "Ninja" }
}

Write-Host "Configuring ($generator)..."
$cmakeArgs = @(
    "-S", $Desktop,
    "-B", $BuildDir,
    "-DCMAKE_PREFIX_PATH=$QtPrefix",
    "-DCMAKE_BUILD_TYPE=Release"
)
if ($generator) { $cmakeArgs = @("-G", $generator) + $cmakeArgs }

& cmake @cmakeArgs
if ($LASTEXITCODE -ne 0) { throw "cmake configure failed" }

Write-Host "Building..."
& cmake --build $BuildDir --config Release
if ($LASTEXITCODE -ne 0) { throw "cmake build failed" }

$exe = Get-ChildItem $BuildDir -Recurse -Filter "ssc_desktop.exe" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $exe) {
    $exe = Get-ChildItem $BuildDir -Recurse -Filter "ssc_desktop*" -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -in ".exe","" } | Select-Object -First 1
}
if (-not $exe) { throw "ssc_desktop binary not found" }

$OutDir = Join-Path $Root "dist\windows-qt"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Copy-Item $exe.FullName (Join-Path $OutDir "SSC-Desktop-$Version.exe") -Force
Copy-Item -Recurse -Force $Worker (Join-Path $OutDir "crypto-worker")

# windeployqt if available
$windeploy = Join-Path $QtPrefix "bin\windeployqt.exe"
if (Test-Path $windeploy) {
    Write-Host "Running windeployqt..."
    & $windeploy --qmldir (Join-Path $Desktop "qml") --release (Join-Path $OutDir "SSC-Desktop-$Version.exe")
}

Write-Host ""
Write-Host "OK: $(Join-Path $OutDir "SSC-Desktop-$Version.exe")"
Write-Host "Requires Node.js on PATH for crypto-worker (or bundle node later)."
Write-Host "Android was not modified."
