@echo off
setlocal

set "AIS_SCRIPT_DIR=%~dp0"
set "AIS_APP_ROOT=%AIS_SCRIPT_DIR%"

if not exist "%AIS_APP_ROOT%\frontend\package.json" (
  if exist "%AIS_SCRIPT_DIR%project\frontend\package.json" set "AIS_APP_ROOT=%AIS_SCRIPT_DIR%project"
)

if not exist "%AIS_APP_ROOT%\frontend\package.json" (
  echo Could not find frontend package.json.
  echo Expected: "%AIS_SCRIPT_DIR%frontend\package.json"
  exit /b 1
)

echo === AI Investment Assistant Backup ===
echo App root: %AIS_APP_ROOT%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$appRoot=(Resolve-Path -LiteralPath $env:AIS_APP_ROOT).Path.TrimEnd('\');" ^
  "$workspace=Split-Path -Parent $appRoot;" ^
  "$projectName=Split-Path -Leaf $appRoot;" ^
  "$backupRoot=Join-Path $workspace ($projectName + '.Backup');" ^
  "$stamp=Get-Date -Format 'yyyyMMddHHmm';" ^
  "$target=Join-Path $backupRoot ('project.' + $stamp);" ^
  "$index=1;" ^
  "while (Test-Path -LiteralPath $target) { $target=Join-Path $backupRoot ('project.' + $stamp + '-' + ('{0:D2}' -f $index)); $index++ }" ^
  "New-Item -ItemType Directory -Force $backupRoot | Out-Null;" ^
  "Write-Host ('Backup target: ' + $target);" ^
  "$excludedDirs=@('.venv','.runtime','node_modules','.next','.turbo','.pytest_cache','__pycache__');" ^
  "$excludedFiles=@('*.log');" ^
  "$args=@($appRoot,$target,'/MIR','/R:2','/W:1','/NFL','/NDL','/NP','/XD') + $excludedDirs + @('/XF') + $excludedFiles;" ^
  "& robocopy.exe @args;" ^
  "$code=$LASTEXITCODE;" ^
  "if ($code -gt 7) { throw ('robocopy failed with exit code ' + $code) }" ^
  "$manifest=Join-Path $target 'BACKUP_MANIFEST.txt';" ^
  "$head=(git -C $appRoot rev-parse --short HEAD 2>$null);" ^
  "$branch=(git -C $appRoot rev-parse --abbrev-ref HEAD 2>$null);" ^
  "@('AI Investment Assistant backup',('created_at=' + (Get-Date).ToString('s')),('source=' + $appRoot),('branch=' + $branch),('commit=' + $head)) | Set-Content -Path $manifest -Encoding utf8;" ^
  "Write-Host '[OK] Backup created.';" ^
  "Write-Host $target;"

if errorlevel 1 exit /b %ERRORLEVEL%

echo.
echo Done.

endlocal
