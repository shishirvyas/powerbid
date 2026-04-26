# Root launcher for BID development environment.
# Delegates to scripts/start.ps1.

[CmdletBinding()]
param(
    [int]$Port = 3000,
    [switch]$Detached,
    [switch]$Seed
)

$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot 'scripts\start.ps1'

if (-not (Test-Path $scriptPath)) {
    throw "Missing script: $scriptPath"
}

& $scriptPath -Port $Port -Detached:$Detached -Seed:$Seed
