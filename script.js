mapboxgl.accessToken = 'pk.eyJ1IjoiaG93ZWxsdHJ1c3QiLCJhIjoiY21iZ3FtNGdqMDF4YjJsc2d4Z3JwZGJ2MiJ9.8u6Y-_RYGb-qxODBGT5-LA';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/howelltrust/cmbkwcx8f00oq01qw9wxy8uw4',
  center: [0.033431609683219676, 51.09798270711917],
  zoom: 15
});

let originalGeoData = null;
const categoryContainer = document.getElementById('categoryFilters');

map.on('load', () => {
  fetch('locations.geojson')
    .then(res => res.json())
    .then(data => {
      originalGeoData = data;

      map.addSource('locations', { type: 'geojson', data });

      // 🔥 Glowing pulse behind verified markers
map.addLayer({
  id: 'verified-pulse',
  type: 'circle',
  source: 'locations',
  filter: ['==', ['get', 'verified'], true],
  paint: {
    'circle-color': 'gold',
    'circle-opacity': 0.2,
    'circle-radius': 8,
    'circle-blur': 1
  }
});

function animatePulse() {
  const radius = 8 + Math.sin(Date.now() / 500) * 2;
  map.setPaintProperty('verified-pulse', 'circle-radius', radius);
  requestAnimationFrame(animatePulse);
}
animatePulse();



      // Filter checkboxes
      const categories = [...new Set(data.features.map(f => f.properties.category))];
      categories.forEach(cat => {
        const label = document.createElement('label');
        label.style.display = 'block';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        checkbox.value = cat;
        checkbox.addEventListener('change', filterMarkers);
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' ' + cat));
        categoryContainer.appendChild(label);
      });

      // Load icons
      const icons = {
        'flower.png': 'rose-icon',
        'events.icon.png': 'event-icon',
        'verified-shop.png': 'verified-shop-icon'
      };

      Promise.all(Object.entries(icons).map(([src, name]) => {
        return new Promise((resolve, reject) => {
          map.loadImage(src, (error, image) => {
            if (error || !image) return reject(error);
            if (!map.hasImage(name)) map.addImage(name, image);
            resolve();
          });
        });
      })).then(() => {
        map.addLayer({
          id: 'locations',
          type: 'symbol',
          source: 'locations',
          layout: {'icon-image': [
  'case',
  ['==', ['get', 'verified'], true], 'verified-shop-icon',
  ['==', ['get', 'category'], '📍 EVENTS'], 'event-icon',
  'rose-icon'
],
  'icon-size': 0.06,
  'icon-allow-overlap': true
}
          
        });

        // Popup and interaction
        map.on('click', 'locations', (e) => {
          const props = e.features[0].properties;
          new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
  <div class="${props.verified === true ? 'popup-verified-style' : 'popup-style'}">
    <h3>${props.title}</h3>
    <p>${props.description}</p>
    ${props.verified === true ? '<div class="verified-tag">✔ VERIFIED LOCATION</div>' : ''}
  </div>
`)
            .addTo(map);
        });

        map.on('mouseenter', 'locations', () => {
          map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', 'locations', () => {
          map.getCanvas().style.cursor = '';
        });
      }).catch(err => console.error('❌ Icon load fail:', err));
    })
    .catch(err => console.error('❌ GeoJSON load fail:', err));
});

// Filter Function
function filterMarkers() {
  const checked = Array.from(categoryContainer.querySelectorAll('input:checked'))
    .map(input => input.value);

  const filtered = originalGeoData.features.filter(f =>
    checked.includes(f.properties.category)
  );

  map.getSource('locations').setData({
    type: 'FeatureCollection',
    features: filtered
  });
}
