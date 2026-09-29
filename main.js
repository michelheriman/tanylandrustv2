
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
    let marketFeatures = [];
    let marketSort = 'name';
    let marketNameDescending = false;
    // Supabase Configuration

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

    function parcelDate(properties) {
        const field = ['updated_at', 'updatedAt', 'created_at', 'createdAt'].find((key) => properties?.[key] != null);
        return field ? Date.parse(properties[field]) || 0 : 0;
    }

    function renderMarketplaceCards() {
        const list = document.getElementById('parcelList');
        if (!list) return;
        const query = document.getElementById('marketSearch')?.value.trim().toLocaleLowerCase() || '';
        const rows = marketFeatures.filter((feature) => {
            const properties = feature.properties || {};
            return !query || ['parcel_name', 'owner', 'location_name', 'description', 'price', 'price_m2', 'uuid']
                .some((key) => String(properties[key] ?? '').toLocaleLowerCase().includes(query));
        }).sort((a, b) => marketSort === 'date'
            ? parcelDate(b.properties) - parcelDate(a.properties)
            : String(a.properties.parcel_name ?? '').localeCompare(String(b.properties.parcel_name ?? ''), undefined, { sensitivity: 'base' }) * (marketNameDescending ? -1 : 1));
        list.replaceChildren();
        if (rows.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'market-empty';
            empty.textContent = query ? 'No parcels match this search.' : 'No parcels are currently available in the marketplace.';
            list.appendChild(empty);
            return;
        }
        rows.forEach((feature) => list.appendChild(createParcelCard(feature)));
    }

    document.getElementById('marketSearch')?.addEventListener('input', renderMarketplaceCards);
    document.getElementById('marketNameSort')?.addEventListener('click', (event) => {
        marketSort = 'name';
        marketNameDescending = !marketNameDescending;
        event.currentTarget.setAttribute('aria-pressed', 'true');
        event.currentTarget.classList.add('is-active');
        const dateButton = document.getElementById('marketDateSort');
        dateButton?.classList.remove('is-active');
        dateButton?.setAttribute('aria-pressed', 'false');
        event.currentTarget.textContent = marketNameDescending ? 'A-Z ↓' : 'A-Z ↑';
        renderMarketplaceCards();
    });
    document.getElementById('marketDateSort')?.addEventListener('click', (event) => {
        marketSort = 'date';
        event.currentTarget.setAttribute('aria-pressed', 'true');
        event.currentTarget.classList.add('is-active');
        const nameButton = document.getElementById('marketNameSort');
        nameButton?.classList.remove('is-active');
        nameButton?.setAttribute('aria-pressed', 'false');
        renderMarketplaceCards();
    });

    async function fetchParcelsFromSupabase() {
        const response = await fetch('/api/market', { method: 'GET' });
        if (!response.ok) {
            const error = new Error(response.status === 401
                ? 'Your session has expired. Sign in again, then retry loading the marketplace.'
                : response.status >= 500
                    ? 'The marketplace service is unavailable. Please try again.'
                    : 'Marketplace parcels could not be loaded. Please try again.');
            error.status = response.status;
            throw error;
        }
        const result = await response.json();
        if (result?.success !== true || !Array.isArray(result.data)) {
            throw new Error('The marketplace returned an unexpected parcel list. Please retry.');
        }
        return {
            type: "FeatureCollection",
            features: result.data.map(row => {
                let geometry;
                try { geometry = typeof row.geojson === 'string' ? JSON.parse(row.geojson) : row.geojson; }
                catch { throw new Error('The marketplace returned invalid parcel geometry. Please retry.'); }
                if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type) || !Array.isArray(geometry.coordinates)) {
                    throw new Error('The marketplace returned invalid parcel geometry. Please retry.');
                }
                // Construct the properties for each feature without the `geojson` key
                let properties = { ...row };
                delete properties.geojson;

                return {
                type: "Feature",
                properties: properties,
                geometry
                };
            })
        };
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
    const parcelList = document.getElementById('parcelList');
    if (!parcelList) return;
    parcelList.setAttribute('aria-busy', 'true');
    parcelList.innerHTML = '<p role="status" class="market-empty">Loading marketplace parcels…</p>';
    try {
        const parcels = await fetchParcelsFromSupabase();
        displayParcels(parcels);
    } catch (error) {
        parcelList.replaceChildren();
        const message = document.createElement('p');
        message.className = 'market-error';
        message.setAttribute('role', 'alert');
        message.textContent = error.status === 401
            ? 'Your session has expired. Sign in again, then retry loading the marketplace.'
            : error.status >= 500
                ? 'The marketplace service is unavailable. Please try again.'
                : error.name === 'TypeError'
                    ? 'Could not reach the marketplace service. Check your connection and retry.'
                    : error.message || 'Marketplace parcels could not be loaded.';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'market-retry';
        retry.textContent = 'Retry';
        retry.addEventListener('click', () => { void loadParcels(); });
        parcelList.append(message, retry);
    } finally {
        parcelList.removeAttribute('aria-busy');
    }
}



// Display parcels in the list
function displayParcels(parcels) {
    const parcelList = document.getElementById('parcelList');
    if (!parcelList || parcels?.type !== 'FeatureCollection' || !Array.isArray(parcels.features)) {
        throw new Error('Marketplace parcels are unavailable or malformed.');
    }
    marketFeatures = parcels.features;
    const dateButton = document.getElementById('marketDateSort');
    if (dateButton) dateButton.disabled = !marketFeatures.some((feature) => parcelDate(feature.properties) > 0);
    renderMarketplaceCards();
    marketFeatures.forEach(addParcelToMap);
}

// Create parcel card HTML
function createParcelCard(parcel) {
    const card = document.createElement('div');
    card.className = 'market-parcel-card';
    const properties = parcel.properties || {};
    const formattedPriceM2 = new Intl.NumberFormat('en-US').format(Number(properties.price_m2) || 0);
    const uuid = String(properties.uuid ?? '');
    card.innerHTML = `
        <div class="market-parcel-top">
            <strong>${escapeHTML(properties.parcel_name || 'Unnamed parcel')}</strong>
            <span>Price per m²: ${formattedPriceM2}</span>
        </div>
        <p class="market-parcel-location">Location: ${escapeHTML(properties.location_name || '—')}</p>
        <p class="market-parcel-reference">Reference: ${escapeHTML(uuid || '—')}</p>
        <div class="market-parcel-actions">
            <button type="button" data-action="zoom">⌖ View on Map</button>
            <a href="products_details.html?id=${encodeURIComponent(uuid)}">♡ Mark Interest</a>
            <a href="details_parcel.html?id=${encodeURIComponent(uuid)}">Greport</a>
        </div>
    `;
    card.querySelector('[data-action="zoom"]')?.addEventListener('click', () => zoomToParcel(properties.id));
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
        const graphic = graphics.find(g => String(g.attributes.parcelId) === String(parcelId));
        
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


