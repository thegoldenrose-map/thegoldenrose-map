
mapboxgl.accessToken = 'pk.eyJ1IjoiaG93ZWxsdHJ1c3QiLCJhIjoiY21iZ3FtNGdqMDF4YjJsc2d4Z3JwZGJ2MiJ9.8u6Y-_RYGb-qxODBGT5-LA';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/howelltrust/cmbkwcx8f00oq01qw9wxy8uw4',
  center: [0.033431609683219676, 51.09798270711917],
  zoom: 15
});
let originalGeoData = null; // ⬅️ store full geojson for filtering later
const categoryContainer = document.getElementById('categoryFilters');
map.on('load', () => {
  fetch('locations.geojson')
    .then(res => res.json())
    .then(data => {const categories = [...new Set(data.features.map(f => f.properties.category))];
      originalGeoData = data; 
     
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
// ⬅️ Save a copy for filtering
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
            'icon-size': 0.6,
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

function filterMarkers() {
  const checkedCats = Array.from(categoryContainer.querySelectorAll('input:checked'))
    .map(input => input.value);

  const filteredFeatures = originalGeoData.features.filter(f =>
    checkedCats.includes(f.properties.category)
  );

  map.getSource('locations').setData({
    type: 'FeatureCollection',
    features: filteredFeatures
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Filter Panel Toggle
  const filterBtn = document.getElementById('filterBtn');
  const filterPanel = document.getElementById('filterPanel');
  filterBtn.addEventListener('click', () => {
    filterPanel.classList.toggle('hidden');
  });

  // Submission Modal Open
  document.getElementById('plusNavBtn').addEventListener('click', () => {
    document.getElementById('submissionModal').style.display = 'block';
  });

  // Submission Modal Close
  window.closeModal = function () {
    document.getElementById('submissionModal').style.display = 'none';
  };

  // Form Submission
  const scriptURL = 'https://script.google.com/macros/s/AKfycbzXwEdCZzAM1Hwt0es9jo71Tfc-LV3mqF_2xjuJPx7CDtaEi4Jnh4Xfpna76h4tDDVatg/exec';
  document.getElementById('submissionForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const name = document.getElementById('locationName').value.trim();
    const description = document.getElementById('locationDescription').value.trim();
    const category = document.getElementById('locationCoords').value.trim();

    fetch(scriptURL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        location: description,
        category
      })
    })
      .then(res => {
        alert("✅ Location submitted!");
        document.getElementById('submissionForm').reset();
        closeModal();
      })
      .catch(err => {
        alert("❌ Failed to submit.");
        console.error(err);
      });
  });

  // Locate Button
  document.getElementById('locateBtn').addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        map.flyTo({
          center: [longitude, latitude],
          zoom: 15
        });

        new mapboxgl.Marker({ color: 'gold' })
          .setLngLat([longitude, latitude])
          .setPopup(new mapboxgl.Popup().setHTML(`<div class="popup-style"><h3>You Are Here</h3></div>`))
          .addTo(map)
          .togglePopup();
      },
      () => {
        alert("Failed to get your location.");
      }
    );
  });

  // Reset Filter Button
  const resetBtn = document.getElementById('resetFilters');
  resetBtn.addEventListener('click', () => {
    categoryContainer.querySelectorAll('input').forEach(cb => cb.checked = true);
    filterMarkers();
  });
  
  // Lucide Icons Render
  lucide.createIcons();
});

