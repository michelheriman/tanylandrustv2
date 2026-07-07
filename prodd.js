const API_URL = 'https://mtk.pythonanywhere.com/';

// Security: escape any untrusted/user-supplied text before it is ever
// inserted into innerHTML, to prevent stored XSS from listing data
// (description, owner, location_name, etc. can be entered by any user).
function escapeHTML(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

//create the table message and object message in the supabase db 

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

async function get_(productId) {
  let API = '/api/getprodd';
  let token = await checker();
  try{
    const payload = { data: productId };
    const response = await fetch(
      `${API_URL}${API}`, {
        method: 'POST',
        headers: {
                    'Content-Type': 'application/json',
                    // This is the crucial part for @token_required
                    'Authorization': `Bearer ${token}` 
                },
        body : JSON.stringify(payload)
      }
    )
    const result = await response.json();
    return result
  }
  catch (error){
    console.error("Error sending data:", error);
  }
}

// Step 2: Get product ID from URL
const params = new URLSearchParams(window.location.search);
const productId = params.get("id");

// Step 3: Fetch product from Supabase
async function loadProduct() {
    //const { data: user } = await supabase_.auth.getUser(); //
    const session = await getCurrentUserWithRefresh();
    //const sender_id = user.email; //session.data.session.user.email
    const sender_id = session.data.email;
    if (!productId) {
    document.getElementById("product-detail").innerText = "No product ID provided.";
    return;
    }

    /*
    const { data: product, error } = await supabase_
    .from("main_parcels")
    .select("*")
    .eq("uuid", productId)
    .single();
    */

    let product = await get_(productId);
    console.log(product)

    if (!product) {
    document.getElementById("product-detail").innerText = "Product not found.";
    return;
    }

    //mila ovaina tanteraka
    document.getElementById("product-detail").innerHTML = `
    <div class="max-w-xl mx-auto p-6 bg-white rounded-2xl shadow-lg space-y-4">
    <h2 class="text-2xl font-bold text-gray-800">${escapeHTML(product.data[0].parcel_name)}</h2>
    <p class="text-gray-600">${escapeHTML(product.data[0].description)}</p>

    <div class="grid grid-cols-2 gap-4 text-gray-700">
        <div>
        <h3 class="font-semibold">Vendor</h3>
        <p>${escapeHTML(product.data[0].owner)}</p>
      </div>
      <div>
        <h3 class="font-semibold">Pice | Prix</h3>
        <p>${escapeHTML(product.data[0].price)}</p>
      </div>
      <div>
        <h3 class="font-semibold">Price per m2 | Prix par m2</h3>
        <p>${escapeHTML(product.data[0].price_m2)}</p>
      </div>
      <div>
        <h3 class="font-semibold">Currency</h3>
        <p>${escapeHTML(product.data[0].currency)}</p>
      </div>
      <div class="col-span-2">
        <h3 class="font-semibold">Location</h3>
        <p>${escapeHTML(product.data[0].location_name)}</p>
      </div>
    </div>

    <div class="mt-4">
      <label class="block text-sm font-medium text-gray-700 mb-1">Your Message</label>
      <textarea id="desc" class="w-full border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 h-24 resize-none"></textarea>
    </div>

    <button
      id="place-bid-btn"
      data-uuid="${escapeHTML(product.data[0].uuid)}"
      data-owner-uuid="${escapeHTML(product.data[0].owner_uuid)}"
      data-parcel-name="${escapeHTML(product.data[0].parcel_name)}"
      class="w-full bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition duration-200"
    >
      Place Bid
    </button>
  </div>
    `;

    // Security: build the click handler with real values via addEventListener
    // instead of interpolating them into an inline onclick="..." string.
    // Inline onclick + string interpolation is a JS-string-inside-HTML-attribute
    // context, where a single quote in a user-supplied field (e.g. parcel_name)
    // can break out of the string and inject arbitrary JavaScript. Reading the
    // values back from data-* attributes (already HTML-escaped above) avoids
    // that entirely.
    const bidBtn = document.getElementById('place-bid-btn');
    if (bidBtn) {
        bidBtn.addEventListener('click', () => {
            const objet = `${sender_id} | ${bidBtn.dataset.parcelName} | ${bidBtn.dataset.ownerUuid}`;
            buyNow(bidBtn.dataset.uuid, bidBtn.dataset.ownerUuid, objet);
        });
    }
}

async function buyNow(productId, vendorid, objet) {
    // You can redirect to a checkout page or trigger a payment modal here
    //alert("Buy now clicked for product ID: " + productId);
    let content = document.getElementById("desc").value;
    //let token = await checker();
    //console.log(content);
    //const { data: user } = await supabase_.auth.getUser();
    const session = await getCurrentUserWithRefresh();
    //const sender_id = user.email;
    //console.log(sender_id);
    const sender_id = session.data.email;
    const formData = {
          sender_id: sender_id,
          receiver_id: vendorid,
          content: content,
          uuid_post : productId,
          objet : objet
        }
      
    console.log("Submitting data:", formData);

    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/messages_w`, { //'/api/messages_w'
          method: 'POST',
          //mode: 'cors',
          headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`  // Add this line
          },
          body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
          alert(`Bid registered successfully!`);
          // Optionally clear form or refresh data
      } else {
          alert(`Registration failed: ${data.message || 'Unknown error'}`);
      }
    }
    catch (error) {
      console.error("Network error:", error);
      alert(`Failed to register parcel: ${error.message}`);
    }
    
  function redirect(){
        alert("your bid was placed successfuly!");
        window.location.href = "./main_market.html"
        //window.location.reload()
  }
  redirect();
  
  
  
}

loadProduct();
