import {cp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {categories as samples} from '../public/assortment.js';
import {config} from '../public/config.js';
import {seo} from '../public/seo.js';

const site = new URL(seo.site);
if(site.protocol!=='https:'||!site.pathname.endsWith('/')||site.search||site.hash) throw Error('seo.site must be an HTTPS directory URL');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const abs=path=>new URL(path,site).href;
let categories=samples;
let indexing=false;

if(config.mode==='live'){
  if(!config.url||!config.key)throw Error('Live mode requires a public project URL and publishable key');
  const settings=await fetch(config.url.replace(/\/$/,'')+'/auth/v1/settings',{
    headers:{apikey:config.key},signal:AbortSignal.timeout(12000)
  });
  if(!settings.ok)throw Error('Cannot verify Auth settings: '+settings.status);
  const auth=await settings.json();
  if(auth.disable_signup!==true||auth.external?.anonymous_users!==false)throw Error('Disable all public sign-ups and anonymous sign-ins before enabling live mode');
  if(auth.external?.email!==true)throw Error('Keep password sign-in enabled for the owner');
  const snapshot=await fetch(config.url.replace(/\/$/,'')+'/rest/v1/rpc/storefront_snapshot',{
    method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(12000)
  });
  if(!snapshot.ok)throw Error('Cannot read the storefront snapshot: '+snapshot.status);
  const {content}=await snapshot.json();
  categories=content.categories;
  if(seo.indexing&&(!categories.length||(!content.products.some(p=>p.pricing==='custom'&&p.available)&&
     !content.fabrics.some(f=>f.available&&categories.some(c=>c.kind!=='towel'&&(!f.category_slug||f.category_slug===c.slug)))))){
    throw Error('Indexing requires an active public assortment');
  }
  indexing=seo.indexing;
}
for(const c of categories)if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.slug))throw Error('Invalid category URL');

await rm('dist',{recursive:true,force:true});
await cp('public','dist',{recursive:true});
const template=await readFile('public/index.html','utf8');
const catalogPath='catalog/';
const categoryPath=c=>catalogPath+c.slug+'/';
const pageRoutes=[
 {path:'',title:'Тихое утро — постельное бельё и домашний текстиль на заказ',heading:'Уют, сшитый специально для вас',description:'Семейная мастерская домашнего текстиля. Постельное бельё для взрослых и детей, полотенца и пошив по вашим размерам.',image:'./img/hero.webp'},
 {path:catalogPath,title:'Каталог домашнего текстиля — Тихое утро',heading:'Каталог',description:'Комплекты постельного белья, полотенца и ткани для индивидуального пошива в мастерской «Тихое утро».',image:'./img/hero.webp'},
 ...categories.map(c=>({path:categoryPath(c),title:c.name+' — Тихое утро',heading:c.name,
   description:c.description,image:c.image,category:c.slug}))
];
const escapedPaths=esc(JSON.stringify(categories.map(c=>c.slug)));
const verification=[
 ['google-site-verification',seo.googleVerification],['yandex-verification',seo.yandexVerification]
].filter(([,value])=>value).map(([name,value])=>'<meta name="'+name+'" content="'+esc(value)+'">').join('\n');
const photo=path=>abs(path.startsWith('./img/')?path:'./img/hero.webp');

for(const p of pageRoutes){
  const canonical=abs(p.path);
  const image=photo(p.image);
  const depth=p.path.split('/').filter(Boolean).length;
  const attributes=' data-category-paths="'+escapedPaths+'"'+(p.category?' data-category="'+esc(p.category)+'"':p.path===catalogPath?' data-catalog="1"':'');
  const schema={'@context':'https://schema.org','@type':p.path?'CollectionPage':'WebSite',name:p.heading,description:p.description,url:canonical,inLanguage:'ru',...(p.path?{image}:{publisher:{'@type':'Organization',name:'Тихое утро',url:abs(''),logo:abs('img/icon-192.png')}})};
  const meta=[
    depth?'<base href="'+('../'.repeat(depth))+'">':'',
    '<meta name="description" content="'+esc(p.description)+'">',
    '<meta name="robots" content="'+(indexing?'index,follow':'noindex,nofollow')+'">',
    '<link rel="canonical" href="'+esc(canonical)+'">',
    ...Object.entries({type:'website',locale:'ru_RU',site_name:'Тихое утро',title:p.title,description:p.description,url:canonical,image}).map(([name,value])=>'<meta property="og:'+name+'" content="'+esc(value)+'">'),
    verification,
    '<script type="application/ld+json">'+JSON.stringify(schema).replaceAll('<','\\u003c')+'</script>',
    '<title>'+esc(p.title)+'</title>'
  ].filter(Boolean).join('\n');
  const intro='<section class="wrap page"><h1>'+esc(p.heading)+'</h1><p>'+esc(p.description)+'</p>'+
    '<nav aria-label="Категории каталога"><ul>'+categories.map(c=>'<li><a href="./'+categoryPath(c)+'">'+esc(c.name)+'</a></li>').join('')+'</ul></nav></section>';
  const html=template.replace('<html lang="ru">','<html lang="ru"'+attributes+'>')
    .replace('<!-- PAGE_META -->',meta).replace('<!-- PAGE_INTRO -->',intro);
  await mkdir('dist/'+p.path,{recursive:true});
  await writeFile('dist/'+p.path+'index.html',html);
}
await writeFile('dist/sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+
  (indexing?pageRoutes.map(p=>'<url><loc>'+esc(abs(p.path))+'</loc></url>').join('\n'):'')+'\n</urlset>\n');
await writeFile('dist/robots.txt','User-agent: *\n'+(indexing?'Disallow: '+site.pathname+'?mode=owner\nSitemap: '+abs('sitemap.xml')+'\n':'Disallow: /\n'));

const worker=await readFile('public/sw.js','utf8');
await writeFile('dist/sw.js',worker.replace('/* category routes */',
  pageRoutes.filter(p=>p.path).map(p=>', '+JSON.stringify('./'+p.path)).join('')));
const revision = createHash('sha256');
for (const name of (await readdir('dist',{recursive:true,withFileTypes:true}))
   .filter(entry=>entry.isFile()).map(entry=>entry.parentPath+'/'+entry.name).sort()) {
  revision.update(name);
  revision.update(await readFile(name));
}
const hash = revision.digest('hex').slice(0,16);
await writeFile('dist/sw.js',(await readFile('dist/sw.js','utf8')).replace('development',hash));
