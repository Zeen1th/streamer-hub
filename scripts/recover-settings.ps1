# Support tool: looks inside every Windows restore point (shadow copy) for the Streamer Hub settings file and
# copies each one it finds to the Desktop. It does not change anything in the real StreamerHub folder.
#
# Run from an Administrator PowerShell:
#   powershell -ExecutionPolicy Bypass -File recover-settings.ps1
# If the user's profile is not the one running PowerShell, pass the path explicitly:
#   ... -File recover-settings.ps1 -SettingsPath "C:\Users\<name>\AppData\Roaming\StreamerHub\settings.json"
param(
    [string]$SettingsPath = (Join-Path $env:APPDATA 'StreamerHub\settings.json')
)

$link = 'C:\shadow-recover'
$desktop = [Environment]::GetFolderPath('Desktop')

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host 'This must run as Administrator. Close this window, then right-click PowerShell and choose "Run as administrator".' -ForegroundColor Red
    return
}

$copies = @(Get-CimInstance Win32_ShadowCopy | Sort-Object InstallDate)
if ($copies.Count -eq 0) {
    Write-Host 'No restore point snapshots were found on this PC.' -ForegroundColor Red
    return
}

$relative = (Split-Path $SettingsPath -NoQualifier).TrimStart('\')   # the path without the drive
Write-Host ("Looking for {0}" -f $SettingsPath)
Write-Host ("Found {0} snapshot(s). Checking each one..." -f $copies.Count)
$found = 0

foreach ($copy in $copies) {
    $when = $copy.InstallDate
    $label = $when.ToString('yyyy-MM-dd_HH-mm')
    if (Test-Path $link) { cmd /c rmdir $link | Out-Null }
    cmd /c mklink /d $link "$($copy.DeviceObject)\" | Out-Null

    $source = Join-Path $link $relative
    if (Test-Path -LiteralPath $source) {
        $size = (Get-Item -LiteralPath $source).Length
        $dest = Join-Path $desktop "settings.from-$label.json"
        Copy-Item -LiteralPath $source -Destination $dest -Force
        Write-Host ("  Snapshot of {0}: FOUND settings.json, {1:N0} KB -> saved to Desktop as settings.from-{2}.json" -f $when, ($size / 1KB), $label) -ForegroundColor Green
        $found++
    } else {
        Write-Host ("  Snapshot of {0}: no settings.json in it" -f $when) -ForegroundColor Yellow
    }

    cmd /c rmdir $link | Out-Null
}

Write-Host ''
if ($found -eq 0) {
    Write-Host 'No snapshot contained the file.' -ForegroundColor Red
} else {
    Write-Host 'Done. Look on the Desktop. The file with the biggest KB number is the one with the commands and counters.' -ForegroundColor Cyan
    Write-Host 'A file of about 1 KB is an empty one (nothing to recover).'
}
