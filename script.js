// Mapbox Setup
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

      const categories = [...new Set(data.features.map(f => f.properties.category))];
      categories.forEach(cat => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        checkbox.value = cat;
        checkbox.addEventListener('change', filterMarkers);
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' ' + cat));
        categoryContainer.appendChild(label);
      });

      const icons = {
        'flower.png': 'rose-icon',
        'events.icon.png': 'event-icon',
        'verified-shop.png': 'verified-shop-icon'
      };

      Promise.all(Object.entries(icons).map(([src, name]) => {
        return new Promise((resolve, reject) => {
          map.loadImage(src, (err, image) => {
            if (err || !image) return reject(err);
            if (!map.hasImage(name)) map.addImage(name, image);
            resolve();
          });
        });
      })).then(() => {
        map.addLayer({
          id: 'locations',
          type: 'symbol',
          source: 'locations',
          layout: {
            'icon-image': [
              'case',
              ['==', ['get', 'verified'], true], 'verified-shop-icon',
              ['==', ['get', 'category'], '📍 EVENTS'], 'event-icon',
              'rose-icon'
            ],
            'icon-size': 0.06,
            'icon-allow-overlap': true
          }
        });

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

        map.on('mouseenter', 'locations', () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', 'locations', () => map.getCanvas().style.cursor = '');
      });
    });
});

function filterMarkers() {
  const checked = Array.from(categoryContainer.querySelectorAll('input:checked')).map(i => i.value);
  const filtered = originalGeoData.features.filter(f => checked.includes(f.properties.category));
  map.getSource('locations').setData({ type: 'FeatureCollection', features: filtered });
}

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();

  const form = document.getElementById('loginForm');
  const loginBtn = document.getElementById('profileLoginBtn');
  const modal = document.getElementById('loginModal');
  let membershipData = [];

  fetch('https://docs.google.com/spreadsheets/d/1aPjgxKvFXp5uaZwyitf3u3DveCfSWZKgcqrFs-jQIsw/gviz/tq?tqx=out:json&gid=1384164876')
    .then(res => res.text())
    .then(txt => {
      const json = JSON.parse(txt.match(/\((.*)\)/s)[1]);
      const cols = json.table.cols.map(c => c.label);
      membershipData = json.table.rows.map(r =>
        r.c.reduce((acc, cell, i) => {
          acc[cols[i]] = cell?.v;
          return acc;
        }, {})
      );
    });

  form?.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('nameInput').value.trim().toLowerCase();
    const num = document.getElementById('numberInput').value.trim();
    const m = membershipData.find(x =>
      x.Name?.toLowerCase() === name &&
      String(x.Number) === num &&
      x.Status?.toLowerCase() === 'active'
    );

    if (m) {
      localStorage.setItem('membershipLevel', m.Level);
      localStorage.setItem('memberName', m.Name);
      localStorage.setItem('memberNumber', m.Number);
      alert(`Logged in as ${m.Name}`);
      modal.style.display = 'none';
      setTimeout(unlockFeatures, 100);
    } else alert('Invalid membership');
  });

  loginBtn?.addEventListener('click', () => modal.style.display = 'block');

  setTimeout(unlockFeatures, 200);
});

function unlockFeatures() {
  const lvl = localStorage.getItem('membershipLevel');
  if (lvl === 'premium') {
    document.querySelector('a[href*="stripe.com"]')?.remove();
    document.getElementById('profileLoginBtn')?.remove();

    const nameEl = document.getElementById('memberName');
    const metaEl = document.getElementById('memberMeta');
    const memberName = localStorage.getItem('memberName');
    const memberNumber = localStorage.getItem('memberNumber');

    if (nameEl && metaEl) {
      nameEl.innerText = memberName;
      metaEl.innerText = `#${memberNumber} • Check‑ins: 0`;
    }

    document.getElementById('memberInfo')?.classList.remove('hidden');
    ['favouritesBtn', 'newsfeedBtn', 'requestsBtn', 'affiliatesBtn', 'logoutBtn']
      .forEach(id => document.getElementById(id)?.classList.remove('hidden'));

    document.getElementById('logoutBtn').onclick = () => {
      localStorage.clear();
      location.reload();
    };

  }
}
