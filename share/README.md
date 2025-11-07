Static Open Graph share pages

Overview
- These pages ensure WhatsApp/Telegram/X render rich previews for individual posts.
- Build them with: `node tools/build-share-pages.js`

What it does
- Entertainment: creates `share/entertainment/<id>.html` with og:title/description/image based on the creator post.
- Activity: creates `share/activity/<postId>.html` with og:title/description and a TGR-branded image fallback.

How to share
- Entertainment: `https://thegoldenrose.uk/share/entertainment/<id>.html`
- Activity: `https://thegoldenrose.uk/share/activity/<postId>.html`

Deep-linking
- These pages include an “Open on The Golden Rose” button which deep-links back to the main site and opens the correct section.

Notes
- Social scrapers do not run JavaScript, so per-post meta tags must be pre-rendered (this is why these static files exist).
- Re-run the builder when new posts are added to refresh share pages.

