/**
 * A logger module for the Music-Transcription app. The functions "log(env, ...args)" and "errorLog(env, ...args)"
 * log the given data in args, just like console.log, if the given "env" parameter describes the name of the current 
 * running environment, or all environments (see ENVS json below for the options). The logs are written either into 
 * the console, if the running environment is 'development', or into log files called app.log and errors.log, if 
 * the environment is 'production'.
 * 
 * Author: Alon Haviv, Stellar Intelligence.
 */

const fs = require('fs');
var path = require('path');

const solutionBasePath = path.join(__dirname, '..', '..');
const consts = JSON.parse(fs.readFileSync(path.join(solutionBasePath, 'Consts.json'), { encoding: 'utf8', flag: 'r' }));

// Environment constants to be exported:
const ENVS = {
    ALL: 'all',
    DEVELOPMENT: 'development',
    PRODUCTION: 'production'
};

// Get the current environment. If not set, then the default is development:
var currentEnv;
try {
    currentEnv = process.env.NODE_ENV || ENVS.DEVELOPMENT;
} catch {
    currentEnv = ENVS.DEVELOPMENT;
}

/**
 * Helper function to get the current timestamp.
 */
function getCurrentTimestamp() {
    return new Date().toLocaleString(); // Format: 'MM/DD/YYYY, HH:MM:SS AM/PM'
}

/**
 * Perform the actual writing (append), either to the stdout or to the log file in consts.log_file.
 * @param {string} message The message to print. New line is added at the end.
 */
const write_to_file = (message) => {
    if (currentEnv === ENVS.DEVELOPMENT) {
        console.log(message);
    } else {
        const logFilePath = path.join(solutionBasePath, consts["log_file"]);
        fs.mkdirSync(path.dirname(logFilePath), { recursive: true });  // Ensure directory exists
        fs.appendFileSync(logFilePath, message + '\n', { encoding: 'utf8' });
    }
};

/**
 * Perform the actual writing (append), either to the stderr or to the log file in consts.errors_log_file.
 * @param {string} message The message to print. New line is added at the end.
 */
const write_error_to_file = (message) => {
    if (currentEnv === ENVS.DEVELOPMENT) {
        console.error(message);
    } else {
        const errorLogFilePath = path.join(solutionBasePath, consts["errors_log_file"]);
        fs.mkdirSync(path.dirname(errorLogFilePath), { recursive: true });  // Ensure directory exists
        fs.appendFileSync(errorLogFilePath, message + '\n', { encoding: 'utf8' });
    }
};

/**
 * Log the given arguments to the main logger, iff the process current environment 
 * matches the given "env".
 * @param {string} env - The environment in which the data can be logged. See options in "ENVS" object.
 * @param {...any} args - The arguments to log (same behavior as in console.log).
 */
function log(env, ...args) {
    if (env === ENVS.ALL || currentEnv === env) {
        try {
            const message = `[${getCurrentTimestamp()}] ${args.join(' ')}`;
            write_to_file(message);
        } catch (err) {
            console.error('loggers.log() failed:', err.message);
        }
    }
}

/**
 * Log the given arguments to the error logger, iff the process current environment 
 * matches the given "env".
 * @param {string} env - The environment in which the data can be logged. See options in "ENVS" object.
 * @param {...any} args - The arguments to log (same behavior as in console.error).
 */
function errorLog(env, ...args) {
    if (env === ENVS.ALL || currentEnv === env) {
        try {
            const message = `[${getCurrentTimestamp()}] ${args.join(' ')}`;
            write_error_to_file(message);
        } catch (err) {
            console.error('loggers.errorLog() failed:', err.message);
        }
    }
}

// Exporting:
module.exports = {
    ENVS,
    log,
    errorLog
}
