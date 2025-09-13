/**
 * Author: Alon Haviv, Stellar Intelligence.
 * 
 * Control functions for the incoming file uploading and downloading requests, connected by the router module.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const solutionBasePath = path.join(__dirname, '..', '..');
const { spawnChildProcess_sync, spawnChildProcess } = require(path.join(solutionBasePath, 'Music_Transcription_App', 'utils', 'process_handler.js'));
const f_handler = require(path.join(solutionBasePath, 'Music_Transcription_App', 'utils', 'files_handler.js'));
const errbj = require(path.join(solutionBasePath, 'Music_Transcription_App', 'utils', 'error_objects.js'));
const myLoggers = require(path.join(solutionBasePath, 'Music_Transcription_App', 'utils', 'loggers.js'));
const ENVS = myLoggers.ENVS;  // Object containing the allowed environments (dev, production, ...).

const currFilename = path.basename(__filename);
const consts = JSON.parse(fs.readFileSync(path.join(solutionBasePath, 'Consts.json'), { encoding: 'utf8', flag: 'r' }));
const uploadAudioDirPath = path.join(solutionBasePath, consts.uploadAudioDir);
const pythonTranscriberPath = path.join(solutionBasePath, consts['pythonNoteConverterPath']);
const pythonPDFGeneratorPath = path.join(solutionBasePath, consts['pythonPDFGeneratorPath']);
const pythonImageGeneratorPath = path.join(solutionBasePath, consts['pythonImageGeneratorPath']);
// Set up multer for file upload handling
const upload = multer();

// The generic name of a data json file of each uploaded audio directory:
const jDataFileName = consts["json_data_file_name"];

// Multer upload middleware is set to upload any audio input file:
const upload_middleware = upload.any('audio_input');

/**
 * This class represents a task of transcribing an audio file into midi.
 * The task object tracs the results of the transcription, with its Promise' resolver,
 * rejecter, timer (till self-reject) and the relevant task (audio) directory.
 * */
class TranscribeTask {
    /**
     * A constructor.
     * @param {function} resolver - A Promise' "resolve" object for the task.
     * @param {function} rejecter - A Promise' "reject" object for the task.
     * @param {object} timer - A setTimeout object that "rejects" the task if the timeout reached without resolving.
     * @param {string} taskFolder - The path of the audio file's directory.
     */
    constructor(resolver, rejecter, timer, taskFolder) {
        this.resolver = resolver;
        this.rejecter = rejecter;
        this.timer = timer;
        this.taskFolder = taskFolder;
    }
}



/**
 * Send an image data file whose ID is specified in the URL as req.params.id.
 * The image is a preview of the first page of the notes sheet.
 * @param {any} req - A web request object.
 * @param {any} res - A web response object.
 */
const get_image_by_id = (req, res) => {
    const id = req.params.id;  // The id of the requested notes sheet.
    send_image_response(id, res);
}

/**
 * Send a PDF data file whose ID is specified in the URL as req.params.id.
 * The PDF contains the notes sheet.
 * @param {any} req - A web request object.
 * @param {any} res - A web response object.
 */
const get_pdf_by_id = (req, res) => {
    const id = req.params.id;  // The id of the requested notes sheet.
    send_pdf_response(id, res);
}

/**
 * Send a MIDI file whose ID is specified in the URL as req.params.id.
 * The MIDI contains the transcribed notes.
 * @param {any} req - A web request object.
 * @param {any} res - A web response object.
 */
const get_midi_by_id = (req, res) => {
    const id = req.params.id;  // The id of the requested notes sheet.
    send_midi_response(id, res);
}

/**
 * Send a json object with meta-data regarding the audio directory whose ID 
 * is specified in the URL as req.params.id.
 * The data object is read from a file whose name is in jDataFileName, and 
 * is stored in the specific audio directory matching the given ID.
 * @param {any} req - A web request object.
 * @param {any} res - A web response object.
 */
const get_data_by_id = (req, res) => {
    const id = req.params.id;  // The id of the requested notes sheet.
    const filePath = get_specific_jData_file_path(id);

    // Check if the file exists:
    if (!fs.existsSync(filePath)) {
        return res.status(consts.status_codes.data_removed_code).render('error', {
            title: 'ID Not Found!',
            message: "The requested file ID doesn't exist or is no longer available.",
            error: {}
        });
    }
    send_data_response(filePath, res);
}

/**
 * Read the data from a given file path and send it as a json object as a response.
 * The file is expected to contain a data in a JSON format.
 * If an error occure, render a response with a proper error code.
 * @param {string} dataPath - The path to the json data file.
 * @param {any} res - A web response object.
 */
function send_data_response(dataPath, res) {
    fs.readFile(dataPath, 'utf8', (err, data) => {
        if (err) {
            myLoggers.errorLog(ENVS.ALL, `Couldn't read file ${dataPath}.`);
            return res.status(500).render('error', {
                title: 'Internal Server Error',
                message: "Could not read the requested data.",
                error: {}
            });
        }
        res.json(JSON.parse(data));
    });
}

/**
 * Handle posting of audio files and their convertion to PDF notes sheet files.
 * Get an audio file or files (in the request), generate a PDF notes sheet and 
 * a preview image (for each one), and store all of those files in a dedicated 
 * directory with a unique ID (for each original audio file). Send the IDs back 
 * as a response.
 * Even if not all the files are legal or converted successfuly, still send a 
 * success. Only if all of them failed send a proper failure code.
 * @param {any} req - A web request object.
 * @param {any} res - A web response object.
 */
const post_audio_and_convert = async (req, res) => {
    let files = req.files;  // File. The field "files" comes from the multer.
    let instrumentOptions = req.body.instrumentOptions;
    var idArr = [];  // The IDs for each file.
    var nameArr = [];  // The original basenames for each file.
    let errorCodesArr = [];  // Tracking the convertion errors.

    if (!instrumentOptions)
        instrumentOptions = consts.instruments_options.one.value;

    // Check for empty input:
    if (!files || files.length === 0) {
        res.status(consts.status_codes.bad_input).send();
        return;
    }
    // Check files' total size:
    if (files.reduce((sum, { size }) => sum + size, 0) / consts['files_size_ratio'] > consts.max_size_Bytes) {  // consts['files_size_ratio'] for the extra data that'll be added.
        res.status(consts["status_codes"]["files_too_large_code"]).send();
        return;
    }
    // Check that the number of files doesn't pass the limit:
    if (files.length > consts['max_files_transfer'])
        files = files.slice(0, consts['max_files_transfer']);

    try {
        // Main loop: Scan each file, convert and save it and all the results to disc:
        await convert_files_loop(files, idArr, nameArr, errorCodesArr, instrumentOptions);
    } catch (err) {
        res.status(consts["status_codes"]["internal_server_error_code"]).send();
        return;
    }

    const convertionSuccessRateStr = '(' + idArr.length + '/' + files.length + ').';

    // All the files failed!
    if (idArr.length === 0 && errorCodesArr.length > 0) {
        myLoggers.errorLog(ENVS.ALL, 'All files failed to be converted', convertionSuccessRateStr);
        res.status(getMostRelevantUploadError(errorCodesArr)).send();
        return;
    }

    // Everything is awesome!
    myLoggers.log(ENVS.DEVELOPMENT, 'Finished converting the files', convertionSuccessRateStr);
    res.status(consts["status_codes"]["upload_request_success"]).json({ ids: idArr, names: nameArr });
}

/**
 * Get an array of audio files and generate a PDF notes sheet and
 * a preview image for each one. Store all of those files in a dedicated
 * directory with a unique ID (for each original audio file).
 * Keep track of the IDs, error codes and the state of the notes-convertor process.
 * @param {File[]} files Array of audio files of type File.
 * @param {string[]} idArr Array of IDs (strings).
 * @param {string[]} nameArr Array of file names (strings).
 * @param {number[]} errorCodesArr Array of potential error codes (ints) that may occure in the process (one per file).
 * @param {number} instrumentOptions Indicates the type and number of musical instruments in the audio. See consts.instruments_options.
 */
async function convert_files_loop(files, idArr, nameArr, errorCodesArr, instrumentOptions) {
    // Spawn the AI convertor python process here so we don't have to launch the program a new for every 
    // file, and with a different port. Instead, we do it once for all the files, and handle each file via
    // a different client - socket connection.
    let pythonNotesConvertor;  // The process.
    let processIsAlive = { 'isAlive': false };  // Keep tracking on whether or not the process is still running.
    const { handleTranscriptionResponse, pendingTasks } = handleTranscriptionResponse_wrapper();
    try {
        pythonNotesConvertor = spawnChildProcess_sync(pythonTranscriberPath, launchCommand = 'python',
            args = [instrumentOptions], isAlive = processIsAlive, stdoutCallback = handleTranscriptionResponse);
    } catch (err) {
        // It might be possible for the process to report an error, but for some
        // reason not getting teminated by itself.
        if (processIsAlive.isAlive)  // In case it's still alive somehow.
            pythonNotesConvertor.kill();
        throw err;
    }

    // Main loop: Scan th files and handle each one:
    for (var file of files) {
        // Check the file's format:
        const errCode = verify_audio_file_format(file)
        if (errCode) {
            // Not a valid audio.
            errorCodesArr.push(errCode);
            continue;
        }

        file.id = f_handler.generate_new_id();
        const dirPath = get_specific_dir_path(file.id);
        // Log some information about the uploaded file:
        myLoggers.log(ENVS.ALL, `Server received file ${file.id}; MIME type: ${file.mimetype}; Original name: ${file.originalname}`);

        // Saves the audio file and its data in a proper directory:
        try {
            // Create a directory for the file and its future conversions:
            fs.mkdirSync(dirPath);

            // Check if the process isAlive:
            if (!processIsAlive.isAlive) {
                // The python convertor died/ended before all the files were processed => delete the directory:
                myLoggers.errorLog(ENVS.ALL, `id=${file.id}: The python transcriber died/ended before all the files were processed`);
                f_handler.deleteDirectorySync(dirPath);
                errorCodesArr.push(consts["status_codes"]["internal_server_error_code"]);
                break;  // End the for loop.
            }

            // Convert and store the results:
            await convertAudio(file, dirPath, pythonNotesConvertor, pendingTasks); 
            idArr.push(file.id);
            nameArr.push(path.parse(file.originalname).name);
            // If consts["save_every_file"] is false then every T minutes delete the folder:
            if (!consts["save_every_file"])
                f_handler.deleteDirectoryWithDelay(dirPath, consts['delete_files_timeout_millisec']);
        }
        catch (newErr) {
            // Either the saving or the convertion failed. Either way, delete the directory 
            // and all its files, and report the error.
            myLoggers.errorLog(ENVS.ALL, `id=${file.id}: ` + newErr.toString());
            f_handler.deleteDirectorySync(dirPath);
            errorCodesArr.push(newErr.hasOwnProperty('code') ? newErr.code : consts.status_codes.internal_server_error_code);

            continue; // Continue to the next file. 1 error shouldn't end the entire process.
        }
    }

    // Tell the child process that no more message will be sent:
    pythonNotesConvertor.stdin.end();

    // Kill pythonNotesConvertor if it's still running:
    setTimeout(() => {
        if (processIsAlive.isAlive) {
            pythonNotesConvertor.kill();
        }
    }, 2000);  // Better to aim to 100 ms, but for some reason sys.exit(code) only executes after ~2000 ms.
}

/**
 * Return the path for the spesific audio directory, for the given ID.
 * @param {string} idName - The ID of the relevant audio file/directory.
 */
function get_specific_dir_path(idName) {
    return path.join(uploadAudioDirPath, idName);
}

/**
 * Return the path for the data json file of the spesific audio directory, for the given ID.
 * @param {string} id - The ID of the relevant audio file/directory.
 */
function get_specific_jData_file_path(id) {
    return path.join(get_specific_dir_path(id), jDataFileName);
}

/**
 * Verifies that the format of the given audio file is valid, by comparing its name extension 
 * to consts["valid_audio_extensions"].
 * Returns null if the file is valid, or an error code if it is not.
 * @param {any} audioFile - The audio file object.
 */
const verify_audio_file_format = (audioFile) => {
    ext = path.parse(audioFile.originalname).ext;
    if (!consts["valid_audio_extensions"].includes(ext)) {
        return consts["status_codes"]["unsupported_media_type_code"];
    } else {
        return null;
    }
}

/**
 * Convert the given audio file into a notes sheet and save it as a PDF file and 
 * a preview image, in the given directory.
 * Return a Promise that resolves when the whole process is complete and rejects 
 * on an error.
 * @param {File} audioFile An audio file object to convert.
 * @param {string} audioDirPath The directory in which to save the results.
 * @param {object} pyTranscriber A python child process that transcribes the audio file into MIDI.
 * @param {Map} pendingTasks A "Map" object (id -> TranscribeTask) to track the transcription tasks.
 */
function convertAudio(audioFile, audioDirPath, pyTranscriber, pendingTasks) {
    return new Promise((resolve, reject) => {
        save_file(audioFile, audioDirPath)  // Save the audio and metadata in a new dir.
            .then((savedPaths) => transcribeToMidi(audioFile, audioDirPath, pyTranscriber, pendingTasks))  // Convert/transcribe to midi.
            .then(midiData => saveAsPdf(midiData, audioDirPath))  // Save a PDF of the notes.
            .then(() => saveAsImage(audioDirPath))  // Save preview images.
            .then(() => resolve())
            .catch(err => {
                reject(err);
            });
    });
}

/**
 * Convert an audio file into a midi (transcribing) and return a json with its meta-data,
 * in the format of "TranscribedMidiData" class.
 * The transcription is done by sending the task to a given python process' STDIN, in the 
 * format of "AudioDataToTranscribe" class (stringified), and the task is added to the 
 * given "pendingTasks" Map until its resolved (or rejected). The process, once done, returns 
 * the json with its meta-data through its STDOUT, in the format of "TranscribedMidiData" class.
 * 
 * Return a Promise with the midi meta-data json object, of the format of "TranscribedMidiData"
 * class, or an error of type "SpawnProcessError" or "SystemError" class, if an error occures or 
 * if a timeout reached wothout results from the python process.
 * (Resolving and rejecting the Promise is handled in the "handleTranscriptionResponse" function,
 * which access the task and its Promise using the "pendingTasks" Map).
 * @param {File} audioFile An audio file object to convert.
 * @param {string} audioDirPath The path to a directory where all the relevant files are saved.
 * @param {object} pyTranscriber A python child process that transcribes the audio file into MIDI.
 * @param {Map} pendingTasks A "Map" object (id -> TranscribeTask) to track the transcription tasks.
 */
function transcribeToMidi(audioFile, audioDirPath, pyTranscriber, pendingTasks) {
    return new Promise((resolve, reject) => {
        const taskId = audioFile.id;
        // According to the AudioDataToTranscribe class in serialized_objects.py:
        var dataToSend = {
            audio_dir_path: audioDirPath,
            data: audioFile.buffer.toString("base64"),
            id: taskId
        };

        // A timeout event to reject the task after not receiving any response for too long:
        const timer = setTimeout(() => {
            if (pendingTasks.has(taskId)) {
                pendingTasks.get(taskId).rejecter(new errbj.SpawnProcessError(consts["status_codes"]["internal_server_error_code"],
                    `${currFilename}: Trasncription task \"${taskId}\" is rejected because timeout reached!`));
                pendingTasks.delete(taskId);
            }
        }, consts['transcription_timeout_ms']);

        // Send the data to the server (transcribe.py) and add the task's Promise to the pendingTasks map:
        pyTranscriber.stdin.write(JSON.stringify(dataToSend) + "\n");
        pendingTasks.set(taskId, new TranscribeTask(resolve, reject, timer, audioDirPath));
        myLoggers.log(ENVS.DEVELOPMENT, `${currFilename} | id=${taskId}: Sent all the data to the python transcriber.`);

        // NOTE:
        // Resolving or rejecting the Promise is handled by "handleTranscriptionResponse()", after the 
        // "pyTranscriber" sends its results, which triggers the function as an stdio event handler.
    });
}

/**
 * A wrapper that initializes and then returns the callback function for the child process' 
 * stdout.on('data') event handler, and also returns a "Map" object (id -> TranscribeTask) to track 
 * the transcription tasks, which are checked and resolved/rejected by the returned callback function.
 * */
function handleTranscriptionResponse_wrapper() {
    const pendingTasks = new Map(); // {id -> TranscribeTask} Map for transcription tasks.
    let inBuffer = '';  // Holds the rechild process' stdout buffer (tasks' responses).
    const progName = path.basename(pythonTranscriberPath);

    /**
     * This is a callback function for the child process' stdout.on('data') event handler.
     * The function receives a data (bytes), parses it into task message results, and according 
     * to the results it resolves/rejects the matching task waiting in the "pendingTasks" map.
     * @param {object} data - The data (bytes).
     */
    function handleTranscriptionResponse(data) {
        data = data.toString('utf8').replace(/\r\n/g, '\n');  // The replace() ensures OS agnostic.
        inBuffer += data;
        let messages = inBuffer.split(consts["STDIO_MSG_POSTFIX"]);
        inBuffer = messages.pop();  // incomplete line stays

        for (let msg of messages) {
            msg = msg.trim();
            if (!msg)
                continue;

            if (msg.startsWith(consts["STDIO_DATA_MSG_PREFIX"])) {
                // A data message.
                msg = msg.slice(consts["STDIO_DATA_MSG_PREFIX"].length);

                let receivedData = undefined;
                try {
                    receivedData = JSON.parse(msg);
                    const taskId = receivedData.id;
                    const audioDirPath = (taskId && pendingTasks.has(taskId)) ? pendingTasks.get(taskId).taskFolder : '';
                    if (!isValidMidiData(receivedData, audioDirPath)) {
                        myLoggers.errorLog(ENVS.DEVELOPMENT, `${currFilename} | id=${taskId}: The data returned from the transcriber is missing data.`);
                        throw new errbj.SpawnProcessError(consts["status_codes"]["bad_input"],
                            `${currFilename}: Python transcriber failed due to bad input.`);
                    }

                    // Resolve the relevant transcription task:
                    const task = pendingTasks.get(taskId);
                    if (task) {
                        // Transcription succeeded.
                        myLoggers.log(ENVS.DEVELOPMENT, `${currFilename} | id=${taskId}:: Transcription task \"${taskId}\" completed successfully!`);
                        clearTimeout(task.timer);
                        task.resolver(receivedData);
                        pendingTasks.delete(taskId);
                    }
                }
                catch (error) {
                    // Transcription Failed.

                    if (!(error instanceof errbj.BaseError)) {
                        // JSON.parse failed.
                        error = new errbj.SystemError(consts["status_codes"]["internal_server_error_code"],
                            `${currFilename} side: Failed to parse the response from the Python transcriber into json. ${error}`);
                    }
                    myLoggers.errorLog(ENVS.DEVELOPMENT, `${currFilename}: Failed to transcribe.`);

                    if (receivedData && 'id' in receivedData) {
                        // Reject the task's promise.
                        const task = pendingTasks.get(receivedData.id);
                        if (task) {
                            clearTimeout(task.timer);
                            task.rejecter(error);
                            pendingTasks.delete(receivedData.id);
                        }
                    }
                    // Else: The promise' task will reject itself after its timer times-out.
                }
            }
            else {
                // A log message.
                myLoggers.log(ENVS.DEVELOPMENT, `${progName} process stdout: ${msg}`);
            }
        }
    }

    return { handleTranscriptionResponse, pendingTasks };
}

/**
 * Verify that the data received from the transcriber.py process is valid and has all the relevant components.
 * Return true/false accordingly.
 * @param {json} receivedMidiData The data received from the transcriber.py process, in json format.
 * @param {string} audioDirPath The path to the specific relevant audio directory in which the midi file should be located.
 */
function isValidMidiData(receivedMidiData, audioDirPath) {
    try {
        if (typeof receivedMidiData.code !== "number" || typeof receivedMidiData.id != "string")
            return false;
        if (!audioDirPath || fs.existsSync(path.join(audioDirPath, receivedMidiData.fnames[0])) === false)
            return false;
    } catch {
        return false;
    }

    return true;
}

/**
 * Save a PDF file based on the given data into the given audio directory. The 
 * exact name is to be determined by the data json file in the specific directory, 
 * whose name is in "jDataFileName" variable. Update this data file with the PDF 
 * filename.
 * Return a promise. Reject with a "SpawnProcessError" or "SystemError" object upon an error.
 * @param {any} midiData The data to be saved as a PDF.
 * @param {string} audioDirPath The directory in which to save the results.
 */
function saveAsPdf(midiData, audioDirPath) {
    return new Promise((resolve, reject) => {
        const jDataFile = path.join(audioDirPath, jDataFileName);
        // Read the data json file:
        fs.readFile(jDataFile, 'utf8', async (readError, data) => {
            if (readError) {
                reject(new errbj.SpawnProcessError(consts["status_codes"]["internal_server_error_code"],
                    `Failed to open ${jDataFileName} file:\n${readError}`));
            }

            let jsonData = JSON.parse(data);
            const midi_path = path.join(audioDirPath, midiData.fnames[0]);
            // Add the midi path file name to the json data file:
            jsonData[consts["midi_key_in_jData"]] = midiData.fnames[0];

            const pdfName = path.parse(jsonData[consts["media_key_in_jData"]]).name + consts['pdf_ext'];
            const pdf_path = path.join(audioDirPath, pdfName);
            const pdf_title = path.parse(jsonData[consts["download_key_in_jData"]]).name

            // Spawn the python process that converts the midi into a PDF file and saves it to disc.
            let pdfGenerator;  // The process.
            let processIsAlive = { 'isAlive': false };  // Keep tracking on whether or not the process is still running.
            try {
                pdfGenerator = await spawnChildProcess(pythonPDFGeneratorPath, launchCommand = 'python', args = [midi_path, pdf_path, pdf_title], isAlive = processIsAlive, waitForReadyMsg = false);
            } catch (err) {
                // It might be possible for the process to report an error, but for some
                // reason not getting teminated by itself.
                if (pdfGenerator !== undefined && processIsAlive.isAlive)  // In case it's still alive somehow.
                    pdfGenerator.kill();
                if (err instanceof errbj.BaseError)
                    reject(err);
                else
                    reject(new errbj.SpawnProcessError(consts["status_codes"]["internal_server_error_code"],
                        `Failed to convert the midi into a PDF file.\n${err}`));
                return;
            }

            // Add the PDF path file name to the json data file:
            jsonData[consts["pdf_key_in_jData"]] = pdfName;

            // Save the changes in the json data file to the disc:
            fs.writeFile(jDataFile, JSON.stringify(jsonData), 'utf8', (err) => {
                if (err) {
                    myLoggers.errorLog(ENVS.ALL, `id=${midiData.id}: Error writing to json data file:`, err);
                    reject(new errbj.SystemError(consts["status_codes"]["internal_server_error_code"],
                        `Failed to update ${jDataFileName} file:\n${err}`));
                } else {
                    resolve();
                }  // else
            });  // writeFile
        });  // readFile
    });  // Promise
}  // saveAsPdf

/**
 * Given a directory with a PDF file and a data json file, generate image files of the PDF 
 * pages, and save them in the directory. The name is based on data within the json data file, 
 * which will be updated with the images names. Spawns a python process to do all it.
 * Return a Promise with the process summary output, or throws a "SpawnProcessError" object.
 * @param {string} audioDirPath  The directory with the PDF and json data file, and where the image is to be saved.
 */
function saveAsImage(audioDirPath) {
    const progName = path.basename(pythonImageGeneratorPath);
    // Spawn a python process that performs the image generation and saving.
    const pythonImgGen = spawn('python', [pythonImageGeneratorPath, audioDirPath]);
    var stdoutData = '';
    var stderrData = '';

    return new Promise((resolve, reject) => {
        pythonImgGen.on('error', (err) => {
            // The process failed to launch.
            reject(new errbj.SpawnProcessError(consts["status_codes"]["internal_server_error_code"],
                `\"${progName}\" process got an error: ${err}`));
        });

        // Collect the process stdout:
        pythonImgGen.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        // Collect the process stderr:
        pythonImgGen.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        // Process ended. Resolve or reject according to the status code:
        pythonImgGen.on('close', (code) => {
            if (stdoutData) myLoggers.log(ENVS.ALL, `${progName} process STDOUT: ${stdoutData}`);
            if (stderrData) myLoggers.log(ENVS.ALL, `${progName} process STDERR: ${stderrData}`);

            if (code == consts['convertion_success']) {
                myLoggers.log(ENVS.ALL, `${progName} process exited successfully with the code: ${code}`);
                resolve(stdoutData);
            } else {
                reject(new errbj.SpawnProcessError(consts["status_codes"]["internal_server_error_code"],
                    `${progName} process failed to generate image and exited with the error code: ${code}`));
            }
        });
    });
}

/**
 * Save into the given directory path (dirPath) the following files:
 * 1) The given "file" if consts["save_audio_file"] is set to true.
 * 2) A new data json file with relevant meta data.
 * if the directory doesn't exist, create it.
 * Return a Promise that resolves on a sucess with an array of all the saved file paths, or rejects with a 
 * "SystemError" object on an error.
 * @param {File} file The file (audio) that is to be saved only if consts["save_audio_file"] is set to true.
 * @param {string} dirPath The path of the directory. If it doesn't exist, create it.
 */
function save_file(file, dirPath) {
    // The new name for "file":
    var mediaName = path.parse(file.originalname).name + '-' + file.id + path.parse(file.originalname).ext;
    var filePath = path.join(dirPath, mediaName);
    var savedPathsForResolve = [];  // will hold all the successfully saved paths. This array shall be sent upon resolve.
    // The json data for the json data file:
    const extraInfoStr = JSON.stringify({
        [consts["id_key_in_jData"]]: file.id,
        originalName: file.originalname,
        [consts["media_key_in_jData"]]: mediaName,
        [consts["download_key_in_jData"]]: path.parse(file.originalname).name,  // The name of the file to be download is "originalname".
    });

    return new Promise(async (resolve, reject) => {
        try {
            // Create the directory if it doesn't exist:
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath);
            }

            let writeFilePromises = [];
            if (consts["save_audio_file"]) {
                // Save the audio file to disc:
                writeFilePromises.push(fs.promises.writeFile(filePath, file.buffer));
                savedPathsForResolve.push(filePath);
            }
            // Save the JSON data file to disc:
            const jDataFilePath = get_specific_jData_file_path(file.id);
            writeFilePromises.push(fs.promises.writeFile(jDataFilePath, extraInfoStr, 'utf8'));
            savedPathsForResolve.push(jDataFilePath);

            // Run all the Promises and get their results into an array. Upon the first rejection, go to catch(error):
            const resultsArr = await Promise.all(writeFilePromises);
            // All the required files were saved successfully.
            resolve(savedPathsForResolve);
        } catch (error) {
            reject(new errbj.SystemError(consts["status_codes"]["internal_server_error_code"],
                'Failed to save the files:\n' + error));
        }
    });
}

/**
 * Given an array of upload errors status codes, return the one most relevant status 
 * code for the uploading process.
 * @param {number[]} errorsArr Array of status codes (numbers).
 */
function getMostRelevantUploadError(errorsArr) {
    if (errorsArr.includes(consts.status_codes.unsupported_media_type_code))
        return consts.status_codes.unsupported_media_type_code;
    if (errorsArr.includes(consts.status_codes.data_removed_code))
        return consts.status_codes.data_removed_code;
    if (errorsArr.includes(consts.status_codes.bad_input))
        return consts.status_codes.bad_input;

    return consts.status_codes.internal_server_error_code;
}

/**
 * Send an image file as a web response to the user client. The image is of the first 
 * page of the PDF notes sheet, matching the given id.
 * @param {string} id The ID of the converted audio file whose image is to be sent.
 * @param {any} res A web response object.
 */
function send_image_response(id, res) {
    // Get the image file path:
    const jDataPath = get_specific_jData_file_path(id);
    let jData = JSON.parse(fs.readFileSync(jDataPath, { encoding: 'utf8', flag: 'r' }));
    const imagePathsArr = jData[consts['img_key_in_jData']].map(imgPath => path.join(get_specific_dir_path(id), imgPath));
    const imagePath = imagePathsArr[0];

    // Ensure the image file exists
    if (!fs.existsSync(imagePath)) {
        return res.status(consts["status_codes"]["data_removed_code"]).send('Image could not be generated.');
    }

    // Send the image file as the response
    try {
        res.sendFile(imagePath);
    } catch (err) {
        myLoggers.errorLog(ENVS.ALL, `id=${id}: An error in \"send_image_response\": Could not send image to the client.`, err);
        res.status(consts["status_codes"]["internal_server_error_code"]).send(`Error in sending the image file.`);
    }
}

/**
 * Send a PDF file matching the given id, as a web response to the user client.
 * @param {string} id The ID of the converted audio file whose PDF notes sheet is to be sent.
 * @param {any} res A web response object.
 */
function send_pdf_response(id, res) {
    // Get the pdf file path:
    const jDataPath = get_specific_jData_file_path(id);
    let jData = JSON.parse(fs.readFileSync(jDataPath, { encoding: 'utf8', flag: 'r' }));
    const pdfPath = path.join(get_specific_dir_path(id), jData[consts['pdf_key_in_jData']]);

    // Ensure the pdf file exists
    if (!fs.existsSync(pdfPath)) {
        return res.status(consts["status_codes"]["data_removed_code"]).send('PDF could not be found.');
    }

    // Send the PDF file as the response
    try {
        res.sendFile(pdfPath);  // Same as res.download(midiPath).
    } catch (err) {
        myLoggers.errorLog(ENVS.ALL, `id=${id}: An error in \"send_pdf_response\": Could not send pdf to the client.`, err);
        res.status(consts["status_codes"]["internal_server_error_code"]).send('Error in sending the pdf file');
    }
}

/**
 * Send a MIDI file matching the given id, as a web response to the user client.
 * @param {string} id The ID of the converted audio file whose MIDI notes is to be sent.
 * @param {any} res A web response object.
 */
function send_midi_response(id, res) {
    // Get the midi file path:
    const jDataPath = get_specific_jData_file_path(id);
    let jData = JSON.parse(fs.readFileSync(jDataPath, { encoding: 'utf8', flag: 'r' }));
    const midiPath = path.join(get_specific_dir_path(id), jData[consts['midi_key_in_jData']]);

    // Ensure the midi file exists
    if (!fs.existsSync(midiPath)) {
        return res.status(consts["status_codes"]["data_removed_code"]).send('MIDI could not be found.');
    }

    // Send the MIDI file as the response
    try {
        res.download(midiPath);  // Same as res.sendFile(midiPath).
    } catch (err) {
        myLoggers.errorLog(ENVS.ALL, `id=${id}: An error in \"send_midi_response\": Could not send midi to the client.`, err);
        res.status(consts["status_codes"]["internal_server_error_code"]).send('Error in sending the midi file');
    }
}


// Export the controller functions:
module.exports = {
    get_image_by_id,
    get_pdf_by_id,
    get_midi_by_id,
    get_data_by_id,
    upload_middleware,
    post_audio_and_convert
}