// Real admin and decoration components; all API calls use local fixtures.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const compiled = require('next/dist/compiled/webpack/webpack');
compiled.init();
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'celebrations-ui-'));
const write = (name, value) => fs.writeFileSync(path.join(temp, name), value);
write('loader.cjs', `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;`);
write('link.jsx', 'export default function Link({href,children,...props}) {return <a href={href} {...props}>{children}</a>;}');
write('image.jsx', 'export default function Image(props) {return <img {...props}/>;}');
write('auth.js', 'export const auth={currentUser:{getIdToken:async()=>"fixture-token"}};');
write('lang.js', 'export const useLang=()=>({lang:"kz"});');
write('css-loader.cjs', "module.exports = source => \"export default \" + JSON.stringify(Object.fromEntries([...source.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(x => [x[1], x[1]]))) + \";\";");
write('nav.js', 'export const usePathname=()=>"/";');
write('entry.jsx', `import React from 'react';import{createRoot}from'react-dom/client';import Admin from ${JSON.stringify(path.join(root, 'app/satissitok/admin/celebrations/page.jsx'))};createRoot(document.getElementById('root')).render(<Admin/>);`);

async function main() {
  await new Promise((resolve, reject) => {
    const compiler = compiled.webpack({ mode: 'development', devtool: false, context: root,
      entry: path.join(temp, 'entry.jsx'), output: {path: temp, filename: 'bundle.js'},
      resolve: {extensions: ['.js', '.jsx', '.tsx'], modules: [path.join(root, 'node_modules')], alias: {
        '@/firebase$': path.join(temp, 'auth.js'), '@': root, 'next/link$': path.join(temp, 'link.jsx'),
        'next/image$': path.join(temp, 'image.jsx'), 'next/navigation$': path.join(temp, 'nav.js'),
        '../context/LanguageContext$': path.join(temp, 'lang.js'),
      }}, module: {rules: [{test: /\.css$/, use: path.join(temp, 'css-loader.cjs')}, {test: /\.[jt]sx?$/, exclude: /node_modules/, use: path.join(temp, 'loader.cjs')}]},
    });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({all: false, errors: true}))) : resolve()));
  });
  const cssPath = path.join(root, '.next/static/css');
  const css = fs.readdirSync(cssPath).filter(name => name.endsWith('.css')).map(name => fs.readFileSync(path.join(cssPath, name), 'utf8')).join('\n');
  const server = http.createServer((request, response) => {
    if (request.url === '/bundle.js') {response.setHeader('Content-Type', 'text/javascript');response.end(fs.readFileSync(path.join(temp, 'bundle.js')));}
    else if (request.url === '/flags/kz.svg') {response.setHeader('Content-Type', 'image/svg+xml');response.end(fs.readFileSync(path.join(root, 'public/flags/kz.svg')));}
    else {response.setHeader('Content-Type', 'text/html; charset=utf-8');response.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script src="/bundle.js"></script>`);}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel: process.env.PLAYWRIGHT_CHANNEL} : {})});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let settings = {activeId: null, revision: 0};
    let fail = false;
    let writes = 0;
    await page.route('**/api/admin/celebrations', async route => {
      if (route.request().method() === 'PUT') {
        writes++;
        assert.equal(route.request().headers().authorization, 'Bearer fixture-token');
        if (fail) return route.fulfill({status: 500, json: {error: 'Fixture save failed'}});
        const data = route.request().postDataJSON();
        assert.equal(data.revision, settings.revision);
        settings = {activeId: data.activeId, revision: settings.revision + 1};
      }
      return route.fulfill({json: settings});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('button', {name: 'Aktif et', exact: true}).waitFor();
    await page.getByRole('button', {name: 'Önizle', exact: true}).click();
    assert.equal(writes, 0);
    for (const width of [360, 390, 1280]) {
      await page.setViewportSize({width, height: 900});
      for (const language of ['kz', 'ru', 'tr', 'en']) {
        await page.getByRole('combobox').selectOption(language);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
    }
    await page.getByRole('combobox').selectOption('kz');
    await page.screenshot({path: path.join(root, 'tmp/celebrations-desktop.png'), fullPage: true});
    await page.setViewportSize({width: 390, height: 844});
    await page.screenshot({path: path.join(root, 'tmp/celebrations-mobile.png'), fullPage: true});
    await page.getByRole('button', {name: 'Aktif et', exact: true}).click();
    await page.getByRole('button', {name: 'Pasif et', exact: true}).waitFor();
    await page.reload();
    await page.getByRole('button', {name: 'Pasif et', exact: true}).waitFor();
    fail = true;
    await page.getByRole('button', {name: 'Pasif et', exact: true}).click();
    await page.getByRole('alert').waitFor();
    assert.equal(settings.activeId, 'republic-day');
    assert.ok(await page.getByRole('button', {name: 'Pasif et', exact: true}).isVisible());
    fail = false;
    await page.getByRole('button', {name: 'Pasif et', exact: true}).click();
    await page.getByRole('button', {name: 'Aktif et', exact: true}).waitFor();
    assert.equal(settings.activeId, null);
    assert.deepEqual(errors, []);
    console.log('PASS: preview does not save; four languages at 360/390/1280px; activate, reload, failed save, deactivate; no browser errors.');
  } finally {await browser.close();await new Promise(resolve => server.close(resolve));}
}
main().catch(error => {console.error(error);process.exitCode = 1;});
