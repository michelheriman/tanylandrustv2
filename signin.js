localStorage.clear();
const API_URL = 'https://mtk.pythonanywhere.com/api';
const signinForm = document.getElementById('signin-form');
const messageDiv = document.getElementById('message');

function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
}

function hideMessage() {
    messageDiv.className = 'message';
}

signinForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessage();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('refresh_token', data.refresh_token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            showMessage(data.message + ' Redirecting...', 'success');
            
            setTimeout(() => {
                window.location.href = './main.html'; //change here 
            }, 1000);
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('Connection error. Make sure Flask server is running.', 'error');
        console.error('Error:', error);
    }
});

// Check if already logged in
window.addEventListener('load', async () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        try {
            const response = await fetch(`${API_URL}/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            if (data.success) {
                window.location.href = './main.html';
            }
        } catch (error) {
            console.log('Not logged in');
        }
    }
});
