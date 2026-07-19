# Build native SSC Windows Qt client (Android-parity UI + bundled Node crypto-worker).
# Does NOT build Electron. Does NOT modify Android.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Desktop = Join-Path $Root "desktop"
$Version = "0.4.0"
$Tools = Join-Path $Root ".ssc-tools"

Write-Host "=== SSC Desktop Qt Windows build v$Version ==="

# Resolve Qt
$QtPrefix = $env:CMAKE_PREFIX_PATH
if (-not $QtPrefix) { $QtPrefix = $env:SSC_QT_PREFIX }
if (-not $QtPrefix) {
    $candidates = @(
        "$Tools\Qt\6.7.3\mingw_64",
        "C:\Qt\6.7.3\mingw_64",
        "$env:USERPROFILE\Qt\6.7.3\mingw_64"
    )
    foreach ($c in $candidates) {
        if (Test-Path (Join-Path $c "lib\cmake\Qt6\Qt6Config.cmake")) {
            $QtPrefix = $c
            break
        }
    }
}
if (-not $QtPrefix -or -not (Test-Path $QtPrefix)) {
    Write-Host "Qt 6 not found. See docs/WINDOWS_CLIENT.md"
    exit 1
}
Write-Host "Qt: $QtPrefix"

# MinGW on PATH
$mingwBin = Join-Path $Tools "Qt\Tools\mingw1310_64\bin"
if (Test-Path $mingwBin) { $env:PATH = "$mingwBin;$env:PATH" }

# Crypto worker deps
$Worker = Join-Path $Desktop "crypto-worker"
Push-Location $Worker
if (-not (Test-Path "node_modules\@signalapp\libsignal-client")) {
    Write-Host "npm install crypto-worker..."
    npm install
    if ($LASTEXITCODE -ne 0) { throw "crypto-worker npm install failed" }
}
Pop-Location

# Portable Node for bundling (no system Node required at runtime)
$NodeVer = "v20.20.2"
$NodeName = "node-$NodeVer-win-x64"
$NodeDir = Join-Path $Tools $NodeName
$NodeZip = Join-Path $Tools "$NodeName.zip"
if (-not (Test-Path (Join-Path $NodeDir "node.exe"))) {
    Write-Host "Downloading portable Node $NodeVer..."
    $url = "https://nodejs.org/dist/$NodeVer/$NodeName.zip"
    curl.exe -L --retry 3 -o $NodeZip $url
    if (-not (Test-Path $NodeZip)) { throw "node zip download failed" }
    Expand-Archive -Path $NodeZip -DestinationPath $Tools -Force
}
if (-not (Test-Path (Join-Path $NodeDir "node.exe"))) {
    throw "portable node.exe missing after extract"
}
Write-Host "Bundled Node: $NodeDir"

# CMake
if (-not (Get-Command cmake -ErrorAction SilentlyContinue)) {
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

$generator = $env:SSC_CMAKE_GENERATOR
if (-not $generator) {
    if (Get-Command mingw32-make -ErrorAction SilentlyContinue) { $generator = "MinGW Makefiles" }
    elseif (Get-Command ninja -ErrorAction SilentlyContinue) { $generator = "Ninja" }
    else { $generator = "MinGW Makefiles" }
}

Write-Host "Configuring ($generator)..."
$cmakeArgs = @("-S", $Desktop, "-B", $BuildDir, "-DCMAKE_PREFIX_PATH=$QtPrefix", "-DCMAKE_BUILD_TYPE=Release")
if ($generator) { $cmakeArgs = @("-G", $generator) + $cmakeArgs }
& cmake @cmakeArgs
if ($LASTEXITCODE -ne 0) { throw "cmake configure failed" }

Write-Host "Building..."
& cmake --build $BuildDir --config Release
if ($LASTEXITCODE -ne 0) { throw "cmake build failed" }

$exe = Get-ChildItem $BuildDir -Recurse -Filter "ssc_desktop.exe" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $exe) { throw "ssc_desktop binary not found" }

$OutDir = Join-Path $Root "dist\windows-qt"
if (Test-Path $OutDir) {
    # Keep folder but refresh key payloads
} else {
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
}
Copy-Item $exe.FullName (Join-Path $OutDir "SSC-Desktop-$Version.exe") -Force

# crypto-worker (exclude huge caches if any)
$cwOut = Join-Path $OutDir "crypto-worker"
if (Test-Path $cwOut) { Remove-Item $cwOut -Recurse -Force }
Copy-Item -Recurse -Force $Worker $cwOut

# media-worker (WebRTC)
$Media = Join-Path $Desktop "media-worker"
Push-Location $Media
if (-not (Test-Path "node_modules\@roamhq\wrtc") -and -not (Test-Path "node_modules\wrtc")) {
    Write-Host "npm install media-worker (wrtc)..."
    npm install
    if ($LASTEXITCODE -ne 0) { Write-Warning "media-worker npm install failed - calls may be signaling-only" }
}
Pop-Location
$mwOut = Join-Path $OutDir "media-worker"
if (Test-Path $mwOut) { Remove-Item $mwOut -Recurse -Force }
if (Test-Path $Media) { Copy-Item -Recurse -Force $Media $mwOut }

# Bundle portable Node next to EXE
$runtimeNode = Join-Path $OutDir "runtime\node"
New-Item -ItemType Directory -Force -Path $runtimeNode | Out-Null
Copy-Item (Join-Path $NodeDir "node.exe") (Join-Path $runtimeNode "node.exe") -Force
# libsignal native addon may need nothing else from node dist for running .js with node_modules local

# windeployqt
$windeploy = Join-Path $QtPrefix "bin\windeployqt.exe"
if (Test-Path $windeploy) {
    Write-Host "Running windeployqt..."
    & $windeploy --qmldir (Join-Path $Desktop "qml") --release (Join-Path $OutDir "SSC-Desktop-$Version.exe")
}

# Smoke: crypto-worker with bundled node
Write-Host "Smoke crypto-worker..."
$nodeExe = Join-Path $runtimeNode "node.exe"
$workerJs = Join-Path $cwOut "worker.js"
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $nodeExe
$psi.Arguments = "`"$workerJs`""
$psi.WorkingDirectory = $cwOut
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$p = [System.Diagnostics.Process]::Start($psi)
$ready = $p.StandardOutput.ReadLine()
$p.StandardInput.WriteLine('{"id":1,"cmd":"ping"}')
$p.StandardInput.Flush()
$pong = $p.StandardOutput.ReadLine()
$p.Kill()
Write-Host "worker ready: $ready"
Write-Host "worker ping:  $pong"
if ($pong -notmatch 'ok') {
    Write-Warning "crypto-worker ping unexpected - check node_modules"
}

Write-Host ""
$finalExe = Join-Path $OutDir ("SSC-Desktop-" + $Version + ".exe")
Write-Host "OK: $finalExe"
Write-Host "    runtime\node\node.exe bundled (no system Node required)"
Write-Host "    crypto-worker\ with libsignal 0.96.4"
Write-Host "Android was not modified."
