@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Bitburner-AI-Patch\Patch.ps1" -Mode Install -GameDir "%~dp0."
if errorlevel 1 (echo Patch operation failed.)
pause
