@echo off
REM Windows Sandbox LogonCommand can run before mapped folders are ready — wait, then run the PowerShell setup.
REM If setup did not auto-start, double-click this file inside the guest at:
REM   C:\Work\Completed integration\sandbox\Sandbox-Setup.cmd

set "LOG=%~dp0Sandbox-Setup-launcher.log"
echo.>>"%LOG%"
echo ============================================>>"%LOG%"
echo [%date% %time%] Sandbox-Setup.cmd started>>"%LOG%"
echo Waiting 25 seconds for mapped folder...>>"%LOG%"

REM LogonCommand often has a minimal PATH (timeout.exe not found); PowerShell is reliable.
powershell.exe -NoLogo -NoProfile -Command "Start-Sleep -Seconds 25" >>"%LOG%" 2>&1

echo [%date% %time%] Starting Sandbox-Setup.ps1...>>"%LOG%"
cd /d "%~dp0"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Sandbox-Setup.ps1" >>"%LOG%" 2>&1
set ERR=%ERRORLEVEL%
echo [%date% %time%] PowerShell exited with %ERR%>>"%LOG%"

if not "%ERR%"=="0" (
  echo Setup reported an error. Log: %LOG%
  pause
) else (
  echo Setup finished. Log: %LOG%
  pause
)
