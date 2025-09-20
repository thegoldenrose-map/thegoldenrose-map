console.log("✅ Script loaded");

let map;
let geoMarkers = [];
let membershipData = [];
let originalGeoData = null;

window.SHEET_API_URL = window.SHEET_API_URL || 'https://script.google.com/macros/s/AKfycbyIqpE0QffyefE_zybPLTVMOOoDeA7snugUDJWbnUBR1SmeBRSWXHLbpcRLaTPJrdUKBA/exec';
window.isPremium = false;
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

const visiblePosts = allMarketplacePosts.filter(p => p.category === selectedCategory);



  console.log('📛 Current filter:', selectedCategory);
  console.log('📋 Found posts:', visiblePosts.length);

  const feed = document.getElementById('marketplaceContent');
  if (!feed) {
    console.error('❌ #marketplaceContent not found');
    return;
  }

  // Preserve fixed UI (form + refresh) when re-rendering
  const formNode = document.getElementById('marketplacePostForm');
  const refreshNode = document.getElementById('refreshMarketplace');
  const loadingNode = document.getElementById('loadingMarketplace');

  feed.innerHTML = '';

  visiblePosts.forEach(post => {
    // Render post DOM...
    const postDiv = document.createElement('div');
    postDiv.className = 'relative border border-yellow-500 rounded-2xl p-5 bg-black/70 text-yellow-300 shadow-lg transition hover:border-yellow-400';

    const header = document.createElement('div');
    header.className = 'flex justify-between items-center mb-2';

    const user = document.createElement('div');
    user.className = 'text-sm font-semibold text-yellow-400';
    user.textContent = post.username;

    const timeAgo = document.createElement('div');
    timeAgo.className = 'text-xs text-yellow-500';
    timeAgo.textContent = timeSince(new Date(post.timestamp)) + ' ago';

    header.append(user, timeAgo);

    const content = document.createElement('p');
    content.className = 'text-sm leading-relaxed mb-3 text-yellow-200';
    content.textContent = post.post;

    const likeBtn = document.createElement('button');
    likeBtn.className = 'flex items-center gap-1 text-sm text-yellow-400 hover:text-red-500';
    likeBtn.innerHTML = `<i data-lucide="heart" class="w-4 h-4"></i> ${post.likes}`;
    likeBtn.onclick = () => {
      const liked = likeBtn.classList.toggle('liked');
      const type = liked ? 'like' : 'unlike';
      window.lastLikedBtn = likeBtn;
      // Always treat likes as Marketplace sheet regardless of subcategory
      window.post(type, { postId: post.postId, category: 'marketplace' });
    };

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
          category: 'marketplace'
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

  // Re-attach fixed nodes (if they exist)
  if (formNode) feed.appendChild(formNode);
  if (refreshNode) feed.appendChild(refreshNode);
  if (loadingNode) loadingNode.remove();

  console.log(`📦 Rendered ${visiblePosts.length} posts in category:`, selectedCategory);
  // Ensure form visible for logged-in users
  window.ensurePostFormsVisibility?.();
}


function loadMarketplace(category = 'jobs') {
  window.currentMarketplaceCategory = category;
  jsonp(`${window.SHEET_API_URL}?type=getMarketplace&callback=handleMarketplace`);
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

  // Preserve fixed UI (form + refresh) when re-rendering
  const postForm = document.getElementById('postForm');
  const refreshBtn = document.getElementById('refreshFeed');
  const loadingNode2 = document.getElementById('loadingPosts');

  feed.innerHTML = '';

  posts.forEach(post => {
  const postDiv = document.createElement('div');
  postDiv.className = 'relative border border-yellow-500 rounded-2xl p-5 bg-black/70 text-yellow-300 shadow-lg transition hover:border-yellow-400';

  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-2';

  const user = document.createElement('div');
  user.className = 'text-sm font-semibold text-yellow-400';
  user.textContent = post.username;

  const timeAgo = document.createElement('div');
  timeAgo.className = 'text-xs text-yellow-500';
  timeAgo.textContent = timeSince(new Date(post.timestamp)) + ' ago';

  header.append(user, timeAgo);

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
    window.post(type, { postId: post.postId, category: 'marketplace' });
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
        category: 'marketplace'
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


  console.log('📦 Newsfeed rendered to DOM');
  // Re-attach fixed nodes
  if (postForm) feed.appendChild(postForm);
  if (refreshBtn) feed.appendChild(refreshBtn);
  if (loadingNode2) loadingNode2.remove();
  // Ensure form visible for logged-in users
  window.ensurePostFormsVisibility?.();
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

function bindUIButtons() {
  console.log('🔗 bindUIButtons() running');

  
  bindSubmissionForm();

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


document.querySelectorAll('.categoryBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    const cat = btn.getAttribute('data-cat');
    window.currentMarketplaceCategory = cat;
    loadMarketplace(cat);
  });
});



bindMarketplacePostForm();


document.getElementById('closeOnboarding')?.addEventListener('click', () => {
  document.getElementById('onboardingModal')?.classList.add('hidden');
});


  document.getElementById('affiliatesBtn')?.addEventListener('click', () => {
  const level = (localStorage.getItem('membershipLevel') || '').toLowerCase();
  if (level === 'affiliate') {
    // Ask permission and send desktop notification
    if (Notification.permission === 'granted') {
      new Notification('🌹 Affiliates', {
        body: 'Coming soon...',
        icon: 'flower.png' // optional
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification('🌹 Affiliates', {
            body: 'Coming soon...',
            icon: 'flower.png'
          });
        }
      });
    }
  } else {
    alert('🔒 COMING SOON...');
  }
});


  document.getElementById('requestsBtn')?.addEventListener('click', () => {
  const submenu = document.getElementById('requestsSubMenu');
  submenu?.classList.toggle('hidden');
});


document.querySelectorAll('#requestsSubMenu button').forEach(btn => {
  btn.addEventListener('click', () => {
    const label = btn.textContent.trim();
    const typeMap = {
      'Request Verification': 'Verification',
      'Request Donations': 'Donations',
      'Request an Event': 'Event'
    };
    const type = typeMap[label] || 'Verification'; // fallback
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

// Optional: handle success/failure
window.handleRequestResponse = function (resp) {
  console.log('📥 handleRequestResponse received:', resp);
  if (resp.success) {
    alert('✅ Request submitted successfully!');
    document.getElementById('requestModal')?.classList.add('hidden');
  } else {
    alert('❌ Error submitting request.');
  }
};

document.getElementById('submitFeedback')?.addEventListener('click', () => {
  const msg = document.getElementById('feedbackMessage').value.trim();
  if (!msg) return alert('Please enter a message.');

  jsonp(`${SHEET_API_URL}?type=feedback&message=${encodeURIComponent(msg)}&callback=handleFeedbackResponse`);
});

window.handleFeedbackResponse = function(resp) {
  console.log('📥 Feedback response:', resp);
  if (resp.success) {
    alert('✅ Thank you for your feedback!');
    document.getElementById('feedbackMessage').value = '';
    document.getElementById('feedbackModal')?.classList.add('hidden');
  } else {
    alert('❌ Failed to send feedback. Try again later.');
  }
};

document.getElementById('cancelFeedback')?.addEventListener('click', () => {
  document.getElementById('feedbackModal')?.classList.add('hidden');
});

  document.querySelectorAll('.closeBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.modal')?.classList.add('hidden');
  });
});

  document.getElementById('marketplaceBtn')?.addEventListener('click', () => {
    console.log('🛒 marketplaceBtn clicked. isLoggedIn=', window.isLoggedIn?.());
    // set overlay state before opening to avoid flash
    window.updateLockedOverlays?.();
    const sidebar = document.getElementById('marketplaceSidebar');
    sidebar?.classList.remove('translate-x-full');
    if (window.isLoggedIn?.()) {
      loadMarketplace();
      setTimeout(() => window.ensurePostFormsVisibility?.(), 0);
    }
  });

  // 🔃 Toggle filter panel (temporarily disabled but kept for later)
  document.getElementById('filterBtn')?.addEventListener('click', () => {
    if (false) {
      const panel = document.getElementById('filterPanel');
      panel?.classList.toggle('hidden');
    }
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

  console.log('📰 newsfeedBtn clicked. isLoggedIn=', window.isLoggedIn?.());
  window.updateLockedOverlays?.();
  setTimeout(() => window.ensurePostFormsVisibility?.(), 0);
});

// 🎬 Entertainment sidebar open
document.getElementById('entertainmentBtn')?.addEventListener('click', () => {
  const sidebar = document.getElementById('entertainmentSidebar');
  const lockedOverlay = document.getElementById('lockedEntertainmentModal');

  sidebar?.classList.remove('translate-x-full');
  loadEntertainment?.();

  console.log('🎬 entertainmentBtn clicked. isLoggedIn=', window.isLoggedIn?.());
  window.updateLockedOverlays?.();
});

// Entertainment category tabs (FYP / Following)
window.entertainmentFilter = window.entertainmentFilter || 'fyp';
document.querySelectorAll('.entCategoryBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    const cat = btn.getAttribute('data-cat');
    window.entertainmentFilter = cat;
    document.querySelectorAll('.entCategoryBtn').forEach(b => b.classList.remove('active-category'));
    btn.classList.add('active-category');
    // For now, no filtering logic server-side; this is a UI toggle placeholder
  });
});

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

  // ✅ Handle locked newsfeed close button
document.getElementById('closeLockedModal')?.addEventListener('click', () => {
  document.getElementById('lockedNewsModal')?.classList.add('hidden');
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
};// Show all markers
window.showAllLocations = () => {
  geoMarkers.forEach(({ marker }) => {
    marker.getElement().style.display = 'block';
  });
};const searchInput = document.getElementById('search');
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
    document.getElementById('newsfeedSidebar')?.classList.add('translate-x-full');
    document.getElementById('entertainmentSidebar')?.classList.add('translate-x-full');
    // Hide profile menu and onboarding
    document.getElementById('profileMenu')?.classList.add('hidden');
    document.getElementById('onboardingModal')?.classList.add('hidden');
    // Hide any lock overlays
    document.getElementById('lockedMarketplaceModal')?.classList.add('hidden');
    document.getElementById('lockedEntertainmentModal')?.classList.add('hidden');
    document.getElementById('lockedNewsModal')?.classList.add('hidden');
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
  bind('newsfeedSignInBtn', openLogin);
  bind('profileLoginBtn', openLogin);
  bind('openSignupLink', openSignup);
  bind('profileSignupBtn', openSignup);
  bind('onboardingSignupBtn', openSignup);

  // Delegated fallback for any dynamically added elements
  document.addEventListener('click', (ev) => {
    const q = (sel) => ev.target.closest(sel);
    if (q('#marketplaceSignInBtn') || q('#entertainmentSignInBtn') || q('#newsfeedSignInBtn') || q('#profileLoginBtn')) {
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

  // Hide any locked overlays now that user is logged in
  document.getElementById('lockedMarketplaceModal')?.classList.add('hidden');
  document.getElementById('lockedEntertainmentModal')?.classList.add('hidden');
  document.getElementById('lockedNewsModal')?.classList.add('hidden');
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
  toggle('lockedNewsModal');
}

// Ensure post forms are usable when logged in
window.ensurePostFormsVisibility = function () {
  if (!window.isLoggedIn?.()) return;
  document.getElementById('lockedMarketplaceModal')?.classList.add('hidden');
  document.getElementById('lockedNewsModal')?.classList.add('hidden');
  ['marketplacePostForm','postForm'].forEach(id => {
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
