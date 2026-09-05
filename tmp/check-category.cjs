const {chromium}=require('C:/Users/hasan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
const page=await browser.newPage();
await page.addInitScript(()=>localStorage.setItem('hl_lang','tr'));
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:3000/catalog');
await page.locator('main section a').last().waitFor();
assert.equal(await page.locator('main section a').count(),36);
for(const [width,columns] of [[1440,4],[800,3],[390,2],[320,1]]){
await page.setViewportSize({width,height:1000});
const layout=await page.locator('main section > div').first().evaluate(e=>({columns:getComputedStyle(e).gridTemplateColumns.split(' ').length,overflow:document.documentElement.scrollWidth>innerWidth}));
assert.equal(layout.columns,columns);assert.equal(layout.overflow,false);
console.log({width,...layout});
}
await page.setViewportSize({width:1440,height:1000});
await page.screenshot({path:'tmp/category-desktop.png'});
const borders=await page.locator('main section').evaluateAll(sections=>sections.map(s=>{const c=getComputedStyle(s.querySelector('a'));return {width:c.borderTopWidth,color:c.borderTopColor}}));
assert.ok(borders.every(b=>b.width==='3px'));console.log({borders});
const api=await page.request.get('http://localhost:3000/api/category-images'); console.log({imagesApi:api.status()}); assert.equal(api.status(),200);
const unauthorized=await page.request.put('http://localhost:3000/api/admin/category-images',{multipart:{key:'institutional--cleaning-chemicals',remove:'true'}});assert.equal(unauthorized.status(),401);
const href=await page.locator('main section a').first().getAttribute('href');await page.locator('main section a').first().click();await page.waitForURL('**'+href);console.log({categoryNavigation:href,pageErrors:errors});assert.equal(errors.length,0);
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
