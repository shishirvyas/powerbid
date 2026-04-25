# PowerBid start script — frees port 3000 then launches Next.js dev server.
# Usage:
#   .\scripts\start.ps1            # start dev server in current window
#   .\scripts\start.ps1 -Detached  # start in a new window
#   .\scripts\start.ps1 -Seed      # start, wait, then seed demo data

[CmdletBinding()]
param(
    [int]$Port = 3000,
    [switch]$Detached,
    [switch]$Seed
)

$ErrorActionPreference = 'Stop'
$root    = Split-Path -Parent $PSScriptRoot
$appDir  = Join-Path $root 'app-next'

function Stop-PortProcess {
    param([int]$Port)
    $pids = @()
    try {
        $pids = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
                Select-Object -ExpandProperty OwningProcess -Unique
    } catch {}
    if (-not $pids -or $pids.Count -eq 0) {
        # Fallback to netstat parsing for older shells.
        $lines = netstat -ano | Select-String -Pattern (":{0}\s" -f $Port)
        $pids = $lines | ForEach-Object {
            ($_ -split '\s+') | Where-Object { $_ -match '^\d+$' } | Select-Object -Last 1
        } | Sort-Object -Unique
    }
    foreach ($procId in $pids) {
        if ($procId -and $procId -ne 0) {
            try {
                $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
                if ($proc) {
                    Write-Host "  killing PID $procId ($($proc.ProcessName)) on port $Port" -ForegroundColor Yellow
                    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                }
            } catch {}
        }
    }
}

Write-Host "PowerBid · start" -ForegroundColor Cyan
Write-Host "  repo : $root"
Write-Host "  app  : $appDir"
Write-Host "  port : $Port"

if (-not (Test-Path (Join-Path $appDir 'package.json'))) {
    throw "app-next/package.json not found. Are you in the right repo?"
}

Write-Host "`n[1/3] Releasing port $Port..." -ForegroundColor Cyan
Stop-PortProcess -Port $Port
Start-Sleep -Milliseconds 400

Write-Host "[2/3] Launching Next.js dev..." -ForegroundColor Cyan
Push-Location $appDir
try {
    if ($Detached) {
        Start-Process -FilePath 'powershell' -ArgumentList @(
            '-NoExit','-Command',"Set-Location '$appDir'; pnpm dev"
        ) | Out-Null
        Write-Host "  dev launched in new window." -ForegroundColor Green
    } else {
        if ($Seed) {
            # Background job for dev so we can seed after readiness.
            Start-Process -FilePath 'powershell' -ArgumentList @(
                '-NoExit','-Command',"Set-Location '$appDir'; pnpm dev"
            ) | Out-Null
            Write-Host "  dev launched in new window (Seed mode)." -ForegroundColor Green
        } else {
            pnpm dev
            return
        }
    }
}
finally { Pop-Location }

if ($Seed) {
    Write-Host "[3/3] Waiting for $Port to be ready..." -ForegroundColor Cyan
    $deadline = (Get-Date).AddSeconds(60)
    $ready = $false
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:$Port/login" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 800 }
    }
    if (-not $ready) {
        Write-Host "  app did not respond on port $Port within 60s." -ForegroundColor Red
        return
    }
    $envFile = Join-Path $appDir '.env.local'
    $seedKey = 'powerbid-demo'
    if (Test-Path $envFile) {
        $line = Select-String -Path $envFile -Pattern '^SEED_KEY=' -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($line) { $seedKey = ($line.Line -split '=',2)[1].Trim().Trim('"') }
    }
    Write-Host "  seeding via X-Seed-Key=$seedKey ..." -ForegroundColor Cyan
    try {
        $resp = Invoke-RestMethod -Method Post `
            -Uri "http://localhost:$Port/api/admin/seed-demo" `
            -Headers @{ 'X-Seed-Key' = $seedKey } `
            -TimeoutSec 60
        Write-Host ("  seeded: " + ($resp.summary | ConvertTo-Json -Compress)) -ForegroundColor Green
    } catch {
        Write-Host "  seed failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nReady → http://localhost:$Port" -ForegroundColor Green
