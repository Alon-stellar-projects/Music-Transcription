/**
 * Author: Alon Haviv, Stellar Intelligence.
 *
 * Control functions for the incoming page requests, connected by the router module.
 */

const path = require('path');
const fs = require('fs');

const solutionBasePath = path.join(__dirname, '..', '..');
const myLoggers = require(path.join(solutionBasePath, 'Music_Transcription_App', 'utils', 'loggers.js'));

const ENVS = myLoggers.ENVS;  // Object containing the allowed environments (dev, production, ...).
const consts = JSON.parse(fs.readFileSync(path.join(solutionBasePath, 'Consts.json'), { encoding: 'utf8', flag: 'r' }));

/**
 * Render the home (index) page.
 * @param {any} req - A web request object.
 * @param {any} res - A web response object.
 */
const get_home_page = (req, res) => {
    const samples = load_samples_array();
    res.render('index', {
        title: 'Home',
        uploadLimit: consts["max_files_transfer"],
        allowedTypes: consts["valid_audio_extensions"],
        sizeLimitBytes: (consts['max_size_Bytes'] * consts['files_size_ratio']),  // * consts['files_size_ratio'] for extra space needed for protocol.
        downloadTimeLimit_min: consts["save_every_file"] ? -1 : eval(consts["delete_files_timeout_millisec"]) / 60000,
        downloadKeyInJData: consts["download_key_in_jData"],
        statusCodes: consts["status_codes"],
        instrumentsOptions: consts["instruments_options"],
        samples
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
 * Return a list of jsons of the form: {"id", "name", "imageName"}.
 * Each json is a metadata object for a sample audio piece.
 * The data is loaded from a special samples/ directory, specified in "consts.json".
 * */
function load_samples_array() {
    const samplesAudioDir = path.join(solutionBasePath, consts["samplesAudioDir"]);  // Main samples folder.
    const subDirsArr = consts["samplesAudioSubDirsLst"];  // List of specific samples sub-folder.
    const jDataFileName = consts["json_data_file_name"];  // Name of meta-data json file within each sample folder.
    let samplesArr = [];  // Will hold jsons with metadata for the sample audios.

    // Identifiers for jData:
    const idKey = consts["id_key_in_jData"],
        downloadKey = consts["download_key_in_jData"],
        imgKey = consts["img_key_in_jData"];

    // Scan the specific sample folders one by one:
    let jDataPath, jData;
    for (var subDir of subDirsArr) {
        try {
            jDataPath = path.join(samplesAudioDir, subDir, jDataFileName);
            jData = JSON.parse(fs.readFileSync(jDataPath, { encoding: 'utf8', flag: 'r' }));
            // Append the metadata of the sampled audio as a json to "samplesArr":
            samplesArr.push({
                "id": jData[idKey],
                "name": jData[downloadKey],
                "imageName": jData[imgKey][0]
            });
        } catch (err) {
            myLoggers.errorLog(ENVS.ALL, `Error in page_controller.js: Couldn't load "${jDataPath}". Reason:`, err);
            continue;
        }
    }

    return samplesArr;
}

// Export the controller functions:
module.exports = {
    get_home_page,
    get_about_page
}