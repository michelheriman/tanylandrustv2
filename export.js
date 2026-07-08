const API_URL = 'https://mtk.pythonanywhere.com';
const API = '/export/kml';

async function checker() {
    const userToken = localStorage.getItem('auth_token');
    
    if (!userToken) {  // catches both null and undefined
        alert("Please sign in");
        window.location.href = './signin.html';
        return null;
    }
    return userToken;
}


let exp = document.getElementById('export_kml');
exp.addEventListener('click', async () => {
    const token = await checker();

    const response = await fetch(`${API_URL}${API}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        console.error('Export failed');
        return;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.kml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a); 
    window.URL.revokeObjectURL(url); 
});
