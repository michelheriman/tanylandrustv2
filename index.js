const api = 'https://mtk.pythonanywhere.com';

async function checker() {
        const userToken = localStorage.getItem('auth_token');
        //const user = localStorage.getItem('user');
        if (userToken === undefined || userToken === null) {
            alert("Please sign in")
            window.location.href = './signin.html'
        }
        else{
            //return {'token' : userToken, 'user' : JSON.parse(user)};
            console.log(userToken);
            return userToken
        }
    };

let garde_fou_ = checker();
console.log(garde_fou_);

async function logout() {
    const token = localStorage.getItem('auth_token'); // or wherever you store it

    try {
        const response = await fetch(`${api}/api/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (data.success) {
            // Clear stored credentials
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            // Redirect to login
            window.location.href = './signin.html';
        } else {
            console.error('Logout failed:', data.message);
            alert('Logout failed. Please try again.');
        }

    } catch (error) {
        console.error('Network error during logout:', error);
        // Force redirect anyway — better UX than leaving user stuck
        localStorage.clear();
        window.location.href = './signin.html';
    }
}

// Attach to your button
document.getElementById('logout').addEventListener('click', logout);
