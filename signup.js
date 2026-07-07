const API_URL = 'https://mtk.pythonanywhere.com/api';
const signupForm = document.getElementById('signupForm');
const messageDiv = document.getElementById('message');
const submitBtn = document.getElementById('submitBtn');

// Helper to show messages
function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `mt-4 p-4 rounded-lg ${type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`;
    messageDiv.classList.remove('hidden');
}

function hideMessage() {
    messageDiv.classList.add('hidden');
}

// Handle form submission
signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessage();
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';
    
    // Collect all data fields
    const formData = {
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
        username: document.getElementById('username').value.trim(),
        mobile: document.getElementById('mobile').value.trim(),
        //address: document.getElementById('address').value.trim(),
        //idCard: document.getElementById('idCard').value.trim(),
        account: document.getElementById('account').value
    };
    
    // Basic Client-side Validation
    if (formData.password.length < 6) {
        showMessage('Password must be at least 6 characters long', 'error');
        resetSubmitBtn();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        console.log('Response body:', data); 
        
        // Note: Flask returns status 201 for success, or check data.message
        if (response.ok) {
            showMessage('Registration successful! Redirecting...', 'success');
            alert("Please check your email for confirmation");
            signupForm.reset();
            setTimeout(() => {
                window.location.href = './signin.html';
            }, 2000);
        } else {
            //showMessage(data.error || 'Registration failed', 'error');
            showMessage(data.message || 'Registration failed', 'error');
            resetSubmitBtn();
        }
    } catch (error) {
        showMessage('Connection error. Is the Flask server running?', 'error');
        resetSubmitBtn();
        console.error('Error:', error);
    }
});

function resetSubmitBtn() {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign Up';
}
