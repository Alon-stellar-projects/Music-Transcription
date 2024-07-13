////'use strict';
////const multer = require('multer');
////const express = require('express');
////const path = require('path');
////const fs = require('fs');
////const crypto = require('crypto');
////const { spawn } = require('child_process');
////const net = require('net');

////var router = express.Router();
////const solutionBasePath = path.join(__dir//me, '..', '..');
//////const controller = require(path.join(solutionBasePath, 'Music_Transcription_App', 'controllers', 'controller.js'));
////const consts = JSON.parse(fs.readFileSync(path.join(solutionBasePath, 'Consts.json'), { encoding: 'utf8', flag: 'r' }));
////const uploadAudioDir = path.join(solutionBasePath, 'uploads', 'audio');
////const pythonConverterPath = path.join(solutionBasePath, 'Machine_Learning_Python', 'converter.py');
////const pythonPDFConverterPath = path.join(solutionBasePath, consts['pythonNoteConverterPath']);
////const pythonImageGeneratorPath = path.join(solutionBasePath, consts['pythonImageGeneratorPath']);
////// Set up multer for file upload handling
////const upload = multer();
/////*const upload = multer({
////    dest: uploadAudioDir,
////    filename: function (req, file, cb) {
////        var newName = path.parse(file.originalname).name + '-' +
////            (+new Date()).toString() + '-' +
////            crypto.randomBytes(6).toString('hex') +
////            path.parse(file.originalname).ext;
////        cb(null, newName);
////    },
////    limits: { fileSize: 10e6 },  // 10MB
////    fileFilter: (req, file, callback) => {
////        if (!file.mimetype.startsWith('audio')) {
////            return callback(new Error('Please upload an audop file.'))
////        }
////        callback(undefined, true);
////    }
////});*/

////const saveEveryFile = true;
////const saveAudioFile = true;
////const jDataFileName = consts["json_data_file_name"];
////var fileCounter = 0;

////function get_specific_dir_path(idName) {
////    return path.join(uploadAudioDir, idName);
////}

////function get_specific_jData_file_path(id) {
////    console.log('id =', id, ', jDataFileName =', jDataFileName);
////    return path.join(get_specific_dir_path(id), jDataFileName);
////}

/////* GET home page. */
////router.get('/', function (req, res) {
////    res.render('index', { title: 'Home', uploadLimit: consts["max_files_transfer"] });
////});

////router.get('/about', function (req, res) {
////    res.render('about', { title: 'About' });
////});

////router.get('/file/img/:id', function (req, res) {
////    const id = req.params.id;  // The id of the requested notes sheet.
////    //res.send('Sends an image with id ' + id);
////    send_image_response(id, res);
////});

////router.get('/file/pdf/:id', function (req, res) {
////    const id = req.params.id;  // The id of the requested notes sheet.
////    //res.send('Sends a PDF with id ' + id);
////    send_pdf_response(id, res);
////});

////router.get('/file/data/:id', function (req, res) {
////    const id = req.params.id;  // The id of the requested notes sheet.
////    const filePath = get_specific_jData_file_path(id);

////    if (!fs.existsSync(filePath)) {
////        console.log('\tFile not exists!');
////        return res.status(404).render('error', {
////            title: 'File Not Found!',
////            message: "The requested file ID doesn't match any existing file.",
////            error: {}
////        });
////    }
////    send_data_response(filePath, res);
////});

////function send_data_response(dataPath, res) {
////    // Read the file and send it:
////    fs.readFile(dataPath, 'utf8', (err, data) => {
////        if (err) {
////            console.log('\tFile not read!');
////            return res.status(500).render('error', {
////                title: 'Internal Server Error',
////                message: "Could not read the requested data.",
////                error: {}
////            });
////        }
////        res.json(JSON.parse(data));
////    });
////}

////function spawnPythonProcess(pythonProgPath, args=[]) {
////    // Launch the Python program
////    const pythonNotesConverter = spawn('python', [pythonProgPath, ...args]);

////    pythonNotesConverter.stdout.on('data', (data) => {
////        console.log(`stdout: ${data}`);
////    });

////    pythonNotesConverter.stderr.on('data', (data) => {
////        console.error(`stderr: ${data}`);
////    });

////    pythonNotesConverter.on('close', (code) => {
////        console.log(`Python process exited with code ${code}`);
////    });

////    return pythonNotesConverter;
////}

////router.post('/file', upload.any('audio_input'), async function (req, res) { // What if someone presses many times the "Convert" button fosr the same uploaded file?
////    //router.post('/file', function (req, res) {
////    //    upload.any('audio_input')(req, res, async (err) => {
////    //    });
////    let files = req.files;
////    var idArr = [];
////    let dirPath;

////    if (files) {
////        if (files.length > consts['max_files_transfer'])
////            files = files.slice(0, consts['max_files_transfer']);
////        //idArr = new Array(files.length);
////        //for (let file of files)

////        // Spawn the python convertor here, so we don't need to use multiple ports at each time.
////        // MAke a max-num-of-files parameter in Consts.json, for the number of clients/sockets, and add checks that we don't exceed it.

////        /*
////        const pythonNotesConvertor = spawnPythonProcess(pythonPDFConverterPath, args=[]);  // UNCOMMENT
////        */

////        //files.forEach(async (file, i) => {  // Change it to support sync run!
////        for (var i in files) {
////            var file = files[i];
////            //idArr[i] = generate_new_id();
////            file.id = generate_new_id();
////            dirPath = get_specific_dir_path(file.id);
////            // Log some information about the uploaded file
////            console.log('Original name:', file.originalname);
////            console.log('MIME type:', file.mimetype);
////            console.log('File received:', file);
////            console.log('data:', file.buffer.toString("utf8"));

////            // Saves the audio file and its data in a proper directory:
////            //idArr[i] = file.id;
////            try {
////                await save_file(file, dirPath);  // Failed/succeed?
////                idArr.push(file.id);  // REMOVE!
////                /*  // UNCOMMENT
////                let convertRes = await convertAudio(file, dirPath, pythonNotesConvertor);  // Async task
 
////                if (convertRes) {
////                    idArr.push(file.id);
////                    // If saveEveryFile is False then every T minutes delete the folder. (add timeout to all the files here and once done delete the folders).
////                    if (!saveEveryFile)
////                        deleteDirectoryWithDelay(dirPath);
 
////                    //    idArr[i] = file.id;
////                    //    if (saveEveryFile)
////                    //        await save_file(file);
////                }*/
////            } catch (e) {
////                // remove the dir and all its files.
////                /*deleteDirectorySync(dirPath);*/  // UNCOMMENT
////                console.error(e.message);
////                //continue;
////            }
////        }//});
////    }
////    console.log('idArr =', idArr);
////    //let fileContent = 'Received file: ' + JSON.stringify(files);
////    //console.log('In app.js: req.method =', req.method, ', files =', JSON.stringify(files), ', type =', typeof (files));
////    //res.json({ result: fileContent });
////    //res.send(`File received: ${files[0]}\nOriginal name: ${files[0].originalname}\nMIME type: ${files[0].mimetype}`);
////    //res.sendFile(files[0]);

////    // What happens if there are several files? Need also to update the client side to handle several images in response.
////    res.json({ ids: idArr });
////    //send_image_response(idArr, res);
////});


////function convertAudio(audioFile, audioDirPath, pythonNotesConvertor) {
////    //var audioDirPath = get_specific_dir_path(audioFile.id);
////    return new Promise((resolve, reject) => {
////        convertToPdf(audioFile, pythonNotesConvertor)
////            .then(pdfData => savePdfToFile(pdfData, audioDirPath))
////            .then(() => convertAndSaveImage(audioDirPath))
////            .then(() => resolve(true))
////            .catch(err => {
////                console.error(err);
////                reject(false);
////            });
////    });
////}

////function convertToPdf(audioFile, pythonNotesConvertor) {
////    return new Promise((resolve, reject) => {
////        spawnPythonProcess(pythonNotesConvertor);

////        const client = new net.Socket();

////        client.connect(consts.py_converter_port, consts.py_converter_host, () => {
////            client.write(audioFile.buffer.toString("utf8"));  // ?
////        });

////        let receivedData = '';
////        client.on('data', (data) => {
////            receivedData += data.toString();
////        });

////        client.on('end', () => {
////            //console.log('Processed data:', receivedData);
////            client.destroy();
////            if (receivedData == consts["pdf_generation_failed"])
////                reject('Failed to convert the audio file to notes.');
////            else
////                resolve(receivedData);
////        });

////        client.on('close', () => {
////            console.log('Connection closed');
////        });
////    });
////}

////function savePdfToFile(pdfData, audioDirPath) {
////    return new Promise((resolve, reject) => {
////        const jDataFile = path.join(audioDirPath, jDataFileName);
////        fs.readFile(jDataFile, 'utf8', (err, data) => {
////            if (err) {
////                console.error('Error reading file:', err);
////                reject(`Failed to open ${jDataFileName} file:\n${err}`);
////            }

////            const pdfName = path.parse(jsonData['newName']).name + consts['pdf_ext'];
////            // Save to disc.
////            // Replace it with code that saves it as a PDF:
////            try {
////                fs.writeFileSync(path.join(audioDirPath, pdfName), pdfData);
////            } catch (err) {
////                reject(`Failed to save the PDF file.\n${err}`);
////            }

////            // Add the PDF path file name to the json data file:
////            let jsonData = JSON.parse(data);
////            jsonData[consts["pdf_key_in_jData"]] = pdfName;

////            fs.writeFile(jDataFile, JSON.stringify(jsonData), 'utf8', (err) => {
////                if (err) {
////                    console.error('Error writing file:', err);
////                    reject(`Failed to update ${jDataFileName} file:\n${err}`);
////                } else {
////                    console.log('jData file updated successfully.');
////                    resolve();
////                }
////            });
////        });
////    });

////}

////function convertAndSaveImage(audioDirPath) {
////    const pythonImgGen = spawn('python', [pythonImageGeneratorPath, audioDirPath]);
////    var stdoutData = '';
////    var stderrData = '';

////    return new Promise((resolve, reject) => {
////        pythonImgGen.stdout.on('data', (data) => {
////            stdoutData += data.toString();
////            //console.log(data.toString());
////        });

////        pythonImgGen.stderr.on('data', (data) => {
////            stderrData += data.toString();
////            //console.error(`stderr: ${data}`);
////        });

////        pythonImgGen.on('close', (code) => {
////            console.log('STDOUT:', stdoutData);
////            console.log('STDERR:', stderrData);

////            if (code == consts['convertion_success']) {
////                resolve(stdoutData);
////            } else {
////                reject('Failed to generate notes!\n' + stderrData);
////            }
////        });
////    });
////}

////function deleteDirectoryWithDelay(dirPath) {
////    let timeMs = consts['delete_files_timeout_millisec']; // 10 minutes in milliseconds
////    try {
////        if (typeof timeMs === 'string')
////            timeMs = eval(timeMs);
////    } catch (e) { timeMs = 0; }

////    setTimeout(() => {
////        deleteDirectorySync(dirPath);
////    }, timeMs);
////}

////function deleteDirectorySync(dirPath) {
////    try {
////        fs.rmSync(dirPath, { recursive: true, force: true });
////    } catch (err) {
////        console.error(`Failed to remove ${dirPath}:`, err)
////    }
////}



//////// Need to fix the function's asynchronization!!
//////function convertAudio(audioFile, audioDirPath) {
//////    //var audioDirPath = get_specific_dir_path(audioFile.id);
//////    //const pythonPDFConverter = spawn('python', [pythonPDFConverterPath, audioDirPath]);

//////    const client = new net.Socket();

//////    client.connect(consts.py_converter_port, consts.py_converter_host, () => {
//////        client.write(audioFile.buffer.toString("utf8"));  // ?
//////    });

//////    client.on('data', (data) => {
//////        dataStr = data.toString();
//////        console.log('Processed data:', dataStr);
//////        // Here if it's OK save both PDF data and original audio, and call the image-generator.
//////        if (dataStr == consts["pdf_generation_failed"]) {
//////            // Failed to convert.

//////        } else {
//////            // Convertion to PDF succeeded!

//////        }

//////        client.destroy(); // Kill client after server's response
//////    });

//////    client.on('close', () => {
//////        console.log('Connection closed');
//////    });
//////}

//////function convertAudio(audioFile) {
//////    //return true; // Delete it!

//////    var audioDirPath = get_specific_dir_path(audioFile.id)
//////    const pythonConverter = spawn('python', [pythonConverterPath, audioDirPath]);
//////    var pyData = '';

//////    pythonConverter.stdout.on('data', (data) => {
//////        pyData += data.toString();
//////        console.log(data.toString());
//////    });

//////    pythonConverter.stderr.on('data', (data) => {
//////        console.error(`stderr: ${data}`);
//////    });

//////    pythonConverter.on('close', (code) => {
//////        if (code !== consts.convertion_success) {
//////            return false;
//////        }
//////        else {
//////            let [pdfPath, imagePath] = pyData.split(Consts.split_py_stdout_char);
//////            console.log('pdfPath =', pdfPath, ', imagePath =', imagePath);
//////            return true;
//////        }

//////    });

//////    return false;

//////    /*pythonConverter.stdout.on('data', (data) => {
//////        const pdfPath = data.toString().trim();
//////        const pdfFile = fs.readFileSync(pdfPath);
//////        res.contentType('application/pdf');
//////        res.send(pdfFile);
//////    });

//////    pythonConverter.stderr.on('data', (data) => {
//////        console.error(`stderr: ${data}`);
//////        res.status(500).send('Error generating PDF');
//////    });*/
//////}

////function generate_new_id() {
////    const id = String(fileCounter++) + '-' +
////        (+new Date()).toString() + '-' +
////        crypto.randomBytes(6).toString('hex');

////    return id;
////}

/////*async function save_file(file, dirname) {
////    return new Promise(async (resolve, reject) => {
////        let res;
////        await setTimeout(async () => {
////            save_file_1(file, dirname)
////                .then(result => { res = result; });
////        }, 5000);
////        console.log('returning res...');
////        resolve(res);
////    });
////}*/

////function save_file(file, dirname) {
////    //const dirname = get_specific_dir_path(file.id);
////    var newName = path.parse(file.originalname).name + '-' + file.id + path.parse(file.originalname).ext;
////    /*var newName = path.parse(file.originalname).name + '-' +
////        (+new Date()).toString() + '-' +
////        crypto.randomBytes(6).toString('hex') + 
////        path.parse(file.originalname).ext;*/
////    const extraInfo = {
////        id: file.id,
////        originalName: file.originalname,
////        newName: newName,
////        downloadName: path.parse(file.originalname).name + consts["img_ext"]//'.jpg'  // .pdf  // The name of the file to be download is "originalname.pdf".
////    };
////    const extraInfoStr = JSON.stringify(extraInfo);
    

////    return new Promise(async (resolve, reject) => {
////        try {
////            if (!fs.existsSync(dirname)) {
////                fs.mkdirSync(dirname);
////            }

////            let writeFilePromises = [];
////            if (saveAudioFile)
////                // Save the audio file to disc:
////                writeFilePromises.push(fs.promises.writeFile(path.join(dirname, newName), file.buffer));
////            // Save the JSON data file to disc:
////            writeFilePromises.push(fs.promises.writeFile(get_specific_jData_file_path(file.id), extraInfoStr, 'utf8'));

////            // Run all the Promises and get their results into an array. Upon the first rejection, go to catch(error):
////            const resultsArr = await Promise.all(writeFilePromises);
////            // All files were saved successfully.
////            resolve('Files saved successfuly!');

////            //// How to use Promise.all or something else here?
////            //if (saveAudioFile) {
////            //    fs.writeFile(path.join(dirname, newName), file.buffer, (err) => {
////            //        if (err) {
////            //            console.error('Failed to save the file:\n' + err);
////            //        } else {
////            //            console.log('File saved successfuly!', file.originalname);
////            //        }
////            //    });
////            //}
////            //fs.writeFile(path.join(dirname, jDataFileName), extraInfoStr, 'utf8', (err) => {
////            //    if (err) {
////            //        console.error('Failed to save the file:\n' + err);
////            //    } else {
////            //        console.log('File saved successfuly!', file.originalname);
////            //    }
////            //});

////        } catch (error) {
////            reject('Failed to save the files:\n' + error);
////            //console.log('Error in save file:', error);
////        }
////    });
    

////    /*try {
////        //console.log(typeof (uploadAudioDir), typeof (newName));
////        //console.log('Path to save =', path.join(uploadAudioDir, newName));
////        fs.writeFile(path.join(uploadAudioDir, newName), file)  // file.buffer
////            .then(() => { console.log('File saved successfuly!', file.originalname); })
////            .catch(err => { console.error('Faile to save the file:\n' + err); });
////    } catch (e) { console.log('Error in save file:', e); }*/
////}

////function send_image_response(id, res) {
////    const imagePath = path.join(__dirname, '..', 'public', 'images', 'SnowGirl.jpg');
////    //console.log('In send_image_response: ', imagePath);
////    //console.log('In send_image_response: id =', id);

////    // Get the image file path:
////    /*const jDataPath = get_specific_jData_file_path(id);
////    let jData = JSON.parse(fs.readFileSync(jDataPath, 'r', 'utf8'));
////    const imagePathsArr = jData[consts['img_key_in_jData']].map(imgPath => path.join(get_specific_dir_path(id), imgPath));
////    const imagePath = imagePathsArr[0];*/

////    // Ensure the image file exists
////    if (!fs.existsSync(imagePath)) {
////        console.log('No picture @#$$');
////        return res.status(500).send('Image could not be generated.');
////    }

////    //res.send(imagePath);
////    // Send the image file as the response
////    //res.setHeader('Content-Type', 'image/jpg');
////    try {
////        res.sendFile(imagePath);
////    } catch (err) {
////        console.log('An error in res.sendFile: ', err);
////        res.status(500).send('Error in sending the file');
////    }
////    //console.log('res sent!');
////}

////function send_pdf_response(id, res) {
////    const pdfPath = path.join(__dirname, '..', 'public', 'images', 'SnowGirl.jpg');

////    // Get the clean name without the id, but with the file counter:
////    //const fileName = path.parse(pdfPath).name + path.parse(pdfPath).ext;
////    //const fileName = path.parse(pdfPath).name.slice(0, -idPartialStrLength) + path.parse(pdfPath).ext;

////    // Get the PDF file path:
////    /*const jDataPath = get_specific_jData_file_path(id);
////    let jData = JSON.parse(fs.readFileSync(jDataPath, 'r', 'utf8'));
////    const pdfPath = path.join(get_specific_dir_path(id), jData[consts.pdf_key_in_jData]);*/

////    // Ensure the image file exists
////    if (!fs.existsSync(pdfPath)) {
////        console.log('No picture @#$$');
////        return res.status(500).send('Pdf could not be generated.');
////    }

////    // Send the PDF file as the response
////    try {
////        res.sendFile(pdfPath);

////        /*fs.readFile(pdfPath, 'binary', (err, data) => {
////            if (err) {
////                console.error('Error reading file:', err);
////                return res.status(500).send('Error readicontroller.upload_middle//ware          }
////            res.json({
////                file: data,
////                fileName: fileName
////            });
////        });*/
////    } catch (err) {
////        console.log('An error in res.sendFile: ', err);
////        res.status(500).send('Error in sending the file');
////    }
////}


'use strict';
const express = require('express');
const path = require('path');

var router = express.Router();
const solutionBasePath = path.join(__dirname, '..', '..');
const controller = require(path.join(solutionBasePath, 'Music_Transcription_App', 'controllers', 'controller.js'));


/* GET home page. */
router.get('/', controller.get_home_page);


router.get('/about', controller.get_about_page);


router.get('/file/img/:id', controller.get_image_by_id);


router.get('/file/pdf/:id', controller.get_pdf_by_id);


router.get('/file/data/:id', controller.get_data_by_id);


router.post('/file', controller.upload_middleware, controller.post_audio_and_convert);


module.exports = router;
