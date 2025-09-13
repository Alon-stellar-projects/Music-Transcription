"""
A logger module for the Music-Transcription app. The functions "log(env, *args)" and "errorLog(env, *args)"
log the given data in args, just like print, if the given "env" parameter describes the name of the current 
running nodejs environment, or all environments (see ENVS Enum below for the options). The logs are written 
either into the console, if the running environment is 'development', or into log files called app.log and 
errors.log, if the environment is 'production'.

Author: Alon Haviv, Stellar Intelligence.
"""

import os
import sys
from datetime import datetime
from pathlib import Path
from enum import Enum
import json

solutionBasePath =  os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
with open(os.path.join(solutionBasePath, 'Consts.json'), 'r') as consts_file:
    consts = json.load(consts_file)

# Environment constants to be exported:
class ENVS(Enum):
    ALL = 'all'
    DEVELOPMENT = 'development'
    PRODUCTION = 'production'

# The current nodejs environment. If not set, then the default is development:
try:
    current_env = ENVS(os.environ.get('NODE_ENV', ENVS['DEVELOPMENT']))
except ValueError:
    current_env = ENVS.DEVELOPMENT

def get_current_timestamp() -> str:
    """Helper function to get the current timestamp."""
    return datetime.now().strftime('%m/%d/%Y, %I:%M:%S %p')

def write_to_file(message: str) -> None:
    """
    Perform the actual writing (append), either to the stdout or to the log file in consts.log_file.
    message - The message to print. New line is added at the end."""

    if current_env == ENVS['DEVELOPMENT']:
        print(message, flush=True)
    else:
        log_file_path = Path(os.path.join(solutionBasePath, consts['log_file'])).resolve()
        log_file_path.parent.mkdir(parents=True, exist_ok=True)  # Ensure directory exists
        with log_file_path.open('a', encoding='utf-8') as f:
            f.write(message + '\n')

def write_error_to_file(message: str) -> None:
    """
    Perform the actual writing (append), either to the stderr or to the log file in consts.errors_log_file.
    message - The message to print. New line is added at the end."""

    if current_env == ENVS['DEVELOPMENT']:
        print(message, file=sys.stderr, flush=True)
    else:
        error_log_file_path = Path(os.path.join(solutionBasePath, consts['errors_log_file'])).resolve()
        error_log_file_path.parent.mkdir(parents=True, exist_ok=True)  # Ensure directory exists
        with error_log_file_path.open('a', encoding='utf-8') as f:
            f.write(message + '\n')

def log(env: str, *args) -> None:
    """
    Log the given arguments to the main logger, iff the process current environment 
    matches the given "env".
    env - The nodejs environment in which the data can be logged. See options in "ENVS" object.
    args - The arguments to log (same behavior as in print)."""

    if env == ENVS['ALL'] or current_env == env:
        try:
            message = f"[{get_current_timestamp()}] {' '.join(map(str, args))}"
            write_to_file(message)
        except Exception as err:
            print(f"log() failed: {err}", file=sys.stderr, flush=True)

def error_log(env: str, *args: object) -> None:
    """
    Log the given arguments to the error logger, iff the process current environment 
    matches the given "env".
    env - The nodejs environment in which the data can be logged. See options in "ENVS" object.
    args - The arguments to log (same behavior as in console.error)."""

    if env == ENVS['ALL'] or current_env == env:
        try:
            message = f"[{get_current_timestamp()}] {' '.join(map(str, args))}"
            write_error_to_file(message)
        except Exception as err:
            print(f"error_log() failed: {err}", file=sys.stderr, flush=True)

# Expose
__all__ = ['ENVS', 'log', 'error_log']