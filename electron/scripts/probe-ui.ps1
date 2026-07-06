# Launch SSC and read visible window text via UI Automation
$ErrorActionPreference = "Stop"
$exe = "C:\Users\smash\ssc\electron\dist\win-unpacked\Super Secure Chat.exe"
if (-not (Test-Path $exe)) {
    throw "App not found: $exe"
}

Get-Process -Name "Super Secure Chat" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

$proc = Start-Process -FilePath $exe -PassThru
Start-Sleep -Seconds 6

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

function Get-WindowText($element) {
    $parts = [System.Collections.Generic.List[string]]::new()
    if ($element.Current.Name) { $parts.Add($element.Current.Name) }
    $children = $element.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($child in $children) {
        $name = $child.Current.Name
        if ($name -and $name.Trim().Length -gt 0) {
            $parts.Add($name.Trim())
        }
    }
    return ($parts | Select-Object -Unique) -join "`n"
}

$root = [System.Windows.Automation.AutomationElement]::RootElement
$condition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ProcessIdProperty,
    $proc.Id
)
$window = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $condition)

if (-not $window) {
    Write-Host "STATUS: process running but no automation window found (pid $($proc.Id))"
} else {
    Write-Host "WINDOW_TITLE: $($window.Current.Name)"
    Write-Host "VISIBLE_TEXT:"
    Write-Host (Get-WindowText $window)
}

if (-not $proc.HasExited) {
    $proc | Stop-Process -Force -ErrorAction SilentlyContinue
}