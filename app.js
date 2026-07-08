const API_URL = 'https://mtk.pythonanywhere.com/';

const columns = ['owner', 'parcel_name', 'price_m2', 'price', 'location_name', 'description', 'sell_category', 'status_category'];


async function checker() {
        const userToken = localStorage.getItem('auth_token');
        if (userToken === undefined || userToken === null) {
            alert("Please sign in")
            window.location.href = './signin.html'
        }
        else{
            return userToken
        }
    };

let garde_fou = checker();

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
            
            let response = await fetch('https://mtk.pythonanywhere.com/api/current_user', { 
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.status === 401 && refreshToken) {
                console.log('Token expired, attempting refresh...');
                
                try {
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
                        
                        localStorage.setItem('token', refreshData.token);
                        if (refreshData.refresh_token) {
                            localStorage.setItem('refresh_token', refreshData.refresh_token);
                        }
                        
                        console.log('Token refreshed successfully');
                        
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

async function loadPropertiesTable() {

    try {
        showLoading(true);
        const token = await checker();
        const session = await getCurrentUserWithRefresh();
        let us = session.data.email; 
        let API = '/api/map-data';
        const response = await fetch(
            `${API_URL}${API}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                
            }
        )
        const data = await response.json()

        if (!data.success) throw data.message;

        tableData = data.data || [];
        renderTable(tableData);
        showStatus(`Loaded ${tableData.length} properties successfully!`, 'success');
    } catch (err) {
        showStatus(`Error: ${err.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

//---------\\

const SELL_CATEGORY_OPTIONS = [
    { value: 'to_sell', label: 'A vendre | to sell' },
    { value: 'vendu',   label: 'Vendue | Sold' },
    { value: 'autre',   label: 'Autre | other' },
    { value: 'na',      label: '#NA' },
];

const STATUS_OPTIONS = [
    { value: 'titre',       label: 'Titre | Title deed' },
    { value: 'titre_borne', label: 'Titre et borne | Property title' },
    { value: 'kt',          label: 'Karan-tany | Land certificate' },
    { value: 'na',          label: '#NA' },
];

function renderTable(data) {
    if (!data || data.length === 0) {
        showStatus('No properties found', 'warning');
        return;
    }

    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    data.forEach((row) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition';

        columns.forEach(col => {
            const td = document.createElement('td');
            td.className = 'px-4 py-3 text-sm text-gray-700 border border-gray-200';

            const value = row[col];

            if (col === 'sell_category' || col === 'status_category') {
                const options = col === 'sell_category' ? SELL_CATEGORY_OPTIONS : STATUS_OPTIONS;

                const select = document.createElement('select');
                select.className = 'w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

                options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.textContent = opt.label;
                    if (opt.value === value) option.selected = true;
                    select.appendChild(option);
                });

                select.addEventListener('change', () => {
                    updateCell(row.id, col, select.value, row);
                });

                td.appendChild(select);
            } else {
                const input = document.createElement('input');
                input.type = col === 'price_m2' || col === 'price' ? 'number' : 'text';
                input.value = value !== null && value !== undefined ? value : '';
                input.className = 'w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500';

                input.addEventListener('blur', () => {
                    updateCell(row.id, col, input.value, row);
                });

                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        updateCell(row.id, col, input.value, row);
                    }
                });

                td.appendChild(input);
            }

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    document.getElementById('tableSection').classList.remove('hidden');
}

async function updateCell(rowId, column, newValue, row) {
    
    const token = await checker();
    let API = '/api/update_t';
    const updateData = { [column]: newValue };

    const sent = {"element" : updateData,
                    'id' : rowId};
    
    const response = await fetch (
                    `${API_URL}${API}`, {
                method: 'POST',
                headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'Authorization': `Bearer ${token}` 
                        },
                body : JSON.stringify(sent)
            }
                )
    
    const result = await response.json();

    if (!response.success) throw response.message;

    row[column] = newValue;
    showStatus(`${column} updated successfully!`, 'success');
    
};

function showStatus(message, type) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = 'p-4 rounded-lg text-sm font-medium';

    if (type === 'success') {
        statusEl.classList.add('bg-green-100', 'text-green-800');
    } else if (type === 'error') {
        statusEl.classList.add('bg-red-100', 'text-red-800');
    } else if (type === 'warning') {
        statusEl.classList.add('bg-yellow-100', 'text-yellow-800');
    }

    statusEl.classList.remove('hidden');

    setTimeout(() => {
        statusEl.classList.add('hidden');
    }, 4000);
}

function showLoading(show) {
    document.getElementById('loadingIndicator').classList.toggle('hidden', !show);
}
