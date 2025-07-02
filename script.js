let map;
let geoMarkers = [];
let membershipData = [];
let originalGeoData = null;

window.isPremium = (localStorage.getItem('membershipLevel') || '').toLowerCase() === 'premium';


window.SHEET_API_URL = window.SHEET_API_URL || 'https://script.google.com/macros/s/AKfycbyIqpE0QffyefE_zybPLTVMOOoDeA7snugUDJWbnUBR1SmeBRSWXHLbpcRLaTPJrdUKBA/exec';
function handleFavouritesResponse(data) {
  if (data.success) {
    const favs = data.favourites.split('|').map(f => f.trim()).filter(Boolean);
    renderFavouritesDropdown(favs);
  } else {
    console.warn('⚠️ No favourites found or user not found:', data.message);
  }
}

function loadUserFavourites(user) {
  const safeUser = encodeURIComponent(user.trim().toLowerCase());
  jsonp(`${window.SHEET_API_URL}?type=getFavourites&user=${safeUser}&callback=handleFavouritesResponse`);
}

window.SHEET_API_URL = window.SHEET_API_URL ||
  'https://script.google.com/macros/s/AKfycbyIqpE0QffyefE_zybPLTVMOOoDeA7snugUDJWbnUBR1SmeBRSWXHLbpcRLaTPJrdUKBA/exec';

// (2) JSONP helper – injects a <script> tag so you bypass CORS
window.jsonp = function(url) {
  console.log('🟡 JSONP injecting script for:', url);
  const s = document.createElement('script');
  s.src = url;
  document.head.appendChild(s);
}

// Helper to fire off any “write” action
window.post = function(type, data = {}) {
  const params = new URLSearchParams({
    type,
    callback: 'handlePostResponse',
    ...data
  });

  const fullUrl = `${window.SHEET_API_URL}?${params.toString()}`; // ✅ Define this BEFORE logging it
  console.log('📤 Posting via JSONP:', fullUrl);

  jsonp(fullUrl);
}

function timeSince(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return interval + " year" + (interval > 1 ? "s" : "");
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return interval + " month" + (interval > 1 ? "s" : "");
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return interval + " day" + (interval > 1 ? "s" : "");
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval + " hour" + (interval > 1 ? "s" : "");
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval + " minute" + (interval > 1 ? "s" : "");
  return "just now";
}

// ─────────── MARKETPLACE ───────────

// Callback that your server will invoke with the raw 2D array
function handleMarketplace(rawRows) {
  console.log('🟢 handleMarketplace() called with:', rawRows);

  if (!Array.isArray(rawRows)) {
    console.warn('⚠️ No data returned!');
    return;
  }

  // Drop header row if present
  if (rawRows[0] && rawRows[0][0] === 'Username') {
    rawRows = rawRows.slice(1);
  }

  const posts = rawRows
    .map(r => ({
      username:  r[0],
      post:      r[1],
      likes:     r[2],
      postId:    r[3],
      timestamp: r[4],
      comments:  r[5],
      category:  r[6] || 'marketplace'
    }))
    .filter(p => p.category === 'marketplace')
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const feed = document.getElementById('marketplaceContent');
  if (!feed) {
    console.error('❌ #marketplaceContent not found');
    return;
  }

  feed.innerHTML = '';

  posts.forEach(post => {
    const div = document.createElement('div');
    div.className = 'border border-yellow-500 rounded-xl p-4 mb-4 bg-black/60 text-yellow-300 shadow-sm';
    div.innerHTML = `
      <div class="font-semibold text-yellow-400 mb-1">${post.username}</div>
      <p class="text-sm leading-relaxed">${post.post}</p>
      <div class="text-xs text-yellow-500 mt-2">${timeSince(new Date(post.timestamp))} ago</div>
    `;
    feed.appendChild(div);  // ✅ Now inside the loop, after div is defined
  });

  console.log('📦 Marketplace rendered:', posts.length);
}


// Call this when you want to load
function loadMarketplace() {
   console.log('🟡 loadMarketplace() called');
  jsonp(
    `${window.SHEET_API_URL}?type=getMarketplace&callback=handleMarketplace`
  );
}

// ─────────── NEWSFEED ───────────

// Callback for newsfeed
function handleNewsfeed(rawRows) {
  console.log('🟢 handleNewsfeed() called with:', rawRows);

  if (!Array.isArray(rawRows)) {
    console.warn('⚠️ Invalid data format for newsfeed');
    return;
  }

  if (rawRows[0] && rawRows[0][0] === 'Username') rawRows = rawRows.slice(1);

  const posts = rawRows
    .map(r => ({
      username:  r[0],
      post:      r[1],
      likes:     r[2],
      postId:    r[3],
      timestamp: r[4],
      comments:  r[5]
    }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  console.log(`✅ Newsfeed posts parsed: ${posts.length}`);

  const feed = document.getElementById('newsfeedContent');
  if (!feed) {
    console.error('❌ #newsfeedContent element not found!');
    return;
  }

  feed.innerHTML = '';

  posts.forEach(post => {
    const postDiv = document.createElement('div');
    postDiv.className = 'relative border border-yellow-500 rounded-xl p-4 mb-4 bg-black/60 backdrop-blur-sm text-yellow-300 shadow-sm';

    const user = document.createElement('div');
    user.className = 'font-semibold text-yellow-400';
    user.textContent = post.username;

    const content = document.createElement('p');
    content.className = 'text-sm leading-relaxed pr-10';
    content.textContent = post.post;

    const timeAgo = document.createElement('div');
    timeAgo.className = 'text-xs text-yellow-500';
    timeAgo.textContent = timeSince(new Date(post.timestamp)) + ' ago';

    // LIKE BUTTON
    const likeBtn = document.createElement('button');
    likeBtn.className = 'absolute bottom-3 right-3 flex items-center gap-1 text-sm text-yellow-400 hover:text-red-500';
    likeBtn.innerHTML = `<i data-lucide="heart" class="w-4 h-4"></i> ${post.likes}`;
    likeBtn.onclick = () => {
      const liked = likeBtn.classList.toggle('liked');
      const type = liked ? 'like' : 'unlike';
      window.lastLikedBtn = likeBtn;
      window.post(type, { postId: post.postId });
    };

    // COMMENTS
    const commentsDiv = document.createElement('div');
    commentsDiv.className = 'mt-2 space-y-1 ml-2 hidden';
    const comments = post.comments ? JSON.parse(post.comments).reverse() : [];

    comments.forEach(c => {
      const cdiv = document.createElement('div');
      cdiv.className = 'text-xs text-yellow-200';
      cdiv.innerHTML = `<span class='font-semibold text-yellow-400'>${c.user}:</span> ${c.text}`;
      commentsDiv.appendChild(cdiv);
    });

    const toggleCommentsBtn = document.createElement('button');
    toggleCommentsBtn.className = 'text-xs text-yellow-300 hover:text-yellow-100';
    toggleCommentsBtn.textContent = `💬 ${comments.length} comment${comments.length !== 1 ? 's' : ''}`;
    toggleCommentsBtn.onclick = () => {
      commentsDiv.classList.toggle('hidden');
      replyInput.classList.toggle('hidden');
    };

    const replyInput = document.createElement('input');
    replyInput.type = 'text';
    replyInput.placeholder = 'Write a reply…';
    replyInput.className = 'hidden mt-1 w-full text-sm p-2 bg-zinc-900 border border-yellow-500 rounded';
    replyInput.addEventListener('keypress', e => {
      if (e.key === 'Enter' && replyInput.value.trim()) {
        const text = replyInput.value.trim();
        replyInput.disabled = true;
        window.post('comment', {
          username: localStorage.getItem('memberName') || 'Anonymous',
          postId: post.postId,
          commentText: text
        });
        replyInput.value = '';
        replyInput.disabled = false;
      }
    });

    // Append everything
    postDiv.append(user, content, timeAgo, likeBtn, toggleCommentsBtn, commentsDiv, replyInput);
    feed.appendChild(postDiv);
  });

  console.log('📦 Newsfeed rendered to DOM');
}

// Call this to load
function loadNewsfeed() {
  jsonp(
    `${window.SHEET_API_URL}?type=getPosts&callback=handleNewsfeed`
  );
}

// ─────────── POSTS (write) ───────────

// Universal post-callback: reloads whatever view you’re on
function handlePostResponse(resp) {
  console.log('📥 handlePostResponse called with:', resp);
  if (resp.success) {
    // update like count dynamically
    if (resp.likes !== undefined && window.lastLikedBtn) {
      window.lastLikedBtn.innerHTML = `<i data-lucide="heart" class="w-4 h-4"></i> ${resp.likes}`;
      lucide.createIcons();
    } else {
      // fallback: reload
      if (window.currentView === 'marketplace') loadMarketplace();
      else loadNewsfeed();
    }
  } else {
    alert('❌ Error saving: ' + (resp.error || JSON.stringify(resp)));
  }
}


function bindUIButtons() {
  console.log('🔗 bindUIButtons() running');


  document.querySelectorAll('.closeBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.modal')?.classList.add('hidden');
  });
});

  document.getElementById('marketplaceBtn')?.addEventListener('click', () => {
  document.getElementById('marketplaceSidebar')?.classList.remove('translate-x-full');

  if (!window.isPremium) {
    document.getElementById('lockedMarketplaceModal')?.classList.remove('hidden');
  } else {
    document.getElementById('lockedMarketplaceModal')?.classList.add('hidden');
    loadMarketplace();
  }
});

  // 🔃 Toggle filter panel
  document.getElementById('filterBtn')?.addEventListener('click', () => {
    const panel = document.getElementById('filterPanel');
    panel?.classList.toggle('hidden');
  });


  // Toggle profile menu
  document.getElementById('profileToggle')?.addEventListener('click', () => {
    document.getElementById('profileMenu')?.classList.toggle('hidden');
  });
  document.getElementById('profileLoginBtn')?.addEventListener('click', () => {
  document.getElementById('loginModal')?.classList.remove('hidden');
});
document.getElementById('newsfeedBtn')?.addEventListener('click', () => {
  const sidebar = document.getElementById('newsfeedSidebar');
  const lockedOverlay = document.getElementById('lockedNewsModal');

  // Always open the newsfeed
  sidebar?.classList.remove('translate-x-full');
  loadNewsfeed?.();

  // If not premium, show locked overlay
  if (!window.isPremium) {
    lockedOverlay?.classList.remove('hidden');
  } else {
    lockedOverlay?.classList.add('hidden');
  }
});

  // ✅ Handle locked newsfeed close button
document.getElementById('closeLockedModal')?.addEventListener('click', () => {
  document.getElementById('lockedNewsModal')?.classList.add('hidden');
});


}

window.removeFavourite = function(title) {
  const user = localStorage.getItem('username');
  fetch(SHEET_API_URL, {
    method: 'POST',
    body: new URLSearchParams({
      type: 'removeFavourite',
      user,
      title
    })
  })
  .then(() => {
    setTimeout(() => loadUserFavourites(user), 500); // ⏳ slight delay
  });
};


function renderFavouritesDropdown(favs) {
  const container = document.getElementById('favouritesDropdown');
  container.innerHTML = '';

  if (favs.length === 0) {
    container.innerHTML = '<div class="text-sm px-4 py-2 text-yellow-400">No favourites yet.</div>';
    return;
  }

  favs.forEach(title => {
    const div = document.createElement('div');
    div.className = 'text-sm px-4 py-2 text-yellow-400 flex justify-between items-center';
    div.innerHTML = `
      ${title}
      <button onclick="removeFavourite('${title}')">
        <i data-lucide="x" class="w-4 h-4 text-yellow-500 hover:text-red-500"></i>
      </button>
    `;
    container.appendChild(div);
  });

  lucide.createIcons();

}










function setupApp() {
  
console.log('🧠 isPremium:', isPremium);

  if (!document.getElementById('map')) return;

  // global map variable
  mapboxgl.accessToken = 'pk.eyJ1IjoiaG93ZWxsdHJ1c3QiLCJhIjoiY21iZ3FtNGdqMDF4YjJsc2d4Z3JwZGJ2MiJ9.8u6Y-_RYGb-qxODBGT5-LA';
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/howelltrust/cmbkwcx8f00oq01qw9wxy8uw4',
    center: [0.0334, 51.0979],
    zoom: 15
  });

  // 🔥 Fetch and add markers AFTER map is initialized
  fetch('locations.geojson')
    .then(res => res.json())
    .then(data => {
      originalGeoData = data;

      const categories = new Set();
originalGeoData.features.forEach(f => {
  if (f.properties.category) categories.add(f.properties.category);
});

const filterBox = document.getElementById('categoryFilters');
if (filterBox) {
  [...categories].sort().forEach(cat => {
    const label = document.createElement('label');
    label.className = 'flex items-center gap-2';
    label.innerHTML = `<input type="checkbox" value="${cat}" onchange="filterByCategory()" checked> ${cat.charAt(0).toUpperCase() + cat.slice(1)}`;
    filterBox.appendChild(label);
  });
}

      data.features.forEach(feature => {
        const el = document.createElement('div');
        el.className = 'marker';
        el.style.width = '24px';
        el.style.height = '24px';
        el.style.backgroundImage = 'url(flower.png)';
        el.style.backgroundSize = 'cover';
        el.style.cursor = 'pointer';

        const coords = feature.geometry.coordinates;
        const title = feature.properties.title;

        const popupContent = `
  <div class="custom-popup">
    <button class="favourite-btn" onclick="addToFavourites('${title.replace(/'/g, "\\'")}')">
      <i data-lucide="heart" class="w-4 h-4"></i>
    </button>
    <button class="close-btn" onclick="this.closest('.mapboxgl-popup')?.remove()">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
    <div class="title">${title}</div>
    ${feature.properties.description ? `<div class="desc">${feature.properties.description}</div>` : ''}
  </div>
`;

        

   const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
  .setHTML(popupContent);


const marker = new mapboxgl.Marker(el)
  .setLngLat(coords)
  .setPopup(popup)
  .addTo(map);

// 🔄 Re-render icons after popup opens
marker.getElement().addEventListener('click', () => {
  setTimeout(() => lucide.createIcons(), 100); // delay ensures DOM is ready
});


        geoMarkers.push({
          title: title.toLowerCase(),
          coords,
          marker,
          feature
        });
      });

      if (window.lucide) lucide.createIcons();

      // Optional: also populate category filters here
    });
window.addToFavourites = async function(title) {
  const userName = localStorage.getItem('username');
  if (!userName) return alert('Please log in first.');

  console.log(`📤 Sending favourite: ${title} for user: ${userName}`);

  try {
    const res = await fetch(SHEET_API_URL, {
      method: 'POST',
      body: new URLSearchParams({
        type: 'favourite',
        user: userName,
        title: title
      })
    });

    const data = await res.json();
    console.log('🔥 raw response from sheet:', data);

    if (data.success) {
      alert(`🌹 '${title}' added to your favourites.`);
      console.log('⏳ Waiting before loading favourites...');
      setTimeout(() => {
        console.log('🔄 Calling loadUserFavourites...');
        loadUserFavourites(userName);
      }, 800);
    } else {
      alert(`❌ '${title}' is already in your favourites.`);
    }
  } catch (err) {
    console.error('❌ Failed to save favourite:', err);
    alert('Error saving favourite. Try again later.');
  }
};

  document.querySelectorAll('.closeBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal, .sidebar')?.classList.add('hidden');
      if (btn.closest('.sidebar')) {
        btn.closest('.sidebar')?.classList.add('translate-x-full');
      }
    });
  });

  
  // 🔹 Toggle the request submenu
  document.getElementById('requestsBtn')?.addEventListener('click', () => {
    document.getElementById('requestsSubMenu')?.classList.toggle('hidden');
  });

  // 🔹 Handle submenu item clicks → open modal
  document.querySelectorAll('#requestsSubMenu button').forEach(btn => {
    btn.addEventListener('click', () => {
      const label = btn.textContent.trim();
      document.getElementById('requestModalTitle').textContent = label;
      document.getElementById('requestMessage').value = '';
      document.getElementById('requestModal')?.classList.remove('hidden');
      document.getElementById('requestsSubMenu')?.classList.add('hidden');
    });
  });

  // 🔹 Manual cancel + close buttons on modal
  document.getElementById('cancelRequest')?.addEventListener('click', () => {
    document.getElementById('requestModal')?.classList.add('hidden');
  });

  document.getElementById('closeRequestModal')?.addEventListener('click', () => {
    document.getElementById('requestModal')?.classList.add('hidden');
  });


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
  

  if (localStorage.getItem('membershipLevel')) showMemberOptions();

  // 🔍 Category Filters
  window.filterByCategory = () => {
  const checked = Array.from(document.querySelectorAll('#categoryFilters input:checked')).map(i => i.value);
  geoMarkers.forEach(({ marker, feature }) => {
    if (checked.includes(feature.properties.category)) {
      marker.getElement().style.display = 'block';
    } else {
      marker.getElement().style.display = 'none';
    }
  });
};

window.showAllLocations = () => {
  geoMarkers.forEach(({ marker }) => {
    marker.getElement().style.display = 'block';
  });
};
// 🔍 Location Search
const searchInput = document.getElementById('search');
const suggestionsBox = document.getElementById('suggestions');

searchInput.addEventListener('input', async () => {
  const query = searchInput.value.trim().toLowerCase();
  suggestionsBox.innerHTML = '';
  if (!query) return (suggestionsBox.style.display = 'none');

  // Fetch global results
  const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}&autocomplete=true&limit=3`);
  const mapboxData = await res.json();

  // 🔹 Local Matches
  if (originalGeoData) {
    const localMatches = originalGeoData.features.filter(f => f.properties.title.toLowerCase().includes(query)).slice(0, 3);
    if (localMatches.length) {
      suggestionsBox.innerHTML += '<div class="text-xs text-yellow-600 px-2 py-1">🌹 Local Matches</div>';
      localMatches.forEach(loc => {
        const div = document.createElement('div');
        div.className = 'suggestion-item text-sm text-yellow-400 bg-black hover:bg-yellow-500 p-2 rounded cursor-pointer';
        div.textContent = loc.properties.title;
        div.onclick = () => {
          const match = geoMarkers.find(m =>
  m.title.toLowerCase() === loc.properties.title.toLowerCase()
);          if (match) {
            map.flyTo({ center: match.coords, zoom: 16 });
            setTimeout(() => match.marker.togglePopup(), 300);
          }
          searchInput.value = '';
          suggestionsBox.innerHTML = '';
          suggestionsBox.style.display = 'none';
        };
        suggestionsBox.appendChild(div);
      });
    }
  }

  // 🔹 Global Matches
  if (mapboxData.features.length) {
    suggestionsBox.innerHTML += '<div class="text-xs text-yellow-600 px-2 py-1">🌍 Global Locations</div>';
    mapboxData.features.forEach(feature => {
      const div = document.createElement('div');
      div.className = 'suggestion-item text-sm text-yellow-300 bg-black hover:bg-yellow-500 p-2 rounded cursor-pointer';
      div.textContent = feature.place_name;
      div.onclick = () => {
        map.flyTo({ center: feature.center, zoom: 14 });
        searchInput.value = '';
        suggestionsBox.innerHTML = '';
        suggestionsBox.style.display = 'none';
      };
      suggestionsBox.appendChild(div);
    });
  }

  suggestionsBox.classList.remove('hidden');
  suggestionsBox.style.display = 'block';
});

// ✅ ENTER KEY TO TRIGGER SEARCH
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const query = searchInput.value.trim().toLowerCase();
    const match = geoMarkers.find(m => m.title.includes(query));
    if (match) {
      map.flyTo({ center: match.coords, zoom: 16 });
      setTimeout(() => match.marker.togglePopup(), 300);
    } else {
      console.warn('❌ No local match found for:', query);
    }
    suggestionsBox.innerHTML = '';
    suggestionsBox.style.display = 'none';
  }
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!suggestionsBox.contains(e.target) && e.target !== searchInput) {
    suggestionsBox.style.display = 'none';
  }
});
window.setupLogin = function () {
  console.log('🧠 setupLogin() running...');
  const loginForm = document.getElementById('loginForm');
  const nameInput = document.getElementById('nameInput');
  const numberInput = document.getElementById('numberInput');

  console.log('🧠 Binding login submit...');
console.log('form:', loginForm, '| nameInput:', nameInput, '| numberInput:', numberInput);


  if (!loginForm || !nameInput || !numberInput) return console.warn('❌ Missing login elements');

  const submitBtn = loginForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  fetch('https://docs.google.com/spreadsheets/d/1aPjgxKvFXp5uaZwyitf3u3DveCfSWZKgcqrFs-jQIsw/gviz/tq?sheet=Sheet3&tqx=out:json')
    .then(res => res.text())
    .then(text => {
      const json = JSON.parse(text.slice(47, -2));
      membershipData = json.table.rows.map(row => ({
        name: row.c[0]?.v?.trim().toLowerCase().replace(/\s+/g, ''),
        number: (row.c[1]?.v || '').toString().trim(),
        level: (row.c[3]?.v?.trim().toLowerCase()) || 'free'
      }));
      console.log('✅ Membership data loaded:', membershipData);
      if (submitBtn) submitBtn.disabled = false;
    })
    .catch(err => {
      console.error('❌ Failed to fetch membership data:', err);
      alert("Could not load member list. Try again later.");
    });


  loginForm.addEventListener('submit', e => {
  console.log('🟡 loginForm submitted');
  e.preventDefault();

    const typedName = nameInput.value.trim().toLowerCase().replace(/\s+/g, '');
    const typedNumber = numberInput.value.trim();

    console.log('🔍 Typed Name:', typedName);
    console.log('🔢 Typed Number:', typedNumber);

    const match = membershipData.find(m =>
      m.name === typedName && m.number === typedNumber
    );

     console.log('🔎 Match found:', match);

    if (!match) {
      alert('❌ Member not found or incorrect number.');
      return;
    }

    localStorage.setItem('memberName', nameInput.value.trim());
    localStorage.setItem('membershipLevel', match.level);
    window.isPremium = match.level === 'premium';

    alert(`🌹 Welcome back ${match.name}! (${match.level})`);
    document.getElementById('loginModal')?.classList.add('hidden');

     const username = nameInput.value.trim();
localStorage.setItem('username', username);
loadUserFavourites(username);


    showMemberOptions();
    lucide.createIcons?.();
  });
}
function showMemberOptions() {
  const name = localStorage.getItem('memberName') || 'Golden Rose Member';
  const level = (localStorage.getItem('membershipLevel') || 'free').toLowerCase();
  window.isPremium = level === 'premium';

  console.log('🧠 Show member UI for:', name, '| Premium:', window.isPremium);

  document.getElementById('memberName').textContent = `🌹 ${name}`;
  document.getElementById('memberMeta').textContent = `Level: ${level}`;
  document.getElementById('memberOptions')?.classList.remove('hidden');
  document.getElementById('guestOptions')?.classList.add('hidden');
    updateHelpJoinBtn(); // ⬅️ add here
}





document.getElementById('addLocationBtn')?.addEventListener('click', () => {
  const modal = document.getElementById('addLocationModal');
  modal?.classList.toggle('hidden');
});

document.getElementById('favouritesBtn')?.addEventListener('click', () => {
  const dropdown = document.getElementById('favouritesDropdown');
  dropdown?.classList.toggle('hidden');
});
document.getElementById('requestsSubMenu')?.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('requestModal')?.classList.remove('hidden');
    document.getElementById('requestModalTitle').textContent = btn.textContent.trim();
    document.getElementById('requestMessage').value = '';
  });
});

document.getElementById('closeRequestModal')?.addEventListener('click', () => {
  document.getElementById('requestModal')?.classList.add('hidden');
});

document.getElementById('cancelRequest')?.addEventListener('click', () => {
  document.getElementById('requestModal')?.classList.add('hidden');
});
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('memberName');
  localStorage.removeItem('membershipLevel');
  localStorage.removeItem('username'); // ← make sure this is here too

  // Optional: Reload the page to wipe all JS state
  location.reload();

  // Reset UI to guest state
  document.getElementById('memberOptions')?.classList.add('hidden');
  document.getElementById('guestOptions')?.classList.remove('hidden');

  // Optional: show a toast or confirmation
  alert('Logged out successfully');

  // Optional: close profile menu
  document.getElementById('profileMenu')?.classList.add('hidden');
  updateHelpJoinBtn();
});
// Open Feedback Modal
document.getElementById('openFeedback')?.addEventListener('click', () => {
  document.getElementById('feedbackModal')?.classList.remove('hidden');
});

// Close Feedback Modal
document.querySelectorAll('#cancelFeedback, #feedbackModal .closeBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('feedbackModal')?.classList.add('hidden');
  });
});

// Optional: Submit handler
document.getElementById('submitFeedback')?.addEventListener('click', () => {
  const message = document.getElementById('feedbackMessage')?.value.trim();
  if (!message) return alert('Please enter your feedback.');
  
  alert('Feedback sent. Thank you!');
  document.getElementById('feedbackModal')?.classList.add('hidden');
});

document.getElementById('searchButton')?.addEventListener('click', () => {
  const query = searchInput.value.trim().toLowerCase();
  searchInput.dispatchEvent(new Event('input'));
});
updateHelpJoinBtn();
}
function updateHelpJoinBtn() {
  const helpBtn = document.getElementById('helpJoinBtn');
  if (!helpBtn) return;

  const isPremium = (localStorage.getItem('membershipLevel') || '').toLowerCase() === 'premium';
  window.isPremium = isPremium;

  if (!isPremium) {
    helpBtn.classList.remove('hidden');
    helpBtn.onclick = () => {
      document.getElementById('joinNowModal')?.classList.remove('hidden');
    };
  } else {
    helpBtn.classList.add('hidden');
    helpBtn.onclick = null;
  }
}


document.addEventListener('DOMContentLoaded', () => {
  setupApp();
  bindUIButtons();
  setupLogin();
});

