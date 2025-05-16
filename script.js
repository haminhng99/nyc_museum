const map = L.map('map').setView([40.7831, -73.9712], 12);

// Base layers
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: 'abcd'
}).addTo(map);

const overlays = {};


map.createPane('walkabilityPane');
map.getPane('walkabilityPane').style.zIndex = 300; // below other overlays but above tiles


// Geocoder
L.Control.geocoder({
  defaultMarkGeocode: true,
  position: 'topright'
}).addTo(map);

const layerControl = L.control.layers(null, overlays, { collapsed: false }).addTo(map);

//Legend
const legend = L.control({ position: 'bottomright' });

legend.onAdd = function (map) {
  const div = L.DomUtil.create('div', 'info legend');

  div.innerHTML = `
    <h4 style="margin-top:0;">Legend</h4>
    <div style="margin-bottom: 0.5em;">
      <img src="assets/icons/museum_pin.svg" style="width: 18px; vertical-align: middle; margin-right: 6px;">Museum
    </div>
    <div style="margin-bottom: 0.5em;">
      <img src="assets/icons/gallery.svg" style="width: 18px; vertical-align: middle; margin-right: 6px;">Gallery
    </div>
    <div style="margin-bottom: 0.5em;">
      <img src="assets/icons/hotel.svg" style="width: 18px; vertical-align: middle; margin-right: 6px;">Hotel
    </div>
    <div style="margin-bottom: 0.5em;">
      <img src="assets/icons/cafe.svg" style="width: 18px; vertical-align: middle; margin-right: 6px;">Cafe
    </div>
    <div style="margin-bottom: 0.5em;">
      <img src="assets/icons/restaurant.svg" style="width: 18px; vertical-align: middle; margin-right: 6px;">Restaurant
    </div>
    <div style="margin-bottom: 0.5em;">
      <img src="assets/icons/bus.svg" style="width: 18px; vertical-align: middle; margin-right: 6px;">Bus Stop
    </div>
    <div style="margin-bottom: 0.5em;">
      <img src="assets/icons/station.svg" style="width: 18px; vertical-align: middle; margin-right: 6px;">Subway Station
    </div>
    <div style="margin-top: 0.75em; font-weight: bold;">Walkability</div>
    <div style="margin: 4px 0;"><span style="background:#35B09D;opacity:0.6;width:18px;height:12px;display:inline-block;margin-right:6px;"></span>High</div>
    <div style="margin: 4px 0;"><span style="background:#35B09D;opacity:0.3;width:18px;height:12px;display:inline-block;margin-right:6px;"></span>Medium</div>
    <div style="margin: 4px 0;"><span style="background:#35B09D;opacity:0.05;width:18px;height:12px;display:inline-block;margin-right:6px;"></span>Low</div>
  `;

  return div;
};

legend.addTo(map);


var markers = L.markerClusterGroup();
map.addLayer(markers);

// Data storage
let allGeoJsonFeatures = [];
let genreCounts = {};
let museumImages = {};
let currentGenre = 'all';

const subwayIcon = L.icon({
  iconUrl: 'assets/icons/station.svg',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -10]
});

const purpleIcon = L.icon({
  iconUrl: 'assets/icons/museum_pin.svg',
  iconSize: [32, 32],       // Adjust if needed based on your SVG
  iconAnchor: [16, 32],     // Middle-bottom of the icon
  popupAnchor: [0, -28]     // So popup appears above the icon
});


// MUSEUM POINTS
fetch('data/museum-points.geojson')
  .then(res => res.json())
  .then(data => {
    allGeoJsonFeatures = data.features;
    genreCounts = allGeoJsonFeatures.reduce((acc, feature) => {
      const genre = feature.properties.Genre?.toLowerCase() || 'unknown';
      acc[genre] = (acc[genre] || 0) + 1;
      acc['all'] = (acc['all'] || 0) + 1;
      return acc;
    }, {});
    generateGenreButtons(genreCounts);
    renderFilteredFeatures('all');
  });

fetch('data/museum-images.json')
  .then(res => res.json())
  .then(imgData => {
    museumImages = imgData;
    renderFilteredFeatures(currentGenre);
  });
  const routeColors = {
    '1': '#EE352E', '2': '#EE352E', '3': '#EE352E',
    '4': '#00933C', '5': '#00933C', '6': '#00933C',
    '7': '#B933AD',
    'A': '#0039A6', 'C': '#0039A6', 'E': '#0039A6',
    'B': '#FF6319', 'D': '#FF6319', 'F': '#FF6319', 'M': '#FF6319',
    'G': '#6CBE45',
    'J': '#996633', 'Z': '#996633',
    'L': '#A7A9AC',
    'N': '#FCCC0A', 'Q': '#FCCC0A', 'R': '#FCCC0A', 'W': '#FCCC0A',
    'S': '#808183'
  };
  
  // SUBWAY STATIONS (Clustered)
  fetch('data/subway_station.geojson')
    .then(res => res.json())
    .then(data => {
      const subwayCluster = L.markerClusterGroup({
        iconCreateFunction: cluster => {
          const count = cluster.getChildCount();
          let size = 'small';
          if (count >= 50) size = 'large';
          else if (count >= 20) size = 'medium';
  
          return L.divIcon({
            html: `<div>${count}</div>`,
            className: `marker-cluster marker-cluster-bus-${size}`,
            iconSize: L.point(40, 40)
          });
        }
      });
  
      const subwayGeoJson = L.geoJSON(data, {
        pointToLayer: (feature, latlng) => L.marker(latlng, { icon: subwayIcon }),
        onEachFeature: (feature, layer) => {
          const props = feature.properties;
          const stopName = props.Stop_Name || 'Subway Station';
          const routes = (props.Daytime_Routes || '').trim().split(/\s+/);
  
          const routeCircles = routes.map(r => {
            const color = routeColors[r] || '#666';
            return `
              <span style="
                display: inline-block;
                width: 22px;
                height: 22px;
                border-radius: 50%;
                background-color: ${color};
                color: white;
                text-align: center;
                line-height: 22px;
                font-size: 0.85em;
                font-weight: bold;
                font-family: 'DM Mono', monospace;
                margin-right: 4px;
              ">${r}</span>`;
          }).join('');
  
          const popup = `
            <strong style="font-size: 1.1em; text-transform: uppercase;">${stopName}</strong>
            <div style="margin-top: 0.5em;">${routeCircles}</div>
          `;
  
          layer.bindPopup(popup);
        }
      });
  
      subwayCluster.addLayer(subwayGeoJson);
      overlays["Subway Stations"] = subwayCluster;
      layerControl.addOverlay(subwayCluster, "Subway Stations");
    });
  

// SUBWAY LINES
fetch('data/subway_lines.geojson')
  .then(res => res.json())
  .then(data => {
    const subwayLineLayer = L.geoJSON(data, {
      style: feature => {
        const group = (feature.properties.Subway_Group || '').toUpperCase().replace(/\.\s*/g, ', ');
        const colorMap = {
          '1, 2, 3': '#EE352E',
          '4, 5, 6': '#00933C',
          'A, C, E': '#0039A6',
          'B, D, F, M': '#FF6319',
          'G': '#6CBE45',
          'J, Z': '#996633',
          'L': '#A7A9AC',
          'N, Q, R, W': '#FCCC0A',
          'S': '#808183',
          '7': '#B933AD'
        };
        return {
          color: colorMap[group] || '#888',
          weight: 2
        };
      },
      onEachFeature: (feature, layer) => {
        const groupName = (feature.properties.Subway_Group || 'Subway Line').toUpperCase().replace(/\.\s*/g, ', ');
        layer.bindPopup(`<strong>${groupName}</strong>`);
      }
    }).addTo(map);
    overlays["Subway Lines"] = subwayLineLayer;
    layerControl.addOverlay(subwayLineLayer, "Subway Lines");
  });

//bus
  const busIcon = L.icon({
  iconUrl: 'assets/icons/bus.svg',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -20]
});

fetch('data/bus_points.geojson')
  .then(res => res.json())
  .then(data => {
    const busCluster = L.markerClusterGroup({
      iconCreateFunction: cluster => {
        const count = cluster.getChildCount();
        let size = 'small';
        if (count >= 50) size = 'large';
        else if (count >= 20) size = 'medium';

        return L.divIcon({
          html: `<div>${count}</div>`,
          className: `marker-cluster marker-cluster-bus-${size}`,
          iconSize: L.point(40, 40)
        });
      }
    });

    const busGeoJson = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.marker(latlng, { icon: busIcon }),
      onEachFeature: (feature, layer) => {
        const name = feature.properties.stop_name || 'Unnamed Bus Stop';
        layer.bindPopup(`<strong>${name}</strong>`);
      }
    });

    busCluster.addLayer(busGeoJson);
    overlays["Bus Stops"] = busCluster;
    layerControl.addOverlay(busCluster, "Bus Stops");
  });

  


// Gallery Points

const galleryIcon = L.icon({
  iconUrl: 'assets/icons/gallery.svg',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -28]
});

fetch('data/gallery_points.geojson')
  .then(res => res.json())
  .then(data => {
    const galleryCluster = L.markerClusterGroup({
      iconCreateFunction: cluster => {
        const count = cluster.getChildCount();
        let size = 'small';
        if (count >= 50) size = 'large';
        else if (count >= 20) size = 'medium';

        return L.divIcon({
          html: `<div>${count}</div>`,
          className: `marker-cluster marker-cluster-gallery-${size}`,
          iconSize: L.point(40, 40)
        });
      }
    });

    const galleryGeoJson = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.marker(latlng, { icon: galleryIcon }),
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        const name = props.NAME || 'Unnamed Gallery';
        const address = `${props.ADDRESS1 || ''}, ${props.CITY || ''}, ${props.ZIP || ''}`.replace(/(,\s*)+/g, ', ').trim();
        const link = props.URL ? `<br/><a href="${props.URL}" target="_blank">Website</a>` : '';

        layer.bindPopup(`
          <strong style="font-size: 1.1em; text-transform: uppercase;">${name}</strong><br/>
          ${address}<br/>
          ${link}
        `);
      }
    });

    galleryCluster.addLayer(galleryGeoJson);
    overlays["Galleries"] = galleryCluster;
    layerControl.addOverlay(galleryCluster, "Galleries");
  });



  // Hotel Points (no clustering)
const hotelIcon = L.icon({
  iconUrl: 'assets/icons/hotel.svg',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -28]
});

fetch('data/hotel_points.geojson')
  .then(res => res.json())
  .then(data => {
    const hotelLayer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.marker(latlng, { icon: hotelIcon }),
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        const name = props.name || 'Unnamed Hotel';
        const address = `${props.address1 || ''}, ${props.city || ''}, ${props.state_province || ''} ${props.postal_code || ''}`.replace(/(,\s*)+/g, ', ').trim();
        const stars = props.star_rating ? `${props.star_rating} star${props.star_rating > 1 ? 's' : ''}` : 'No rating';

        layer.bindPopup(`
          <strong>${name}</strong><br/>
          ${address}<br/>
          ${stars}
        `);
      }
    });

    overlays["Hotels"] = hotelLayer;
    layerControl.addOverlay(hotelLayer, "Hotels");
  });


 // Cafe Points
const cafeIcon = L.icon({
  iconUrl: 'assets/icons/cafe.svg',
  iconSize: [20, 20],
  iconAnchor: [10, 20],
  popupAnchor: [0, -20]
});

fetch('data/cafe_points.json')
  .then(res => res.json())
  .then(data => {
    const cafeCluster = L.markerClusterGroup({
      iconCreateFunction: cluster => {
        const count = cluster.getChildCount();
        let size = 'small';
        if (count >= 50) {
          size = 'large';
        } else if (count >= 20) {
          size = 'medium';
        }
        return L.divIcon({
          html: `<div>${count}</div>`,
          className: `marker-cluster marker-cluster-cafe-${size}`,
          iconSize: L.point(40, 40)
        });
      }
    });

    const cafeGeoJson = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.marker(latlng, { icon: cafeIcon }),
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        const name = props.DBA || 'Unnamed Cafe';
        const address = `${props.BUILDING || ''} ${props.STREET || ''}, ${props.ZIPCODE || ''}`.trim();
        const type = props.TYPE || 'N/A';
      
        const popup = `
          <strong style="font-size: 1.1em; text-transform: uppercase;">${name}</strong>
          <div style="margin-bottom: 0.75em;">${address}</div>
          <div style="margin-top: 0.5em;">
          <div><img src="assets/icons/type_cafe.svg" alt="Price" style="width: 16px; vertical-align: middle; margin-right: 6px;">
          ${type}</div>
          </div>
        `;
      
        layer.bindPopup(popup);
      }
      
    });

    cafeCluster.addLayer(cafeGeoJson);
    overlays["Cafes"] = cafeCluster;
    layerControl.addOverlay(cafeCluster, "Cafes");
  });


  // Restaurant Points
const restIcon = L.icon({
  iconUrl: 'assets/icons/restaurant.svg',
  iconSize: [20, 20],
  iconAnchor: [10, 20],
  popupAnchor: [0, -20]
});

fetch('data/restaurant_points.json')
  .then(res => res.json())
  .then(data => {
    const restCluster = L.markerClusterGroup({
      iconCreateFunction: cluster => {
        const count = cluster.getChildCount();
        let size = 'small';
        if (count >= 50) {
          size = 'large';
        } else if (count >= 20) {
          size = 'medium';
        }
        return L.divIcon({
          html: `<div>${count}</div>`,
          className: `marker-cluster marker-cluster-cafe-${size}`, // same styling as cafes
          iconSize: L.point(40, 40)
        });
      }
    });

    const restGeoJson = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.marker(latlng, { icon: restIcon }),
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        const name = props.DBA || 'Unnamed Restaurant';
        const address = `${props.BUILDING || ''} ${props.STREET || ''}, ${props.ZIPCODE || ''}`.trim();
        const type = props.TYPE || 'N/A';

        const popup = `
          <strong style="font-size: 1.1em; text-transform: uppercase;">${name}</strong>
          <div style="margin-bottom: 0.75em;">${address}</div>
          <div style="margin-top: 0.5em;">
          <div><img src="assets/icons/type_rest.svg" alt="Price" style="width: 16px; vertical-align: middle; margin-right: 6px;">
          ${type}</div>
          </div>
        `;

        layer.bindPopup(popup);
      }
    });

    restCluster.addLayer(restGeoJson);
    overlays["Restaurant"] = restCluster;
    layerControl.addOverlay(restCluster, "Restaurant");
  });



  // Attractions
const attractionIcon = L.icon({
  iconUrl: 'assets/icons/attraction.svg',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -28]
});

fetch('data/free-attractions.geojson')
  .then(res => res.json())
  .then(data => {
    const attractionLayer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.marker(latlng, { icon: attractionIcon }),
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        const name = props.Name || 'Unnamed Attraction';
        let description = props.description || 'No Description';
        
        // Try to extract a URL if one exists
        const urlMatch = description.match(/https?:\/\/[^\s]+/);
        let url = null;

        if (urlMatch) {
          url = urlMatch[0];
          description = description.replace(url, ''); // Remove the URL from the visible text
        }

        const popup = `
          <strong style="font-size: 1.1em; text-transform: uppercase;">${name}</strong>
          <div style="margin-top: 0.75em;">${description.trim()}</div>
          ${url ? `<div style="margin-top: 0.75em;"><a href="${url}" target="_blank" style="color:#453c6f; font-weight: 500;">Read more</a></div>` : ''}
        `;

        layer.bindPopup(popup);
      }
    });

    overlays["Attractions"] = attractionLayer;
    layerControl.addOverlay(attractionLayer, "Attractions");
  });


// Walkability Layer
fetch('data/walkability.geojson')
  .then(res => res.json())
  .then(data => {
    const walkabilityLayer = L.geoJSON(data, {
      pane: 'walkabilityPane', 
      style: feature => {
        const grade = feature.properties.walkability_grade?.toLowerCase();
        const baseColor = '#35B09D';
        let fillOpacity;

        switch (grade) {
          case 'high':
            fillOpacity = 0.6;
            break;
          case 'medium':
            fillOpacity = 0.3;
            break;
          case 'low':
            fillOpacity = 0.05;
            break;
          default:
            fillOpacity = 0.05;
        }

        return {
          color: baseColor,
          fillColor: baseColor,
          weight: 0.5,
          fillOpacity: fillOpacity
        };
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties.ntaname || 'Unnamed Area';
        const score = feature.properties.walkability_score?.toFixed(2) || 'N/A';
        const grade = feature.properties.walkability_grade || 'N/A';
        const cafe = feature.properties.cafe_count || 'N/A';
        const rest = feature.properties.restaurant_count || 'N/A';
        const hotel = feature.properties.hotel_count || 'N/A';
        layer.bindPopup(`
          <strong style="font-size: 1.1em; text-transform: uppercase;">${name}</strong>
          <div style="margin-bottom: 0.75em;">Walkability: ${score} (${grade})</div>
          <div><img src="assets/icons/type_cafe.svg" alt="Cafe" style="width: 16px; vertical-align: middle; margin-right: 6px;">
          ${cafe}</div>
          <div><img src="assets/icons/type_rest.svg" alt="Restaurant" style="width: 16px; vertical-align: middle; margin-right: 6px;">
          ${rest}</div>
          <div><img src="assets/icons/type_hotel.svg" alt="Hotel" style="width: 16px; vertical-align: middle; margin-right: 6px;">
          ${hotel}</div>
          <div style="margin-top: 0.5em;">

          </div>
        `);
      }
    }).addTo(map);
    
    overlays["Walkability"] = walkabilityLayer;
    layerControl.addOverlay(walkabilityLayer, "Walkability");
  });

  




//FILTERS START HERE!!!!
// Genre
function generateGenreButtons(counts) {
  const primaryGenres = ['all', 'art', 'culture', 'history'];
  const primaryDiv = document.getElementById('filters-primary');
  const moreDiv = document.getElementById('filters-more');
  primaryDiv.innerHTML = '';
  moreDiv.innerHTML = '';
  const genres = Object.keys(counts).sort((a, b) => {
    if (a === 'all') return -1;
    if (b === 'all') return 1;
    return a.localeCompare(b);
  });
  genres.forEach(genre => {
    const btn = document.createElement('button');
    btn.innerText = `${capitalize(genre)} (${counts[genre]})`;
    btn.onclick = () => filterByGenre(genre);
    (primaryGenres.includes(genre) ? primaryDiv : moreDiv).appendChild(btn);
  });
}

// filter
function renderFilteredFeatures(selectedGenre) {
  markers.clearLayers();
  const minPriceValue = parseInt(minInput.value);
  const maxPriceValue = parseInt(maxInput.value);
  const minTimeValue = parseInt(minTimeInput.value);
  const maxTimeValue = parseInt(maxTimeInput.value);

  const filtered = allGeoJsonFeatures.filter(f => {
    const genreMatch = selectedGenre === 'all' || f.properties.Genre?.toLowerCase() === selectedGenre;
    let priceStr = f.properties.ticket_price || '';
    priceStr = priceStr.toLowerCase().includes('free') ? '0' : priceStr.replace(/[^0-9.]/g, '');
    const price = parseFloat(priceStr);    
    const priceMatch = !isNaN(price) && price >= minPriceValue && price <= maxPriceValue;
    const openTime = parseInt(f.properties.opening_time?.split(':')[0]);
    const closeTime = parseInt(f.properties.closing_time?.split(':')[0]);
    const timeMatch = !isNaN(openTime) && !isNaN(closeTime) && openTime >= minTimeValue && closeTime <= maxTimeValue;
    return genreMatch && priceMatch && timeMatch;
  });

  const geoJsonLayer = L.geoJSON(filtered, {
    onEachFeature: (feature, layer) => {
      const props = feature.properties;
      const imageUrl = museumImages[props.OBJECTID];
      const imageTag = imageUrl
        ? `<img src="${imageUrl}" alt="${props.Name}" style="width:100%; max-height:150px; object-fit:cover; border-radius:8px; margin-bottom: 0.75em;">`
        : '';
      const popupContent = `
        ${imageTag}
        <strong style="font-size: 1.1em; text-transform: uppercase;">${props.Name}</strong>
        <div>${props.Address}, ${props.City} ${props.ZIP}</div>
        <div style="margin-top: 0.5em;">
          <img src="assets/icons/genre.svg" alt="Genre" style="width: 16px; vertical-align: middle; margin-right: 6px;">
          ${capitalize(props.Genre)}
        </div>
        <div>
          <img src="assets/icons/ticket.svg" alt="Price" style="width: 16px; vertical-align: middle; margin-right: 6px;">
          ${props.ticket_price}
        </div>
        <div style="margin-bottom: 0.5em;">
          <img src="/assets/icons/time.svg" alt="Open Time" style="width: 16px; vertical-align: middle; margin-right: 6px;">
          ${props.opening_days}, ${props.opening_time}–${props.closing_time}
        </div>
        <a href="${props.Link}" target="_blank">More info</a>
      `;
      layer.bindPopup(popupContent);
    },
    pointToLayer: (feature, latlng) => L.marker(latlng, { icon: purpleIcon })
  });

  markers.addLayer(geoJsonLayer);
}

function filterByGenre(genre) {
  currentGenre = genre;
  renderFilteredFeatures(genre);
  const mapContainer = document.querySelector('.map-container');
  const colorMap = {
    all: '#8874E3',
    art: '#E08AD1',
    culture: '#35B09D',
    history: '#F4B440'
  };
  mapContainer.style.backgroundColor = colorMap[genre] || '#F56542';
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

//SLIDERS!!
// Price
const minInput = document.getElementById('min-price');
const maxInput = document.getElementById('max-price');
const track = document.querySelector('.price-slider-track');
const priceContainer = document.querySelector('.price-slider-container');
const valueDisplay = document.createElement('div');
valueDisplay.className = 'price-values';
priceContainer.appendChild(valueDisplay);

function updatePriceDisplay() {
  const min = parseInt(minInput.value);
  const max = parseInt(maxInput.value);
  if (min > max - 1) minInput.value = max - 1;
  if (max < min + 1) maxInput.value = min + 1;
  const rangeMin = parseInt(minInput.min);
  const rangeMax = parseInt(maxInput.max);
  const percentMin = ((min - rangeMin) / (rangeMax - rangeMin)) * 100;
  const percentMax = ((max - rangeMin) / (rangeMax - rangeMin)) * 100;
  track.style.background = `linear-gradient(to right, #ddd ${percentMin}%, #8874E3 ${percentMin}%, #8874E3 ${percentMax}%, #ddd ${percentMax}%)`;
  valueDisplay.innerHTML = `<span>$${min}</span><span>$${max}</span>`;
}

minInput.addEventListener('input', () => {
  updatePriceDisplay();
  renderFilteredFeatures(currentGenre);
});
maxInput.addEventListener('input', () => {
  updatePriceDisplay();
  renderFilteredFeatures(currentGenre);
});
updatePriceDisplay();

// time
const minTimeInput = document.getElementById('min-time');
const maxTimeInput = document.getElementById('max-time');
const timeTrack = document.querySelector('.time-slider-track');
const timeContainer = document.getElementById('time-slider-container');
const timeValueDisplay = document.createElement('div');
timeValueDisplay.className = 'price-values';
timeContainer.appendChild(timeValueDisplay);

function updateTimeDisplay() {
  const min = parseInt(minTimeInput.value);
  const max = parseInt(maxTimeInput.value);
  if (min > max - 1) minTimeInput.value = max - 1;
  if (max < min + 1) maxTimeInput.value = min + 1;
  const percentMin = (min / 24) * 100;
  const percentMax = (max / 24) * 100;
  timeTrack.style.background = `linear-gradient(to right, #ddd ${percentMin}%, #8874E3 ${percentMin}%, #8874E3 ${percentMax}%, #ddd ${percentMax}%)`;
  timeValueDisplay.innerHTML = `<span>${min}:00</span><span>${max}:00</span>`;
}

minTimeInput.addEventListener('input', () => {
  updateTimeDisplay();
  renderFilteredFeatures(currentGenre);
});
maxTimeInput.addEventListener('input', () => {
  updateTimeDisplay();
  renderFilteredFeatures(currentGenre);
});
updateTimeDisplay();

