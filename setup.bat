@echo off
setlocal enabledelayedexpansion

:: --------- CONFIG ---------
set PYTHON_VERSION=3.10
set PYTHON_ENV_DIR=%~dp0Software\Machine_Learning_Python\venv
set REQUIREMENTS_FILE=%~dp0Software\Machine_Learning_Python\requirements.txt
set NODE_DIR=%~dp0Software\Music_Transcription_App
:: --------------------------

:: --------- Python Setup ---------

:: Create virtual env if not exists
if not exist "%PYTHON_ENV_DIR%" (
    echo Creating Python virtual environment...
    py -%PYTHON_VERSION% -m venv "%PYTHON_ENV_DIR%"
)

:: Activate virtual env
call "%PYTHON_ENV_DIR%\Scripts\activate.bat"
echo Python virtual environment activated at "%PYTHON_ENV_DIR%"

:: Install dependencies quietly. On Windows it's not guaranteed to work because of the expected 
:: compatibility errors. Manual installation however does work (even with the errors).
echo Installing Python dependencies...
python -m pip install --upgrade pip > nul
python -m pip install --no-cache-dir -r "%REQUIREMENTS_FILE%" --quiet || (
    echo Python dependency installation failed.
    exit /b 1
)
echo ... Done!

:: --------- Node.js Setup ---------

:: Install Node.js dependencies
cd /d "%NODE_DIR%"
echo Installing Node.js dependencies...
npm install --silent
if %errorlevel% neq 0 (
  echo npm install failed. Please check that Node.js is installed properly and check that "%NODE_DIR%\package.json" is configured properly.
  exit /b 1
)
echo ... Done!

echo Setup completed successfully.
