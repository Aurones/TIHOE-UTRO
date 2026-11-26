import assert from 'node:assert/strict';
import {cp,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const source=process.cwd();
const temp=await mkdtemp(join(tmpdir(),'tihoe-seo-'));
const site='https://aurones.github.io/TIHOE-UTRO/';
const fixture={slug:'novaya-kategoriya',kind:'towel',name:'Полотенца & наборы',description:'Публичное описание категории.',image:'./img/category-towels.webp'};
async function build({live=false,dataAvailable=false,signupDisabled=true}={}){
  await writeFile(join(temp,'public/config.js'),"export const config="+JSON.stringify(live?{mode:'live',url:'https://example.invalid',key:'test-public-key'}:{mode:'demo',url:'https://example.invalid',key:'test-public-key'}));
  await writeFile(join(temp,'public/seo.js'),"export const seo="+JSON.stringify({site,indexing:true,googleVerification:'google-test',yandexVerification:'yandex-test'}));
  const data={content:{categories:[fixture],products:dataAvailable?[{pricing:'custom',available:true}]:[],fabrics:[]}};
  const auth={disable_signup:signupDisabled,external:{anonymous_users:false,email:true}};
  const code='globalThis.fetch=async url=>Response.json(url.endsWith("/settings")?'+JSON.stringify(auth)+':'+JSON.stringify(data)+');await import('+
    JSON.stringify(pathToFileURL(join(temp,'scripts/build.mjs')).href)+');';
  return spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:temp,encoding:'utf8'});
}
const read=path=>readFile(join(temp,'dist',path),'utf8');
try {
  await Promise.all(['public','scripts','package.json'].map(name=>cp(join(source,name),join(temp,name),{recursive:true})));
  const demo=await build();
  assert.equal(demo.status,0,demo.stderr);
  assert.match(await read('index.html'),/noindex,nofollow/);
  assert.match(await read('robots.txt'),/Disallow: \/\n/);
  assert.doesNotMatch(await read('sitemap.xml'),/<url>/);

  const open=await build({live:true,dataAvailable:true,signupDisabled:false});
  assert.notEqual(open.status,0);
  assert.match(open.stderr,/Disable all public sign-ups/);

  const missing=await build({live:true});
  assert.notEqual(missing.status,0);
  assert.match(missing.stderr,/Indexing requires an active public assortment/);

  const live=await build({live:true,dataAvailable:true});
  assert.equal(live.status,0,live.stderr);
  const page=await read('catalog/novaya-kategoriya/index.html');
  const categoryUrl=site+'catalog/novaya-kategoriya/';
  assert.ok(page.includes('<link rel="canonical" href="'+categoryUrl+'">'));
  assert.match(page,/Полотенца &amp; наборы/);
  assert.match(page,/index,follow/);
  assert.match(page,/google-site-verification/);
  assert.match(page,/yandex-verification/);
  assert.match(page,/"@type":"CollectionPage"/);
  const sitemap=await read('sitemap.xml');
  assert.ok(sitemap.includes(categoryUrl));
  assert.doesNotMatch(sitemap,/owner|orders|chat|#/);
  assert.match(await read('robots.txt'),/\?mode=owner/);
  console.log('SEO: demo exclusion, live assortment gate, canonical URLs, metadata, verification and public sitemap.');
} finally {
  await rm(temp,{recursive:true,force:true});
}
