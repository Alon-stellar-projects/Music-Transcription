/**
 * Author: Alon Haviv, Stellar Intelligence.
 *
 * A module that handles interactions with files and directories, including creating, deleting 
 * and supporting them.
 * */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const solutionBasePath = path.join(__dirname, '..', '..');
const myLoggers = require(path.join(solutionBasePath, 'Music_Transcription_App', 'utils', 'loggers.js'));
const ENVS = myLoggers.ENVS;  // Object containing the allowed environments (dev, production, ...).

// Count the total number of audio files uploaded since the last reset of 
// the system(useful to generate a unique ID for each file.)
var fileCounter = 1;

/**
 * Return a unique ID (string).
 */
function generate_new_id() {
    const id = String(fileCounter++) + '-' +
        (+new Date()).toString() + '-' +
        crypto.randomBytes(6).toString('hex');

    return id;
}

/**
 * Delete the given directory and all its content after a given timeout (in ms).
 * If no valid, positive time is given, the default is 0 ms.
 * @param {string} dirPath The directory to delete.
 * @param {number|string} timeMs The delay time in ms. Could be a number (0, 1.5, 3000...) or a 
 *  string hat evaluates to a number ('0', '1.5', '60 * 1000'...).
 */
function deleteDirectoryWithDelay(dirPath, timeMs = 0) {
    // Read and set the timeout in ms:
    if (typeof timeMs !== 'string' && typeof timeMs !== 'number')
        timeMs = 0;
    if (typeof timeMs === 'string') {
        // Example: timeMs = "60 * 1000" ( = 1 min)
        try {
            timeMs = eval(timeMs);
        } catch (e) { timeMs = 0; }
    }
    if (timeMs < 0)
        timeMs = 0;

    setTimeout(() => {
        deleteDirectorySync(dirPath);
        myLoggers.log(ENVS.DEVELOPMENT, `Audio directory \"${path.basename(dirPath)}\" was deleted` +
            ` after ${timeMs}ms timeout.`);
    }, timeMs);
}

/**
 * Delete the given directory and all its content immediately.
 * If the directory doesn't exist nothing happens.
 * @param {string} dirPath The directory to delete.
 */
function deleteDirectorySync(dirPath) {
    try {
        fs.rmSync(dirPath, { recursive: true, force: true });  // force=true also ignores Exceptions if dirPath doesn't exist.
        myLoggers.log(ENVS.DEVELOPMENT, `Audio directory \"${path.basename(dirPath)}\" was deleted`);
    } catch (err) {
        myLoggers.errorLog(ENVS.ALL, `Failed to remove ${dirPath}:`, err)
    }
}

// Exporting:
module.exports = {
    generate_new_id: generate_new_id,
    deleteDirectoryWithDelay: deleteDirectoryWithDelay,
    deleteDirectorySync: deleteDirectorySync
}
