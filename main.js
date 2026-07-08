
// Initialize Esri Map
require([
    "esri/Map",
    "esri/views/MapView",
    "esri/Graphic",
    "esri/layers/GraphicsLayer",
    //"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
    "esri/widgets/Expand",
    "esri/widgets/BasemapGallery",
    "esri/widgets/Print",
    "esri/widgets/Search"
], function(Map, MapView, Graphic, GraphicsLayer, //supabase,
     Expand, BasemapGallery, Print, Search) {
    let map, view, graphicsLayer;
    const interestedParcels = [];
    // Supabase Configuration
    const API_URL = 'https://mtk.pythonanywhere.com/';

    // Security: escape any untrusted/user-supplied text before it is ever
    // inserted into innerHTML, to prevent stored XSS from listing data
    // (parcel_name, location_name, description, etc. can be entered by any user).
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
            return userToken
        }
    }


    async function fetchParcelsFromSupabase() {
        const API = '/api/market';
        let token = await checker();
        
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
            if (!result.success){
                alert("Please sign in")
                window.location.href = './signin.html'
            }
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
            return geojson
        }
        

        catch(error) {
            console.log(error);
        }
    };


    
    graphicsLayer = new GraphicsLayer();
    
    map = new Map({
        basemap: "hybrid",
        layers: [graphicsLayer]
    });

    view = new MapView({
        container: "mapView",
        map: map,
        center: [47.5, -18.9], // Madagascar coordinates
        zoom: 12
    });

    const searchWidget = new Search({
        view: view
      });

    view.ui.add(searchWidget, {
        position: "top-left"
      });

    view.when(() => {
        loadParcels();
    });

    //basemap
    const basemapGallery = new Expand({
      content : new BasemapGallery({
          view: view,
          container: document.createElement("div")
        })
        });
    
    // Add the widget to the top-right corner of the view
    view.ui.add(basemapGallery, {
      position: "top-right"
    });

    const printexp = new Expand({
      content : new Print({
        view: view, 
        printServiceUrl: "https://sampleserver6.arcgisonline.com/arcgis/rest/services/Utilities/PrintingTools/GPServer/Export%20Web%20Map%20Task"
      })
    });

    view.ui.add(printexp, {
      position: "top-right"
    });

    // Make view globally accessible
    window.mapView = view;
    window.Graphic = Graphic;
    window.graphicsLayer = graphicsLayer;

    // Load parcels from Supabase
async function loadParcels() {
    try {
        // Sample data - Replace with actual Supabase fetch
        const parcels = await fetchParcelsFromSupabase();
        displayParcels(parcels);
    } catch (error) {
        console.error('Error loading parcels:', error);
        displaySampleParcels();
    }
}



// Display sample parcels (fallback)
function displaySampleParcels() {
    const sampleParcels = [
        {
            id: 1,
            parcel_name: "Parcel A - Urban Land",
            price_m2: 50,
            price: 125000,
            location_name: "Antananarivo Center",
            description: "Prime urban land in the heart of Antananarivo, perfect for commercial or residential development.",
            geojson: {
                type: "Polygon",
                coordinates: [[
                    [47.52, -18.91],
                    [47.525, -18.91],
                    [47.525, -18.915],
                    [47.52, -18.915],
                    [47.52, -18.91]
                ]]
            }
        },
        {
            id: 2,
            parcel_name: "Parcel B - Agricultural",
            price_m2: 17,
            price: 85000,
            location_name: "Analamanga Region",
            description: "Spacious agricultural land with fertile soil, ideal for farming or eco-tourism projects.",
            geojson: {
                type: "Polygon",
                coordinates: [[
                    [47.51, -18.92],
                    [47.515, -18.92],
                    [47.515, -18.925],
                    [47.51, -18.925],
                    [47.51, -18.92]
                ]]
            }
        },
        {
            id: 3,
            parcel_name: "Parcel C - Commercial",
            price_m2: 108,
            price: 195000,
            location_name: "Avenue de l'Indépendance",
            description: "Premium commercial location on major avenue, high foot traffic area with excellent visibility.",
            geojson: {
                type: "Polygon",
                coordinates: [[
                    [47.53, -18.905],
                    [47.535, -18.905],
                    [47.535, -18.91],
                    [47.53, -18.91],
                    [47.53, -18.905]
                ]]
            }
        }
    ];
    
    displayParcels(sampleParcels);
}

// Display parcels in the list
function displayParcels(parcels) {
    const parcelList = document.getElementById('parcelList');
    parcelList.innerHTML = '';
    parcels.features.forEach(parcel => {
        const parcelCard = createParcelCard(parcel);
        parcelList.appendChild(parcelCard);
        addParcelToMap(parcel);
    });
}

// Create parcel card HTML
function createParcelCard(parcel) {
    const card = document.createElement('div');
    card.className = 'bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow';

    const formattedPrice = new Intl.NumberFormat('en-US').format(parcel.properties.price);
    const formattedPriceM2 = new Intl.NumberFormat('en-US').format(parcel.properties.price_m2);
    
    card.innerHTML = `
        <div class="mb-3">
            <h3 class="text-lg font-semibold text-gray-800">${escapeHTML(parcel.properties.parcel_name)}</h3>
        </div>
        <div class="space-y-2 text-sm text-gray-600 mb-3">
            <p><span class="font-medium">Location:</span> ${escapeHTML(parcel.properties.location_name)}</p>
            <p><span class="font-medium">Price per m²:</span> ${formattedPriceM2}</p>
            <p><span class="font-medium">Reference:</span> ${escapeHTML(parcel.properties.uuid)}</p>
            <p class="text-gray-700">${escapeHTML(parcel.properties.description)}</p>
            
        </div>
        <div class="mb-4">
            <p class="text-2xl font-bold text-blue-600">${formattedPrice}</p>
        </div>
        <div class="mb-4">
            <p class="text-2xl font-bold text-blue-600">${parcel.properties.currency}</p>
        </div>
        <div class="flex gap-2">
            <button onclick="zoomToParcel(${parcel.properties.id})" 
                    class="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition-colors">
                View on Map
            </button>
            <!--button onclick="toggleInterest(${parcel.properties.id}, this)" 
                    class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded transition-colors interest-btn">
                Mark Interest
            </button-->
            <button onclick="window.location.href='products_details.html?id=${parcel.properties.uuid}'" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded transition-colors interest-btn">
                Mark Interest
            
            </button>

            <button onclick="window.location.href='details_parcel.html?id=${parcel.properties.uuid}'" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded transition-colors interest-btn">
            greport
            
            </button>
        </div>
    `;
    
    return card;
}

    function addParcelToMap(parcel) {
        if (!parcel.geometry || !window.Graphic) return;

        const rings = parcel.geometry.coordinates[0].map(coord => [coord[0], coord[1]]);
        
        const polygon = {
            type: "polygon",
            rings: [rings]
        };

        const fillSymbol = {
            type: "simple-fill",
            color: [51, 122, 183, 0.3],
            outline: {
                color: [51, 122, 183],
                width: 2
            }
        };

        const formattedPrice = new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD',
            minimumFractionDigits: 0
        }).format(parcel.properties.price);
        
        const formattedPriceM2 = new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD',
            minimumFractionDigits: 0
        }).format(parcel.properties.price_m2);

        const graphic = new window.Graphic({
            geometry: polygon,
            symbol: fillSymbol,
            attributes: {
                parcelId: parcel.properties.id,
                parcel_name: parcel.properties.parcel_name,
                location_name: parcel.properties.location_name,
                description: parcel.properties.description,
                uuid: parcel.properties.uuid,
                formattedPrice: formattedPrice,
                formattedPriceM2: formattedPriceM2
            },
            popupTemplate: {
                title: "{parcel_name}",
                content: (feature) => {
                    const div = document.createElement('div');
                    div.className = 'bg-white rounded-lg';
                    div.innerHTML = `
                        <div class="space-y-2 text-sm text-gray-600 mb-3">
                            <p><span class="font-medium">Location:</span> ${escapeHTML(feature.graphic.attributes.location_name)}</p>
                            <p><span class="font-medium">Price per m²:</span> ${feature.graphic.attributes.formattedPriceM2}</p>
                            <p><span class="font-medium">Reference:</span> ${escapeHTML(parcel.properties.uuid)}</p>
                            <p class="text-gray-700">${escapeHTML(feature.graphic.attributes.description)}</p>
                        </div>
                        <div class="mb-4">
                            <p class="text-2xl font-bold text-blue-600">${feature.graphic.attributes.formattedPrice}</p>
                        </div>
                        <div class="flex gap-2">
                            <button data-action="zoom" data-parcel-id="${feature.graphic.attributes.parcelId}"
                                    class="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition-colors">
                                View on Map
                            </button>
                            <button data-action="details" data-uuid="${feature.graphic.attributes.uuid}"
                                    class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded transition-colors">
                                Mark Interest
                            </button>
                            </button>

                            <button onclick="window.location.href='details_parcel.html?id=${parcel.properties.uuid}'" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded transition-colors interest-btn">
                                greport
                            
                            </button>
                        </div>
                    `;
                    
                    // Add event listeners to buttons
                    setTimeout(() => {
                        const zoomBtn = div.querySelector('[data-action="zoom"]');
                        const detailsBtn = div.querySelector('[data-action="details"]');
                        
                        if (zoomBtn) {
                            zoomBtn.addEventListener('click', () => {
                                zoomToParcel(feature.graphic.attributes.parcelId);
                            });
                        }
                        
                        if (detailsBtn) {
                            detailsBtn.addEventListener('click', () => {
                                window.location.href = `products_details.html?id=${feature.graphic.attributes.uuid}`;
                            });
                        }
                    }, 0);
                    
                    return div;
                }
            }
        });

    window.graphicsLayer.add(graphic);
}

    

    // Save interest to Supabase
    async function saveInterestToSupabase(parcelId) {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/interests`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    parcel_id: parcelId,
                    timestamp: new Date().toISOString()
                })
            });
            console.log('Interest saved for parcel:', parcelId);
        } catch (error) {
            console.error('Error saving interest:', error);
        }
    }

        // Remove interest from Supabase
        async function removeInterestFromSupabase(parcelId) {
            try {
                await fetch(`${SUPABASE_URL}/rest/v1/interests?parcel_id=eq.${parcelId}`, {
                    method: 'DELETE',
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`
                    }
                });
                console.log('Interest removed for parcel:', parcelId);
            } catch (error) {
                console.error('Error removing interest:', error);
            }
        }
});


// Zoom to specific parcel
    function zoomToParcel(parcelId) {
        const graphics = window.graphicsLayer.graphics.items;
        const graphic = graphics.find(g => g.attributes.parcelId === parcelId);
        
        if (graphic && window.mapView) {
            window.mapView.goTo({
                target: graphic.geometry,
                zoom: 16
            }, {
                duration: 1000
            });
        }
    }

    // Toggle interest in parcel
    function toggleInterest(parcelId, button) {
        const index = interestedParcels.indexOf(parcelId);
        
        if (index === -1) {
            interestedParcels.push(parcelId);
            button.classList.remove('bg-gray-200', 'hover:bg-gray-300', 'text-gray-700');
            button.classList.add('bg-green-500', 'hover:bg-green-600', 'text-white');
            button.textContent = 'Interested ✓';
            
            // Here you would typically save to Supabase
            saveInterestToSupabase(parcelId);
        } else {
            interestedParcels.splice(index, 1);
            button.classList.remove('bg-green-500', 'hover:bg-green-600', 'text-white');
            button.classList.add('bg-gray-200', 'hover:bg-gray-300', 'text-gray-700');
            button.textContent = 'Mark Interest';
            
            // Remove from Supabase
            removeInterestFromSupabase(parcelId);
        }
    }


