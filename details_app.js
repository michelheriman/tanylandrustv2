const API_URL = 'https://mtk.pythonanywhere.com/';

// Security: escape any text sourced from external APIs/DB before inserting
// via innerHTML, as defense in depth even for lower-risk fields.
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
        if (userToken === undefined) {
            alert("Please sign in")
            window.location.href = './signin.html'
        }
        else{
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


async function get_infos(productID) {
    let API = 'api/getcoords';
    let token = await checker();
    try {
        const idp = {"data": productID}
        const response = await fetch(
            `${API_URL}${API}`,{
                method: 'POST',
                headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}` 
                        },
                body : JSON.stringify(idp)
            }
        )
        const result = await response.json();
        const coords = {"longitude" : result.data[0].longitude, "latitude" : result.data[0].latitude}
        return coords
    }
    catch (error){
        console.error("Error sending data:", error);
    }
}

async function get_parcels_info() {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get("id");
    
    let token = await checker();
    const API = "api/get_infos" 
    try {
        const idp = {"data": productId}
        const response = await fetch(
            `${API_URL}${API}`,{
                method: 'POST',
                headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}` 
                        },
                body : JSON.stringify(idp)
            }
        )
        const result = await response.json();
        return result;
    }
    catch(error){
        console.error("Error fetching data:", error);
    }
}


// debut for translation \\

        const MONTH_NAMES_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const MONTH_NAMES_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
        const FULL_MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const FULL_MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

        const TRANSLATIONS = {
          en:{
            eyebrow:'Terrain Analysis Report',
            'sec-terrain':'Terrain Overview','sec-location':'Location Map','sec-soil':'Soil Properties',
            'sec-flood':'Flood Risk Assessment','sec-climate':'Climate','sec-proximity':'Proximity — services within radius',
            elevation:'Elevation','max-slope':'Max Slope','avg-slope':'Avg Slope',samples:'Slope Samples',
            degrees:'degrees',measurements:'measurements','individual-slopes':'Individual Slope Profile',
            coordinates:'Coordinates','elev-short':'ELEV','source-label':'SOURCE',
            'flood-peak':'Forecast Peak Discharge','7day':'7-day forecast',
            normal:'Normal','no-flood':'No Flood Risk','return-periods':'Return Period Thresholds',
            year2:'2-year',year5:'5-year',year10:'10-year',year20:'20-year',year30:'30-year',year50:'50-year',year100:'100-year',
            'current-peak':'Current peak:','well-below':'well below all thresholds',
            history:'History:',years:'years analyzed',
            print:'Print PDF','coord-label':'Coordinates:','date-label':'Assessed:',
            'data-source':'Data source: GloFAS v4 via Open-Meteo · ISRIC World Soil Information',
            'flood-desc-normal':'Below 2-year threshold — river levels within normal range',
            'mean-temp':'Mean annual temp.','coldest':'Coldest month','hottest':'Hottest month','data-range':'Data range',
            'rainy-season':'Rainy Season','onset':'Onset','end-season':'End','wettest':'Wettest month','yearly-rain':'Avg yearly rain',
            'monthly-season':'Monthly season indicator','temperature-profile':'Temperature Profile',
            'prox-hospital':'Hospital','prox-market':'Market','prox-transport':'Transport',
            'prox-none':'None found','prox-radius-label':'Search radius',
            'avg-line-label':'Average',
            'soil-names':{bdod:'Bulk Density',cec:'CEC',cfvo:'Coarse Fragments',clay:'Clay',nitrogen:'Nitrogen',ocd:'Org. Carbon Density',phh2o:'pH (water)',sand:'Sand',silt:'Silt',soc:'Org. Carbon Stock',wv0010:'Water Vol. 10kPa',wv0033:'Water Vol. 33kPa',wv1500:'Water Vol. 1500kPa'},
            monthNames: MONTH_NAMES_EN, fullMonths: FULL_MONTHS_EN
          },
          fr:{
            eyebrow:'Rapport d\'analyse du terrain',
            'sec-terrain':'Aperçu du terrain','sec-location':'Carte de localisation','sec-soil':'Propriétés du sol',
            'sec-flood':'Évaluation des risques d\'inondation','sec-climate':'Climat','sec-proximity':'Proximité — services dans un rayon',
            elevation:'Altitude','max-slope':'Pente max.','avg-slope':'Pente moy.',samples:'Échantillons',
            degrees:'degrés',measurements:'mesures','individual-slopes':'Profil de pente individuel',
            coordinates:'Coordonnées','elev-short':'ALT','source-label':'SOURCE',
            'flood-peak':'Débit de pointe prévu','7day':'Prévision 7 jours',
            normal:'Normal','no-flood':'Aucun risque d\'inondation','return-periods':'Seuils de période de retour',
            year2:'2 ans',year5:'5 ans',year10:'10 ans',year20:'20 ans',year30:'30 ans',year50:'50 ans',year100:'100 ans',
            'current-peak':'Pic actuel :','well-below':'bien en dessous de tous les seuils',
            history:'Historique :',years:'années analysées',
            print:'Imprimer PDF','coord-label':'Coordonnées :','date-label':'Évalué le :',
            'data-source':'Source : GloFAS v4 via Open-Meteo · ISRIC World Soil Information',
            'flood-desc-normal':'En dessous du seuil de 2 ans — niveaux fluviaux dans la plage normale',
            'mean-temp':'Temp. annuelle moyenne','coldest':'Mois le plus froid','hottest':'Mois le plus chaud','data-range':'Période des données',
            'rainy-season':'Saison des pluies','onset':'Début','end-season':'Fin','wettest':'Mois le plus pluvieux','yearly-rain':'Pluie annuelle moy.',
            'monthly-season':'Indicateur mensuel','temperature-profile':'Profil de température',
            'prox-hospital':'Hôpital','prox-market':'Marché','prox-transport':'Transport',
            'prox-none':'Aucun trouvé','prox-radius-label':'Rayon de recherche',
            'avg-line-label':'Moyenne',
            'soil-names':{bdod:'Densité apparente',cec:'CEC',cfvo:'Fractions grossières',clay:'Argile',nitrogen:'Azote',ocd:'Dens. carb. org.',phh2o:'pH (eau)',sand:'Sable',silt:'Limon',soc:'Stock carb. org.',wv0010:'Vol. eau 10kPa',wv0033:'Vol. eau 33kPa',wv1500:'Vol. eau 1500kPa'},
            monthNames: MONTH_NAMES_FR, fullMonths: FULL_MONTHS_FR
          }
        };

        let currentLang='en';
        function t(k){return TRANSLATIONS[currentLang][k]||TRANSLATIONS.en[k]||k}

        function setLang(lang){
          currentLang=lang;
          document.querySelectorAll('.lang-btn').forEach(b=>b.classList.toggle('active',b.textContent===lang.toUpperCase()));
          document.documentElement.lang=lang;
          applyTranslations();
          rebuildSoil(); rebuildSlope(); rebuildClimate(); rebuildProximity(); rebuildFlood();
        }

        function applyTranslations(){
          document.querySelectorAll('[data-t]').forEach(el=>{
            const k=el.getAttribute('data-t');
            const tr=t(k); if(tr)el.textContent=tr;
          });
        }

        // end of translation \\

let API_RESPONSE;
get_parcels_info().then(res =>{
    API_RESPONSE = res;
    if (res.success === false) { 
        alert("please upgrade your account for the service georeport");
        window.history.back();
        console.log(res.message)
    }
    else{
        //debut\\
        //console.log(API_RESPONSE);
        const D = JSON.parse(res.data[0].geoinfos)
        //console.log(D)
        const FLOOD = D.flood;
        const CLIM = D.climates;
        const PROX = D.proximity;
        const LAT = FLOOD.coordinate.latitude;
        const LNG = FLOOD.coordinate.longitude;

        console.log(
          FLOOD, CLIM, PROX
        )

        // Guard before using them
        if (!FLOOD || !CLIM || !PROX) {
            console.error("Missing expected fields in response:", D);
            return;
        }

        

        /* TERRAIN STATS */
        function buildTerrainStats(){
          const g=document.getElementById('terrainStats');
          g.innerHTML=`
            <div class="stat-card info"><div class="stat-label" data-t="elevation">Elevation</div><div class="stat-value">${D.elevation.toFixed(0)}</div><div class="stat-unit">m a.s.l.</div></div>
            <div class="stat-card warning"><div class="stat-label" data-t="max-slope">Max Slope</div><div class="stat-value">${D.max_slope.toFixed(2)}°</div><div class="stat-unit" data-t="degrees">degrees</div></div>
            <div class="stat-card"><div class="stat-label" data-t="avg-slope">Avg Slope</div><div class="stat-value">${D.avg_slope.toFixed(2)}°</div><div class="stat-unit" data-t="degrees">degrees</div></div>
            <div class="stat-card"><div class="stat-label" data-t="samples">Samples</div><div class="stat-value">${D.individual_slopes.length}</div><div class="stat-unit" data-t="measurements">measurements</div></div>
          `;
        }

        /* SLOPE BARS */
        function rebuildSlope(){
          const container=document.getElementById('slopeBars');
          container.innerHTML='';
          const slopes=D.individual_slopes;
          const maxV=Math.max(...slopes);
          slopes.forEach((v,i)=>{
            const pct=(v/maxV)*100;
            const wrap=document.createElement('div'); wrap.className='slope-bar-wrap';
            const bar=document.createElement('div'); bar.className='slope-bar'+(v===maxV?' max':'');
            bar.style.height=pct+'%'; bar.setAttribute('data-val',v.toFixed(2)+'°');
            const idx=document.createElement('div'); idx.className='slope-bar-idx'; idx.textContent=(i+1);
            wrap.appendChild(bar); wrap.appendChild(idx); container.appendChild(wrap);
          });
          document.getElementById('avgLine').setAttribute('data-label',t('avg-line-label')+': '+D.avg_slope.toFixed(2)+'°');
        }

        /* SOIL */
        function rebuildSoil(){
          const grid=document.getElementById('soilGrid'); grid.innerHTML='';
          const names=TRANSLATIONS[currentLang]['soil-names']||TRANSLATIONS.en['soil-names'];
          const maxVal=Math.max(...D.soil_value.map(s=>s.values));
          D.soil_value.forEach(s=>{
            const card=document.createElement('div'); card.className='soil-card';
            const pct=Math.round((s.values/maxVal)*100);
            card.innerHTML=`<div class="soil-name">${names[s.name]||s.name}</div><div class="soil-val">${s.values}</div><div class="soil-unit">${s.unit_measure}</div><div class="soil-bar-bg"><div class="soil-bar-fill" style="width:${pct}%"></div></div>`;
            grid.appendChild(card);
          });
        }

        /* CLIMATE */
        function rebuildClimate(){
          const mn=t('monthNames'); const fm=t('fullMonths');
          // stat cards
          const cg=document.getElementById('climateStats');
          cg.innerHTML=`
            <div class="stat-card purple"><div class="stat-label" data-t="mean-temp">Mean Temp.</div><div class="stat-value">${CLIM.temperature.overall_mean_c.toFixed(1)}°</div><div class="stat-unit">Celsius</div></div>
            <div class="stat-card info"><div class="stat-label" data-t="yearly-rain">Yearly Rain</div><div class="stat-value">${CLIM.precipitation.avg_yearly_total_mm.toFixed(0)}</div><div class="stat-unit">mm/year</div></div>
            <div class="stat-card"><div class="stat-label" data-t="coldest">Coldest</div><div class="stat-value" style="font-size:1.3rem">${fm[CLIM.temperature.coldest_month_num-1]}</div><div class="stat-unit">${CLIM.temperature.coldest_month_avg_min_c.toFixed(1)}°C avg min</div></div>
            <div class="stat-card warning"><div class="stat-label" data-t="hottest">Hottest</div><div class="stat-value" style="font-size:1.3rem">${fm[CLIM.temperature.hottest_month_num-1]}</div><div class="stat-unit">${CLIM.temperature.hottest_month_avg_max_c.toFixed(1)}°C avg max</div></div>
          `;
          // detail cards
          const startR=CLIM.data_range.start, endR=CLIM.data_range.end;
          const fmt=s=>`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
          document.getElementById('c-mean').textContent=CLIM.temperature.overall_mean_c.toFixed(2)+'°C';
          document.getElementById('c-cold').textContent=`${fm[CLIM.temperature.coldest_month_num-1]} (${CLIM.temperature.coldest_month_avg_min_c.toFixed(1)}°C)`;
          document.getElementById('c-hot').textContent=`${fm[CLIM.temperature.hottest_month_num-1]} (${CLIM.temperature.hottest_month_avg_max_c.toFixed(1)}°C)`;
          document.getElementById('c-range').textContent=`${fmt(startR)} → ${fmt(endR)}`;
          const onsetM=CLIM.rainy_season.onset.mean_month, endM=CLIM.rainy_season.end.mean_month;
          document.getElementById('c-onset').textContent=`${fm[onsetM-1]} ±${CLIM.rainy_season.onset.std_dev_days}d`;
          document.getElementById('c-end').textContent=`${fm[endM-1]} ±${CLIM.rainy_season.end.std_dev_days}d`;
          document.getElementById('c-wettest').textContent=`${fm[CLIM.precipitation.wettest_month_num-1]} (${CLIM.precipitation.wettest_month_avg_mm} mm)`;
          document.getElementById('c-yearly').textContent=`${CLIM.precipitation.avg_yearly_total_mm.toFixed(1)} mm`;
          // season bar
          const bar=document.getElementById('seasonBar'); bar.innerHTML='';
          const rainyMonths=new Set([9,10,11,12,1,2,3]);
          const transMonths=new Set([8,4]);
          for(let m=1;m<=12;m++){
            const cell=document.createElement('div');
            cell.className='month-cell'+(rainyMonths.has(m)?' wet':transMonths.has(m)?' transition':'');
            const lbl=document.createElement('span'); lbl.textContent=mn[m-1];
            cell.appendChild(lbl); bar.appendChild(cell);
          }
        }

        /* PROXIMITY */
        function rebuildProximity(){
          const grid=document.getElementById('proximityGrid'); grid.innerHTML='';
          const cats={
            hospital:{icon:'🏥',tkey:'prox-hospital'},
            market:{icon:'🏪',tkey:'prox-market'},
            transport:{icon:'🚌',tkey:'prox-transport'}
          };
          const radiusKm=(PROX.query.radius_m/1000).toFixed(1);
          document.getElementById('proxRadius').textContent=radiusKm+' km';
          Object.entries(cats).forEach(([cat,cfg])=>{
            const items=PROX.results[cat]||[];
            const card=document.createElement('div'); card.className='prox-card';
            let inner=`<div class="prox-icon">${cfg.icon}</div><div class="prox-title">${t(cfg.tkey)}</div>`;
            if(items.length===0){
              inner+=`<div class="prox-no-data"><div class="no-data-badge" data-t="prox-none">${t('prox-none')}</div><div class="prox-radius">${radiusKm} km</div></div>`;
            } else {
              items.forEach(item=>{
                inner+=`<div class="prox-item">${escapeHTML(item.name||item)}</div>`;
              });
            }
            card.innerHTML=inner;
            grid.appendChild(card);
          });
        }

        /* FLOOD */
        function rebuildFlood(){
          const fr=FLOOD.flood_risk;
          const st=FLOOD.statistics;
          const fc=FLOOD.forecast;
          document.getElementById('floodDesc').textContent=t('flood-desc-normal');
          document.getElementById('floodHistory').textContent=`${st.history_from.slice(0,4)}–${new Date().getFullYear()-1} | ${st.years_analyzed} ${t('years')}`;
          // thresholds
          const tDiv=document.getElementById('floodThresholds'); tDiv.innerHTML='';
          const periodKeys=['2','5','10','20','30','50','100'];
          periodKeys.forEach(p=>{
            const row=document.createElement('div'); row.className='flood-threshold-row';
            row.innerHTML=`<span class="return-period">${t('year'+p)}</span><span class="threshold-val">${st.thresholds_m3s[p].toFixed(2)} m³/s</span>`;
            tDiv.appendChild(row);
          });
          document.getElementById('forecastBox').innerHTML=`<strong>${t('current-peak')}</strong> ${fc.peak_discharge_m3s} m³/s — <span>${t('well-below')}</span>`;
        }

        /* MAP */
        function initMap(){
          document.getElementById('info-lat').textContent=LAT.toFixed(4)+'°';
          document.getElementById('info-lon').textContent=LNG.toFixed(4)+'°';
          document.getElementById('info-elev').textContent=D.elevation.toFixed(0)+' m';
          document.getElementById('peakDischarge').innerHTML=FLOOD.forecast.peak_discharge_m3s+' <span style="font-size:0.8rem;font-family:var(--font-mono);color:var(--ink-muted)">m³/s</span>';
          document.getElementById('coord-val').textContent=`${Math.abs(LAT).toFixed(4)}°S, ${LNG.toFixed(4)}°E`;
          document.getElementById('assessed-date').textContent=FLOOD.assessed_on;

          const map=L.map('map',{zoomControl:true,scrollWheelZoom:false}).setView([LAT,LNG],11);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(map);

          const siteIcon=L.divIcon({className:'',html:`<div style="width:18px;height:18px;border-radius:50%;background:#2d6a4f;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,iconSize:[18,18],iconAnchor:[9,9]});
          L.marker([LAT,LNG],{icon:siteIcon}).addTo(map).bindPopup(`<b>Site</b><br>Lat: ${LAT.toFixed(4)}<br>Lng: ${LNG.toFixed(4)}<br>Elev: ${D.elevation} m`);
          L.circle([LAT,LNG],{color:'#2d6a4f',fillColor:'#52b788',fillOpacity:0.08,weight:1.5,radius:PROX.query.radius_m}).addTo(map);

          // proximity category icons on map (empty here but ready for items with coords)
          const proxIcons={hospital:'🏥',market:'🏪',transport:'🚌'};
          Object.entries(PROX.results).forEach(([cat,items])=>{
            items.forEach(item=>{
              if(item.lat&&item.lon){
                const pi=L.divIcon({className:'',html:`<div style="font-size:18px">${proxIcons[cat]||'📍'}</div>`,iconSize:[20,20],iconAnchor:[10,10]});
                L.marker([item.lat,item.lon],{icon:pi}).addTo(map).bindPopup(`${proxIcons[cat]} ${escapeHTML(item.name||cat)}`);
              }
            });
          });
        }

        /* INIT */
        document.getElementById('printDate').textContent='Generated: '+new Date().toLocaleDateString();
        buildTerrainStats();
        rebuildSlope();
        rebuildSoil();
        rebuildClimate();
        rebuildProximity();
        rebuildFlood();
        applyTranslations();
        initMap();

        //end\\
    }
})
