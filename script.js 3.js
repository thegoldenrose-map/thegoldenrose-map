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

  const popup = new mapboxgl.Popup()
    .setLngLat(e.lngLat)
    .setHTML(`
      <div class="popup-style relative">
        <button onclick="saveToFavourites('${props.title}', ${e.lngLat.lng}, ${e.lngLat.lat})"
          class="absolute top-1 right-3 text-yellow-400 hover:text-red-500 z-10">
          <i data-lucide="heart"></i>
        </button>
        <h3 class="mt-6">${props.title}</h3>
        <p>${props.description}</p>
        ${props.verified === true ? '<div class="verified-tag">✔ VERIFIED LOCATION</div>' : ''}
      </div>
    `)
    .addTo(map);

  // ✅ Now that popup is rendered, create icons
  lucide.createIcons();
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

  const isPremium = localStorage.getItem('membershipLevel') === 'premium';
  const memberName = localStorage.getItem('memberName');
  const memberNumber = localStorage.getItem('memberNumber');

  // Marketplace Button
  document.getElementById('marketplaceBtn')?.addEventListener('click', () => {
    if (isPremium) {
      alert("Marketplace feature is coming soon...");
    } else {
      document.getElementById('lockedMarketModal')?.classList.remove('hidden');
    }
  });

  // Newsfeed Button
  document.querySelectorAll('#newsfeedBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!isPremium) {
        document.getElementById('lockedNewsModal')?.classList.remove('hidden');
      } else {
        document.getElementById('newsfeed-sidebar')?.classList.remove('translate-x-full');
        loadNewsfeed();
        setTimeout(() => {
          document.getElementById('profileMenu')?.classList.add('hidden');
        }, 300);
      }
    });
  });

  // Add Location Button – always wired, gated by modal logic
  document.getElementById('addLocationBtn')?.addEventListener('click', () => {
    if (isPremium) {
      document.getElementById('submissionModal')?.classList.remove('hidden');
    } else {
      alert('🔒 Premium members only');
    }
  });

  // Floating locate button
  document.getElementById('floatingLocateBtn')?.addEventListener('click', () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(position => {
        const { latitude, longitude } = position.coords;
        map.flyTo({ center: [longitude, latitude], zoom: 14 });

        new mapboxgl.Marker({ color: 'gold' })
          .setLngLat([longitude, latitude])
          .setPopup(new mapboxgl.Popup().setHTML(`<h3>CURRENT LOCATION</h3>`))
          .addTo(map)
          .togglePopup();
      });
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  });

  // Help Join button
  const helpBtn = document.getElementById('helpJoinBtn');
  if (helpBtn) {
    if (!isPremium) {
      helpBtn.classList.remove('hidden');
      helpBtn.onclick = () => {
        document.getElementById('joinNowModal')?.classList.remove('hidden');
      };
    } else {
      helpBtn.classList.add('hidden');
    }
  }

  // Join Modal close
  document.querySelector('#joinNowModal button')?.addEventListener('click', () => {
    document.getElementById('joinNowModal')?.classList.add('hidden');
  });

  // Refresh Feed
  document.getElementById('refreshFeed')?.addEventListener('click', () => {
    loadNewsfeed?.();
  });

  // Login Form setup
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

  loginBtn?.addEventListener('click', () => modal.classList.remove('hidden'));

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
      modal.classList.add('hidden');
      document.getElementById('helpJoinBtn')?.classList.add('hidden');
      location.reload();
    } else {
      alert('❌ Invalid membership');
    }
  });

  // Profile toggle
  document.getElementById('profileToggle')?.addEventListener('click', () => {
    document.getElementById('profileMenu')?.classList.toggle('hidden');
  });

  // Unlock Features UI
  if (isPremium) {
    [
      'profileLoginBtn',
      'instagramBtn',
      'twitterBtn',
      'openFeedback',
      'membershipBtn',
      'donateBtnGuest',
    ].forEach(id => document.getElementById(id)?.remove());

    [
      'favouritesBtn',
      'addLocationBtn',
      'requestsBtn',
      'affiliatesBtn',
      'donateBtnMember',
      'logoutBtn',
    ].forEach(id => document.getElementById(id)?.classList.remove('hidden'));

    const nameEl = document.getElementById('memberName');
    const metaEl = document.getElementById('memberMeta');
    if (nameEl && metaEl) {
      nameEl.innerText = memberName;
      metaEl.innerText = `#${memberNumber} • Check‑ins: 0`;
    }

    document.getElementById('memberInfo')?.classList.remove('hidden');

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      localStorage.clear();
      location.reload();
    });
  }
});
document.getElementById('marketplaceBtn')?.addEventListener('click', () => {
  const isPremium = localStorage.getItem('membershipLevel') === 'premium';
  if (!isPremium) {
    document.getElementById('lockedMarketModal')?.classList.remove('hidden');
  } else {
    alert('Marketplace coming soon...');
  }
});
