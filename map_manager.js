
// --- ESRI ARCGIS API SCRIPT ---
require([
    //"esri/config",
    "esri/Map",
    "esri/views/MapView",
    "esri/layers/GraphicsLayer",
    "esri/widgets/Sketch",
    "esri/widgets/Expand",
    "esri/widgets/Search",
    //"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", //"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
    "esri/geometry/SpatialReference",
    "esri/geometry/operators/centroidOperator",
    "esri/geometry/projection",
    "esri/geometry/geometryEngine",
    "https://unpkg.com/terraformer",
    "https://unpkg.com/terraformer-wkt-parser",
    "https://unpkg.com/terraformer-arcgis-parser",
    "esri/Graphic",
    "esri/layers/GeoJSONLayer",
    "esri/renderers/SimpleRenderer",
    "esri/symbols/SimpleFillSymbol",
    "esri/layers/support/LabelClass"
    //"https://github.com/esri/Terraformer"
], function(//esriConfig,
     Map, MapView, GraphicsLayer, Sketch, Expand, Search, //supabase,
      SpatialReference, centroidOperator, projection, geometryEngine,
    terraformer, terraformer_wkt_parser, terraformer_arcgis_parser, Graphic, GeoJSONLayer, SimpleRenderer,
    SimpleFillSymbol, LabelClass) {

    //const API_URL = 'http://127.0.0.1:5000';
    const API_URL = 'https://mtk.pythonanywhere.com/';
    

    projection.load().then(() => {
        console.log("Projection loaded");
    });
    
    // Make these available globally or to your sketch handler
    window.geometryEngine = geometryEngine;
    window.projection = projection;

    // Create the Map
    const map = new Map({
        basemap: "satellite" // You can change the basemap e.g., "arcgis-imagery", "osm-standard"
    });

    // Create the MapView
    const view = new MapView({
        container: "viewDiv",       // The ID of the div element
        map: map,                   // Reference to the map object
        center: [35, 0.5], // Longitude, latitude (center of East Africa)
        zoom: 4                     // Zoom level
    });

    async function fetchMapData(token) {
        const API = '/api/map-data';
        //const cleanToken = token.replace('Bearer ', '');

        try {
            const response = await fetch(`${API_URL}${API}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    // This is the crucial part for @token_required
                    'Authorization': `Bearer ${token}` 
                },
                //body : JSON.stringify({user})
            });

            const result = await response.json();

            if (result.success) {
                console.log('Map Data Received:', result.data);
                //fetcher2 here
                let geojson = {
        type: "FeatureCollection",
        features: result.data.map(row => {
          // Construct the properties for each feature without the `geojson` key
          let properties = { ...row };
          delete properties.geojson;
  
          return {
            type: "Feature",
            properties: properties,
            geometry: JSON.parse(row.geojson)
          };
        })
      };
      let buttonContainer = document.getElementById("parcs_but");
        //console.log(geojsonLayer);
        geojson.features.forEach(feature => {
          const graphic = new Graphic({
            geometry: {
              type: "polygon",
              rings: feature.geometry.coordinates[0] // Esri uses "rings" instead of "coordinates"
            },
            attributes: feature.properties});
            let button = document.createElement("button");
            button.innerText = feature.properties.parcel_name;//feature.properties.uuid; // Change this field based on GeoJSON
            button.className = "w-full bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 transition";
            button.onclick = function() {
              zoomToFeature(graphic);
                };
                buttonContainer.appendChild(button);
        });
      return geojson; // Return the geojson object
                //return result.data;
            } else {
                console.error('API Error:', result.message);
                alert(`Error: ${result.message}`);
                window.location.href = "./signin.html";
            }

        } 
        catch (error) {
            console.error('Network or Server Error:', error);
        }
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

    //let token = checker();
    

    async function fetcher_2(tableName, query, filter_col, filter_value) {
        const { data, error } = await supabase_
      .from(tableName)
      .select(query)
      .eq(filter_col, filter_value);
  
    if (error) {
      console.error(`Error fetching the data from ${tableName}`, error);
      return null; // Return null or handle error accordingly
    } else {
      let geojson = {
        type: "FeatureCollection",
        features: data.map(row => {
          // Construct the properties for each feature without the `geojson` key
          let properties = { ...row };
          delete properties.geojson;
  
          return {
            type: "Feature",
            properties: properties,
            geometry: JSON.parse(row.geojson)
          };
        })
      };
      let buttonContainer = document.getElementById("parcs_but");
        //console.log(geojsonLayer);
        geojson.features.forEach(feature => {
          const graphic = new Graphic({
            geometry: {
              type: "polygon",
              rings: feature.geometry.coordinates[0] // Esri uses "rings" instead of "coordinates"
            },
            attributes: feature.properties});
            let button = document.createElement("button");
            button.innerText = feature.properties.parcel_name;//feature.properties.uuid; // Change this field based on GeoJSON
            button.className = "w-full bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 transition";
            button.onclick = function() {
              zoomToFeature(graphic);
                };
                buttonContainer.appendChild(button);
        });
      return geojson; // Return the geojson object
    }
      };

     // Function to zoom to a feature
    function zoomToFeature(feature) {
      console.log(feature);
      view.goTo({
          //target : feature,
          target: feature,

          zoom: 18
      });
  };
    

    //this is for showing the parcels 
    async function load_test() {
        
        let token = await checker();
        let lal = await fetchMapData(token);
        
        const blob = new Blob([JSON.stringify(lal)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        var renderer = new SimpleRenderer({
            symbol: new SimpleFillSymbol({
                color: [0, 255, 0, 0.2], // Green with 50% opacity
                outline: {
                color: [0, 0, 0, 1], // Black outline
                width: 1
                }
            })
            });

        //console.log(url);
            
        const geojsonLayer = new GeoJSONLayer({
            url: url,
            renderer: renderer,
            labelingInfo: [
                new LabelClass({
                    // Label expression: use an attribute from your GeoJSON
                    labelExpressionInfo: {
                        expression: "$feature.parcel_name" // Replace 'name' with your attribute field
                    },
                    symbol: {
                        type: "text", // Label type
                        color: "blue",
                        haloColor: "white",
                        haloSize: "1px",
                        font: {
                            size: 12,
                            family: "Arial",
                            weight: "bold"
                        }
                    },
                    labelPlacement: "above-center" // Position of the label
                })
            ],
            outFields : ["uuid", "owner"]
            });
        map.add(geojsonLayer);
        
    };

    load_test();
    
    

    const graphicsLayer = new GraphicsLayer();
    const sketch = new Sketch({
        layer: graphicsLayer,
        view: view,
        creationMode: "update"
    });
    const sketch_ex = new Expand({
        expandIcon: "pencil-mark-plus",  // see https://developers.arcgis.com/calcite-design-system/icons/
        // expandTooltip: "Expand LayerList", // optional, defaults to "Expand" for English locale
        view: view,
        content: sketch
    });
    view.ui.add(sketch_ex, "top-right");

    const searchWidget = new Search({
        view: view
      });

    view.ui.add(searchWidget, {
        position: "top-left"
      });
    
    let creatparc = document.getElementById("addparcel");
    creatparc.addEventListener("click", () => {
        let sct = document.getElementById("enter");
        let ht = `<div class="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md border border-gray-200">

<h2 class="text-2xl font-bold text-gray-800 mb-6">Parcel Information</h2>

<div class="mb-4">
    <label for="parcel_name" class="block text-gray-700 font-semibold mb-2">Parcel Name*</label>
    <input type="text" required id="parcel_name" name="parcel_name" placeholder="e.g., Green Acre" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200">
</div>

<div class="mb-4">
    <label for="parcel_owner" class="block text-gray-700 font-semibold mb-2">Parcel Owner</label>
    <input type="text" id="parcel_owner" name="parcel_owner" placeholder="e.g., John Doe" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200">
</div>

<div class="mb-4">
    <label for="price_m2" class="block text-gray-700 font-semibold mb-2">Price by m²</label>
    <input type="number" id="price_m2" name="price_m2" placeholder="e.g., 150" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200">
</div>

<div class="mb-4">
    <label for="currency" class="block text-gray-700 font-semibold mb-2">Currency*</label>
    <select required id="currency" name="currency" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200">
        <option value="">Select a currency</option>
        
        <!-- Major Currencies -->
        <option value="USD">USD - US Dollar ($)</option>
        <option value="EUR">EUR - Euro (€)</option>
        
        <!-- East African Currencies -->
        <option value="KES">KES - Kenyan Shilling (KSh)</option>
        <option value="TZS">TZS - Tanzanian Shilling (TSh)</option>
        <option value="UGX">UGX - Ugandan Shilling (USh)</option>
        <option value="RWF">RWF - Rwandan Franc (FRw)</option>
        <option value="BIF">BIF - Burundian Franc (FBu)</option>
        <option value="SOS">SOS - Somali Shilling (Sh.So.)</option>
        <option value="ETB">ETB - Ethiopian Birr (Br)</option>
        <option value="DJF">DJF - Djiboutian Franc (Fdj)</option>
        <option value="EGP">EGP - Egyptian Pound (£E)</option>
        <option value="SDG">SDG - Sudanese Pound (SDG)</option>
        <option value="SSP">SSP - South Sudanese Pound (SS£)</option>
        <option value="MGA">MGA - Malagasy Ariary (Ar)</option>
    </select>
</div>

<div class="mb-4">
    <label for="sell_category" class="block text-gray-700 font-semibold mb-2">Category*</label>
    <select required id="sell_category" name="category" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200">
        <option value="">Select an option</option>
        <option value="to_sell">A vendre | to sell</option>
        <option value="vendu">Vendue | Sold</option>
        <option value="autre">Autre | other</option>
        <option value="na">#NA</option>
    </select>
</div>

<div class="mb-4">
    <label for="status_category" class="block text-gray-700 font-semibold mb-2">Status of Land*</label>
    <select required id="status_category" name="category" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200">
        <option value="">Select an option</option>
        <option value="titre">Titre | Title deed</option>
        <option value="titre_borne">Titre et borne | Property title</option>
        <option value="kt">Karan-tany | Land certificate</option>
        <option value="na">#NA</option>
    </select>
</div>

<div class="mb-4">
    <label for="price" class="block text-gray-700 font-semibold mb-2">Price Total*</label>
    <input type="number" required id="price" name="price" placeholder="e.g., 150" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200">
</div>

<div class="mb-4">
    <label for="location_name" class="block text-gray-700 font-semibold mb-2">Location Name</label>
    <input type="text" id="location_name" name="location_name" placeholder="e.g., Sunnyvale Heights" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200">
</div>

<div class="mb-4">
    <label for="description" class="block text-gray-700 font-semibold mb-2">Description</label>
    <textarea id="description" name="description" rows="4" placeholder="Briefly describe the parcel..." class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"></textarea>
</div>

</div>`;
        sct.innerHTML = ht;

    })

    let manag = document.getElementById("edit_pa");
    let contt = document.getElementById("table_m");
    manag.addEventListener("click", async () => {
        //erase precedent contt element if exists
        contt.innerHTML = ''
        let ifr = document.createElement("iframe");
        ifr.src = "./table_manager.html";
        ifr.className = "w-full h-full"
        contt.appendChild(ifr);
    })

    let imp = document.getElementById('import_kml');
    let conttt = document.getElementById("table_mm");

    async function data_counter() {
        const API = '/api/map-data';
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_URL}${API}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    // This is the crucial part for @token_required
                    'Authorization': `Bearer ${token}` 
                },
                //body : JSON.stringify({user})
            });
            const result = await response.json();
            const count = result.data ? result.data.length : 0;
            console.log(count);
            return count;

        }
        catch (error) {
            console.error('Network or Server Error:', error);
        }
        
}

    async function account_checker() {
        let numberd = await data_counter();
        console.log(numberd);
        let token = localStorage.getItem('auth_token')

        try{
            const API = '/api/account';

            const response = await fetch(`${API_URL}${API}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    // This is the crucial part for @token_required
                    'Authorization': `Bearer ${token}` 
                },
                //body : JSON.stringify({user})
            });

            const result = await response.json();
            //console.log(JSON.parse(result.data));
            console.log(result)
            //console.dir(result.data, { depth: null, colors: true });

            // Check for errors or no data
            if (!result.data || result.data.length === 0) {
                console.error('Error fetching profile!');
                return false;
            }
            else{
            
                // Access the first element of the array
                const profile = result.data[0];
                console.log(profile);
                
                if (profile.account === 'free' && numberd >= 2) {
                    alert(`You have reached the number limit of your free account (${numberd}) parcels already registered! contact us if you want to add more parcels!`);
                    return false;
                }
                
                if (profile.account === 'pro5' && numberd >= 5) {
                    alert(`You have reached the number limit of your pro5 account (${numberd}) parcels already registered! contact us if you want to add more parcels!`);
                    return false;
                }

                if (profile.account === 'pro10' && numberd >= 15) {
                    alert(`You have reached the number limit of your pro10 account (${numberd}) parcels already registered! contact us if you want to add more parcels!`);
                    return false;
                }

                return true
            }
        }
        catch (error){
            console.error('Network or Server Error:', error);
        }
        ;
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

    
    

    imp.addEventListener("click", async () => {
        //erase precedent contt element if exists
        conttt.innerHTML = ''
        let ifr = document.createElement("iframe");
        ifr.src = "./real_add_kml.html";
        ifr.className = "w-full h-full"
        conttt.appendChild(ifr);
        //window.location.href = './real_add_kml.html'
    })
    
    
    
    sketch.on("create", async function(event) {
    if (event.state === "complete") {
        try {
            const graphic = event.graphic;
            
            // Check if projection object exists
            if (!projection) {
                console.error("Projection module not loaded");
                alert("Map projection system error");
                return;
            }
            
            // Project geometry to WGS84
            let outSpatialReference = new SpatialReference({ wkid: 4326 });
            graphic.geometry = projection.project(graphic.geometry, outSpatialReference);
            
            // Calculate centroid
            if (!centroidOperator) {
                console.error("Centroid operator not available");
                return;
            }
            let centroid = centroidOperator.execute(graphic.geometry);
            
            // Get polygon geometry
            const polygonGeometry = graphic.geometry.toJSON();

            // Debug: Check what Terraformer functions are available
            console.log("Terraformer check:", {
                hasTerraformer: !!window.Terraformer,
                hasArcGIS: !!(window.Terraformer && window.Terraformer.ArcGIS),
                hasArcGISParse: !!(window.Terraformer && window.Terraformer.ArcGIS && window.Terraformer.ArcGIS.parse),
                hasArcGISParser: !!window.arcgisToGeoJSON,
                hasWKTConvert: !!(window.Terraformer && window.Terraformer.WKT && window.Terraformer.WKT.convert),
                hasWktParser: !!window.WktParser
            });
            
            let geojson = null;
            let wkt = null;
            
            // Try multiple conversion methods with fallbacks
            if (window.Terraformer && window.Terraformer.ArcGIS && window.Terraformer.ArcGIS.parse) {
                // Method 1: Old Terraformer API
                console.log("Using Terraformer.ArcGIS.parse");
                geojson = window.Terraformer.ArcGIS.parse(polygonGeometry);
                
                if (window.Terraformer.WKT && window.Terraformer.WKT.convert) {
                    wkt = window.Terraformer.WKT.convert(geojson);
                } else if (window.WktParser && window.WktParser.stringify) {
                    wkt = window.WktParser.stringify(geojson);
                }
            } else if (window.arcgisToGeoJSON) {
                // Method 2: arcgisToGeoJSON function (from terraformer-arcgis-parser)
                console.log("Using arcgisToGeoJSON");
                geojson = window.arcgisToGeoJSON(polygonGeometry);
                
                if (window.Terraformer && window.Terraformer.WKT && window.Terraformer.WKT.convert) {
                    wkt = window.Terraformer.WKT.convert(geojson);
                } else if (window.WktParser && window.WktParser.stringify) {
                    wkt = window.WktParser.stringify(geojson);
                }
            } else {
                // Method 3: Manual conversion as fallback
                console.log("Using manual conversion fallback");
                geojson = convertEsriToGeoJSON(polygonGeometry);
                wkt = convertToWKT(geojson);
                
                if (!geojson) {
                    console.error("Failed to convert geometry");
                    alert("Failed to convert geometry. Using simplified format.");
                    // Create a basic geojson structure
                    geojson = {
                        type: "Feature",
                        geometry: {
                            type: "Polygon",
                            coordinates: polygonGeometry.rings || []
                        },
                        properties: {}
                    };
                }
            }
            
            // If WKT conversion failed, create a simple WKT
            if (!wkt && geojson && geojson.geometry) {
                wkt = convertToWKT(geojson.geometry);
            }
            
            console.log("PostGIS WKT Format:", wkt || "Not available");
            console.log("PostGIS GeoJSON Format:", JSON.stringify(geojson));
            
            // Get current user
            const userData = await getCurrentUserWithRefresh();
            console.log(userData);
            if (!userData || !userData.data || !userData.data.email) {
                alert("User authentication failed. Please log in again.");
                return;
            }
            
            let owner_uuid = userData.data.email;
            
            // Get form values with proper null/empty checks
            let owner = document.getElementById("parcel_owner").value.trim();
            let parcel_n = document.getElementById("parcel_name").value.trim();
            let price_m2 = document.getElementById("price_m2").value.trim();
            let price = document.getElementById("price").value.trim();
            let currency = document.getElementById('currency').value;
            let sell_category = document.getElementById('sell_category').value;
            let location_name = document.getElementById("location_name").value.trim();
            let description = document.getElementById("description").value.trim();
            let status_category = document.getElementById("status_category").value.trim(); 
            
            // Validate required fields
            if (!owner) {
                alert("Please fill your name on the bottom-left");
                return;
            }
            if (!parcel_n) {
                alert("Please fill parcel name on the bottom-left");
                return;
            }
            if (!price) {
                alert("Please fill price on the bottom-left");
                return;
            }
            
            // Calculate area
            let area_ha = 0;
            if (geometryEngine && graphic.geometry) {
                try {
                    area_ha = geometryEngine.geodesicArea(graphic.geometry, "hectares");
                } catch (areaError) {
                    console.warn("Could not calculate area:", areaError);
                }
            }
            
            // Check if centroid is valid
            if (!centroid || !centroid.x || !centroid.y) {
                alert("Invalid geometry centroid. Please draw the polygon again.");
                return;
            }
            
            let longitude = centroid.x;
            let latitude = centroid.y;
            
            // Check account limits
            if (!await account_checker()) {
                alert('Please upgrade your account for more parcels!');
                return;
            }
            
            // Prepare form data - ensure we have valid geojson
            let geojsonString = "";
            try {
                // Try to get geometry from geojson object
                if (geojson && geojson.geometry) {
                    geojsonString = JSON.stringify(geojson.geometry);
                } else if (geojson && geojson.type === "Feature") {
                    geojsonString = JSON.stringify(geojson);
                } else if (geojson && geojson.type) {
                    // It's already a geometry object
                    geojsonString = JSON.stringify(geojson);
                } else {
                    // Create a basic geojson structure
                    geojsonString = JSON.stringify({
                        type: "Feature",
                        geometry: {
                            type: "Polygon",
                            coordinates: polygonGeometry.rings || []
                        },
                        properties: {}
                    });
                }
            } catch (e) {
                console.error("Error stringifying GeoJSON:", e);
                geojsonString = JSON.stringify({
                    type: "Feature",
                    geometry: {
                        type: "Polygon",
                        coordinates: polygonGeometry.rings || []
                    },
                    properties: {}
                });
            }
            
            let formData = {
                owner: owner,
                price_m2: price_m2 || 0,
                price: price,
                currency: currency,
                location_name: location_name,
                description: description,
                owner_uuid: owner_uuid,
                sell_category: sell_category,
                status_category : status_category,
                longitude: longitude,
                latitude: latitude,
                parcel_name: parcel_n,
                geojson: geojsonString,
                area_ha: area_ha,
                //wkt: wkt || ""  // Optional: include WKT if available
            };
            
            console.log("Submitting data:", formData);
            
            // Send to server
            try {
                const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
                const response = await fetch(`${API_URL}api/parcels_w`, {
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
                    window.location.reload();
                } else {
                    alert(`Registration failed: ${data.message || 'Unknown error'}`);
                }
            } catch (error) {
                console.error("Network error:", error);
                alert(`Failed to register parcel: ${error.message}`);
                alert("please verfify that you fill every required inputs!");
            }
            
        } catch (error) {
            console.error("Unexpected error:", error);
            alert("An unexpected error occurred. Please try again.");
        }
    }
});

// Manual conversion functions as fallback
function convertEsriToGeoJSON(esriJson) {
    if (!esriJson) return null;
    
    try {
        if (esriJson.rings && Array.isArray(esriJson.rings)) {
            return {
                type: "Feature",
                geometry: {
                    type: "Polygon",
                    coordinates: esriJson.rings
                },
                properties: {}
            };
        } else if (esriJson.paths && Array.isArray(esriJson.paths)) {
            return {
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: esriJson.paths[0] || []
                },
                properties: {}
            };
        } else if (esriJson.x !== undefined && esriJson.y !== undefined) {
            return {
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [esriJson.x, esriJson.y]
                },
                properties: {}
            };
        }
    } catch (e) {
        console.error("Error in manual conversion:", e);
    }
    
    return null;
}

function convertToWKT(geojson) {
    if (!geojson) return "";
    
    try {
        // Handle both Feature and Geometry objects
        const geometry = geojson.geometry || geojson;
        
        if (geometry.type === "Polygon" && geometry.coordinates) {
            const rings = geometry.coordinates.map(ring => 
                `(${ring.map(coord => `${coord[0]} ${coord[1]}`).join(', ')})`
            );
            return `POLYGON(${rings.join(', ')})`;
        }
        
        if (geometry.type === "Point" && geometry.coordinates) {
            return `POINT(${geometry.coordinates[0]} ${geometry.coordinates[1]})`;
        }
        
        if (geometry.type === "LineString" && geometry.coordinates) {
            return `LINESTRING(${geometry.coordinates.map(coord => `${coord[0]} ${coord[1]}`).join(', ')})`;
        }
    } catch (e) {
        console.error("Error converting to WKT:", e);
    }
    
    return "";
}
    

});

// --- UI INTERACTIVITY SCRIPT ---
document.addEventListener('DOMContentLoaded', () => {
    const asidePanel = document.getElementById('asidePanel');
    const openBtn = document.getElementById('openBtn');
    const closeBtn = document.getElementById('closeBtn');

    // Function to open the sidebar
    openBtn.addEventListener('click', () => {
        asidePanel.classList.remove('-translate-x-full');
    });

    // Function to close the sidebar
    closeBtn.addEventListener('click', () => {
        asidePanel.classList.add('-translate-x-full');
    });
});

