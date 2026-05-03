@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

REM 读取 manifest.json 里的 version
for /f "tokens=2 delims=:," %%a in ('findstr /C:"\"version\"" manifest.json') do (
    set RAW=%%a
    set RAW=!RAW: =!
    set RAW=!RAW:"=!
    set VERSION=!RAW!
)

if "%VERSION%"=="" (
    echo [ERROR] 无法解析 manifest.json 里的 version
    exit /b 1
)

set OUT=dist\xxyy-convergence-alert-v%VERSION%.zip

if not exist dist mkdir dist
if exist "%OUT%" del "%OUT%"

echo [INFO] 打包 v%VERSION% -^> %OUT%

powershell -NoProfile -Command ^
  "Compress-Archive -Path 'manifest.json','content.js','network-hook.js','styles.css','icons' -DestinationPath '%OUT%' -Force"

if errorlevel 1 (
    echo [ERROR] 打包失败
    exit /b 1
)

echo.
echo [OK] 打包完成: %OUT%
for %%I in ("%OUT%") do echo      大小: %%~zI bytes
echo.
echo 上传到 GitHub Release:
echo   gh release create v%VERSION% "%OUT%" --title "v%VERSION%" --notes "见 README"
echo.
endlocal
