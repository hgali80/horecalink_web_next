import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSocialImages } from '../app/lib/server/socialImages.mjs';
import { publishSocial } from '../app/lib/server/socialMeta.mjs';
test('legacy empty list resolves all three existing gallery files, ignores only missing candidates', async () => {
 const paths=[];
 const bucket={file:path=>({getMetadata:async()=>{paths.push(path); if(!['product_images/354828.jpg','product_images/354828-1.jpg','product_images/354828-2.jpg'].includes(path)) throw Object.assign(new Error(),{code:404}); return [{generation:'7'}];}})};
 assert.deepEqual(await resolveSocialImages({sku:'354828',image_names:[]},bucket),{imageNames:['354828.jpg','354828-1.jpg','354828-2.jpg'],generations:['7','7','7']});
 assert.equal(paths.length,12);
 await assert.rejects(resolveSocialImages({image_names:['missing.jpg']},bucket), /depoda bulunamadı/);
 await assert.rejects(resolveSocialImages({image_names:['../x.jpg']},bucket));
 await assert.rejects(resolveSocialImages({sku:'x'},{file:()=>({getMetadata:async()=>{throw Object.assign(new Error(),{code:403});}})}), /doğrulanamadı/);
});
test('Instagram three-image carousel preserves children across processing runs and publishes one parent', async () => {
 const original=global.fetch; const env={...process.env}; const calls=[]; let next=100, processing=true;
 process.env.META_SOCIAL_ACCESS_TOKEN='test';process.env.META_SOCIAL_INSTAGRAM_ID='123';
 global.fetch=async(url,opts)=>{const params=new URLSearchParams(opts.body);calls.push({url:String(url),params,method:opts.method});return {ok:true,json:async()=>opts.method==='GET'?{status_code:processing?'IN_PROGRESS':'FINISHED'}:{id:String(++next)}};};
 const job={channel:'instagram',attempts:1};const urls=['a','b','c'];
 try {
  await publishSocial(job,'caption',urls,async id=>{job.containerId=id;},async patch=>Object.assign(job,patch));
  assert.equal(job.childContainerIds.length,3);assert.equal(job.containerId,undefined);
  processing=false;
  await publishSocial(job,'caption',urls,async id=>{job.containerId=id;},async patch=>Object.assign(job,patch));
  assert.equal(calls.filter(c=>c.params.get('is_carousel_item')==='true').length,3);
  const parent=calls.find(c=>c.params.get('media_type')==='CAROUSEL');assert.equal(parent.params.get('children'),job.childContainerIds.join(','));assert.equal(parent.params.get('caption'),'caption');
  assert.equal((await publishSocial(job,'caption',urls,async()=>assert.fail())).status,'published');
  assert.equal(calls.filter(c=>c.url.endsWith('/media_publish')).length,1);
 } finally {global.fetch=original;process.env=env;}
});
test('Facebook attaches three unpublished photos to one feed post; failure never creates a partial public post', async () => {
 const original=global.fetch;const env={...process.env};const calls=[];let fail=false;
 process.env.META_SOCIAL_ACCESS_TOKEN='test';process.env.META_SOCIAL_PAGE_ID='123';
 global.fetch=async(url,opts)=>{const params=new URLSearchParams(opts.body);calls.push({url:String(url),params});if(fail&&params.get('url')==='b')throw new Error('network');return {ok:true,json:async()=>opts.method==='GET'?{access_token:'page-test'}:{id:String(100+calls.length)}};};
 try {
  assert.equal((await publishSocial({channel:'facebook'},'caption',['a','b','c'],async()=>{})).status,'published');
  assert.equal(calls.filter(c=>c.params.get('published')==='false').length,3);
  const feed=calls.find(c=>c.url.endsWith('/feed'));assert.equal(JSON.parse(feed.params.get('attached_media')).length,3);assert.equal(feed.params.get('message'),'caption');
  calls.length=0;fail=true;await assert.rejects(publishSocial({channel:'facebook'},'caption',['a','b','c'],async()=>{}));assert.equal(calls.some(c=>c.url.endsWith('/feed')),false);
 }finally{global.fetch=original;process.env=env;}
});
