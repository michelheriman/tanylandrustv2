const API_URL = 'https://mtk.pythonanywhere.com/';
async function getCurrentUserWithRefresh() {
        try {
            const token = localStorage.getItem('auth_token');
            const refreshToken = localStorage.getItem('refresh_token');
            
            if (!token) {
                return {
                    success: false,
                    message: 'No authentication token found',
                    data: null
                };
            }
            
            // First attempt with current token
            let response = await fetch('https://mtk.pythonanywhere.com/api/current_user', { // change link in production
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            // If token expired, try to refresh it
            if (response.status === 401 && refreshToken) {
                console.log('Token expired, attempting refresh...');
                
                try {
                    // Try to refresh the token
                    const refreshResponse = await fetch('https://mtk.pythonanywhere.com/api/refresh-token', {// change link in production
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            refresh_token: refreshToken
                        })
                    });
                    
                    if (refreshResponse.ok) {
                        const refreshData = await refreshResponse.json();
                        
                        // Update tokens in localStorage
                        localStorage.setItem('token', refreshData.token);
                        if (refreshData.refresh_token) {
                            localStorage.setItem('refresh_token', refreshData.refresh_token);
                        }
                        
                        console.log('Token refreshed successfully');
                        
                        // Retry with new token
                        response = await fetch('https://mtk.pythonanywhere.com/api/current_user', {// change link in production
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${refreshData.token}`,
                                'Content-Type': 'application/json'
                            }
                        });
                    }
                } catch (refreshError) {
                    console.error('Token refresh failed:', refreshError);
                    // Clear tokens and redirect to login
                    localStorage.removeItem('token');
                    localStorage.removeItem('refresh_token');
                    window.location.href = '/signin.html';
                    return {
                        success: false,
                        message: 'Session expired. Please login again.',
                        data: null
                    };
                }
            }
            
            const data = await response.json();
            
            if (!response.ok) {
                return {
                    success: false,
                    status: response.status,
                    message: data.message || 'Failed to fetch user data',
                    data: null
                };
            }
            
            return data;
            
        } catch (error) {
            console.error('Error fetching user:', error);
            return {
                success: false,
                message: 'Failed to fetch user data',
                data: null
            };
        }
    };
async function checker() {
    const userToken = localStorage.getItem('auth_token');
    
    if (!userToken) {  // catches both null and undefined
        alert("Please sign in");
        window.location.href = './signin.html';
        return null;
    }
    
    return userToken;
}

document.addEventListener('DOMContentLoaded', function() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const fileSize = document.getElementById('file-size');
    const removeFileBtn = document.getElementById('remove-file');
    const uploadBtn = document.getElementById('upload-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressPercent = document.getElementById('progress-percent');
    const statusMessage = document.getElementById('status-message');
    
    let selectedFile = null;

    //get all the values from inputs
    async function get_inputs () {
        const session = await await getCurrentUserWithRefresh();
        let owner_uuid = session.data.email;
        let owner = document.getElementById("parcel_owner").value;
        let parcel_n = document.getElementById("parcel_name").value; 
        let price_m2 = document.getElementById("price_m2").value; 
        let currency = document.getElementById("currency").value;
        let price = document.getElementById("price").value;
        let location_name = document.getElementById("location_name").value;
        let description = document.getElementById("description").value;

        return {
            owner : owner,
            price_m2 : price_m2, 
            price: price, 
            location_name : location_name, 
            description: description,
            owner_uuid : owner_uuid, 
            currency : currency, 
            parcel_name : parcel_n, 
        }
    }
    
    browseBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('border-blue-500', 'bg-blue-50');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('border-blue-500', 'bg-blue-50');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('border-blue-500', 'bg-blue-50');
        
        if (e.dataTransfer.files.length > 0) {
            handleFileSelection(e.dataTransfer.files[0]);
        }
    });
    
    removeFileBtn.addEventListener('click', () => {
        selectedFile = null;
        fileInput.value = '';
        fileInfo.classList.add('hidden');
        resetProgress();
    });
    
    uploadBtn.addEventListener('click', () => {
        if (selectedFile) {
            uploadFile(selectedFile);
        }
    });
    
    function handleFileSelection(file) {
        if (!file.name.toLowerCase().endsWith('.kml')) {
            showStatus('Please select a KML file (.kml)', 'error');
            return;
        }
        
        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            showStatus('File size exceeds 10MB limit', 'error');
            return;
        }
        
        selectedFile = file;
        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        fileInfo.classList.remove('hidden');
        resetProgress();
    }
    
    // Upload file to server
    function uploadFile(file) {
        const formData = new FormData();
        formData.append('kmlFile', file);

        // Add form data to FormData
        //see test.html for debugging
        const formDataObj = get_inputs();
        for (const [key, value] of Object.entries(formDataObj)) {
            formData.append(key, value);
        }
        
        const apiEndpoint = 'api/upload-kml'; 
        
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                updateProgress(percentComplete);
            }
        });
        
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                showStatus('File uploaded successfully!', 'success');
                uploadBtn.disabled = true;
            } else {
                showStatus(`Upload failed: ${xhr.statusText}`, 'error');
            }
        });
        
        xhr.addEventListener('error', () => {
            showStatus('Upload failed: Network error', 'error');
        });
        
        xhr.open('POST', apiEndpoint, true);
        
        xhr.send(formData);
        
        progressContainer.classList.remove('hidden');
        uploadBtn.disabled = true;
    }
    
    function updateProgress(percent) {
        const roundedPercent = Math.round(percent);
        progressBar.style.width = `${roundedPercent}%`;
        progressPercent.textContent = `${roundedPercent}%`;
    }
    
    function resetProgress() {
        progressBar.style.width = '0%';
        progressPercent.textContent = '0%';
        progressContainer.classList.add('hidden');
        statusMessage.classList.add('hidden');
        uploadBtn.disabled = false;
    }
    
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-green-100', 'text-green-700');
        
        if (type === 'error') {
            statusMessage.classList.add('bg-red-100', 'text-red-700');
        } else if (type === 'success') {
            statusMessage.classList.add('bg-green-100', 'text-green-700');
        }
    }
    
    // Format file size
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' bytes';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / 1048576).toFixed(1) + ' MB';
    }
});
