/**
 * Author: Alon Haviv, Stellar Intelligence.
 * 
 * Control functions for the incoming requests, connected by the router module.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const net = require('net');

const solutionBasePath = path.join(__dirname, '..', '..');
const { SpawnProcessError } = require(path.join(solutionBasePath, 'Music_Transcription_App', 'utils', 'error_objects.js'));
const myLoggers = require(path.join(solutionBasePath, 'Music_Transcription_App', 'utils', 'loggers.js'));
const ENVS = myLoggers.ENVS;  // Object containing the allowed environments (dev, production, ...).

const consts = JSON.parse(fs.readFileSync(path.join(solutionBasePath, 'Consts.json'), { encoding: 'utf8', flag: 'r' }));
const uploadAudioDir = path.join(solutionBasePath, 'uploads', 'audio');
const pythonPDFConverterPath = path.join(solutionBasePath, consts['pythonNoteConverterPath']);
const pythonImageGeneratorPath = path.join(solutionBasePath, consts['pythonImageGeneratorPath']);
// Set up multer for file upload handling
const upload = multer();
/*const upload = multer({
    dest: uploadAudioDir,
    filename: function (req, file, cb) {
        var newName = path.parse(file.originalname).name + '-' +
            (+new Date()).toString() + '-' +
            crypto.randomBytes(6).toString('hex') +
            path.parse(file.originalname).ext;
        cb(null, newName);
    },
    limits: { fileSize: 10e6 },  // 10MB
    fileFilter: (req, file, callback) => {
        if (!file.mimetype.startsWith('audio')) {
            return callback(new Error('Please upload an audop file.'))
        }
        callback(undefined, true);
    }
});*/

// The generic name of a data json file of each uploaded audio directory:
const jDataFileName = consts["json_data_file_name"];
// Count the total number of audio files uploaded since the last reset of 
// the system(useful to generate a unique ID for each file.)
var fileCounter = 0;

// Multer upload middleware is set to upload any audio input file:
const upload_middleware = upload.any('audio_input');

/**
 * Render the home (index) page.
 * @param {any} req - A web request object.
 * @param {any} res - A web response object.
 */
const get_home_page = (req, res) => {
    res.render('index', {
        title: 'Home', uploadLimit: consts["max_files_transfer"],
        allowedTypes: consts["valid_audio_extensions"], sizeLimitKB: consts['max_size_KB'],
        statusCodes: consts["status_codes"]
    });
}

/**
 * Render the about page.
 * @param {any} req - A web request object.
 * @param {any} res - A web response object.
 */
const get_about_page = (req, res) => {
    res.render('about', { title: 'About' });
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
    let files = req.files;
    var idArr = [];  // The IDs for each file.
    let errorCodesArr = [];  // Tracking the convertion errors.

    // Check for empty input:
    if (!files || files.length === 0) {
        res.status(consts.status_codes.bad_input).send();
        return;
    }
    // Check files' total size:
    if (files.reduce((sum, { size }) => sum + size, 0) > consts.max_size_KB) {
        res.status(consts["status_codes"]["files_too_large_code"]).send();
        return;
    }
    // Check that the number of files doesn't pass the limit:
    if (files.length > consts['max_files_transfer'])
        files = files.slice(0, consts['max_files_transfer']);

    // Spawn the python process here so we don't have to launch the program a new for every file, 
    // and with a different port. Instead, we do it once for all the files, and handle each file via 
    // a different client - socket connection.
    let pythonNotesConvertor;  // The process.
    let processIsAlive = { 'isAlive': false };  // Keep tracking on whether or not the process is still running.
    try {
        pythonNotesConvertor = await spawnPythonProcess(pythonPDFConverterPath, args = [], isAlive = processIsAlive);
    } catch (err) {
        // It might be possible for the process to report an error, but for some
        // reason not getting teminated by itself.
        if (processIsAlive.isAlive)  // In case it's still alive somehow.
            pythonNotesConvertor.kill();
        res.status(consts["status_codes"]["internal_server_error_code"]).send();
        return;
    }

    // Scan each file, convert and save it and all the results to disc:
    for (var file of files) {
        file.id = generate_new_id();
        const dirPath = get_specific_dir_path(file.id);
        // Log some information about the uploaded file:
        myLoggers.log(ENVS.ALL, 'Original name:', file.originalname, ',', 'MIME type:', file.mimetype);
        myLoggers.log(ENVS.DEVELOPMENT, 'File received:', file);
        myLoggers.log(ENVS.DEVELOPMENT, 'data:', file.buffer.toString("utf8"));
        
        // Saves the audio file and its data in a proper directory:
        try {
            // Check if the process isAlive:
            await save_file(file, dirPath);
            if (!processIsAlive.isAlive) {
                // The python convertor died/ended before all the files were processed => delete the directory:
                myLoggers.errorLog(ENVS.ALL, `The python convertor died/ended before all the files were processed`);
                deleteDirectorySync(dirPath);
                errorCodesArr.push(consts["status_codes"]["internal_server_error_code"]);
                break;  // End the for loop.
            }

            // Convert and store the results:
            await convertAudio(file, dirPath);
            idArr.push(file.id);
            // If consts["save_every_file"] is false then every T minutes delete the folder:
            if (!consts["save_every_file"])
                deleteDirectoryWithDelay(dirPath);
        }
        catch (newErr) {
            // Either the saving or the convertion failed. Either way, delete the directory 
            // and all its files, and report the error.
            deleteDirectorySync(dirPath);
            myLoggers.errorLog(ENVS.ALL, newErr.hasOwnProperty('message') ? newErr.message : newErr.toString());
            errorCodesArr.push(newErr.hasOwnProperty('code') ? newErr.code : consts.status_codes.internal_server_error_code);
            continue; // Continue to the next file. 1 error shouldn't end the entire process.
        }
    }
    // Kill pythonNotesConvertor if it's still running:
    if (processIsAlive.isAlive) {
        pythonNotesConvertor.kill();
    }
    const convertionSuccesRateStr = '('+ idArr.length + '/' + files.length + ').';

    // All the files failed!
    if (idArr.length === 0 && errorCodesArr.length > 0) {
        myLoggers.errorLog(ENVS.ALL, 'All files failed to be converted', convertionSuccesRateStr);
        res.status(getMostRelevantUploadError(errorCodesArr)).send();
        return;
    }

    // Everything is awesome!
    myLoggers.log(ENVS.DEVELOPMENT, 'Fnished converting the files', convertionSuccesRateStr);
    res.status(consts["status_codes"]["upload_request_success"]).json({ ids: idArr });
}

/**
 * Return the path for the spesific audio directory, for the given ID.
 * @param {string} idName - The ID of the relevant audio file/directory.
 */
function get_specific_dir_path(idName) {
    return path.join(uploadAudioDir, idName);
}

/**
 * Return the path for the data json file of the spesific audio directory, for the given ID.
 * @param {string} id - The ID of the relevant audio file/directory.
 */
function get_specific_jData_file_path(id) {
    return path.join(get_specific_dir_path(id), jDataFileName);
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
 * Spawn a python process with the given path and arguments. If given "isAlive" object, 
 * use it to notify the caller if the process is alive or dead.
 * Return a Promise that resolves when the spawned process is ready (stdout starts 
 * with: consts["server_is_ready_msg"]), and rejects on an error or if the process 
 * finishes unsuccessfuly (success code: consts["convertion_success"])
 * @param {string} pythonProgPath The path to the python program.
 * @param {Array} args (Default: []) Array of strings which is the arguments for the python program.
 * @param {json} isAlive (Default: undefined) A json object with the boolean field "isAlive", to keek track of the process status.
 */
async function spawnPythonProcess(pythonProgPath, args = [], isAlive = undefined) {
    return new Promise((resolve, reject) => {
        // Launch the Python program
        let pythonNotesConverter = spawn('python', [pythonProgPath, ...args]);
        if (isAlive !== undefined)
            isAlive.isAlive = true;  // Mark that the process is running.
        
        pythonNotesConverter.on('error', (err) => {
            // The process failed to launch.
            myLoggers.errorLog(ENVS.ALL, `The python process got an error: ${err}`);
            if (isAlive !== undefined)
                isAlive.isAlive = false;  // Mark that the process is dead.
            reject();
        });

        pythonNotesConverter.stdout.on('data', (data) => {
            myLoggers.log(ENVS.DEVELOPMENT, `Python process stdout: ${data}`);
            // The pythons process is ready:
            if (data.toString().startsWith(consts["server_is_ready_msg"])) {
                resolve(pythonNotesConverter);
            }
        });

        pythonNotesConverter.stderr.on('data', (data) => {
            myLoggers.errorLog(ENVS.ALL, `Python process stderr: ${data}`);
            // An error message doesn't necessarily means a the task failed. If 
            // it does, the python process will close itself.
        });

        pythonNotesConverter.on('close', (code) => {
            myLoggers.log(ENVS.ALL, `Python process exited with code ${code}`);
            if (isAlive !== undefined)
                isAlive.isAlive = false;  // Mark that the process is dead.
            // Perhaps the python program failed before getting to send "server_is_ready_msg". 
            // In which case we reject:
            if (code !== consts["convertion_success"])
                reject();
        });
    });
}

/**
 * Convert the given audio file into a notes sheet and save it as a PDF file and 
 * a preview image in the given directory.
 * Return a Promise that resolves when the whole process is complete and rejects 
 * on an error.
 * @param {File} audioFile An audio file object to convert.
 * @param {string} audioDirPath The directory in which to save the results.
 */
function convertAudio(audioFile, audioDirPath) {
    return new Promise((resolve, reject) => {
        convertToPdf(audioFile)
            .then(pdfData => savePdfToFile(pdfData, audioDirPath))
            .then(() => convertAndSaveImage(audioDirPath))
            .then(() => resolve())
            .catch(err => {
                myLoggers.errorLog(ENVS.ALL, err);
                reject(err);
            });
    });
}

/**
 * Convert an audio file into a PDF and return it. For the convertion, open a connection to a 
 * python convertor process, with the host and port given in "Consts.json".
 * Return a Promise with the PDF data or an errorof type "SpawnProcessError" class, if occures.
 * @param {File} audioFile An audio file object to convert.
 */
function convertToPdf(audioFile) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket().setTimeout(consts['py_process_connection_timeout_ms']);  // A client connection with a response timeout.
        let receivedData = '';  // Collect the read data.

        // Establish a connection and send the file:
        client.connect(consts.py_converter_port, consts.py_converter_host, () => {
            myLoggers.log(ENVS.DEVELOPMENT, 'Socket connected!');
            client.write(audioFile.buffer.toString("utf8"));
        });

        // An error in the connection (such as 'ECONNREFUSED'):
        client.on('error', (err) => {
            reject(new SpawnProcessError(consts["status_codes"]["internal_server_error_code"],
                `Client socket failed to connect: ${err.code}`));
            client.destroy();
        });

        // Read a response data:
        client.on('data', (data) => {
            receivedData += data.toString();
        });

        // The connection has ended:
        client.on('end', () => {
            // Connection ended without sending anything:
            if (receivedData === '') {
                reject(new SpawnProcessError(consts["status_codes"]["internal_server_error_code"],
                    'Connection to python convertor ended suddenly without receiving anything.'));
            }
            // We have the data:
            else {
                receivedData = JSON.parse(receivedData);
                if (receivedData.code !== consts["convertion_success"]) {
                    // Convertion failed!
                    if (receivedData.code == consts["pdf_generation_failed_bad_input"])
                        // The input file isn't a valid audio file or some other problem.
                        reject(new SpawnProcessError(consts["status_codes"]["bad_input"],
                            'Python convertion to PDF notes failed due to bad input file.'));
                    else
                        // Internal error.
                        reject(new SpawnProcessError(consts["status_codes"]["internal_server_error_code"],
                            'Python convertion to PDF notes failed due to internal reasons.'));
                }
                else  // Convertion succeeded.
                    resolve(receivedData.data);
            }

            client.destroy();  // Will trigger 'close' event.
        });

        // A timeout event after not receiving anything for too long:
        client.on('timeout', () => {
            reject(new SpawnProcessError(consts["status_codes"]["internal_server_error_code"],
                'Python convertor does not respond (timeout reached)!'));
            client.destroy();  // Will trigger 'close' event.
        });

        // Socket connection closes:
        client.on('close', () => {
            myLoggers.log(ENVS.DEVELOPMENT, 'convertToPdf socket connection ended (client side).');
        });
    });
}

/**
 * Save a PDF file based on the given data into the given audio directory. The 
 * exact name is to be determined by the data json file in the specific directory, 
 * whose name is in "jDataFileName" variable. Update this data file with the PDF 
 * filename.
 * Return a promise. Reject with a "SpawnProcessError" object upon an error.
 * @param {any} pdfData The data to be saved as a PDF.
 * @param {string} audioDirPath The directory in which to save the results.
 */
function savePdfToFile(pdfData, audioDirPath) {
    return new Promise((resolve, reject) => {
        const jDataFile = path.join(audioDirPath, jDataFileName);
        // Read the data json file:
        fs.readFile(jDataFile, 'utf8', (err, data) => {
            if (err) {
                reject(new SpawnProcessError(consts["status_codes"]["internal_server_error_code"],
                    `Failed to open ${jDataFileName} file:\n${err}`));
            }

            let jsonData = JSON.parse(data);
            const pdfName = path.parse(jsonData['newName']).name + consts['pdf_ext'];
            // Save to disc.
            // Replace it with code that saves it as a PDF:
            try {
                fs.writeFileSync(path.join(audioDirPath, pdfName), pdfData);
            } catch (err) {
                reject(new SpawnProcessError(consts["status_codes"]["internal_server_error_code"],
                    `Failed to save the PDF file.\n${err}`));
            }

            // Add the PDF path file name to the json data file:
            jsonData[consts["pdf_key_in_jData"]] = pdfName;

            // Save the changes in the json data file to the disc:
            fs.writeFile(jDataFile, JSON.stringify(jsonData), 'utf8', (err) => {
                if (err) {
                    myLoggers.errorLog(ENVS.ALL, 'Error writing file:', err);
                    reject(new SpawnProcessError(consts["status_codes"]["internal_server_error_code"],
                        `Failed to update ${jDataFileName} file:\n${err}`));
                } else {
                    resolve();
                }  // else
            });  // writeFile
        });  // readFile
    });  // Promise
}  // savePdfToFile

/**
 * Given a directory with a PDF file and a data json file, generate image files of the PDF 
 * pages, and save them in the directory. The name is based on data within the json data file, 
 * which will be updated with the images names. Spawns a python process to do all it.
 * Return a Promise with the process summary output, or throws a "SpawnProcessError" object.
 * @param {string} audioDirPath  The directory with the PDF and json data file, and where the image is to be saved.
 */
function convertAndSaveImage(audioDirPath) {
    // Spawn a python process that performs the image generation and saving.
    const pythonImgGen = spawn('python', [pythonImageGeneratorPath, audioDirPath]);
    var stdoutData = '';
    var stderrData = '';

    return new Promise((resolve, reject) => {
        pythonImgGen.on('error', (err) => {
            // The process failed to launch.
            reject(new SpawnProcessError(consts["status_codes"]["internal_server_error_code"],
                `The python process \"${path.basename(pythonImageGeneratorPath)}\" got an error: ${err}`));
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
            myLoggers.log(ENVS.ALL, 'pythonImgGen process STDOUT:', stdoutData);
            myLoggers.log(ENVS.ALL, 'pythonImgGen process STDERR:', stderrData);

            if (code == consts['convertion_success']) {
                resolve(stdoutData);
            } else {
                reject(new SpawnProcessError(consts["status_codes"]["internal_server_error_code"],
                    'Failed to generate notes!\n' + stderrData));
            }
        });
    });
}

/**
 * Delete the given directory and all its content after a timeout, given in Consts.json
 * 'delete_files_timeout_millisec' (If no such time is given, the default is 0 ms).
 * @param {string} dirPath The directory to delete.
 */
function deleteDirectoryWithDelay(dirPath) {
    let timeMs = consts['delete_files_timeout_millisec']; // 10 minutes in milliseconds
    try {
        if (typeof timeMs === 'string')
            timeMs = eval(timeMs);
    } catch (e) { timeMs = 0; }

    setTimeout(() => {
        deleteDirectorySync(dirPath);
        myLoggers.log(ENVS.DEVELOPMENT, `Audio directory \"${path.basename(dirPath)}\" was deleted` +
            ` after ${timeMs}ms timeout.`);
    }, timeMs);
}

/**
 * Delete the given directory and all its content immediately.
 * @param {string} dirPath The directory to delete.
 */
function deleteDirectorySync(dirPath) {
    try {
        fs.rmSync(dirPath, { recursive: true, force: true });
    } catch (err) {
        myLoggers.errorLog(ENVS.ALL, `Failed to remove ${dirPath}:`, err)
    }
}

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
 * Given a directory path (dirPath), create it if it doesn't already exist and save into 
 * it the following files:
 * 1) The given file, if consts["save_audio_file"] is set to true.
 * 2) A new data json file with relevant meta data.
 * Return a Promise that resolves on a sucess with a proper message, or rejects with a 
 * "SpawnProcessError" object on an error.
 * @param {File} file The file (audio) that is to be saved only if consts["save_audio_file"] is set to true.
 * @param {string} dirPath The path of the directory. If it doesn't exist, create it.
 */
function save_file(file, dirPath) {
    // The new name for "file":
    var newName = path.parse(file.originalname).name + '-' + file.id + path.parse(file.originalname).ext;
    // The json data for the json data file:
    const extraInfoStr = JSON.stringify({
        id: file.id,
        originalName: file.originalname,
        newName: newName,
        downloadName: path.parse(file.originalname).name + consts["pdf_ext"],  // The name of the file to be download is "originalname.pdf".
    });

    return new Promise(async (resolve, reject) => {
        try {
            // Create the directory if it doesn't exist:
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath);
            }

            let writeFilePromises = [];
            if (consts["save_audio_file"])
                // Save the audio file to disc:
                writeFilePromises.push(fs.promises.writeFile(path.join(dirPath, newName), file.buffer));
            // Save the JSON data file to disc:
            writeFilePromises.push(fs.promises.writeFile(get_specific_jData_file_path(file.id), extraInfoStr, 'utf8'));

            // Run all the Promises and get their results into an array. Upon the first rejection, go to catch(error):
            const resultsArr = await Promise.all(writeFilePromises);
            // All files were saved successfully.
            resolve('Files saved successfuly!');
        } catch (error) {
            reject(new SpawnProcessError(consts["status_codes"]["internal_server_error_code"],
                'Failed to save the files:\n' + error));
        }
    });
}

/**
 * Given an array of upload errors status codes, return the one most relevant status 
 * code for the uploading process.
 * @param {Array} errorsArr Array of status codes (numbers).
 */
function getMostRelevantUploadError(errorsArr) {
    if (errorsArr.includes(consts.status_codes.unsupported_media_type_code))
        return consts.status_codes.unsupported_media_type_code;
    if (errorsArr.includes(consts.status_codes.data_removed_code))
        return consts.status_codes.data_removed_code;
    if (errorsArr.includes(consts.status_codes.bad_input))
        return consts.status_codes.bad_input;

    return errorsArr[0];  // It doesn't matter. Most likely it's "internal_server_error_code"
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
        myLoggers.errorLog(ENVS.ALL, 'An error in \"send_image_response\": Could not send image to the client.', err);
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
        res.sendFile(pdfPath);
    } catch (err) {
        myLoggers.errorLog(ENVS.ALL, 'An error in \"send_image_response\": Could not send pdf to the client.', err);
        res.status(consts["status_codes"]["internal_server_error_code"]).send('Error in sending the pdf file');
    }
}


// Export the controller functions:
module.exports = {
    get_home_page,
    get_about_page,
    get_image_by_id,
    get_pdf_by_id,
    get_data_by_id,
    upload_middleware,
    post_audio_and_convert
}