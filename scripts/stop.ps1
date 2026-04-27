# BID stop script - kills any process listening on the dev port.
# Usage:
#   .\scripts\stop.ps1
#   .\scripts\stop.ps1 -Port 3000

[CmdletBinding()]
param(
    [int[]]$Port = @(3000)
)

$ErrorActionPreference = 'Continue'

function Stop-PortProcess {
    param([int]$Port)

    $pids = @()
    try {
        $pids = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique
    }
    catch {
    }

    if (-not $pids -or $pids.Count -eq 0) {
        $lines = netstat -ano | Select-String -Pattern (":{0}\s" -f $Port)
        $pids = $lines | ForEach-Object {
            ($_ -split '\s+') | Where-Object { $_ -match '^\d+$' } | Select-Object -Last 1
        } | Sort-Object -Unique
    }

    if (-not $pids -or $pids.Count -eq 0) {
        Write-Host "  port $Port : free" -ForegroundColor DarkGray
        return
    }

    foreach ($procId in $pids) {
        if ($procId -and $procId -ne 0) {
            try {
                $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
                $name = if ($proc) { $proc.ProcessName } else { 'unknown' }
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                Write-Host "  port $Port : killed PID $procId ($name)" -ForegroundColor Yellow
            }
            catch {
                Write-Host "  port $Port : failed to kill PID $procId - $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
}

Write-Host "BID - stop" -ForegroundColor Cyan
foreach ($p in $Port) { Stop-PortProcess -Port $p }
Write-Host "Done." -ForegroundColor Green
