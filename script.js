const API_URL = 'https://mtk.pythonanywhere.com';

// Security: escape any untrusted/user-supplied text before it is ever
// inserted into innerHTML, to prevent stored XSS from chat messages
// (any signed-in user can submit arbitrary text as "content"/"objet").
function escapeHTML(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

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

//launch all the chat on the Agrichat
let obje;
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

async function load(objt, uuid) {
  //obje = null;
  
  try {

    let uuid_d = document.getElementById("uuid_post");
    //console.log(uuid);
    //console.log(uuid_d);
    uuid_d.value = uuid;
    console.log(uuid_d);
    
    let main_me = document.getElementById("main_mess");
    main_me.innerHTML = '';
    let token = await checker();
    let API = '/api/load_message';
    const sent = {"data" : objt};
    const result = await fetch(
      `${API_URL}${API}`, {
        method: 'POST',
        headers: {
                    'Content-Type': 'application/json',
                    // This is the crucial part for @token_required
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
        body : JSON.stringify(sent)
      }
    )

    const response = await result.json();
  
  if (!response.success) {
        console.error(`Error fetching the data: ${response.message}`);
        return null; // Return null or handle error accordingly
      }
  else {
    // conditions des messages des users
    // main user en vert
    //mila volena eto ilay chat sy envois eny ambany
    main_me.innerHTML = '';
    let tit = document.getElementById("object_earth");
    //console.log(tit)
    tit.textContent = `${objt}`;
    let session = await getCurrentUserWithRefresh()//await supabase_.auth.getSession();
    
    response.data.forEach(element => {
      
      let user = session.data.email;//session.data.session.user.email;
      let receiver = element.receiver_id;
      let sender = element.sender_id;
      let uuid = element.uuid_post;
      let cont = document.createElement("div");
      cont.object = objt;
      cont.sender = sender;
      cont.receiver = receiver;
      cont.user = user;
      cont.uuid = uuid;
      cont.id = "data";
      main_me.appendChild(cont);
      if (element.sender_id === user) {
        let mes = `
        <div class="flex items-end justify-end gap-3 px-4 sm:px-6 md:px-12 py-4">
          <div class="bg-gradient-to-br from-green-600 to-emerald-500 text-white p-5 sm:p-6 rounded-2xl shadow-xl max-w-md w-full transition-transform duration-300 hover:scale-[1.02]">
            <p class="text-sm sm:text-base leading-relaxed font-black italic tracking-wider text-gray-100 drop-shadow-sm mb-2">
              ${escapeHTML(element.sender_id)}
            </p>
            <p class="text-sm sm:text-base leading-relaxed">${escapeHTML(element.content)}</p>
            <span class="text-xs text-green-100 block mt-3 text-right">${escapeHTML(element.created_at)}</span>
          </div>
        </div>

        `
        let conts = document.createElement("div")
        conts.innerHTML = mes;
        main_me.appendChild(conts);
      }

      else if (element.receiver_id === user){
        
       let mes = `
        <div class="flex items-start gap-3">
            <div class="bg-blue-500 text-white p-4 rounded-xl shadow max-w-md">
                <p class="text-sm sm:text-base leading-relaxed font-black italic tracking-wider text-blue-100 drop-shadow-sm mb-2">${escapeHTML(element.sender_id)}</p>
                <p>${escapeHTML(element.content)}</p>
                <span class="text-xs text-blue-200 block mt-2 text-right">${escapeHTML(element.created_at)}</span>
                </div>
        </div>
       `
        
        let conts = document.createElement("div")
        conts.innerHTML = mes;
        main_me.appendChild(conts);
        
       //main_me.appendChild(mes);

      }

      
      else {
        
       let mess = `
        <div class="flex items-start gap-3">
            <div class="bg-blue-500 p-4 rounded-xl shadow max-w-md">
                <h4 class="text-xl sm:text-2xl md:text-3xl font-extrabold italic text-white tracking-wide">${escapeHTML(element.sender_id)}</h3>
                <p> ${escapeHTML(element.content)}</p>
                <span class="text-xs text-blue-200 block mt-2 text-right">6:42 AM</span>
            </div>
        </div>
       `
        let conts = document.createElement("div")
        conts.innerHTML = mess;
        main_me.appendChild(conts);
      }
        
      
    })
  }
  }
  catch (error) {
    console.error("Error sending data:", error);
  }
}

async function mail_launcher() {
  let cont = document.getElementById("mails");
  try {
    let token = await checker();
    let API = '/api/load_object';
    let session = await getCurrentUserWithRefresh()//await supabase_.auth.getSession();
    console.log(session);
    let user = session.data.email;
    const sent = {"data" : user};
    const result = await fetch(
      `${API_URL}${API}`, {
        method: 'POST',
        headers: {
                    'Content-Type': 'application/json',
                    // This is the crucial part for @token_required
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
        body : JSON.stringify(sent)
      }
    )
    const response = await result.json();

    /*
  const {data, error} = await supabase_ //object_message
        .from('object_message') // Replace with your table name
        .select("*")
        .eq("main_user", user)
    */
  if (response.success === false) {
        console.error(`Error fetching the data ${response.message}`);
        return null; // Return null or handle error accordingly
      }
  else {
        //obje = null;
        let mailsplace = document.getElementById("mails")
        response.data.forEach(element => {
        let objt = element.objet;
        let mmail = element.main_user;
        let but = `
          <button type="button" class="thread-open-btn w-full text-left flex items-center gap-4 p-4 hover:bg-gray-100 transition rounded-lg">
              <!-- Avatar -->
              <div class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-white font-bold">
                A
              </div>
              
              <div class="flex-1">
                <div class="flex justify-between">
                  <h4 class="font-semibold text-gray-800">${escapeHTML(mmail)}</h4>
                  
                </div>
                <p class="text-sm text-gray-600 truncate">${escapeHTML(objt)}</p>
              </div>
        </button>

          `
          let divc = document.createElement("div");
          divc.innerHTML = but;
          // Security: pass untrusted values through the DOM API / a real
          // click handler instead of interpolating them into an inline
          // onclick="load('...')" string, which can be broken out of even
          // when HTML-escaped (it's a separate, JS, context).
          const threadBtn = divc.querySelector('.thread-open-btn');
          threadBtn.addEventListener('click', () => load(objt, element.uuid_post));
          cont.appendChild(divc);
          

        });
  }
}
  catch (error){
    //alert(error)
    console.log(error)
  }

};

mail_launcher();

async function write_message() {
  
  let sub = document.getElementById("text_sub");
  sub.addEventListener("click", async () => {
    let saisie = document.getElementById("saisie").value; //text inputed
    //get the user name as sender 
    //const session = await supabase_.auth.getSession();
    const session = await getCurrentUserWithRefresh();

    let sender = session.data.email;
    //get the object of the message
    let obj = document.getElementById("data"); //this hold every data from the loaded messages
    
    let receiver;
    if (sender === obj.sender) {
      //sender = obj.sender;
      receiver = obj.receiver;
    } 
    else if (sender !== obj.sender) {
      receiver = obj.sender;
    }
    const formData = {
          sender_id : sender,
          receiver_id : receiver,
          content : saisie,
          uuid_post : obj.uuid,// soilina ny annonce, rehefa mampiditra parcelles zareo , id anle parcelles
          objet : obj.object
          }

    
    try{
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

      let nmes = `
        <div class="flex items-end justify-end gap-3">
        <div class="bg-green-600 text-white p-4 rounded-xl shadow max-w-md">
          <p class="text-sm sm:text-base leading-relaxed font-black italic tracking-wider text-gray-100 drop-shadow-sm mb-2">${escapeHTML(sender)}</p>
          <p>${escapeHTML(saisie)}</p>
          <span class="text-xs text-green-200 block mt-2 text-right">Now</span>
        </div>
      </div>
        `
      let main_me = document.getElementById("main_mess");
      let nm = document.createElement("div");
      nm.innerHTML = nmes;
      main_me.appendChild(nm)
      
      if (data.success) {
          alert(`Message sent successfully!`);
          document.getElementById("saisie").value = "";
          // Optionally clear form or refresh data
      } else {
          alert(`Registration failed: ${data.message || 'Unknown error'}`);
      }
    
    }
  catch (error) {
    alert(error)
  }

  })
};

write_message();

function refreshAfter8Minutes() {
    setTimeout(function() {
        console.log('Refreshing page after 8 minutes');
        location.reload();
    }, 8 * 60 * 1000);
}

// Start one-time refresh
refreshAfter8Minutes();

// Wire up your existing button
document.getElementById('admintalk').addEventListener('click', openAdminModal);

function openAdminModal() {
  document.getElementById('adminOverlay').classList.remove('hidden');
}
function closeAdminModal() {
  document.getElementById('adminOverlay').classList.add('hidden');
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAdminModal();
});

async function write_admin_message() {
  
  let sub = document.getElementById("sendadmin");
  sub.addEventListener("click", async () => {
    let saisie = document.getElementById("saisie").value; //text inputed
    //get the user name as sender 
    //const session = await supabase_.auth.getSession();
    const session = await getCurrentUserWithRefresh();

    let sender = session.data.email;
    let receiver = "raherimanantsoa.consult@gmail.com";
    
    const formData = {
          sender_id : sender,
          receiver_id : receiver,
          content : document.getElementById("msadm").value,
          uuid_post : crypto.randomUUID(),// soilina ny annonce, rehefa mampiditra parcelles zareo , id anle parcelles
          objet : document.getElementById("objadm").value
          }

    
    try{
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
          alert(`Parcel registered successfully!`);
          // Optionally clear form or refresh data
          closeAdminModal();
      } else {
          alert(`Registration failed: ${data.message || 'Unknown error'}`);
      }
      
    }
  catch (error) {
    alert(error)
  }

  })
};

write_admin_message();

