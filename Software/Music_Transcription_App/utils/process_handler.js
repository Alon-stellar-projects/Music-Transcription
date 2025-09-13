/**
 * Author: Alon Haviv, Stellar Intelligence.
 * 
 * A module that handles spawning another process, and reports its behavior.
 * */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const solutionBasePath = path.join(__dirname, '..', '..');
const Errors = require(path.join(solutionBasePath, 'Music_Transcription_App', 'utils', 'error_objects.js'));
const myLoggers = require(path.join(solutionBasePath, 'Music_Transcription_App', 'utils', 'loggers.js'));
const ENVS = myLoggers.ENVS;  // Object containing the allowed environments (dev, production, ...).

const consts = JSON.parse(fs.readFileSync(path.join(solutionBasePath, 'Consts.json'), { encoding: 'utf8', flag: 'r' }));


/**
 * Spawn a child process with the given path and arguments. If given "isAlive" object,
 * use it to notify the caller if the process is alive or dead.
 * Return the spawned process if successful.
 * Throw on an error if unsuccessful, or if the process exits immediately unsuccessfuly 
 * (success code: consts["convertion_success"]).
 * @param {string} progPath The path to the child process/program source file.
 * @param {string} launchCommand The command that launches the process according to its type. Default: 'python'.
 * @param {string[]} args (Default: []) Array of strings which is the arguments for the child program.
 * @param {json} isAlive (Default: undefined) A json object with the boolean field "isAlive", to keek track of the process status.
 * @param {function} stdoutCallback (default: undefined) Args: (data {object}). A callback function for the stdout.on('data') event.
 */
function spawnChildProcess_sync(progPath, launchCommand = 'python', args = [], isAlive = undefined, stdoutCallback = undefined) {

    const progName = path.basename(progPath);
    var stdoutData = '';
    var stderrData = '';

    // Verify:
    if (typeof launchCommand !== 'string' || !consts.supported_processes.includes(launchCommand)) {
        throw new Errors.SpawnProcessError(consts["status_codes"]["internal_server_error_code"],
            `${launchCommand} is not a supported process launching command`);
    }

    // Launch the child program
    let childProcess = spawn(launchCommand, ['-X', 'utf8', progPath, ...args], { stdio: ["pipe", "pipe", "pipe"] });
    if (isAlive !== undefined)
        isAlive.isAlive = true;  // Mark that the process is running.

    childProcess.on('error', (err) => {
        // The process failed to launch.
        myLoggers.errorLog(ENVS.ALL, `${progName} process got an error: ${err}`);
        if (isAlive !== undefined)
            isAlive.isAlive = false;  // Mark that the process is dead.
        throw new Errors.SpawnProcessError(consts["status_codes"]["internal_server_error_code"],
            `${progName} process Got an error: ${err}`);
    });

    childProcess.stdout.on('data', (data) => {
        if (!stdoutCallback) {
            stdoutData += data.toString('utf8').replace(/\r\n/g, '\n');  // The replace() ensures OS agnostic.
            const lines = stdoutData.split('\n');
            stdoutData = lines.pop();
            const output = lines.join('\n');
            if (output)
                myLoggers.log(ENVS.DEVELOPMENT, `${progName} process stdout: ${output}`);
        }
        else {
            try {
                stdoutCallback(data);
            } catch (e) { }
        }
    });

    childProcess.stderr.on('data', (data) => {
        stderrData += data.toString('utf8').replace(/\r\n/g, '\n');  // The replace() ensures OS agnostic.
        const lines = stderrData.split('\n');
        stderrData = lines.pop();
        const output = lines.join('\n');
        if (output)
            myLoggers.errorLog(ENVS.ALL, `${progName} process stderr: ${output}`);

        // An error message doesn't necessarily mean that the task failed completely. If
        // it does, the child process will close itself.
    });

    childProcess.on('close', (code) => {
        myLoggers.log(ENVS.ALL, `${progName} process exited with code ${code}`);
        if (isAlive !== undefined)
            isAlive.isAlive = false;  // Mark that the process is dead.
        // The process exited with an error code:
        if (code !== consts["convertion_success"])
            myLoggers.errorLog(ENVS.ALL, `${progName} process exited with the error code: ${code}`);
    });

    return childProcess;
}


/**
 * Spawn a child process with the given path and arguments. If given "isAlive" object, 
 * use it to notify the caller if the process is alive or dead.
 * Return a Promise that resolves when the spawned process is ready (stdout starts 
 * with: consts["server_is_ready_msg"]), and rejects on an error, or if the process 
 * exits unsuccessfuly (success code: consts["convertion_success"]).
 * @param {string} progPath The path to the child process/program source file.
 * @param {string} launchCommand The command that launches the process according to its type. Default: 'python'.
 * @param {string[]} args (Default: []) Array of strings which is the arguments for the child program.
 * @param {json} isAlive (Default: undefined) A json object with the boolean field "isAlive", to keek track of the process status.
 * @param {boolean} waitForReadyMsg - (Default: true) If true, wait for the process to send the 
 * server_is_ready_msg message before resolving, otherwize resolve after the process finishes successfully.
 */
async function spawnChildProcess(progPath, launchCommand = 'python', args = [], isAlive = undefined, waitForReadyMsg = true) {
    const progName = path.basename(progPath);
    var stdoutData = '';
    var stderrData = '';

    return new Promise((resolve, reject) => {
        // Verify:
        if (typeof launchCommand !== 'string' || !consts.supported_processes.includes(launchCommand)) {
            reject(new Errors.SpawnProcessError(consts["status_codes"]["internal_server_error_code"],
                `${launchCommand} is not a supported process launching command`));
            return;
        }

        // Launch the child program
        let childProcess = spawn(launchCommand, ['-X', 'utf8', progPath, ...args]);
        if (isAlive !== undefined)
            isAlive.isAlive = true;  // Mark that the process is running.

        childProcess.on('error', (err) => {
            // The process failed to launch.
            myLoggers.errorLog(ENVS.ALL, `${progName} process got an error: ${err}`);
            if (isAlive !== undefined)
                isAlive.isAlive = false;  // Mark that the process is dead.
            reject();
        });

        childProcess.stdout.on('data', (data) => {
            stdoutData += data.toString('utf8').replace(/\r\n/g, '\n');  // The replace() ensures OS agnostic.
            const lines = stdoutData.split('\n');
            stdoutData = lines.pop();
            const output = lines.join('\n');
            if (output)
                myLoggers.log(ENVS.DEVELOPMENT, `${progName} process stdout: ${output}`);

            // The child process is ready:
            if (waitForReadyMsg) {
                for (line of lines) {
                    if (line.startsWith(consts["server_is_ready_msg"])) {
                        resolve(childProcess);
                    }
                }
            }
        });

        childProcess.stderr.on('data', (data) => {
            stderrData += data.toString('utf8').replace(/\r\n/g, '\n');  // The replace() ensures OS agnostic.
            const lines = stderrData.split('\n');
            stderrData = lines.pop();
            const output = lines.join('\n');
            if (output)
                myLoggers.errorLog(ENVS.ALL, `${progName} process stderr: ${output}`);
            // An error message doesn't necessarily mean that the task failed completely. If 
            // it does, the child process will close itself.
        });

        childProcess.on('close', (code) => {
            myLoggers.log(ENVS.ALL, `${progName} process exited with code ${code}`);
            if (isAlive !== undefined)
                isAlive.isAlive = false;  // Mark that the process is dead.
            // Perhaps the child process failed before getting to send "server_is_ready_msg". 
            // In which case we reject:
            if (code !== consts["convertion_success"])
                reject(new Errors.SpawnProcessError(consts["status_codes"]["internal_server_error_code"],
                    `${progName} process exited with the error code: ${code}`));
            else {
                // The process finished successfully:
                resolve(childProcess);
            }
        });
    });
}

// Exporting:
module.exports = {
    spawnChildProcess_sync,
    spawnChildProcess,
}
