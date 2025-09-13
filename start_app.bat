@echo off
:: --------- CONFIG ---------
set PYTHON_ENV_DIR="%~dp0Software\Machine_Learning_Python\venv"
set APP_DIR="%~dp0Software\Music_Transcription_App"
set ALLOWED_ENVS=development production test
set DEFAULT_NODE_ENV=development
:: --------------------------

:: Set NODE_ENV from argument or default "development"
if "%1"=="" (
    set NODE_ENV=%DEFAULT_NODE_ENV%
) else (
    set NODE_ENV=%1
)

:: Validate NODE_ENV
set ENV_OK=false
for %%e in (%ALLOWED_ENVS%) do (
    if /I "%NODE_ENV%"=="%%e" set ENV_OK=true
)

if "%ENV_OK%"=="false" (
    echo Invalid NODE_ENV: "%NODE_ENV%"
    echo Allowed values: %ALLOWED_ENVS%
	set NODE_ENV=%DEFAULT_NODE_ENV%
    exit /b 1
)

echo Setting app with NODE_ENV = %NODE_ENV%

::cd /d "%APP_DIR%"

:: Activate Python virtual environment
call %PYTHON_ENV_DIR%\Scripts\activate.bat
echo Python virtual environment activated at "Software\Machine_Learning_Python\venv"

:: Add the Python root directory into the PYTHONPATH if it's not in there yet
set PYTHON_ROOT_PATH=%~dp0Software\Machine_Learning_Python
echo %PYTHONPATH% | findstr "%PYTHON_ROOT_PATH%" >nul
if errorlevel 1 (
	set PYTHONPATH=%PYTHONPATH%;%PYTHON_ROOT_PATH%
)

:: Start Node.js server
echo ~~ Launching Music Transcription App ~~
node %APP_DIR%\app.js
