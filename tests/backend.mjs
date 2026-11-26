import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

const {API_URL,ANON_KEY,SERVICE_ROLE_KEY}=process.env;
assert.ok(API_URL&&ANON_KEY&&SERVICE_ROLE_KEY,'Use a disposable local Supabase instance.');
async function request(path,{token,key=ANON_KEY,method='GET',data,body,type='application/json',expected=200}={}){
  const response=await fetch(API_URL+path,{method,headers:{
    apikey:key,'Content-Type':type,...(token?{Authorization:'Bearer '+token}:{})
  },body:body??(data===undefined?undefined:JSON.stringify(data))});
  const text=await response.text();
  assert.ok([expected].flat().includes(response.status),method+' '+path+' → '+response.status+' '+text.slice(0,450));
  return text?JSON.parse(text):null;
}
const rpc=(name,data={},token,expected=200)=>request('/rest/v1/rpc/'+name,{method:'POST',data,token,expected});
const settings=await request('/auth/v1/settings');
assert.equal(settings.disable_signup,true);
assert.equal(settings.external.anonymous_users,false);
await request('/auth/v1/signup',{method:'POST',data:{email:'blocked@example.invalid',password:randomUUID()},expected:[400,403,422]});
await request('/auth/v1/signup',{method:'POST',data:{},expected:[400,403,422]});

async function account(){
  const email=randomUUID()+'@example.com', password=randomUUID();
  await request('/auth/v1/admin/users',{method:'POST',key:SERVICE_ROLE_KEY,token:SERVICE_ROLE_KEY,expected:[200,201],
    data:{email,password,email_confirm:true}});
  const login=await request('/auth/v1/token?grant_type=password',{method:'POST',data:{email,password}});
  return {email,token:login.access_token};
}
const [owner,other]=await Promise.all([account(),account()]);
const sql=(await readFile('supabase/studio/tihoe-utro-1.3.sql','utf8')).replace('replace-owner@example.invalid',owner.email);
execFileSync('docker',['exec','-i','supabase_db_tihoe-utro','psql','-q','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:sql});
assert.equal(await rpc('storefront_is_owner',{},owner.token),true);
assert.equal(await rpc('storefront_is_owner',{},other.token),false);
await rpc('storefront_draft',{},null,[401,403]);
await rpc('storefront_draft',{},other.token,403);
await rpc('publish_storefront',{expected:0},other.token,403);
await rpc('save_storefront_draft',{expected:0,content:{}},other.token,403);
await rpc('place_order',{p:{}},null,[401,403,404]);
await request('/rest/v1/orders?select=id',{expected:[401,403,404]});

const baseline=await rpc('storefront_snapshot');
assert.equal(baseline.content.fabrics.length,0);
assert.equal(Object.hasOwn(baseline.content,'rules'),false);
const state=await rpc('storefront_draft',{},owner.token);
const draft=state.draft;
const media=randomUUID()+'.jpg',hiddenMedia=randomUUID()+'.jpg';
const jpeg=await readFile('/tmp/tihoe-utro-test.jpg');
const upload=(name,token,expected)=>request('/storage/v1/object/site-media/'+name,{token,method:'POST',body:jpeg,type:'image/jpeg',expected});
await upload(randomUUID()+'.jpg',other.token,[400,401,403]);
await upload(media,owner.token,[200,201]);
await upload(hiddenMedia,owner.token,[200,201]);
const sign=async(paths,token,expected=200)=>request('/storage/v1/object/sign/site-media',{token,method:'POST',data:{paths,expiresIn:600},expected});
const before=await sign([media,hiddenMedia],undefined,[200,400,401,403,404]);
assert.ok(!Array.isArray(before)||before.every(x=>!x.signedURL));
assert.ok((await sign([media],owner.token))[0].signedURL);
draft.home={...draft.home,title:'Опубликованный заголовок',hero:media};
draft.notice={title:'Скрытое объявление',text:'Черновой текст',enabled:false};
const f={id:randomUUID(),category_slug:null,name:'Сатин',material:'Хлопок',composition:'100% хлопок',
  photo:media,available:true,colors:['Шалфей'],width:220,stock:12,rate:600};
draft.fabrics=[f,{...f,id:randomUUID(),photo:hiddenMedia,hidden:true}];
const baseProduct={id:randomUUID(),name:'Полотенце',material:'Хлопок',description:'Индивидуальный пошив',category_slug:'polotentsa',
  available:true,colors:['Шалфей'],sizes:['50 × 90'],image:media};
const custom={...baseProduct,pricing:'custom',price:140,fabric_id:f.id,custom_size:true};
const fixed={...baseProduct,id:randomUUID(),name:'Готовый набор',pricing:'fixed',price:800};
draft.products=[custom,fixed];
await rpc('save_storefront_draft',{expected:state.revision,content:{...draft,home:{...draft.home,hero:randomUUID()+'.jpg'}}},owner.token,400);
const saved=await rpc('save_storefront_draft',{expected:state.revision,content:draft},owner.token);
assert.equal(saved.revision,state.revision+1);
assert.deepEqual(await rpc('storefront_snapshot'),baseline);
await rpc('publish_storefront',{expected:state.revision},owner.token,400);
await rpc('publish_storefront',{expected:saved.revision},owner.token);
const publicDoc=(await rpc('storefront_snapshot')).content;
assert.equal(publicDoc.home.title,draft.home.title);
assert.equal(publicDoc.fabrics.length,1);
assert.equal(Object.hasOwn(publicDoc.fabrics[0],'rate'),false);
assert.equal(Object.hasOwn(publicDoc.notice,'text'),false);
assert.ok((await sign([media]))[0].signedURL);
const hidden=await sign([hiddenMedia],undefined,[200,400,401,403,404]);
assert.ok(!Array.isArray(hidden)||hidden.every(x=>!x.signedURL));

const p={category_slug:'postelnoe-belie',fabric_id:f.id,color:'Шалфей',items:[{type:'pillow',w:50,l:70,qty:2,closure:'Клапан'}]};
const initialPrice=await rpc('storefront_quote',{p});
assert.ok(initialPrice>0);
const productQuote={product_id:custom.id,color:'Шалфей',size:'55 × 85',qty:2};
assert.ok(await rpc('storefront_quote',{p:productQuote})>0);
await rpc('storefront_quote',{p:{...productQuote,product_id:fixed.id}},null,400);
await rpc('storefront_quote',{p:{...productQuote,qty:999}},null,400);
const next=await rpc('storefront_draft',{},owner.token);
next.draft.fabrics[0].rate=1600;
const edit=await rpc('save_storefront_draft',{expected:next.revision,content:next.draft},owner.token);
assert.equal(await rpc('storefront_quote',{p}),initialPrice);
await rpc('publish_storefront',{expected:edit.revision},owner.token);
assert.ok(await rpc('storefront_quote',{p})>initialPrice);
console.log('Auth registration disabled, owner-only writes, draft and photo isolation, revision conflicts, publication and quotes checked.');
