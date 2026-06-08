@echo off
setlocal

set "AIS_SCRIPT_DIR=%~dp0"
set "AIS_APP_ROOT=%AIS_SCRIPT_DIR%"

if not exist "%AIS_APP_ROOT%\frontend\package.json" (
  if exist "%AIS_SCRIPT_DIR%project\frontend\package.json" set "AIS_APP_ROOT=%AIS_SCRIPT_DIR%project"
)

set "AIS_RUNTIME=%AIS_APP_ROOT%\.runtime"
set "AIS_LEGACY_RUNTIME=%AIS_SCRIPT_DIR%.runtime"
set "AIS_QUIET="

if /I "%~1"=="/quiet" set "AIS_QUIET=1"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='SilentlyContinue';" ^
  "$quiet=$env:AIS_QUIET -eq '1';" ^
  "if (-not $quiet) { Write-Host 'Stopping AI Investment Assistant services...' }" ^
  "function Stop-ProcessTree([int]$processId) { if ($processId -le 0) { return }; Start-Process -FilePath 'taskkill.exe' -ArgumentList @('/PID', $processId, '/T', '/F') -WindowStyle Hidden -Wait | Out-Null }" ^
  "$runtimeCandidates=@($env:AIS_RUNTIME,$env:AIS_LEGACY_RUNTIME) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique;" ^
  "foreach ($runtime in $runtimeCandidates) { foreach ($name in @('backend.pid','frontend.pid')) { $pidFile=Join-Path $runtime $name; if (Test-Path $pidFile) { Get-Content $pidFile | ForEach-Object { $text=$_.Trim(); if ($text -match '^\d+$') { Stop-ProcessTree ([int]$text) } }; Remove-Item -Force $pidFile } } }" ^
  "$portProcesses=@();" ^
  "try { $portProcesses=Get-NetTCPConnection -LocalPort 8010,3010 -State Listen | Select-Object -ExpandProperty OwningProcess -Unique } catch { $portProcesses=@() }" ^
  "if (-not $portProcesses -or $portProcesses.Count -eq 0) { $lines=& netstat.exe -ano | Select-String ':(8010|3010)\s+.*LISTENING'; foreach ($line in $lines) { $parts=($line.ToString() -split '\s+') | Where-Object { $_ }; $processIdText=$parts[-1]; if ($processIdText -match '^\d+$') { $portProcesses += [int]$processIdText } } }" ^
  "$portProcesses | Select-Object -Unique | ForEach-Object { Stop-ProcessTree ([int]$_) }"

if errorlevel 1 exit /b %ERRORLEVEL%
if not defined AIS_QUIET echo Stopped.

endlocal
