@echo off
cd /d "%~dp0"
echo Searching for PowerShell...

REM Try PowerShell 7 first (common locations)
if exist "C:\Program Files\PowerShell\7\pwsh.exe" (
    echo Using PowerShell 7 from: C:\Program Files\PowerShell\7\pwsh.exe
    "C:\Program Files\PowerShell\7\pwsh.exe" -ExecutionPolicy Bypass -File "download-all-2024-tiger-files.ps1"
    goto :end
)

if exist "C:\Program Files\PowerShell\8\pwsh.exe" (
    echo Using PowerShell 8 from: C:\Program Files\PowerShell\8\pwsh.exe
    "C:\Program Files\PowerShell\8\pwsh.exe" -ExecutionPolicy Bypass -File "download-all-2024-tiger-files.ps1"
    goto :end
)

REM Try pwsh from PATH
where pwsh >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo Using pwsh from PATH
    pwsh -ExecutionPolicy Bypass -File "download-all-2024-tiger-files.ps1"
    goto :end
)

REM Fall back to Windows PowerShell
echo Using Windows PowerShell (powershell.exe)
powershell.exe -ExecutionPolicy Bypass -File "download-all-2024-tiger-files.ps1"

:end
pause

