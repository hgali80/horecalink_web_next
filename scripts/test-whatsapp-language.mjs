import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLanguageResponse, translateTexts } from '../app/lib/server/whatsappLanguage.mjs';
const completed = rows => ({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({translations:rows})}]}]});
test('translation rejects incomplete, refused, duplicate and foreign message results',() => {
  assert.throws(() => parseLanguageResponse({status:'incomplete'},['a']));
  assert.throws(() => parseLanguageResponse({status:'completed',output:[{content:[{type:'refusal'}]}]},['a']));
  assert.throws(() => parseLanguageResponse(completed([{id:'b',text:'Merhaba',language:'ru'}]),['a']));
  assert.throws(() => parseLanguageResponse(completed([{id:'a',text:'x',language:'ru'},{id:'a',text:'y',language:'ru'}]),['a','b']));
});
test('provider only receives text and ordinal IDs with no profile data and no send tools',async () => {
  const result=await translateTexts([{id:'private-message-id',text:'Цена 1234 KZT?'}],'tr',async (url,options) => {
    assert.equal(url,'https://api.openai.com/v1/responses');
    const body=JSON.parse(options.body);
    assert.equal(body.store,false); assert.equal(body.tools,undefined);
    assert.equal(body.input.includes('private-message-id'),false);
    assert.deepEqual(JSON.parse(body.input).items,[{id:'0',text:'Цена 1234 KZT?'}]);
    return Response.json(completed([{id:'0',text:'Fiyat 1234 KZT mi?',language:'ru'}]));
  },{WHATSAPP_DRAFTS_ENABLED:'true',OPENAI_API_KEY:'fake',OPENAI_MODEL:'configured-model'});
  assert.equal(result[0].id,'private-message-id');
  assert.equal(result[0].text,'Fiyat 1234 KZT mi?');
});
test('translation is disabled without server configuration',async () => {
  await assert.rejects(translateTexts([{id:'a',text:'test'}],'tr',() => assert.fail('network'),{}));
});

test('translation route authorizes, scopes message IDs and reuses cached text without another provider call',async () => {
  const {readFile}=await import('node:fs/promises');
  const base=new URL('../app/lib/server/',import.meta.url);
  let source=await readFile(new URL('../app/api/admin/whatsapp/conversations/[conversationId]/translate/route.js',import.meta.url),'utf8');
  source=source.replace("import { authorizeWhatsAppRequest, inboxJson } from '@/app/lib/server/whatsappInbox';",'const authorizeWhatsAppRequest=async () => globalThis.__languageAuth; const inboxJson=(body,status=200) => Response.json(body,{status});');
  for (const file of ['whatsappInboxCore.mjs','whatsappLanguage.mjs','whatsappReplyCore.mjs']) source=source.replace(`'@/app/lib/server/${file}'`,JSON.stringify(new URL(file,base).href));
  const route=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const conversation='a'.repeat(64), message='b'.repeat(64), foreign='c'.repeat(64);
  const records=new Map([[`whatsapp_conversations/${conversation}`,{}],[`whatsapp_conversations/${conversation}/messages/${message}`,{type:'text',text:'Здравствуйте'}],[`whatsapp_conversations/${foreign}/messages/${message}`,{type:'text',text:'secret foreign message'}]]);
  const ref=path => ({id:path.split('/').at(-1),path,collection:name => collection(`${path}/${name}`),get:async () => ({exists:records.has(path),data:() => records.get(path)}),update:async data => records.set(path,{...records.get(path),...data})});
  const collection=path => ({doc:id => ref(`${path}/${id}`)});
  const db={collection,runTransaction:async callback => callback({get:document => document.get(),update:(document,data) => records.set(document.path,{...records.get(document.path),...data}),set:(document,data) => records.set(document.path,data)})};
  const oldFetch=globalThis.fetch;
  const keys=['WHATSAPP_DRAFTS_ENABLED','OPENAI_API_KEY','OPENAI_MODEL'];
  const saved=keys.map(key => [key,process.env[key]]);
  const request=body => new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
  const context={params:Promise.resolve({conversationId:conversation})};
  let calls=0;
  try {
    globalThis.__languageAuth={ok:false,response:new Response('denied',{status:403})};
    assert.equal((await route.POST(request({action:'messages',ids:[message]}),context)).status,403);
    globalThis.__languageAuth={ok:true,uid:'operator',adminDb:db};
    assert.equal((await route.POST(request({action:'messages',ids:['../foreign']}),context)).status,400);
    Object.assign(process.env,{WHATSAPP_DRAFTS_ENABLED:'true',OPENAI_API_KEY:'fake',OPENAI_MODEL:'configured'});
    globalThis.fetch=async (url,options) => {
      calls++; const body=JSON.parse(options.body);
      assert.equal(body.input.includes('secret foreign message'),false);
      return Response.json(completed([{id:'0',text:'Merhaba',language:'ru'}]));
    };
    const first=await route.POST(request({action:'messages',ids:[message]}),context);
    assert.equal(first.status,200); assert.equal((await first.json()).translations[0].text,'Merhaba');
    const second=await route.POST(request({action:'messages',ids:[message]}),context);
    assert.equal(second.status,200); assert.equal(calls,1);
    assert.equal(records.get(`whatsapp_conversations/${conversation}/messages/${message}`).text,'Здравствуйте');
  } finally {
    globalThis.fetch=oldFetch; delete globalThis.__languageAuth;
    for (const [key,value] of saved) { if (value===undefined) delete process.env[key]; else process.env[key]=value; }
  }
});
