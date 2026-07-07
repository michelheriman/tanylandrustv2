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
        //const user = localStorage.getItem('user');
        if (userToken === undefined) {
            alert("Please sign in")
            window.location.href = './signin.html'
        }
        else{
            //return {'token' : userToken, 'user' : JSON.parse(user)};
            console.log(userToken);
            return userToken
        }
    };

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
    
    // Form inputs
    const owner = document.getElementById('owner');
    //const ownerUuid = document.getElementById('owner_uuid');
    const parcelName = document.getElementById('parcel_name');
    const locationName = document.getElementById('location_name');
    const priceM2 = document.getElementById('price_m2');
    const price = document.getElementById('price');
    const description = document.getElementById('description');
    const sell_category = document.getElementById("sell_category");
    const status_category = document.getElementById("status_category");
    const currency = document.getElementById("currency");

    
    let selectedFile = null;
    
    // Browse button click
    browseBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });
    
    // Drag and drop events
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
            //handleFileSelection(e.dataTransfer.files[0]);
            const file = e.dataTransfer.files[0];
            if (file.name.toLowerCase().endsWith('.kml')) {
                handleFileSelection(file);
            }
            else {
                showStatus('Please drop a KML file (.kml)', 'error');
                    }

        }
    });
    
    // Remove file
    removeFileBtn.addEventListener('click', () => {
        selectedFile = null;
        fileInput.value = '';
        fileInfo.classList.add('hidden');
        resetProgress();
    });
    
    // Upload button
    uploadBtn.addEventListener('click', () => {
        if (selectedFile) {
            // Validate form inputs
            if (!validateForm()) {
                return;
            }
            uploadFile(selectedFile);
        }
    });

    // Auto-calculate total price based on price per m²
    priceM2.addEventListener('input', calculateTotalPrice);
    
    // Validate form inputs
    function validateForm() {
        if (!owner.value.trim()) {
            showStatus('Please enter owner name', 'error');
            owner.focus();
            return false;
        }
        /*
        
        if (!ownerUuid.value.trim()) {
            showStatus('Please enter owner UUID', 'error');
            ownerUuid.focus();
            return false;
        }
        */
        
        if (!parcelName.value.trim()) {
            showStatus('Please enter parcel name', 'error');
            parcelName.focus();
            return false;
        }
        
        if (!locationName.value.trim()) {
            showStatus('Please enter location name', 'error');
            locationName.focus();
            return false;
        }
        
        return true;
    }

    // Calculate total price (you can enhance this with actual area calculation)
    function calculateTotalPrice() {
        if (priceM2.value && !price.value) {
            // This is a simple example - you might want to calculate based on actual area
            const pricePerM2 = parseFloat(priceM2.value);
            if (!isNaN(pricePerM2) && pricePerM2 > 0) {
                // You can enhance this with actual area calculation from KML
                price.placeholder = `Calculate based on area (${pricePerM2} per m²)`;
            }
        }
    }
    
    // Get form data
    async function getFormData() {
        const session = await await getCurrentUserWithRefresh();//await supabase_.auth.getSession();
        let owner_uuid = session.data.email;
        return {
            owner: owner.value.trim(),
            owner_uuid: owner_uuid,
            parcel_name: parcelName.value.trim(),
            location_name: locationName.value.trim(),
            price_m2: priceM2.value ? parseFloat(priceM2.value) : null,
            price: price.value ? parseFloat(price.value) : null,
            description: description.value.trim(),
            currency : currency.value.trim(),
            status_category : status_category.value,
            sell_category : sell_category.value


        };
    }
    
    // Handle file selection
    function handleFileSelection(file) {
        // Check if file is KML
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
    async function uploadFile(file) {
        const formData = new FormData();
        formData.append('kmlFile', file);
        
        // Add form data to FormData
        const formDataObj = await getFormData();
        for (const [key, value] of Object.entries(formDataObj)) {
            formData.append(key, value);
        }
        //console.log(formData.entries())
        
        // Configure your API endpoint here
        const apiEndpoint = 'https://mtk.pythonanywhere.com//api/upload-kml'; //change in production
        
        // Create XMLHttpRequest for progress tracking
        const xhr = new XMLHttpRequest();
        
        // Progress event
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                updateProgress(percentComplete);
            }
        });
        
        // Load event (completed)
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                // Success
                const response = JSON.parse(xhr.responseText);
                showStatus(`Parcel data uploaded successfully! ${response.message}`, 'success');
                uploadBtn.disabled = true;
                
                // Reset form after successful upload
                setTimeout(() => {
                    resetForm();
                }, 3000);
            } else {
                // Error
                try {
                    const response = JSON.parse(xhr.responseText);
                    showStatus(`Upload failed: ${response.message}`, 'error');
                } catch (e) {
                    showStatus(`Upload failed: ${xhr.statusText}`, 'error');
                }
                uploadBtn.disabled = false;
            }
        });
        
        // Error event
        xhr.addEventListener('error', () => {
            showStatus('Upload failed: Network error', 'error');
            uploadBtn.disabled = false;
        });
        
        // Open and send request
        //console.log(formData);
        console.log('--- FormData Content ---');
        for (const [key, value] of formData.entries()) {
        console.log(`${key}: ${value}`);
        }

        let token = await checker();

        xhr.open('POST', apiEndpoint, true);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
        
        // Show progress bar
        progressContainer.classList.remove('hidden');
        uploadBtn.disabled = true;
    }
    
    // Update progress bar
    function updateProgress(percent) {
        const roundedPercent = Math.round(percent);
        progressBar.style.width = `${roundedPercent}%`;
        progressPercent.textContent = `${roundedPercent}%`;
    }
    
    // Reset progress bar and form
    function resetProgress() {
        progressBar.style.width = '0%';
        progressPercent.textContent = '0%';
        progressContainer.classList.add('hidden');
        statusMessage.classList.add('hidden');
        uploadBtn.disabled = false;
    }
    
    // Reset entire form
    function resetForm() {
        selectedFile = null;
        fileInput.value = '';
        fileInfo.classList.add('hidden');
        owner.value = '';
        //ownerUuid.value = '';
        parcelName.value = '';
        locationName.value = '';
        priceM2.value = '';
        price.value = '';
        description.value = '';
        resetProgress();
    }
    
    // Show status message
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
    