import {demo,load,write,auth,signIn,signOut,rpc,uploadPhoto,signPhotos} from './api.js';
import {categories,defaultCategory,childSizes,demoProducts,demoFabrics,publicCategoryPath,sortCategories,matchesCategory,sizePattern} from './assortment.js';
import {defaults,deliveryMethods,contactUrls,itemDescription,messageText} from './storefront.js';
import {products,defaultRules,calculate} from './calc.js';

const $=s=>document.querySelector(s);
const indexable=$('meta[name=robots]')?.content==='index,follow';
function updateRobots(){
 const meta=$('meta[name=robots]');
 if(meta)meta.content=indexable&&!location.hash&&!location.search?'index,follow':'noindex,nofollow';
}
const ownerEntry='./?mode=owner#/owner';
const ownerApp=new URLSearchParams(location.search).get('mode')==='owner';
if(ownerApp&&!location.hash)history.replaceState(null,'',ownerEntry);
$('#app-manifest').href=ownerApp?'./owner.webmanifest':'./manifest.webmanifest';

const textSizeKey='qu-text-size';
function applyTextSize(size){
  document.documentElement.dataset.textSize=size==='large'?'large':'normal';
}
applyTextSize(load(textSizeKey,'normal'));
const esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rub=n=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n);
const glyph={
 cart:'<path d="M3 5h2l2 11h12l2-8H6M9 20h.01M18 20h.01"/>', contact:'<path d="M21 11a8 8 0 0 1-8 8H4l2-4a8 8 0 1 1 15-4Z"/><path d="M9 11h7m-7 3h4"/>',
 home:'<path d="m3 11 9-8 9 8v9H3zM9 20v-6h6v6"/>', fabrics:'<path d="m3 8 9-5 9 5-9 5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
 orders:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 9h6m-6 4h6m-6 4h4"/>', chat:'<path d="M21 11a8 8 0 0 1-8 8H4l2-4a8 8 0 1 1 15-4Z"/><path d="M9 11h7m-7 3h4"/>',
 leaf:'<path d="M20 4c0 10-3 16-10 16-4 0-6-2-6-6 0-6 7-9 16-10ZM4 21 15 10"/>',
 ruler:'<path d="m3 16 13-13 5 5L8 21zM7 12l2 2m1-5 2 2m1-5 2 2"/>',
 stats:'<path d="M4 20V5m0 15h16M9 16v-4m5 4V7m5 9v-6"/>',
 heart:'<path d="M12 21 4 13a5 5 0 1 1 8-6 5 5 0 1 1 8 6z"/>'
};
const icon=n=>'<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+glyph[n]+'</svg>';
const sample=[
{id:'satin',name:'Сатин «Шалфей»',material:'Сатин',composition:'100% хлопок',description:'Гладкая ткань с мягким блеском и шелковистой поверхностью.',colors:['Шалфей'],available:true,width:250,rate:740,stock:25,direction:false,photo:'./img/satin.webp'},
{id:'poplin',name:'Поплин «Овсяное молоко»',material:'Поплин',composition:'100% хлопок',description:'Лёгкая матовая ткань с деликатной фактурой.',colors:['Овсяное молоко'],available:true,width:240,rate:520,stock:20,direction:false,photo:'./img/poplin.webp'},
{id:'calico',name:'Бязь «Пыльная роза»',material:'Бязь',composition:'100% хлопок',description:'Плотная ткань полотняного переплетения для повседневных комплектов.',colors:['Пыльная роза'],available:true,width:220,rate:420,stock:20,direction:false,photo:'./img/calico.webp'}
];
const types=Object.keys(products);
const blank=()=>({step:1,fabric:'',color:'',items:[],comment:''});
const draftKey=demo?'qu-demo-draft':'qu-live-draft';
const categoryDraftKey=slug=>slug===defaultCategory?draftKey:draftKey+'-'+slug;
let draft=load(draftKey,null)||blank();
const saveDraft=()=>write(categoryDraftKey(draft.category||defaultCategory),draft);
function selectDraft(slug){
  if((draft.category||defaultCategory)===slug)return;
  draft=load(categoryDraftKey(slug),null)||{...blank(),category:slug};
}
const initial={...defaults,categories,products:demoProducts,fabrics:[...sample,...demoFabrics],rules:defaultRules};
const editorKey='qu-demo-editor-v13';
const cartKey=demo?'qu-demo-cart-v13':'qu-live-cart-v13';
let cart=load(cartKey,[]);
const deliveryKey='qu-delivery-v13';
let delivery=load(deliveryKey,deliveryMethods[0]);
if(!deliveryMethods.includes(delivery))delivery=deliveryMethods[0];
let publicCategories=[],publicProducts=[],ownerCategories=[],ownerProducts=[],dataFabrics=[];
let fabrics=[],rules=defaultRules,editor=null,content=defaults,images={},route='',epoch=0,timer;
let currentQuote=null;
const placeUrl=new URL(location.href);
const pathCategory=document.documentElement.dataset.category||placeUrl.searchParams.get('category');
const cleanCategoryPaths=JSON.parse(document.documentElement.dataset.categoryPaths||'[]');
const pathCatalog=document.documentElement.dataset.catalog==='1';
const categoryBySlug=slug=>[...publicCategories,...ownerCategories,...categories].find(c=>c.slug===slug);
const categoryName=o=>categoryBySlug(o.category_slug||defaultCategory)?.name||'Постельное бельё';
const knownImage=/^\.\/img\/[a-z0-9-]+\.(?:svg|webp|png)$/;
const storageImage=/^[0-9a-f-]{36}\.jpg$/;
const photoSource=(value,fallback='./img/satin.webp')=>knownImage.test(value)||(demo&&value?.startsWith('data:image/jpeg;base64,'))?value:images[value]||fallback;
const imagery=row=>photoSource(row.image,categories[0].image);
const photo=f=>photoSource(f.photo);
const categoryPicker=(list,value='',allLabel='')=>'<label>Категория<select name="category_slug" '+(allLabel?'':'required')+'>'+(allLabel?'<option value="">'+allLabel+'</option>':'')+list.map(c=>'<option value="'+esc(c.slug)+'" '+(c.slug===value?'selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></label>';

function demoEditor(){
  return load(editorKey,{revision:0,published_revision:0,draft:initial,published:initial});
}
async function resolveImages(data,owner=false){
  if(demo)return {};
  const paths=[...new Set([data.home?.hero,data.home?.logo,
    ...data.categories.map(c=>c.image),...data.products.map(p=>p.image),...data.fabrics.map(f=>f.photo)]
    .filter(path=>storageImage.test(path)))];
  const signed={};
  for(let offset=0;offset<paths.length;offset+=40)Object.assign(signed,await signPhotos(paths.slice(offset,offset+40),owner));
  return signed;
}
function displayContent(data){
  content={...defaults,...data};
  publicCategories=sortCategories(data.categories.filter(c=>!c.archived));
  const visible=slug=>!slug||publicCategories.some(c=>c.slug===slug);
  fabrics=data.fabrics.filter(f=>!f.hidden&&visible(f.category_slug)).map(f=>({...f,available:f.available&&(f.stock==null||f.stock>0)}));
  publicProducts=data.products.filter(p=>!p.hidden&&visible(p.category_slug)).map(p=>{
    if(p.pricing==='fixed'||!p.fabric_id)return p;
    const f=fabrics.find(f=>f.id===p.fabric_id&&f.available&&matchesCategory(f,p.category_slug));
    const colors=p.colors.filter(color=>f?.colors.includes(color));
    return {...p,colors,available:p.available&&!!colors.length};
  });
  rules=data.rules||defaultRules;
}
async function loadPublic(){
  const data=demo?demoEditor().published:(await rpc('storefront_snapshot')).content;
  if(!data)throw new Error('Мастерская готовит витрину к публикации.');
  return {data,signed:await resolveImages(data)};
}
async function loadEditor(){
  const state=demo?demoEditor():await rpc('storefront_draft',{},true);
  return {state,signed:await resolveImages(state.draft,true)};
}
async function storeEditor(data,publish=false){
  const expected=editor.revision;
  if(demo){
    const current=demoEditor();
    if(current.revision!==expected)throw new Error('Черновик изменился в другой вкладке. Откройте редактор заново.');
    const revision=expected+1;
    const next=publish?{...current,revision,published_revision:revision,published:current.draft}:
      {...current,revision,draft:data};
    write(editorKey,next);editor=next;
  }else{
    const state=publish?await rpc('publish_storefront',{expected},true):
      await rpc('save_storefront_draft',{expected,content:data},true);
    editor=state;
  }
}
async function saveSection(key,value){
  await storeEditor({...editor.draft,[key]:value});
  notice('Изменения сохранены в черновике.');
}
const map={home:'Главная',fabrics:'Каталог',cart:'Корзина',contact:'Связаться'};
const links={home:'./',fabrics:'./catalog/',cart:'#/cart',contact:'#/contact'};
const contactLink=()=>links.contact;
const href=(h,t,cls='')=>'<a class="button '+cls+'" href="'+h+'">'+t+'</a>';
const field=(title,name,value='',attrs='',type='text')=>'<label>'+title+'<input type="'+type+'" name="'+name+'" value="'+esc(value)+'" '+attrs+'></label>';
const area=(title,name,value='',max=1000)=>'<label>'+title+'<textarea name="'+name+'" maxlength="'+max+'">'+esc(value)+'</textarea></label>';
const opt=(values,selected)=>values.map(v=>'<option'+(v===selected?' selected':'')+'>'+esc(v)+'</option>').join('');
const select=(title,name,values,value)=>'<label>'+title+'<select name="'+name+'">'+opt(values,value)+'</select></label>';
const check=(title,name,on=false,attrs='')=>'<label class="check"><input type="checkbox" name="'+name+'" '+(on?'checked ':'')+attrs+'>'+title+'</label>';
const nField=(title,name,value,min,max,step=1)=>field(title,name,value,'required min="'+min+'" max="'+max+'" step="'+step+'" inputmode="'+(step===1?'numeric':'decimal')+'"','number');
const panel=(title,body)=>'<section class="wrap narrow page"><h1>'+title+'</h1>'+body+'</section>';
const actions=content=>'<div class="actions">'+content+'</div>';
const error='<p class="error" role="alert" data-error hidden></p>';
function notice(text){$('#status').textContent=text;clearTimeout(timer);timer=setTimeout(()=>$('#status').textContent='',4500);}
function showError(form,cause){const el=form.querySelector('[data-error]');if(el){el.textContent=cause.message;el.hidden=false;}else notice(cause.message);}
function go(path){
  if(pathCategory||pathCatalog){location.href=new URL(path,document.baseURI);return;}
  if(location.hash===path)render();else location.hash=path;
}
function frame(){
  const section=route.split('/')[0];
  const active=['category','product','build'].includes(section)?'fabrics':section||'home';
  $('#header').innerHTML='<div class="bar"><a class="brand" href="./"><img src="'+esc(photoSource(content.home.logo,defaults.home.logo))+'" alt="">Тихое утро</a><nav class="nav" aria-label="Основная навигация">'+Object.entries(map).map(([k,v])=>'<a href="'+links[k]+'" '+(k===active?'aria-current="page"':'')+'>'+icon(k)+'<span>'+v+'</span></a>').join('')+'</nav>'+href(contactLink(),'Связаться','contact')+'</div>';
  $('#mode').innerHTML=demo?'<div class="mode"><strong>Демонстрационный режим</strong> · цены и ассортимент для примера</div>':'';
  const size=document.documentElement.dataset.textSize;
  $('#footer').innerHTML='<div class="wrap foot"><div class="foot-brand"><span>Сшито с любовью. Создано для уюта</span><small>Версия 1.3</small></div><div class="foot-links"><a href="#/install">Установить приложение</a><a href="#/privacy">Конфиденциальность</a><a href="'+ownerEntry+'" rel="nofollow">Кабинет владельца</a></div><details class="display-settings"><summary>Размер текста</summary><fieldset><legend>Размер интерфейса</legend>'+[['normal','Обычный'],['large','Увеличенный']].map(([value,label])=>'<label class="check"><input type="radio" name="text-size" value="'+value+'" '+(size===value?'checked':'')+'>'+label+'</label>').join('')+'</fieldset></details></div>';
}
function cards(list,full=false){
  if(!list.length)return '<p>По этим условиям ткани не найдены.</p>';
  return '<div class="grid">'+list.map(f=>'<article class="card media"><button type="button" class="image-btn" data-photo="'+esc(f.id)+'" aria-label="Увеличить фото '+esc(f.name)+'"><img src="'+esc(photo(f))+'" alt="'+esc(f.name)+'" loading="lazy"></button><div class="card-body stack"><h3>'+esc(f.name)+'</h3><p class="muted">'+esc(f.composition)+'</p>'+(full?'<p>'+esc(f.description)+'</p><p>Расцветки: '+esc(f.colors.join(', '))+'</p><p>Ширина рулона: '+f.width+' см</p>':'')+'<p><span class="tag">'+(f.available?'В наличии':'Нет в наличии')+'</span></p>'+(full&&f.available&&categoryBySlug(f.category_slug)?.kind!=='towel'?'<button class="primary" data-choose="'+esc(f.id)+'" data-category="'+esc(f.category_slug||defaultCategory)+'">Выбрать ткань</button>':'')+'</div></article>').join('')+'</div>';
}
function categoryCards(list){
  return '<div class="grid category-grid">'+list.map(c=>'<a class="card media category-card" href="'+publicCategoryPath(c.slug,cleanCategoryPaths)+'"><img src="'+esc(imagery(c))+'" alt="" loading="lazy" width="480" height="320"><div class="card-body"><h3>'+esc(c.name)+'</h3><p>'+esc(c.description)+'</p></div></a>').join('')+'</div>';
}
function home(){
  const h=content.home;
  const news=['promo','notice'].filter(key=>content[key]?.enabled).map(key=>'<aside class="panel storefront-news">'+(content[key].title?'<h2>'+esc(content[key].title)+'</h2>':'')+(content[key].text?'<p>'+esc(content[key].text)+'</p>':'')+'</aside>').join('');
  const featured=publicCategories.find(c=>c.slug===defaultCategory&&c.kind!=='towel')||publicCategories.find(c=>c.kind!=='towel');
  return '<div class="wrap"><section class="hero"><img class="hero-image" src="'+esc(photoSource(h.hero,defaults.home.hero))+'" alt="'+esc(h.heroAlt)+'" width="1200" height="800" fetchpriority="high"><div class="hero-copy"><p class="eyebrow">'+esc(h.eyebrow)+'</p><h1>'+esc(h.title)+'</h1><p class="hero-description">'+esc(h.description)+'</p>'+actions((featured?href('#/build'+(featured.slug===defaultCategory?'':'/'+featured.slug),featured.kind==='child'?'Собрать детский комплект':'Собрать свой комплект','primary'):'')+href('./catalog/','Посмотреть каталог',featured?'quiet':'primary'))+'</div></section>'+news+'<section class="section"><div class="section-top"><h2>Каталог мастерской</h2></div>'+categoryCards(publicCategories)+'</section><ul class="features"><li>'+icon('leaf')+'Натуральные ткани</li><li>'+icon('ruler')+'Пошив по вашим размерам</li><li>'+icon('heart')+'Ручная работа</li></ul></div>';
}
function catalog(){
  return '<section class="wrap page stack"><h1>Каталог</h1>'+categoryCards(publicCategories)+'<h2 id="fabrics">Ткани</h2><form id="filters" class="row three">'+field('Поиск по названию или цвету','q','','','search')+select('Материал','material',['Все материалы',...new Set(fabrics.map(f=>f.material))])+check('Только в наличии','stock')+'</form><div id="catalog-results">'+cards(fabrics,true)+'</div></section>';
}
function productCards(list){
  if(!list.length)return '<p>Готовых товаров и отдельных предложений пока нет.</p>';
  return '<div class="grid">'+list.map(p=>'<article class="card media"><img class="admin-image" src="'+esc(imagery(p))+'" alt="" loading="lazy"><div class="card-body stack"><h3>'+esc(p.name)+'</h3><p>'+esc(p.material)+'</p><p>'+esc(p.description)+'</p><p>'+(p.pricing==='fixed'?rub(p.price):'Стоимость рассчитывается по размеру')+'</p>'+(demo?'<p><span class="tag">Демонстрационная позиция</span></p>':'')+(p.pricing==='fixed'?'<p class="tag">Продажа готовых изделий приостановлена</p>':p.available?href('#/product/'+encodeURIComponent(p.id),'Выбрать «'+esc(p.name)+'»','primary'):'<p>Временно недоступно</p>')+'</div></article>').join('')+'</div>';
}
function categoryPage(slug){
  const c=publicCategories.find(c=>c.slug===slug);
  if(!c)return panel('Категория недоступна',href('./catalog/','Вернуться в каталог'));
  const list=fabrics.filter(f=>matchesCategory(f,slug)&&(c.kind!=='towel'||f.category_slug===slug));
  return '<section class="wrap page stack"><div class="category-intro"><img src="'+esc(imagery(c))+'" alt="" width="480" height="320"><div>'+href('./catalog/','Все категории','quiet')+'<h1>'+esc(c.name)+'</h1><p>'+esc(c.description)+'</p>'+(c.kind==='towel'?'':href('#/build/'+encodeURIComponent(c.slug),c.kind==='child'?'Собрать детский комплект':'Собрать свой комплект','primary'))+'</div></div><h2>Товары</h2>'+productCards(publicProducts.filter(p=>p.category_slug===slug))+'<h2>Ткани</h2>'+cards(list,true)+'</section>';
}
function applyFilters(form){const {q,material,stock}=Object.fromEntries(new FormData(form));$('#catalog-results').innerHTML=cards(fabrics.filter(f=>(material==='Все материалы'||f.material===material)&&(!stock||f.available)&&[f.name,f.material,...f.colors].join(' ').toLowerCase().includes(q.trim().toLowerCase())),true);}
function sizesFor(type,slug){
  const category=categoryBySlug(slug);
  return category?.presets?.[type]||(category?.kind==='child'?childSizes[type]:products[type].sizes);
}
const firstItem=(type,slug=draft.category||defaultCategory)=>({type,w:sizesFor(type,slug)[0][0],l:sizesFor(type,slug)[0][1],h:categoryBySlug(slug)?.kind==='child'?12:20,qty:type==='pillow'?2:1,closure:type==='pillow'?'Клапан':type==='duvet'?'Молния':'Без застёжки'});
function summary(items){
  return '<ul>'+items.map(i=>'<li>'+esc(itemDescription(i))+'</li>').join('')+'</ul>';
}
function dimensions(i,slug=draft.category||defaultCategory){
  return '<fieldset class="stack" data-item="'+i.type+'"><legend>'+products[i.type].name+'</legend>'+select('Стандартный размер','preset',['Свои размеры',...sizesFor(i.type,slug).map(([w,l])=>w+' × '+l)],i.w+' × '+i.l)+'<div class="row">'+nField('Ширина, см','w',i.w,20,400)+nField('Длина, см','l',i.l,20,400)+(i.type==='fitted'?nField('Высота матраса, см','h',i.h,5,60):'')+nField('Количество, шт.','qty',i.qty,1,12)+(['duvet','pillow'].includes(i.type)?select('Застёжка','closure',i.type==='pillow'?['Клапан','Молния']:['Молния','Без застёжки'],i.closure):'')+'</div></fieldset>';
}
function measure(){return '<details><summary>Как снять мерки</summary><div class="measure"><svg role="img" aria-label="Прямоугольник, ширина по горизонтали и длина по вертикали" viewBox="0 0 140 94"><path d="M17 22h91v56H17zM17 12h91m-91-4v8m91-8v8m11 6v56m-4-56h8m-8 56h8" fill="none" stroke="currentColor" stroke-width="2"/></svg><p>Измерьте ширину и длину матраса, одеяла или подушки по краям. Для простыни на резинке измерьте также высоту матраса сбоку.</p></div>'+href(contactLink(),'Попросить помощи')+'</details>';}
function builder(){
  const slug=draft.category||defaultCategory;
  const category=publicCategories.find(c=>c.slug===slug);
  if(!category||category.kind==='towel')return panel('Категория недоступна',href('./catalog/','Вернуться в каталог'));
  const availableFabrics=fabrics.filter(f=>matchesCategory(f,slug));
  const f=availableFabrics.find(f=>f.id===draft.fabric);
  const steps=['Ткань и расцветка','Комплектация','Размеры изделий','Пожелания','Проверка комплектации'];
  let body='';
  if(draft.step===1){
    body='<label>Ткань<select required name="fabric"><option value="">Выберите ткань</option>'+availableFabrics.filter(f=>f.available).map(f=>'<option value="'+esc(f.id)+'" '+(f.id===draft.fabric?'selected':'')+'>'+esc(f.name)+'</option>').join('')+'</select></label>'+select('Расцветка','color',f?.colors??['Сначала выберите ткань'],draft.color)+href('./catalog/','Посмотреть фотографии тканей');
  }
  if(draft.step===2)body='<fieldset><legend>Что сшить</legend><button type="button" data-full>Выбрать полный комплект</button>'+types.map(t=>check(products[t].name,t,draft.items.some(i=>i.type===t))).join('')+'</fieldset>';
  if(draft.step===3)body=measure()+draft.items.map(i=>dimensions(i,slug)).join('');
  if(draft.step===4)body=area('Пожелания к пошиву', 'comment',draft.comment)+'<p class="muted">Например, укажите расположение застёжки или пожелания по рисунку.</p>';
  if(draft.step===5){
    body='<div class="panel"><strong>'+esc(f?.name)+' · '+esc(draft.color)+'</strong>'+summary(draft.items)+(draft.comment?'<p>'+esc(draft.comment)+'</p>':'')+'<div id="estimate" aria-live="polite">'+(demo?estimateText(()=>calculate(draft.items,f,rules).price):'Рассчитываем предварительную стоимость…')+'</div></div>';
  }
  return panel(category.kind==='child'?'Собрать детский комплект':'Собрать свой комплект','<div class="stack"><p class="muted">Шаг '+draft.step+' из 5</p><progress value="'+draft.step+'" max="5" aria-label="Шаг '+draft.step+' из 5"></progress><h2>'+steps[draft.step-1]+'</h2><form class="stack" id="builder">'+body+error+actions((draft.step>1?'<button type="button" data-back>Назад</button>':'')+'<button class="primary">'+(draft.step<5?'Продолжить':'Добавить в корзину')+'</button>')+'</form></div>');
}
function estimateText(fn){try{return '<div class="price">'+rub(fn())+'</div><p>Предварительная стоимость. Окончательную цену согласует мастер.</p>';}catch(e){return '<p class="error">'+esc(e.message)+'</p><p>Мастер может уточнить стоимость вручную.</p>';}}
function syncBuilder(form){
  const data=Object.fromEntries(new FormData(form));
  if(draft.step===1){if(data.fabric!==draft.fabric){draft.fabric=data.fabric;draft.color=fabrics.find(f=>f.id===draft.fabric)?.colors[0]||'';}else draft.color=data.color;}
  if(draft.step===2)draft.items=types.filter(t=>data[t]).map(t=>draft.items.find(i=>i.type===t)||firstItem(t));
  if(draft.step===3)draft.items=[...form.querySelectorAll('[data-item]')].map(one=>{
    const type=one.dataset.item;
    return {...firstItem(type),...Object.fromEntries([...one.querySelectorAll('[name]:not([name=preset])')].map(el=>[el.name,el.type==='number'?Number(el.value):el.value]))};
  });
  if(draft.step===4)draft.comment=data.comment;
  saveDraft();
}
function infoPage(kind){
 if(kind==='install')return panel('Установить приложение','<div class="panel stack"><h2>На Android</h2><p>Откройте сайт в Chrome. Нажмите меню ⋮ и выберите «Установить приложение» или «Добавить на главный экран».</p><h2>На iPhone</h2><p>В Safari выберите «Поделиться», затем «На экран Домой».</p><p>Для отдельного значка установите <a rel="nofollow" href="'+ownerEntry+'">кабинет владельца</a> из Chrome.</p></div>');
 return panel('Конфиденциальность','<div class="panel stack"><p>Витрина хранит корзину, пожелания к изделиям и настройки текста в этом браузере. Витрина не просит имя, телефон или адрес покупателя.</p><p>Вы сами решаете, отправлять ли подборку в Telegram или ВКонтакте. При переходе действуют правила выбранного сервиса.</p></div>');
}
function saveCart(next){
 write(cartKey,next);cart=next;
}
function addToCart(row){
 if(cart.length>=20)throw new Error('В корзине уже 20 позиций. Уберите ненужные позиции и попробуйте ещё раз.');
 saveCart([...cart,{...row,id:crypto.randomUUID()}]);
 notice('Изделие добавлено в корзину.');
 go('#/cart');
}
function cartMessage(){
 return messageText(cart,delivery,rub);
}
function contactsActions(withCart=false){
 const urls=contactUrls(content.contact);
 const message=withCart?cartMessage():'';
 return actions(
   (urls.telegram?(message.length>3500?'<button type="button" data-telegram>Скопировать и открыть Telegram</button>':'<a class="button" href="'+esc(urls.telegram+(message?'?text='+encodeURIComponent(message):''))+'" rel="noopener noreferrer" target="_blank">Telegram</a>'):'')+
   (urls.vk?(withCart?'<button type="button" data-vk>Скопировать и открыть ВКонтакте</button>':'<a class="button" href="'+esc(urls.vk)+'" rel="noopener noreferrer" target="_blank">ВКонтакте</a>'):'')+
   (urls.phone?'<a class="button quiet" href="'+esc(urls.phone)+'">Позвонить</a>':'')
 )+(!Object.values(urls).some(Boolean)?'<p class="muted">'+(demo?'В демоверсии контакты не указаны. Текст подборки можно скопировать.':'Мастерская пока не опубликовала контакты.')+'</p>':'');
}
function cartPage(){
 if(!cart.length)return panel('Корзина','<div class="panel stack"><p>Соберите изделие в каталоге, чтобы подготовить сообщение мастеру.</p>'+href('./catalog/','Открыть каталог','primary')+'</div>');
 const allKnown=cart.every(row=>row.price!=null);
 return panel('Корзина','<div class="stack">'+cart.map(row=>'<article class="panel stack"><h2>'+esc(row.name)+'</h2><p>'+esc([row.material,row.color].filter(Boolean).join(' · '))+'</p><ul>'+row.details.map(line=>'<li>'+esc(line)+'</li>').join('')+'</ul>'+
  (row.comment?'<p>'+esc(row.comment)+'</p>':'')+'<div class="actions"><strong>'+esc(row.price!=null?rub(row.price):'Стоимость уточнит мастер')+'</strong><button class="quiet" data-remove="'+esc(row.id)+'" aria-label="Убрать из корзины: '+esc(row.name)+'">Убрать</button></div></article>').join('')+
  '<div class="panel stack">'+(allKnown?'<p>Предварительная стоимость <strong>'+rub(cart.reduce((sum,row)=>sum+row.price,0))+'</strong></p>':'<p>Окончательную стоимость уточнит мастер.</p>')+
  select('Способ получения','delivery',deliveryMethods,delivery)+(content.contact.delivery?'<p>'+esc(content.contact.delivery)+'</p>':'')+
  '<label>Текст для отправки<textarea id="cart-message" readonly rows="7">'+esc(cartMessage())+'</textarea></label>'+
  '<button type="button" class="primary" data-copy>Скопировать текст</button>'+'<div id="cart-contacts">'+contactsActions(true)+'</div></div></div>');
}
function contactPage(){
 return panel('Связаться','<div class="panel stack">'+(content.contact.description?'<p>'+esc(content.contact.description)+'</p>':'')+contactsActions()+
  '<h2>Как получить изделия</h2><ul>'+deliveryMethods.map(method=>'<li>'+method+'</li>').join('')+'</ul>'+
  (content.contact.delivery?'<p>'+esc(content.contact.delivery)+'</p>':'<p>Сроки и стоимость доставки согласуйте с мастерской.</p>')+'</div>');
}
async function copyMessage(){
 const node=$('#cart-message');
 try{await navigator.clipboard.writeText(node.value);notice('Текст скопирован.');return true;}
 catch{
   node.focus();node.select();notice('Выделили текст. Скопируйте его через меню устройства.');return false;
 }
}
function quoteSelection(){
 return {category_slug:draft.category||defaultCategory,fabric_id:draft.fabric,color:draft.color,items:draft.items};
}
async function quoteBedding(selection){
 if(!demo)return rpc('storefront_quote',{p:selection});
 const fabric=fabrics.find(f=>f.id===selection.fabric_id);
 return calculate(selection.items,fabric,rules).price;
}
async function addBedding(form){
 syncBuilder(form);
 const selection=quoteSelection();
 const f=fabrics.find(f=>f.id===draft.fabric&&f.available&&matchesCategory(f,selection.category_slug));
 if(!f||!f.colors.includes(draft.color)||!draft.items.length)throw new Error('Проверьте ткань, расцветку и комплектацию.');
 const price=currentQuote?.signature===JSON.stringify(selection)?currentQuote.price:await quoteBedding(selection).catch(()=>null);
 addToCart({name:categoryName(selection),material:f.name,color:draft.color,details:draft.items.map(itemDescription),comment:draft.comment,price});
 draft={...blank(),category:selection.category_slug};saveDraft();
}
const ownerSections=[
 ['fabrics','Ассортимент','Товары, категории и ткани','fabrics'],
 ['home','Главная страница','Заголовки, тексты и фотографии','home'],
 ['news','Акции и объявления','Новости для покупателей','chat'],
 ['contact','Контакты и доставка','Телефон, соцсети и условия','chat']
];
function ownerNav(){
 return '<nav class="owner-nav" aria-label="Разделы кабинета">'+href('#/owner','Редактор','quiet')+
  ownerSections.map(([id,name])=>href('#/owner/'+id,name,'quiet')).join('')+'<button class="quiet" data-logout>Выйти</button></nav>';
}
function ownerPage(title,body){
 const intro=route==='owner'?'<div class="owner-intro"><h1>'+title+'</h1><button class="quiet" data-logout>Выйти</button></div>':ownerNav()+'<h1>'+title+'</h1>';
 return '<section class="wrap page stack owner-page">'+intro+body+'</section>';
}
function login(){
 if(demo)return panel('Кабинет владельца','<div class="panel stack"><p>Изменения и публикация в демоверсии видны только в этом браузере.</p><button class="primary" data-demo-owner>Открыть демонстрационный редактор</button></div>');
 return panel('Кабинет владельца','<form id="login" class="panel stack">'+field('Электронная почта','email','','required autocomplete="username"','email')+
  field('Пароль','password','','required autocomplete="current-password"','password')+error+'<button class="primary">Войти</button></form>');
}
function dashboard(){
 const pending=editor.revision!==editor.published_revision;
 return ownerPage('Редактор витрины','<div class="panel stack"><p role="status">'+(pending?'Есть сохранённые изменения в черновике.':'Все сохранённые изменения опубликованы.')+'</p>'+
  '<form id="publish" class="stack">'+error+actions(href('#/owner/preview','Предварительный просмотр')+
  '<button class="primary" '+(pending?'':'disabled')+'>Сохранить и опубликовать</button>')+'</form></div>'+
  '<div class="owner-sections">'+ownerSections.map(([path,name,description,glyph])=>'<a class="card owner-tile" href="#/owner/'+path+'" aria-label="Открыть раздел «'+name+'»">'+icon(glyph)+'<div><h2>'+name+'</h2><p>'+description+'</p></div></a>').join('')+'</div>');
}
function previewPage(slug){
 const dest=slug==='~contacts'?contactPage():slug==='~catalog'?catalog():slug?categoryPage(slug):home();
 const navigation=actions(href('#/owner/preview','Главная','quiet')+href('#/owner/preview/~catalog','Каталог','quiet')+href('#/owner/preview/~contacts','Связаться','quiet')+
  publicCategories.map(c=>href('#/owner/preview/'+c.slug,esc(c.name),'quiet')).join(''));
 return ownerPage('Предварительный просмотр','<p>Виден сохранённый черновик.</p>'+navigation+
  '<div inert class="draft-preview"><img class="preview-logo" src="'+esc(photoSource(content.home.logo,defaults.home.logo))+'" alt="Логотип витрины">'+dest+'</div>');
}
function homeEditor(){
 const h=editor.draft.home;
 return ownerPage('Главная страница','<form id="home-edit" class="panel stack">'+field('Подпись над заголовком','eyebrow',h.eyebrow,'maxlength="80"')+
  field('Главный заголовок','title',h.title,'required maxlength="120"')+area('Текст на главной','description',h.description,350)+
  field('Описание фотографии для экранных дикторов','heroAlt',h.heroAlt,'required maxlength="180"')+
  uploadField('Основная фотография','hero')+'<img width="160" src="'+esc(photoSource(h.hero,defaults.home.hero))+'" alt="Текущая фотография">'+
  uploadField('Логотип','logo')+'<img width="48" src="'+esc(photoSource(h.logo,defaults.home.logo))+'" alt="Текущий логотип">'+
  error+'<button class="primary">Сохранить черновик</button></form>');
}
function newsEditor(){
 const sections=[['promo','Акция'],['notice','Объявление']];
 return ownerPage('Акции и объявления','<form id="news-edit" class="panel stack">'+sections.map(([key,label])=>{
   const value=editor.draft[key];
   return '<fieldset class="stack"><legend>'+label+'</legend>'+field('Заголовок','title_'+key,value.title,'maxlength="120"')+
    area('Текст','text_'+key,value.text,500)+check('Показывать на главной','enabled_'+key,value.enabled)+'</fieldset>';
 }).join('')+error+'<button class="primary">Сохранить черновик</button></form>');
}
function contactEditor(){
 const c=editor.draft.contact;
 return ownerPage('Контакты и доставка','<form id="contact-edit" class="panel stack">'+
   field('Имя пользователя Telegram','telegram',c.telegram,'maxlength="33" placeholder="@имя"')+
   field('Имя или ID страницы ВКонтакте','vk',c.vk,'maxlength="64"')+
   field('Телефон мастерской','phone',c.phone,'maxlength="30" autocomplete="tel"','tel')+
   area('Текст страницы контактов','description',c.description,500)+area('Условия получения и доставки','delivery',c.delivery,700)+
   '<p class="muted">Доступные способы: самовывоз, местная доставка, СДЭК и Почта России.</p>'+error+
   '<button class="primary">Сохранить черновик</button></form>');
}
const uploadField=(label,name)=>'<label>'+label+'<input type="file" name="'+name+'" accept="image/jpeg,image/png,image/webp"></label>';
async function saveSiteForm(form){
 const v=Object.fromEntries(new FormData(form));
 if(form.id==='home-edit'){
   if(!v.title.trim()||!v.heroAlt.trim())throw new Error('Укажите заголовок и описание фотографии.');
   const current=editor.draft.home;
   const hero=await inventoryPhoto(v.hero,current.hero,defaults.home.hero);
   const logo=await inventoryPhoto(v.logo,current.logo,defaults.home.logo);
   await saveSection('home',{title:v.title.trim(),heroAlt:v.heroAlt.trim(),description:v.description,eyebrow:v.eyebrow,hero,logo});
 }else if(form.id==='news-edit'){
   const draft={...editor.draft};
   for(const key of ['promo','notice']){
     const title=v['title_'+key].trim(),text=v['text_'+key].trim(),enabled=!!v['enabled_'+key];
     if(enabled&&!title&&!text)throw new Error('Добавьте заголовок или текст для включённой записи.');
     draft[key]={title,text,enabled};
   }
   await storeEditor(draft);notice('Изменения сохранены в черновике.');
 }else if(form.id==='contact-edit'){
   const fields={telegram:v.telegram.trim(),vk:v.vk.trim(),phone:v.phone.trim(),description:v.description.trim(),delivery:v.delivery.trim()};
   const urls=contactUrls(fields);
   if(['telegram','vk','phone'].some(key=>fields[key]&&!urls[key]))throw new Error('Проверьте имя пользователя или номер телефона.');
   await saveSection('contact',fields);
 }
 go('#/owner');
}
function productPage(id){
 const product=publicProducts.find(p=>p.id===id&&p.available&&p.pricing==='custom');
 if(!product)return panel('Товар недоступен',href('./catalog/','Вернуться в каталог'));
 const previous=load(demo?'qu-demo-product-options-v13':'qu-live-product-options-v13',null);
 const values=previous?.id===id?{...previous}:{};
 if(product.custom_size&&values.size&&sizePattern.test(values.size)&&!values.size.includes(';')&&!product.sizes.includes(values.size)){
   [values.w,values.l]=values.size.split(' × ').map(Number);
   values.size='Свой размер';
 }
 return panel(esc(product.name),'<div class="stack"><p>'+esc(product.description)+' · '+esc(product.material)+'</p>'+
  (demo?'<p class="tag">Демонстрационная позиция</p>':'')+
  '<form id="product-order" data-id="'+esc(id)+'" class="panel stack"><div class="row">'+
  select('Размер, см','size',[...product.sizes,...(product.custom_size?['Свой размер']:[])],values.size)+
  select('Расцветка','color',product.colors,values.color)+nField('Количество','qty',values.qty||1,1,12)+'</div>'+
  (product.custom_size?'<fieldset class="row" id="custom-product-size" hidden disabled><legend>Индивидуальные размеры</legend>'+
  nField('Ширина, см','w',values.w||50,20,400)+nField('Длина, см','l',values.l||90,20,400)+'</fieldset>':'')+
  area('Пожелания к заказу','comment',values.comment)+
  '<div id="product-quote" class="stack" aria-live="polite"></div>'+error+
  '<button class="primary">Проверить стоимость</button></form></div>');
}
function syncProductSize(form){
 const box=form.querySelector('#custom-product-size');
 if(!box)return;
 box.hidden=form.elements.size.value!=='Свой размер';
 box.disabled=box.hidden;
}
function demoProductQuote(product,selection){
 const fabric=fabrics.find(f=>f.id===product.fabric_id&&f.available&&f.colors.includes(selection.color));
 if(!fabric)throw new Error('Материал или расцветка недоступны.');
 const price=selection.size.split('; ').reduce((sum,part)=>{
   const [w,l]=part.split(' × ').map(Number);
   return sum+calculate([{type:'sheet',w,l,qty:selection.qty}],fabric,{...rules,labor:{...rules.labor,sheet:product.price}}).price;
 },0);
 return {price,pricing:'custom'};
}
async function submitProduct(form){
 const v=Object.fromEntries(new FormData(form));
 const product=publicProducts.find(p=>p.id===form.dataset.id&&p.available&&p.pricing==='custom');
 if(!product)throw new Error('Товар недоступен для индивидуального пошива.');
 const size=v.size==='Свой размер'?Number(v.w)+' × '+Number(v.l):v.size;
 const selection={product_id:product.id,size,color:v.color,qty:Number(v.qty)};
 const signature=JSON.stringify(selection);
 if(currentQuote?.signature===signature){
   addToCart({name:product.name,material:product.material,color:v.color,
    details:[size+' см · '+selection.qty+' шт.'],comment:v.comment,price:currentQuote.price});
   return;
 }
 const {price}=demo?demoProductQuote(product,selection):{price:await rpc('storefront_quote',{p:selection})};
 currentQuote={signature,price};
 form.querySelector('#product-quote').innerHTML=estimateText(()=>price);
 form.querySelector('button.primary').textContent='Добавить в корзину';
}
function inventoryAdmin(list){
 const categoryList=ownerCategories.map(c=>'<article class="panel order-row"><div><h3>'+esc(c.name)+'</h3><p class="order-meta">Порядок '+c.position+(c.archived?' · В архиве':'')+'</p></div>'+href('#/owner/category/'+c.slug,'Редактировать категорию','quiet')+'</article>').join('');
 const productList=ownerProducts.map(p=>'<article class="panel order-row"><div><h3>'+esc(p.name)+'</h3><p class="order-meta">'+esc(categoryName(p))+' · '+(p.pricing==='fixed'?rub(p.price):'По расчёту')+(p.hidden?' · Скрыт':p.available?' · В наличии':' · Недоступен')+'</p></div>'+href('#/owner/product/'+p.id,'Редактировать товар','quiet')+'</article>').join('');
 const tools=actions(href('#/owner/fabric/new','Добавить ткань')+href('#/owner/rules','Настройки расчёта','quiet'));
 const fabricsList='<div class="grid">'+(list.map(f=>'<article class="card media"><img class="admin-image" src="'+esc(photo(f))+'" alt="'+esc(f.name)+'" loading="lazy"><div class="card-body"><h3>'+esc(f.name)+'</h3><p>'+f.stock+' м · '+rub(f.rate)+' за м</p><p>'+(f.hidden?'Скрыта из каталога':f.available?'В наличии':'Нет в наличии')+'</p>'+href('#/owner/fabric/'+f.id,'Редактировать')+'</div></article>').join('')||'<p>Добавьте первую ткань.</p>')+'</div>';
 return ownerPage('Ассортимент',('<section class="stack"><h2>Категории</h2>'+href('#/owner/category/new','Добавить категорию')+categoryList+'</section><section class="stack"><h2>Товары</h2>'+href('#/owner/product/new','Добавить товар')+(productList||'<p>Добавьте первый товар после согласования ассортимента.</p>')+'</section>')+'<section class="stack"><h2>Ткани</h2>'+tools+fabricsList+'</section>');
}
const kinds={adult:'Взрослое постельное бельё',child:'Детское постельное бельё',towel:'Полотенца'};
const fileField='<label>Фото с камеры или из галереи<input type="file" name="upload" accept="image/jpeg,image/png,image/webp"></label>';
function categoryForm(c){
 const options=Object.entries(kinds).map(([k,name])=>'<option value="'+k+'" '+(k===c.kind?'selected':'')+'>'+name+'</option>').join('');
 return ownerPage(c.slug?'Редактировать категорию':'Добавить категорию','<form id="category-edit" data-id="'+esc(c.slug)+'" class="panel stack">'+
 field('Название','name',c.name,'required maxlength="90"')+(c.slug?'<p>Адрес категории · '+esc(c.slug)+'</p>':field('Часть адреса латиницей','slug','','required maxlength="64" pattern="[a-z0-9]+(-[a-z0-9]+)*"'))+
 '<label>Тип конструктора<select name="kind">'+options+'</select></label>'+area('Описание','description',c.description,350)+nField('Порядок показа','position',c.position??100,0,9999)+
 '<details class="stack"><summary>Стандартные размеры для пошива белья</summary><p class="muted">По одному размеру на строку, например 60 × 120. Пустое поле сохраняет стандартные варианты конструктора.</p>'+types.map(type=>area(products[type].name,'preset_'+type,c.presets?.[type]?.map(pair=>pair.join(' × ')).join('\n'),300)).join('')+'</details>'+
 (c.image?'<img src="'+esc(imagery(c))+'" alt="Текущая фотография" width="160">':'')+fileField+check('Архивировать категорию','archived',c.archived)+error+'<button class="primary">Сохранить категорию в черновик</button></form>');
}
function productForm(p){
 const materialOptions='<label>Ткань для расчёта<select name="fabric_id"><option value="">Выберите ткань</option>'+dataFabrics.map(f=>'<option value="'+esc(f.id)+'" '+(f.id===p.fabric_id?'selected':'')+'>'+esc(f.name)+'</option>').join('')+'</select></label>';
 return ownerPage(p.id?'Редактировать товар':'Добавить товар','<form id="product-edit" data-id="'+esc(p.id)+'" class="panel stack">'+
 field('Название','name',p.name,'required maxlength="100"')+categoryPicker(ownerCategories,p.category_slug)+field('Материал','material',p.material,'required maxlength="100"')+
 area('Описание','description',p.description,500)+area('Размеры, по одному варианту на строку','sizes',p.sizes?.join('\n'),900)+
 '<p class="muted">Один размер: 50 × 90. Для набора перечислите размеры в одной строке через точку с запятой.</p>'+
 field('Расцветки через запятую','colors',p.colors?.join(', '),'required maxlength="600"')+
 select('Способ расчёта','pricing',['Фиксированная цена','Расчёт по ткани и пошиву'],p.pricing==='custom'?'Расчёт по ткани и пошиву':'Фиксированная цена')+
 nField('Цена за товар или пошив одной детали, ₽','price',p.price??0,0,100000)+
 '<div id="custom-pricing" class="stack">'+materialOptions+check('Разрешить индивидуальный размер','custom_size',p.custom_size)+'</div>'+
 (p.image?'<img src="'+esc(imagery(p))+'" alt="Текущая фотография" width="160">':'')+fileField+
 check('В наличии','available',p.available??true)+check('Скрыть из каталога','hidden',p.hidden)+error+'<button class="primary">Сохранить товар в черновик</button></form>');
}
async function inventoryPhoto(file,previous,fallback){
 if(!file?.size)return previous||fallback;
 const blob=await imageFile(file);
 if(!demo)return uploadPhoto(crypto.randomUUID()+'.jpg',blob);
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
}
async function saveCategory(form){
 const v=Object.fromEntries(new FormData(form));
 const old=ownerCategories.find(c=>c.slug===form.dataset.id);
 const slug=old?.slug||v.slug;
 if(!v.name.trim()||!v.description.trim())throw new Error('Введите название и описание категории.');
 if(!old&&ownerCategories.some(c=>c.slug===slug))throw new Error('Этот адрес уже используется.');
 const presets={};
 for(const type of types){
   const values=parseSizes(v['preset_'+type]);
   if(values.some(size=>!sizePattern.test(size)||size.includes(';')||size.match(/\d+/g).some(n=>n<20||n>400))||values.length>12)throw new Error('Для каждого изделия укажите до 12 размеров от 20 до 400 см.');
   if(values.length)presets[type]=values.map(size=>size.split(' × ').map(Number));
 }
 const c={slug,presets,name:v.name.trim(),kind:v.kind,description:v.description.trim(),position:Number(v.position),archived:!!v.archived,
   image:await inventoryPhoto(v.upload,old?.image,categories.find(c=>c.kind===v.kind).image)};
 await saveSection('categories',[c,...ownerCategories.filter(x=>x.slug!==slug)]);
 go('#/owner/fabrics');
}
function parseSizes(text){
 return [...new Set(text.trim().split(/\n+/).map(s=>s.trim().replace(/\s*[xх×]\s*/gi,' × ').replace(/\s*;\s*/g,'; ')).filter(Boolean))];
}
async function saveProduct(form){
 const v=Object.fromEntries(new FormData(form));
 const old=ownerProducts.find(p=>p.id===form.dataset.id);
 const c=ownerCategories.find(c=>c.slug===v.category_slug);
 const pricing=v.pricing==='Расчёт по ткани и пошиву'?'custom':'fixed';
 const price=Number(v.price);
 const f=dataFabrics.find(f=>f.id===v.fabric_id);
 const sizes=parseSizes(v.sizes), colors=[...new Set(v.colors.split(',').map(s=>s.trim()).filter(Boolean))];
 if(!c||!v.name.trim()||!v.material.trim()||!colors.length||colors.some(c=>c.length>80)||!sizes.length||sizes.length>30||colors.length>30||sizes.some(s=>!sizePattern.test(s)||s.match(/\d+/g).some(n=>n<20||n>400)))throw new Error('Проверьте категорию, расцветки и размеры от 20 до 400 см.');
 if(!demo&&!old?.image&&!v.upload?.size)throw new Error('Добавьте фотографию товара.');
 if(pricing==='fixed'&&price<=0)throw new Error('Укажите фиксированную цену.');
 if(pricing==='custom'&&(!f||!matchesCategory(f,c.slug)||colors.some(color=>!f.colors.includes(color))))throw new Error('Выберите ткань этой категории и укажите доступные для неё расцветки.');
 const p={id:old?.id||crypto.randomUUID(),category_slug:c.slug,name:v.name.trim(),description:v.description,material:v.material.trim(),colors,sizes,pricing,price,
  image:await inventoryPhoto(v.upload,old?.image,categories.find(item=>item.kind===c.kind).image),
  fabric_id:pricing==='custom'?f.id:null,custom_size:pricing==='custom'&&!!v.custom_size,available:!!v.available,hidden:!!v.hidden};
 await saveSection('products',[p,...ownerProducts.filter(x=>x.id!==p.id)]);
 go('#/owner/fabrics');
}
function fabricForm(f){
 return ownerPage(f.id?'Редактировать ткань':'Добавить ткань','<form class="panel stack" id="fabric-edit" data-id="'+(f.id||'')+'">'+field('Название','name',f.name,'required maxlength="100"')+field('Материал','material',f.material,'required maxlength="80"')+field('Состав','composition',f.composition,'required maxlength="100"')+area('Описание и свойства','description',f.description)+(categoryPicker(ownerCategories,f.category_slug,'Для всех категорий'))+field('Расцветки через запятую','colors',f.colors?.join(', '),'required maxlength="500"')+'<div class="row three">'+nField('Ширина рулона, см','width',f.width||220,50,400)+nField('Цена за метр, ₽','rate',f.rate||0,0,100000)+nField('Остаток, м','stock',f.stock||0,0,100000,0.1)+'</div>'+check('У рисунка есть направление','direction',f.direction)+check('В наличии','available',f.available??true)+check('Скрыть из каталога','hidden',f.hidden)+(f.id?'<img src="'+esc(photo(f))+'" width="160" alt="Текущая фотография">':'')+'<label>Фото с камеры или из галереи<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label>'+error+actions('<button class="primary">Сохранить ткань в черновик</button>')+'</form>');
}
const ruleFields={seam:['Припуск на сторону, см',0,20],shrink:['Усадка, %',0,30],elastic:['Резинка на изделие, ₽',0,100000],zipper:['Молния на изделие, ₽',0,100000],packaging:['Упаковка, ₽',0,100000],extra:['Дополнительные расходы, ₽',0,100000],markup:['Наценка, %',0,500],discount:['Скидка, %',0,100]};
function rulesForm(){return ownerPage('Настройки расчёта','<form id="rules" class="panel stack"><p>Тестовая формула. Подтвердите нормы раскроя и цены мастерской.</p><div class="row">'+Object.entries(ruleFields).map(([k,[name,min,max]])=>nField(name,k,rules[k],min,max,0.1)).join('')+types.map(k=>nField('Пошив: '+products[k].name+', ₽','labor_'+k,rules.labor[k],0,100000)).join('')+'</div>'+error+'<button class="primary">Сохранить настройки</button></form>');}
async function imageFile(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024)throw new Error('Выберите изображение JPEG, PNG или WebP до 20 МБ.');
 const url=URL.createObjectURL(file);
 try{
   const img=new Image();img.src=url;await img.decode();
   const scale=Math.min(1,1280/Math.max(img.width,img.height));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
   canvas.getContext('2d',{alpha:false}).drawImage(img,0,0,canvas.width,canvas.height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.76));
   if(!blob||blob.size>2*1024*1024)throw new Error('Фотография слишком большая.');
   return blob;
 }catch(e){throw new Error(e.message==='Фотография слишком большая.'?e.message:'Не удалось открыть фотографию. Выберите другой файл.');}finally{URL.revokeObjectURL(url);}
}
async function saveFabric(form){
 const v=Object.fromEntries(new FormData(form)),id=form.dataset.id||crypto.randomUUID(),old=dataFabrics.find(f=>f.id===id);
 const colors=[...new Set(v.colors.split(',').map(c=>c.trim()).filter(Boolean))];
 if(!colors.length||!v.name.trim()||!v.material.trim()||!v.composition.trim())throw new Error('Заполните название, материал, состав и расцветку.');
 let path=await inventoryPhoto(v.photo,old?.photo,demo?'./img/satin.webp':'');
 if(!path)throw new Error('Добавьте фотографию ткани.');
 const f={id,category_slug:v.category_slug||null,name:v.name.trim(),material:v.material.trim(),composition:v.composition.trim(),description:v.description,colors,width:Number(v.width),rate:Number(v.rate),stock:Number(v.stock),direction:!!v.direction,available:!!v.available,hidden:!!v.hidden,photo:path};
 await saveSection('fabrics',[f,...dataFabrics.filter(p=>p.id!==id)]);
go('#/owner/fabrics');
}
function applyPageMetadata(area,slug){
 if(area==='category'){
   const c=publicCategories.find(c=>c.slug===slug);
   if(!c)return;
   document.title=c.name+' — Тихое утро';
   $('meta[name=description]').content=c.description;
 }else if(!area){
   document.title=content.home.title+' — Тихое утро';
   $('meta[name=description]').content=content.home.description;
 }
}
async function render(focus=true){
 const turn=++epoch;
 const requested=location.hash.replace(/^#\/?/,'');
 route=({orders:'cart',chat:'contact'}[requested.split('/')[0]])||requested||(pathCategory?'category/'+pathCategory:pathCatalog?'fabrics':'');
 currentQuote=null;
 const [area,sub,id]=route.split('/');
 const main=$('#content');
 const current=()=>turn===epoch;
 updateRobots();
 frame();
 try{
   let html;
   if(area==='owner'){
     const permitted=demo?sessionStorage.getItem('qu-demo-owner')==='1':!!auth();
     if(!permitted)html=login();
     else{
       const {state,signed}=await loadEditor();
       if(!current())return;
       editor=state;images=signed;
       ownerCategories=sortCategories(state.draft.categories);ownerProducts=state.draft.products;dataFabrics=state.draft.fabrics;rules=state.draft.rules;
       if(!sub)html=dashboard();
       else if(sub==='fabrics')html=inventoryAdmin(dataFabrics);
       else if(sub==='category'){const row=ownerCategories.find(c=>c.slug===id);if(row||id==='new')html=categoryForm(row||{});}
       else if(sub==='product'){const row=ownerProducts.find(p=>p.id===id);if(row||id==='new')html=productForm(row||{});}
       else if(sub==='fabric'){const row=dataFabrics.find(f=>f.id===id);if(row||id==='new')html=fabricForm(row||{});}
       else if(sub==='rules')html=rulesForm();
       else if(sub==='home')html=homeEditor();
       else if(sub==='news')html=newsEditor();
       else if(sub==='contact')html=contactEditor();
       else if(sub==='preview'){displayContent(state.draft);html=previewPage(id);}
     }
   }else{
     const offline=area==='cart'||area==='contact';
     try{
       const {data,signed}=await loadPublic();
       if(!current())return;
       images=signed;displayContent(data);applyPageMetadata(area,sub);
     }catch(e){
       if(!offline)throw e;
       if(!current())return;
       content=defaults;
       notice('Нет связи с витриной. Корзина по-прежнему доступна для копирования.');
     }
     frame();
     if(!area)html=home();
     else if(area==='fabrics')html=catalog();
     else if(area==='category')html=categoryPage(sub);
     else if(area==='product')html=productPage(sub);
     else if(area==='build'){selectDraft(sub||defaultCategory);html=builder();}
     else if(area==='cart')html=cartPage();
     else if(area==='contact')html=contactPage();
     else if(['install','privacy'].includes(area))html=infoPage(area);
   }
   if(!current())return;
   main.innerHTML=html||panel('Страница не найдена',href('./','На главную'));
   if(focus)main.focus({preventScroll:true});
   if($('#product-order'))syncProductSize($('#product-order'));
   if($('#product-edit'))$('#custom-pricing').hidden=$('#product-edit').elements.pricing.selectedIndex===0;
   if($('#estimate')){
     const selection=quoteSelection();
     try{
       const price=await quoteBedding(selection);
       if(current()&&$('#estimate')){
         currentQuote={price,signature:JSON.stringify(selection)};
         $('#estimate').innerHTML=estimateText(()=>price);
       }
     }catch(e){
       if(current()&&$('#estimate'))$('#estimate').innerHTML=estimateText(()=>{throw e;});
     }
   }
 }catch(e){
   if(current())main.innerHTML=panel('Не удалось загрузить страницу','<p class="error" role="alert">'+esc(e.message)+'</p>'+
    actions('<button data-retry>Попробовать снова</button>'+(area==='owner'&&!demo&&auth()?'<button data-logout>Выйти</button>':'')));
 }
}
document.addEventListener('input',e=>{
 const form=e.target.form;
 if(!form)return;
 if(form.id==='filters')applyFilters(form);
 if(form.id==='product-order'&&['size','w','l','color','qty','comment'].includes(e.target.name)){
   syncProductSize(form);
   const v=Object.fromEntries(new FormData(form));
   try{write(demo?'qu-demo-product-options-v13':'qu-live-product-options-v13',{id:form.dataset.id,size:v.size,w:v.w,l:v.l,color:v.color,qty:v.qty,comment:v.comment});}catch{}
   if(e.target.name!=='comment'){
     currentQuote=null;
     form.querySelector('#product-quote').textContent='';
     form.querySelector('button.primary').textContent='Проверить стоимость';
   }
 }
 if(form.id==='builder'){
   syncBuilder(form);
   if(e.target.name==='fabric')render(false);
 }
});
document.addEventListener('change',e=>{
 if(e.target.name==='text-size'){
   applyTextSize(e.target.value);
   try{write(textSizeKey,e.target.value);}catch{}
 }
 if(e.target.name==='delivery'&&e.target instanceof HTMLSelectElement){
   delivery=e.target.value;write(deliveryKey,delivery);
   $('#cart-message').value=cartMessage();
   const linksPanel=$('#cart-contacts');
   if(linksPanel)linksPanel.innerHTML=contactsActions(true);
 }
 if(e.target.form?.id==='product-edit'&&e.target.name==='pricing')$('#custom-pricing').hidden=e.target.selectedIndex===0;
 if(e.target.name==='preset'&&e.target.value!=='Свои размеры'){
   const [w,l]=e.target.value.split(' × ');
   const box=e.target.closest('[data-item]');
   box.querySelector('[name=w]').value=w;box.querySelector('[name=l]').value=l;syncBuilder(e.target.form);
 }
});
document.addEventListener('click',async e=>{
 const skip=e.target.closest('.skip');
 if(skip){e.preventDefault();$('#content').focus();$('#content').scrollIntoView();return;}
 const b=e.target.closest('button');if(!b)return;
 try{
   if(b.dataset.choose){
     const slug=route.startsWith('category/')?route.split('/')[1]:b.dataset.category;
     selectDraft(slug);
     draft.fabric=b.dataset.choose;draft.color=fabrics.find(f=>f.id===draft.fabric).colors[0];draft.step=1;saveDraft();go('#/build'+(slug===defaultCategory?'':'/'+slug));
   }
   if(b.dataset.photo){const f=fabrics.find(f=>f.id===b.dataset.photo);const img=$('#lightbox img');img.src=photo(f);img.alt=f.name;$('#lightbox').showModal();}
   if('back' in b.dataset){syncBuilder($('#builder'));draft.step--;saveDraft();render();}
   if('full' in b.dataset){draft.items=['sheet','duvet','pillow'].map(t=>draft.items.find(i=>i.type===t)||firstItem(t));saveDraft();render();}
   if('retry' in b.dataset)render();
   if('demoOwner' in b.dataset){sessionStorage.setItem('qu-demo-owner','1');render();}
   if('logout' in b.dataset){if(demo)sessionStorage.removeItem('qu-demo-owner');else await signOut();editor=null;images={};displayContent(initial);go('#/owner');}
   if(b.dataset.remove){saveCart(cart.filter(row=>row.id!==b.dataset.remove));$('#content').innerHTML=cartPage();$('#content').focus();}
   if('copy' in b.dataset)await copyMessage();
   if('vk' in b.dataset&&await copyMessage())location.assign(contactUrls(content.contact).vk);
   if('telegram' in b.dataset&&await copyMessage())location.assign(contactUrls(content.contact).telegram);
 }catch(e){notice(e.message);}
});
document.addEventListener('submit',async e=>{
 const form=e.target;
 if(!form.id)return;
 e.preventDefault();
 if(form.id==='filters')return;
 const button=e.submitter;
 if(button)button.disabled=true;
 try{
   if(form.id==='builder'){
     syncBuilder(form);
     if(draft.step===2&&!draft.items.length)throw new Error('Выберите хотя бы одно изделие.');
     if(draft.step===5)await addBedding(form);
     else {draft.step++;saveDraft();render();}
   }
   if(form.id==='login'){
     const v=Object.fromEntries(new FormData(form));await signIn(v.email,v.password);
     if(!await rpc('storefront_is_owner',{},true)){await signOut();throw new Error('Эта учётная запись не имеет доступа к кабинету.');}
     render();
   }
   if(form.id==='publish'){
     await storeEditor(null,true);
     notice(demo?'Опубликовано в этом браузере.':'Изменения опубликованы на витрине.');
     render();
   }
   if(['home-edit','news-edit','contact-edit'].includes(form.id))await saveSiteForm(form);
   if(form.id==='category-edit')await saveCategory(form);
   if(form.id==='product-edit')await saveProduct(form);
   if(form.id==='product-order')await submitProduct(form);
   if(form.id==='fabric-edit')await saveFabric(form);
   if(form.id==='rules'){
     const v=Object.fromEntries(new FormData(form));
     await saveSection('rules',{...Object.fromEntries(Object.keys(ruleFields).map(k=>[k,Number(v[k])])),labor:Object.fromEntries(types.map(k=>[k,Number(v['labor_'+k])]))});
     go('#/owner/fabrics');
   }
 }catch(e){showError(form,e);}finally{if(button)button.disabled=false;}
});
window.addEventListener('hashchange',()=>{window.scrollTo(0,0);render();});
window.addEventListener('offline',()=>notice('Нет интернета. Подборка сохранена в этом браузере.'));
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden&&(!route||route==='fabrics'||route.startsWith('category/')))render(false);
});
document.addEventListener('error',event=>{
 const img=event.target;
 if(img instanceof HTMLImageElement&&!img.dataset.fallback){
   img.dataset.fallback='1';img.src='./img/satin.webp';
 }
},true);
render(false);
if('serviceWorker' in navigator){
 let active=!!navigator.serviceWorker.controller;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(active)location.reload();active=true;});
 navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>{});
}
