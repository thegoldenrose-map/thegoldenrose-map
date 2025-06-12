
mapboxgl.accessToken = 'pk.eyJ1IjoiaG93ZWxsdHJ1c3QiLCJhIjoiY21iZ3FtNGdqMDF4YjJsc2d4Z3JwZGJ2MiJ9.8u6Y-_RYGb-qxODBGT5-LA';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/howelltrust/cmbkwcx8f00oq01qw9wxy8uw4',
  center: [0.033431609683219676, 51.09798270711917],
  zoom: 15
});

map.on('load', () => {
  fetch('locations.geojson')
    .then(res => res.json())
    .then(data => {
      map.addSource('locations', {
        type: 'geojson',
        data
      });

      map.loadImage('flower.png', (error, image) => {
        if (error || !image) {
          console.warn('⚠️ flower.png failed to load. Using default marker.');
          map.addLayer({
            id: 'locations',
            type: 'circle',
            source: 'locations',
            paint: {
              'circle-radius': 6,
              'circle-color': 'gold'
            }
          });
          return;
        }

        if (!map.hasImage('rose-icon')) {
          map.addImage('rose-icon', image);
        }

        map.addLayer({
          id: 'locations',
          type: 'symbol',
          source: 'locations',
          layout: {
            'icon-image': 'rose-icon',
            'icon-size': 0.2,
            'icon-allow-overlap': true
          }
        });
      });

      map.on('click', 'locations', (e) => {
        const props = e.features[0].properties;
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
  <div class="popup-style">
    <h3>${props.title}</h3>
    <p>${props.description}</p>
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
    })
    .catch(err => {
      console.error('❌ Failed to load locations.geojson:', err);
    });
});

const searchInput = document.getElementById('search');
const searchContainer = document.querySelector('.search-wrapper');
const suggestions = document.getElementById('suggestions');

let searchMarker = null;

function dropSearchMarker(coords, name) {
  if (searchMarker) searchMarker.remove();
  searchMarker = new mapboxgl.Marker({ color: 'gold' })
    .setLngLat(coords)
    .setPopup(new mapboxgl.Popup().setHTML(`
  <div class="popup-style">
    <h3>${name}</h3>
  </div>
`))

    .addTo(map)
    .togglePopup();
}

searchInput.addEventListener('input', async () => {
  const query = searchInput.value.trim();
  if (query.length < 3) {
    suggestions.style.display = 'none';
    return;
  }

  const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}&autocomplete=true&limit=5`);
  const data = await res.json();
  suggestions.innerHTML = '';
 if (data.features.length > 0) {
  data.features.forEach(place => {
    const option = document.createElement('div');
    option.textContent = place.place_name;

    // START: Paste this styling block inside forEach
    option.style.padding = '6px 10px';
    option.style.fontSize = '13px';
    option.style.lineHeight = '1.4';
    option.style.color = 'gold';
    option.style.borderBottom = '1px solid gold';
    option.style.background = 'transparent';
    option.style.whiteSpace = 'normal';
    option.style.overflow = 'hidden';
    option.style.textOverflow = 'ellipsis';
    option.style.cursor = 'pointer';

    option.addEventListener('mouseover', () => {
      option.style.background = '#222';
    });
    option.addEventListener('mouseout', () => {
      option.style.background = 'transparent';
    });
    // END

    option.addEventListener('click', () => {
      map.flyTo({
        center: place.center,
        zoom: 14
      });
      searchInput.value = place.place_name;
      suggestions.style.display = 'none';
      dropSearchMarker(place.center, place.place_name);
    });

    suggestions.appendChild(option);
  });

  suggestions.style.display = 'block';
  } else {
    suggestions.style.display = 'none';
  }
});

document.addEventListener('click', (e) => {
  if (!searchContainer.contains(e.target)) {
    suggestions.style.display = 'none';
  }


});
// Google Apps Script Webhook URL
const scriptURL = 'https://script.google.com/macros/s/AKfycbzXwEdCZzAM1Hwt0es9jo71Tfc-LV3mqF_2xjuJPx7CDtaEi4Jnh4Xfpna76h4tDDVatg/exec';

// Modal open/close
document.getElementById('plusNavBtn').addEventListener('click', () => {
  document.getElementById('submissionModal').style.display = 'block';
});

function closeModal() {
  document.getElementById('submissionModal').style.display = 'none';
}

// Form submission handler
document.getElementById('submissionForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const name = document.getElementById('locationName').value;
  const description = document.getElementById('locationDescription').value;
  const coordsRaw = document.getElementById('locationCoords').value;

  fetch(scriptURL, {
    method: 'POST',
    body: JSON.stringify({
      name: name,
      description: description,
      coordinates: coordsRaw
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  })
    .then(res => {
      alert("✅ Location submitted!");
      this.reset();
      closeModal();
    })
    .catch(err => {
      alert("❌ Failed to submit.");
      console.error(err);
    });
});



lucide.createIcons();
