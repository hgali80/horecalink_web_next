# HorecaLink Welcome Showcase — November 2026

The homepage displays the five supplied Russian-language campaign creatives in order:
cover, sketch, technical drawing, production, packaging/shipping. Mobile uses the original
portrait compositions; desktop reflows the original photographs with live Russian headings,
benefit text, and the original logo. CSS crops retain the supplied product imagery.
The real homepage remains visible through a blurred transparent backdrop.

## Behaviour

- Active from 3 November 2026 00:00 until **10 November 2026 23:59:00 UTC+05:00**.
- Three visible seconds per loaded slide; after the fifth, close to the homepage.
- Back/forward restart the current three-second timer; previous is disabled on the first slide.
- X, Escape, and Continue to site close immediately. Pause/resume and keyboard arrows work.
- Pause time while the document is hidden and while the next image loads.
- Once per tab session, marked when the modal actually opens. Refresh and navigation do not
  replay it. A newly opened tab normally starts a new session; browser session restoration
  and duplicated tabs may restore sessionStorage, following standard browser behaviour.
- No Firebase, backend, or database is used by this feature. The existing homepage may
  still use its normal services. The seasonal opening is suppressed during the campaign
  so that two modal dialogs do not stack.
- Expiry closes an already open campaign, including on return from a suspended tab.
  Expired sessions do not load the slideshow chunk or images. All images are local WebP
  encodings of the supplied PNGs; no new product or logo was generated.

## Remove the expired campaign

Automatic expiry hides the campaign; static deployment files cannot delete themselves.
Run this from the project root for a read-only cleanup preview:

```sh
node scripts/cleanup-welcome-showcase.mjs
```

After the deadline, remove the campaign with:

```sh
node scripts/cleanup-welcome-showcase.mjs --apply
npm run build
```

Then deploy using the normal project release process. The script verifies the integration
before updating `app/components/Celebration.jsx` and removes only these campaign folders:

- `app/components/welcome-showcase/`
- `public/images/welcome-showcase/`

Original PNG files in Downloads are unaffected. The script is idempotent and refuses to
apply changes before expiry. This maintenance note and cleanup script can be removed
after the cleanup release. Existing hashed browser caches expire normally; they no longer
appear in the new site's source or new visitor downloads. No reminder or deployment has
been scheduled automatically.
