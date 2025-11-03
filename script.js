console.log("✅ Script loaded");

let map;
let geoMarkers = [];
let membershipData = [];
let originalGeoData = null;
// Enable Favourites/Add Location triggers
window._disableFavAdd = false;
// Simple in-memory timestamps for rate limiting
const _rate = { posts: 0, requests: 0, feedback: 0, submission: 0 };

window.SHEET_API_URL = window.SHEET_API_URL || 'https://script.google.com/macros/s/AKfycbyIqpE0QffyefE_zybPLTVMOOoDeA7snugUDJWbnUBR1SmeBRSWXHLbpcRLaTPJrdUKBA/exec';
window.isPremium = false;
const THEME_KEY = 'appTheme';
const BADGE_DEFS = [
  { id: 'trailblazer', label: 'Trailblazer', icon: 'sparkles', test: (s) => s.posts >= 1 },
  { id: 'community-voice', label: 'Community Voice', icon: 'megaphone', test: (s) => s.posts >= 5 },
  { id: 'conversationalist', label: 'Conversationalist', icon: 'message-circle', test: (s) => s.comments >= 1 },
];

// Admin panel data sources
const ADMIN_SHEET_ID = '1aPjgxKvFXp5uaZwyitf3u3DveCfSWZKgcqrFs-jQIsw';
const ADMIN_MEMBERS_GID = '1135863289';

function parseGvizResponse(text) {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('Invalid gviz payload');
    const json = JSON.parse(text.slice(start, end + 1));
    return json;
  } catch (e) {
    console.warn('Failed to parse gviz response', e);
    return null;
  }
}

async function fetchAdminMembers() {
  const url = `https://docs.google.com/spreadsheets/d/${ADMIN_SHEET_ID}/gviz/tq?gid=${ADMIN_MEMBERS_GID}&tqx=out:json`;
  const res = await fetch(url, { cache: 'no-store' });
  const txt = await res.text();
  const data = parseGvizResponse(txt);
  if (!data || !data.table) return [];
  const cols = (data.table.cols || []).map(c => (c.label || '').toString().trim());
  const lc = cols.map(c => c.toLowerCase());
  const idxUser = lc.findIndex(c => c.includes('user'));
  const idxCommunity = lc.findIndex(c => c === 'community' || (c.includes('community') && !c.includes('status')));
  const idxLast = lc.findIndex(c => c.replace(/\s+/g,'') === 'laststreakday');
  const rows = (data.table.rows || []).map(r => r.c || []);
  const out = [];
  for (const r of rows) {
    const u = r[idxUser]?.v ?? r[0]?.v ?? '';
    const c = r[idxCommunity]?.v ?? '';
    const last = idxLast >= 0 ? (r[idxLast]?.v ?? r[idxLast]?.f ?? '') : '';
    if (!u && !c && !last) continue;
    out.push({ username: (u || '').toString(), community: (c || '').toString(), lastActive: (last || '').toString() });
  }
  // Drop possible header row duplicates
  return out.filter(x => (x.username || '').toLowerCase() !== 'username');
}

window.updateAdminUI = function updateAdminUI() {
  const role = (localStorage.getItem('memberCommunityStatus') || '').toString().trim().toLowerCase();
  const btn = document.getElementById('adminPanelBtn');
  if (btn) btn.classList.toggle('hidden', role !== 'admin');
};

window.openAdminPanel = async function openAdminPanel() {
  const role = (localStorage.getItem('memberCommunityStatus') || '').toLowerCase();
  if (role !== 'admin') return;
  const modal = document.getElementById('adminPanel');
  if (!modal) return;
  document.getElementById('profileMenu')?.classList.add('hidden');
  // Hide FAB selector while admin panel is open
  document.getElementById('floatingLocateBtn')?.classList.add('hidden');
  modal.classList.remove('hidden');

  const meta = document.getElementById('adminMembersMeta');
  const body = document.getElementById('adminMembersBody');
  if (meta) meta.textContent = 'Loading…';
  if (body) body.innerHTML = '<tr><td class="px-4 py-3 text-yellow-400" colspan="3">Loading members…</td></tr>';

  try {
    const list = await fetchAdminMembers();
    if (meta) meta.textContent = `${list.length} rows`;
    if (body) {
      if (!list.length) {
        body.innerHTML = '<tr><td class="px-4 py-3 text-yellow-400" colspan="3">No data</td></tr>';
      } else {
        const fmt = (s) => {
          const str = (s || '').toString().trim();
          if (!str) return '';
          const t = Date.parse(str);
          if (!isNaN(t)) {
            const d = new Date(t);
            const dd = String(d.getDate()).padStart(2,'0');
            const mm = String(d.getMonth()+1).padStart(2,'0');
            const yy = String(d.getFullYear()).slice(-2);
            return `${dd}/${mm}/${yy}`;
          }
          // Try to coerce YYYY-MM-DD style without timezone
          const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (m) return `${m[3]}/${m[2]}/${m[1].slice(-2)}`;
          return str;
        };
        body.innerHTML = list.map(({ username, community, lastActive }) => `
          <tr class="hover:bg-yellow-500/5">
            <td class="px-4 py-2">
              <button type="button" class="admin-user-link text-left text-yellow-100 hover:underline" data-username="${(username||'').toString().replace(/"/g,'&quot;')}">${(username || '').toString()}</button>
            </td>
            <td class="px-4 py-2 text-yellow-300">${(community || '').toString()}</td>
            <td class="px-4 py-2 text-yellow-200">${fmt(lastActive)}</td>
          </tr>
        `).join('');
        // Bind username click → show member card
        body.querySelectorAll('.admin-user-link').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const uname = e.currentTarget.getAttribute('data-username') || '';
            if (!uname) return;
            try { window.showMemberCard(uname, e.currentTarget); } catch (err) { console.warn('member card error', err); }
          });
        });
      }
    }
  } catch (e) {
    console.warn('Admin members fetch failed', e);
    if (meta) meta.textContent = 'Error loading';
    if (body) body.innerHTML = '<tr><td class="px-4 py-3 text-red-400" colspan="2">Failed to load members</td></tr>';
  }

  try { window.lucide?.createIcons?.(); } catch {}
};

// Fallback categories for forms before map data loads
const DEFAULT_CATEGORIES = ['cafes','pubs','events','reports','farms','shops','services','courses','jobs','education','markets'];

// Details for the special verified Tablehurst Farm pin
const TABLEHURST_DETAILS = {
  website: 'https://tablehurstfarm.org.uk/',
  image: 'https://forestrow.co/wp-content/uploads/2024/02/Tablehurst-Farm-Forest-Row.jpeg',
  description: 'Community-owned biodynamic farm, butchery & café in the heart of Forest Row.',
  hours: 'Farm shop: Mon–Sat 9am–5pm'
};

// Details for verified Trade Price Autos (East Grinstead)
const TRADEPRICE_DETAILS = {
  website: 'https://tradepriceautos.co.uk/',
  image: 'media/trade price autos shop.webp',
  description: 'Independent car dealer on East Grinstead High Street.',
  hours: 'Hours vary — check online or call'
};

window.applyTheme = function(theme) {
  const normalized = theme === 'light' ? 'light' : 'dark';
  document.body.classList.remove('theme-light', 'theme-dark');
  document.body.classList.add(`theme-${normalized}`);
  localStorage.setItem(THEME_KEY, normalized);
  updateThemeButtonLabels(normalized);
  // Keep FAB theme icon in sync
  try { updateFabThemeIcon?.(normalized); } catch (_) {}
  // Update FAQ bubble readability
  try { updateFaqTheme?.(normalized); } catch (_) {}
  // Update browser theme color to remove white status bar on iOS
  try {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    // Force dark status bar to avoid the white top bar look on iOS
    meta.setAttribute('content', '#000000');
  } catch {}
};

window.toggleTheme = function () {
  const current = localStorage.getItem(THEME_KEY) || 'dark';
  window.applyTheme(current === 'light' ? 'dark' : 'light');
};

function updateThemeButtonLabels(theme) {
  const buttons = document.querySelectorAll('#themeToggleBtn, #themeToggleBtnGuest');
  const label = theme === 'light' ? 'Dark Mode' : 'Light Mode';
  const icon = theme === 'light' ? 'moon-star' : 'sun';
  buttons.forEach(btn => {
    if (!btn) return;
    btn.innerHTML = `<i data-lucide="${icon}"></i> ${label}`;
  });
  window.lucide?.createIcons?.();
}

window.initTheme = function () {
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  window.applyTheme(saved);
};

window.initTheme();

// Early defensive stubs for the Filter panel so the bottom‑nav button always works,
// even before later helpers are defined further down the file.
if (typeof window.openFilterPanel !== 'function') {
  window.openFilterPanel = function () {
    try {
      let panel = document.getElementById('filterPanel');
      if (!panel) {
        // Minimal fallback build if component not present yet
        panel = document.createElement('div');
        panel.id = 'filterPanel';
        panel.style.cssText = 'position:fixed;left:16px;bottom:112px;z-index:100500;width:288px;min-width:288px;pointer-events:auto;';
        panel.innerHTML = '<div class="rounded-2xl border border-yellow-500/50 bg-black/90 px-4 py-5 text-yellow-200">\n  <div class="flex items-start justify-between mb-3">\n    <h2 class="text-lg font-semibold text-yellow-100">Filters</h2>\n    <button id="closeFilterPanel" type="button" class="flex h-7 w-7 items-center justify-center rounded-full border border-yellow-500/40 text-yellow-300">×</button>\n  </div>\n  <div id="categoryFilters" class="max-h-44 overflow-y-auto pr-1 mb-4 space-y-2"></div>\n  <button onclick="filterByCategory()" class="w-full inline-flex items-center justify-center gap-2 rounded-full bg-yellow-500 px-4 py-2 text-sm font-semibold text-black">Apply</button>\n</div>';
        document.body.appendChild(panel);
        try { window.populateCategoryFilters?.(); } catch {}
      }
      panel.classList.remove('hidden');
      panel.style.display = 'block';
      panel.style.opacity = '1';
      panel.style.pointerEvents = 'auto';
      panel.style.position = 'fixed';
      panel.style.left = '16px';
      panel.style.bottom = '112px';
      panel.style.zIndex = '100500';
    } catch {}
  };
}
if (typeof window.toggleFilterPanel !== 'function') {
  window.toggleFilterPanel = function () {
    const p = document.getElementById('filterPanel');
    if (!p) { window.openFilterPanel(); return; }
    const hidden = p.classList.contains('hidden') || p.style.display === 'none';
    if (hidden) window.openFilterPanel();
    else { p.classList.add('hidden'); p.style.display = 'none'; p.style.opacity = '0'; p.style.pointerEvents = 'none'; }
  };
}

// ─────────── FAQ Panel (pre-made Q&A) ───────────
const FAQ_QA = [
  { id: 'what', q: 'What is The Golden Rose?', a: 'A grassroots, people-powered network: Map, Marketplace, Community, and Entertainment — no algorithms, no censorship.' },
  { id: 'how-post', q: 'How do I add a place?', a: 'Tap the floating + (in the multi-button picker). Fill the form with a name and category, then submit for review.' },
  { id: 'verify', q: 'How do I get verified?', a: 'Open the Onboarding panel and tap “Apply for Verification”, or use the Verification button where shown. We review and get back to you.' },
  { id: 'filters', q: 'Where are map filters?', a: 'Tap the filter icon in the search bar. You can toggle categories and then Apply.' },
  { id: 'theme', q: 'How to switch theme?', a: 'Open the multi-button picker (corner nub) and tap the sun/moon icon.' },
  { id: 'contact', q: 'How can I send feedback?', a: 'Use the Feedback option in modals, or look for the “?” help badge in key panels to learn more and contact us.' },
];

function q(id) { return document.getElementById(id); }

function appendFaqMessage(sender, text) {
  const chat = q('faqChat');
  if (!chat) return;
  const wrap = document.createElement('div');
  const isUser = sender === 'user';
  wrap.className = `flex ${isUser ? 'justify-end' : 'justify-start'} w-full`;
  const bubble = document.createElement('div');
  bubble.className = `max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-snug border ${isUser ? 'bg-yellow-500 text-black border-yellow-600' : 'bg-zinc-900/80 text-yellow-200 border-yellow-700/40'}`;
  bubble.textContent = text;
  bubble.setAttribute('data-sender', isUser ? 'user' : 'bot');
  // Light theme readability for bot bubbles
  try {
    const theme = (localStorage.getItem(THEME_KEY) || 'dark');
    if (!isUser && theme === 'light') {
      bubble.style.background = '#fff7db';   // soft cream
      bubble.style.color = '#2f1b00';        // dark text
      bubble.style.border = '1px solid #eab308';
    }
  } catch {}
  wrap.appendChild(bubble);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

function updateFaqTheme(theme) {
  const chat = q('faqChat');
  if (!chat) return;
  const botBubbles = chat.querySelectorAll('[data-sender="bot"]');
  botBubbles.forEach(b => {
    if (theme === 'light') {
      b.style.background = '#fff7db';
      b.style.color = '#2f1b00';
      b.style.border = '1px solid #eab308';
    } else {
      b.style.background = '';
      b.style.color = '';
      b.style.border = '';
    }
  });
}

function renderFaqQuestions() {
  const ctr = q('faqQuestions');
  if (!ctr) return;
  // Only render once
  if (ctr.childElementCount === 0) {
    FAQ_QA.forEach(({ id, q }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-faq-id', id);
      btn.className = 'text-left text-[12px] px-2 py-2 rounded-lg border border-yellow-500/40 bg-black hover:bg-yellow-500 hover:text-black text-yellow-300 transition';
      btn.textContent = q;
      ctr.appendChild(btn);
    });
  }
}

function faqWelcomeIfEmpty() {
  const chat = q('faqChat');
  if (!chat) return;
  if (chat.childElementCount === 0) {
    appendFaqMessage('bot', 'Hi! Choose a question below to get a quick answer.');
  }
}

window.openFaqPanel = function openFaqPanel() {
  let panel = q('faqPanel');
  if (!panel) {
    // Build panel on-demand if missing (e.g., if modals.html not loaded on this page)
    panel = document.createElement('div');
    panel.id = 'faqPanel';
    panel.className = 'fixed bottom-24 right-4 z-[9999] w-80 max-h-[70vh] bg-black/90 backdrop-blur-md border border-yellow-500/50 rounded-2xl shadow-xl p-3 text-yellow-200 flex flex-col';
    panel.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-full border border-yellow-500/60 bg-black text-yellow-300 flex items-center justify-center text-[12px]">?</div>
          <h3 class="text-sm font-semibold">FAQ & Help</h3>
        </div>
        <div class="flex items-center gap-2">
          <button id="faqClearBtn" type="button" class="text-[11px] px-2 py-1 rounded-full border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500 hover:text-black">Clear</button>
          <button id="faqCloseBtn" type="button" class="flex h-7 w-7 items-center justify-center rounded-full border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500 hover:text-black"><i data-lucide="x"></i></button>
        </div>
      </div>
      <div id="faqChat" class="flex-1 overflow-y-auto space-y-2 p-1 mt-1"></div>
      <div class="mt-2 border-t border-yellow-500/30 pt-2">
        <div class="text-[11px] uppercase tracking-[0.2em] text-yellow-500/80 mb-1">Questions</div>
        <div id="faqQuestions" class="grid grid-cols-2 gap-2"></div>
      </div>
      <div class="mt-2 text-[10px] text-yellow-500/70">Tap a question to see an answer.</div>
    `;
    document.body.appendChild(panel);
    // Ensure very high stacking so it's never hidden
    panel.style.zIndex = '100300';
    panel.style.position = 'fixed';
    panel.style.right = panel.style.right || '1rem';
    panel.style.bottom = panel.style.bottom || '8rem';
    // Wire controls now that elements exist
    panel.querySelector('#faqCloseBtn')?.addEventListener('click', () => closeFaqPanel());
    panel.querySelector('#faqClearBtn')?.addEventListener('click', () => clearFaqChat());
    panel.querySelector('#faqQuestions')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-faq-id]');
      if (!btn) return;
      const id = btn.getAttribute('data-faq-id');
      const item = FAQ_QA.find(x => x.id === id);
      if (!item) return;
      appendFaqMessage('user', item.q);
      setTimeout(() => appendFaqMessage('bot', item.a), 200);
    });
    if (window.lucide?.createIcons) window.lucide.createIcons();
  }
  console.log('🟡 Opening FAQ panel');
  panel.style.zIndex = '100500';
  panel.style.display = 'block';
  panel.style.opacity = '1';
  panel.style.pointerEvents = 'auto';
  panel.style.visibility = 'visible';
  panel.classList.remove('hidden');
  // If layout collapses for any reason, enforce minimum size/position
  setTimeout(() => {
    try {
      const r = panel.getBoundingClientRect();
      if (!r.width || !r.height) {
        panel.style.minWidth = '320px';
        panel.style.minHeight = '200px';
        panel.style.right = '16px';
        panel.style.bottom = '112px';
      }
    } catch {}
  }, 0);
  renderFaqQuestions();
  faqWelcomeIfEmpty();
};

window.closeFaqPanel = function closeFaqPanel() {
  q('faqPanel')?.classList.add('hidden');
};

window.clearFaqChat = function clearFaqChat() {
  const chat = q('faqChat');
  if (!chat) return;
  chat.innerHTML = '';
  faqWelcomeIfEmpty();
};

// Bind FAQ controls (in case they exist on load)
setTimeout(() => {
  q('faqCloseBtn')?.addEventListener('click', () => closeFaqPanel());
  q('faqClearBtn')?.addEventListener('click', () => clearFaqChat());
  q('faqQuestions')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-faq-id]');
    if (!btn) return;
    const id = btn.getAttribute('data-faq-id');
    const item = FAQ_QA.find(x => x.id === id);
    if (!item) return;
    appendFaqMessage('user', item.q);
    setTimeout(() => appendFaqMessage('bot', item.a), 250);
  });
}, 0);

// ─────────── FAB MULTI‑PICKER (Locate/Add/Theme) ───────────
const FabState = { action: 'locate' };
// Tracks intent across crosshair flow (e.g., 'event' or 'report')
window._pinIntent = null;

function updateFabMainIcon(icon) {
  const holder = document.getElementById('fabMainIcon');
  if (!holder) return;
  if (icon === '__faq__') {
    holder.innerHTML = `<span class="fab-icon" style="display:inline-flex;align-items:center;justify-content:center;width:1.5em;height:1.5em;border-radius:9999px;background:#fff;color:#000;font-weight:700;border:2px solid #eab308;">?</span>`;
  } else {
    holder.innerHTML = `<i data-lucide="${icon}"></i>`;
    if (window.lucide?.createIcons) window.lucide.createIcons();
  }
}

function updateFabThemeIcon(theme) {
  const themeBtn = document.querySelector('#fabMenu [data-action="theme"]');
  if (themeBtn) {
    const icon = theme === 'light' ? 'moon-star' : 'sun';
    themeBtn.innerHTML = `<span class=\"fab-icon\"><i data-lucide=\"${icon}\"></i></span>`;
    if (window.lucide?.createIcons) window.lucide.createIcons();
  }
  if (FabState.action === 'theme') {
    updateFabMainIcon((theme === 'light') ? 'moon-star' : 'sun');
  }
}

function setFabAction(action) {
  FabState.action = action;
  let icon = 'crosshair';
  if (action === 'add') icon = 'plus';
  if (action === 'faq') icon = '__faq__';
  if (action === 'event') icon = 'calendar-plus';
  if (action === 'report') icon = 'flag';
  if (action === 'theme') {
    const theme = localStorage.getItem(THEME_KEY) || 'dark';
    icon = (theme === 'light') ? 'moon-star' : 'sun';
  }
  updateFabMainIcon(icon);
  refreshFabMenuVisibility();
}

  function doFabAction() {
    switch (FabState.action) {
      case 'add': {
        // Crosshair placement; confirm opens Add Location modal
        try {
          // Close any open overlays to avoid focus conflicts
          document.getElementById('profileMenu')?.classList.add('hidden');
          document.getElementById('requestModal')?.classList.add('hidden');
          document.getElementById('feedbackModal')?.classList.add('hidden');
          window._pinIntent = null;
          Crosshair.enter();
        } catch (_) {
          // Fallback: open the add modal directly
          window.forceShowAddLocation?.();
          forceShowModal('submissionModal');
          forceShowModal('addLocationModal');
        }
        break;
      }
      case 'event': {
        // Crosshair with event intent; confirm pre-fills category to events
        try {
          document.getElementById('profileMenu')?.classList.add('hidden');
          window._pinIntent = 'event';
          Crosshair.enter();
        } catch (_) {
          window._pinIntent = 'event';
          window.forceShowAddLocation?.();
          setTimeout(() => prefillCategoryForIntent('event'), 0);
        }
        break;
      }
      case 'report': {
        // Crosshair with report intent; confirm pre-fills category to reports
        try {
          document.getElementById('profileMenu')?.classList.add('hidden');
          window._pinIntent = 'report';
          Crosshair.enter();
        } catch (_) {
          window._pinIntent = 'report';
          window.forceShowAddLocation?.();
          setTimeout(() => prefillCategoryForIntent('report'), 0);
        }
        break;
      }
      case 'theme':
      window.toggleTheme?.();
      break;
    case 'faq':
      // Open FAQ panel exclusively and assert visibility
      try {
        if (!document.getElementById('faqPanel')) window.openFaqPanel?.();
        openModalExclusive('faqPanel');
        forceShowModal('faqPanel');
      } catch (_) { try { window.openFaqPanel?.(); forceShowModal('faqPanel'); } catch {} }
      break;
    case 'locate':
    default: {
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
          new mapboxgl.Marker({ color: 'gold' })
            .setLngLat([longitude, latitude])
            .setPopup(new mapboxgl.Popup({ closeButton: false }).setHTML(popupHTML))
            .addTo(map)
            .togglePopup();
        });
      } else {
        alert('Geolocation is not supported by your browser.');
      }
    }
  }
}

  function initFabMultiPicker() {
  const container = document.getElementById('floatingLocateBtn');
  const main = document.getElementById('fabMain');
  const corner = document.getElementById('fabCorner');
  const menu = document.getElementById('fabMenu');
  if (!container || !main || !corner || !menu) {
    console.warn('FAB not initialized: missing element', { container: !!container, main: !!main, corner: !!corner, menu: !!menu });
    return;
  }

  // Ensure visible by default
  container.style.display = 'flex';

  // Default
  setFabAction('locate');
  updateFabThemeIcon(localStorage.getItem(THEME_KEY) || 'dark');
  refreshFabMenuVisibility();

  // Suppress accidental main click-through after a menu tap (iOS under-finger retarget)
  // Use a global guard and pointer-events disable for robustness across rebinds
  window._fabGuardUntil = window._fabGuardUntil || 0;
  const closeMenu = () => { console.log('FAB: closeMenu()'); menu.classList.add('hidden'); };
  const toggleMenu = () => {
    menu.classList.toggle('hidden');
    const opened = !menu.classList.contains('hidden');
    console.log('FAB: toggleMenu()', opened ? 'opened' : 'closed');
    try {
      const hj = document.getElementById('helpJoinBtn');
      if (hj) hj.style.display = opened ? 'none' : '';
    } catch {}
  };

  main.addEventListener('click', (e) => {
    // ignore clicks on the corner nub inside
    if (e.target && (e.target.id === 'fabCorner' || e.target.closest('#fabCorner'))) return;
    if (Date.now() < (window._fabGuardUntil || 0)) { console.log('FAB: main click suppressed'); return; }
    console.log('FAB: main clicked; action =', FabState.action);
    doFabAction();
  });

  corner.addEventListener('click', (e) => {
    e.stopPropagation();
    console.log('FAB: corner nub clicked');
    toggleMenu();
  });

  // Menu item selection: PERFORM the action immediately, and also set as default icon
  menu.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      try { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); } catch {}
      const action = btn.getAttribute('data-action');
      if (action === 'slot3' || action === 'slot4') return; // reserved
      console.log('FAB: menu action clicked →', action);
      // Minimal guard to avoid immediate main click; no global blockers
      window._fabGuardUntil = Date.now() + 150;
      try { main.style.pointerEvents = 'none'; setTimeout(() => { try { main.style.pointerEvents = ''; } catch(_){} }, 180); } catch {}
      if (action === 'faq') {
        setFabAction('faq');
        try {
          window.openFaqPanel?.();
          setTimeout(() => {
            const p = document.getElementById('faqPanel');
            if (p) { p.classList.remove('hidden'); p.style.display = 'block'; p.style.opacity = '1'; p.style.pointerEvents = 'auto'; p.style.zIndex = '100700'; }
          }, 0);
        } catch {}
        setTimeout(closeMenu, 10);
        return;
      }
      if (action === 'theme') {
        setFabAction('theme');
        try { window.toggleTheme?.(); } catch {}
        setTimeout(closeMenu, 10);
        return;
      }
      setFabAction(action);
      try { doFabAction(); } catch (err) { console.warn('FAB: doFabAction failed', err); }
      setTimeout(closeMenu, 10);
    });
  });

  // Click outside closes menu
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) closeMenu();
  });

  // As a safety, make sure icons render
  if (window.lucide?.createIcons) window.lucide.createIcons();

  console.log('✅ FAB initialized');
}

// Populate category selects in Add Location forms using map-derived categories
window.populateCategorySelects = function () {
  const cats = Array.from(new Set([...(DEFAULT_CATEGORIES || []), ...((window.mapCategories && window.mapCategories.length) ? window.mapCategories : [])]));
  if (!cats.length) return;
  const fill = (sel) => {
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="" disabled selected>Select category…</option>'
      + cats.map(c => `<option value="${c}">${c}</option>`).join('');
    if (current && cats.includes(current)) sel.value = current;
  };
  fill(document.getElementById('locationCoords'));
  fill(document.getElementById('locationCategory'));
};

function prefillCategoryForIntent(intent) {
  if (!intent) return;
  const cat = intent === 'event' ? 'events' : (intent === 'report' ? 'reports' : '');
  if (!cat) return;
  try { window.populateCategorySelects?.(); } catch {}
  const selA = document.getElementById('locationCoords');
  const selB = document.getElementById('locationCategory');
  if (selA) selA.value = cat;
  if (selB) selB.value = cat;
}

function refreshFabMenuVisibility() {
  const menu = document.getElementById('fabMenu');
  if (!menu) return;
  const current = FabState.action;
  menu.querySelectorAll('button[data-action]').forEach(btn => {
    const a = btn.getAttribute('data-action');
    // Hide the item that matches current main action; show others
    btn.style.display = (a === current) ? 'none' : 'flex';
  });
}

// ─────────── Crosshair Pin Placement ───────────
const Crosshair = {
  active: false,
  el: null,
  info: null,
  _onMove: null,
  init() {
    if (this.el) return;
    const wrap = document.createElement('div');
    wrap.id = 'pinCrosshair';
  // Ensure crosshair overlay sits above bottom nav and sidebars
  wrap.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:100300;display:none;';
    wrap.innerHTML = `
      <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;">
        <div style="width:18px;height:18px;border-radius:50%;border:2px solid #facc15;box-shadow:0 0 10px rgba(250,204,21,.6);"></div>
        <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:2px;height:26px;background:#facc15;opacity:.65"></div>
        <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(90deg);width:2px;height:26px;background:#facc15;opacity:.65"></div>
      </div>
      <div id="pinControls" style="position:absolute;right:16px;bottom:92px;pointer-events:auto;display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
        <div id="pinReadout" style="font:12px/1.2 Inter,system-ui;margin-bottom:6px;color:#facc15;text-align:right;background:rgba(0,0,0,.55);border:1px solid rgba(234,179,8,.5);padding:4px 8px;border-radius:8px;backdrop-filter:blur(2px);"></div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button id="pinConfirm" style="width:42px;height:42px;border-radius:9999px;border:2px solid #eab308;background:#fff;color:#000;box-shadow:0 2px 8px rgba(0,0,0,.35);font-weight:700;">✓</button>
          <button id="pinCancel"  style="width:38px;height:38px;border-radius:9999px;border:1px solid #eab308;background:#111;color:#facc15;box-shadow:0 2px 6px rgba(0,0,0,.25);">×</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    this.el = wrap;
    this.info = wrap.querySelector('#pinReadout');
    const onConfirm = (e) => { try { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); } catch(_) {} this.confirm(); };
    const onCancel  = (e) => { try { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); } catch(_) {} this.exit(); };
    wrap.querySelector('#pinConfirm').addEventListener('click', onConfirm);
    wrap.querySelector('#pinCancel').addEventListener('click', onCancel);
  },
  enter() {
    this.init();
    if (!window.map) return alert('Map not ready yet.');
    this.active = true;
    this.el.style.display = 'block';
    this.tick();
    this._onMove = () => this.tick();
    try { map.on('move', this._onMove); } catch {}
  },
  exit() {
    this.active = false;
    if (this.el) this.el.style.display = 'none';
    if (this._onMove) { try { map.off('move', this._onMove); } catch {} }
    this._onMove = null;
  },
  tick() {
    try {
      const c = map.getCenter();
      if (this.info) this.info.textContent = `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)} — Move the map, then ✓`;
    } catch {}
  },
  confirm() {
    try {
      const c = map.getCenter();
      window._pendingPin = { lat: c.lat, lng: c.lng };
    } catch { window._pendingPin = null; }
    this.exit();
    // Immediate visual feedback: place a temporary marker now
    try {
      const pin = window._pendingPin;
      if (pin && typeof pin.lat === 'number' && typeof pin.lng === 'number') {
        addLocationToMapImmediate({
          title: 'New Location',
          description: 'Pending details…',
          category: (window._pinIntent === 'event' ? 'events' : (window._pinIntent === 'report' ? 'reports' : 'General')),
          lat: pin.lat,
          lng: pin.lng
        });
      }
    } catch {}
    // Open the Add Location modal for title/details (exclusive + force-show)
    try {
      const preferSubmission = !!document.getElementById('submissionModal');
      if (preferSubmission) {
        openModalExclusive('submissionModal');
        forceShowModal('submissionModal');
      } else {
        window.forceShowAddLocation?.();
        forceShowModal('addLocationModal');
      }
      // Prefill category (events/reports) if intent is set and focus the input
      setTimeout(() => {
        try { prefillCategoryForIntent(window._pinIntent); } catch {}
        const m = document.getElementById('submissionModal') || document.getElementById('addLocationModal');
        try { (m?.querySelector('#locationName') || m?.querySelector('#locationTitle'))?.focus(); } catch {}
      }, 0);
      // Safety: if still hidden after a moment, assert visibility again
      setTimeout(() => {
        const m = document.getElementById('submissionModal') || document.getElementById('addLocationModal');
        if (!m) return;
        const hidden = m.classList.contains('hidden') || m.style.display === 'none';
        if (hidden) {
          if (m.id === 'submissionModal') openModalExclusive('submissionModal');
          else openModalExclusive('addLocationModal');
          forceShowModal(m.id);
        }
      }, 120);
    } catch {}
  }
};

window.openDirections = function(lat, lon, title) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&destination_place_id=`;
  window.open(url, '_blank');
};

function normalizeUserName(name = '') {
  return name.toString().trim().toLowerCase();
}

function isCurrentUser(name = '') {
  const saved = localStorage.getItem('memberName') || '';
  const email = saved.toLowerCase();
  const normSaved = normalizeUserName(saved);
  const normName = normalizeUserName(name);
  return normName === normSaved || (email && normName && email.startsWith(normName)) || normName === email;
}

function buildActivityStats(posts = []) {
  const stats = {};
  posts.forEach(post => {
    const user = post.username || 'Anonymous';
    const key = normalizeUserName(user);
    if (!stats[key]) stats[key] = { user, posts: 0, comments: 0 };
    stats[key].posts++;

    let comments = [];
    try {
      comments = post.comments ? JSON.parse(post.comments) : [];
    } catch (_) {
      comments = [];
    }
    comments.forEach(c => {
      const commenter = c.user || 'Anonymous';
      const cKey = normalizeUserName(commenter);
      if (!stats[cKey]) stats[cKey] = { user: commenter, posts: 0, comments: 0 };
      stats[cKey].comments++;
    });
  });
  return stats;
}

function determineBadgesForUser(user, stat) {
  const badges = [];
  BADGE_DEFS.forEach(def => {
    if (def.test(stat)) badges.push(def);
  });
  // Removed Premium and location badges for a cleaner look
  return badges;
}

function getActivityBadgesForUser(name = '') {
  const stats = window.activityStats || {};
  const stat = stats[normalizeUserName(name)] || { user: name, posts: 0, comments: 0 };
  return determineBadgesForUser(name, stat);
}

function renderBadgeChips(name, container) {
  if (!container) return;
  const badges = getActivityBadgesForUser(name);
  container.innerHTML = badges.map(b => `<span class="badge-chip"><i data-lucide="${b.icon}"></i> ${b.label}</span>`).join('');
  window.lucide?.createIcons?.();
}
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
  // East Sussex focus
  'Crowborough','Forest Row','East Grinstead','Uckfield','Lewes','Eastbourne','Hastings','Bexhill','Hailsham','Polegate','Seaford','Newhaven','Peacehaven','Rye','Battle','Heathfield','Wadhurst','Robertsbridge','Ringmer','Plumpton','Hove','Brighton',
  // Major UK cities
  'London','Birmingham','Manchester','Leeds','Liverpool','Bristol','Newcastle','Edinburgh','Glasgow','Cardiff','Belfast','Nottingham','Sheffield','Leicester','Cambridge','Oxford'
];
const COMMUNITY_META = {
  // Keep correct county for EG; others set to East Sussex
  'Crowborough':    { members: 420, county: 'East Sussex', mp: '—' },
  'Forest Row':     { members: 137, county: 'East Sussex', mp: 'Mims Davies' },
  'East Grinstead': { members: 214, county: 'West Sussex', mp: 'Mims Davies' },
  'Uckfield':       { members: 260, county: 'East Sussex', mp: 'Mims Davies' },
  'Lewes':          { members: 390, county: 'East Sussex', mp: '—' },
  'Eastbourne':     { members: 800, county: 'East Sussex', mp: '—' },
  'Hastings':       { members: 720, county: 'East Sussex', mp: '—' },
  'Bexhill':        { members: 310, county: 'East Sussex', mp: '—' },
  'Hailsham':       { members: 240, county: 'East Sussex', mp: '—' },
  'Polegate':       { members: 180, county: 'East Sussex', mp: '—' },
  'Seaford':        { members: 340, county: 'East Sussex', mp: '—' },
  'Newhaven':       { members: 200, county: 'East Sussex', mp: '—' },
  'Peacehaven':     { members: 210, county: 'East Sussex', mp: '—' },
  'Rye':            { members: 150, county: 'East Sussex', mp: '—' },
  'Battle':         { members: 160, county: 'East Sussex', mp: '—' },
  'Heathfield':     { members: 170, county: 'East Sussex', mp: '—' },
  'Wadhurst':       { members: 120, county: 'East Sussex', mp: '—' },
  'Robertsbridge':  { members: 90,  county: 'East Sussex', mp: '—' },
  'Ringmer':        { members: 110, county: 'East Sussex', mp: '—' },
  'Plumpton':       { members: 80,  county: 'East Sussex', mp: '—' },
  'Hove':           { members: 650, county: 'East Sussex', mp: '—' },
  'Brighton':       { members: 1024,county: 'East Sussex', mp: '—' },
  // UK cities (placeholder meta)
  'London':         { members: 5000, county: 'Greater London', mp: '—' },
  'Birmingham':     { members: 2200, county: 'West Midlands', mp: '—' },
  'Manchester':     { members: 1900, county: 'Greater Manchester', mp: '—' },
  'Leeds':          { members: 1500, county: 'West Yorkshire', mp: '—' },
  'Liverpool':      { members: 1400, county: 'Merseyside', mp: '—' },
  'Bristol':        { members: 1300, county: 'Bristol', mp: '—' },
  'Newcastle':      { members: 1100, county: 'Tyne and Wear', mp: '—' },
  'Edinburgh':      { members: 1600, county: 'City of Edinburgh', mp: '—' },
  'Glasgow':        { members: 1700, county: 'Glasgow City', mp: '—' },
  'Cardiff':        { members: 1200, county: 'Cardiff', mp: '—' },
  'Belfast':        { members: 1000, county: 'Belfast', mp: '—' },
  'Nottingham':     { members: 900,  county: 'Nottinghamshire', mp: '—' },
  'Sheffield':      { members: 950,  county: 'South Yorkshire', mp: '—' },
  'Leicester':      { members: 850,  county: 'Leicestershire', mp: '—' },
  'Cambridge':      { members: 800,  county: 'Cambridgeshire', mp: '—' },
  'Oxford':         { members: 820,  county: 'Oxfordshire', mp: '—' },
};

// Approximate centers for auto-zoom by community (lng, lat)
const COMMUNITY_COORDS = {
  'Forest Row': [0.0334, 51.0979],
  'East Grinstead': [-0.0060, 51.1280],
  'Crowborough': [0.1631, 51.0606],
  'Uckfield': [0.0959, 50.9707],
  'Lewes': [-0.0094, 50.8736],
  'Eastbourne': [0.2857, 50.7669],
  'Hastings': [0.5680, 50.8524],
  'Bexhill': [0.4706, 50.8411],
  'Hailsham': [0.2578, 50.8624],
  'Polegate': [0.2450, 50.8220],
  'Seaford': [0.1028, 50.7720],
  'Newhaven': [0.0556, 50.7940],
  'Peacehaven': [-0.0005, 50.7920],
  'Rye': [0.7330, 50.9509],
  'Battle': [0.4848, 50.9167],
  'Heathfield': [0.2574, 50.9670],
  'Wadhurst': [0.3390, 51.0610],
  'Robertsbridge': [0.4690, 50.9850],
  'Ringmer': [0.0620, 50.8920],
  'Plumpton': [-0.0640, 50.9280],
  'Hove': [-0.1600, 50.8220],
  'Brighton': [-0.1407, 50.8230]
  ,
  // UK cities centerpoints
  'London': [-0.1276, 51.5074],
  'Birmingham': [-1.8986, 52.4862],
  'Manchester': [-2.2426, 53.4808],
  'Leeds': [-1.5491, 53.8008],
  'Liverpool': [-2.9916, 53.4074],
  'Bristol': [-2.5879, 51.4545],
  'Newcastle': [-1.6178, 54.9783],
  'Edinburgh': [-3.1883, 55.9533],
  'Glasgow': [-4.2518, 55.8642],
  'Cardiff': [-3.1791, 51.4816],
  'Belfast': [-5.9301, 54.5973],
  'Nottingham': [-1.1491, 52.9548],
  'Sheffield': [-1.4701, 53.3811],
  'Leicester': [-1.1337, 52.6369],
  'Cambridge': [0.1218, 52.2053],
  'Oxford': [-1.2577, 51.7520]
};

function zoomToCommunity(name) {
  if (!map || !name) return;
  const coords = COMMUNITY_COORDS[name];
  if (coords) {
    try { map.flyTo({ center: coords, zoom: 13 }); } catch { map.easeTo({ center: coords, zoom: 12 }); }
  }
}

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
  const user = (localStorage.getItem('memberName') || localStorage.getItem('username') || '').trim();
  if (!user) return;
  const url = `${window.SHEET_API_URL}?type=getCommunity&user=${encodeURIComponent(user)}&callback=handleGetCommunity`;
  jsonp(url);
}

function handleGetCommunity(resp) {
  if (!resp || !resp.success) return;
  let community = (resp.community || '').toString();
  let status = (resp.status || '').toString();
  // Defensive: some backends mis-map Community/Status and return community='member'/'admin' with empty status
  const commLower = community.toLowerCase();
  if ((commLower === 'member' || commLower === 'admin') && !status) {
    console.warn('⚠ getCommunity returned role in community field; ignoring to avoid overwrite', resp);
    return; // keep existing local values set by login fallback
  }
  if (!status) status = 'member';
  let statusNorm = (status || 'member').toString().trim().toLowerCase();
  // Never downgrade an existing admin role due to a bad backend response
  try {
    const current = (localStorage.getItem('memberCommunityStatus') || '').toString().trim().toLowerCase();
    if (current === 'admin' && statusNorm !== 'admin') {
      console.warn('⚠ getCommunity attempted to downgrade admin → member; keeping admin');
      statusNorm = 'admin';
    }
  } catch {}
  if (community) {
    localStorage.setItem('memberCommunity', community);
    localStorage.setItem('memberCommunityStatus', statusNorm);
    window.updateActivityCommunityStatus?.(statusNorm, community);
    window.updateAdminUI?.();
    const stats = window.memberStats || {};
    stats.community = community;
    stats.status = statusNorm;
    window.memberStats = stats;
    window.updateMemberStatsUI?.();
    requestCommunityMeta(community);
    renderBadgeChips(localStorage.getItem('memberName') || '', document.getElementById('memberCardBadges'));
    // Auto-zoom to community on fetch
    zoomToCommunity(community);
  }
}

function setCommunityForCurrentUser(community, status = 'member') {
  const user = (localStorage.getItem('memberName') || localStorage.getItem('username') || '').trim();
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
    window.updateAdminUI?.();
    // Refresh members count using backend meta for accuracy
    requestCommunityMeta(community);
    const stats = window.memberStats || {};
    stats.community = community;
    stats.status = status;
    window.memberStats = stats;
    window.updateMemberStatsUI?.();
    renderBadgeChips(localStorage.getItem('memberName') || '', document.getElementById('memberCardBadges'));
    // Auto-zoom after setting community
    zoomToCommunity(community);
  } else {
    alert('Could not update community.');
  }
}

function requestCommunityMeta(community) {
  if (!community) return;
  // Avoid mis-mapped role strings being treated as communities
  const cl = (community || '').toString().trim().toLowerCase();
  if (cl === 'member' || cl === 'admin') return;
  const url = `${window.SHEET_API_URL}?type=getCommunityMeta&community=${encodeURIComponent(community)}&callback=handleCommunityMeta`;
  jsonp(url);
}

// ───────── DAILY STREAK (backend wiring) ─────────
function normalizeUserKeyForBackend() {
  const u = (localStorage.getItem('username') || localStorage.getItem('memberName') || '').toString();
  return u.trim().toLowerCase().replace(/\s+/g, '');
}

function requestStreakForCurrentUser() {
  const user = normalizeUserKeyForBackend();
  if (!user) return;
  const url = `${window.SHEET_API_URL}?type=getStreak&user=${encodeURIComponent(user)}&callback=handleGetStreak`;
  jsonp(url);
}

function handleGetStreak(resp) {
  if (!resp || resp.success === false) return;
  const days = parseInt(resp.streak || '0', 10) || 0;
  try { localStorage.setItem('streak', String(days)); } catch {}
  window.memberStats = window.memberStats || {};
  window.memberStats.streak = days;
  window.updateMemberStatsUI?.();
  const el = document.getElementById('memberCardStreak');
  if (el) el.textContent = `${days} day${days===1?'':'s'}`;
  // Update streak chips
  try {
    const chip = document.getElementById('memberStreakChip');
    if (chip) {
      if (days > 0) { chip.textContent = `🔥 ${days}`; chip.classList.remove('hidden'); }
      else { chip.classList.add('hidden'); chip.textContent = ''; }
    }
    const cardChip = document.getElementById('memberCardStreakChip');
    if (cardChip) {
      if (days > 0) { cardChip.textContent = `🔥 ${days}-day streak`; cardChip.classList.remove('hidden'); }
      else { cardChip.classList.add('hidden'); cardChip.textContent = ''; }
    }
  } catch {}
}

function pingDailyStreakForCurrentUser() {
  const user = normalizeUserKeyForBackend();
  if (!user) return;
  const today = new Date().toISOString().slice(0,10);
  const last = localStorage.getItem('streakPing');
  if (last === today) return; // already pinged today
  const url = `${window.SHEET_API_URL}?type=streakPing&user=${encodeURIComponent(user)}&day=${encodeURIComponent(today)}&callback=handleStreakPing`;
  jsonp(url);
  try { localStorage.setItem('streakPing', today); } catch {}
}

function handleStreakPing(resp) {
  if (!resp || resp.success === false) return;
  const days = parseInt(resp.streak || '0', 10) || 0;
  try { localStorage.setItem('streak', String(days)); } catch {}
  window.memberStats = window.memberStats || {};
  window.memberStats.streak = days;
  window.updateMemberStatsUI?.();
  const el = document.getElementById('memberCardStreak');
  if (el) el.textContent = `${days} day${days===1?'':'s'}`;
  // Update streak chips
  try {
    const chip = document.getElementById('memberStreakChip');
    if (chip) {
      if (days > 0) { chip.textContent = `🔥 ${days}`; chip.classList.remove('hidden'); }
      else { chip.classList.add('hidden'); chip.textContent = ''; }
    }
    const cardChip = document.getElementById('memberCardStreakChip');
    if (cardChip) {
      if (days > 0) { cardChip.textContent = `🔥 ${days}-day streak`; cardChip.classList.remove('hidden'); }
      else { cardChip.classList.add('hidden'); cardChip.textContent = ''; }
    }
  } catch {}
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
  const mp     = state.mp     || (COMMUNITY_META[state.community || '']?.mp     || '—');
  if (county) chips.push(`
    <span class="inline-flex items-center gap-1 rounded-full border border-yellow-500/30 px-2 py-0.5">
      <i data-lucide="map" class="w-3.5 h-3.5"></i> ${county}
    </span>`);
  // Always show an MP chip; fallback to '—' if unknown
  chips.push(`
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
  const safeUser = encodeURIComponent(user.trim().toLowerCase().replace(/\s+/g, ''));
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

  // Timestamp when form becomes available
  const formReadyAt = Date.now();

  form.addEventListener('submit', e => {
    e.preventDefault(); // ✅ this now works!

    // Honeypot check
    const hp = document.getElementById('hp-submission');
    if (hp && hp.value) return alert('Submission blocked.');

    // Basic timing check (2s min)
    if (Date.now() - formReadyAt < 2000) return alert('Please wait a moment before submitting.');

    // Simple rate-limit: 1 per 60s
    const now = Date.now();
    if (now - (_rate.submission || 0) < 60000) return alert('Please wait before submitting again.');

    const sanitize = (s='') => s.replace(/[<>]/g, '').trim();
    const name = sanitize(document.getElementById('locationName').value).slice(0,120);
    const address = sanitize(document.getElementById('submissionLocation').value).slice(0,160);
    const descOpt = sanitize(document.getElementById('submissionDescription')?.value || '').slice(0,280);
    const location = descOpt ? `${address} — ${descOpt}`.slice(0,320) : address;
    const category = sanitize(document.getElementById('locationCoords').value).slice(0,80);

    // Stash details for potential auto-add (admin)
    try { window._lastSubmission = { name, location, category, pin: window._pendingPin ? { ...window._pendingPin } : null }; } catch {}

    let url = `${window.SHEET_API_URL}?type=submission&callback=handleSubmissionResponse`
              + `&name=${encodeURIComponent(name)}`
              + `&location=${encodeURIComponent(location)}`
              + `&category=${encodeURIComponent(category)}`;
    try {
      const pin = window._pendingPin;
      if (pin && typeof pin.lat === 'number' && typeof pin.lng === 'number') {
        url += `&lat=${encodeURIComponent(pin.lat)}&lng=${encodeURIComponent(pin.lng)}`;
      }
    } catch {}
    _rate.submission = now;
    jsonp(url);
    try { window._pendingPin = null; } catch {}
  });
}

// Bind fallback Add Location form if present (used when a fallback modal is created)
function bindLocationFormFallback() {
  const form = document.getElementById('locationForm');
  if (!form) return;
  if (form._bound) return; // avoid duplicate listeners
  form._bound = true;

  const startedAt = Date.now();
  form.addEventListener('submit', e => {
    e.preventDefault();
    const hp = document.getElementById('hp-submission');
    if (hp && hp.value) return alert('Submission blocked.');
    if (Date.now() - startedAt < 1500) return alert('Please wait a moment before submitting.');
    const now = Date.now();
    if (now - (_rate.submission || 0) < 60000) return alert('Please wait before submitting again.');

    const S = (s='') => s.replace(/[<>]/g, '').trim();
    const name = S(document.getElementById('locationTitle')?.value || '').slice(0,120);
    const location = S(document.getElementById('locationShortDesc')?.value || '').slice(0,320); // optional
    const category = S(document.getElementById('locationCategory')?.value || '').slice(0,80);

    // Stash details for potential auto-add (admin)
    try { window._lastSubmission = { name, location, category, pin: window._pendingPin ? { ...window._pendingPin } : null }; } catch {}

    let url = `${window.SHEET_API_URL}?type=submission&callback=handleSubmissionResponse`
      + `&name=${encodeURIComponent(name)}`
      + `&location=${encodeURIComponent(location)}`
      + `&category=${encodeURIComponent(category)}`;
    try {
      const pin = window._pendingPin;
      if (pin && typeof pin.lat === 'number' && typeof pin.lng === 'number') {
        url += `&lat=${encodeURIComponent(pin.lat)}&lng=${encodeURIComponent(pin.lng)}`;
      }
    } catch {}
    _rate.submission = now;
    jsonp(url);
    // Close fallback modal after submit
    document.getElementById('addLocationModal')?.classList.add('hidden');
    try { window._pendingPin = null; } catch {}
  });
}


// 🗑 Remove a favourite
window.removeFavourite = function(title) {
  const user = localStorage.getItem('username');
  if (!user) return alert('Please log in.');

  const safeUser = encodeURIComponent(user.trim().toLowerCase().replace(/\s+/g, ''));
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

// Lightweight toast utility (top-right)
if (typeof window.showToast !== 'function') {
  window.showToast = function (message = '', timeoutMs = 3000) {
    if (!message) return;
    const c = document.createElement('div');
    c.className = 'fixed top-4 right-4 z-[10000] px-3 py-2 rounded-lg border border-yellow-500/40 bg-black/85 text-yellow-200 shadow-lg';
    c.textContent = message;
    document.body.appendChild(c);
    setTimeout(() => { c.style.opacity = '0'; c.style.transform = 'translateY(-6px)'; }, Math.max(0, timeoutMs - 300));
    setTimeout(() => c.remove(), timeoutMs);
  }
}

// Share helper: copies a deep‑link to a pin (lat/lng + title)
window.copyPinLink = function(lat, lng, title='') {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lng', String(lng));
    if (title) url.searchParams.set('title', String(title));
    const link = url.toString();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(() => showToast('🔗 Link copied'));
    } else {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('🔗 Link copied');
    }
  } catch (e) {
    console.warn('Share failed', e);
    alert('Could not copy link');
  }
};

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
  let user = localStorage.getItem('username');
  if (!user) {
    const fallback = (localStorage.getItem('memberName') || '').trim().toLowerCase().replace(/\s+/g, '');
    if (fallback) {
      localStorage.setItem('username', fallback);
      user = fallback;
    } else {
      // Open signup with CTA for saving favourites
      const cta = document.getElementById('signupCta');
      if (cta) { cta.textContent = 'Save places to your map'; cta.classList.remove('hidden'); }
      document.getElementById('loginModal')?.classList.add('hidden');
      document.getElementById('signupModal')?.classList.remove('hidden');
      return;
    }
  }

  const safeUser = encodeURIComponent(user.trim().toLowerCase().replace(/\s+/g, ''));
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
  const containers = Array.from(document.querySelectorAll('#favouritesDropdown'));
  const lists = Array.from(document.querySelectorAll('#favouritesList'));
  window.latestFavouritesCount = favs.length;
  if (window.memberStats) {
    window.memberStats.favourites = favs.length;
    window.updateMemberStatsUI?.();
  }

  const content = favs.length === 0
    ? '<div class="text-sm px-4 py-2 text-yellow-400">No favourites yet.</div>'
    : favs.map(title => {
        const safe = title.replace(/'/g, "\\'");
        return `
          <div class="text-sm px-4 py-2 text-yellow-400 flex justify-between items-center">
            ${title}
            <button onclick="removeFavourite('${safe}')">
              <i data-lucide="x" class="w-4 h-4 text-yellow-500 hover:text-red-500"></i>
            </button>
          </div>`;
      }).join('');

  if (lists.length) {
    lists.forEach(list => { list.innerHTML = content; });
  } else if (containers.length) {
    containers.forEach(container => { container.innerHTML = content; });
  }
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
  if (data && data.success) {
    alert('✅ Location submitted!');
    try { document.getElementById('submissionForm')?.reset(); } catch {}
    try { document.getElementById('locationForm')?.reset(); } catch {}
    // Auto close any open add-location modal variants
    try { document.getElementById('submissionModal')?.classList.add('hidden'); } catch {}
    try { document.getElementById('addLocationModal')?.classList.add('hidden'); } catch {}
    try { closeModal?.(); } catch {}

    // If user is admin, immediately add to map
    try {
      const role = (localStorage.getItem('memberCommunityStatus') || '').toString().toLowerCase();
      const last = window._lastSubmission || null;
      const pin = last?.pin || null;
      if (role === 'admin' && last && pin && typeof pin.lat === 'number' && typeof pin.lng === 'number') {
        addLocationToMapImmediate({
          title: last.name || 'New Location',
          description: last.location || '',
          category: last.category || 'General',
          lat: pin.lat,
          lng: pin.lng
        });

        // Persist to GitHub via Apps Script (GeoJSON commit)
        try {
          const actor = (localStorage.getItem('memberName') || localStorage.getItem('username') || '').toString().trim();
          if (actor) {
            const url = `${window.SHEET_API_URL}?type=persistGeoPin`
              + `&actor=${encodeURIComponent(actor)}`
              + `&title=${encodeURIComponent(last.name || '')}`
              + `&desc=${encodeURIComponent(last.location || '')}`
              + `&category=${encodeURIComponent(last.category || '')}`
              + `&lat=${encodeURIComponent(pin.lat)}`
              + `&lng=${encodeURIComponent(pin.lng)}`
              + `&callback=handlePersistGeoPin`;
            jsonp(url);
          }
        } catch (e2) { console.warn('GeoJSON persist call failed:', e2); }
      } else if (last && pin && typeof pin.lat === 'number' && typeof pin.lng === 'number') {
        // Non-admin: show a temporary local marker as immediate feedback
        try {
          addLocationToMapImmediate({
            title: last.name || 'Submitted Location',
            description: (last.location ? `${last.location} — ` : '') + 'Pending review',
            category: last.category || 'General',
            lat: pin.lat,
            lng: pin.lng
          });
        } catch (e3) { console.warn('Temp pin add failed:', e3); }
      }
    } catch (e) { console.warn('Admin auto-add failed:', e); }
  } else {
    alert('❌ Error submitting location.');
  }
}

// ─────────── Following System (frontend) ───────────
function refreshFollowCounts() {
  const me = normalizeUserKeyForBackend();
  if (!me) return;
  const url = `${window.SHEET_API_URL}?type=getFollows&user=${encodeURIComponent(me)}&callback=handleGetFollows`;
  jsonp(url);
}

function handleGetFollows(resp) {
  if (!resp || resp.success === false) return;
  try {
    const f1 = parseInt(resp.followersCount || 0, 10) || 0;
    const f2 = parseInt(resp.followingCount || 0, 10) || 0;
    const elA = document.getElementById('followersCount');
    const elB = document.getElementById('followingCount');
    if (elA) elA.textContent = String(f1);
    if (elB) elB.textContent = String(f2);
    // Cache following set for button states
    const set = new Set((resp.following || []).map(s => normalizeUserName(s)));
    window._followingSet = set;
    // Update any open member card follow button
    const name = window._memberCardDisplayName;
    if (name) {
      const btn = document.getElementById('memberCardFollowBtn');
      if (btn) {
        const isFollowing = set.has(normalizeUserName(name));
        btn.textContent = isFollowing ? 'Following' : 'Follow';
        btn.dataset.state = isFollowing ? 'following' : 'follow';
      }
    }
  } catch {}
}

function followToggle(targetName) {
  if (!window.isLoggedIn?.()) {
    document.getElementById('loginModal')?.classList.remove('hidden');
    return;
  }
  const actor = normalizeUserKeyForBackend();
  if (!actor) return;
  const target = (targetName || '').toString().trim();
  if (!target) return;
  const set = (window._followingSet = window._followingSet || new Set());
  const normTarget = normalizeUserName(target);
  const wasFollowing = set.has(normTarget);
  const willFollow = !wasFollowing;

  // Optimistic UI update
  setFollowUI(target, willFollow);
  window._lastFollowAction = { target, wasFollowing };

  const type = willFollow ? 'follow' : 'unfollow';
  const url = `${window.SHEET_API_URL}?type=${type}&actor=${encodeURIComponent(actor)}&target=${encodeURIComponent(target)}&callback=handleFollowResponse`;
  jsonp(url);
}

function handleFollowResponse(resp) {
  if (!resp || resp.success === false) { alert('Follow action failed'); return; }
  // Update counts + local set and button
  refreshFollowCounts();
}

// GeoJSON persistence callback (Apps Script)
window.handlePersistGeoPin = function (resp) {
  if (resp && resp.success) {
    console.log('✅ GeoJSON updated in repo');
  } else {
    console.warn('⚠️ GeoJSON persist failed', resp);
  }
};

// ─────────── Simple Inbox/DM Store (frontend placeholder) ───────────
window._dmStore = { conversations: {} }; // { key: { name, messages:[{from:'me'|'them',text,ts,read:false}] } }

function getConversationKey(name='') { return (name||'').toString().trim().toLowerCase(); }

function updateInboxBadge() {
  try {
    const convos = window._dmStore.conversations || {};
    let unread = 0;
    Object.values(convos).forEach(c => { (c.messages||[]).forEach(m => { if (m.from !== 'me' && m.read !== true) unread++; }); });
    const badge = document.getElementById('inboxCountBadge');
    if (badge) badge.textContent = String(unread);
  } catch {}
}

function markConversationRead(name) {
  const key = getConversationKey(name);
  const conv = window._dmStore.conversations[key];
  if (!conv) return;
  (conv.messages||[]).forEach(m => { if (m.from !== 'me') m.read = true; });
  updateInboxBadge();
}

function openInboxPanel() {
  // Ensure latest (optional backend hook; safe if not implemented yet)
  try { refreshInbox?.(); } catch {}

  let panel = document.getElementById('inboxPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'inboxPanel';
    panel.className = 'inbox-panel';
    panel.style.cssText = [
      'position:fixed','right:16px','bottom:64px','width:360px','max-height:68vh',
      'display:flex','flex-direction:column','background:#000',
      'border:1px solid rgba(234,179,8,0.6)','border-radius:14px',
      'box-shadow:0 16px 28px rgba(0,0,0,0.45)','z-index:100000','overflow:hidden'
    ].join(';');
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#0b0b0b;border-bottom:1px solid rgba(234,179,8,0.35);color:#facc15;">
        <div style="font-weight:600;">Inbox</div>
        <button id="inboxClose" style="border:1px solid rgba(234,179,8,0.5);background:#111;color:#facc15;border-radius:9999px;width:28px;height:28px;">×</button>
      </div>
      <div id="inboxList" style="flex:1;overflow-y:auto;padding:8px 6px;color:#e5e5e5;background:#050505;"></div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('#inboxClose').addEventListener('click', ()=> panel.classList.add('hidden'));
  }
  renderInboxList();
  panel.classList.remove('hidden');
}

function renderInboxList() {
  const list = document.getElementById('inboxList');
  if (!list) return;
  const convos = window._dmStore.conversations || {};
  const entries = Object.values(convos).map(c => {
    const last = (c.messages||[])[(c.messages||[]).length-1] || {};
    const unread = (c.messages||[]).filter(m => m.from !== 'me' && m.read !== true).length;
    const snippet = (last.text || '').slice(0,60).replace(/</g,'&lt;');
    return { name: c.name, snippet, unread, ts: last.ts || 0 };
  }).sort((a,b)=> b.ts - a.ts);
  if (!entries.length) {
    list.innerHTML = '<div style="padding:10px 8px;color:#eab308;opacity:1;">No messages yet.</div>';
    return;
  }
  list.innerHTML = entries.map(e => `
    <button class="inbox-item" data-dm-name="${e.name.replace(/\"/g,'&quot;')}" style="width:100%;text-align:left;background:transparent;border:none;padding:8px 10px;border-radius:10px;display:flex;align-items:center;gap:8px;cursor:pointer;">
      <div style="flex:1;">
        <div style="color:#eab308;font-weight:600;">${e.name}</div>
        <div style="color:#eab308;font-size:12px;opacity:1;">${e.snippet || '&nbsp;'}</div>
      </div>
      ${e.unread ? `<span style=\"min-width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;border-radius:9999px;background:#eab308;color:#000;font-size:11px;font-weight:700;\">${e.unread}</span>` : ''}
      <span class="inbox-del" data-dm-del="${e.name.replace(/\"/g,'&quot;')}" title="Delete" style="margin-left:6px;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;border-radius:9999px;border:1px solid rgba(234,179,8,0.5);color:#facc15;">×</span>
    </button>
  `).join('');

  list.querySelectorAll('[data-dm-name]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const n = btn.getAttribute('data-dm-name') || '';
      document.getElementById('inboxPanel')?.classList.add('hidden');
      openChatPanel(n);
    });
  });
  // Delete handlers (stop click propagation to avoid opening chat)
  list.querySelectorAll('[data-dm-del]')?.forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const name = btn.getAttribute('data-dm-del') || '';
      const key = getConversationKey(name);
      if (key && window._dmStore.conversations[key]) {
        delete window._dmStore.conversations[key];
        updateInboxBadge();
        renderInboxList();
        // Optional backend cleanup (ignored if not implemented)
        try {
          window.handleNoop = window.handleNoop || function(){};
          const meRaw = (localStorage.getItem('memberName') || localStorage.getItem('username') || '').toString().trim();
          if (meRaw) jsonp(`${window.SHEET_API_URL}?type=dmDelete&user=${encodeURIComponent(meRaw)}&with=${encodeURIComponent(name)}&callback=handleNoop`);
        } catch {}
      }
    });
  });
}

// Optional backend hook; safe if server not ready
window.refreshInbox = function () {
  const me = normalizeUserKeyForBackend();
  if (!me) { updateInboxBadge(); return; }
  try {
    jsonp(`${window.SHEET_API_URL}?type=getInbox&user=${encodeURIComponent(me)}&callback=handleInbox`);
    // Fallback: still update badge from local store
    setTimeout(updateInboxBadge, 200);
  } catch { updateInboxBadge(); }
};

window.handleInbox = function (resp) {
  if (!resp || resp.success === false) { updateInboxBadge(); return; }
  // Expect resp.messages: [{from, text, ts, read}] — group by from
  const convos = {};
  const arr = Array.isArray(resp.messages) ? resp.messages : [];
  arr.forEach(m => {
    const name = (m.from || '').toString();
    const key = getConversationKey(name);
    convos[key] = convos[key] || { name, messages: [] };
    convos[key].messages.push({ from: 'them', text: (m.text||'').toString(), ts: Number(m.ts)||Date.now(), read: !!m.read });
  });
  window._dmStore.conversations = Object.assign({}, window._dmStore.conversations, convos);
  updateInboxBadge();
  if (document.getElementById('inboxPanel') && !document.getElementById('inboxPanel').classList.contains('hidden')) renderInboxList();
  // If chat open for one of these senders, update view
  try {
    const openName = window._openChatName;
    if (openName) renderChatMessages(openName);
  } catch {}
};

// DM send + read callbacks (best-effort)
window.handleDMSend = function (resp) {
  // On success, refresh inbox to reflect message thread ordering (optional)
  try { refreshInbox?.(); } catch {}
};
window.handleDMRead = function (resp) {
  // After marking read on backend, refresh badge
  try { refreshInbox?.(); } catch {}
};

// ─────────── Add new location to map immediately (admin helper) ───────────
function addLocationToMapImmediate({ title, description = '', category = 'General', lat, lng }) {
  if (!window.map || typeof lat !== 'number' || typeof lng !== 'number') return;
  try {
    // Sanity: auto-fix swapped or out-of-bounds coords
    let _lat = Number(lat), _lng = Number(lng);
    const outOfBounds = !Number.isFinite(_lat) || !Number.isFinite(_lng) || _lat < 49 || _lat > 61 || _lng < -10 || _lng > 3;
    const looksSwapped = Number.isFinite(_lat) && Number.isFinite(_lng) && ((Math.abs(_lng) > 10 && Math.abs(_lat) < 10) || _lng > 20 || _lng < -20);
    if (looksSwapped || outOfBounds) { const t = _lat; _lat = _lng; _lng = t; }
    const coords = [_lng, _lat];

    const feature = {
      type: 'Feature',
      properties: { title, description, category, verified: false, _adminTemp: true },
      geometry: { type: 'Point', coordinates: coords }
    };
    // Update Mapbox source so the symbol layer renders it immediately
    try {
      if (map.getSource('places')) {
        if (!window.originalGeoData || !Array.isArray(window.originalGeoData.features)) {
          window.originalGeoData = { type: 'FeatureCollection', features: [] };
        }
        window.originalGeoData.features.push(feature);
        map.getSource('places').setData(window.originalGeoData);
      }
    } catch {}

    // Keep in-memory list for search/navigation (no DOM marker)
    geoMarkers.push({ title: (title||'').toLowerCase(), coords, marker: null, feature, _adminTemp: true });
    try {
      if (window.originalGeoData && Array.isArray(window.originalGeoData.features)) {
        window.originalGeoData.features.push(feature);
      }
    } catch {}

    // Keep filters/category lists in sync
    try {
      window.mapCategories = Array.from(new Set([...(window.mapCategories||[]), category])).sort();
      window.populateCategoryFilters?.();
      window.populateCategorySelects?.();
    } catch {}

    window.lucide?.createIcons?.();
    console.log('✅ Admin auto-added location to map (layer):', title, coords);
  } catch (e) {
    console.warn('Failed to add location to map immediately:', e);
  }
}

// Remove all temporary admin-added pins from this session
window.removeAdminPins = function () {
  try {
    const keep = [];
    geoMarkers.forEach(entry => {
      if (entry && entry._adminTemp) {
        try { entry.marker?.remove(); } catch {}
      } else {
        keep.push(entry);
      }
    });
    geoMarkers = keep;
    // Also prune from originalGeoData if we appended temporary features
    try {
      if (window.originalGeoData && Array.isArray(window.originalGeoData.features)) {
        window.originalGeoData.features = window.originalGeoData.features.filter(f => !f?.properties?._adminTemp);
      }
    } catch {}
    console.log('🧹 Removed admin pins');
  } catch (e) {
    console.warn('Failed to remove admin pins', e);
  }
};

// Remove the most recently added admin pin
window.removeLastAdminPin = function () {
  for (let i = geoMarkers.length - 1; i >= 0; i--) {
    const entry = geoMarkers[i];
    if (entry && entry._adminTemp) {
      try { entry.marker?.remove(); } catch {}
      geoMarkers.splice(i, 1);
      // Remove matching feature by coordinates/title
      try {
        if (window.originalGeoData && Array.isArray(window.originalGeoData.features)) {
          const idx = window.originalGeoData.features.findIndex(f => f?.properties?._adminTemp);
          if (idx >= 0) window.originalGeoData.features.splice(idx, 1);
        }
      } catch {}
      console.log('🧹 Removed last admin pin');
      return;
    }
  }
  console.log('No admin pins found to remove');
};
// ─────────── Chat Panel (local UI only)
const _chatStore = {}; // user -> [{from:'me'|'them', text, ts}]

function openChatPanel(targetName = '') {
  const name = (targetName || '').toString().trim();
  if (!name) return;

  // Close other surfaces
  document.getElementById('profileMenu')?.classList.add('hidden');
  window.hideMemberCard?.();
  document.getElementById('activitySidebar')?.classList.add('translate-x-full');
  document.getElementById('marketplaceSidebar')?.classList.add('translate-x-full');
  document.getElementById('entertainmentSidebar')?.classList.add('translate-x-full');

  let panel = document.getElementById('chatPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'chatPanel';
    panel.className = 'chat-panel';
    panel.className = 'pointer-events-auto';
    panel.style.cssText = [
      'position:fixed','right:16px','bottom:64px',
      'width:400px','max-height:70vh',
      'display:flex','flex-direction:column',
      'background:#000','border:1px solid rgba(234,179,8,0.6)',
      'border-radius:14px','box-shadow:0 16px 32px rgba(0,0,0,0.45)',
      'z-index:100000','overflow:hidden'
    ].join(';');
    panel.innerHTML = `
      <div id="chatHeader" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(0,0,0,0.9);border-bottom:1px solid rgba(234,179,8,0.3);color:#facc15;">
        <div id="chatTitle" style="font-weight:600;">Chat</div>
        <button id="chatClose" style="border:1px solid rgba(234,179,8,0.5);background:#111;color:#facc15;border-radius:9999px;width:28px;height:28px;">×</button>
      </div>
      <div id="chatBody" style="flex:1;overflow-y:auto;padding:12px;color:#e5e5e5;background:#0b0b0b;"></div>
      <form id="chatForm" style="display:flex;gap:8px;padding:10px;border-top:1px solid rgba(234,179,8,0.3);background:#0b0b0b;">
        <input id="chatInput" type="text" placeholder="Message..." autocomplete="off"
               style="flex:1;border:1px solid rgba(234,179,8,0.5);background:#111;color:#fef9c3;border-radius:9999px;padding:10px 12px;outline:none;" />
        <button type="submit" style="border:1px solid #eab308;background:#eab308;color:#000;border-radius:9999px;padding:8px 14px;font-weight:700;">Send</button>
      </form>`;
    document.body.appendChild(panel);

    panel.querySelector('#chatClose').addEventListener('click', () => {
      panel.classList.add('hidden');
    });
    panel.querySelector('#chatForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const input = panel.querySelector('#chatInput');
      const text = (input.value || '').trim();
      if (!text) return;
      addChatMessage(name, 'me', text);
      input.value = '';
      // Send to backend (Apps Script)
      const meRaw = (localStorage.getItem('memberName') || localStorage.getItem('username') || '').toString().trim();
      if (!meRaw) {
        // prompt login if not available
        document.getElementById('loginModal')?.classList.remove('hidden');
        return;
      }
      try {
        const url = `${window.SHEET_API_URL}?type=dmSend&from=${encodeURIComponent(meRaw)}&to=${encodeURIComponent(name)}&text=${encodeURIComponent(text)}&callback=handleDMSend`;
        jsonp(url);
      } catch {}
    });
  }

  panel.querySelector('#chatTitle').textContent = `Chat • ${name}`;
  panel.classList.remove('hidden');
  window._openChatName = name;
  renderChatMessages(name);
  // Mark inbox read for this conversation
  markConversationRead(name);
  // Notify backend to mark read for this conversation (best-effort)
  try {
    const meRaw = (localStorage.getItem('memberName') || localStorage.getItem('username') || '').toString().trim();
    if (meRaw) jsonp(`${window.SHEET_API_URL}?type=dmMarkRead&user=${encodeURIComponent(meRaw)}&from=${encodeURIComponent(name)}&callback=handleDMRead`);
  } catch {}
}

function addChatMessage(name, from, text) {
  const key = normalizeUserName(name);
  _chatStore[key] = _chatStore[key] || [];
  _chatStore[key].push({ from, text, ts: Date.now() });
  // Mirror to inbox store
  const k2 = getConversationKey(name);
  window._dmStore.conversations[k2] = window._dmStore.conversations[k2] || { name, messages: [] };
  window._dmStore.conversations[k2].messages.push({ from, text, ts: Date.now(), read: (from === 'me') });
  updateInboxBadge();
  renderChatMessages(name);
}

function _mergeConversation(name) {
  const key = normalizeUserName(name);
  const k2 = getConversationKey(name);
  const local = (_chatStore[key] || []);
  const inboxMsgs = ((window._dmStore.conversations[k2]?.messages) || []).map(m => ({
    from: (m.from === 'me' ? 'me' : 'them'),
    text: m.text,
    ts: Number(m.ts) || Date.now()
  }));
  const merged = [...local, ...inboxMsgs]
    .filter(m => m && m.text != null)
    .sort((a,b) => (a.ts||0) - (b.ts||0));
  // de-dupe by from|text|ts
  const seen = new Set();
  const unique = [];
  merged.forEach(m => {
    const k = `${m.from}|${m.text}|${m.ts}`;
    if (!seen.has(k)) { seen.add(k); unique.push(m); }
  });
  return unique.slice(-300);
}

function renderChatMessages(name) {
  const list = _mergeConversation(name);
  const body = document.getElementById('chatBody');
  if (!body) return;
  body.innerHTML = list.map(m => {
    const align = m.from === 'me' ? 'flex-end' : 'flex-start';
    const bg = m.from === 'me' ? '#eab308' : '#111';
    const fg = m.from === 'me' ? '#000' : '#eab308'; // or '#FFD700'
    const safe = (m.text || '').replace(/</g,'&lt;');
    return `<div style="display:flex;justify-content:${align};margin:6px 0;">
      <div style=\"max-width:78%;padding:8px 10px;border-radius:14px;border:1px solid rgba(234,179,8,0.4);background:${bg};color:${fg};\">${safe}</div>
    </div>`;
  }).join('');
  body.scrollTop = body.scrollHeight;
}
// Update local UI state for follow/unfollow immediately
function setFollowUI(targetName, following) {
  const normTarget = normalizeUserName(targetName || '');
  const set = (window._followingSet = window._followingSet || new Set());
  if (following) set.add(normTarget); else set.delete(normTarget);

  // Update button if present
  const btn = document.getElementById('memberCardFollowBtn');
  if (btn) {
    btn.textContent = following ? 'Following' : 'Follow';
    btn.dataset.state = following ? 'following' : 'follow';
  }

  // Update actor following count in profile menu (optimistic)
  try {
    const el = document.getElementById('followingCount');
    const cur = parseInt((el?.textContent || '0'), 10) || 0;
    const next = following ? cur + 1 : Math.max(0, cur - 1);
    if (el) el.textContent = String(next);
  } catch {}
}

function showFollowList(kind = 'followers', anchorEl) {
  const me = normalizeUserKeyForBackend();
  if (!me) {
    document.getElementById('loginModal')?.classList.remove('hidden');
    return;
  }
  const url = `${window.SHEET_API_URL}?type=getFollows&user=${encodeURIComponent(me)}&callback=handleFollowList`;
  window._followListKind = kind;
  window._followListAnchor = anchorEl || document.getElementById(kind === 'followers' ? 'followersCountBtn' : 'followingCountBtn');
  jsonp(url);
}

function handleFollowList(resp) {
  if (!resp || resp.success === false) return;
  const kind = window._followListKind || 'followers';
  const items = (kind === 'followers' ? resp.followers : resp.following) || [];
  let panel = document.getElementById('followListPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'followListPanel';
    panel.className = 'rounded-xl border border-yellow-500/40 bg-black text-yellow-100 shadow-xl px-3 py-2 text-sm';
    panel.style.position = 'absolute';
    panel.style.zIndex = '100000';
    document.body.appendChild(panel);
  }
  const listHtml = items.length
    ? items.map(n => `<button class=\"block w-full text-left hover:text-yellow-300 py-1\" data-follow-name=\"${n.replace(/\"/g,'&quot;')}\">${n}</button>`).join('')
    : `<div class=\"text-yellow-400/80 py-1\">No ${kind} yet.</div>`;
  panel.innerHTML = `<div class=\"text-[11px] uppercase tracking-[0.25em] text-yellow-400/80 mb-1\">${kind}</div>${listHtml}`;
  panel.classList.remove('hidden');

  const anchor = window._followListAnchor;
  const rect = (anchor || document.getElementById('profileToggle')).getBoundingClientRect();
  panel.style.left = `${rect.left + window.scrollX}px`;
  panel.style.top = `${rect.bottom + window.scrollY + 6}px`;

  const dismiss = (e) => {
    if (panel.contains(e.target) || (anchor && anchor.contains(e.target))) return;
    panel.classList.add('hidden');
    document.removeEventListener('click', dismiss);
  };
  setTimeout(() => document.addEventListener('click', dismiss), 0);

  // Click on a name → open member card
  panel.querySelectorAll('[data-follow-name]')?.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const name = btn.getAttribute('data-follow-name') || '';
      panel.classList.add('hidden');
      const anchorEl = window._followListAnchor || document.getElementById('profileToggle');
      window.showMemberCard?.(name, anchorEl);
    });
  });
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
      comments:  r[5],
      category:  (r[6] || 'general').toString().trim().toLowerCase()
    }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  console.log(`✅ Activity posts parsed: ${posts.length}`);

  const feed = document.getElementById('activityContent');
  if (!feed) {
    console.error('❌ #activityContent element not found!');
    return;
  }

  const stats = buildActivityStats(posts);
  window.activityStats = stats;

  // Preserve fixed UI (form + refresh) when re-rendering
  // Ensure the post form node exists so we can re-attach it after render
  ensureActivityPostFormNode();
  const postForm = document.getElementById('activityPostForm');
  const refreshBtn = document.getElementById('refreshActivity');
  const loadingNode2 = document.getElementById('loadingPosts');
  const communityCard = document.getElementById('activityCommunityCard');
  const infoCardOrig = document.getElementById('activityInfoCard');
  const leaderboardPanel = document.getElementById('activityLeaderboardPanel');

  // Preserve community picker while re-rendering
  const keepCommunity = communityCard ? communityCard.cloneNode(true) : null;
  const keepInfo = infoCardOrig ? infoCardOrig.cloneNode(true) : null;
  const keepLeaderboard = leaderboardPanel ? leaderboardPanel.cloneNode(true) : null;
  feed.innerHTML = '';
  if (keepInfo) feed.appendChild(keepInfo);
  if (keepCommunity) feed.appendChild(keepCommunity);
  if (keepLeaderboard) feed.appendChild(keepLeaderboard);

  const activeCat = (window.activityFilter || 'general').toLowerCase();
  const visible = posts.filter(p => {
    if (activeCat === 'general') return !p.category || p.category === 'general';
    return p.category === activeCat;
  });

  visible.forEach(post => {
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

  const badges = getActivityBadgesForUser(post.username || 'Anonymous');
  if (badges.length) {
    const badgeRow = document.createElement('div');
    badgeRow.className = 'flex flex-wrap gap-1 mb-2';
    badgeRow.innerHTML = badges.map(b => `<span class="badge-chip"><i data-lucide="${b.icon}"></i> ${b.label}</span>`).join('');
    postDiv.append(header, badgeRow);
  } else {
    postDiv.appendChild(header);
  }

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
        username: localStorage.getItem('memberName') || localStorage.getItem('username') || 'Anonymous',
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

  postDiv.append(content, actionsRow, commentsDiv, replyInput);
  feed.appendChild(postDiv);
  lucide.createIcons();
  });


  // Ensure the sidebar is visible once data is rendered
  const sidebarEl = document.getElementById('activitySidebar');
  sidebarEl?.classList.remove('translate-x-full');

  console.log('📦 Activity feed rendered to DOM');
  // Re-attach fixed nodes (as siblings of the scroll area so they stay fixed)
  const sidebarRoot = document.getElementById('activitySidebar');
  if (postForm && sidebarRoot) sidebarRoot.appendChild(postForm);
  if (refreshBtn && sidebarRoot) sidebarRoot.appendChild(refreshBtn);
  if (loadingNode2) loadingNode2.remove();
  // Hide category switching overlay spinner if visible
  const catOverlay = document.getElementById('activitySwitchSpinner');
  if (catOverlay) catOverlay.classList.add('hidden');
  // Rebind Activity info toggle to ensure it works after re-render
  const infoBtn = document.getElementById('activityInfoBtn');
  const infoCard = document.getElementById('activityInfoCard');
  if (infoBtn && infoCard) {
    infoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      infoCard.classList.toggle('hidden');
    });
  }
  // Rebind leaderboard close button if panel was cloned
  document.getElementById('closeLeaderboard')?.addEventListener('click', () => {
    document.getElementById('activityLeaderboardPanel')?.classList.add('hidden');
  });
  // Re-initialize community picker interactions after re-attach
  setTimeout(() => window.initCommunityPicker?.(), 0);
  // Ensure form visible for logged-in users
  window.ensurePostFormsVisibility?.();
}

// Call this to load
function loadActivity() {
  const cat = (window.activityFilter || 'general');
  const url = `${window.SHEET_API_URL}?type=getPosts&category=${encodeURIComponent(cat)}&callback=handleActivity`;
  jsonp(url);
}

// Create the Activity post form if it is missing (defensive)
function ensureActivityPostFormNode() {
  let form = document.getElementById('activityPostForm');
  if (form) return;
  const feed = document.getElementById('activityContent');
  if (!feed) return;
  form = document.createElement('form');
  form.id = 'activityPostForm';
  form.className = 'absolute bottom-0 left-0 right-0 flex items-center gap-3 px-4 py-3 bg-black/70 backdrop-blur-sm border-t border-yellow-500/20';
  form.innerHTML = `
    <input id="postInput" type="text" placeholder="Write your post..." required class="flex-1 p-3 text-sm rounded-full bg-zinc-900 border border-yellow-500/30 text-yellow-300 placeholder-yellow-600 focus:outline-none" />
    <button type="submit" class="p-3 bg-yellow-500 rounded-full shadow-md hover:bg-yellow-600 active:scale-95 transition">
      <i data-lucide="send" class="w-5 h-5 text-black"></i>
    </button>
  `;
  feed.appendChild(form);
  bindActivityPostForm?.();
  window.lucide?.createIcons?.();
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
    // Count this as daily activity for streaks (first time per day only)
    try { pingDailyStreakForCurrentUser?.(); } catch {}
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

// Affiliates join callback
window.handleAffiliateResponse = function (data) {
  if (data && data.success) {
    alert('✅ Thanks for joining the Affiliates program!');
    document.getElementById('affiliatesModal')?.classList.add('hidden');
  } else {
    alert('❌ Could not join right now. Please try again.');
  }
}

function bindMarketplacePostForm() {
  const form = document.getElementById('marketplacePostForm');
  const input = document.getElementById('marketplacePostInput');

  if (!form || !input) return;

  const startedAt = Date.now();

  form.addEventListener('submit', e => {
    e.preventDefault();

    // timing and rate limits
    if (Date.now() - startedAt < 1500) return alert('Please wait a moment before posting.');
    const now = Date.now();
    if (now - (_rate.posts || 0) < 30000) return alert('You are posting too fast. Please wait.');

    const raw = input.value || '';
    const text = raw.replace(/[<>]/g, '').trim().slice(0, 500);
    if (!text) return;

    const username = localStorage.getItem('memberName') || localStorage.getItem('username') || 'Anonymous';
    const category = window.marketplaceFilter || 'jobs';

    window.post('post', {
      username,
      post: text,
      category
    });

    input.value = '';
    _rate.posts = now;
  });
}

function bindActivityPostForm() {
  const form = document.getElementById('activityPostForm');
  const input = document.getElementById('postInput');

  if (!form || !input) return;

  const startedAt = Date.now();

  form.addEventListener('submit', e => {
    e.preventDefault();

    if (Date.now() - startedAt < 1500) return alert('Please wait a moment before posting.');
    const now = Date.now();
    if (now - (_rate.posts || 0) < 30000) return alert('You are posting too fast. Please wait.');

    const raw = input.value || '';
    const text = raw.replace(/[<>]/g, '').trim().slice(0, 500);
    if (!text) return;

    const username = localStorage.getItem('memberName') || 'Anonymous';
    const category = (window.activityFilter || 'general');
    window.post('post', {
      username,
      post: text,
      category
    });

    input.value = '';
    _rate.posts = now;
  });
}

  function bindUIButtons() {
    console.log('🔗 bindUIButtons() running');

  // Bottom nav active state helper
  window.setActiveNav = function setActiveNav(id) {
    try {
      document.querySelectorAll('#bottom-nav .pill-item').forEach(el => el.classList.remove('active'));
      const btn = document.getElementById(id);
      if (!btn) return;
      const wrap = btn.closest('.pill-item');
      if (wrap) wrap.classList.add('active');
    } catch {}
  };

  bindSubmissionForm();
  // Also bind a fallback Add Location form if present
  try { bindLocationFormFallback(); } catch {}
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

  // Verification modal open/close
  document.querySelectorAll('.openVerificationBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('verificationModal')?.classList.remove('hidden');
      document.getElementById('profileMenu')?.classList.add('hidden');
    });
  });
  document.getElementById('closeVerification')?.addEventListener('click', () => {
    document.getElementById('verificationModal')?.classList.add('hidden');
  });
  document.getElementById('verificationApplyBtn')?.addEventListener('click', () => {
    // Reuse request modal plumbing with Verification type
    window.selectedRequestType = 'Verification';
    const titleEl = document.getElementById('requestModalTitle');
    if (titleEl) titleEl.textContent = 'Request Verification';
    // Ensure request fields exist
    window.upgradeRequestModal?.();
    document.getElementById('verificationModal')?.classList.add('hidden');
    document.getElementById('requestModal')?.classList.remove('hidden');
  });


  document.getElementById('requestsBtn')?.addEventListener('click', () => {
    document.getElementById('requestsSubMenu')?.classList.toggle('hidden');
  });

  // Request help toggle
  const helpBtn = document.getElementById('requestHelpBtn');
  const helpCard = document.getElementById('requestHelpCard');
  if (helpBtn && helpCard) {
    helpBtn.addEventListener('click', () => helpCard.classList.toggle('hidden'));
    document.getElementById('closeRequestModal')?.addEventListener('click', () => helpCard.classList.add('hidden'));
    document.getElementById('cancelRequest')?.addEventListener('click', () => helpCard.classList.add('hidden'));
  }

  // Info toggles for Activity, Entertainment, Marketplace
  const infoPairs = [
    ['activityInfoBtn', 'activityInfoCard'],
    ['entertainmentInfoBtn', 'entertainmentInfoCard'],
    ['marketplaceInfoBtn', 'marketplaceInfoCard']
  ];
  infoPairs.forEach(([btnId, cardId]) => {
    const btn = document.getElementById(btnId);
    const card = document.getElementById(cardId);
    if (!btn || !card) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      card.classList.toggle('hidden');
    });
  });

  // Delegated fallback so help buttons always work after dynamic updates or focus changes
  document.addEventListener('click', (e) => {
    const map = {
      activityInfoBtn: 'activityInfoCard',
      entertainmentInfoBtn: 'entertainmentInfoCard',
      marketplaceInfoBtn: 'marketplaceInfoCard'
    };
    const target = e.target.closest('#activityInfoBtn, #entertainmentInfoBtn, #marketplaceInfoBtn');
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    const id = target.id;
    const cardId = map[id];
    const card = document.getElementById(cardId);
    if (card) card.classList.toggle('hidden');
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
      // Upgrade/fix modal fields and clear values
      window.upgradeRequestModal?.();
      const msgEl = document.getElementById('requestMessage');
      if (msgEl) msgEl.value = '';
      const nEl = document.getElementById('requestName'); if (nEl) nEl.value = '';
      const eEl = document.getElementById('requestEmail'); if (eEl) eEl.value = '';
      const numEl = document.getElementById('requestNumber'); if (numEl) numEl.value = '';
      document.getElementById('requestModal')?.classList.remove('hidden');
    });
  });

  document.getElementById('cancelRequest')?.addEventListener('click', () => {
    document.getElementById('requestModal')?.classList.add('hidden');
  });

  document.getElementById('closeRequestModal')?.addEventListener('click', () => {
    document.getElementById('requestModal')?.classList.add('hidden');
  });

  // Admin Panel bindings
  try {
    document.getElementById('adminPanelBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.openAdminPanel?.();
    });
    document.getElementById('closeAdminPanel')?.addEventListener('click', () => {
      document.getElementById('adminPanel')?.classList.add('hidden');
      // Restore FAB selector after closing admin panel
      document.getElementById('floatingLocateBtn')?.classList.remove('hidden');
    });
    document.getElementById('adminPanel')?.addEventListener('click', (ev) => {
      if (ev.target && ev.target.id === 'adminPanel') {
        document.getElementById('adminPanel')?.classList.add('hidden');
        document.getElementById('floatingLocateBtn')?.classList.remove('hidden');
      }
    });
  } catch {}

  // ───────── Profile photo control (pencil) ─────────
  const editAvatar = document.getElementById('editAvatarBtn');
  if (editAvatar) {
    editAvatar.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const name = (localStorage.getItem('memberName') || '').trim();
      if (!name) return alert('Please log in first.');
      const choice = prompt('Paste an image URL (https://…) or leave blank to select a local file.');
      let url = (choice || '').trim();
      if (!url) {
        // Fallback: pick local file and convert to data URL (small images only)
        try {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = () => {
            const file = input.files && input.files[0];
            if (!file) return;
            if (file.size > 400 * 1024) {
              alert('Please choose an image under 400KB (for now).');
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result;
              try {
                localStorage.setItem('memberAvatarUrl', dataUrl);
                updateMemberDirectory(name, { avatarUrl: dataUrl });
                showMemberOptions();
              } catch (e) {
                alert('Could not save photo to local storage.');
              }
            };
            reader.readAsDataURL(file);
          };
          input.click();
        } catch (e) {
          alert('Could not open file picker. Please paste a URL instead.');
        }
        return;
      }
      // Basic URL validation
      if (!/^https?:\/\//i.test(url) && !url.startsWith('data:image/')) {
        return alert('Please enter a valid image URL (https://...) or choose a file.');
      }
      try {
        localStorage.setItem('memberAvatarUrl', url);
        updateMemberDirectory(name, { avatarUrl: url });
        showMemberOptions();
      } catch (e) {
        alert('Could not save photo.');
      }
    });
  }

  // Long‑press on avatar triggers the same edit flow
  const avatarEl = document.getElementById('memberAvatar');
  if (avatarEl && editAvatar) {
    let lpTimer = null;
    const startLP = () => {
      clearTimeout(lpTimer);
      lpTimer = setTimeout(() => { try { editAvatar.click(); } catch {} }, 600);
    };
    const cancelLP = () => { clearTimeout(lpTimer); lpTimer = null; };
    avatarEl.addEventListener('mousedown', startLP);
    avatarEl.addEventListener('touchstart', startLP, { passive: true });
    avatarEl.addEventListener('mouseup', cancelLP);
    avatarEl.addEventListener('mouseleave', cancelLP);
    avatarEl.addEventListener('touchend', cancelLP);
    avatarEl.addEventListener('touchcancel', cancelLP);
  }

  document.getElementById('submitRequest')?.addEventListener('click', () => {
    // Ensure upgraded fields
    window.upgradeRequestModal?.();

    // Honeypot
    const hp = document.getElementById('hp-request');
    if (hp && hp.value) return alert('Request blocked.');

    // Basic throttling
    const now = Date.now();
    if (now - (_rate.requests || 0) < 45000) return alert('Please wait before sending another request.');

    const sanitize = (s='') => s.replace(/[<>]/g, '').trim();
    const name = sanitize(document.getElementById('requestName')?.value || '').slice(0,120);
    const email = sanitize(document.getElementById('requestEmail')?.value || '').slice(0,160);
    const number = sanitize(document.getElementById('requestNumber')?.value || '').slice(0,40);
    const message = sanitize(document.getElementById('requestMessage')?.value || '').slice(0,600);
    const actor = localStorage.getItem('memberName') || name || 'Anonymous';
    const type = window.selectedRequestType || 'Verification';

    if (!message) return alert('Please write a message before submitting.');

    // Standardize to Apps Script contract: type=request + requestType
    const params = new URLSearchParams({
      type: 'request',
      requestType: type,
      member: actor,
      name,
      email,
      number,
      message,
      callback: 'handleRequestResponse'
    });

    _rate.requests = now;
    jsonp(`${window.SHEET_API_URL}?${params.toString()}`);
  });

  document.getElementById('submitFeedback')?.addEventListener('click', () => {
    // Honeypot
    const hp = document.getElementById('hp-feedback');
    if (hp && hp.value) return alert('Feedback blocked.');

    const now = Date.now();
    if (now - (_rate.feedback || 0) < 45000) return alert('Please wait before sending another feedback.');

    const msg = (document.getElementById('feedbackMessage').value || '').replace(/[<>]/g, '').trim().slice(0, 600);
    if (!msg) return alert('Please enter a message.');
    _rate.feedback = now;
    jsonp(`${window.SHEET_API_URL}?type=feedback&message=${encodeURIComponent(msg)}&callback=handleFeedbackResponse`);
  });

  document.getElementById('cancelFeedback')?.addEventListener('click', () => {
    document.getElementById('feedbackModal')?.classList.add('hidden');
  });

  document.querySelectorAll('.closeBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal')?.classList.add('hidden');
    });
  });

  // Password reveal toggles (eye/eye-off)
  const togglePwd = (inputId, btnId) => {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (!input || !btn) return;
    btn.addEventListener('click', () => {
      const isPw = input.type === 'password';
      input.type = isPw ? 'text' : 'password';
      btn.innerHTML = isPw ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
      window.lucide?.createIcons?.();
    });
  };
  togglePwd('numberInput', 'toggleLoginPwd');
  togglePwd('signupPassword', 'toggleSignupPwd');

  // Affiliates modal open
  document.getElementById('affiliatesBtn')?.addEventListener('click', () => {
    const modal = document.getElementById('affiliatesModal');
    modal?.classList.remove('hidden');
    // reset honeypot + email on open to avoid autofill false positives
    const hp = document.getElementById('hp-affiliate');
    if (hp) hp.value = '';
    const em = document.getElementById('affiliateEmail');
    if (em) em.value = '';
  });
  // Affiliates modal close
  document.getElementById('cancelAffiliate')?.addEventListener('click', () => {
    document.getElementById('affiliatesModal')?.classList.add('hidden');
  });
  // Join affiliates via JSONP
  document.getElementById('joinAffiliate')?.addEventListener('click', () => {
    const email = (document.getElementById('affiliateEmail')?.value || '').trim();
    if (!email) return alert('Enter your email.');
    // Do not block based on honeypot to avoid autofill false positives
    const url = `${window.SHEET_API_URL}?type=joinAffiliate&email=${encodeURIComponent(email)}&callback=handleAffiliateResponse`;
    jsonp(url);
  });

  document.getElementById('marketplaceBtn')?.addEventListener('click', () => {
    window.setActiveNav?.('marketplaceBtn');
    // Close other sidebars first, then open marketplace
    document.getElementById('activitySidebar')?.classList.add('translate-x-full');
    document.getElementById('entertainmentSidebar')?.classList.add('translate-x-full');
    window.updateLockedOverlays?.();
    document.getElementById('marketplaceSidebar')?.classList.remove('translate-x-full');
    if (window.isLoggedIn?.()) {
      loadMarketplace();
      setTimeout(() => window.ensurePostFormsVisibility?.(), 0);
    }
  });

  // Support multiple filterPanel instances defensively
  // Filter panel toggling is handled via delegated click listener below

  document.getElementById('profileToggle')?.addEventListener('click', () => {
    const pm = document.getElementById('profileMenu');
    if (!pm) return;
    const opening = pm.classList.contains('hidden');
    if (opening) {
      window.setActiveNav?.('profileToggle');
      // Close sidebars when opening profile
      document.getElementById('marketplaceSidebar')?.classList.add('translate-x-full');
      document.getElementById('activitySidebar')?.classList.add('translate-x-full');
      document.getElementById('entertainmentSidebar')?.classList.add('translate-x-full');
      // Refresh avatar/name on open
      try { showMemberOptions(); } catch {}
      pm.classList.remove('hidden');
      window.updateLockedOverlays?.();
      // Refresh follow counts when opening profile
      try { refreshFollowCounts(); } catch {}
      // Update inbox badge and optionally refresh from backend
      try { updateInboxBadge(); refreshInbox?.(); } catch {}
      // Prevent clicks passing through to FAB while profile menu is open
      try { pm.addEventListener('click', (e) => { e.stopPropagation(); }, { passive: true }); } catch {}
    } else {
      pm.classList.add('hidden');
    }
  });
  document.getElementById('profileLoginBtn')?.addEventListener('click', () => {
  document.getElementById('loginModal')?.classList.remove('hidden');
});
  document.querySelectorAll('#themeToggleBtn,#themeToggleBtnGuest').forEach(btn => {
    btn.addEventListener('click', () => window.toggleTheme?.());
  });
  // Direct bindings for controls inside profile menu (propagation may be stopped on container)
  try {
    const inboxBtn = document.getElementById('inboxBtn');
    if (inboxBtn) {
      inboxBtn.addEventListener('click', (e) => {
        try { e.preventDefault(); e.stopPropagation(); } catch {}
        const p = document.getElementById('inboxPanel');
        if (p && !p.classList.contains('hidden')) { p.classList.add('hidden'); }
        else { openInboxPanel(); }
      });
    }
    const fA = document.getElementById('followersCountBtn');
    if (fA) {
      fA.addEventListener('click', (e) => {
        try { e.preventDefault(); e.stopPropagation(); } catch {}
        const panel = document.getElementById('followListPanel');
        if (panel && !panel.classList.contains('hidden')) { panel.classList.add('hidden'); }
        else { showFollowList('followers', fA); }
      });
    }
    const fB = document.getElementById('followingCountBtn');
    if (fB) {
      fB.addEventListener('click', (e) => {
        try { e.preventDefault(); e.stopPropagation(); } catch {}
        const panel = document.getElementById('followListPanel');
        if (panel && !panel.classList.contains('hidden')) { panel.classList.add('hidden'); }
        else { showFollowList('following', fB); }
      });
    }
  } catch {}
  // No guest-only request/favourite/add location entries

  document.getElementById('activityBtn')?.addEventListener('click', () => {
    window.setActiveNav?.('activityBtn');
    window.keepActivityOpen = true;
    document.getElementById('marketplaceSidebar')?.classList.add('translate-x-full');
    document.getElementById('entertainmentSidebar')?.classList.add('translate-x-full');
    document.getElementById('activitySidebar')?.classList.remove('translate-x-full');
    loadActivity?.();
    window.updateLockedOverlays?.();
    setTimeout(() => window.ensurePostFormsVisibility?.(), 0);
  });

  document.getElementById('entertainmentBtn')?.addEventListener('click', () => {
    window.setActiveNav?.('entertainmentBtn');
    document.getElementById('marketplaceSidebar')?.classList.add('translate-x-full');
    if (!window.keepActivityOpen) document.getElementById('activitySidebar')?.classList.add('translate-x-full');
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

  // Leaderboard button placeholder
  document.getElementById('activityLeaderboardBtn')?.addEventListener('click', () => {
    const panel = document.getElementById('activityLeaderboardPanel');
    if (!panel) return;
    const card = document.getElementById('activityCommunityCard');
    // Toggle visibility and load on open
    const opening = panel.classList.contains('hidden');
    if (opening) {
      panel.classList.remove('hidden');
      card?.classList.add('hidden');
      window.loadLeaderboard?.();
    } else {
      panel.classList.add('hidden');
    }
  });
  document.getElementById('closeLeaderboard')?.addEventListener('click', () => {
    document.getElementById('activityLeaderboardPanel')?.classList.add('hidden');
  });

  // Activity header category chips (UI only for now)
  window.activityFilter = window.activityFilter || 'general';
  document.querySelectorAll('.activityCategoryBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-cat');
      window.activityFilter = cat;
      document.querySelectorAll('.activityCategoryBtn').forEach(b => b.classList.remove('active-category'));
      btn.classList.add('active-category');
      // Reload feed with selected category
      const overlay = document.getElementById('activitySwitchSpinner');
      if (overlay) overlay.classList.remove('hidden');
      loadActivity?.();
    });
  });
  // Defensive: ensure post form exists after buttons bound
  ensureActivityPostFormNode?.();
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
      // try to infer likes/comments by conventional column positions (5 = Likes, 6 = Comments)
      const likes = Number.parseInt(r[5], 10) || 0;
      let comments = [];
      try {
        const c = r[6];
        if (typeof c === 'string' && c.trim()) comments = JSON.parse(c);
      } catch (_) { comments = []; }
      const timestamp = r.find(v => /\d{4}-\d{2}-\d{2}|:\d{2}/.test(String(v))) || '';
      return { imageUrl, username, caption, timestamp, likes, comments };
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
    likeBtn.dataset.link = item.imageUrl;
    likeBtn.dataset.count = String(item.likes || 0);
    likeBtn.innerHTML = `<i data-lucide="heart" class="w-4 h-4"></i> <span class="ent-like-count">${item.likes || 0}</span>`;
    likeBtn.addEventListener('click', () => {
      try {
        // keep reference for callback to update UI in place
        window._lastEntLikeBtn = likeBtn;
        const url = `${window.SHEET_API_URL}?type=entertainmentLike&link=${encodeURIComponent(item.imageUrl)}&callback=handleEntertainmentLike`;
        jsonp(url);
      } catch (e) { console.warn('Like failed', e); }
    });

    const commentBtn = document.createElement('button');
    const commentCount = Array.isArray(item.comments) ? item.comments.length : 0;
    commentBtn.className = 'text-yellow-400 hover:text-yellow-200 flex items-center gap-1';
    commentBtn.dataset.link = item.imageUrl;
    commentBtn.dataset.count = String(commentCount);
    commentBtn.innerHTML = `<i data-lucide="message-circle" class="w-4 h-4"></i> <span class="ent-comment-count">${commentCount}</span>`;

    // Inline comment input + list with Load more
    const commentWrap = document.createElement('div');
    commentWrap.className = 'px-3 pb-3';

    const makeLine = (u, tx) => {
      const line = document.createElement('div');
      line.className = 'text-xs text-yellow-200';
      line.innerHTML = `<span class=\"font-semibold text-yellow-400\">${u}:</span> ${tx}`;
      return line;
    };

    const list = document.createElement('div');
    list.className = 'ent-comments-list space-y-1 mt-1';
    commentWrap.appendChild(list);

    const maxInitial = 3;
    const allComments = Array.isArray(item.comments) ? item.comments.slice() : [];
    const visible = allComments.slice(0, maxInitial);
    const hidden = allComments.slice(maxInitial);
    visible.forEach(c => list.appendChild(makeLine(c && c.user ? c.user : 'User', c && c.text ? c.text : '')));

    commentWrap.dataset.hiddenCount = String(hidden.length);
    commentWrap.dataset.expanded = 'false';

    let loadMoreBtn = null;
    if (hidden.length > 0) {
      loadMoreBtn = document.createElement('button');
      loadMoreBtn.className = 'ent-load-more text-[11px] text-yellow-400 hover:text-yellow-200 mt-1';
      loadMoreBtn.textContent = `Load more (${hidden.length})`;
      loadMoreBtn.addEventListener('click', () => {
        hidden.forEach(c => list.appendChild(makeLine(c && c.user ? c.user : 'User', c && c.text ? c.text : '')));
        commentWrap.dataset.hiddenCount = '0';
        commentWrap.dataset.expanded = 'true';
        loadMoreBtn.remove();
      });
      commentWrap.appendChild(loadMoreBtn);
    }
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Write a comment…';
    input.className = 'mt-2 w-full text-sm p-2 bg-zinc-900 border border-yellow-500/40 rounded focus:outline-none focus:ring focus:border-yellow-400 hidden';
    commentWrap.appendChild(input);
    card.appendChild(commentWrap);

    commentBtn.addEventListener('click', () => {
      input.classList.toggle('hidden');
      if (!input.classList.contains('hidden')) input.focus();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const text = input.value.trim();
      if (!text) return;
      const user = localStorage.getItem('memberName') || 'Anonymous';
      try {
        // append to UI immediately
        const expanded = commentWrap.dataset.expanded === 'true';
        const hc = parseInt(commentWrap.dataset.hiddenCount || '0', 10) || 0;
        if (expanded) {
          list.appendChild(makeLine(user, text));
        } else {
          if (list.childElementCount >= maxInitial) {
            const newHidden = hc + 1;
            commentWrap.dataset.hiddenCount = String(newHidden);
            if (!loadMoreBtn) {
              loadMoreBtn = document.createElement('button');
              loadMoreBtn.className = 'ent-load-more text-[11px] text-yellow-400 hover:text-yellow-200 mt-1';
              commentWrap.appendChild(loadMoreBtn);
              loadMoreBtn.addEventListener('click', () => {
                commentWrap.dataset.expanded = 'true';
                commentWrap.dataset.hiddenCount = '0';
                loadMoreBtn.remove();
              });
            }
            loadMoreBtn.textContent = `Load more (${newHidden})`;
          } else {
            list.appendChild(makeLine(user, text));
          }
        }
        // bump count
        const cnt = commentBtn.querySelector('.ent-comment-count');
        if (cnt) cnt.textContent = String((parseInt(cnt.textContent || '0', 10) || 0) + 1);
        // keep reference for callback if needed
        window._lastEntComment = { link: item.imageUrl, user, text };
        const url = `${window.SHEET_API_URL}?type=entertainmentComment&link=${encodeURIComponent(item.imageUrl)}&username=${encodeURIComponent(user)}&commentText=${encodeURIComponent(text)}&callback=handleEntertainmentComment`;
        jsonp(url);
      } catch (err) { console.warn('Comment failed', err); }
      input.value = '';
      input.classList.add('hidden');
    });
    left.append(likeBtn, commentBtn);
    actions.append(left);
    card.appendChild(actions);

    feed.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
  console.log(`📸 Rendered ${items.length} entertainment items`);
};

// ─────────── NAV + FAB VISIBILITY ───────────
  // Hide the floating locate button when any sidebar or the profile menu is open
  (function initOverlayAwareVisibility() {
    const locateBtn = document.getElementById('floatingLocateBtn');
    if (!locateBtn) return;

    const sidebars = [
      document.getElementById('activitySidebar'),
      document.getElementById('entertainmentSidebar'),
      document.getElementById('marketplaceSidebar')
    ].filter(Boolean);
    const profileMenu = document.getElementById('profileMenu');

    const update = () => {
      const anyOpen = sidebars.some(el => el && !el.classList.contains('translate-x-full'))
        || (profileMenu && !profileMenu.classList.contains('hidden'));
      if (locateBtn) locateBtn.style.display = anyOpen ? 'none' : 'flex';
    };

    const observer = new MutationObserver(update);
    sidebars.forEach(el => observer.observe(el, { attributes: true, attributeFilter: ['class'] }));
    if (profileMenu) observer.observe(profileMenu, { attributes: true, attributeFilter: ['class'] });

    ['activityBtn','entertainmentBtn','marketplaceBtn','profileToggle'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => setTimeout(update, 0));
    });

    // Initial state
    update();
  })();

// Callbacks for entertainment like/comment
window.handleEntertainmentLike = function (resp) {
  if (resp && resp.success) {
    try {
      const btn = window._lastEntLikeBtn;
      if (btn) {
        const span = btn.querySelector('.ent-like-count');
        if (span) span.textContent = String((parseInt(span.textContent || '0', 10) || 0) + 1);
      }
    } catch (_) {}
    console.log('❤️ Entertainment like saved');
  }
};
window.handleEntertainmentComment = function (resp) {
  if (resp && resp.success) {
    console.log('💬 Entertainment comment saved');
  }
};

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

  // Auto-open onboarding only once per device for logged-out visitors
  function maybeShowOnboardingOnce(force = false) {
    try {
      const logged = !!(
        (localStorage.getItem('memberName') || '').trim() ||
        (localStorage.getItem('username') || '').trim() ||
        (localStorage.getItem('membershipLevel') || '').trim()
      );
      const seen = localStorage.getItem('onboardingShown_v1') === '1';
      if ((!logged && !seen) || force) {
        const show = () => {
          const m = document.getElementById('onboardingModal');
          if (!m) return false;
          m.classList.remove('hidden');
          m.style.display = 'block';
          m.style.opacity = '1';
          m.style.pointerEvents = 'auto';
          try { document.body.classList.add('onboarding-open'); } catch {}
          // mark as shown so it doesn't auto-open again
          try { localStorage.setItem('onboardingShown_v1', '1'); } catch {}
          return true;
        };
        if (!show()) {
          // Wait for modal to be available if components load late
          let tries = 0; const max = 60;
          const tick = () => { if (!show() && tries++ < max) requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
        }
      }
    } catch {}
  }
  // Immediate attempt and again on full load; allow URL param force with ?onboarding=1
  maybeShowOnboardingOnce();
  window.addEventListener('load', () => {
    const force = (() => { try { return new URL(window.location.href).searchParams.get('onboarding') === '1'; } catch { return false; } })();
    maybeShowOnboardingOnce(force);
  });


function setupApp() {
  // Ensure we read the authoritative flag and avoid shadowed globals
  try { checkPremiumStatus(); } catch {}
  console.log('🧠 isPremium:', window.isPremium);

  if (!document.getElementById('map')) return;

  // global map variable
  mapboxgl.accessToken = 'pk.eyJ1IjoiaG93ZWxsdHJ1c3QiLCJhIjoiY21iZ3FtNGdqMDF4YjJsc2d4Z3JwZGJ2MiJ9.8u6Y-_RYGb-qxODBGT5-LA';
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/howelltrust/cmbkwcx8f00oq01qw9wxy8uw4',
    center: [0.3, 50.95],
    zoom: 9
  });

  // Keep projection in sync when viewport changes size
  try {
    window.addEventListener('resize', () => { try { map.resize(); } catch {} });
  } catch {}

  // Smooth pulsating glow for verified + event halos
  if (typeof window.startGlowPulse !== 'function') {
    window._glowPulseStarted = false;
    window.startGlowPulse = function () {
      if (window._glowPulseStarted) return; // one loop only
      window._glowPulseStarted = true;
      let t = 0;
      const step = () => {
        try {
          if (!map || !map.getLayer('places')) { window._glowPulseStarted = false; return; }
          t += 0.05;
          const z = typeof map.getZoom === 'function' ? map.getZoom() : 12;
          // Base radius by zoom (kept modest)
          let base = 8; if (z > 9) base = 10; if (z > 11) base = 12; if (z > 13) base = 14; if (z > 15) base = 18;
          const vRadius = base * (1 + 0.28 * Math.sin(t));
          const eRadius = (base * 0.95) * (1 + 0.35 * Math.sin(t + 0.6));
          const vOpacity = 0.38 + 0.18 * Math.abs(Math.sin(t));
          const eOpacity = 0.38 + 0.2 * Math.abs(Math.sin(t + 0.6));
          map.setPaintProperty('places-verified-glow', 'circle-radius', vRadius);
          map.setPaintProperty('places-verified-glow', 'circle-opacity', vOpacity);
          map.setPaintProperty('places-event-glow', 'circle-radius', eRadius);
          map.setPaintProperty('places-event-glow', 'circle-opacity', eOpacity);
        } catch {}
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
  }
  

  // 🔥 Fetch and add markers AFTER map is initialized
  fetch('locations.geojson')
    .then(res => res.json())
    .then(data => {
      const exec = () => {
      originalGeoData = data;
      // If a community is already selected, zoom to it
      const savedCommunity = localStorage.getItem('memberCommunity');
      if (savedCommunity) zoomToCommunity(savedCommunity);

      const categories = new Set();
originalGeoData.features.forEach(f => {
  if (f.properties.category) categories.add(f.properties.category);
});

const filterBox = document.getElementById('categoryFilters');
// Expose icon map + categories + a repopulate helper for late-loaded panels
window.categoryIconMap = {
    cafes: '☕️',
    pubs: '🍺',
    pub: '🍺',
    events: '🎪',
    reports: '🚩',
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
window.mapCategories = [...categories].sort();
// Try to populate immediately (in case panel is already present)
setTimeout(() => window.populateCategoryFilters?.(), 0);
// Also populate Add Location category selects (submission + fallback)
setTimeout(() => window.populateCategorySelects?.(), 0);
window.populateCategoryFiltersInto = function (box) {
  if (!box) return;
  const cats = (Array.isArray(window.mapCategories) && window.mapCategories.length)
    ? window.mapCategories
    : (Array.isArray(DEFAULT_CATEGORIES) ? DEFAULT_CATEGORIES : []);
  if (!cats.length) return;
  box.innerHTML = '';
  cats.forEach(cat => {
    const safeId = `filter-${cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';
    const icon = (window.categoryIconMap || {})[cat.toLowerCase()] || '📍';
    const label = document.createElement('label');
    label.className = 'group flex flex-1 items-center gap-3 rounded-xl border border-yellow-500/20 bg-black/60 px-3 py-2 text-xs text-yellow-200 transition hover:border-yellow-400';
    label.innerHTML = `
      <input id="${safeId}" type="checkbox" value="${cat}" onchange="window.handleCategoryToggle(event)" checked class="peer sr-only">
      <span class="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-500/10 text-base">${icon}</span>
      <span class="flex-1 font-medium capitalize tracking-[0.05em]">${cat}</span>
      <span class="tg-toggle relative inline-flex h-6 w-11 items-center rounded-full bg-yellow-500/20 transition-[background,box-shadow] duration-300 ease-out peer-checked:bg-yellow-500 peer-checked:shadow-[0_0_12px_rgba(250,204,21,0.45)]">
        <span class="tg-knob inline-block h-5 w-5 translate-x-1 rounded-full bg-yellow-200 shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] peer-checked:translate-x-5 peer-checked:bg-black"></span>
      </span>`;
    const onlyBtn = document.createElement('button');
    onlyBtn.type = 'button';
    onlyBtn.textContent = 'Only';
    onlyBtn.className = 'text-[10px] uppercase tracking-[0.25em] text-yellow-500/80 hover:text-yellow-200 transition px-2 py-1 rounded-full border border-yellow-500/20 bg-black/40';
    onlyBtn.addEventListener('click', e => { e.stopPropagation(); window.setExclusiveCategory(cat); });
    row.append(label, onlyBtn);
    box.appendChild(row);
  });
};

window.populateCategoryFilters = function () {
  window.populateCategoryFiltersInto(document.getElementById('categoryFilters'));
}
if (filterBox) {
  window.populateCategoryFilters();
}

      // Render as a symbol layer for pixel-perfect stability
      try {
        if (!map.getSource('places')) {
          map.addSource('places', { type: 'geojson', data });
        } else {
          map.getSource('places').setData(data);
        }
        const addLayerNow = () => {
          // Remove existing layers if present
          try { map.removeLayer('places'); } catch {}
          try { map.removeLayer('places-verified-glow'); } catch {}
          try { map.removeLayer('places-event-glow'); } catch {}

          // Soft gold glow for verified
          map.addLayer({
            id: 'places-verified-glow',
            type: 'circle',
            source: 'places',
            filter: ['==', ['get', 'verified'], true],
            paint: {
              'circle-color': 'rgba(253, 224, 71, 1.0)',
              'circle-blur': 2.0,
              'circle-opacity': 0.5,
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 8, 10, 12, 14, 16, 16, 20]
            }
          });

          // Pink halo for events
          map.addLayer({
            id: 'places-event-glow',
            type: 'circle',
            source: 'places',
            filter: ['match', ['downcase', ['to-string', ['get', 'category']]], ['events','event'], true, false],
            paint: {
              'circle-color': 'rgba(236, 72, 153, 1.0)',
              'circle-blur': 2.0,
              'circle-opacity': 0.5,
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 7, 10, 10, 14, 14, 16, 18]
            }
          });

          // Main symbol layer, pick icon per category and scale by zoom
          // Keep a clear, consistent icon size across zooms
          const baseSize = 0.06;
          map.addLayer({
            id: 'places',
            type: 'symbol',
            source: 'places',
            layout: {
              'icon-image': ['match', ['downcase', ['to-string', ['get', 'category']]], ['events','event'], 'gr-event', 'gr-flower'],
              'icon-size': ['*', baseSize, ['case', ['boolean', ['get', 'verified'], false], 1.15, 1]],
              'icon-anchor': 'bottom',
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              'icon-pitch-alignment': 'map',
              'icon-rotation-alignment': 'map',
              'symbol-sort-key': ['case', ['boolean', ['get', 'verified'], false], 10, 0]
            }
          });
        };
        // Ensure both images are available (flower + event)
        const ensureImages = (cb) => {
          const needFlower = !map.hasImage('gr-flower');
          const needEvent = !map.hasImage('gr-event');
          let pending = (needFlower?1:0) + (needEvent?1:0);
          if (pending === 0) { cb(); return; }
          const done = () => { pending -= 1; if (pending <= 0) cb(); };
          if (needFlower) {
            map.loadImage('flower.png', (err, img) => {
              if (!err && img) { try { map.addImage('gr-flower', img, { sdf: false }); } catch {} }
              done();
            });
          }
          if (needEvent) {
            map.loadImage('events.icon.png', (err, img) => {
              if (!err && img) { try { map.addImage('gr-event', img, { sdf: false }); } catch {} }
              done();
            });
          }
        };
        ensureImages(addLayerNow);

        // Start glow pulse animation once layers exist
        setTimeout(() => { try { window.startGlowPulse?.(); } catch {} }, 100);
        // Click handler: build and show popup at feature coordinates
        const buildPopupHTML = (feature) => {
          const title = feature.properties.title || '';
          const isTablehurst = /tablehurst\s*farm/i.test(title);
          const isTradeAutos = /trade\s*price\s*autos/i.test(title);
          const safeTitle = title.replace(/'/g, "\\'");
          const [lon, lat] = feature.geometry.coordinates || [0,0];
          const rawCat = (feature.properties.category || '').toString();
          const catKey = rawCat.toLowerCase();
          const catIcon = ((window.categoryIconMap || {})[catKey]) || '📍';
          let html = `
  <div class="custom-popup">
    <button class="share-btn" onclick="copyPinLink(${lat}, ${lon}, '${safeTitle}')" title="Share"><i data-lucide="share-2" class="w-4 h-4"></i></button>
    <button class="favourite-btn" onclick="addToFavourites('${safeTitle}')" title="Save"><i data-lucide="heart" class="w-4 h-4"></i></button>
    <button class="close-btn" onclick="this.closest('.mapboxgl-popup')?.remove()"><i data-lucide="x" class="w-4 h-4"></i></button>
    <div class="title">${title}</div>
    ${rawCat ? `<div class=\"category\">${catIcon} <span>${rawCat}</span></div>` : ''}
    ${feature.properties.description ? `<div class=\"desc\">${feature.properties.description}</div>` : ''}
    <div class="actions"><button onclick="openDirections(${lat}, ${lon}, '${safeTitle}')"><i data-lucide="navigation"></i> Directions</button></div>
  </div>`;
          if (isTablehurst) {
            html = `
  <div class="vcard">
    <div class="vcard-top">
      <span class="vbadge"><i>🌹</i> Verified Farm</span>
      <button class="vicon share" title="Share" onclick="copyPinLink(${lat}, ${lon}, '${safeTitle}')"><i data-lucide=\"share-2\"></i></button>
      <button class="vicon fav" title="Save" onclick="addToFavourites('${safeTitle}')"><i data-lucide=\"heart\"></i></button>
      <button class="vicon close" title="Close" onclick="this.closest('.mapboxgl-popup')?.remove()"><i data-lucide=\"x\"></i></button>
    </div>
    <div class="vgrid">
      <div class="vhero" style="background-image:url('${TABLEHURST_DETAILS.image}')"></div>
      <div class="vbody">
        <div class="vtitle">${title}</div>
        <div class="vdesc">${TABLEHURST_DETAILS.description}</div>
        <div class="vmeta"><i data-lucide=\"clock-3\"></i><span>${TABLEHURST_DETAILS.hours}</span></div>
      </div>
    </div>
    <div class="vactions">
      <button class="vbtn" onclick="openDirections(${lat}, ${lon}, '${safeTitle}')"><i data-lucide=\"navigation\"></i><span>Directions</span></button>
      <button class="vbtn vprimary" onclick="window.open('${TABLEHURST_DETAILS.website}', '_blank')"><span>Visit Site</span></button>
    </div>
  </div>`;
          } else if (isTradeAutos) {
            html = `
  <div class="vcard">
    <div class="vcard-top">
      <span class="vbadge"><i>🌹</i> Verified Shop</span>
      <button class="vicon share" title="Share" onclick="copyPinLink(${lat}, ${lon}, '${safeTitle}')"><i data-lucide=\"share-2\"></i></button>
      <button class="vicon fav" title="Save" onclick="addToFavourites('${safeTitle}')"><i data-lucide=\"heart\"></i></button>
      <button class="vicon close" title="Close" onclick="this.closest('.mapboxgl-popup')?.remove()"><i data-lucide=\"x\"></i></button>
    </div>
    <div class="vgrid">
      <div class="vhero" style="background-image:url('${TRADEPRICE_DETAILS.image}')"></div>
      <div class="vbody">
        <div class="vtitle">${title}</div>
        <div class="vdesc">${TRADEPRICE_DETAILS.description}</div>
        <div class="vmeta"><i data-lucide=\"clock-3\"></i><span>${TRADEPRICE_DETAILS.hours}</span></div>
      </div>
    </div>
    <div class="vactions">
      <button class="vbtn" onclick="openDirections(${lat}, ${lon}, '${safeTitle}')"><i data-lucide=\"navigation\"></i><span>Directions</span></button>
      <button class="vbtn vprimary" onclick="window.open('${TRADEPRICE_DETAILS.website}', '_blank')"><span>Visit Site</span></button>
    </div>
  </div>`;
          }
          return html;
        };
        map.on('click', 'places', (e) => {
          const feat = e.features && e.features[0];
          if (!feat) return;
          const coords = feat.geometry.coordinates.slice();
          new mapboxgl.Popup({ closeButton: false, anchor: 'bottom', offset: 28 })
            .setLngLat(coords)
            .setHTML(buildPopupHTML(feat))
            .addTo(map);
          setTimeout(() => window.lucide?.createIcons?.(), 80);
        });
      } catch (err) {
        console.warn('⚠️ Falling back to DOM markers due to layer error', err);
      }

      // Build lightweight list for search/flyTo
      geoMarkers = [];
      data.features.forEach(feature => {
        const coordsRaw = feature && feature.geometry && Array.isArray(feature.geometry.coordinates)
          ? feature.geometry.coordinates : null;
        if (!coordsRaw) return;
        const lon = Number(coordsRaw[0]);
        const lat = Number(coordsRaw[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        const normalize = (s='') => s.toLowerCase().normalize('NFKD').replace(/[’'`]/g,'').replace(/[^\p{L}\p{N} ]+/gu,' ').replace(/\s+/g,' ').trim();
        geoMarkers.push({ title: normalize(feature.properties.title || ''), coords: [lon,lat], marker: null, feature });
      });

      if (window.lucide) lucide.createIcons();

      // Optional: also populate category filters here
      };
      try {
        if (!(map && map.isStyleLoaded && map.isStyleLoaded())) { map.once('load', exec); return; }
      } catch (_) {}
      exec();
    });
  
  // Handle shared pin deep‑links: ?lat=..&lng=..&title=..
  try {
    const params = new URL(window.location.href).searchParams;
    const plat = parseFloat(params.get('lat'));
    const plng = parseFloat(params.get('lng'));
    const ptitle = (params.get('title') || '').toString();
    if (!Number.isNaN(plat) && !Number.isNaN(plng)) {
      const center = [plng, plat];
      try { map.flyTo({ center, zoom: 15 }); } catch {}
      // Try to find closest loaded feature to reuse full popup UI
      let chosen = null;
      try {
        const dist2 = (a,b) => { const dx=a[0]-b[0], dy=a[1]-b[1]; return dx*dx+dy*dy; };
        let best = Infinity;
        for (const m of geoMarkers) {
          const d = dist2(m.coords, center);
          if (d < best) { best = d; chosen = m.feature; }
        }
      } catch {}
      const html = chosen ? buildPopupHTML(chosen) : `<div class=\"custom-popup\"><div class=\"title\">${ptitle || 'Location'}</div><div class=\"actions\"><button onclick=\"openDirections(${plat}, ${plng}, '${(ptitle||'').replace(/'/g, "\\'")}')\"><i data-lucide=\\"navigation\\"></i> Directions</button></div></div>`;
      new mapboxgl.Popup({ closeButton: false, anchor: 'bottom', offset: 28 })
        .setLngLat(center)
        .setHTML(html)
        .addTo(map);
      setTimeout(() => window.lucide?.createIcons?.(), 80);
    }
  } catch {}

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
  // Initialize the FAB multi‑picker (default action: locate)
  initFabMultiPicker();

  

  if (localStorage.getItem('membershipLevel')) setTimeout(() => showMemberOptions(), 0);

  // 🔍 Category Filters (using symbol layer filter)
  window.filterByCategory = () => {
    const checked = Array.from(document.querySelectorAll('#categoryFilters input:checked')).map(i => i.value);
    const filter = (!checked.length)
      ? ['==', ['get', 'category'], '___none___']
      : ['in', ['get', 'category'], ['literal', checked]];
    try { map.setFilter('places', filter); } catch {}
    try { map.setFilter('places-verified-glow', filter); } catch {}
    try { map.setFilter('places-event-glow', filter); } catch {}
  };

  // Show all markers
  window.showAllLocations = () => {
    document.querySelectorAll('#categoryFilters input[type="checkbox"]').forEach(cb => { cb.checked = true; });
    try { map.setFilter('places', null); } catch {}
    try { map.setFilter('places-verified-glow', null); } catch {}
    try { map.setFilter('places-event-glow', null); } catch {}
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
  let streak = stored.streak;
  let community = stored.community;
  let status = stored.status;
  let avatarUrl = stored.avatarUrl;

  // Treat as current user if keys match closely (email vs display name etc.)
  const localKeyBase = currentKey.split('@')[0] || currentKey;
  if (key === currentKey || key === localKeyBase || (!key && currentKey) || localKeyBase === key) {
    const localStreak = parseInt(localStorage.getItem('streak') || '0', 10);
    if (!Number.isNaN(localStreak)) streak = localStreak;
    community = localStorage.getItem('memberCommunity') || community;
    status = localStorage.getItem('memberCommunityStatus') || status;
    avatarUrl = localStorage.getItem('memberAvatarUrl') || avatarUrl;
  }

  return {
    displayName: stored.displayName || name || record.username || record.name || (localNameRaw || 'Member'),
    level: (record.level || 'free').toString(),
    streak: typeof streak === 'number' ? streak : (streak ? Number(streak) : 0),
    community: community || 'No community selected',
    status: status || 'Guest',
    avatarUrl: avatarUrl || record.avatarUrl || ''
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
        <div class="flex items-center gap-2">
          <h3 class="text-base font-semibold text-yellow-100" id="memberCardName">${profile.displayName}</h3>
          <span id="memberCardStreakChip" class="hidden text-[11px] inline-flex items-center gap-1 rounded-full border border-yellow-500/30 px-2 py-0.5 text-yellow-300"></span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button id="memberCardMessageBtn" class="rounded-full border border-yellow-500/40 w-8 h-8 flex items-center justify-center text-yellow-300 hover:bg-yellow-500 hover:text-black transition" title="Message">
          <i data-lucide="send" class="w-4 h-4"></i>
        </button>
        <button id="memberCardFollowBtn" class="rounded-full border border-yellow-500/40 px-3 py-1 text-[12px] text-yellow-300 hover:bg-yellow-500 hover:text-black transition">
          Follow
        </button>
      </div>
    </div>
    <div class="grid gap-2 text-xs text-yellow-200">
      <div class="flex items-center justify-between">
        <span class="text-yellow-500/80">Streak</span>
        <span class="font-semibold text-yellow-100" id="memberCardStreak">${profile.streak ?? 0} day${(profile.streak||0)===1?'':'s'}</span>
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
    <div id="memberCardBadges" class="flex flex-wrap gap-1 pt-2"></div>
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
  window._memberCardTarget = normalizeUserName(requestedUser);
  window._memberCardDisplayName = requestedUser;
  jsonp(url);
  renderBadgeChips(requestedUser, card.querySelector('#memberCardBadges'));
  // Ensure icons render for the new message button
  window.lucide?.createIcons?.();

  // Init follow button label/state and behavior
  const followBtn = card.querySelector('#memberCardFollowBtn');
  if (followBtn) {
    const me = (localStorage.getItem('memberName') || '').trim();
    const target = (window._memberCardDisplayName || name || '').trim();
    const isSelf = me && target && me.toLowerCase() === target.toLowerCase();
    if (!isSelf) {
      const isFollowing = !!(window._followingSet && window._followingSet.has(normalizeUserName(target)));
      followBtn.textContent = isFollowing ? 'Following' : 'Follow';
      followBtn.dataset.state = isFollowing ? 'following' : 'follow';
      followBtn.addEventListener('click', () => followToggle(target));
    } else {
      followBtn.style.display = 'none';
    }
  }

  // Message button → open chat panel with this user
  const msgBtn = card.querySelector('#memberCardMessageBtn');
  if (msgBtn) {
    const target = (window._memberCardDisplayName || name || '').trim();
    msgBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openChatPanel(target);
    });
  }
};

// Callback to update the open member card with backend community/status
window.handleMemberCardCommunity = function (resp) {
  if (!resp || !resp.success) return;
  const key = window._memberCardTarget;
  if (!key) return;
  const comm = (resp.community || '').toString();
  const status = (resp.status || '').toString();
  const cEl = document.getElementById('memberCardCommunity');
  const sEl = document.getElementById('memberCardStatus');
  if (cEl) cEl.textContent = comm || 'No community selected';
  if (sEl) sEl.textContent = status || 'Guest';
  renderBadgeChips(window._memberCardDisplayName || '', document.getElementById('memberCardBadges'));
}

window.updateActivityCommunityStatus = (status, community) => {
  const statusEl = document.getElementById('communityStatus');
  const joinBtn = document.getElementById('communityJoinBtn');
  const labelEl = document.getElementById('activityCommunityLabel');
  const metaEl = document.getElementById('activityCommunityMeta');
  const cardEl = document.getElementById('activityCommunityCard');

  if (!community) {
    if (statusEl) statusEl.textContent = 'Select a community to focus your feed.';
    if (joinBtn) joinBtn.textContent = 'Request to Join';
    if (cardEl) cardEl.classList.remove('hidden');
    const state = ensureHeaderState();
    state.community = '';
    state.members = 0;
    renderHeaderMeta(state);
    const stats = window.memberStats || {};
    stats.community = 'No community selected';
    stats.status = 'guest';
    window.memberStats = stats;
    window.updateMemberStatsUI?.();
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
    if (statusEl) statusEl.textContent = `Request pending for ${community}…`;
    if (joinBtn) joinBtn.textContent = 'Request Pending';
  } else {
    if (statusEl) statusEl.textContent = `You are connected to ${community}.`;
    if (joinBtn) joinBtn.textContent = 'Switch Community';
  }

  if (!window.keepCommunityCardOpen) {
    if (cardEl) cardEl.classList.add('hidden');
  }

  const stats = window.memberStats || {};
  stats.community = community || 'No community selected';
  stats.status = status || 'member';
  window.memberStats = stats;
  window.updateMemberStatsUI?.();
  renderBadgeChips(localStorage.getItem('memberName') || '', document.getElementById('memberCardBadges'));
};

window.requestCommunityMembership = (community) => {
  const trimmed = (community || '').trim();
  if (!trimmed) return;
  setCommunityForCurrentUser(trimmed, 'member');
};

window.initCommunityPicker = () => {
  if (typeof window.keepCommunityCardOpen === 'undefined') window.keepCommunityCardOpen = false;
  const input = document.getElementById('communitySearch');
  const list = document.getElementById('communitySuggestions');
  const joinBtn = document.getElementById('communityJoinBtn');
  if (!input || !list || !joinBtn) return;

  const all = Array.from(new Set(COMMUNITY_OPTIONS.slice().sort((a,b)=>a.localeCompare(b))));

  function render(q='') {
    const query = q.trim().toLowerCase();
    const items = !query ? all.slice(0, 10) : all.filter(n => n.toLowerCase().includes(query)).slice(0, 20);
    if (!items.length) {
      list.innerHTML = `<div class="px-3 py-2 text-sm text-yellow-400">No matches. Press Enter to use “${input.value.trim()}”.</div>`;
      list.classList.remove('hidden');
      return;
    }
    list.innerHTML = items.map(n => `<button type=\"button\" class=\"w-full text-left px-3 py-2 text-sm hover:bg-yellow-500/10 border-b border-yellow-500/10\" data-name=\"${n}\">${n}</button>`).join('');
    list.classList.remove('hidden');
  }

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-name]');
    if (!btn) return;
    input.value = btn.getAttribute('data-name');
    list.classList.add('hidden');
  });

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('focus', () => render(input.value));
  input.addEventListener('blur', () => setTimeout(()=> list.classList.add('hidden'), 120));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = list.querySelector('button[data-name]');
      if (first) input.value = first.getAttribute('data-name');
      list.classList.add('hidden');
      joinBtn.click();
    }
  });

  const storedCommunity = localStorage.getItem('memberCommunity');
  if (storedCommunity) input.value = storedCommunity;
  const storedStatus = localStorage.getItem('memberCommunityStatus') || (storedCommunity ? 'member' : 'guest');
  window.updateActivityCommunityStatus(storedStatus, storedCommunity);

  joinBtn.addEventListener('click', () => {
    const choice = (input.value || '').trim();
    if (!choice) {
      alert('Please choose a community first.');
      return;
    }
    if (!COMMUNITY_OPTIONS.includes(choice)) {
      COMMUNITY_OPTIONS.push(choice);
    }
    setCommunityForCurrentUser(choice, 'member');
    window.keepCommunityCardOpen = false;
  });

  // Clicking the header label jumps to the picker and highlights it
  document.getElementById('activityCommunityLabel')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.keepCommunityCardOpen = true;
    localStorage.removeItem('communityCardDismissed');
    document.getElementById('activitySidebar')?.classList.remove('translate-x-full');
    const card = document.getElementById('activityCommunityCard');
    card?.classList.remove('hidden');
    card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    input.classList.add('ring', 'ring-yellow-500');
    setTimeout(() => input.classList.remove('ring', 'ring-yellow-500'), 1200);
    input.focus({ preventScroll: true });
  });

  // Also update header immediately on init so it reflects stored choice
  const initialCommunity = localStorage.getItem('memberCommunity') || '';
  const initialStatus = localStorage.getItem('memberCommunityStatus') || (initialCommunity ? 'member' : 'guest');
  window.updateActivityCommunityStatus(initialStatus, initialCommunity);
  if (initialCommunity) requestCommunityMeta(initialCommunity);

  document.getElementById('activityCommunityInfo')?.addEventListener('click', () => {
    alert('Communities help focus your activity feed on nearby members. Requests are auto-approved while moderation tools are finalized.');
  });

  // Close button for the community card
  document.getElementById('communityCardClose')?.addEventListener('click', () => {
    const card = document.getElementById('activityCommunityCard');
    card?.classList.add('hidden');
    window.keepCommunityCardOpen = false;
    localStorage.setItem('communityCardDismissed', '1');
  });

  // Respect dismissal on load
  if (localStorage.getItem('communityCardDismissed') === '1') {
    document.getElementById('activityCommunityCard')?.classList.add('hidden');
    window.keepCommunityCardOpen = false;
  }
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
  if (!query) {
    suggestionsBox.style.display = 'none';
    return;
  }

  const localPool = Array.isArray(geoMarkers) ? geoMarkers : [];
  const matches = localPool.filter(m => m.title.includes(query)).slice(0, 5);
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
            if (m.marker && m.marker.togglePopup) {
              try { m.marker.togglePopup(); } catch(_) {}
            } else {
              // No DOM marker: show a popup at coords
              try {
                new mapboxgl.Popup({ closeButton: false, anchor: 'bottom', offset: 28 })
                  .setLngLat(m.coords)
                  .setHTML(`<div class="custom-popup"><div class="title">${m.feature?.properties?.title || ''}</div></div>`)
                  .addTo(map);
              } catch {}
            }
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
    setTimeout(() => {
      const mm = local[0];
      if (mm.marker && mm.marker.togglePopup) { try { mm.marker.togglePopup(); } catch(_) {} }
      else {
        try {
          new mapboxgl.Popup({ closeButton: false, anchor: 'bottom', offset: 28 })
            .setLngLat(mm.coords)
            .setHTML(`<div class=\"custom-popup\"><div class=\"title\">${mm.feature?.properties?.title || ''}</div></div>`)
            .addTo(map);
        } catch {}
      }
    }, 350);
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
    setTimeout(() => {
      const mm = local[0];
      if (mm.marker && mm.marker.togglePopup) { try { mm.marker.togglePopup(); } catch(_) {} }
      else {
        try {
          new mapboxgl.Popup({ closeButton: false, anchor: 'bottom', offset: 28 })
            .setLngLat(mm.coords)
            .setHTML(`<div class=\"custom-popup\"><div class=\"title\">${mm.feature?.properties?.title || ''}</div></div>`)
            .addTo(map);
        } catch {}
      }
    }, 350);
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

  // Helpers for consistent ID normalization
  const normalizeSimpleId = (v) => (v || '')
    .toString()
    .trim()
    .toLowerCase()
    // remove any non-alphanumeric characters anywhere (spaces, dots, punctuation)
    .replace(/[^a-z0-9]+/g, '');
  const normalizeEmail = (v) => (v || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[\.;,]+$/, '');         // tolerate accidental trailing punctuation

  // Helper to (re)load members with cache busting
  window.reloadMembershipData = async function () {
    try {
      const url = `https://docs.google.com/spreadsheets/d/1aPjgxKvFXp5uaZwyitf3u3DveCfSWZKgcqrFs-jQIsw/gviz/tq?sheet=Members&tqx=out:json&_=${Date.now()}`;
      const text = await fetch(url).then(r => r.text());
      // Robust GViz JSON extraction (prefix/suffix can vary)
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      const json = JSON.parse(text.slice(start, end + 1));
      const cols = (json.table.cols || []).map(c => (c.label || '').toString().trim().toLowerCase());
      const findCol = (...alts) => {
        // 1) prefer exact header match
        let i = cols.findIndex(h => alts.some(a => h === a));
        if (i >= 0) return i;
        // 2) prefer exact after removing spaces/punctuation
        i = cols.findIndex(h => alts.some(a => h.replace(/\s+/g,'') === a.replace(/\s+/g,'')));
        if (i >= 0) return i;
        // 3) last resort: includes()
        return cols.findIndex(h => alts.some(a => h.includes(a)));
      };
      let idx = {
        name: findCol('name','full name'),
        number: findCol('number','code','pin'),
        level: findCol('level','tier','membership'),
        email: findCol('email','e-mail'),
        username: findCol('username','user','handle'),
        // include broad synonyms; keep 'code' to support legacy passcodes
        password: findCol('password','pass','pwd','code','passcode','pass code','secret','key'),
        community: findCol('community'),
        communitystatus: findCol('communitystatus','community status','communitystatu','communitystat','commstatus','role','status')
      };
      // Guard against fuzzy collisions (e.g., name vs username, community vs communitystatus)
      try {
        if (idx.name === idx.username) idx.name = -1;
        if (idx.community >= 0 && cols[idx.community].includes('status')) {
          // Try to find the plain community column explicitly
          const exactComm = cols.findIndex(h => h === 'community');
          if (exactComm >= 0) idx.community = exactComm;
          else {
            const notStatus = cols.findIndex(h => h.includes('community') && !h.includes('status'));
            if (notStatus >= 0) idx.community = notStatus;
          }
        }
      } catch {}
      // Heuristic fallback: common column order A:email, B:username, C:password, D:level
      try {
        const totalCols = cols.length;
        if (idx.email < 0) idx.email = 0;
        if (idx.username < 0 && totalCols > 1) idx.username = 1;
        if (idx.password < 0 && idx.username >= 0 && (idx.username + 1) < totalCols) idx.password = idx.username + 1;
        if (idx.level < 0 && totalCols > 3) idx.level = 3;
      } catch {}
      // Expose header mapping for console inspection
      window._memberIdx = idx;
      console.log('🔍 Member header indexes', idx);

      const rawRows = (json.table.rows || []);
      // Expose raw GViz payload for debugging (safe in local dev)
      try {
        window._memberCols = cols.slice();
        window._memberRowsRaw = rawRows.map(r => (r && r.c) ? r.c.map(c => ({ v: c?.v ?? '', f: c?.f ?? '' })) : []);
        window.debugMemberRow = function (normId) {
          const norm = (s) => (s||'').toString().trim().toLowerCase().replace(/\W+/g,'');
          for (const r of membershipData) {
            if (r.usernameNorm === norm(normId) || r.nameNorm === norm(normId) || r.emailLower === (normId||'').toLowerCase()) return r;
          }
          return null;
        };
      } catch {}

      membershipData = rawRows
        .map(row => {
          const c = row.c || [];
          const get = (i) => {
            if (!(i >= 0)) return '';
            const cell = c[i] || {};
            // Prefer raw value, but fall back to formatted text if raw is null
            return (cell.v != null && cell.v !== '') ? cell.v : (cell.f != null ? cell.f : '');
          };
          const rec = {
            name: get(idx.name).toString(),
            number: get(idx.number).toString().trim(),
            level: (get(idx.level) || 'free').toString().trim().toLowerCase(),
            email: get(idx.email).toString(),
            username: get(idx.username).toString(),
            password: get(idx.password).toString().trim(),
            community: get(idx.community).toString().trim(),
            communityStatus: (get(idx.communitystatus) || '').toString().trim()
          };
          // Normalized fields for resilient matching
          rec.usernameNorm = normalizeSimpleId(rec.username);
          rec.nameNorm = normalizeSimpleId(rec.name);
          rec.emailLower = normalizeEmail(rec.email);
          // Skip completely empty rows
          if (!(rec.name || rec.username || rec.email)) return null;
          return rec;
        })
        .filter(Boolean);
      // Quick debug snapshot: username + secret lengths only
      try { window._memberDebug = membershipData.map(m => ({ u: m.usernameNorm, n: m.nameNorm, e: m.emailLower, pwLen: (m.password||'').length, numLen: (m.number||'').length, comm: m.community, role: m.communityStatus })); } catch {}
      // Helper to inspect a single row by username/email (no secrets)
      try {
        window.findMemberDebug = function (id) {
          const idStr = (id||'').toString();
          const idLower = idStr.toLowerCase();
          const idNorm = idStr.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
          const rec = membershipData.find(m => m.usernameNorm === idNorm || m.nameNorm === idNorm || m.emailLower === idLower);
          if (!rec) return null;
          return {
            username: rec.username,
            email: rec.email,
            level: rec.level,
            pwLen: (rec.password||'').length,
            numLen: (rec.number||'').length
          };
        };
      } catch {}
      console.log('✅ Membership data loaded.', { count: membershipData.length });
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

    // Honeypot
    const hp = document.getElementById('hp-login');
    if (hp && hp.value) return alert('Login blocked.');

    // Accept username OR email in the first field
    const rawId = nameInput.value.trim();
    const typedRawLower = rawId.toLowerCase();
    const typedName = typedRawLower.replace(/\s+/g, '');
    const typedNorm = normalizeSimpleId(rawId);
    const typedNumber = numberInput.value.trim();
    const typedNumberNorm = typedNumber.replace(/\s+/g, '').replace(/[^\w!-]+/g, '');

    // Do not log credentials

    // Support legacy (name+number), new (username+password), and email+password
    // Also allow username/email + legacy number (fallback) to reduce friction
    const match = membershipData.find(m => {
      const pwRaw = (m.password || '').toString();
      const numRaw = (m.number || '').toString();
      const pwOrNum = (pwRaw || numRaw).toString().trim();
      const pwOrNumNorm = pwOrNum.replace(/\s+/g, '').replace(/[^\w!-]+/g, '');
      const idMatchesUsername = !!m.usernameNorm && (m.usernameNorm === typedNorm);
      const idMatchesName = !!m.nameNorm && (m.nameNorm === typedNorm);
      const idMatchesEmail = !!m.emailLower && (m.emailLower === typedRawLower);
      // Username/name login rules:
      // - If a password exists for the record, REQUIRE the password (do not accept legacy number)
      // - If no password is set, accept the legacy number/code
      if (idMatchesUsername || idMatchesName) {
        const a2 = (pwRaw || '').trim();   // password
        const b2 = (numRaw || '').trim();  // legacy number/code
        const a2n = a2.replace(/\s+/g,'').replace(/[^\w!-]+/g,'');
        const b2n = b2.replace(/\s+/g,'').replace(/[^\w!-]+/g,'');
        const hasPassword = a2.length > 0;
        if (hasPassword) {
          if (a2 === typedNumber || a2n === typedNumberNorm) return true;
        } else {
          if (b2 === typedNumber || b2n === typedNumberNorm) return true;
        }
      }
      // Email login rules (same as above): require password if present; otherwise accept legacy number
      if (idMatchesEmail) {
        const a = (pwRaw || '').trim();
        const b = (numRaw || '').trim();
        const an = a.replace(/\s+/g,'').replace(/[^\w!-]+/g,'');
        const bn = b.replace(/\s+/g,'').replace(/[^\w!-]+/g,'');
        const hasPassword = a.length > 0;
        if (hasPassword) {
          if (a === typedNumber || an === typedNumberNorm) return true;
        } else {
          if (b === typedNumber || bn === typedNumberNorm) return true;
        }
      }
      return false;
    });

    // Do not log match content to avoid leaking data

    if (!match) {
      // Check if the ID part matched any record, to tailor feedback
      let idOnly = null;
      try {
        idOnly = membershipData.find(m => m.usernameNorm === typedNorm || m.nameNorm === typedNorm || m.emailLower === typedRawLower) || null;
      } catch {}
      try {
        const sample = membershipData.map(m => ({ u: m.usernameNorm, n: m.nameNorm, e: m.emailLower })).slice(0, 20);
        const debug = idOnly ? { pwLen: (idOnly.password||'').length, numLen: (idOnly.number||'').length, level: idOnly.level } : {};
        console.warn('🔎 Login no match', { id: typedNorm, pwLen: typedNumber.length, records: membershipData.length, idMatch: !!idOnly, ...debug, sample });
      } catch {}

      if (idOnly) {
        alert('❌ Password/code is incorrect for this account.');
      } else {
        alert('❌ Member not found or incorrect password/code.');
      }
      return;
    }

    localStorage.setItem('memberName', nameInput.value.trim());
    localStorage.setItem('membershipLevel', match.level);
    // Canonical username for favourites + backend consistency (strip spaces)
    const canonicalUser = (match.usernameNorm || match.emailLower || typedNorm)
      .toString();
    localStorage.setItem('username', canonicalUser);
    window.isPremium = match.level === 'premium';

    // Fallback: set community + status from the matched record if present
    // This ensures Admin role and community chip appear immediately even if the backend
    // getCommunity endpoint fails to map columns.
    if (match.community) {
      localStorage.setItem('memberCommunity', match.community);
      const role = (match.communityStatus || 'member').toString();
      const roleNorm = role.trim().toLowerCase();
      localStorage.setItem('memberCommunityStatus', roleNorm);
      try { window.updateActivityCommunityStatus?.(roleNorm, match.community); } catch {}
      try { window.updateAdminUI?.(); } catch {}
      try { zoomToCommunity?.(match.community); } catch {}
    }

    const displayName = nameInput.value.trim();
    alert(`🌹 Welcome back ${displayName}! (${match.level})`);
    document.getElementById('loginModal')?.classList.add('hidden');

    loadUserFavourites(canonicalUser);


    showMemberOptions();
    lucide.createIcons?.();
    // Remember last login id for convenience
    try { localStorage.setItem('lastLoginId', rawId); } catch {}
  });
}

// ─────────── Leaderboard (Members streak via GViz) ───────────
window.loadLeaderboard = async function () {
  try {
    const docId = '1aPjgxKvFXp5uaZwyitf3u3DveCfSWZKgcqrFs-jQIsw';
    const sheetName = 'Members';
    const url = `https://docs.google.com/spreadsheets/d/${docId}/gviz/tq?sheet=${encodeURIComponent(sheetName)}&tqx=out:json&_=${Date.now()}`;
    const txt = await fetch(url).then(r => r.text());
    const json = JSON.parse(txt.substring(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
    const cols = (json.table.cols || []).map(c => (c.label || '').toString().trim().toLowerCase());
    const idx = {
      name: cols.indexOf('name'),
      username: cols.indexOf('username'),
      email: cols.indexOf('email'),
      streak: cols.indexOf('streak'),
      level: cols.indexOf('level'),
      community: cols.indexOf('community')
    };
    const rows = (json.table.rows || []);
    const currentCommunity = (localStorage.getItem('memberCommunity') || '').toString();
    const itemsRaw = rows.map(r => {
      const c = r.c || [];
      const get = (i) => (i >= 0 && c[i] && c[i].v != null) ? c[i].v : '';
      const nm = (get(idx.name) || '').toString();
      const un = (get(idx.username) || '').toString();
      const em = (get(idx.email) || '').toString();
      const display = nm || un || (em ? em.split('@')[0] : '');
      const streak = parseInt(get(idx.streak) || '0', 10) || 0;
      const level = (get(idx.level) || '').toString();
      const community = (get(idx.community) || '').toString();
      return { display, streak, level, community };
    }).filter(x => x.display);

    // Optional scope to current community if set
    const scoped = currentCommunity ? itemsRaw.filter(x => (x.community || '') === currentCommunity) : itemsRaw;
    const sorted = scoped.sort((a,b) => b.streak - a.streak);
    const items = sorted.slice(0, 20);

    const list = document.getElementById('leaderboardList');
    if (!list) return;
    if (items.length === 0) {
      list.innerHTML = '<div class="text-yellow-400">No streak data yet.</div>';
      return;
    }
    list.innerHTML = items.map((it, i) => `
      <div class="flex items-center justify-between rounded-xl border border-yellow-500/30 bg-black/50 px-3 py-2">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center justify-center w-6 h-6 rounded-full border border-yellow-500/40 text-[11px] text-yellow-300">${i+1}</span>
          <span class="font-semibold text-yellow-100">${it.display}</span>
        </div>
        <span class="text-[12px] rounded-full border border-yellow-500/40 px-2 py-0.5 text-yellow-300">🔥 ${it.streak}</span>
      </div>`).join('');
    window.lucide?.createIcons?.();
  } catch (err) {
    console.error('❌ Leaderboard fetch failed:', err);
    const list = document.getElementById('leaderboardList');
    if (list) list.innerHTML = '<div class="text-yellow-400">Failed to load leaderboard.</div>';
  }
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
    // Honeypot
    const hp = document.getElementById('hp-signup');
    if (hp && hp.value) return alert('Signup blocked.');
    // Basic throttle
    const now = Date.now();
    if (now - (_rate.signup || 0) < 60000) return alert('Please wait before trying again.');
    const em = (email?.value || '').trim();
    const un = (username?.value || '').trim();
    const pw = (password?.value || '').trim();

    if (!em || !un || !pw) {
      alert('Please complete all fields.');
      return;
    }

    const url = `${window.SHEET_API_URL}?type=signup&email=${encodeURIComponent(em)}&username=${encodeURIComponent(un)}&password=${encodeURIComponent(pw)}&callback=handleSignupResponse`;
    console.log('📤 Signup via JSONP');
    _rate.signup = now;
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
    // Do NOT touch lock overlays here; they are managed by updateLockedOverlays/login flow
  };

  const openLogin = () => {
    // Do NOT hide locked overlays here; keep them until auth
    // Pre-fill with last attempt if available
    try {
      const last = localStorage.getItem('lastLoginId') || '';
      const name = document.getElementById('nameInput');
      if (name && last) name.value = last;
    } catch {}
    // Close sidebars and other panels but leave lock overlays alone
    document.getElementById('marketplaceSidebar')?.classList.add('translate-x-full');
    if (!window.keepActivityOpen) document.getElementById('activitySidebar')?.classList.add('translate-x-full');
    document.getElementById('entertainmentSidebar')?.classList.add('translate-x-full');
    document.getElementById('profileMenu')?.classList.add('hidden');
    document.getElementById('onboardingModal')?.classList.add('hidden');
    document.getElementById('signupModal')?.classList.add('hidden');
    document.getElementById('loginModal')?.classList.remove('hidden');
  };
  const openSignup = () => {
    // Do NOT hide locked overlays here; keep them until auth
    document.getElementById('marketplaceSidebar')?.classList.add('translate-x-full');
    if (!window.keepActivityOpen) document.getElementById('activitySidebar')?.classList.add('translate-x-full');
    document.getElementById('entertainmentSidebar')?.classList.add('translate-x-full');
    document.getElementById('profileMenu')?.classList.add('hidden');
    document.getElementById('onboardingModal')?.classList.add('hidden');
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

  const nameEl = document.getElementById('memberName');
  if (nameEl) nameEl.textContent = name;
  // Avatar: image url or initial
  try {
    const profile = window.getMemberProfile(name);
    const av = document.getElementById('memberAvatar');
    if (av) {
      if (profile.avatarUrl) {
        av.style.backgroundImage = `url('${profile.avatarUrl}')`;
        av.style.backgroundSize = 'cover';
        av.style.backgroundPosition = 'center';
        av.textContent = '';
      } else {
        av.style.backgroundImage = '';
        av.textContent = (name || 'A').slice(0,1).toUpperCase();
      }
    }
  } catch {}
  const streak = localStorage.getItem('streak') || 0;
  window.memberStats = window.memberStats || {};
  window.memberStats.streak = Number(streak) || 0;
  window.memberStats.community = localStorage.getItem('memberCommunity') || 'No community selected';
  window.memberStats.status = localStorage.getItem('memberCommunityStatus') || 'guest';
  window.memberStats.favourites = window.latestFavouritesCount ?? 0;
  window.updateMemberStatsUI?.();
  document.getElementById('memberOptions')?.classList.remove('hidden');
  document.getElementById('guestOptions')?.classList.add('hidden');
  window.updateAdminUI?.();

  // Render streak chip in profile menu
  try {
    const chip = document.getElementById('memberStreakChip');
    const days = Number(streak) || 0;
    if (chip) {
      if (days > 0) { chip.textContent = `🔥 ${days}`; chip.classList.remove('hidden'); }
      else { chip.classList.add('hidden'); chip.textContent = ''; }
    }
  } catch {}

  // Gate certain actions to premium members only
  const gate = (id, show) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (show) el.classList.remove('hidden');
    else el.classList.add('hidden');
  };
  // Show core actions for all logged-in members
  gate('favouritesBtn', true);
  gate('addLocationBtn', true);
  gate('requestsBtn', true);

  updateMemberDirectory(name, {
    streak: Number(streak) || 0,
    community: localStorage.getItem('memberCommunity') || undefined,
    status: localStorage.getItem('memberCommunityStatus') || 'member'
  });

  // Sync community from backend and hide any locked overlays now that user is logged in
  fetchCommunityForCurrentUser();
  // Fetch latest streak and ping today's login once (increments by day)
  requestStreakForCurrentUser();
  pingDailyStreakForCurrentUser?.();

  // Gentle streak toast on return (once per day)
  try {
    const today = new Date().toISOString().slice(0,10);
    const lastToast = localStorage.getItem('streakToast') || '';
    const days = Number(localStorage.getItem('streak') || '0') || 0;
    if (days >= 2 && lastToast !== today) {
      window.showToast?.(`Keep your streak going — you’re on day ${days}!`);
      localStorage.setItem('streakToast', today);
    }
  } catch {}
  document.getElementById('lockedMarketplaceModal')?.classList.add('hidden');
  document.getElementById('lockedEntertainmentModal')?.classList.add('hidden');
  document.getElementById('lockedActivityModal')?.classList.add('hidden');
  window.ensurePostFormsVisibility?.();

  // Mark page as logged-in for CSS-based guards
  document.body.classList.add('logged-in');
}

window.updateMemberStatsUI = function () {
  const metaEl = document.getElementById('memberMeta');
  const commChip = document.getElementById('memberCommunityChip');
  if (!metaEl && !commChip) return;
  const stats = window.memberStats || {};

  const community = (stats.community || '').toString();
  const streakDays = Number(stats.streak || 0);
  if (metaEl) metaEl.innerHTML = '';
  if (commChip) {
    const span = commChip.querySelector('span');
    if (span) span.textContent = community || 'Not selected';
  }

  // Render activity badges inline under chips
  const badgesEl = document.getElementById('memberMenuBadges');
  if (badgesEl) {
    badgesEl.innerHTML = '';
    renderBadgeChips(localStorage.getItem('memberName') || '', badgesEl);
  }
  window.lucide?.createIcons?.();
};

// Utility: unified overlay state (prevents flicker)
window.isLoggedIn = function () {
  // Treat either legacy `username` or current `memberName` as logged in
  return !!(
    localStorage.getItem('memberName') ||
    localStorage.getItem('username') ||
    localStorage.getItem('membershipLevel')
  );
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

// Provide a closeModal helper for submission modal
window.closeModal = function () {
  document.getElementById('submissionModal')?.classList.add('hidden');
};

// Upgrade/fix the request modal content to include structured fields
window.upgradeRequestModal = function () {
  const modal = document.getElementById('requestModal');
  if (!modal) return;
  // Always run cleanup; fields may exist while stray broken markup still remains
  // Remove malformed textarea if present
  const allTextareas = Array.from(modal.querySelectorAll('textarea#requestMessage'));
  // If multiple textareas with same id exist, keep the first inside our fields container and remove the rest
  if (allTextareas.length > 1) {
    const container = modal.querySelector('.space-y-3') || modal;
    const preferred = container.querySelector('textarea#requestMessage') || allTextareas[0];
    allTextareas.forEach((el) => { if (el !== preferred) el.remove(); });
  } else {
    // Single textarea but check for parsed-broken placeholder swallowing markup
    const only = allTextareas[0];
    if (only && /\\textarea>/i.test(String(only.getAttribute('placeholder') || ''))) {
      only.remove();
      const container = modal.querySelector('.space-y-3');
      if (container) {
        const fixed = document.createElement('textarea');
        fixed.id = 'requestMessage';
        fixed.rows = 4;
        fixed.className = 'w-full p-2 bg-zinc-900 border border-yellow-500 rounded resize-none';
        fixed.placeholder = 'Message';
        container.appendChild(fixed);
      }
    }
  }
  // Remove any rogue text nodes that printed raw <button> markup
  modal.querySelectorAll('*').forEach(el => {
    Array.from(el.childNodes).forEach(n => {
      if (n.nodeType === 3 && ( /<\/?button|id=\"submitRequest\"|id=\"cancelRequest\"/.test(n.textContent || '') || /Type your request/i.test(n.textContent || '') )) {
        n.parentNode.removeChild(n);
      }
    });
  });
  // Insert fields after honeypot only if a valid set is not already present
  const hasFields = modal.querySelector('#requestName') && modal.querySelector('#requestEmail') && modal.querySelector('#requestNumber') && modal.querySelector('textarea#requestMessage');
  if (!hasFields) {
    const hp = document.getElementById('hp-request');
    const container = document.createElement('div');
    container.className = 'space-y-3';
    container.innerHTML = `
      <div class=\"grid sm:grid-cols-2 gap-3\">
        <input id=\"requestName\" type=\"text\" placeholder=\"Your name\" class=\"w-full p-2 bg-zinc-900 border border-yellow-500 rounded\" />
        <input id=\"requestEmail\" type=\"email\" placeholder=\"Email\" class=\"w-full p-2 bg-zinc-900 border border-yellow-500 rounded\" />
      </div>
      <input id=\"requestNumber\" type=\"text\" placeholder=\"Number\" class=\"w-full p-2 bg-zinc-900 border border-yellow-500 rounded\" />
      <textarea id=\"requestMessage\" rows=\"4\" class=\"w-full p-2 bg-zinc-900 border border-yellow-500 rounded resize-none\" placeholder=\"Message\"></textarea>
    `;
    if (hp && hp.parentNode) {
      hp.parentNode.insertBefore(container, hp.nextSibling);
    }
  }
  // Dedupe any repeated groups
  const allNames = Array.from(modal.querySelectorAll('#requestName'));
  allNames.slice(1).forEach(n => { const grp = n.closest('.space-y-3'); if (grp && grp.querySelector('#requestEmail')) grp.remove(); else n.remove(); });
  const allEmails = Array.from(modal.querySelectorAll('#requestEmail'));
  allEmails.slice(1).forEach(e => { const grp = e.closest('.space-y-3'); if (grp) grp.remove(); else e.remove(); });
  const allNumbers = Array.from(modal.querySelectorAll('#requestNumber'));
  allNumbers.slice(1).forEach(e => e.remove());
  const allMsgs = Array.from(modal.querySelectorAll('textarea#requestMessage'));
  allMsgs.slice(1).forEach(e => e.remove());
  // Ensure footer action buttons exist
  const footerExists = !!document.getElementById('submitRequest');
  if (!footerExists) {
    const footer = document.createElement('div');
    footer.className = 'flex justify-end gap-3 mt-4';
    const cancel = document.createElement('button');
    cancel.id = 'cancelRequest';
    cancel.className = 'border border-yellow-500 text-yellow-400 px-4 py-2 rounded hover:bg-yellow-500 hover:text-black';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => {
      document.getElementById('requestModal')?.classList.add('hidden');
    });
    const submit = document.createElement('button');
    submit.id = 'submitRequest';
    submit.className = 'bg-yellow-500 text-black px-4 py-2 rounded hover:bg-yellow-600';
    submit.textContent = 'Send';
    footer.append(cancel, submit);
    const modalInner = modal.querySelector('.text-yellow-300') || modal.firstElementChild;
    modalInner?.appendChild(footer);
  }
};

// Ensure post forms are usable when logged in
window.ensurePostFormsVisibility = function () {
  const loggedIn = !!(window.isLoggedIn?.());

  // Activity gating: guests see locked modal; members see post form
  const actForm = document.getElementById('activityPostForm');
  const actLock = document.getElementById('lockedActivityModal');
  if (loggedIn) {
    if (actLock) actLock.classList.add('hidden');
    if (actForm) {
      actForm.classList.remove('hidden');
      actForm.style.opacity = '1';
      actForm.style.pointerEvents = 'auto';
      actForm.style.filter = 'none';
    }
  } else {
    if (actLock) actLock.classList.remove('hidden');
    if (actForm) actForm.classList.add('hidden');
  }

  // Marketplace remains gated to logged-in users
  const mktForm = document.getElementById('marketplacePostForm');
  const mktLock = document.getElementById('lockedMarketplaceModal');
  if (mktForm && mktLock) {
    if (loggedIn) {
      mktLock.classList.add('hidden');
      mktForm.classList.remove('hidden');
      mktForm.style.opacity = '1';
      mktForm.style.pointerEvents = 'auto';
      mktForm.style.filter = 'none';
    } else {
      mktLock.classList.remove('hidden');
      mktForm.classList.add('hidden');
    }
  }
}



// Note: handled by delegated listeners below to avoid double-trigger + fallbacks



document.getElementById('closeRequestModal')?.addEventListener('click', () => {
  document.getElementById('requestModal')?.classList.add('hidden');
});

document.getElementById('cancelRequest')?.addEventListener('click', () => {
  document.getElementById('requestModal')?.classList.add('hidden');
});
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  // Clear all known user state
  localStorage.removeItem('memberName');
  localStorage.removeItem('membershipLevel');
  localStorage.removeItem('username');
  localStorage.removeItem('memberCommunity');
  localStorage.removeItem('memberCommunityStatus');

  // Reset UI to guest state immediately
  document.getElementById('memberOptions')?.classList.add('hidden');
  document.getElementById('guestOptions')?.classList.remove('hidden');
  const nameEl = document.getElementById('memberName');
  if (nameEl) nameEl.textContent = '🌹 Guest';
  const metaEl = document.getElementById('memberMeta');
  if (metaEl) metaEl.innerHTML = '';
  document.body.classList.remove('logged-in');
  window.updateLockedOverlays?.();
  document.getElementById('profileMenu')?.classList.add('hidden');

  alert('Logged out successfully');

  // Reload after UI resets to ensure a clean slate
  setTimeout(() => location.reload(), 100);
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

// Onboarding close: hide and mark as seen so it won’t re-open automatically
const onboardingModal = document.getElementById('onboardingModal');
document.getElementById('closeOnboarding')?.addEventListener('click', () => {
  try { localStorage.setItem('onboardingShown_v1', '1'); } catch {}
  onboardingModal?.classList.add('hidden');
});
}
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔥 DOM loaded');

  // Keep floating UI hidden while onboarding is visible
  try {
    const attachObserver = (modalEl) => {
      const sync = () => {
        const open = modalEl && !modalEl.classList.contains('hidden');
        document.body.classList.toggle('onboarding-open', !!open);
      };
      const mo = new MutationObserver(sync);
      mo.observe(modalEl, { attributes: true, attributeFilter: ['class'] });
      sync();
    };
    let obModal = document.getElementById('onboardingModal');
    if (obModal) {
      attachObserver(obModal);
    } else {
      const waitForModal = new MutationObserver(() => {
        obModal = document.getElementById('onboardingModal');
        if (obModal) {
          attachObserver(obModal);
          waitForModal.disconnect();
        }
      });
      waitForModal.observe(document.body, { childList: true, subtree: true });
    }
  } catch {}

  checkPremiumStatus();         // ✅ sets window.isPremium
  window.updateHelpJoinBtn();   // ✅ now safe to call here

  setupApp?.();
  bindUIButtons?.();
  setupLogin?.();
  bindMarketplacePostForm?.();
  window.updateLockedOverlays?.();
  window.updateAdminUI?.();
  // If already logged in (legacy username or memberName), sync UI and community
  if (window.isLoggedIn?.()) {
    document.body.classList.add('logged-in');
    fetchCommunityForCurrentUser?.();
    window.ensurePostFormsVisibility?.();
    try { refreshFollowCounts(); } catch {}
  } else {
    // Guest: clear member display in profile menu
    const nameEl = document.getElementById('memberName');
    if (nameEl) nameEl.textContent = '🌹 Guest';
    const metaEl = document.getElementById('memberMeta');
    if (metaEl) metaEl.innerHTML = '';
  }

  document.getElementById('helpJoinBtn')?.addEventListener('click', () => {
    console.log('🎯 helpJoinBtn clicked');
    const m = document.getElementById('onboardingModal');
    if (m) {
      m.classList.remove('hidden');
      try { document.body.classList.add('onboarding-open'); } catch {}
    }
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
    // Close onboarding (ensure floating UI returns)
    if (q('#closeOnboarding')) {
      try { document.body.classList.remove('onboarding-open'); } catch {}
      document.getElementById('onboardingModal')?.classList.add('hidden');
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
  // Direct binding for Favourites (force open)
  try {
    const fav = document.getElementById('favouritesBtn');
    fav?.addEventListener('click', (e) => {
      e.preventDefault();
      window.openFavouritesStrict?.();
    });
  } catch {}
  // Upgrade/fix the Request modal structure if needed
  window.upgradeRequestModal?.();

  // Admin button
  document.getElementById('adminPanelBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.openAdminPanel?.();
  });
  // Close Admin modal
  document.getElementById('closeAdminPanel')?.addEventListener('click', () => {
    document.getElementById('adminPanel')?.classList.add('hidden');
  });
  // Click outside to close
  document.getElementById('adminPanel')?.addEventListener('click', (ev) => {
    if (ev.target && ev.target.id === 'adminPanel') {
      document.getElementById('adminPanel')?.classList.add('hidden');
    }
  });

  // Debug helpers: force-show modals if needed
  window.forceShowAddLocation = function () {
    // Prefer the bound submission modal if present; otherwise build a fallback
    let modal = document.getElementById('submissionModal') || document.getElementById('addLocationModal');
    if (!modal) {
      console.warn('Add Location modal not found — creating fallback');
      modal = document.createElement('div');
      modal.id = 'addLocationModal';
      modal.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[9999] w-[22rem] bg-black border border-yellow-500 rounded-xl shadow-lg p-6 text-yellow-400 space-y-4';
      modal.innerHTML = `
        <button class="absolute top-3 right-3 text-yellow-400 hover:text-yellow-200 text-2xl" onclick="this.closest('#addLocationModal')?.classList.add('hidden')">&times;</button>
        <h3 class="text-lg font-semibold text-yellow-300">➕ Add Location</h3>
        <form id="locationForm" class="space-y-3">
          <input id="locationTitle" type="text" placeholder="Name" required class="w-full p-2 rounded bg-zinc-900 border border-yellow-500 text-yellow-200 placeholder-yellow-600">
          <textarea id="locationShortDesc" rows="3" placeholder="Description (optional)" class="w-full p-2 rounded bg-zinc-900 border border-yellow-500 text-yellow-200 placeholder-yellow-600"></textarea>
          <select id="locationCategory" class="w-full p-2 rounded bg-zinc-900 border border-yellow-500 text-yellow-200" required>
            <option value="" disabled selected>Select category…</option>
          </select>
          <button type="submit" class="bg-yellow-500 hover:bg-yellow-600 text-black w-full py-2 rounded font-semibold">Submit</button>
        </form>`;
      document.body.appendChild(modal);
      try { window.populateCategorySelects?.(); } catch {}
      try { bindLocationFormFallback(); } catch {}
    }
    modal.classList.remove('hidden');
    modal.style.display = 'block';
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
    modal.style.position = modal.style.position || 'fixed';
    modal.style.zIndex = '100700';
    try { (modal.querySelector('#locationName') || modal.querySelector('#locationTitle'))?.focus(); } catch {}
    try { modal.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch {}
  };
  window.forceShowFavourites = function () {
    const dropdowns = document.querySelectorAll('#favouritesDropdown');
    if (!dropdowns.length) return;
    dropdowns.forEach(dd => {
      dd.classList.remove('hidden');
      dd.style.display = 'block';
      dd.style.opacity = '1';
      dd.style.pointerEvents = 'auto';
    });
  };

  // Keyboard shortcuts: Shift+A (Add Location), Shift+F (Favourites)
document.addEventListener('keydown', (e) => {
  const key = (e.key || '').toLowerCase();
  if (!e.shiftKey) return;
  if (window._disableFavAdd) return;
  if (key === 'a') { e.preventDefault(); window.forceShowAddLocation(); }
  if (key === 'f') { e.preventDefault(); window.forceShowFavourites(); }
});

  // URL param support: ?show=addlocation,favourites
  try {
    const params = new URL(window.location.href).searchParams;
    const show = (params.get('show') || '').toLowerCase();
    if (show.includes('addlocation')) setTimeout(() => window.forceShowAddLocation(), 0);
    if (show.includes('favourites')) setTimeout(() => window.forceShowFavourites(), 0);
  } catch {}

  // Populate category selects early with defaults; they will be refreshed when map categories load
  try { window.populateCategorySelects?.(); } catch {}
});

// Delegated fallbacks for buttons that may render late
document.addEventListener('click', (ev) => {
  const t = ev.target;
  if (!(t instanceof Element)) return;
  const q = (sel) => t.closest(sel);

  // Debug taps on core controls
  if (q('#fabCorner')) console.log('Event: document click on #fabCorner');
  if (q('#filterBtn')) console.log('Event: document click on #filterBtn');

  // Filter open/close (delegate to a single helper)
  if (q('#filterBtn')) { ev.preventDefault(); openFilterPanel(); return; }
  if (q('#closeFilterPanel')) {
    ev.preventDefault();
    console.log('Filter: close clicked');
    const panels = document.querySelectorAll('#filterPanel');
    panels.forEach(p => { p.classList.add('hidden'); p.style.display = 'none'; });
    const portal = document.getElementById('filterPanelPortal');
    if (portal) portal.remove();
    return;
  }

  // Add Location
  if (q('#addLocationBtn')) {
    ev.preventDefault();
    if (!window.isLoggedIn?.()) {
      document.getElementById('loginModal')?.classList.remove('hidden');
    } else {
      // Prefer the bound submission modal if available
      const modal = document.getElementById('submissionModal') || document.getElementById('addLocationModal');
      if (modal) {
        modal.classList.toggle('hidden');
        // Ensure visible when toggled on
        if (!modal.classList.contains('hidden')) {
          modal.style.display = 'block';
          modal.style.opacity = '1';
          modal.style.pointerEvents = 'auto';
        }
      } else {
        console.warn('Add Location modal not found — creating fallback');
        window.forceShowAddLocation?.();
      }
    }
    return;
  }

  // Favourites dropdown (force open)
  if (q('#favouritesBtn')) {
    ev.preventDefault();
    window.openFavouritesStrict?.();
    return;
  }

  // Inbox open
  if (q('#inboxBtn')) {
    ev.preventDefault();
    const p = document.getElementById('inboxPanel');
    if (p && !p.classList.contains('hidden')) { p.classList.add('hidden'); }
    else { openInboxPanel(); }
    return;
  }

  // Followers/Following list popups
  if (q('#followersCountBtn')) {
    ev.preventDefault();
    let panel = document.getElementById('followListPanel');
    if (panel && !panel.classList.contains('hidden')) { panel.classList.add('hidden'); }
    else {
      // Show a tiny spinner near the button while loading
      const anchor = t.closest('#followersCountBtn');
      if (anchor) {
        let spin = document.getElementById('followSpinner');
        if (!spin) { spin = document.createElement('div'); spin.id = 'followSpinner'; document.body.appendChild(spin); }
        const r = anchor.getBoundingClientRect();
        spin.style.cssText = 'position:absolute;width:16px;height:16px;border-radius:9999px;border:2px solid rgba(234,179,8,0.4);border-top-color:#eab308;animation:spin 0.8s linear infinite;z-index:100200;';
        spin.style.left = `${r.left + window.scrollX - 20}px`;
        spin.style.top  = `${r.top  + window.scrollY - 2}px`;
      }
      showFollowList('followers', anchor);
      setTimeout(() => document.getElementById('followSpinner')?.remove(), 1200);
    }
    return;
  }
  if (q('#followingCountBtn')) {
    ev.preventDefault();
    let panel = document.getElementById('followListPanel');
    if (panel && !panel.classList.contains('hidden')) { panel.classList.add('hidden'); }
    else {
      const anchor = t.closest('#followingCountBtn');
      if (anchor) {
        let spin = document.getElementById('followSpinner');
        if (!spin) { spin = document.createElement('div'); spin.id = 'followSpinner'; document.body.appendChild(spin); }
        const r = anchor.getBoundingClientRect();
        spin.style.cssText = 'position:absolute;width:16px;height:16px;border-radius:9999px;border:2px solid rgba(234,179,8,0.4);border-top-color:#eab308;animation:spin 0.8s linear infinite;z-index:100200;';
        spin.style.left = `${r.left + window.scrollX - 20}px`;
        spin.style.top  = `${r.top  + window.scrollY - 2}px`;
      }
      showFollowList('following', anchor);
      setTimeout(() => document.getElementById('followSpinner')?.remove(), 1200);
    }
    return;
  }
});

// Global debug helpers (ensure they exist even if early wiring failed)
if (typeof window.forceShowAddLocation !== 'function') {
  window.forceShowAddLocation = function () {
    if (window._disableFavAdd) return;
    // Prefer the bound submission modal first
    let modal = document.getElementById('submissionModal') || document.getElementById('addLocationModal');
    if (!modal) {
      console.warn('Add Location modal not found — creating fallback');
      modal = document.createElement('div');
      modal.id = 'addLocationModal';
      modal.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[9999] w-[22rem] bg-black border border-yellow-500 rounded-xl shadow-lg p-6 text-yellow-400 space-y-4';
      modal.innerHTML = `
        <button class="absolute top-3 right-3 text-yellow-400 hover:text-yellow-200 text-2xl" onclick="this.closest('#addLocationModal')?.classList.add('hidden')">&times;</button>
        <h3 class="text-lg font-semibold text-yellow-300">➕ Add Location</h3>
        <form id="locationForm" class="space-y-3">
          <input id="locationTitle" type="text" placeholder="Name" required class="w-full p-2 rounded bg-zinc-900 border border-yellow-500 text-yellow-200 placeholder-yellow-600">
          <textarea id="locationShortDesc" rows="3" placeholder="Description (optional)" class="w-full p-2 rounded bg-zinc-900 border border-yellow-500 text-yellow-200 placeholder-yellow-600"></textarea>
          <select id="locationCategory" class="w-full p-2 rounded bg-zinc-900 border border-yellow-500 text-yellow-200" required>
            <option value="" disabled selected>Select category…</option>
          </select>
          <button type="submit" class="bg-yellow-500 hover:bg-yellow-600 text-black w-full py-2 rounded font-semibold">Submit</button>
        </form>`;
      document.body.appendChild(modal);
      // Populate category select + bind fallback submission handler
      try { window.populateCategorySelects?.(); } catch {}
      try { bindLocationFormFallback(); } catch {}
    }
    modal.classList.remove('hidden');
    modal.style.display = 'block';
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
  };
}
if (typeof window.forceShowFavourites !== 'function') {
  window.forceShowFavourites = function () {
    if (window._disableFavAdd) return;
    let dropdowns = document.querySelectorAll('#favouritesDropdown');
    if (!dropdowns.length) {
      console.warn('Favourites dropdown not found — creating fallback');
      const dd = document.createElement('div');
      dd.id = 'favouritesDropdown';
      dd.className = 'fixed bottom-24 right-4 z-[9999] w-72 max-h-64 overflow-y-auto bg-black border border-yellow-500 rounded-xl shadow-lg p-4 text-yellow-400 space-y-2';
      dd.innerHTML = `
        <div class="flex justify-between items-center mb-2">
          <h3 class="text-sm font-semibold">🌹 Saved Favourites</h3>
          <button onclick="document.getElementById('favouritesDropdown')?.classList.add('hidden')" class="text-yellow-400 hover:text-red-500 text-sm">✕</button>
        </div>
        <div id="favouritesList" class="space-y-2 text-sm">
          <p class="text-yellow-600 italic">No favourites yet.</p>
        </div>`;
      document.body.appendChild(dd);
      dropdowns = document.querySelectorAll('#favouritesDropdown');
    }
    dropdowns.forEach(dd => {
      dd.classList.remove('hidden');
      dd.style.display = 'block';
      dd.style.opacity = '1';
      dd.style.pointerEvents = 'auto';
    });
    // Refresh favourites after showing fallback
    try {
      const u = localStorage.getItem('username');
      if (u) setTimeout(() => loadUserFavourites(u), 0);
    } catch {}
  };
}
// Strong toggle helper that creates the dropdown if missing
if (typeof window.toggleFavourites !== 'function') {
  window.toggleFavourites = function () {
    if (window._disableFavAdd) return;
    let dd = document.getElementById('favouritesDropdown');
    if (!dd) {
      // create fallback, then open
      window.forceShowFavourites?.();
      dd = document.getElementById('favouritesDropdown');
    }
    if (!dd) return;
    const willShow = dd.classList.contains('hidden');
    dd.classList.toggle('hidden');
    if (willShow) {
      dd.style.display = 'block';
      dd.style.opacity = '1';
      dd.style.pointerEvents = 'auto';
      // Ensure it sits above profile menu; also close the menu
      try { document.getElementById('profileMenu')?.classList.add('hidden'); } catch {}
      // Load latest favourites
      try {
        const u = localStorage.getItem('username');
        if (u) setTimeout(() => loadUserFavourites(u), 0);
      } catch {}
    }
  };
}

// Strict opener: always ends visible, creating fallback if needed
if (typeof window.openFavouritesStrict !== 'function') {
  window.openFavouritesStrict = function () {
    if (window._disableFavAdd) return;
    let dd = document.getElementById('favouritesDropdown');
    if (!dd) {
      // If not present, use the robust creator
      window.forceShowFavourites?.();
      dd = document.getElementById('favouritesDropdown');
    }
    if (!dd) {
      // Ultimate fallback: build a minimal dropdown
      const el = document.createElement('div');
      el.id = 'favouritesDropdown';
      el.className = 'fixed bottom-24 right-4 z-[100600] w-72 max-h-64 overflow-y-auto bg-black border border-yellow-500 rounded-xl shadow-lg p-4 text-yellow-400 space-y-2';
      el.innerHTML = `
        <div class="flex justify-between items-center mb-2">
          <h3 class="text-sm font-semibold">🌹 Saved Favourites</h3>
          <button onclick="document.getElementById('favouritesDropdown')?.classList.add('hidden')" class="text-yellow-400 hover:text-red-500 text-sm">✕</button>
        </div>
        <div id="favouritesList" class="space-y-2 text-sm">
          <p class="text-yellow-600 italic">No favourites yet.</p>
        </div>`;
      document.body.appendChild(el);
      dd = el;
    }
    // Force visible state
    dd.classList.remove('hidden');
    dd.style.display = 'block';
    dd.style.opacity = '1';
    dd.style.pointerEvents = 'auto';
    try { document.getElementById('profileMenu')?.classList.add('hidden'); } catch {}
    try {
      const u = localStorage.getItem('username');
      if (u) setTimeout(() => loadUserFavourites(u), 0);
    } catch {}
  };
}

// Delegated fallback: Request send button always works
document.addEventListener('click', (ev) => {
  const t = ev.target;
  if (!(t instanceof Element)) return;
  if (t.id !== 'submitRequest') return;
  ev.preventDefault();
  try {
    window.upgradeRequestModal?.();
    const hp = document.getElementById('hp-request');
    if (hp && hp.value) { alert('Request blocked.'); return; }
    const now = Date.now();
    if (now - (_rate.requests || 0) < 45000) { alert('Please wait before sending another request.'); return; }
    const S = (s='') => s.replace(/[<>]/g, '').trim();
    const name = S(document.getElementById('requestName')?.value || '').slice(0,120);
    const email = S(document.getElementById('requestEmail')?.value || '').slice(0,160);
    const number = S(document.getElementById('requestNumber')?.value || '').slice(0,40);
    const message = S(document.getElementById('requestMessage')?.value || '').slice(0,600);
    if (!message) { alert('Please write a message before submitting.'); return; }
    const actor = localStorage.getItem('memberName') || name || 'Anonymous';
    const type = window.selectedRequestType || 'Verification';
    // Standardize to Apps Script contract: type=request + requestType
    const params = new URLSearchParams({
      type: 'request',
      requestType: type,
      member: actor,
      name,
      email,
      number,
      message,
      callback: 'handleRequestResponse'
    });
    _rate.requests = now;
    jsonp(`${window.SHEET_API_URL}?${params.toString()}`);
  } catch (e) {
    console.error('Failed to submit request', e);
    alert('Failed to submit request.');
  }
});
  // Filter button: explicit binding to avoid delegated issues on iOS
  try {
    const fb = document.getElementById('filterBtn');
    if (fb) {
      fb.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); window.toggleFilterPanel?.(); });
    }
  } catch {}
// Dedicated filter panel open helper (used by explicit binding and delegated fallback)
window.openFilterPanel = function openFilterPanel() {
  console.log('Filter: openFilterPanel() called');
  try {
    const s = document.getElementById('suggestions');
    if (s) { s.classList.add('hidden'); s.style.display = 'none'; }
  } catch {}
  // Prefer existing panel from components/modals.html
  let panel = document.getElementById('filterPanel');
  // Always lift the panel to document.body to avoid being inside any hidden container
  try { if (panel && panel.parentElement !== document.body) document.body.appendChild(panel); } catch {}
  // If multiple panels somehow exist, keep the first and remove others
  try {
    const all = Array.from(document.querySelectorAll('#filterPanel'));
    if (all.length > 1) {
      all.slice(1).forEach(p => p.remove());
      panel = all[0];
    }
  } catch {}
  if (panel) {
    panel.classList.remove('hidden');
    panel.style.display = 'block';
    panel.style.position = 'fixed';
    panel.style.left = '16px';
    panel.style.bottom = '112px';
    panel.style.zIndex = '100500';
    panel.style.pointerEvents = 'auto';
    panel.style.visibility = 'visible';
    // Always set explicit width, do not rely on Tailwind arbitrary class
    panel.style.width = '288px';
    panel.style.minWidth = '288px';
    const inner = panel.firstElementChild || panel;
    if (inner) {
      inner.style.display = 'block';
      inner.style.opacity = '1';
      inner.style.width = '100%';
      inner.style.minHeight = inner.style.minHeight || '220px';
    }
    try { window.lucide?.createIcons?.(); } catch {}
    setTimeout(() => window.populateCategoryFilters?.(), 0);
    // Force a reflow before measuring
    try { void panel.offsetWidth; } catch {}
    // Defer measurement to ensure layout
    setTimeout(() => {
      // As a final safety, apply a min-height if computed height is 0
      const r0 = panel.getBoundingClientRect();
      if (!r0.height || !r0.width) {
        panel.style.minHeight = '260px';
        panel.style.minWidth = '288px';
        panel.style.visibility = 'visible';
        // If still 0 after one more tick, build a portal fallback panel that is guaranteed visible
        setTimeout(() => {
          const r1 = panel.getBoundingClientRect();
          if (!r1.height || !r1.width) {
            let portal = document.getElementById('filterPanelPortal');
            if (!portal) {
              portal = document.createElement('div');
              portal.id = 'filterPanelPortal';
              portal.style.cssText = 'position:fixed;left:16px;bottom:112px;z-index:100600;width:288px;min-width:288px;min-height:260px;pointer-events:auto;';
              portal.innerHTML = `
                <div class="rounded-2xl border border-yellow-500/50 bg-black/90 px-4 py-5 text-yellow-200 shadow-[0_18px_32px_rgba(255,215,0,0.12)]">
                  <div class="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <p class="text-[10px] uppercase tracking-[0.35em] text-yellow-500/70">Filters</p>
                      <h2 class="text-lg font-semibold text-yellow-100">Refine Map</h2>
                    </div>
                    <button id="closeFilterPanel" type="button" class="flex h-7 w-7 items-center justify-center rounded-full border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500 hover:text-black transition">×</button>
                  </div>
                  <div class="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-yellow-500/80 mb-3">
                    <span>Categories</span>
                    <button type="button" class="text-yellow-400 hover:text-yellow-200" onclick="showAllLocations()">Reset</button>
                  </div>
                  <div id="categoryFiltersPortal" class="max-h-44 overflow-y-auto pr-1 mb-4 space-y-2"></div>
                  <button onclick="filterByCategory()" class="w-full inline-flex items-center justify-center gap-2 rounded-full bg-yellow-500 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-400 transition">
                    <span>Apply</span>
                  </button>
                </div>`;
              document.body.appendChild(portal);
              try { window.populateCategoryFiltersInto?.(portal.querySelector('#categoryFiltersPortal')); } catch {}
              try { portal.querySelector('#closeFilterPanel')?.addEventListener('click', () => { portal.remove(); }); } catch {}
            }
            // Hide original if portal is used
            panel.classList.add('hidden');
            panel.style.display = 'none';
          }
        }, 0);
      }
      const rect = panel.getBoundingClientRect();
      console.log('Filter: rect fresh', { w: rect.width, h: rect.height, y: rect.y });
    }, 0);
    return;
  }
  // Fallback build if missing
  panel = document.createElement('div');
  panel.id = 'filterPanel';
  panel.className = 'fixed bottom-28 left-6';
  panel.style.zIndex = '100500';
  panel.style.width = '288px';
  panel.style.minWidth = '288px';
  panel.innerHTML = `
    <div class="rounded-2xl border border-yellow-500/50 bg-black/90 px-4 py-5 text-yellow-200 shadow-[0_18px_32px_rgba(255,215,0,0.12)]">
      <div class="flex items-start justify-between gap-3 mb-4">
        <div>
          <p class="text-[10px] uppercase tracking-[0.35em] text-yellow-500/70">Filters</p>
          <h2 class="text-lg font-semibold text-yellow-100">Refine Map</h2>
        </div>
        <button id="closeFilterPanel" type="button" class="flex h-7 w-7 items-center justify-center rounded-full border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500 hover:text-black transition">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-yellow-500/80 mb-3">
        <span>Categories</span>
        <button type="button" class="text-yellow-400 hover:text-yellow-200" onclick="showAllLocations()">Reset</button>
      </div>
      <div id="categoryFilters" class="max-h-44 overflow-y-auto pr-1 mb-4 space-y-2"></div>
      <button onclick="filterByCategory()" class="w-full inline-flex items-center justify-center gap-2 rounded-full bg-yellow-500 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-400 transition">
        <i data-lucide="check"></i>
        <span>Apply</span>
      </button>
    </div>`;
  document.body.appendChild(panel);
  // Wire the close button for the fallback panel (defensive)
  try { panel.querySelector('#closeFilterPanel')?.addEventListener('click', () => { panel.classList.add('hidden'); panel.style.display = 'none'; panel.style.opacity = '0'; panel.style.pointerEvents = 'none'; }); } catch {}
  try { window.lucide?.createIcons?.(); } catch {}
  setTimeout(() => {
    try { window.populateCategoryFilters?.(); } catch {}
    const rect = panel.getBoundingClientRect();
    console.log('Filter: rect fresh', { w: rect.width, h: rect.height, y: rect.y });
  }, 0);
}

// Toggle helper for filter button: show if hidden, hide if visible
window.toggleFilterPanel = function toggleFilterPanel() {
  const p = document.getElementById('filterPanel');
  if (!p) { openFilterPanel(); return; }
  const isHidden = p.classList.contains('hidden') || p.style.display === 'none';
  if (isHidden) { openFilterPanel(); }
  else {
    p.classList.add('hidden');
    p.style.display = 'none';
    p.style.opacity = '0';
    p.style.pointerEvents = 'none';
    const portal = document.getElementById('filterPanelPortal');
    if (portal) portal.remove();
  }
};
// Show one modal exclusively; closes others and overlays to avoid double-open
function openModalExclusive(targetId) {
  try {
    const ids = [
      'requestModal','feedbackModal','submissionModal','addLocationModal',
      'loginModal','signupModal','faqPanel'
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === targetId) return;
      el.classList.add('hidden');
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
    });
    // Close sidebars to prevent click-through/overlap
    ['marketplaceSidebar','activitySidebar','entertainmentSidebar'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('translate-x-full');
    });
    // Hide profile menu
    document.getElementById('profileMenu')?.classList.add('hidden');
    // Show target
    const t = document.getElementById(targetId);
    if (t) {
      t.classList.remove('hidden');
      t.style.display = 'block';
      t.style.opacity = '1';
      t.style.pointerEvents = 'auto';
      t.style.zIndex = '100700';
    }
  } catch {}
}
// Force-show a modal/panel by id and re-assert visibility on next tick
function forceShowModal(id) {
  try {
    const el = document.getElementById(id);
    if (!el) return false;
    // Promote to top-level to avoid hidden ancestors
    if (el.parentElement !== document.body) {
      try { document.body.appendChild(el); } catch {}
    }
    el.classList.remove('hidden');
    el.style.display = 'block';
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';
    el.style.position = el.style.position || 'fixed';
    el.style.zIndex = '100700';
    el.style.visibility = 'visible';
    // Center typical small modals (not full-screen overlays)
    if (!/inset-0/.test(el.className)) {
      el.style.left = '50%';
      el.style.top = '50%';
      el.style.bottom = 'auto';
      el.style.transform = 'translate(-50%,-50%)';
    }
    setTimeout(() => {
      el.classList.remove('hidden');
      el.style.display = 'block';
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
      el.style.zIndex = '100700';
      el.style.visibility = 'visible';
    }, 0);
    return true;
  } catch (_) { return false; }
}
