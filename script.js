console.log("✅ Script loaded");

let map;
let geoMarkers = [];
let membershipData = [];
let originalGeoData = null;

window.SHEET_API_URL = window.SHEET_API_URL || 'https://script.google.com/macros/s/AKfycbyIqpE0QffyefE_zybPLTVMOOoDeA7snugUDJWbnUBR1SmeBRSWXHLbpcRLaTPJrdUKBA/exec';
window.isPremium = false;
const MOCK_MARKETPLACE_SHOPS = [
  {
    id: 'rose-crown-bakery',
    name: 'Rose & Crown Bakery',
    tagline: 'Small-batch sourdough and seasonal pastries',
    description: 'A family-run bakery using stoneground British flour, organic butter, and long fermentation for deep flavor.',
    location: 'York, North Yorkshire',
    website: 'https://roseandcrownbakery.example.com',
    mapLink: 'https://maps.google.com/?q=Rose+%26+Crown+Bakery+York',
    rating: 4.9,
    reviews: 132,
    badges: ['Verified Independent', 'Ships Nationwide'],
    openingHours: [
      'Mon-Fri • 07:30-17:00',
      'Sat • 08:00-16:00',
      'Sun • Closed'
    ],
    heroImage: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc10?auto=format&fit=crop&w=900&q=80',
    featuredReview: {
      quote: 'Every loaf tastes like it just left the wood-fired oven.',
      author: 'Amara, regular since 2021'
    },
    products: [
      {
        name: 'Heritage Sourdough',
        price: '£5.50',
        image: 'https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=600&q=80',
        url: 'https://roseandcrownbakery.example.com/products/heritage-sourdough'
      },
      {
        name: 'Rhubarb Custard Tart',
        price: '£4.00',
        image: 'https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?auto=format&fit=crop&w=600&q=80',
        url: 'https://roseandcrownbakery.example.com/products/rhubarb-custard-tart'
      },
      {
        name: 'Market Day Hamper',
        price: '£28.00',
        image: 'https://images.unsplash.com/photo-1484980972926-edee96e0960d?auto=format&fit=crop&w=600&q=80',
        url: 'https://roseandcrownbakery.example.com/products/market-day-hamper'
      }
    ]
  },
  {
    id: 'wye-valley-wool',
    name: 'Wye Valley Wool Co.',
    tagline: 'Sustainably spun British wool blankets and knitwear',
    description: 'Working with small farms in the Wye Valley to spin limited batches of natural-dyed yarn, throws, and knitwear.',
    location: 'Hay-on-Wye, Wales',
    website: 'https://wyevalleywool.example.com',
    mapLink: 'https://maps.google.com/?q=Wye+Valley+Wool+Co',
    rating: 4.8,
    reviews: 84,
    badges: ['Local Maker', 'Limited Runs'],
    openingHours: [
      'Mon-Fri • 10:00-18:00',
      'Sat • 09:00-17:00',
      'Sun • Appointment only'
    ],
    heroImage: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
    featuredReview: {
      quote: 'Their blankets are the coziest thing in our cottage.',
      author: 'Laurie, Wye Valley'
    },
    products: [
      {
        name: 'Borderlands Throw',
        price: '£120.00',
        image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80',
        url: 'https://wyevalleywool.example.com/products/borderlands-throw'
      },
      {
        name: 'Indigo Dye Kit',
        price: '£42.00',
        image: 'https://images.unsplash.com/photo-1600180758890-6dc61c06b012?auto=format&fit=crop&w=600&q=80',
        url: 'https://wyevalleywool.example.com/products/indigo-dye-kit'
      },
      {
        name: 'Aran Fisherman Sweater',
        price: '£165.00',
        image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=600&q=80',
        url: 'https://wyevalleywool.example.com/products/aran-fisherman-sweater'
      }
    ]
  },
  {
    id: 'north-coast-botanicals',
    name: 'North Coast Botanicals',
    tagline: 'Seaweed-rich skincare crafted on the Northumberland coast',
    description: 'Micro-batch skincare blending kelp, sea buckthorn, and cold-pressed oils harvested along the North Sea.',
    location: 'Whitley Bay, Northumberland',
    website: 'https://northcoastbotanicals.example.com',
    mapLink: 'https://maps.google.com/?q=North+Coast+Botanicals',
    rating: 5.0,
    reviews: 56,
    badges: ['Female Founded', 'Plastic-Free Packaging'],
    openingHours: [
      'Thu-Sat • 11:00-19:00',
      'Sun • 11:00-16:00',
      'Mon-Wed • Studio production'
    ],
    heroImage: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=900&q=80',
    featuredReview: {
      quote: 'My skin has never felt calmer. The sea mist tonic is a staple.',
      author: 'Priya, Newcastle'
    },
    products: [
      {
        name: 'Sea Mist Tonic',
        price: '£24.00',
        image: 'https://images.unsplash.com/photo-1519669011783-4eaa95fa0a1b?auto=format&fit=crop&w=600&q=80',
        url: 'https://northcoastbotanicals.example.com/products/sea-mist-tonic'
      },
      {
        name: 'Tidal Renewal Serum',
        price: '£38.00',
        image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80',
        url: 'https://northcoastbotanicals.example.com/products/tidal-renewal-serum'
      },
      {
        name: 'Salt & Citrus Candle',
        price: '£22.00',
        image: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=600&q=80',
        url: 'https://northcoastbotanicals.example.com/products/salt-and-citrus-candle'
      }
    ]
  }
];

const MOCK_MARKETPLACE_LISTINGS = {
  services: [
    {
      id: 'sussex-restoration',
      logo: { text: '🛠️' },
      title: 'Sussex Restoration Guild',
      subtitle: 'Heritage carpentry & timber framing',
      description: 'Booking autumn projects now—front doors, sash windows, and barns within 40 miles of East Grinstead.',
      byline: 'James Carter • Master Carpenter',
      primaryAction: { label: 'Visit Site', url: 'https://sussexrestoration.example.com' },
      secondaryAction: { label: 'Contact', url: 'mailto:hello@sussexrestoration.example.com' }
    },
    {
      id: 'moorland-design',
      logo: { text: '🎨' },
      title: 'Moorland Design Co.',
      subtitle: 'Branding & packaging for independents',
      description: 'One-week sprints for logos, menus, and Shopify theme refreshes. Slots open from 7 October.',
      byline: 'Róisín Harper • Creative Lead',
      primaryAction: { label: 'Book Intro Call', url: 'https://moorlanddesigns.example.com/call' }
    }
  ],
  courses: [
    {
      id: 'wild-ferments-lab',
      logo: { text: '🥬' },
      title: 'Wild Ferments Lab',
      subtitle: '3-week live course • Evenings online',
      description: 'Learn seasonal fermentation with chef Safiya Noor—includes ingredient kit shipped across the UK.',
      byline: 'Starts 14 October • £155',
      primaryAction: { label: 'Reserve Seat', url: 'https://wildferments.example.com/enrol' }
    },
    {
      id: 'coastal-photography-day',
      logo: { text: '📸' },
      title: 'Coastal Photography Day Workshop',
      subtitle: 'In-person • Northumberland Coast',
      description: 'Capture sunrises, dunes, and marine life with pro photographer Ellis Price. Limited to 10 people.',
      byline: 'Saturday 19 October • £120',
      primaryAction: { label: 'View Details', url: 'https://northcoastbotanicals.example.com/workshops' }
    }
  ],
  jobs: [
    {
      id: 'maple-grove-inn',
      logo: { text: '🏡' },
      title: 'Maple Grove Inn',
      subtitle: 'Head Chef (Full-time)',
      description: 'Country inn on the Kent/Sussex border seeking a seasonal menu lead—farm partnerships already in place.',
      byline: 'Hartfield • £38k + tips',
      primaryAction: { label: 'Apply', url: 'mailto:jobs@maplegroveinn.example.com' }
    },
    {
      id: 'wye-valley-wool-job',
      logo: { text: '🧵' },
      title: 'Wye Valley Wool Co.',
      subtitle: 'Retail & Workshop Assistant (Part-time)',
      description: 'Weekends in the mill shop guiding visitors through yarn ranges and supporting dye workshops.',
      byline: 'Hay-on-Wye • £12.50/hr',
      primaryAction: { label: 'Email CV', url: 'mailto:careers@wyevalleywool.example.com' }
    }
  ]
};

const COMMUNITY_OPTIONS = [
  'Forest Row',
  'East Grinstead',
  'Hartfield',
  'Tunbridge Wells',
  'Brighton',
  'London',
  'Manchester',
  'Birmingham',
  'Edinburgh',
  'Glasgow'
];
const COMMUNITY_META = {
  'East Grinstead': { members: 214, county: 'West Sussex', mp: 'Mims Davies' },
  'Forest Row':     { members: 137, county: 'East Sussex', mp: 'Mims Davies' },
  'Hartfield':      { members: 58,  county: 'East Sussex', mp: 'Nus Ghani' },
  'Tunbridge Wells':{ members: 312, county: 'Kent',        mp: 'Greg Clark' },
  'Brighton':       { members: 1024,county: 'East Sussex', mp: 'Caroline Lucas' },
  'London':         { members: 8241,county: 'Greater London', mp: '—' },
  'Manchester':     { members: 2310,county: 'Greater Manchester', mp: '—' },
  'Birmingham':     { members: 1988,county: 'West Midlands', mp: '—' },
  'Edinburgh':      { members: 1120,county: 'Lothian',     mp: '—' },
  'Glasgow':        { members: 1212,county: 'Glasgow City', mp: '—' },
};

function getCommunityMemberCount(name) {
  if (!name) return 0;
  try {
    const dir = getMemberDirectory();
    const values = Object.values(dir || {});
    return values.filter(v => (v && (v.community || '') === name)).length;
  } catch (e) {
    return 0;
  }
}
function checkPremiumStatus() {
  const trialExpires = parseInt(localStorage.getItem('premiumTrialExpires'), 10);
  const now = Date.now();

  if (localStorage.getItem('membershipLevel') === 'premium') {
    if (trialExpires && now > trialExpires) {
      // Trial expired
      localStorage.removeItem('membershipLevel');
      localStorage.removeItem('premiumTrialExpires');
      window.isPremium = false;
    } else {
      window.isPremium = true;
    }
  } else {
    window.isPremium = false;
  }

  console.log('🔁 checkPremiumStatus() ran — isPremium =', window.isPremium);
}

// ───────── COMMUNITY (backend wiring) ─────────
function fetchCommunityForCurrentUser() {
  const user = (localStorage.getItem('memberName') || '').trim();
  if (!user) return;
  const url = `${window.SHEET_API_URL}?type=getCommunity&user=${encodeURIComponent(user)}&callback=handleGetCommunity`;
  jsonp(url);
}

function handleGetCommunity(resp) {
  if (!resp || !resp.success) return;
  const community = (resp.community || '').toString();
  const status = (resp.status || 'member').toString();
  if (community) {
    localStorage.setItem('memberCommunity', community);
    localStorage.setItem('memberCommunityStatus', status);
    window.updateActivityCommunityStatus?.(status, community);
  }
}

function setCommunityForCurrentUser(community, status = 'member') {
  const user = (localStorage.getItem('memberName') || '').trim();
  if (!user || !community) return;
  const url = `${window.SHEET_API_URL}?type=setCommunity&user=${encodeURIComponent(user)}&community=${encodeURIComponent(community)}&status=${encodeURIComponent(status)}&callback=handleSetCommunity`;
  jsonp(url);
}

function handleSetCommunity(resp) {
  if (resp && resp.success) {
    const community = (resp.community || '').toString();
    const status = (resp.status || 'member').toString();
    localStorage.setItem('memberCommunity', community);
    localStorage.setItem('memberCommunityStatus', status);
    window.updateActivityCommunityStatus?.(status, community);
    // Refresh members count using backend meta for accuracy
    requestCommunityMeta(community);
  } else {
    alert('Could not update community.');
  }
}

function requestCommunityMeta(community) {
  if (!community) return;
  const url = `${window.SHEET_API_URL}?type=getCommunityMeta&community=${encodeURIComponent(community)}&callback=handleCommunityMeta`;
  jsonp(url);
}

function ensureHeaderState() {
  if (!window._communityHeaderState) {
    window._communityHeaderState = { community: '', members: null, county: '', mp: '' };
  }
  return window._communityHeaderState;
}

function renderHeaderMeta(state) {
  const metaEl = document.getElementById('activityCommunityMeta');
  if (!metaEl) return;
  const chips = [];
  if (state.community) {
    const members = (state.members != null ? state.members : getCommunityMemberCount(state.community));
    chips.push(`
      <span class="inline-flex items-center gap-1 rounded-full border border-yellow-500/30 px-2 py-0.5">
        <i data-lucide="users" class="w-3.5 h-3.5"></i> ${members} members
      </span>`);
  }
  const county = state.county || (COMMUNITY_META[state.community || '']?.county || '');
  const mp     = state.mp     || (COMMUNITY_META[state.community || '']?.mp     || '');
  if (county) chips.push(`
    <span class="inline-flex items-center gap-1 rounded-full border border-yellow-500/30 px-2 py-0.5">
      <i data-lucide="map" class="w-3.5 h-3.5"></i> ${county}
    </span>`);
  if (mp) chips.push(`
    <span class="inline-flex items-center gap-1 rounded-full border border-yellow-500/30 px-2 py-0.5">
      <i data-lucide="landmark" class="w-3.5 h-3.5"></i> ${mp}
    </span>`);
  metaEl.innerHTML = chips.join(' ');
  window.lucide?.createIcons?.();
}

function handleCommunityMeta(resp) {
  if (!resp || !resp.success) return;
  const state = ensureHeaderState();
  state.community = resp.community || state.community;
  if (typeof resp.members === 'number') state.members = resp.members;
  if (resp.county) state.county = resp.county;
  if (resp.mp) state.mp = resp.mp;
  renderHeaderMeta(state);
}
window.updateHelpJoinBtn = function () {
  const btn = document.getElementById('helpJoinBtn');
  if (!btn) {
    console.warn('❌ helpJoinBtn not found');
    return;
  }

  // Hide the help/join button for any logged-in user (free or premium)
  if (window.isPremium || window.isLoggedIn?.()) {
    btn.classList.add('hidden');
    console.log('🙈 Logged-in – hiding helpJoinBtn');
  } else {
    btn.classList.remove('hidden');
    btn.style.display = 'block';
    btn.style.visibility = 'visible';
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
    console.log('🎯 Logged-out – showing helpJoinBtn');
  }
};


// ───────── JSONP + POST ─────────
// 🔁 Load favourites (called on login or after adding/removing)
function loadUserFavourites(user) {
  const safeUser = encodeURIComponent(user.trim().toLowerCase());
  const url = `${window.SHEET_API_URL}?type=getFavourites&user=${safeUser}&callback=handleFavouritesResponse`;
  jsonp(url);
}

// 🔧 Callback: handle favourites array
function handleFavouritesResponse(data) {
  if (data.success) {
    const favs = data.favourites.split('|').map(f => f.trim()).filter(Boolean);
    renderFavouritesDropdown(favs);
  } else {
    console.warn('⚠️ No favourites found or user not found:', data.message);
  }
}
function bindSubmissionForm() {
  const form = document.getElementById('submissionForm');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault(); // ✅ this now works!

    const name = document.getElementById('locationName').value.trim();
    const location = document.getElementById('submissionLocation').value.trim();
    const category = document.getElementById('locationCoords').value.trim();

    const url = `${window.SHEET_API_URL}?type=submission&callback=handleSubmissionResponse`
              + `&name=${encodeURIComponent(name)}`
              + `&location=${encodeURIComponent(location)}`
              + `&category=${encodeURIComponent(category)}`;

    jsonp(url);
  });
}


// 🗑 Remove a favourite
window.removeFavourite = function(title) {
  const user = localStorage.getItem('username');
  if (!user) return alert('Please log in.');

  const safeUser = encodeURIComponent(user.trim().toLowerCase());
  const safeTitle = encodeURIComponent(title.trim());

  const url = `${window.SHEET_API_URL}?type=removeFavourite&user=${safeUser}&title=${safeTitle}&callback=handleRemoveFavouriteResponse`;
  jsonp(url);
};

// (2) JSONP helper – injects a <script> tag so you bypass CORS
window.jsonp = function(url) {
  console.log('🟡 JSONP injecting script for:', url);
  const s = document.createElement('script');
  s.src = url;
  document.head.appendChild(s);
}

// 📩 Callback after removing a favourite
function handleRemoveFavouriteResponse(data) {
  if (data.success) {
    setTimeout(() => loadUserFavourites(localStorage.getItem('username')), 500);
  } else {
    alert('❌ Could not remove favourite.');
  }
}

document.querySelectorAll('.categoryBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    const cat = btn.getAttribute('data-cat');
    window.marketplaceFilter = cat;
    loadMarketplace(cat);

    // 🔁 Update active button highlight
    document.querySelectorAll('.categoryBtn').forEach(b => b.classList.remove('active-category'));
    btn.classList.add('active-category');
  });
});



// 🌹 Add a favourite (also JSONP now)
window.addToFavourites = function(title) {
  const user = localStorage.getItem('username');
  if (!user) return alert('Please log in first.');

  const safeUser = encodeURIComponent(user.trim().toLowerCase());
  const safeTitle = encodeURIComponent(title.trim());

  const url = `${window.SHEET_API_URL}?type=favourite&user=${safeUser}&title=${safeTitle}&callback=handleAddFavouriteResponse`;
  jsonp(url);
};

// 📩 Callback after adding a favourite
function handleAddFavouriteResponse(data) {
  if (data.success) {
    alert(`🌹 Added to your favourites.`);
    setTimeout(() => loadUserFavourites(localStorage.getItem('username')), 800);
  } else {
    alert(`❌ Already in your favourites or failed to save.`);
  }
}

// 🔽 Renders the dropdown list of favourites
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
      <button onclick="removeFavourite('${title.replace(/'/g, "\\'")}')">
        <i data-lucide="x" class="w-4 h-4 text-yellow-500 hover:text-red-500"></i>
      </button>
    `;
    container.appendChild(div);
  });

  lucide.createIcons?.();
}

window.submitRequest = function (requestType, message) {
  const user = localStorage.getItem('memberName') || 'Anonymous';
  const encodedMsg = encodeURIComponent(message.trim());

  if (!encodedMsg) return alert('Please enter your request.');

  const url = `${window.SHEET_API_URL}?type=request&username=${encodeURIComponent(user)}&requestType=${encodeURIComponent(requestType)}&message=${encodedMsg}&callback=handleRequestResponse`;

  console.log('📤 Sending request via JSONP:', url);
  jsonp(url);
};

function handleSubmissionResponse(data) {
  if (data.success) {
    alert('✅ Location submitted!');
    document.getElementById('submissionForm').reset();
    closeModal(); // if this exists
  } else {
    alert('❌ Error submitting location.');
  }
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

window.setMarketplaceFilter = function (category) {
  window.marketplaceFilter = category;
  loadMarketplace(); // ← fetch again using updated filter
};


function renderMarketplaceShop(container) {
  container.innerHTML = '';

  MOCK_MARKETPLACE_SHOPS.forEach(shop => {
    const card = document.createElement('article');
    const badgesHtml = (shop.badges || []).map(badge => `
      <span class="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-200">
        <i data-lucide="sparkles" class="w-3.5 h-3.5 text-yellow-400"></i>
        ${badge}
      </span>
    `).join('');

    const hoursHtml = (shop.openingHours || []).map(line => `<li class="text-sm text-yellow-200/90">${line}</li>`).join('');

    const reviewHtml = shop.featuredReview
      ? `<div class="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-100/90 italic">
           &ldquo;${shop.featuredReview.quote}&rdquo;
           <div class="mt-2 text-xs font-semibold text-yellow-400 not-italic uppercase tracking-wide">&mdash; ${shop.featuredReview.author}</div>
         </div>`
      : '<div class="hidden sm:block"></div>';

    const productsHtml = (shop.products || []).map(product => `
      <a href="${product.url}" target="_blank" rel="noopener noreferrer" class="group block rounded-2xl overflow-hidden border border-yellow-500/30 bg-black/60 hover:border-yellow-400 transition">
        <div class="h-32 sm:h-40 w-full overflow-hidden bg-zinc-900/70">
          <img src="${product.image}" alt="${product.name}" class="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105" loading="lazy">
        </div>
        <div class="flex items-center justify-between px-4 py-3 text-sm text-yellow-200">
          <span class="font-semibold text-yellow-100">${product.name}</span>
          <span class="text-yellow-400">${product.price}</span>
        </div>
      </a>
    `).join('');

    const ratingLabel = typeof shop.rating === 'number' ? shop.rating.toFixed(1) : shop.rating;

    card.className = 'rounded-3xl border border-yellow-500/40 bg-black/75 shadow-2xl overflow-hidden backdrop-blur-sm transition hover:border-yellow-400';
    card.innerHTML = `
      <div class="grid gap-6 lg:grid-cols-[1.35fr_1fr] p-6">
        <div class="flex flex-col gap-5">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p class="text-[11px] uppercase tracking-[0.35em] text-yellow-500/70">Featured Business</p>
              <h3 class="text-2xl font-semibold text-yellow-100">${shop.name}</h3>
              <p class="text-sm text-yellow-300/90">${shop.tagline}</p>
            </div>
            <div class="flex items-center gap-2 text-yellow-400 text-sm font-semibold">
              <i data-lucide="star" class="w-4 h-4"></i>
              <span>${ratingLabel}</span>
              <span class="text-yellow-500/70 font-normal">(${shop.reviews} reviews)</span>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">${badgesHtml}</div>

          <p class="text-sm leading-relaxed text-yellow-200/90">${shop.description}</p>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-3 text-sm text-yellow-200/90">
              <div class="flex items-center gap-2 font-semibold text-yellow-100">
                <i data-lucide="map-pin" class="w-4 h-4 text-yellow-500"></i>
                <span>${shop.location}</span>
              </div>
              <ul class="space-y-1 pl-4 list-disc">${hoursHtml}</ul>
            </div>
            ${reviewHtml}
          </div>

          <div class="flex flex-wrap gap-3">
            <a href="${shop.website}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 rounded-full bg-yellow-500 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-400 transition">
              <i data-lucide="external-link" class="w-4 h-4"></i>
              <span>Visit Site</span>
            </a>
            ${shop.mapLink ? `<a href="${shop.mapLink}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 rounded-full border border-yellow-500 px-4 py-2 text-sm text-yellow-200 hover:bg-yellow-500 hover:text-black transition">
              <i data-lucide="navigation" class="w-4 h-4"></i>
              <span>Get Directions</span>
            </a>` : ''}
          </div>
        </div>

        <div class="rounded-2xl overflow-hidden border border-yellow-500/20 bg-black/40 flex flex-col justify-between">
          <img src="${shop.heroImage}" alt="${shop.name}" class="h-48 sm:h-64 w-full object-cover" loading="lazy">
          <div class="p-4 text-xs text-yellow-200/80 border-t border-yellow-500/20">
            <span class="font-semibold text-yellow-300">In-store highlights</span>
            <p class="mt-1 leading-relaxed">${shop.tagline}</p>
          </div>
        </div>
      </div>

      <div class="border-t border-yellow-500/20 bg-black/60 px-6 py-5">
        <h4 class="text-sm font-semibold uppercase tracking-[0.2em] text-yellow-500/70 mb-3">Featured Products</h4>
        <div class="grid gap-4 sm:grid-cols-2">
          ${productsHtml}
        </div>
      </div>
    `;

    container.appendChild(card);
  });

  lucide.createIcons?.();
}

function renderMarketplaceListingCard(container, item) {
  const card = document.createElement('article');
  card.className = 'flex items-start gap-4 rounded-2xl border border-yellow-500/40 bg-black/70 px-4 py-4 shadow-lg transition hover:border-yellow-400';

  const badge = document.createElement('div');
  badge.className = 'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-yellow-500/20 bg-yellow-500/15 text-xl text-yellow-300';

  if (item.logo?.image) {
    const img = document.createElement('img');
    img.src = item.logo.image;
    img.alt = item.title;
    img.className = 'h-full w-full rounded-xl object-cover';
    badge.textContent = '';
    badge.appendChild(img);
  } else if (item.logo?.text) {
    badge.textContent = item.logo.text;
  } else {
    badge.textContent = (item.title || 'Listing').slice(0, 1).toUpperCase();
  }

  const body = document.createElement('div');
  body.className = 'flex-1 space-y-2 text-yellow-100';

  const header = document.createElement('div');
  header.className = 'flex flex-wrap items-center gap-x-3 gap-y-1';

  const title = document.createElement('h3');
  title.className = 'text-base font-semibold text-yellow-100';
  title.textContent = item.title || 'Marketplace Listing';

  const subtitle = document.createElement('span');
  subtitle.className = 'text-xs font-medium uppercase tracking-[0.2em] text-yellow-500/80';
  subtitle.textContent = item.subtitle || '';

  header.append(title);
  if (subtitle.textContent) header.append(subtitle);

  const description = document.createElement('p');
  description.className = 'text-sm leading-relaxed text-yellow-200/90';
  description.textContent = item.description || item.postText || '';

  const byline = document.createElement('p');
  byline.className = 'text-xs text-yellow-500/80';
  byline.textContent = item.byline || (item.username ? `Posted by ${item.username}` : '');

  const actions = document.createElement('div');
  actions.className = 'flex flex-wrap items-center gap-2 pt-1';

  const makeButton = (action, isPrimary) => {
    if (!action?.label || !action?.url) return null;
    const btn = document.createElement('a');
    btn.href = action.url;
    const isExternal = /^https?:/i.test(action.url);
    btn.target = isExternal ? '_blank' : '_self';
    btn.rel = isExternal ? 'noopener noreferrer' : '';
    btn.className = `${isPrimary
      ? 'bg-yellow-500 text-black hover:bg-yellow-400'
      : 'border border-yellow-500 text-yellow-200 hover:bg-yellow-500 hover:text-black'} inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition`;
    const icon = isPrimary ? (isExternal ? 'external-link' : 'arrow-up-right') : (/^mailto:/i.test(action.url) ? 'mail' : 'message-square');
    btn.innerHTML = `<i data-lucide="${icon}" class="w-3.5 h-3.5"></i><span>${action.label}</span>`;
    return btn;
  };

  const primaryBtn = makeButton(item.primaryAction, true);
  const secondaryBtn = makeButton(item.secondaryAction, false);

  if (primaryBtn) actions.appendChild(primaryBtn);
  if (secondaryBtn) actions.appendChild(secondaryBtn);

  body.append(header);
  if (description.textContent) body.append(description);
  if (byline.textContent) body.append(byline);
  if (actions.childElementCount > 0) body.append(actions);

  if (item.timestamp) {
    const time = document.createElement('p');
    time.className = 'text-[11px] uppercase tracking-[0.2em] text-yellow-600/70';
    time.textContent = timeSince(new Date(item.timestamp)) + ' ago';
    body.append(time);
  }

  if (item.enableInteractions) {
    const comments = Array.isArray(item.comments) ? item.comments : [];
    const commentsDiv = document.createElement('div');
    commentsDiv.className = 'mt-2 space-y-1 ml-2 hidden';

    comments.forEach(c => {
      const cdiv = document.createElement('div');
      cdiv.className = 'text-xs text-yellow-200';
      cdiv.innerHTML = `<span class='font-semibold text-yellow-400'>${c.user}:</span> ${c.text}`;
      commentsDiv.appendChild(cdiv);
    });

    const replyInput = document.createElement('input');
    replyInput.type = 'text';
    replyInput.placeholder = 'Write a reply…';
    replyInput.className = 'hidden mt-2 w-full text-sm p-2 bg-zinc-900 border border-yellow-500/40 rounded focus:outline-none focus:ring focus:border-yellow-400';
    replyInput.addEventListener('keypress', e => {
      if (e.key === 'Enter' && replyInput.value.trim()) {
        const text = replyInput.value.trim();
        replyInput.disabled = true;
        window.post('comment', {
          username: localStorage.getItem('memberName') || 'Anonymous',
          postId: item.postId,
          commentText: text,
          category: 'marketplace'
        });
        replyInput.value = '';
        replyInput.disabled = false;
      }
    });

    const likeBtn = document.createElement('button');
    likeBtn.className = 'flex items-center gap-1 text-xs text-yellow-400 hover:text-red-500';
    likeBtn.innerHTML = `<i data-lucide="heart" class="w-3.5 h-3.5"></i> ${item.likes ?? 0}`;
    likeBtn.onclick = () => {
      const liked = likeBtn.classList.toggle('liked');
      const type = liked ? 'like' : 'unlike';
      window.lastLikedBtn = likeBtn;
      window.post(type, { postId: item.postId, category: 'marketplace' });
    };

    const toggleCommentsBtn = document.createElement('button');
    toggleCommentsBtn.className = 'text-xs text-yellow-300 hover:text-yellow-100';
    toggleCommentsBtn.textContent = `💬 ${comments.length} comment${comments.length !== 1 ? 's' : ''}`;
    toggleCommentsBtn.onclick = () => {
      commentsDiv.classList.toggle('hidden');
      replyInput.classList.toggle('hidden');
    };

    const socialRow = document.createElement('div');
    socialRow.className = 'flex items-center justify-between pt-3';
    socialRow.append(toggleCommentsBtn, likeBtn);

    body.append(socialRow, commentsDiv, replyInput);
  }

  card.append(badge, body);
  container.appendChild(card);
}

// Callback that your server will invoke with the raw 2D array
function handleMarketplace(rawRows) {
  console.log('🟢 handleMarketplace() called with:', rawRows);

  if (!Array.isArray(rawRows)) {
    console.warn('⚠️ No data returned!');
    return;
  }

  if (rawRows[0] && rawRows[0][0] === 'Username') {
    rawRows = rawRows.slice(1);
  }

  const allMarketplacePosts = rawRows
    .map(r => ({
      username:  r[0],
      post:      r[1],
      likes:     r[2],
      postId:    r[3],
      timestamp: r[4],
      comments:  r[5],
      category:  (r[6] || '').toString().trim().toLowerCase() || 'jobs'
    }))
    .filter(p => ['shop','services','courses','jobs'].includes(p.category))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const selectedCategory = window.marketplaceFilter || 'jobs';
  const listingsContainer = document.getElementById('marketplaceListingsContent');
  const shopContainer = document.getElementById('marketplaceShopContent');
  const loadingNode = document.getElementById('loadingMarketplace');
  const formNode = document.getElementById('marketplacePostForm');
  const refreshNode = document.getElementById('refreshMarketplace');

  if (!listingsContainer || !shopContainer) {
    console.error('❌ Marketplace containers missing');
    return;
  }

  listingsContainer.innerHTML = '';
  shopContainer.innerHTML = '';

  console.log('📛 Current filter:', selectedCategory);

  if (selectedCategory === 'shop') {
    shopContainer.classList.remove('hidden');
    listingsContainer.classList.add('hidden');

    if (formNode) formNode.style.display = 'none';
    if (refreshNode) refreshNode.style.display = 'none';

    renderMarketplaceShop(shopContainer);

    if (loadingNode) loadingNode.classList.add('hidden');
    return;
  }

  shopContainer.classList.add('hidden');
  listingsContainer.classList.remove('hidden');

  if (formNode) formNode.style.display = '';
  if (refreshNode) refreshNode.style.display = '';

  const visiblePosts = allMarketplacePosts.filter(p => p.category === selectedCategory);

  console.log('📋 Found posts:', visiblePosts.length);

  const curatedListings = MOCK_MARKETPLACE_LISTINGS[selectedCategory] || [];
  curatedListings.forEach(item => renderMarketplaceListingCard(listingsContainer, item));

  if (visiblePosts.length > 0) {
    visiblePosts.forEach(post => {
      const comments = post.comments ? JSON.parse(post.comments).reverse() : [];
      const text = post.post || '';
      const [firstLine, ...restLines] = text.split('\n');
      const titleText = (firstLine || '').trim();
      const remainder = restLines.join(' ').trim();
      renderMarketplaceListingCard(listingsContainer, {
        logo: { text: (post.username || '?').slice(0, 2).toUpperCase() },
        title: titleText ? (titleText.length > 80 ? `${titleText.slice(0, 77)}…` : titleText) : 'Community Listing',
        subtitle: post.username ? `Posted by ${post.username}` : '',
        description: remainder || text,
        timestamp: post.timestamp,
        likes: post.likes,
        comments,
        postId: post.postId,
        enableInteractions: true,
        username: post.username
      });
    });
  }

  if (curatedListings.length === 0 && visiblePosts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'border border-yellow-500/30 bg-black/60 rounded-2xl p-5 text-center text-sm text-yellow-300';
    empty.textContent = 'Nothing here yet. Share something for the community.';
    listingsContainer.appendChild(empty);
  }

  lucide.createIcons?.();
  if (loadingNode) loadingNode.classList.add('hidden');
  console.log(`📦 Rendered ${visiblePosts.length} posts in category:`, selectedCategory);
  window.ensurePostFormsVisibility?.();
}


function loadMarketplace(category = 'jobs') {
  window.currentMarketplaceCategory = category;

  const loadingNode = document.getElementById('loadingMarketplace');
  const listingsContainer = document.getElementById('marketplaceListingsContent');
  const shopContainer = document.getElementById('marketplaceShopContent');
  const formNode = document.getElementById('marketplacePostForm');
  const refreshNode = document.getElementById('refreshMarketplace');

  if (loadingNode) loadingNode.classList.remove('hidden');
  if (listingsContainer) listingsContainer.classList.add('hidden');
  if (shopContainer) shopContainer.classList.add('hidden');

  const activeCategory = category || window.marketplaceFilter || 'jobs';
  if (activeCategory === 'shop') {
    if (formNode) formNode.style.display = 'none';
    if (refreshNode) refreshNode.style.display = 'none';
  }

  jsonp(`${window.SHEET_API_URL}?type=getMarketplace&callback=handleMarketplace`);
}



// ─────────── ACTIVITY FEED ───────────

// Callback for activity feed
function handleActivity(rawRows) {
  console.log('🟢 handleActivity() called with:', rawRows);

  if (!Array.isArray(rawRows)) {
    console.warn('⚠️ Invalid data format for activity feed');
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

  console.log(`✅ Activity posts parsed: ${posts.length}`);

  const feed = document.getElementById('activityContent');
  if (!feed) {
    console.error('❌ #activityContent element not found!');
    return;
  }

  // Preserve fixed UI (form + refresh) when re-rendering
  const postForm = document.getElementById('activityPostForm');
  const refreshBtn = document.getElementById('refreshActivity');
  const loadingNode2 = document.getElementById('loadingPosts');
  const communityCard = document.getElementById('activityCommunityCard');

  // Preserve community picker while re-rendering
  const keepCommunity = communityCard ? communityCard.cloneNode(true) : null;
  feed.innerHTML = '';
  if (keepCommunity) feed.appendChild(keepCommunity);

  posts.forEach(post => {
  const postDiv = document.createElement('div');
  postDiv.className = 'relative border border-yellow-500 rounded-2xl p-5 bg-black/70 text-yellow-300 shadow-lg transition hover:border-yellow-400';

  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-2';

  const userBtn = document.createElement('button');
  userBtn.type = 'button';
  userBtn.className = 'flex items-center gap-2 text-sm font-semibold text-yellow-300 hover:text-yellow-100 transition';
  userBtn.innerHTML = `<span>${post.username || 'Anonymous'}</span>`;
  userBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.showMemberCard(post.username || 'Anonymous', userBtn);
  });

  const timeAgo = document.createElement('div');
  timeAgo.className = 'text-xs text-yellow-500';
  timeAgo.textContent = timeSince(new Date(post.timestamp)) + ' ago';

  header.append(userBtn, timeAgo);

  const content = document.createElement('p');
  content.className = 'text-sm leading-relaxed mb-3 text-yellow-200';
  content.textContent = post.post;

  // LIKE BUTTON
  const likeBtn = document.createElement('button');
  likeBtn.className = 'flex items-center gap-1 text-sm text-yellow-400 hover:text-red-500';
  likeBtn.innerHTML = `<i data-lucide="heart" class="w-4 h-4"></i> ${post.likes}`;
  likeBtn.onclick = () => {
    const liked = likeBtn.classList.toggle('liked');
    const type = liked ? 'like' : 'unlike';
    window.lastLikedBtn = likeBtn;
    window.post(type, { postId: post.postId, category: 'activity' });
  };

  // COMMENTS
  const comments = post.comments ? JSON.parse(post.comments).reverse() : [];
  const commentsDiv = document.createElement('div');
  commentsDiv.className = 'mt-2 space-y-1 ml-2 hidden';

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
  replyInput.className = 'hidden mt-2 w-full text-sm p-2 bg-zinc-900 border border-yellow-500/40 rounded focus:outline-none focus:ring focus:border-yellow-400';
  replyInput.addEventListener('keypress', e => {
    if (e.key === 'Enter' && replyInput.value.trim()) {
      const text = replyInput.value.trim();
      replyInput.disabled = true;
      window.post('comment', {
        username: localStorage.getItem('memberName') || 'Anonymous',
        postId: post.postId,
        commentText: text,
        category: 'activity'
      });
      replyInput.value = '';
      replyInput.disabled = false;
    }
  });

  const actionsRow = document.createElement('div');
  actionsRow.className = 'flex items-center justify-between mt-3';
  actionsRow.append(toggleCommentsBtn, likeBtn);

  postDiv.append(header, content, actionsRow, commentsDiv, replyInput);
  feed.appendChild(postDiv);
  lucide.createIcons();
  });


  // Ensure the sidebar is visible once data is rendered
  const sidebarEl = document.getElementById('activitySidebar');
  sidebarEl?.classList.remove('translate-x-full');

  console.log('📦 Activity feed rendered to DOM');
  // Re-attach fixed nodes
  if (postForm) feed.appendChild(postForm);
  if (refreshBtn) feed.appendChild(refreshBtn);
  if (loadingNode2) loadingNode2.remove();
  // Re-initialize community picker interactions after re-attach
  setTimeout(() => window.initCommunityPicker?.(), 0);
  // Ensure form visible for logged-in users
  window.ensurePostFormsVisibility?.();
}

// Call this to load
function loadActivity() {
  jsonp(
    `${window.SHEET_API_URL}?type=getPosts&callback=handleActivity`
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
      else loadActivity();
    }
  } else {
    alert('❌ Error saving: ' + (resp.error || JSON.stringify(resp)));
  }
}

function handleRequestResponse(data) {
  console.log('📥 handleRequestResponse received:', data);

  if (data.success) {
    alert('✅ Request submitted successfully!');
    document.getElementById('requestModal')?.classList.add('hidden');
    document.getElementById('requestMessage').value = '';
  } else {
    alert('❌ Error submitting request.');
  }
}

function bindMarketplacePostForm() {
  const form = document.getElementById('marketplacePostForm');
  const input = document.getElementById('marketplacePostInput');

  if (!form || !input) return;

  form.addEventListener('submit', e => {
    e.preventDefault();

    const text = input.value.trim();
    if (!text) return;

    const username = localStorage.getItem('memberName') || 'Anonymous';
    const category = window.marketplaceFilter || 'jobs';

    window.post('post', {
      username,
      post: text,
      category
    });

    input.value = '';
  });
}

function bindActivityPostForm() {
  const form = document.getElementById('activityPostForm');
  const input = document.getElementById('postInput');

  if (!form || !input) return;

  form.addEventListener('submit', e => {
    e.preventDefault();

    const text = input.value.trim();
    if (!text) return;

    const username = localStorage.getItem('memberName') || 'Anonymous';
    window.post('post', {
      username,
      post: text,
      category: 'activity'
    });

    input.value = '';
  });
}

function bindUIButtons() {
  console.log('🔗 bindUIButtons() running');

  bindSubmissionForm();
  bindMarketplacePostForm();
  bindActivityPostForm();

  document.querySelectorAll('.categoryBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-cat');
      window.currentMarketplaceCategory = cat;
      loadMarketplace(cat);
    });
  });

  document.getElementById('refreshActivity')?.addEventListener('click', () => {
    loadActivity?.();
  });

  document.getElementById('closeOnboarding')?.addEventListener('click', () => {
    document.getElementById('onboardingModal')?.classList.add('hidden');
  });

  document.getElementById('affiliatesBtn')?.addEventListener('click', () => {
    const level = (localStorage.getItem('membershipLevel') || '').toLowerCase();
    if (level === 'affiliate') {
      if (Notification.permission === 'granted') {
        new Notification('🌹 Affiliates', { body: 'Coming soon...', icon: 'flower.png' });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification('🌹 Affiliates', { body: 'Coming soon...', icon: 'flower.png' });
          }
        });
      }
    } else {
      alert('🔒 COMING SOON...');
    }
  });

  document.getElementById('requestsBtn')?.addEventListener('click', () => {
    document.getElementById('requestsSubMenu')?.classList.toggle('hidden');
  });

  document.querySelectorAll('#requestsSubMenu button').forEach(btn => {
    btn.addEventListener('click', () => {
      const label = btn.textContent.trim();
      const typeMap = {
        'Request Verification': 'Verification',
        'Request Donations': 'Donations',
        'Request an Event': 'Event'
      };
      const type = typeMap[label] || 'Verification';
      window.selectedRequestType = type;
      document.getElementById('requestModalTitle').textContent = label;
      document.getElementById('requestMessage').value = '';
      document.getElementById('requestModal')?.classList.remove('hidden');
    });
  });

  document.getElementById('cancelRequest')?.addEventListener('click', () => {
    document.getElementById('requestModal')?.classList.add('hidden');
  });

  document.getElementById('closeRequestModal')?.addEventListener('click', () => {
    document.getElementById('requestModal')?.classList.add('hidden');
  });

  document.getElementById('submitRequest')?.addEventListener('click', () => {
    const message = document.getElementById('requestMessage').value.trim();
    const username = localStorage.getItem('memberName') || 'Anonymous';
    const type = window.selectedRequestType || 'Verification';

    if (!message) return alert('Please write a message before submitting.');

    const params = new URLSearchParams({
      type,
      member: username,
      message,
      callback: 'handleRequestResponse'
    });

    jsonp(`${window.SHEET_API_URL}?${params.toString()}`);
  });

  document.getElementById('submitFeedback')?.addEventListener('click', () => {
    const msg = document.getElementById('feedbackMessage').value.trim();
    if (!msg) return alert('Please enter a message.');

    jsonp(`${SHEET_API_URL}?type=feedback&message=${encodeURIComponent(msg)}&callback=handleFeedbackResponse`);
  });

  document.getElementById('cancelFeedback')?.addEventListener('click', () => {
    document.getElementById('feedbackModal')?.classList.add('hidden');
  });

  document.querySelectorAll('.closeBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal')?.classList.add('hidden');
    });
  });

  document.getElementById('marketplaceBtn')?.addEventListener('click', () => {
    window.updateLockedOverlays?.();
    document.getElementById('marketplaceSidebar')?.classList.remove('translate-x-full');
    if (window.isLoggedIn?.()) {
      loadMarketplace();
      setTimeout(() => window.ensurePostFormsVisibility?.(), 0);
    }
  });

  const filterPanel = document.getElementById('filterPanel');
  document.getElementById('filterBtn')?.addEventListener('click', () => {
    if (filterPanel) filterPanel.classList.toggle('hidden');
  });
  document.getElementById('closeFilterPanel')?.addEventListener('click', () => {
    filterPanel?.classList.add('hidden');
  });

  document.getElementById('profileToggle')?.addEventListener('click', () => {
    document.getElementById('profileMenu')?.classList.toggle('hidden');
  });
  document.getElementById('profileLoginBtn')?.addEventListener('click', () => {
    document.getElementById('loginModal')?.classList.remove('hidden');
  });

  document.getElementById('activityBtn')?.addEventListener('click', () => {
    window.keepActivityOpen = true;
    document.getElementById('activitySidebar')?.classList.remove('translate-x-full');
    loadActivity?.();
    window.updateLockedOverlays?.();
    setTimeout(() => window.ensurePostFormsVisibility?.(), 0);
  });

  document.getElementById('entertainmentBtn')?.addEventListener('click', () => {
    document.getElementById('entertainmentSidebar')?.classList.remove('translate-x-full');
    loadEntertainment?.();
    window.updateLockedOverlays?.();
  });

  window.entertainmentFilter = window.entertainmentFilter || 'fyp';
  document.querySelectorAll('.entCategoryBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-cat');
      window.entertainmentFilter = cat;
      document.querySelectorAll('.entCategoryBtn').forEach(b => b.classList.remove('active-category'));
      btn.classList.add('active-category');
    });
  });
}

// ─────────── ENTERTAINMENT ───────────

window.handleEntertainment = function (rawRows) {
  console.log('🟢 handleEntertainment() called with:', rawRows);
  window._entertainmentReceived = true;

  if (!Array.isArray(rawRows)) {
    console.warn('⚠️ Invalid data format for entertainment');
    return;
  }

  // Drop header row if present
  const header = rawRows[0] || [];
  let rows = rawRows;
  const headerHasUrl = header.some(v => typeof v === 'string' && /^https?:/i.test(v));
  if (!headerHasUrl && header.some(v => /image|url|caption|title/i.test(String(v)))) {
    rows = rawRows.slice(1);
  }

  const items = rows
    .map(r => Array.isArray(r) ? r : [r])
    .map(r => {
      const strings = r.filter(v => typeof v === 'string');
      const imageUrl = strings.find(v => /^https?:\/\//i.test(v)) || '';
      const nonUrls = strings.filter(v => !/^https?:\/\//i.test(v));
      const username = (nonUrls[0] || '').toString() || 'Anonymous';
      const caption = (nonUrls[1] || '').toString();
      // keep timestamp internally if needed later, but do not render
      const timestamp = r.find(v => /\d{4}-\d{2}-\d{2}|:\d{2}/.test(String(v))) || '';
      return { imageUrl, username, caption, timestamp };
    })
    .filter(it => it.imageUrl);

  const feed = document.getElementById('entertainmentContent');
  if (!feed) return console.error('❌ #entertainmentContent not found');

  feed.innerHTML = '';

  if (items.length === 0) {
    feed.innerHTML = '<div class="text-yellow-400 text-sm">No entertainment items yet.</div>';
    return;
  }

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'border border-yellow-500 rounded-2xl overflow-hidden bg-black/70 text-yellow-300 shadow-lg';

    // Header with username
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between px-3 py-2';
    const userEl = document.createElement('div');
    userEl.className = 'text-sm font-semibold text-yellow-400';
    userEl.textContent = item.username || 'Anonymous';
    header.appendChild(userEl);
    card.appendChild(header);

    // decide if image is displayable
    const lower = item.imageUrl.toLowerCase();
    const isImage = /(\.png|\.jpg|\.jpeg|\.gif|\.webp)(\?|$)/.test(lower) || /googleusercontent|imgur|unsplash|cdn|drive.google.com/.test(lower);

    if (isImage) {
      const img = document.createElement('img');
      img.src = item.imageUrl;
      img.alt = item.caption || 'Entertainment image';
      img.className = 'w-full object-cover max-h-80';
      img.loading = 'lazy';
      card.appendChild(img);
    } else {
      const link = document.createElement('a');
      link.href = item.imageUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      link.className = 'block p-4 text-yellow-300 underline';
      link.textContent = 'Open content';
      card.appendChild(link);
    }

    if (item.caption) {
      const cap = document.createElement('div');
      cap.className = 'p-3 text-sm text-yellow-200';
      cap.textContent = item.caption;
      card.appendChild(cap);
    }

    // Actions row (icons only for now)
    const actions = document.createElement('div');
    actions.className = 'flex items-center justify-between px-3 py-2';
    const left = document.createElement('div');
    left.className = 'flex items-center gap-4';
    const likeBtn = document.createElement('button');
    likeBtn.className = 'text-yellow-400 hover:text-red-500 flex items-center gap-1';
    likeBtn.innerHTML = '<i data-lucide="heart" class="w-4 h-4"></i>';
    const commentBtn = document.createElement('button');
    commentBtn.className = 'text-yellow-400 hover:text-yellow-200 flex items-center gap-1';
    commentBtn.innerHTML = '<i data-lucide="message-circle" class="w-4 h-4"></i>';
    left.append(likeBtn, commentBtn);
    actions.append(left);
    card.appendChild(actions);

    feed.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
  console.log(`📸 Rendered ${items.length} entertainment items`);
}

function loadEntertainment() {
  // Try Apps Script JSONP first, then fall back to GViz if no callback
  window._entertainmentReceived = false;
  const url = `${window.SHEET_API_URL}?type=getEntertainment&callback=handleEntertainment`;
  console.log('🎬 Loading entertainment via JSONP:', url);
  jsonp(url);

  // Fallback to GViz after a short timeout if JSONP didn’t fire
  setTimeout(() => {
    if (!window._entertainmentReceived) {
      console.warn('⏳ JSONP not received; falling back to GViz');
      fetchEntertainmentViaGviz();
    }
  }, 1800);
}

async function fetchEntertainmentViaGviz() {
  try {
    const docId = '1aPjgxKvFXp5uaZwyitf3u3DveCfSWZKgcqrFs-jQIsw';
    const sheetName = 'entertainment';
    const url = `https://docs.google.com/spreadsheets/d/${docId}/gviz/tq?sheet=${encodeURIComponent(sheetName)}&tqx=out:json`;
    console.log('📥 Fetching Entertainment via GViz:', url);
    const txt = await fetch(url).then(r => r.text());
    const json = JSON.parse(txt.substring(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
    const rows = (json.table.rows || []).map(r => (r.c || []).map(c => (c && c.v != null ? c.v : '')));
    if (rows.length === 0) {
      console.warn('⚠️ GViz returned no rows for Entertainment');
    }
    handleEntertainment(rows);
  } catch (err) {
    console.error('❌ GViz Entertainment fetch failed:', err);
    const feed = document.getElementById('entertainmentContent');
    if (feed) feed.innerHTML = '<div class="text-yellow-400 text-sm">Failed to load entertainment. Please try again later.</div>';
  }
}

// Refresh button
document.getElementById('refreshEntertainment')?.addEventListener('click', () => {
  loadEntertainment();
});

  // ✅ Handle locked activity close button
document.getElementById('closeLockedModal')?.addEventListener('click', () => {
  document.getElementById('lockedActivityModal')?.classList.add('hidden');
});
document.getElementById('tryPremiumBtn')?.addEventListener('click', () => {
  if (localStorage.getItem('usedTryPremium')) {
    alert('⚠️ You’ve already used your free trial.');
    return;
  }

  // Store expiration and mark as used
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
  localStorage.setItem('usedTryPremium', 'true');
  localStorage.setItem('premiumTrialExpires', expiresAt.toString());
  localStorage.setItem('membershipLevel', 'premium');

  alert('✅ You now have 5 minutes of premium access. Enjoy!');
  window.location.reload();
});
  const helpBtn = document.getElementById('helpJoinBtn');
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      const modal = document.getElementById('onboardingModal');
      if (modal) {
        modal.classList.remove('hidden');
        console.log('✅ Onboarding modal opened');
      } else {
        console.warn('❌ Onboarding modal not found');
      }
    });
  } else {
    console.warn('❌ helpJoinBtn not found');
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
  const categoryIconMap = {
    cafes: '☕️',
    pubs: '🍺',
    pub: '🍺',
    events: '🎪',
    farms: '🌾',
    farm: '🌾',
    shops: '🛍️',
    shop: '🛍️',
    services: '🛠️',
    courses: '🎓',
    jobs: '💼',
    education: '📚',
    markets: '🧺'
  };

  [...categories].sort().forEach(cat => {
    const safeId = `filter-${cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';

    const icon = categoryIconMap[cat.toLowerCase()] || '📍';

    const label = document.createElement('label');
    label.className = 'group flex flex-1 items-center gap-3 rounded-xl border border-yellow-500/20 bg-black/60 px-3 py-2 text-xs text-yellow-200 transition hover:border-yellow-400';
    label.innerHTML = `
      <input id="${safeId}" type="checkbox" value="${cat}" onchange="window.handleCategoryToggle(event)" checked class="peer sr-only">
      <span class="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-500/10 text-base">${icon}</span>
      <span class="flex-1 font-medium capitalize tracking-[0.05em]">${cat}</span>
      <span class="relative inline-flex h-6 w-11 items-center rounded-full bg-yellow-500/20 transition-all duration-200 ease-out peer-checked:bg-yellow-500 peer-checked:shadow-[0_0_12px_rgba(250,204,21,0.45)]">
        <span class="inline-block h-5 w-5 translate-x-1 rounded-full bg-yellow-200 shadow-sm transition-all duration-200 ease-out peer-checked:translate-x-5 peer-checked:bg-black"></span>
      </span>
    `;

    const onlyBtn = document.createElement('button');
    onlyBtn.type = 'button';
    onlyBtn.textContent = 'Only';
    onlyBtn.className = 'text-[10px] uppercase tracking-[0.25em] text-yellow-500/80 hover:text-yellow-200 transition px-2 py-1 rounded-full border border-yellow-500/20 bg-black/40';
    onlyBtn.addEventListener('click', e => {
      e.stopPropagation();
      window.setExclusiveCategory(cat);
    });

    row.append(label, onlyBtn);
    filterBox.appendChild(row);
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
        const normalize = (s) => s
          .toLowerCase()
          .normalize('NFKD')
          .replace(/[’'`]/g, '')
          .replace(/[^\p{L}\p{N} ]+/gu, ' ')
          .replace(/\s+/g, ' ')
          .trim();

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
  title: normalize(title),
  coords,
  marker,
  feature
});


        console.log('📍 geoMarker added:', title.toLowerCase(), coords);

      });

      if (window.lucide) lucide.createIcons();

      // Optional: also populate category filters here
    });
  

  document.querySelectorAll('.closeBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal, .sidebar')?.classList.add('hidden');
      if (btn.closest('.sidebar')) {
        btn.closest('.sidebar')?.classList.add('translate-x-full');
      }
    });
  });

// Do not auto-show onboarding; only open via help button

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

      const popupHTML = `
        <div style="
          background: black;
          color: gold;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: bold;
          border: 1px solid gold;
          box-shadow: 0 0 10px gold;
        ">
          📍 Current Location
        </div>
      `;

      new mapboxgl.Marker({
        color: 'gold'
      })
        .setLngLat([longitude, latitude])
        .setPopup(new mapboxgl.Popup({ closeButton: false }).setHTML(popupHTML))
        .addTo(map)
        .togglePopup();
    });
  } else {
    alert('Geolocation is not supported by your browser.');
  }
});

  

  if (localStorage.getItem('membershipLevel')) setTimeout(() => showMemberOptions(), 0);

  // 🔍 Category Filters
  window.filterByCategory = () => {
  const checked = Array.from(document.querySelectorAll('#categoryFilters input:checked')).map(i => i.value);
  geoMarkers.forEach(({ marker, feature }) => {
    if (checked.includes((feature.properties.category || '').toString())) {
      marker.getElement().style.display = 'block';
    } else {
      marker.getElement().style.display = 'none';
    }
  });
};

// Show all markers
window.showAllLocations = () => {
  document.querySelectorAll('#categoryFilters input[type="checkbox"]').forEach(cb => {
    cb.checked = true;
  });
  geoMarkers.forEach(({ marker }) => {
    marker.getElement().style.display = 'block';
  });
};

const MEMBER_DIRECTORY_KEY = 'gr_member_directory_v1';
const normalizeMemberKey = (value = '') => value.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const getMemberDirectory = () => {
  try {
    const raw = localStorage.getItem(MEMBER_DIRECTORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (err) {
    console.warn('⚠️ Failed to read member directory', err);
    return {};
  }
};

const saveMemberDirectory = (dir) => {
  try {
    localStorage.setItem(MEMBER_DIRECTORY_KEY, JSON.stringify(dir));
  } catch (err) {
    console.warn('⚠️ Could not persist member directory', err);
  }
};

const updateMemberDirectory = (name, patch) => {
  const key = normalizeMemberKey(name);
  if (!key) return null;
  const dir = getMemberDirectory();
  const existing = dir[key] || { displayName: name };
  dir[key] = { ...existing, ...patch, displayName: existing.displayName || name };
  saveMemberDirectory(dir);
  return dir[key];
};

window.getMemberProfile = (name = '') => {
  const key = normalizeMemberKey(name);
  const directory = getMemberDirectory();
  const stored = directory[key] || {};

  const record = membershipData.find(m => {
    const byUser = m.username && normalizeMemberKey(m.username) === key;
    const byName = m.name && normalizeMemberKey(m.name) === key;
    const byEmail = m.email && normalizeMemberKey(m.email) === key;
    return byUser || byName || byEmail;
  }) || {};

  const localNameRaw = localStorage.getItem('memberName') || '';
  const currentKey = normalizeMemberKey(localNameRaw);
  let checkins = stored.checkins;
  let community = stored.community;
  let status = stored.status;

  // Treat as current user if keys match closely (email vs display name etc.)
  const localKeyBase = currentKey.split('@')[0] || currentKey;
  if (key === currentKey || key === localKeyBase || (!key && currentKey) || localKeyBase === key) {
    const localCheckins = parseInt(localStorage.getItem('checkinCount') || '0', 10);
    if (!Number.isNaN(localCheckins)) checkins = localCheckins;
    community = localStorage.getItem('memberCommunity') || community;
    status = localStorage.getItem('memberCommunityStatus') || status;
  }

  return {
    displayName: stored.displayName || name || record.username || record.name || (localNameRaw || 'Member'),
    level: (record.level || 'free').toString(),
    checkins: typeof checkins === 'number' ? checkins : (checkins ? Number(checkins) : 0),
    community: community || 'No community selected',
    status: status || 'Guest'
  };
};

const MEMBER_CARD_ID = 'activityMemberCard';
window.hideMemberCard = () => {
  const card = document.getElementById(MEMBER_CARD_ID);
  if (card) card.classList.add('hidden');
};

window.showMemberCard = (name = 'Member', anchorEl) => {
  if (!anchorEl) return;

  let card = document.getElementById(MEMBER_CARD_ID);
  if (!card) {
    card = document.createElement('div');
    card.id = MEMBER_CARD_ID;
    card.className = 'hidden pointer-events-auto rounded-2xl border border-yellow-500/40 bg-black text-yellow-100 shadow-2xl px-4 py-3 space-y-2 transition duration-150 ease-out';
    card.style.position = 'absolute';
    card.style.zIndex = '999999';
    document.body.appendChild(card);
  }

  const profile = window.getMemberProfile(name);

  card.innerHTML = `
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-[10px] uppercase tracking-[0.3em] text-yellow-500/70">Member</p>
        <h3 class="text-base font-semibold text-yellow-100" id="memberCardName">${profile.displayName}</h3>
      </div>
      <span class="rounded-full border border-yellow-500/30 px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-yellow-400" id="memberCardLevel">${profile.level}</span>
    </div>
    <div class="grid gap-2 text-xs text-yellow-200">
      <div class="flex items-center justify-between">
        <span class="text-yellow-500/80">Check-ins</span>
        <span class="font-semibold text-yellow-100" id="memberCardCheckins">${profile.checkins ?? 0}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-yellow-500/80">Community</span>
        <span class="font-semibold text-yellow-100" id="memberCardCommunity">${profile.community}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-yellow-500/80">Status</span>
        <span class="font-semibold text-yellow-100" id="memberCardStatus">${profile.status}</span>
      </div>
    </div>
  `;

  card.classList.remove('hidden');
  card.style.opacity = '0';
  card.style.transform = 'translateY(-4px)';

  requestAnimationFrame(() => {
    const anchorRect = anchorEl.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    let left = anchorRect.left + window.scrollX;
    const maxLeft = window.scrollX + window.innerWidth - cardRect.width - 16;
    if (left > maxLeft) left = maxLeft;
    if (left < window.scrollX + 16) left = window.scrollX + 16;
    const top = anchorRect.bottom + window.scrollY + 8;
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  });

  const dismiss = (ev) => {
    if (card.contains(ev.target) || anchorEl.contains(ev.target)) return;
    card.classList.add('hidden');
    document.removeEventListener('click', dismiss);
  };
  setTimeout(() => document.addEventListener('click', dismiss), 0);

  // Fetch live community/status for this user from backend and update card
  const requestedUser = name;
  const url = `${window.SHEET_API_URL}?type=getCommunity&user=${encodeURIComponent(requestedUser)}&callback=handleMemberCardCommunity`;
  window._memberCardTarget = normalizeMemberKey(requestedUser);
  jsonp(url);
};

// Callback to update the open member card with backend community/status
function handleMemberCardCommunity(resp) {
  if (!resp || !resp.success) return;
  const key = window._memberCardTarget;
  if (!key) return;
  const comm = (resp.community || '').toString();
  const status = (resp.status || '').toString();
  const cEl = document.getElementById('memberCardCommunity');
  const sEl = document.getElementById('memberCardStatus');
  if (cEl) cEl.textContent = comm || 'No community selected';
  if (sEl) sEl.textContent = status || 'Guest';
}

window.updateActivityCommunityStatus = (status, community) => {
  const statusEl = document.getElementById('communityStatus');
  const joinBtn = document.getElementById('communityJoinBtn');
  const labelEl = document.getElementById('activityCommunityLabel');
  const metaEl = document.getElementById('activityCommunityMeta');
  const cardEl = document.getElementById('activityCommunityCard');
  if (!statusEl) return;

  if (!community) {
    statusEl.textContent = 'Select a community to focus your feed.';
    if (joinBtn) joinBtn.textContent = 'Request to Join';
    cardEl?.classList.remove('hidden');
    return;
  }

  if (labelEl) {
    const name = community || 'No community selected';
    // Update button label text (second child span)
    const span = labelEl.querySelector('span');
    if (span) span.textContent = `Community: ${name}`;
  }
  if (metaEl) {
    const state = ensureHeaderState();
    state.community = community || state.community;
    // Use local estimate until backend meta arrives
    state.members = getCommunityMemberCount(state.community || '');
    renderHeaderMeta(state);
  }

  if (status === 'pending') {
    statusEl.textContent = `Request pending for ${community}…`;
    if (joinBtn) joinBtn.textContent = 'Request Pending';
  } else {
    statusEl.textContent = `You are connected to ${community}.`;
    if (joinBtn) joinBtn.textContent = 'Switch Community';
  }

  // Hide the picker once connected to a community
  cardEl?.classList.add('hidden');
};

window.requestCommunityMembership = (community) => {
  const trimmed = (community || '').trim();
  if (!trimmed) return;
  const memberName = localStorage.getItem('memberName') || 'Member';
  updateMemberDirectory(memberName, { community: trimmed, status: 'member' });
  const checkins = parseInt(localStorage.getItem('checkinCount') || '0', 10);
  if (!Number.isNaN(checkins)) updateMemberDirectory(memberName, { checkins });
  localStorage.setItem('memberCommunity', trimmed);
  localStorage.setItem('memberCommunityStatus', 'member');
  window.updateActivityCommunityStatus('member', trimmed);
  console.log(`✅ Community set to ${trimmed}`);
};

window.initCommunityPicker = () => {
  const select = document.getElementById('communityPicker');
  const joinBtn = document.getElementById('communityJoinBtn');
  if (!select || !joinBtn) return;

  const existingValues = new Set(Array.from(select.options).map(opt => opt.value));
  Array.from(new Set(COMMUNITY_OPTIONS.slice().sort((a, b) => a.localeCompare(b)))).forEach(option => {
    if (existingValues.has(option)) return;
    const opt = document.createElement('option');
    opt.value = option;
    opt.textContent = option;
    select.appendChild(opt);
  });

  const storedCommunity = localStorage.getItem('memberCommunity');
  if (storedCommunity) {
    if (!existingValues.has(storedCommunity)) {
      const opt = document.createElement('option');
      opt.value = storedCommunity;
      opt.textContent = storedCommunity;
      select.appendChild(opt);
    }
    select.value = storedCommunity;
  }

  const storedStatus = localStorage.getItem('memberCommunityStatus') || (storedCommunity ? 'member' : 'guest');
  window.updateActivityCommunityStatus(storedStatus, storedCommunity);

  joinBtn.addEventListener('click', () => {
    const choice = select.value.trim();
    if (!choice) {
      alert('Please choose a community first.');
      return;
    }
    // Persist to backend; UI will refresh via callback
    setCommunityForCurrentUser(choice, 'member');
    window.keepCommunityCardOpen = false;
  });

  // Clicking the header label jumps to the picker and highlights it
  document.getElementById('activityCommunityLabel')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.keepCommunityCardOpen = true;
    document.getElementById('activitySidebar')?.classList.remove('translate-x-full');
    const card = document.getElementById('activityCommunityCard');
    card?.classList.remove('hidden');
    card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    select.classList.add('ring', 'ring-yellow-500');
    setTimeout(() => select.classList.remove('ring', 'ring-yellow-500'), 1200);
    select.focus({ preventScroll: true });
  });

  // Also update header immediately on init so it reflects stored choice
  const initialCommunity = localStorage.getItem('memberCommunity') || '';
  const initialStatus = localStorage.getItem('memberCommunityStatus') || (initialCommunity ? 'member' : 'guest');
  window.updateActivityCommunityStatus(initialStatus, initialCommunity);
  if (initialCommunity) requestCommunityMeta(initialCommunity);

  document.getElementById('activityCommunityInfo')?.addEventListener('click', () => {
    alert('Communities help focus your activity feed on nearby members. Requests are auto-approved while moderation tools are finalized.');
  });
};

window.handleCategoryToggle = (event) => {
  const input = event.target;
  const boxes = Array.from(document.querySelectorAll('#categoryFilters input[type="checkbox"]'));

  if (!input.checked) {
    const stillChecked = boxes.filter(cb => cb !== input && cb.checked);
    if (stillChecked.length === 0) {
      input.checked = true;
      return;
    }
  }

  filterByCategory();
};

window.setExclusiveCategory = (cat) => {
  const boxes = Array.from(document.querySelectorAll('#categoryFilters input[type="checkbox"]'));
  let targetFound = false;
  boxes.forEach(cb => {
    if ((cb.value || '').toLowerCase() === cat.toLowerCase()) {
      cb.checked = true;
      targetFound = true;
    } else {
      cb.checked = false;
    }
  });

  if (targetFound) {
    filterByCategory();
  }
};

const searchInput = document.getElementById('search');
const suggestionsBox = document.getElementById('suggestions');

searchInput.addEventListener('input', async () => {
  const normalize = (s) => s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’'`]/g, '')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const query = normalize(searchInput.value || '');
  suggestionsBox.innerHTML = '';
  if (!query || geoMarkers.length === 0) {
    suggestionsBox.style.display = 'none';
    return;
  }

  const matches = geoMarkers.filter(m => m.title.includes(query)).slice(0, 5);
  console.log('🔍 Search query:', query);
  console.log('📍 Local Matches:', matches);

  if (matches.length > 0) {
    suggestionsBox.innerHTML += '<div class="text-xs text-yellow-600 px-2 py-1">🌹 Local Matches</div>';
    
    matches.forEach(m => {
      const div = document.createElement('div');
      div.className = 'suggestion-item text-sm text-yellow-400 bg-black hover:bg-yellow-500 p-2 rounded cursor-pointer';
      div.textContent = m.feature?.properties?.title || m.title;
      
      div.addEventListener('click', () => {
        console.log('🛫 Flying to:', m.coords);
        if (map && m.marker) {
          try {
            map.flyTo({ center: m.coords, zoom: 16 });
          } catch (e) {
            console.warn('flyTo failed, retrying with easeTo', e);
            map.easeTo({ center: m.coords, zoom: 16 });
          }
          setTimeout(() => {
            try { m.marker.togglePopup(); } catch(_) {}
          }, 350);
        } else {
          console.warn('⚠️ Marker or map not ready');
        }

        searchInput.value = '';
        suggestionsBox.innerHTML = '';
        suggestionsBox.style.display = 'none';
      });

      suggestionsBox.appendChild(div);
    });
  }

  // 🌍 MAPBOX GLOBAL SEARCH
  try {
    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}&autocomplete=true&limit=3`);
    const mapboxData = await res.json();

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
  } catch (err) {
    console.error('🌍 Mapbox error:', err);
  }

suggestionsBox.classList.remove('hidden');
suggestionsBox.style.display = 'block';
});

// Robust delegated click (works if individual listeners miss due to blur/focus)
const handleSuggestionActivate = async (text) => {
  const normalize = (s) => (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’'`]/g, '')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const q = normalize(text);
  if (!q) return;

  // Try local marker by best contains match
  const local = geoMarkers.filter(m => m.title.includes(q));
  if (local.length && map && local[0].marker) {
    try { map.flyTo({ center: local[0].coords, zoom: 16 }); } catch { map.easeTo({ center: local[0].coords, zoom: 16 }); }
    setTimeout(() => { try { local[0].marker.togglePopup(); } catch(_) {} }, 350);
    searchInput.value = '';
    suggestionsBox.innerHTML = '';
    suggestionsBox.style.display = 'none';
    return;
  }

  // Fallback to Mapbox lookup of the clicked text
  try {
    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?access_token=${mapboxgl.accessToken}&autocomplete=true&limit=1`);
    const data = await res.json();
    const feat = data.features?.[0];
    if (feat) {
      map.flyTo({ center: feat.center, zoom: 14 });
      searchInput.value = '';
      suggestionsBox.innerHTML = '';
      suggestionsBox.style.display = 'none';
    }
  } catch (err) {
    console.error('🌍 Mapbox delegated click error:', err);
  }
};

suggestionsBox.addEventListener('mousedown', (e) => {
  const item = e.target.closest('.suggestion-item');
  if (!item) return;
  e.preventDefault();
  e.stopPropagation();
  handleSuggestionActivate(item.textContent || '');
});

// Enter to go to best match
searchInput.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();

  const normalize = (s) => s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’'`]/g, '')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const query = normalize(searchInput.value || '');
  if (!query) return;

  // Try local marker match first
  const local = geoMarkers.filter(m => m.title.includes(query));
  if (local.length && map && local[0].marker) {
    try { map.flyTo({ center: local[0].coords, zoom: 16 }); } catch { map.easeTo({ center: local[0].coords, zoom: 16 }); }
    setTimeout(() => { try { local[0].marker.togglePopup(); } catch(_) {} }, 350);
    suggestionsBox.innerHTML = '';
    suggestionsBox.style.display = 'none';
    return;
  }

  // Fallback to Mapbox geocode best result
  try {
    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}&autocomplete=true&limit=1`);
    const data = await res.json();
    const feat = data.features?.[0];
    if (feat) {
      map.flyTo({ center: feat.center, zoom: 14 });
      suggestionsBox.innerHTML = '';
      suggestionsBox.style.display = 'none';
    }
  } catch (err) {
    console.error('🌍 Mapbox search enter fallback error:', err);
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

  // Helper to (re)load members with cache busting
  window.reloadMembershipData = async function () {
    try {
      const url = `https://docs.google.com/spreadsheets/d/1aPjgxKvFXp5uaZwyitf3u3DveCfSWZKgcqrFs-jQIsw/gviz/tq?sheet=Members&tqx=out:json&_=${Date.now()}`;
      const text = await fetch(url).then(r => r.text());
      const json = JSON.parse(text.slice(47, -2));
      const cols = (json.table.cols || []).map(c => (c.label || '').toString().trim().toLowerCase());
      const idx = {
        name: cols.indexOf('name'),
        number: cols.indexOf('number'),
        level: cols.indexOf('level'),
        email: cols.indexOf('email'),
        username: cols.indexOf('username'),
        password: cols.indexOf('password')
      };

      membershipData = (json.table.rows || [])
        .map(row => {
          const c = row.c || [];
          const get = (i) => (i >= 0 && c[i] && c[i].v != null) ? c[i].v : '';
          const rec = {
            name: get(idx.name).toString().trim().toLowerCase().replace(/\s+/g, ''),
            number: get(idx.number).toString().trim(),
            level: (get(idx.level) || 'free').toString().trim().toLowerCase(),
            email: get(idx.email).toString().trim().toLowerCase().replace(/\s+/g, ''),
            username: get(idx.username).toString().trim().toLowerCase().replace(/\s+/g, ''),
            password: get(idx.password).toString().trim()
          };
          // Skip completely empty rows
          if (!rec.name && !rec.username && !rec.email) return null;
          return rec;
        })
        .filter(Boolean);
      console.log('✅ Membership data loaded:', membershipData);
      if (submitBtn) submitBtn.disabled = false;
    } catch (err) {
      console.error('❌ Failed to fetch membership data:', err);
      alert('Could not load member list. Try again later.');
    }
  };

  // Initial load
  window.reloadMembershipData();


  loginForm.addEventListener('submit', e => {
  console.log('🟡 loginForm submitted');
  e.preventDefault();

    // Accept username OR email in the first field
    const typedName = nameInput.value.trim().toLowerCase().replace(/\s+/g, '');
    const typedNumber = numberInput.value.trim();

    console.log('🔍 Typed Name:', typedName);
    console.log('🔢 Typed Number:', typedNumber);

    // Support legacy (name+number), new (username+password), and email+password
    const match = membershipData.find(m => {
      const byLegacy = m.name && m.number && (m.name === typedName && m.number === typedNumber);
      const byUser   = m.username && m.password && (m.username === typedName && m.password === typedNumber);
      const byEmail  = m.email && m.password && (m.email === typedName && m.password === typedNumber);
      return byLegacy || byUser || byEmail;
    });

     console.log('🔎 Match found:', match);

    if (!match) {
      alert('❌ Member not found or incorrect number.');
      return;
    }

    localStorage.setItem('memberName', nameInput.value.trim());
    localStorage.setItem('membershipLevel', match.level);
    window.isPremium = match.level === 'premium';

    const displayName = nameInput.value.trim();
    alert(`🌹 Welcome back ${displayName}! (${match.level})`);
    document.getElementById('loginModal')?.classList.add('hidden');

     const username = nameInput.value.trim();
localStorage.setItem('username', username);
loadUserFavourites(username);


    showMemberOptions();
    lucide.createIcons?.();
  });
}

// ───────── SIGNUP (Modal + JSONP) ─────────
window.setupSignup = function () {
  const btn = document.getElementById('profileSignupBtn');
  const modal = document.getElementById('signupModal');
  const form = document.getElementById('signupForm');
  const email = document.getElementById('signupEmail');
  const username = document.getElementById('signupUsername');
  const password = document.getElementById('signupPassword');

  if (btn) {
    btn.addEventListener('click', () => {
      modal?.classList.remove('hidden');
    });
  }

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const em = (email?.value || '').trim();
    const un = (username?.value || '').trim();
    const pw = (password?.value || '').trim();

    if (!em || !un || !pw) {
      alert('Please complete all fields.');
      return;
    }

    const url = `${window.SHEET_API_URL}?type=signup&email=${encodeURIComponent(em)}&username=${encodeURIComponent(un)}&password=${encodeURIComponent(pw)}&callback=handleSignupResponse`;
    console.log('📤 Signup via JSONP:', url);
    jsonp(url);
  });
};

window.handleSignupResponse = function (resp) {
  if (resp && resp.success) {
    alert('✅ Account created! You can now log in.');
    document.getElementById('signupModal')?.classList.add('hidden');
    // Refresh members, then open login prefilled
    const doOpen = () => {
      const nameInput = document.getElementById('nameInput');
      const numberInput = document.getElementById('numberInput');
      if (nameInput && numberInput) {
        nameInput.value = (document.getElementById('signupUsername')?.value || '');
        numberInput.value = (document.getElementById('signupPassword')?.value || '');
      }
      document.getElementById('loginModal')?.classList.remove('hidden');
    };
    if (window.reloadMembershipData) {
      window.reloadMembershipData().then?.(doOpen) || doOpen();
    } else {
      doOpen();
    }
  } else {
    alert('❌ Could not create account.');
  }
};

// ───────── Modal Link Wiring ─────────
window.setupModalLinks = function () {
  const closeAllPanels = () => {
    // Close sidebars
    document.getElementById('marketplaceSidebar')?.classList.add('translate-x-full');
    if (!window.keepActivityOpen) {
      document.getElementById('activitySidebar')?.classList.add('translate-x-full');
    }
    document.getElementById('entertainmentSidebar')?.classList.add('translate-x-full');
    // Hide profile menu and onboarding
    document.getElementById('profileMenu')?.classList.add('hidden');
    document.getElementById('onboardingModal')?.classList.add('hidden');
    // Hide any lock overlays
    document.getElementById('lockedMarketplaceModal')?.classList.add('hidden');
    document.getElementById('lockedEntertainmentModal')?.classList.add('hidden');
    document.getElementById('lockedActivityModal')?.classList.add('hidden');
  };

  const openLogin = () => {
    closeAllPanels();
    document.getElementById('signupModal')?.classList.add('hidden');
    document.getElementById('loginModal')?.classList.remove('hidden');
  };
  const openSignup = () => {
    closeAllPanels();
    document.getElementById('loginModal')?.classList.add('hidden');
    document.getElementById('signupModal')?.classList.remove('hidden');
  };

  // Direct bindings if elements are present now
  const bind = (id, fn) => document.getElementById(id)?.addEventListener('click', (e) => { e.preventDefault(); fn(); });
  bind('marketplaceSignInBtn', openLogin);
  bind('entertainmentSignInBtn', openLogin);
  bind('activitySignInBtn', openLogin);
  bind('profileLoginBtn', openLogin);
  bind('openSignupLink', openSignup);
  bind('profileSignupBtn', openSignup);
  bind('onboardingSignupBtn', openSignup);

  // Delegated fallback for any dynamically added elements
  document.addEventListener('click', (ev) => {
    const q = (sel) => ev.target.closest(sel);
    if (q('#marketplaceSignInBtn') || q('#entertainmentSignInBtn') || q('#activitySignInBtn') || q('#profileLoginBtn')) {
      ev.preventDefault();
      openLogin();
    }
    if (q('#openSignupLink') || q('#profileSignupBtn') || q('#onboardingSignupBtn')) {
      ev.preventDefault();
      openSignup();
    }
  });

  console.log('✅ Modal links wired');
}
function showMemberOptions() {
  const name = localStorage.getItem('memberName') || 'Golden Rose Member';
  
  
  checkPremiumStatus();            // ✅ REPLACES the old line
  window.updateHelpJoinBtn();      // ✅ run based on updated status

  console.log('🧠 Show member UI for:', name, '| Premium:', window.isPremium);

  document.getElementById('memberName').textContent = `🌹 ${name}`;
  const checkins = localStorage.getItem('checkinCount') || 0;
  document.getElementById('memberMeta').textContent = `Check-ins: ${checkins}`;
  document.getElementById('memberOptions')?.classList.remove('hidden');
  document.getElementById('guestOptions')?.classList.add('hidden');

  updateMemberDirectory(name, {
    checkins: Number(checkins) || 0,
    community: localStorage.getItem('memberCommunity') || undefined,
    status: localStorage.getItem('memberCommunityStatus') || 'member'
  });

  // Sync community from backend and hide any locked overlays now that user is logged in
  fetchCommunityForCurrentUser();
  document.getElementById('lockedMarketplaceModal')?.classList.add('hidden');
  document.getElementById('lockedEntertainmentModal')?.classList.add('hidden');
  document.getElementById('lockedActivityModal')?.classList.add('hidden');
  window.ensurePostFormsVisibility?.();

  // Mark page as logged-in for CSS-based guards
  document.body.classList.add('logged-in');
}

// Utility: unified overlay state (prevents flicker)
window.isLoggedIn = function () {
  return !!(localStorage.getItem('memberName') || localStorage.getItem('membershipLevel'));
}
window.updateLockedOverlays = function () {
  const logged = window.isLoggedIn?.();
  const toggle = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (logged) el.classList.add('hidden');
    else el.classList.remove('hidden');
  };
  toggle('lockedMarketplaceModal');
  toggle('lockedEntertainmentModal');
  toggle('lockedActivityModal');
}

// Ensure post forms are usable when logged in
window.ensurePostFormsVisibility = function () {
  if (!window.isLoggedIn?.()) return;
  document.getElementById('lockedMarketplaceModal')?.classList.add('hidden');
  document.getElementById('lockedActivityModal')?.classList.add('hidden');
  ['marketplacePostForm','activityPostForm'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden');
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';
    el.style.filter = 'none';
  });
}



document.getElementById('addLocationBtn')?.addEventListener('click', () => {
  const modal = document.getElementById('addLocationModal');
  modal?.classList.toggle('hidden');
});

document.getElementById('favouritesBtn')?.addEventListener('click', () => {
  const dropdown = document.getElementById('favouritesDropdown');
  dropdown?.classList.toggle('hidden');
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

});
// Also remove logged-in body class on logout (defensive)
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  document.body.classList.remove('logged-in');
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

document.getElementById('searchButton')?.addEventListener('click', () => {
  const query = searchInput.value.trim().toLowerCase();
  searchInput.dispatchEvent(new Event('input'));
});

// Do not auto-show onboarding based on login state; keep hidden by default
const onboardingModal = document.getElementById('onboardingModal');
onboardingModal?.classList.add('hidden');
  // Close button logic
  document.getElementById('closeOnboarding')?.addEventListener('click', () => {
    onboardingModal.classList.add('hidden');
  });
}
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔥 DOM loaded');

  checkPremiumStatus();         // ✅ sets window.isPremium
  window.updateHelpJoinBtn();   // ✅ now safe to call here

  setupApp?.();
  bindUIButtons?.();
  setupLogin?.();
  bindMarketplacePostForm?.();
  window.updateLockedOverlays?.();

  document.getElementById('helpJoinBtn')?.addEventListener('click', () => {
    console.log('🎯 helpJoinBtn clicked');
    document.getElementById('onboardingModal')?.classList.remove('hidden');
  });

  // Robust delegated handlers (works even if elements render later)
  document.addEventListener('click', (ev) => {
    const q = (sel) => ev.target.closest(sel);
    if (q('#marketplaceSignInBtn') || q('#entertainmentSignInBtn') || q('#profileLoginBtn')) {
      ev.preventDefault();
      console.log('🔐 Open Login click detected');
      document.getElementById('signupModal')?.classList.add('hidden');
      document.getElementById('loginModal')?.classList.remove('hidden');
    }
    if (q('#openSignupLink') || q('#profileSignupBtn')) {
      ev.preventDefault();
      console.log('🆕 Open Signup click detected');
      document.getElementById('loginModal')?.classList.add('hidden');
      document.getElementById('signupModal')?.classList.remove('hidden');
    }
  });

  // Defensive: also bind direct listeners if present
  const bind = (id, fn) => document.getElementById(id)?.addEventListener('click', (e) => { e.preventDefault(); fn(); });
  const openLogin = () => {
    document.getElementById('signupModal')?.classList.add('hidden');
    document.getElementById('loginModal')?.classList.remove('hidden');
  };
  const openSignup = () => {
    document.getElementById('loginModal')?.classList.add('hidden');
    document.getElementById('signupModal')?.classList.remove('hidden');
  };
  bind('marketplaceSignInBtn', openLogin);
  bind('entertainmentSignInBtn', openLogin);
  bind('profileLoginBtn', openLogin);
  bind('openSignupLink', openSignup);
  bind('profileSignupBtn', openSignup);
});
