const dropArea = document.getElementById('drop-area');
const uploadForm = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const uploadButton = document.getElementById('upload-button');
const clearButton = document.getElementById('clear-button');
const downloadButton = document.getElementById('download-button');
const statusMessage = document.getElementById('status-message');
const previewImage = document.getElementById('notes-img');

// Messages:
const nothingToUploadMsg = "Nothing to upload";
const InvalidFileErrorMsg = (fName) => `File ${fName} is not a valid audio file.`;
const UploadsLimitReachedMsg = (limit) => `The limit of ${limit} uploading files was reached.`
const pressConvertMsg = "Press on \"Convert\" to convert the file(s)"
const UploadingMsg = "Uploading...";
const UploadSucceededMsg = "Upload Compled!";
const UploadFailedMsg = "Upload Failed!";

updateUploadingStatus(nothingToUploadMsg);

// Adding events:

// Add and handle file input change event:
fileInput.addEventListener('change', () => {
    //const fileLst = fileInput.files;
    preProcessInput(fileInput);
});

// Add and handle file drop event:
dropArea.addEventListener('drop', (event) => {
    console.log('Drop event!');
    event.preventDefault();

    const fileLst = event.dataTransfer.files;
    fileInput.files = fileLst;
    //console.log('fileInput.files =', fileInput.files);
    preProcessInput(fileInput);
});

// Add and handle submition/uploading event:
uploadForm.addEventListener('submit', (event) => {
    event.preventDefault();

    uploadFiles(fileInput.files);
});

// Clear button click event:
clearButton.addEventListener('click', clearHandler);

// Download button click event:
downloadButton.addEventListener('click', downloadHandler);

// Handlers and other functions:

// Check the input files and prepare for uploading to the server:
function preProcessInput(fileInput) {
    let fileLst = fileInput.files;
    // Verify validity:
    try {
        assertFilesValid(fileLst)
    } catch (err) {
        resetUpload()
        updateUploadingStatus(err.message);
        return;
    }

    // Do something with the files, so "uploadForm" have them in the "formData".

    if (fileLst.length > uploadLimit) {
        fileInput.files = fileLst.slice(0, uploadLimit)
        updateUploadingStatus(UploadsLimitReachedMsg(uploadLimit) + ' ' + pressConvertMsg);
    } else {
        // Inform the user to press "Convert":
        updateUploadingStatus(pressConvertMsg);
    }
    // Enabling the buttons:
    uploadButton.disabled = false;
    clearButton.disabled = false;
}

function assertFilesValid(files) {
    for (let file of files) {
        console.log(file.type);
        if (!file.type)
            throw new Error(InvalidFileErrorMsg(file.name));
    }
}

function uploadFiles(fileLst) {
    showPendingState();

    if (!fileLst || fileLst.length === 0) {
        resetUpload()
        updateUploadingStatus(UploadFailedMsg);
        return;
    }
    /*if (fileLst.length > uploadLimit) {
        fileLst = fileLst.slice(0, uploadLimit)
        updateUploadingStatus(UploadsLimitReachedMsg(uploadLimit) + ' ' + pressConvertMsg);
    }*/

    const url = '/file';
    let formData = new FormData();

    for (const file of fileLst) {
        formData.append('file', file);  // We'll have array of object: [{ name: 'file', value: file_1}, { name: 'file', value: file_2}, ...]
    }
    console.log('num of files:', fileLst.length);

    // Print data for debugging:
    let reader = new FileReader();
    reader.readAsText(fileLst[0]);
    //reader.readAsDataURL(fileLst[0]);
    reader.onload = function () {
        console.log('In onload: ', reader.result);
    };

    //fetch(url, { method: 'POST', headers: { "Accept": "application/json, text/plain", 'Content-Type': 'application/json' }, body: JSON.stringify({ a: 'LALALA' }) })//formData })
    //fetch(url, { method: 'POST', headers: { "Accept": "application/json, text/plain", 'Content-Type': 'text/plain' }, body: 'LALALA' })//formData })
    //fetch(url, { method: 'POST', headers: { 'Content-Type': 'audio' }, body: fileInput.files[0] })
    fetch(url, {
        method: 'POST',
        //headers: { "Accept": "application/json" },
        body: formData
    })
        /*.then((response) => response.json())
        .then(dataJson => {
            updateUploadingStatus(UploadSucceededMsg);
            console.log('Upload succeeded!');
            console.log(JSON.stringify(dataJson));

        })*/
        /*.then((response) => response.text())
        .then(text => {
            console.log(text);
            showUploadSuccessState();
        })*/
        /*.then((response) => response.blob())
        .then(dataBlob => {
            console.log(dataBlob);
            let reader = new FileReader();
            reader.readAsText(dataBlob);
            reader.onload = function () {
                console.log('In onload 2: ', reader.result);
            };
            showUploadSuccessState();
        })*/
        .then((responsePost) => responsePost.json())  // What to do if server couldn't process the files and returns a filure?
        .then(dataJson => {
            console.log('dataJson =', dataJson);
            for (let i = 0; i < dataJson.ids.length; ++i) {
                var fileId = dataJson.ids[i];
                fetch(`/file/img/${fileId}`, { method: 'GET' })
                    .then((responseGet) => responseGet.blob())  // What to do if got status 500 with err text as response?
                    .then(dataBlob => {  // TO DO: Shouldn't enter here if status code is bad.
                        console.log(dataBlob);
                        downloadButton.dataset.fileId = fileId;  // What if there are several files? dataset can only take 1 value (and no array is allowed).
                        //downloadButton.setAttribute('data-fileId', fileId);
                        console.log('downloadButton.dataset.fileId attribute:', downloadButton.dataset.fileId, ', fileId =', fileId);
                        showPreviewImage(dataBlob);  // What if the file is long and resulted in several images?
                        showUploadSuccessState();
                    })
            }
        })
        .catch(err => {
            updateUploadingStatus(UploadFailedMsg);
            console.log('Upload failed!\n', err);
        });
}

function showPendingState() {
    // Disabling the buttons while uploading:
    uploadButton.disabled = true;
    clearButton.disabled = true;
    updateUploadingStatus(UploadingMsg);
}

function showUploadSuccessState() {
    // Enabling the buttons after a successful upload:
    uploadButton.disabled = false;
    downloadButton.disabled = false;
    clearButton.disabled = false;
    updateUploadingStatus(UploadSucceededMsg);
}

function updateUploadingStatus(newMsg) {
    statusMessage.textContent = newMsg;
}

function showPreviewImage(imgBlob) {
    const imageUrl = URL.createObjectURL(imgBlob);
    previewImage.src = imageUrl;
    //previewImage.alt = 'Preview Notes';
    previewImage.style.display = 'block';
    console.log('imageUrl =', imageUrl);
}

function resetUpload() {
    updateUploadingStatus(nothingToUploadMsg);
    // Disabling the buttons:
    uploadButton.disabled = true;
    //cancelButton.disabled = true;

    uploadForm.reset();  // empty the fileInput.files.
}

function clearHandler() {
    resetUpload();
    previewImage.src = '#';
    previewImage.style.display = 'none';
    //dropText.style.display = 'block';  // ?
    downloadButton.disabled = true;
    downloadButton.setAttribute('data-fileId', "");  // downloadButton.dataset.defaultValue
    clearButton.disabled = true;
}

function downloadHandler() {
    // Fetch file from server and download:
    const id = downloadButton.dataset.fileId;
    var fileName = 'no-name.no';

    // Fetch extra data:
    var url = `/file/data/${id}`;
    console.log('fetching from: ', url, ', id =', id);
    fetch(url, { method: 'GET' })
        .then(response => response.json())
        .then(jData => {
            fileName = jData.downloadName;

            //console.log('downloadButton.dataset.fileName =', downloadButton.dataset.fileName, ', fileName =', fileName);
            url = `/file/pdf/${id}`;
            fetch(url, { method: 'GET' })  // What to do if got status 500 with err text as response?
                /*.then(response => response.json())
                .then(dataJson => {
                    let { file, fileName } = dataJson;
                    console.log('fileName =', fileName, ', file =', file);*/
                .then(response => response.blob())
                .then(dataBlob => {
                    const hidden_a = document.createElement('a');
                    hidden_a.href = window.URL.createObjectURL(dataBlob);
                    hidden_a.setAttribute('download', fileName);  // Make a better file name.
                    document.body.appendChild(hidden_a);
                    hidden_a.click();
                    document.body.removeChild(hidden_a);
                })
        })
        .catch(err => {
            console.log('Download failed!\n', err);
        });
}

