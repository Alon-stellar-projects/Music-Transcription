/**
 * Author: Alon Haviv, Stellar Intelligence.
 * 
 * The front-end functionality of the homepage (index.pug).
 */

// Elements:
const dropArea = document.getElementById('drop-area');
const uploadForm = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const uploadButton = document.getElementById('upload-button');
const clearButton = document.getElementById('clear-button');
const downloadButton = document.getElementById('download-button');
const uploadStatusMessage = document.getElementById('upload-status-message');
const downloadStatusMessage = document.getElementById('download-status-message');
const previewImage = document.getElementById('notes-img');

// Messages:
const NothingToUploadMsg = "Nothing to upload";
const InvalidFileErrorMsg = (fName) => `File ${fName} is not a valid audio file.`;
const UploadsLimitReachedMsg = (limit) => `The limit of ${limit} files was reached.`
const FilesTooHeavyMsg = `The uploaded files exceed the total size limit of ${Math.round(sizeLimitKB / 1024)}MB`
const FilesRemovedErrorMsg = 'The files are no longer available. Please upload again.';
const PressConvertMsg = "Press on \"Convert\" to convert the file(s)"
const UploadingMsg = "Uploading...";
const UploadSucceededMsg = "Upload Completed!";
const UploadSucceededPartialMsg = "Upload Completed! Some of the files could not be uploaded.";
const UploadFailedMsg = "Upload Failed!";
const UploadFailed500Msg = "Upload Failed! The problem is on our side.";
const DownloadFailedMsg = "Download Failed!";
const DownloadFailed500Msg = "Download Failed! Please try again in a moment.";

const harassmentCooldownMS = 700  // cooldown time in milliseconds for the upload and download buttons.

// First setup:

updateUploadingStatus(NothingToUploadMsg);
let audioFileLst = [];

// Adding events:

fileInput.addEventListener('change', handleFileInputChange);  // Add and handle file input change event.
dropArea.addEventListener('dragenter', handleDragEnter);  // Dragging a file into the drop area (entering event).
dropArea.addEventListener('dragover', handleDragOver);  // Dragging a file over the drop area event.
dropArea.addEventListener('dragleave', handleDragLeave);  // Dragging a file out of the drop area (leaving event).
dropArea.addEventListener('drop', handleFileDrop);  // Add and handle file drop event.
uploadForm.addEventListener('submit', handleSubmitFileUpload);  // Add and handle submition/uploading event.
clearButton.addEventListener('click', clearHandler);  // Clear button click event.
downloadButton.addEventListener('click', downloadHandler);  // Download button click event.

// Input handlers and other functions:

// Add and preprocess the new files added to "fileInput".
function handleFileInputChange(event) {
    preProcessInput(event.target.files);
    //preProcessInput(fileInput.files);
}

// Handler for the dragenter event that let us add visual effects.
function handleDragEnter(event) {
    event.preventDefault();
    event.stopPropagation();
    dropArea.classList.add('dragover');  // To allow 'dragover' visual styles.
}

// Dragover event handler, which enables it to receive drop events.
function handleDragOver(event) {
    // prevent default to allow drop:
    event.preventDefault();
    event.stopPropagation();
    dropArea.classList.add('dragover');  // To allow 'dragover' visual styles all the while the file is over it.
}

// Handler for the dragleave event that let us end visual effects.
function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    dropArea.classList.remove('dragover');  // To stop 'dragover' visual styles.
}

// Add and preprocess droped files into the file list for uploading.
function handleFileDrop(event) {
    event.preventDefault();
    dropArea.classList.remove('dragover');  // To stop 'dragover' visual styles.

    const fileList = event.dataTransfer.files;
    preProcessInput(fileList);
}

// Check the input files and prepare for uploading to the server:
function preProcessInput(fileList) {
    // Verify validity:
    try {
        assertFilesValid(fileList);
    } catch (err) {
        resetUpload();
        updateUploadingStatus(err.message);
        return;
    }

    if (fileList.length > uploadLimit) {
        // Trim excess files:
        audioFileLst = Array.prototype.slice.call(fileList, 0, uploadLimit);
        updateUploadingStatus(UploadsLimitReachedMsg(uploadLimit) + ' ' + PressConvertMsg);  // Inform the user about the slicing and to press "Convert".
    } else {
        audioFileLst = Array.prototype.slice.call(fileList);
        updateUploadingStatus(PressConvertMsg);  // Inform the user to press "Convert".
    }
    // Enabling the buttons:
    uploadButton.disabled = false;
    clearButton.disabled = false;
}

// Check that the given list of files is a valid list of supported audio files.
function assertFilesValid(files) {
    let totalSizeKB = 0;
    for (let file of files) {
        totalSizeKB += file.size;
        // Check total files size limit:
        if (totalSizeKB > sizeLimitKB)
            throw new Error(FilesTooHeavyMsg);
        // Check valid file type:
        if (!isAudioType(file.type))
            throw new Error(InvalidFileErrorMsg(file.name));
    }
}

// Check that the given file-type is a valid and supported audio type.
function isAudioType(fType) {
    if (!fType || typeof fType != 'string')
        return false;

    // Split, for example, 'audio/mpeg' to ['audio', 'mpeg']:
    const splitType = fType.split('/');
    if (splitType.length !== 2)
        return false;

    // Check if fType is allowed:
    return allowedTypes.includes(`.${splitType[1]}`);
}

// Submit/Upload:

// Handle the event of uploading the files to the server.
function handleSubmitFileUpload(event) {
    event.preventDefault();

    resetDownload();  // Reset the download button from any previous runs.
    // Disable the submit button for a short while to prevent harassments:
    uploadButton.disabled = true;
    setTimeout(() => {
        uploadButton.disabled = false;
        uploadFiles(audioFileLst);
    }, harassmentCooldownMS);
}

// Send the files in 'fileLst' to the server and fetch and present preview images to the user.
function uploadFiles(fileLst) {
    showPendingState();

    // Extra checks in case someone bypassed the previous checks:
    if (!fileLst || fileLst.length === 0 || fileLst.length > uploadLimit) {
        resetUpload();
        updateUploadingStatus(UploadFailedMsg);
        return;
    }

    // Preparing a form with the files to upload:
    let formData = new FormData();
    for (const file of fileLst) {
        // We get an array of objects: [{ name: 'file', value: file_1}, { name: 'file', value: file_2}, ...]
        formData.append('file', file);
    }

    /*// Print data for debugging:
    let reader = new FileReader();
    reader.readAsText(fileLst[0]);
    reader.onload = function () {
        console.log('In onload: ', reader.result);
    };*/

    // Upload the file and fetch a preview image:
    const url = '/file';
    fetch(url, {
        method: 'POST',
        body: formData
    })
        // Get a response and extract a JSON data (that should contain the preview images' IDs):
        .then((responsePost) => extractJsonFromUploadResponse(responsePost))
        // Get a json with the images' IDs, and fetch and show the image files themselves:
        .then(dataJson => fetchAndShowImagesByIdsArr(dataJson.ids))
        // Show a proper success message to the user:
        .then(successMsg => { showUploadSuccessState(successMsg) })
        .catch(err => {
            resetUpload();
            updateUploadingStatus(err.message);
        });
}

// Get a response from the server, check its status and return the 
// response's json, or throw an exception with a proper message.
function extractJsonFromUploadResponse(response) {
    // Check if the response is OK or we got an error:
    if (response.status !== statusCodes["upload_request_success"]) {
        // Get a proper upload-error message:
        let errorMsg = '';
        switch (response.status) {
            case statusCodes["files_too_large_code"]:
                // The total file size exceeds the maximum allowed.
                errorMsg = FilesTooHeavyMsg;
                break;
            case statusCodes["unsupported_media_type_code"]:
            case statusCodes["bad_input"]:
                // Not valid audio files.
                errorMsg = InvalidFileErrorMsg('(at least one)');
                break;
            case statusCodes["internal_server_error_code"]:
                // General internal server error:
                errorMsg = UploadFailed500Msg;
                break;
            default:
                // Any other error, including other internal server errors.
                errorMsg = UploadFailedMsg;
        }
        throw new Error(errorMsg);
    } else
        // Everything is awesome!
        return response.json();
}

// Fetch the image files with the given IDs (in idLst) from the server, show them to 
// the user and set the "downloadButton" with the IDs.
// Return a Promise with either a complete-success, partial-success or failure message, 
// depending on whether or not all, some or none of the images were fetched successfuly.
function fetchAndShowImagesByIdsArr(idLst) {
    let fetchImageCallsArr = [];  // Hold the Promise calls for idLst.
    for (let fileId of idLst) {
        fetchImageCallsArr.push(fetchImageByID(fileId));
    }
    return Promise.allSettled(fetchImageCallsArr)
        .then(results => {
            // Iterate through the array and separate the values based on status:
            let fulfilledValsArr = [];  // The returned values from fulfilled/resolved calls.
            let errorsArr = [];  // The errors from rejected calls.
            results.forEach(result => {
                if (result.status === "fulfilled") {
                    fulfilledValsArr.push(result.value);
                } else if (result.status === "rejected") {
                    errorsArr.push(result.reason);
                }
            });

            // Showing preview images and preparing the download button with the files' IDs:
            if (fulfilledValsArr.length > 0) {
                showPreviewImages(fulfilledValsArr.map(item => item.image));
                downloadButton.dataset.file_id = JSON.stringify(fulfilledValsArr.map(item => item.id));
            }

            // Return a message for complete success or partial success, or an error:
            if (fulfilledValsArr.length > 0 && errorsArr.length === 0) {
                return UploadSucceededMsg;
            } else if (fulfilledValsArr.length > 0 && errorsArr.length > 0) {
                return UploadSucceededPartialMsg;
            } else {  // case of: rejectedArr.length > 0 && fulfilledArr.length === 0
                // Chain a selected error upward.
                throw selectFetchImageError(errorsArr);
            }
        });
}

// GEt an id and get from the server the matching image file.
// Return a Promise with the object {"id" (string), "image" (blob)}, or 
// throw an error with a proper message.
function fetchImageByID(id) {
    return fetch(`/file/img/${id}`, { method: 'GET' })  // Returns a Promise.
        .then(async (responseGet) => {
            // Check if the response is OK or we got an error:
            if (responseGet.status !== 200) {
                let errorMsg = '';
                switch (responseGet.status) {
                    case statusCodes["data_removed_code"]:  // We got statusCodes from as a parameter from the server.
                        // The ID doesn't exist in the database (maybe was removed after a cleanup timeout).
                        errorMsg = FilesRemovedErrorMsg;
                        break;
                    case statusCodes["internal_server_error_code"]:
                        // General internal server error:
                        errorMsg = UploadFailed500Msg;
                        break;
                    default:
                        // Any other error, including other internal server errors.
                        errorMsg = UploadFailedMsg;
                }
                throw new Error(errorMsg);

            } else
                // Everything is awesome!
                return { "id": id, "image": await responseGet.blob() };  // responseGet.blob() is an async task, so we need to await it.
        })
}

// Clear and reset:

// Clear all the uploaded files and reset the page as if nothing was uploaded yet.
function clearHandler(event) {
    event.preventDefault();
    resetUpload();
    resetImage();
    resetDownload();
    resetClear();
}

// Remove all the pending files and reset the upload section for a new upload.
function resetUpload() {
    updateUploadingStatus(NothingToUploadMsg);
    uploadButton.disabled = true;
    uploadForm.reset();  // empty the fileInput.files.
    audioFileLst = [];  // Required in the case of dropping files.
}

// Clear the preview image.
function resetImage() {
    previewImage.src = '#';
    previewImage.style.display = 'none';
}

// Disable and reset the download button, as if no file is ready to be downloaded.
function resetDownload() {
    updateDownloadingStatus('');
    downloadButton.disabled = true;
    downloadButton.dataset.file_id = "";
}

// Disable the clear buton.
function resetClear() {
    clearButton.disabled = true;
}

// Download:

// Handle the event of downloading the PDF files to the user.
function downloadHandler(event) {
    event.preventDefault();
    // Disable the download button for a short while to prevent harassments:
    downloadButton.disabled = true;
    setTimeout(() => {
        downloadButton.disabled = false;
        downloadFile();
    }, harassmentCooldownMS);
}

// Get the file from the server with the ID as set in "downloadButton", and download.
function downloadFile() {
    const id = JSON.parse(downloadButton.dataset.file_id)[0];  // TO DO: enable downloading multiple files (as a zip?).

    // Fetch downloading data (namely the file's download name):
    var url = `/file/data/${id}`;
    fetch(url, { method: 'GET' })
        // Get a response with a JSON (with extra data of the file):
        .then(response => extractJsonFromDownloadResponse(response))
        // Now fetch the PDF file itself:
        .then(jData => fetchAndDownloadPDFById(id, jData))
        /*.then(dataBlob => {
            // Create a hidden element with the 'download' attribute linked 
            // to the file, activate(click) it and then remove it:
            var fileName = jData.downloadName;
            const hidden_a = document.createElement('a');
            hidden_a.href = window.URL.createObjectURL(dataBlob);
            hidden_a.setAttribute('download', fileName);
            document.body.appendChild(hidden_a);
            hidden_a.click();
            document.body.removeChild(hidden_a);
        })*/
        .catch(err => {
            updateDownloadingStatus(err.message);
        });
}

// Get a response from the server, check its status and return the 
// response's json, or throw an exception with a proper message.
function extractJsonFromDownloadResponse(response) {
    // Check if the response is OK or we got an error:
    if (response.status !== 200) {
        let errorMsg = '';
        switch (response.status) {
            case statusCodes["data_removed_code"]:  // We got statusCodes from as a parameter from the server.
                // The ID doesn't exist in the database (maybe was removed after a cleanup timeout).
                errorMsg = FilesRemovedErrorMsg;
                break;
            case statusCodes["internal_server_error_code"]:
                // General internal server error:
                errorMsg = DownloadFailed500Msg;
                break;
            default:
                // Other errors (probably other internal server errors).
                errorMsg = DownloadFailedMsg;
        }
        throw new Error(errorMsg);

    } else
        // Everything is awesome!
        return response.json();
}

// Fetch the PDF file with the given id from the server and download it to the user.
// Return a Promise with an error message upon failure.
function fetchAndDownloadPDFById(id, jData) {
    return fetchPDFById(id)
        .then(dataBlob => downloadBlob(jData, dataBlob))
        .catch(err => { throw err; });
}

// Fetch the PDF file with the given id from the server.
// Return a Promise with the PDF file's data (a blob), or fail with a 
// proper error message.
function fetchPDFById(id) {
    url = `/file/pdf/${id}`;
    return fetch(url, { method: 'GET' })
        // The response has a blob data:
        .then(response => {
            // Check if the response is OK or we got an error:
            if (response.status !== 200) {
                let errorMsg = '';
                switch (response.status) {
                    case statusCodes["data_removed_code"]:
                        // The file doesn't exist in the database (maybe was removed after a cleanup timeout).
                        errorMsg = FilesRemovedErrorMsg;
                        break;
                    case statusCodes["internal_server_error_code"]:
                        // General internal server error:
                        errorMsg = DownloadFailed500Msg;
                        break;
                    default:
                        // Other errors (probably other internal server errors).
                        errorMsg = DownloadFailedMsg;
                }
                throw new Error(errorMsg);

            } else
                // Everything is awesome!
                return response.blob();
        });
}

// Sending the file with the download name to the user:
function downloadBlob(jData, dataBlob) {
    // Create a hidden element with the 'download' attribute linked 
    // to the file, activate(click) it and then remove it:
    var fileName = jData.downloadName;
    const hidden_a = document.createElement('a');
    hidden_a.href = window.URL.createObjectURL(dataBlob);
    hidden_a.setAttribute('download', fileName);
    document.body.appendChild(hidden_a);
    hidden_a.click();
    document.body.removeChild(hidden_a);
}

// More utility functions:

// Given an array of errors for fetching image files from the server, select and return the 1 most relevant.
function selectFetchImageError(errsArr) {
    // Maybe do something smarter?
    return errsArr[0];
}

// Disabling the buttons while uploading, and show a proper message.
function showPendingState() {
    uploadButton.disabled = true;
    clearButton.disabled = true;
    updateUploadingStatus(UploadingMsg);
}

// Enabling the buttons after a successful upload (complete or partial), and show a proper message.
function showUploadSuccessState(uploadSuccessMsg = UploadSucceededMsg) {
    uploadButton.disabled = false;
    downloadButton.disabled = false;
    clearButton.disabled = false;
    updateUploadingStatus(uploadSuccessMsg);
}

// Update the upload status message with the given message.
function updateUploadingStatus(newMsg) {
    uploadStatusMessage.textContent = newMsg;
}

// Update the download status message with the given message.
function updateDownloadingStatus(newMsg) {
    downloadStatusMessage.textContent = newMsg;
}

// Show a preview image to the user, given by image-blob (file).
function showPreviewImage(imgBlob) {
    const imageUrl = URL.createObjectURL(imgBlob);
    previewImage.src = imageUrl;
    previewImage.style.display = 'block';

// Show the preview images to the user, given by image-blobs (files).
} function showPreviewImages(imgBlobArr) {
    const imageUrl = URL.createObjectURL(imgBlobArr[0]);
    previewImage.src = imageUrl;
    previewImage.style.display = 'block';
}


