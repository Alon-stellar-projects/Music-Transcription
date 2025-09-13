/**
 * Author: Alon Haviv, Stellar Intelligence.
 * 
 * The front-end functionality of the homepage (index.pug).
 */

// Elements:
const galleryItems = document.querySelectorAll('.gallery-item');
const dropArea = document.getElementById('drop-area');
const uploadForm = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const uploadButton = document.getElementById('upload-button');
const processingIndicator = document.getElementById('processing-indicator');
const clearButton = document.getElementById('clear-button');
const downloadPdfButton = document.getElementById('download-pdf-button');
const downloadMidiButton = document.getElementById('download-midi-button');
const uploadStatusMessage = document.getElementById('upload-status-message');
const downloadStatusMessage = document.getElementById('download-status-message');
const previewImage = document.getElementById('notes-img');

// Stack all the download buttons together:
let downloadButtons = [downloadPdfButton, downloadMidiButton];

// Messages:
const NothingToUploadMsg = "Nothing to upload";
const InvalidFileErrorMsg = (fName) => `File ${fName} is not a valid audio file.`;
const UploadsLimitReachedMsg = (limit) => `The limit of ${limit} files was reached.`
const FilesTooHeavyMsg = `The uploaded files exceed the total size limit of ${Math.round(sizeLimitBytes / 1024)}KB`
const FilesRemovedErrorMsg = 'The files are no longer available. Please upload again.';
const PressConvertMsg = "Press on \"Convert\" to convert the file(s)"
const UploadingMsg = "File uploaded";
const UploadSucceededMsg = "Conversion Completed!" + (downloadTimeLimit_min >= 0 ? ` The notes will be available for download for the next ${Math.floor(downloadTimeLimit_min)} minutes.` : "");
const UploadSucceededPartialMsg = "Conversion Completed! Some of the files could not be converted.";
const UploadFailedMsg = "Upload Failed!";
const ConversionFailedMsg = "Conversion Failed!";
const ConversionFailed500Msg = "Conversion Failed! The problem is on our side.";
const DownloadFailedMsg = "Download Failed!";
const DownloadFailed500Msg = "Download Failed! Please try again in a moment.";

const harassmentCooldownMS = 700  // cooldown time in milliseconds for the upload and download buttons.
const appearanceCls = "show";  // Class element that marks if buttons are hidden or not.

// First setup:

updateUploadingStatus(NothingToUploadMsg);
processingIndicator.style.display = 'none';  // Hide the spinner.
let audioFileLst = [];
// Organize all the routs for the file-fetch requests in one place:
const fetch_file_routes = {
    'data': '/file/data',
    'pdf': '/file/pdf',
    'midi': '/file/midi'
};

// Adding events:

// Hide buttons if clicking outside any sample
document.body.addEventListener('click', handleAnyClick);  // Handle general click events (anywhere).
galleryItems.forEach(item => { addEventListenerToGalleryItem(item) });  // Add click events for each image and each button in the gallery.
fileInput.addEventListener('change', handleFileInputChange);  // Add and handle file input change event.
dropArea.addEventListener('dragenter', handleDragEnter);  // Dragging a file into the drop area (entering event).
dropArea.addEventListener('dragover', handleDragOver);  // Dragging a file over the drop area event.
dropArea.addEventListener('dragleave', handleDragLeave);  // Dragging a file out of the drop area (leaving event).
dropArea.addEventListener('drop', handleFileDrop);  // Add and handle file drop event.
uploadForm.addEventListener('submit', handleSubmitFileUpload);  // Add and handle submition/uploading event.
clearButton.addEventListener('click', clearHandler);  // Clear button click event.
downloadPdfButton.addEventListener('click', downloadPdfHandler);  // Download PDF button click event.
downloadMidiButton.addEventListener('click', downloadMidiHandler);  // Download MIDI button click event.

// Add an event listener function to the given gallery-item. The event is a click on the image.
function addEventListenerToGalleryItem(item) {
    const itemImage = item.querySelector('.gallery-item-image');
    const itemDownloadButtons = item.querySelector('.gallery-item-download-buttons');
    const id = item.getAttribute('data-id');
    const downloadName = item.querySelector('.gallery-item-name')?.textContent || '';

    // Add click event to the image:
    itemImage.addEventListener('click', (event) => { galleryImageClickHandler(event, item); });
    // Add click events to the image's download buttons:
    addEventListenerToGalleryDownloadButtons(itemDownloadButtons, id, downloadName);
}

// Add a click event listener function to the given gallery-image.
function addEventListenerToGalleryImage(image) {
    image.addEventListener('click', (event) => { galleryImageClickHandler(event, item); });
}

function addEventListenerToGalleryDownloadButtons(buttonsPair, id, downloadName) {
    const downloadPdfBtn = buttonsPair.querySelector('.download-pdf');  // Download PDF button:
    const downloadMidiBtn = buttonsPair.querySelector('.download-midi');  // Download MIDI button:

    // Download PDF event:
    downloadPdfBtn.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent body click
        downloadGalleryFile(downloadPdfBtn, fetch_file_routes.pdf, id, downloadName);
        hideAllGalleryButtons();
    });

    // Download MIDI event:
    buttonsPair.querySelector('.download-midi').addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent body click
        downloadGalleryFile(downloadMidiBtn, fetch_file_routes.midi, id, downloadName);
        hideAllGalleryButtons();
    });
}


// Input handlers and other functions:

// Click anywhere hides the gallery's download buttons.
function handleAnyClick(event) {
    hideAllGalleryButtons();
}

// Show/hide the download buttons for the specific given gallery-item.
function galleryImageClickHandler(event, item) {
    event.preventDefault();
    event.stopPropagation();  // Prevent triggering body click

    let itemButtons = item.querySelector('.gallery-item-download-buttons');

    // Read current gallery buttons state. If hidden -> show. If activate -> hide.
    let isAppear = itemButtons.classList.contains(appearanceCls);
    hideAllGalleryButtons();  // Hide all the gallery's download buttons.
    if (!isAppear) {
        itemButtons.classList.add(appearanceCls);
        isAppear = true;
    }
}

// Add and preprocess the new files added to "fileInput".
function handleFileInputChange(event) {
    preProcessInput(event.target.files);
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

    //const fileList = event.dataTransfer.files;
    fileInput.files = event.dataTransfer.files;
    fileInput.dispatchEvent(new Event('change'));
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
    let totalSizeBytes = 0;
    for (let file of files) {
        totalSizeBytes += file.size;
        // Check total files size limit:
        if (totalSizeBytes > sizeLimitBytes)
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
    // Append choice for the number of instruments (1 or many):
    const instrumentsOpVal = document.querySelector('input[name="instruments_op"]:checked')?.value;
    formData.append('instrumentOptions', instrumentsOpVal);
    for (const file of fileLst) {
        // We get an array of objects: [{ name: 'instruments', value: x }, { name: 'file', value: file_1}, { name: 'file', value: file_2 }, ...]
        formData.append('file', file);
    }

    // Upload the file and fetch a preview image:
    const url = '/file';
    fetch(url, {
        method: 'POST',
        body: formData
    })
        // Get a response and extract a JSON data (that should contain the preview images' IDs):
        .then((responsePost) => extractJsonFromUploadResponse(responsePost))
        // Get a json with the images' IDs, update the download buttons and fetch and show the image files:
        .then(dataJson => prepareForDownload(dataJson, fileLst))
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
                errorMsg = ConversionFailed500Msg;
                break;
            default:
                // Any other error, including other internal server errors.
                errorMsg = ConversionFailedMsg;
        }
        throw new Error(errorMsg);
    } else
        // Everything is awesome!
        return response.json();
}

// given "dataJson" - A json with data about converted files, prepare for downloading 
// them by updating the download buttons with the necessary data, and show a preview 
// image to the user.
// "originalFileLst" - a list of the orignal uploaded files, for comparison.
// Return a Promise with either a complete-success, partial-success or failure message, 
// depending on whether or not all, some or none of the files were converted successfuly.
function prepareForDownload(dataJson, originalFileLst) {
    const idLst = dataJson.ids, nameLst = dataJson.names;
    return new Promise(async (resolve, reject) => {
        try {
            // The main pipeline:

            // Update the download buttons with the IDs and names of the files:
            updateDownloadButtonsDataset(downloadButtons, idLst, nameLst);
            // Fetch and show the image files:
            await fetchAndShowImagesByIdsArr(dataJson);

            // Return a message for complete success or partial success, or an error:
            if (idLst.length == originalFileLst.length)
                resolve(UploadSucceededMsg);
            else if (idLst.length > 0 && idLst.length < originalFileLst.length)
                resolve(UploadSucceededPartialMsg);
            else  // idLst.length == 0 && originalFileLst.length > 0
                throw new Error(ConversionFailedMsg);  // Maybe a more informative message?
        } catch (err) {
            reject(err);
        }
    });
}

// Fetch the image files with the IDs and names given in dataJson, from the server, show them to
// the user and set the download buttons with the IDs.
// Return a Promise with either a complete-success, partial-success or failure message, 
// depending on whether or not all, some or none of the images were fetched successfuly.
function fetchAndShowImagesByIdsArr(dataJson) {
    const idLst = dataJson.ids;

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

            // Showing preview images:
            if (fulfilledValsArr.length > 0) {
                showPreviewImages(fulfilledValsArr.map(item => item.image));
            }

            // Return a true for complete success, false for partial success, or throw an error:
            if (fulfilledValsArr.length > 0 && errorsArr.length === 0) {
                return true;
            } else if (fulfilledValsArr.length > 0 && errorsArr.length > 0) {
                return false;
            } else {  // case of: rejectedArr.length > 0 && fulfilledArr.length === 0
                // Chain a selected error upward.
                throw selectFetchImageError(errorsArr);
            }
        });
}

// Update the dataset field of each button in the given array "buttonsArr", with the 
// given arrays of IDs(idLst) and names(nameLst).
// Return true upon success.
function updateDownloadButtonsDataset(buttonsArr, idLst, nameLst) {
    for (let button of buttonsArr) {
        button.dataset.file_id = JSON.stringify(idLst);
        button.dataset.file_name = JSON.stringify(nameLst);
    }
    return true;
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
                        errorMsg = ConversionFailed500Msg;
                        break;
                    default:
                        // Any other error, including other internal server errors.
                        errorMsg = ConversionFailedMsg;
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
    hideAllGalleryButtons();
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
    previewImage.classList.add('hidden');
}

// Disable and reset the download button, as if no file is ready to be downloaded.
function resetDownload() {
    updateDownloadingStatus('');
    for (let downloadButton of downloadButtons) {
        downloadButton.disabled = true;
        downloadButton.dataset.file_id = "";
        downloadButton.dataset.file_name = "";
    }
}

// Disable the clear buton.
function resetClear() {
    clearButton.disabled = true;
}

// Hide all the dosload buttons of the gallery, by adding a classList field "hidden".
function hideAllGalleryButtons() {
    document.querySelectorAll('.gallery-item-download-buttons').forEach(itemButtonsPair => {
        itemButtonsPair.classList.remove(appearanceCls);
    });
}

// Download:

// Handle the event of downloading the PDF files to the user.
function downloadPdfHandler(event) {
    event.preventDefault();
    downloadAnyHandler(downloadPdfButton, fetch_file_routes.pdf);
}

// Handle the event of downloading the MIDI files to the user.
function downloadMidiHandler(event) {
    event.preventDefault();
    downloadAnyHandler(downloadMidiButton, fetch_file_routes.midi);
}

//  Get the file from the server with the given "route", the ID and name, 
// while disabling the "downloadButton" button for a short while to prevent 
// harassment attacks.
function downloadGalleryFile(downloadButton, route, id, name) {
    const fileUrl = `${route}/${id}`;

    // Disable the download button for a short while to prevent harassments:
    downloadButton.disabled = true;
    setTimeout(() => {
        downloadButton.disabled = false;
        fetchAndDownloadById(fileUrl, name)
            .catch(err => { });
    }, harassmentCooldownMS);
}

// Handle the event of downloading the files to the user.
function downloadAnyHandler(downloadButton, route) {
    // Disable the download button for a short while to prevent harassments:
    downloadButton.disabled = true;
    setTimeout(() => {
        downloadButton.disabled = false;
        downloadFile(downloadButton.dataset, route);
    }, harassmentCooldownMS);
}

// Get the file from the server with the given "route", and the ID and name as set in 
// given "filesDataset", and download it.
function downloadFile(filesDataset, route) {
    const id = JSON.parse(filesDataset.file_id)[0];  // TO DO: enable downloading multiple files (as a zip?).
    const fname = JSON.parse(filesDataset.file_name)[0];  // TO DO: enable downloading multiple files (as a zip?).

    // Fetch downloading data (namely the file's download name):
    const fileUrl = `${route}/${id}`;
    fetchAndDownloadById(fileUrl, fname)
        .catch(err => {
            updateDownloadingStatus(err.message);
        });
}

// Get the file from the server with the given "route", and the ID as set in given "filesDataset", and download it.
function downloadFile_old(filesDataset, route) {
    const id = JSON.parse(filesDataset.file_id)[0];  // TO DO: enable downloading multiple files (as a zip?).

    // Fetch downloading data (namely the file's download name):
    var dataUrl = `${fetch_file_routes.data}/${id}`;
    var fileUrl = `${route}/${id}`;
    fetch(dataUrl, { method: 'GET' })
        // Get a response with a JSON (with extra data of the file):
        .then(response => extractJsonFromDownloadResponse(response))
        // Now fetch the PDF file itself:
        .then(jData => fetchAndDownloadById(fileUrl, jData[downloadKeyInJData]))
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

// Fetch the desired file from the server using the given "url" and "filename" and download it to the user.
// Return a Promise with an error message upon failure.
function fetchAndDownloadById(url, fileName) {
    return fetchBlobById(url)
        .then(dataBlob => downloadBlob(dataBlob, fileName))
        .catch(err => { throw err; });
}

// Fetch the desired file from the server using the given "url".
// Return a Promise with the file's data (a blob), or fail with a 
// proper error message.
function fetchBlobById(url) {
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
function downloadBlob(dataBlob, fileName = "") {
    // Create a hidden element with the 'download' attribute linked 
    // to the file, activate(click) it and then remove it:
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
    updateUploadingStatus(UploadingMsg, 'flex');
}

// Enabling the buttons after a successful upload (complete or partial), and show a proper message.
function showUploadSuccessState(uploadSuccessMsg = UploadSucceededMsg) {
    uploadButton.disabled = false;
    for (let downloadButton of downloadButtons)
        downloadButton.disabled = false;
    clearButton.disabled = false;
    updateUploadingStatus(uploadSuccessMsg);
}

// Update the upload status message with the given message.
function updateUploadingStatus(newMsg, processingDisplayStyle = 'none') {
    uploadStatusMessage.textContent = newMsg;
    processingIndicator.style.display = processingDisplayStyle;
}

// Update the download status message with the given message.
function updateDownloadingStatus(newMsg) {
    downloadStatusMessage.textContent = newMsg;
}

// Show the preview images to the user, given by image-blobs (files).
function showPreviewImages(imgBlobArr) {
    const imageUrl = URL.createObjectURL(imgBlobArr[0]);
    previewImage.src = imageUrl;
    previewImage.classList.remove('hidden');
}


