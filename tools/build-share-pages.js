/*
  Build static share pages with real Open Graph/Twitter tags
  so WhatsApp/Telegram/X show accurate previews for posts.

  Usage:
    node tools/build-share-pages.js

  Optional env:
    SITE_ORIGIN=https://thegoldenrose.uk
*/

const fs = require('fs');
const path = require('path');
const https = require('https');

const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://thegoldenrose.uk';
const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbyIqpE0QffyefE_zybPLTVMOOoDeA7snugUDJWbnUBR1SmeBRSWXHLbpcRLaTPJrdUKBA/exec';
const OUT_DIR = path.join(process.cwd(), 'share');
const ACTIVITY_CATEGORIES = ['general','announcements','news'];

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseJsonp(text) {
  const i = text.indexOf('(');
  const j = text.lastIndexOf(')');
  if (i === -1 || j === -1) throw new Error('Invalid JSONP');
  const inner = text.slice(i + 1, j);
  return JSON.parse(inner);
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// FNV-1a 32-bit hash → hex string
function fnv1a(str) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // h *= 16777619 (with overflow) → use shifts for speed
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('00000000' + h.toString(16)).slice(-8);
}

function timeISO(ts) {
  try { return new Date(ts).toISOString(); } catch { return new Date().toISOString(); }
}

function buildHtml({ title, description, image, url, type = 'article', bodyHtml = '', redirectUrl }) {
  const fullTitle = title || 'The Golden Rose';
  const desc = description || '';
  const img = image || `${SITE_ORIGIN}/favicon.png`;
  const canonical = url || SITE_ORIGIN;
  const refresh = redirectUrl ? `<meta http-equiv="refresh" content="0;url=${esc(redirectUrl)}" />` : '';
  const openBtn = redirectUrl ? `<a class="cta" href="${esc(redirectUrl)}">Open on The Golden Rose</a>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(fullTitle)}</title>
  <meta name="theme-color" content="#000000" />
  <link rel="icon" type="image/png" href="${SITE_ORIGIN}/favicon.png" />
  <link rel="canonical" href="${esc(canonical)}" />
  ${refresh}

  <meta property="og:site_name" content="The Golden Rose" />
  <meta property="og:type" content="${esc(type)}" />
  <meta property="og:title" content="${esc(fullTitle)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:image" content="${esc(img)}" />
  <meta property="og:image:alt" content="The Golden Rose" />
  <meta property="og:url" content="${esc(canonical)}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(fullTitle)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="${esc(img)}" />
  <meta name="twitter:site" content="@_thegoldenrose" />

  <style>
    :root { color-scheme: dark; }
    body { margin: 0; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #000; color: #fef9c3; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 32px 16px; }
    .card { background: rgba(0,0,0,0.7); border: 1px solid rgba(234,179,8,0.5); border-radius: 16px; padding: 16px; box-shadow: 0 10px 24px rgba(0,0,0,0.5); }
    .title { color: #facc15; font-weight: 700; margin: 0 0 8px; }
    .byline { color: #fde68a; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.85; }
    .text { color: #fef9c3; font-size: 14px; line-height: 1.45; }
    .img { display:block; width:100%; height:auto; border-radius: 12px; border: 1px solid rgba(234,179,8,0.35); }
    .cta { display:inline-block; margin-top: 14px; padding: 10px 14px; border-radius: 999px; background: #eab308; color: #000; font-weight: 700; text-decoration: none; border: 1px solid #eab308; }
    .brand { display:flex; align-items:center; gap:8px; margin-top:14px; color:#facc15; font-weight:600; }
    .brand img { width: 20px; height: 20px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="wrap">
    ${bodyHtml}
    <div class="brand">
      <img src="${SITE_ORIGIN}/favicon.png" alt="TGR" />
      <span>The Golden Rose</span>
    </div>
  </div>
</body>
</html>`;
}

async function buildEntertainment() {
  const url = `${SHEET_API_URL}?type=getEntertainment&callback=cb`;
  const txt = await httpGet(url);
  const rows = parseJsonp(txt);
  const out = path.join(OUT_DIR, 'entertainment');
  ensureDir(out);

  let count = 0;
  for (const r of rows) {
    const arr = Array.isArray(r) ? r : [r];
    const strings = arr.filter(v => typeof v === 'string');
    const imageUrl = strings.find(v => /^https?:\/\//i.test(v));
    if (!imageUrl) continue;
    const nonUrls = strings.filter(v => !/^https?:\/\//i.test(v));
    const username = (nonUrls[0] || 'Anonymous').toString();
    const caption = (nonUrls[1] || '').toString();
    const id = fnv1a(imageUrl);
    const file = path.join(out, `${id}.html`);
    const shareUrl = `${SITE_ORIGIN}/share/entertainment/${id}.html`;
    const deeplink = `${SITE_ORIGIN}/?v=entertainment&id=${id}`;

    const body = `
      <article class="card">
        <h1 class="title">Entertainment • ${esc(username)}</h1>
        ${caption ? `<p class="text" style="margin-top:6px">${esc(caption)}</p>` : ''}
        <img class="img" loading="eager" src="${esc(imageUrl)}" alt="${esc(caption || 'Entertainment image')}" />
        ${openBtn}
      </article>`;

    const html = buildHtml({
      title: `Entertainment — ${username} • The Golden Rose`,
      description: caption,
      image: imageUrl,
      url: shareUrl,
      type: 'article',
      bodyHtml: body,
      redirectUrl: deeplink
    });
    fs.writeFileSync(file, html);
    count++;
  }
  return count;
}

function activityIdFor(post) {
  const explicit = (post.postId || '').toString().trim();
  if (explicit) return explicit;
  // Fallback to stable hash of essential fields
  return fnv1a([post.username||'', post.text||'', post.timestamp||''].join('|'));
}

async function buildActivity() {
  const out = path.join(OUT_DIR, 'activity');
  ensureDir(out);

  const all = new Map(); // postId -> post
  for (const cat of ACTIVITY_CATEGORIES) {
    const url = `${SHEET_API_URL}?type=getPosts&category=${encodeURIComponent(cat)}&callback=cba`;
    const txt = await httpGet(url);
    const rows = parseJsonp(txt);
    if (!Array.isArray(rows)) continue;
    const body = rows[0] && rows[0][0] === 'Username' ? rows.slice(1) : rows;
    for (const r of body) {
      const post = {
        username: r[0],
        text: r[1],
        likes: r[2],
        postId: r[3],
        timestamp: r[4],
        category: cat
      };
      if (post.postId && !all.has(post.postId)) all.set(post.postId, post);
      if (!post.postId) {
        const fid = activityIdFor(post);
        if (!all.has(fid)) all.set(fid, { ...post, postId: fid });
      }
    }
  }

  let count = 0;
  for (const post of all.values()) {
    const id = activityIdFor(post);
    const file = path.join(out, `${id}.html`);
    const shareUrl = `${SITE_ORIGIN}/share/activity/${id}.html`;
    const deeplink = `${SITE_ORIGIN}/?v=activity&post=${encodeURIComponent(id)}&cat=${encodeURIComponent(post.category || 'general')}`;
    const desc = (post.text || '').toString().slice(0, 200);
    const body = `
      <article class="card">
        <h1 class="title">Activity • ${esc(post.username || 'Anonymous')}</h1>
        <div class="byline">${esc(new Date(post.timestamp || Date.now()).toLocaleString())}</div>
        <p class="text" style="margin-top:8px">${esc(post.text)}</p>
        ${openBtn}
      </article>`;
    const html = buildHtml({
      title: `Activity — ${post.username || 'Anonymous'} • The Golden Rose`,
      description: desc,
      image: `${SITE_ORIGIN}/favicon.png`,
      url: shareUrl,
      type: 'article',
      bodyHtml: body,
      redirectUrl: deeplink
    });
    fs.writeFileSync(file, html);
    count++;
  }
  return count;
}

(async function main() {
  ensureDir(OUT_DIR);
  ensureDir(path.join(OUT_DIR, 'entertainment'));
  ensureDir(path.join(OUT_DIR, 'activity'));

  console.log('Building share pages…');
  const ent = await buildEntertainment().catch(e => { console.error('Entertainment failed:', e); return 0; });
  const act = await buildActivity().catch(e => { console.error('Activity failed:', e); return 0; });
  console.log(`Done. Entertainment: ${ent}, Activity: ${act}`);
})();
