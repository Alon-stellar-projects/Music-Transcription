#!/bin/bash

# --------- CONFIG ---------
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PYTHON_ENV_DIR="$SCRIPT_DIR/Software/Machine_Learning_Python/venv"
APP_DIR="$SCRIPT_DIR/Software/Music_Transcription_App"
ALLOWED_ENVS=("development" "production" "test")
DEFAULT_NODE_ENV="development"
# --------------------------

# Set NODE_ENV from first argument or default "development"
NODE_ENV="${1:-${DEFAULT_NODE_ENV}}"

# Validate NODE_ENV
if [[ ! " ${ALLOWED_ENVS[*]} " =~ " ${NODE_ENV} " ]]; then
    echo "Invalid NODE_ENV: '$NODE_ENV'"
    echo "Allowed values: ${ALLOWED_ENVS[*]}"
	NODE_ENV=${DEFAULT_NODE_ENV}
    exit 1
fi

export NODE_ENV
echo "Setting app with NODE_ENV=$NODE_ENV"

# Determine script directory and change to app dir
#cd "$APP_DIR"

# Activate Python virtual environment
source "$PYTHON_ENV_DIR/bin/activate"
#source "$PYTHON_ENV_DIR/Scripts/activate"
echo "Python virtual environment activated at \"Software/Machine_Learning_Python/venv\""

echo $PYTHONPATH
# Add the Python root directory into the PYTHONPATH if it's not in there yet
PYTHON_ROOT_PATH="$SCRIPT_DIR/Software/Machine_Learning_Python"
if [[ ":$PYTHONPATH:" != *":$PYTHON_ROOT_PATH:"* ]]; then
	export PYTHONPATH="$PYTHONPATH:$PYTHON_ROOT_PATH"
fi

# Start Node.js server
echo "~~ Launching Music Transcription App ~~"
node "$APP_DIR/app.js"
