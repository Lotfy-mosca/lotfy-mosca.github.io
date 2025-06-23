// Google API configuration
const API_KEY = 'AIzaSyB6rE__c8EXX0eacdZEg6_1RZKQSEp6jNo'; // Replace with your API key
const CLIENT_ID = '176471486426-oj4tmfejj9ollhm3ef0o0m3l6shctuhh.apps.googleusercontent.com'; // Replace with your client ID
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

// DOM elements
const authButton = document.getElementById('auth-button');
const uploadSection = document.getElementById('upload-section');
const driveContents = document.getElementById('drive-contents');
const fileInput = document.getElementById('file-input');
const filesToUpload = document.getElementById('files-to-upload');
const uploadButton = document.getElementById('upload-button');
const dropZone = document.getElementById('drop-zone');
const fileList = document.getElementById('file-list');
const progressContainer = document.getElementById('progress-container');
const progress = document.getElementById('progress');
const statusMessage = document.getElementById('status-message');
const userEmail = document.getElementById('user-email');

let selectedFiles = [];
let gapiInited = false;
let gisInited = false;

// Initialize Google APIs
function initGoogleAPIs() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    });
    gapiInited = true;
    maybeEnableButtons();
}

function gisLoaded() {
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        authButton.style.display = 'block';
    }
}

// Authentication
function handleAuthClick() {
    const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
            if (response.error !== undefined) {
                throw response;
            }
            handleAuthSuccess(response);
        },
    });
    
    tokenClient.requestAccessToken();
}

function handleAuthSuccess(response) {
    authButton.style.display = 'none';
    uploadSection.classList.remove('hidden');
    driveContents.classList.remove('hidden');
    userEmail.textContent = 'Loading...';
    
    // Get user info
    gapi.client.drive.about.get({
        fields: 'user'
    }).then(function(response) {
        userEmail.textContent = response.result.user.emailAddress;
        listDriveFiles();
    });
}

// File selection
fileInput.addEventListener('change', handleFileSelect);
uploadButton.addEventListener('click', handleUpload);

function handleFileSelect(event) {
    selectedFiles = Array.from(event.target.files);
    updateFileList();
}

function updateFileList() {
    filesToUpload.innerHTML = '';
    
    if (selectedFiles.length === 0) {
        fileList.classList.add('hidden');
        return;
    }
    
    fileList.classList.remove('hidden');
    
    selectedFiles.forEach((file, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${file.name} (${formatFileSize(file.size)})</span>
            <button class="remove-file" data-index="${index}">×</button>
        `;
        filesToUpload.appendChild(li);
    });
    
    // Add event listeners to remove buttons
    document.querySelectorAll('.remove-file').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            selectedFiles.splice(index, 1);
            updateFileList();
        });
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]);
}

// Drag and drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('highlight');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('highlight');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('highlight');
    
    if (e.dataTransfer.files.length) {
        selectedFiles = Array.from(e.dataTransfer.files);
        updateFileList();
    }
});

// File upload
async function handleUpload() {
    if (selectedFiles.length === 0) return;
    
    fileList.classList.add('hidden');
    progressContainer.classList.remove('hidden');
    statusMessage.textContent = 'Preparing upload...';
    
    let uploadedCount = 0;
    const totalFiles = selectedFiles.length;
    
    for (const file of selectedFiles) {
        try {
            statusMessage.textContent = `Uploading ${file.name}...`;
            
            const metadata = {
                name: file.name,
                mimeType: file.type,
            };
            
            const reader = new FileReader();
            reader.onload = function(e) {
                const base64Data = e.target.result.split(',')[1];
                
                gapi.client.drive.files.create({
                    resource: metadata,
                    media: {
                        mimeType: file.type,
                        body: base64Data,
                    },
                    fields: 'id,name',
                }).then(function(response) {
                    uploadedCount++;
                    const percent = Math.round((uploadedCount / totalFiles) * 100);
                    progress.style.width = `${percent}%`;
                    
                    if (uploadedCount === totalFiles) {
                        statusMessage.textContent = 'Upload complete!';
                        setTimeout(() => {
                            selectedFiles = [];
                            progressContainer.classList.add('hidden');
                            progress.style.width = '0%';
                            listDriveFiles();
                        }, 2000);
                    }
                });
            };
            reader.readAsDataURL(file);
            
        } catch (error) {
            console.error('Upload error:', error);
            statusMessage.textContent = `Error uploading ${file.name}`;
        }
    }
}

// List Drive files
function listDriveFiles() {
    gapi.client.drive.files.list({
        pageSize: 10,
        fields: 'files(id, name, mimeType, size)',
        orderBy: 'createdTime desc'
    }).then(function(response) {
        const files = response.result.files;
        const filesContainer = document.getElementById('files-container');
        filesContainer.innerHTML = '';
        
        if (files && files.length > 0) {
            files.forEach(file => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                
                const icon = getFileIcon(file.mimeType);
                const size = file.size ? formatFileSize(parseInt(file.size)) : 'N/A';
                
                fileItem.innerHTML = `
                    <div class="file-icon">${icon}</div>
                    <div class="file-name" title="${file.name}">${file.name}</div>
                    <div class="file-size">${size}</div>
                `;
                
                filesContainer.appendChild(fileItem);
            });
        } else {
            filesContainer.innerHTML = '<p>No files found in your Drive.</p>';
        }
    });
}

function getFileIcon(mimeType) {
    if (!mimeType) return '📄';
    
    if (mimeType.includes('folder')) return '📁';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('video')) return '🎬';
    if (mimeType.includes('audio')) return '🎵';
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.includes('word')) return '📝';
    if (mimeType.includes('excel')) return '📊';
    if (mimeType.includes('powerpoint')) return '📑';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return '🗜️';
    
    return '📄';
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    authButton.addEventListener('click', handleAuthClick);
    initGoogleAPIs();
});