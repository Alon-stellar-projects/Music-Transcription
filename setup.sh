#!/bin/bash

# Stop on any error
set -e

# --------- CONFIG ---------
PYTHON_VERSION=3.10
PYTHON_ENV_DIR=./Software/Machine_Learning_Python/venv
REQUIREMENTS_FILE=./Software/Machine_Learning_Python/requirements.txt
NODE_DIR=./Software/Music_Transcription_App
# --------------------------

# Determine project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# --------- Python Setup ---------
if ! command -v python3 &> /dev/null; then
    echo "Python 3 not found. Please install Python $PYTHON_VERSION+."
    exit 1
fi

# Create venv if not exists
if [ ! -d "$PYTHON_ENV_DIR" ]; then
    echo "Creating Python virtual environment..."
    python$PYTHON_VERSION -m venv "$PYTHON_ENV_DIR"
fi

# Activate venv
source "$PYTHON_ENV_DIR/bin/activate"
echo "Python virtual environment activated at \"$PYTHON_ENV_DIR\""

# Install dependencies quietly
echo "Installing Python dependencies..."
python -m pip install --upgrade pip > /dev/null
python -m pip install --no-cache-dir -r "$REQUIREMENTS_FILE" --quiet || {
    echo "Python dependency installation failed. See errors above.";
    exit 1;
}
echo "... Done!"

# --------- Node.js Setup ---------
cd "$NODE_DIR"

if ! command -v npm &> /dev/null; then
    echo "npm is not installed. Please install Node.js."
    exit 1
fi

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install --silent
if [ $? -ne 0 ]; then
	echo "npm install failed. Please check that Node.js is installed properly and check that \"$NODE_DIR/package.json\" is configured properly."
	exit 1
fi
echo "... Done!"

echo "Setup completed successfully."
