const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'app/lib/homeBanner.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(root, 'app/lib/homeBannerUpload.js'), 'utf8').replace(/^import .*;\r?\n/, '');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const original = process.argv[2] ? fs.readFileSync(process.argv[2]).toString('base64') : null;
    const result = await page.evaluate(async ({ source, original }) => {
      const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      const { prepareBannerUpload, readBannerResponse, BANNER_TRANSFER_MAX_BYTES } = await import(moduleUrl);
      URL.revokeObjectURL(moduleUrl);
      let file;
      if (original) {
        const bytes = Uint8Array.from(atob(original), char => char.charCodeAt(0));
        file = new File([bytes], 'banner.png', { type: 'image/png' });
      } else {
        const canvas = document.createElement('canvas'); canvas.width = 2162; canvas.height = 727;
        const context = canvas.getContext('2d');
        const pixels = context.createImageData(canvas.width, canvas.height);
        for (let i = 0; i < pixels.data.length; i += 4) {
          pixels.data[i] = Math.random() * 255; pixels.data[i + 1] = Math.random() * 255;
          pixels.data[i + 2] = Math.random() * 255; pixels.data[i + 3] = 255;
        }
        context.putImageData(pixels, 0, 0);
        file = new File([await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))], 'noise.png', { type: 'image/png' });
      }
      const prepared = await prepareBannerUpload(file);
      const bitmap = await createImageBitmap(prepared);
      const form = new FormData();
      for (let i = 0; i < 5; i++) form.append(`slide-${i}`, prepared);
      form.append('settings', JSON.stringify({ slides: Array.from({ length: 5 }, (_, i) => ({ id: `slide-${i}`, alt: 'Banner', href: '' })), interval: 5, autoplay: true, revision: 0 }));
      const bodySize = (await new Response(form).blob()).size;
      let payloadError, htmlError;
      try { await readBannerResponse(new Response('Request Entity Too Large', { status: 413 })); } catch (error) { payloadError = error.message; }
      try { await readBannerResponse(new Response('<html>Bad gateway</html>', { status: 502 })); } catch (error) { htmlError = error.message; }
      const saved = await readBannerResponse(Response.json({ slides: [], revision: 1 }));
      return { originalSize: file.size, preparedSize: prepared.size, type: prepared.type, width: bitmap.width, height: bitmap.height, bodySize, max: BANNER_TRANSFER_MAX_BYTES, payloadError, htmlError, revision: saved.revision };
    }, { source, original });
    assert.ok(result.preparedSize <= result.max);
    assert.equal(result.type, 'image/webp');
    assert.ok(result.width / result.height >= 2.7 && result.width / result.height <= 3.3);
    assert.ok(result.bodySize < 4_500_000);
    assert.match(result.payloadError, /Sunucu yükleme boyutunu reddetti/);
    assert.match(result.htmlError, /HTTP 502/);
    assert.equal(result.revision, 1);
    console.log(JSON.stringify(result, null, 2));
    console.log('PASS: browser compression, five-image request budget, 413/HTML errors and JSON success.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
