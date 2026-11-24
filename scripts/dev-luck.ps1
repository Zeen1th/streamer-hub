<#
  Developer luck switch. Changes dev-luck.json on GitHub (main branch), which every copy of Streamer Hub reads
  when the developer plays a coin duel. Takes effect on the next duel; no app update needed.

  Usage:
    .\scripts\dev-luck.ps1 on          # turn it on (keeps the chance)
    .\scripts\dev-luck.ps1 off         # turn it off
    .\scripts\dev-luck.ps1 set 80      # turn it on with an 80% chance
    .\scripts\dev-luck.ps1 status      # show what the file says now

  Needs the GitHub CLI (gh), logged in with access to Zeen1th/streamer-hub.
#>
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('on', 'off', 'set', 'status')]
    [string]$Action,

    [Parameter(Position = 1)]
    [ValidateRange(1, 99)]
    [int]$Chance = 0
)

$ErrorActionPreference = 'Stop'
$repo = 'Zeen1th/streamer-hub'
$path = 'dev-luck.json'

$file = gh api "repos/$repo/contents/$path?ref=main" | ConvertFrom-Json
$current = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($file.content -replace '\s', ''))) | ConvertFrom-Json

if ($Action -eq 'status') {
    $state = if ($current.enabled) { "ON ($($current.chance)%)" } else { 'OFF' }
    Write-Host "Developer luck is $state for $($current.login)"
    return
}

if ($Action -eq 'set' -and $Chance -eq 0) { throw 'Give a chance from 1 to 99, for example: set 80' }

$next = [ordered]@{
    enabled = $Action -ne 'off'
    login   = 'zeen1_th'
    chance  = if ($Action -eq 'set') { $Chance } else { [int]$current.chance }
}
$json = ($next | ConvertTo-Json) + "`n"
$body = @{
    message = "dev luck: $Action$(if ($Action -eq 'set') { " $Chance" })"
    content = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
    sha     = $file.sha
    branch  = 'main'
} | ConvertTo-Json

$body | gh api -X PUT "repos/$repo/contents/$path" --input - | Out-Null
$state = if ($next.enabled) { "ON ($($next.chance)%)" } else { 'OFF' }
Write-Host "Developer luck is now $state. The next duel uses it."
