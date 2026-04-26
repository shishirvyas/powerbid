# Root stopper for BID development environment.
# Delegates to scripts/stop.ps1.

[CmdletBinding()]
param(
    [int[]]$Port = @(3000)
)

$ErrorActionPreference = 'Continue'
$scriptPath = Join-Path $PSScriptRoot 'scripts\stop.ps1'

if (-not (Test-Path $scriptPath)) {
    throw "Missing script: $scriptPath"
}

& $scriptPath -Port $Port
