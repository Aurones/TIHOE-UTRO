import {demo,load,write,auth,signIn,signOut,rpc,table,upload,publicPhoto,signedPhoto,subscribeMessages,eraseOrderPhotos} from './api.js';
import {categories,defaultCategory,childSizes,demoProducts,demoFabrics,publicCategoryPath,sortCategories,matchesCategory,sizePattern} from './assortment.js';
import {config} from './config.js';
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
const date=v=>new Date(v).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'});
const glyph={
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
const statuses=['Новый заказ','Уточнение деталей','Цена согласована','В работе','Готов к выдаче','Завершён','Отменён'];
const types=Object.keys(products);
const blank=()=>({step:1,fabric:'',color:'',items:[],comment:'',nonce:crypto.randomUUID()});
let draft=load(demo?'qu-demo-draft':'qu-live-draft',null)||blank();
const checkoutKey=demo?'qu-demo-checkout':'qu-live-checkout';
let checkout={};
try{checkout=JSON.parse(sessionStorage.getItem(checkoutKey))||{};}catch{}
function saveCheckout(values){
 checkout=values;
 try{
   if(Object.keys(values).length)sessionStorage.setItem(checkoutKey,JSON.stringify(values));
   else sessionStorage.removeItem(checkoutKey);
 }catch{}
}
function initialFabrics(){
  const saved=load('qu-demo-fabrics',sample);
  if(load('qu-demo-assortment-migrated',false))return saved;
  const migrated=[...saved,...demoFabrics.filter(f=>!saved.some(old=>old.id===f.id))];
  try{write('qu-demo-fabrics',migrated);write('qu-demo-assortment-migrated',true);}catch{}
  return migrated;
}
let publicCategories=[],publicProducts=[],ownerCategories=[],ownerProducts=[],inventoryReady=demo;
let productSession=null;
const routeUrl=new URL(location.href);
const pathCategory=document.documentElement.dataset.category||routeUrl.searchParams.get('category');
const cleanCategoryPaths=JSON.parse(document.documentElement.dataset.categoryPaths||'[]');
const pathCatalog=document.documentElement.dataset.catalog==='1';
const categoryBySlug=slug=>[...publicCategories,...ownerCategories,...categories].find(c=>c.slug===slug);
const categoryName=o=>o.category_name||categoryBySlug(o.category_slug||defaultCategory)?.name||'Постельное бельё';
const imagery=row=>row.image?.startsWith('./img/')||(demo&&row.image?.startsWith('data:image/jpeg;base64,'))?row.image:row.image?publicPhoto(row.image):categories[0].image;
const categoryPicker=(list,value='',allLabel='')=>'<label>Категория<select name="category_slug" '+(allLabel?'':'required')+'>'+(allLabel?'<option value="">'+allLabel+'</option>':'')+list.map(c=>'<option value="'+esc(c.slug)+'" '+(c.slug===value?'selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></label>';
const isLegacy=e=>['PGRST202','42883'].includes(e.code);
async function loadAssortment(){
  if(demo){
    publicCategories=sortCategories(load('qu-demo-categories',categories).filter(c=>!c.archived));
    const materials=initialFabrics();
    publicProducts=load('qu-demo-products',demoProducts).filter(p=>!p.hidden&&publicCategories.some(c=>c.slug===p.category_slug)).map(p=>{
      if(p.pricing==='fixed')return p;
      const fabric=materials.find(f=>f.id===p.fabric_id&&matchesCategory(f,p.category_slug)&&!f.hidden&&f.available&&f.stock>0);
      const colors=p.colors.filter(color=>fabric?.colors.includes(color));
      return {...p,colors,available:p.available&&!!colors.length};
    });
    return {};
  }
  try {
    const data=await rpc('assortment');
    inventoryReady=true;publicCategories=data.categories;publicProducts=data.products;return data.fabric_categories;
  }catch(e){
    if(!isLegacy(e))throw e;
    inventoryReady=false;publicCategories=categories.slice(0,1);publicProducts=[];return {};
  }
}
async function loadOwnerAssortment(){
  if(demo){
    ownerCategories=sortCategories(load('qu-demo-categories',categories));
    ownerProducts=load('qu-demo-products',demoProducts);
  }else{
    try{
      [ownerCategories,ownerProducts]=await Promise.all([table('categories','?order=position,name'),table('products','?order=name')]);inventoryReady=true;
    }catch(e){
      if(!['PGRST205','42P01'].includes(e.code))throw e;
      inventoryReady=false;ownerCategories=categories.slice(0,1);ownerProducts=[];
    }
  }
}
let fabrics=[],rules=defaultRules,owner=false,route='',epoch=0,timer,chatStop;
const draftKey=demo?'qu-demo-draft':'qu-live-draft';
const categoryDraftKey=slug=>slug===defaultCategory?draftKey:draftKey+'-'+slug;
const saveDraft=()=>write(categoryDraftKey(draft.category||defaultCategory),draft);
function selectDraft(slug){
  if((draft.category||defaultCategory)===slug)return;
  draft=load(categoryDraftKey(slug),null)||{...blank(),category:slug};
}
const map={home:'Главная',fabrics:'Каталог',orders:'Мои заказы',chat:'Чат'};
const links={home:'./',fabrics:'./catalog/',orders:'#/orders',chat:'#/chat'};
const contactLink=()=>{
 try {const url=new URL(config.contact);if(['https:','tel:','mailto:'].includes(url.protocol))return esc(url.href);}catch{}
 return '#/chat';
};
const photo=f=>(f.photo?.startsWith('./img/')||(demo&&f.photo?.startsWith('data:image/jpeg;base64,')))?f.photo:f.photo?publicPhoto(f.photo):'./img/satin.webp';
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
  $('#header').innerHTML='<div class="bar"><a class="brand" href="./"><img src="./img/sun.svg" alt="">Тихое утро</a><nav class="nav" aria-label="Основная навигация">'+Object.entries(map).map(([k,v])=>'<a href="'+links[k]+'" '+(k===active?'aria-current="page"':'')+'>'+icon(k)+'<span>'+v+'</span></a>').join('')+'</nav>'+href(contactLink(),'Связаться','contact')+'</div>';
  $('#mode').innerHTML=demo?'<div class="mode"><strong>Демонстрационный режим</strong> · тестовые заказы</div>':'';
  const size=document.documentElement.dataset.textSize;
  $('#footer').innerHTML='<div class="wrap foot"><div class="foot-brand"><span>Сшито с любовью. Создано для уюта</span><small>Версия 1.2</small></div><div class="foot-links"><a href="#/install">Установить приложение</a><a href="#/privacy">Конфиденциальность</a><a href="'+ownerEntry+'" rel="nofollow">Кабинет владельца</a></div><details class="display-settings"><summary>Размер текста</summary><fieldset><legend>Размер интерфейса</legend>'+[['normal','Обычный'],['large','Увеличенный']].map(([value,label])=>'<label class="check"><input type="radio" name="text-size" value="'+value+'" '+(size===value?'checked':'')+'>'+label+'</label>').join('')+'</fieldset></details></div>';
}
function cards(list,full=false){
  if(!list.length)return '<p>По этим условиям ткани не найдены.</p>';
  return '<div class="grid">'+list.map(f=>'<article class="card media"><button type="button" class="image-btn" data-photo="'+esc(f.id)+'" aria-label="Увеличить фото '+esc(f.name)+'"><img src="'+esc(photo(f))+'" alt="'+esc(f.name)+'" loading="lazy"></button><div class="card-body stack"><h3>'+esc(f.name)+'</h3><p class="muted">'+esc(f.composition)+'</p>'+(full?'<p>'+esc(f.description)+'</p><p>Расцветки: '+esc(f.colors.join(', '))+'</p><p>Ширина рулона: '+f.width+' см</p>':'')+'<p><span class="tag">'+(f.available?'В наличии':'Нет в наличии')+'</span></p>'+(full&&f.available&&categoryBySlug(f.category_slug)?.kind!=='towel'?'<button class="primary" data-choose="'+esc(f.id)+'" data-category="'+esc(f.category_slug||defaultCategory)+'">Выбрать ткань</button>':'')+'</div></article>').join('')+'</div>';
}
function categoryCards(list){
  return '<div class="grid category-grid">'+list.map(c=>'<a class="card media category-card" href="'+publicCategoryPath(c.slug,cleanCategoryPaths)+'"><img src="'+esc(imagery(c))+'" alt="" loading="lazy" width="480" height="320"><div class="card-body"><h3>'+esc(c.name)+'</h3><p>'+esc(c.description)+'</p></div></a>').join('')+'</div>';
}
function home(){
  const featured=publicCategories.find(c=>c.slug===defaultCategory&&c.kind!=='towel')||publicCategories.find(c=>c.kind!=='towel');
  return '<div class="wrap"><section class="hero"><img class="hero-image" src="./img/hero.webp" alt="Постельное бельё шалфейного цвета в мягком утреннем свете" width="1200" height="800" fetchpriority="high"><div class="hero-copy"><p class="eyebrow">Семейная мастерская</p><h1>Уют, сшитый специально для вас</h1><p class="hero-description">Шьём постельное бельё по вашим размерам и из выбранной вами ткани.</p>'+actions((featured?href('#/build'+(featured.slug===defaultCategory?'':'/'+featured.slug),featured.kind==='child'?'Собрать детский комплект':'Собрать свой комплект','primary'):'')+href('./catalog/','Посмотреть каталог',featured?'quiet':'primary'))+'</div></section><section class="section"><div class="section-top"><h2>Каталог мастерской</h2></div>'+categoryCards(publicCategories)+'</section><ul class="features"><li>'+icon('leaf')+'Натуральные ткани</li><li>'+icon('ruler')+'Пошив по вашим размерам</li><li>'+icon('heart')+'Ручная работа</li></ul></div>';
}
function catalog(){
  return '<section class="wrap page stack"><h1>Каталог</h1>'+categoryCards(publicCategories)+'<h2 id="fabrics">Ткани</h2><form id="filters" class="row three">'+field('Поиск по названию или цвету','q','','','search')+select('Материал','material',['Все материалы',...new Set(fabrics.map(f=>f.material))])+check('Только в наличии','stock')+'</form><div id="catalog-results">'+cards(fabrics,true)+'</div></section>';
}
function productCards(list){
  if(!list.length)return '<p>Готовых товаров и отдельных предложений пока нет.</p>';
  return '<div class="grid">'+list.map(p=>'<article class="card media"><img class="admin-image" src="'+esc(imagery(p))+'" alt="" loading="lazy"><div class="card-body stack"><h3>'+esc(p.name)+'</h3><p>'+esc(p.material)+'</p><p>'+esc(p.description)+'</p><p>'+(p.pricing==='fixed'?rub(p.price):'Стоимость рассчитывается по размеру')+'</p>'+(demo?'<p><span class="tag">Демонстрационная позиция</span></p>':'')+(p.available?href('#/product/'+encodeURIComponent(p.id),'Выбрать «'+esc(p.name)+'»','primary'):'<p>Временно недоступно</p>')+'</div></article>').join('')+'</div>';
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
  return '<ul>'+items.map(i=>'<li>'+esc(products[i.type]?.name)+' · '+i.w+' × '+i.l+' см'+(i.type==='fitted'?', высота '+i.h+' см':'')+' · '+i.qty+' шт.'+(['pillow','duvet'].includes(i.type)?' · '+esc(i.closure):'')+'</li>').join('')+'</ul>';
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
  const steps=['Ткань и расцветка','Комплектация','Размеры изделий','Пожелания','Проверка и оформление'];
  let body='';
  if(draft.step===1){
    body='<label>Ткань<select required name="fabric"><option value="">Выберите ткань</option>'+availableFabrics.filter(f=>f.available).map(f=>'<option value="'+esc(f.id)+'" '+(f.id===draft.fabric?'selected':'')+'>'+esc(f.name)+'</option>').join('')+'</select></label>'+select('Расцветка','color',f?.colors??['Сначала выберите ткань'],draft.color)+href('./catalog/','Посмотреть фотографии тканей');
  }
  if(draft.step===2)body='<fieldset><legend>Что сшить</legend><button type="button" data-full>Выбрать полный комплект</button>'+types.map(t=>check(products[t].name,t,draft.items.some(i=>i.type===t))).join('')+'</fieldset>';
  if(draft.step===3)body=measure()+draft.items.map(i=>dimensions(i,slug)).join('');
  if(draft.step===4)body=area('Пожелания к пошиву', 'comment',draft.comment)+'<p class="muted">Например, укажите расположение застёжки или пожелания по рисунку.</p>';
  if(draft.step===5){
    body='<div class="panel"><strong>'+esc(f?.name)+' · '+esc(draft.color)+'</strong>'+summary(draft.items)+(draft.comment?'<p>'+esc(draft.comment)+'</p>':'')+'<div id="estimate" aria-live="polite">'+(demo?estimateText(()=>calculate(draft.items,f,rules).price):'Рассчитываем предварительную стоимость…')+'</div></div>'+checkoutFields(checkout);
  }
  return panel(category.kind==='child'?'Собрать детский комплект':'Собрать свой комплект','<div class="stack"><p class="muted">Шаг '+draft.step+' из 5</p><progress value="'+draft.step+'" max="5" aria-label="Шаг '+draft.step+' из 5"></progress><h2>'+steps[draft.step-1]+'</h2><form class="stack" id="builder">'+body+error+actions((draft.step>1?'<button type="button" data-back>Назад</button>':'')+'<button class="primary">'+(draft.step<5?'Продолжить':demo?'Создать тестовый заказ':'Отправить заказ')+'</button>')+'</form></div>');
}
function checkoutFields(values={}){
  return field('Имя','customer',values.customer,'required maxlength="80" autocomplete="name"')+
    field('Телефон или другой способ связи','contact',values.contact,'required minlength="5" maxlength="120"')+
    select('Получение заказа','delivery',['Самовывоз','Доставка по согласованию'],values.delivery)+
    area('Комментарий к получению','delivery_note',values.delivery_note,500)+
    check('Согласен на обработку данных для оформления заказа','consent',values.consent,'required')+
    '<a href="#/privacy" rel="nofollow">Политика конфиденциальности</a>';
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
  if(draft.step===5)saveCheckout(data);
  saveDraft();
}
const demoOrders=()=>load('qu-demo-orders',[]);
async function getOrders(){return demo?demoOrders():rpc('my_orders_assortment').catch(e=>{if(!isLegacy(e))throw e;return rpc('my_orders');});}
const orderCategories=orders=>[...new Map(orders.map(o=>[o.category_slug||defaultCategory,{slug:o.category_slug||defaultCategory,name:categoryName(o)}])).values()];
function orderContents(o){
  const p=o.product_config;
  return '<p><span class="tag">'+esc(categoryName(o))+'</span></p>'+(
    p?'<p>'+esc(p.name)+' · '+esc(p.material)+' · '+esc(p.size)+' см · '+esc(p.color)+' · '+esc(p.qty)+' шт.</p>':summary(o.items||[])
  );
}
const orderLabel=o=>'Заказ № '+o.id.slice(0,8).toUpperCase();
function statusLabel(o){return '<span class="tag">'+esc(o.status)+'</span>';}
function ordersPage(orders){
  return panel('Мои заказы','<div class="stack">'+(demo?'<p>Здесь отображаются тестовые заказы из этого браузера.</p>':'<p>Заказы доступны в браузере, в котором вы их оформили.</p>')+(orders.length?orders.map(o=>'<article class="card stack"><h2>'+orderLabel(o)+'</h2><p>'+statusLabel(o)+'</p><p>'+esc(o.fabric_name)+' · '+date(o.created_at)+'</p>'+orderContents(o)+(o.final_price!=null?'<p>'+(o.product_config?.pricing==='fixed'?'Фиксированная цена: ':'Согласованная цена: ')+rub(o.final_price)+'</p>':o.estimate!=null?'<p>Предварительная стоимость: '+rub(o.estimate)+'</p>':'')+(o.due?'<p>Срок готовности: '+esc(o.due)+'</p>':'')+actions(href('#/chat/'+o.id,'Открыть чат')+'<button data-repeat="'+o.id+'">Повторить заказ</button>')+'</article>').join(''):'<p>У вас пока нет заказов.</p>'+href('#/build','Собрать свой комплект','primary'))+'</div>');
}
function infoPage(kind){
  if(kind==='install')return panel('Установить приложение','<div class="panel stack"><h2>На Android</h2><p>Откройте сайт в Chrome. Нажмите меню ⋮ и выберите «Установить приложение» или «Добавить на главный экран».</p><h2>На iPhone</h2><p>Откройте сайт в Safari. Нажмите «Поделиться», затем «На экран Домой» и «Добавить».</p><p>Для отдельного значка кабинета на Android откройте <a href="'+ownerEntry+'" rel="nofollow">кабинет владельца</a> в Chrome и установите его через то же меню. В рабочем режиме понадобится вход.</p><p>Каталог и отправка заказов в рабочем режиме требуют интернета.</p></div>');
  return panel('Конфиденциальность','<div class="panel stack"><p>Имя и контакт используют, чтобы уточнить размеры, согласовать цену и передать заказ. В переписке можно прикреплять фото, связанные с заказом.</p><p>Доступ к заказу получают мастерская и браузер, из которого вы отправили заказ. В демонстрации данные заказов хранятся в этом браузере. Вводите только вымышленные имя и контакт.</p><p>В рабочей версии запросить исправление или удаление данных можно в переписке по заказу.</p>'+href('#/chat','Открыть чат')+'</div>');
}
async function submitOrder(form){
  syncBuilder(form);
  const f=fabrics.find(f=>f.id===draft.fabric&&f.available);
  if(!f||!matchesCategory(f,draft.category||defaultCategory)||!f.colors.includes(draft.color)||!draft.items.length)throw new Error('Проверьте ткань, расцветку и комплектацию.');
  const payload={category_slug:draft.category||defaultCategory,fabric_id:f.id,color:draft.color,items:draft.items,comment:draft.comment,nonce:draft.nonce,
    customer:checkout.customer.trim(),contact:checkout.contact.trim(),delivery:checkout.delivery,delivery_note:checkout.delivery_note,consent:!!checkout.consent};
  if(!payload.customer||payload.contact.length<5)throw new Error('Укажите имя и способ связи.');
  if(demo){
    let price=null;try{price=calculate(draft.items,f,rules).price;}catch{}
    const samples=demoOrders();
    if(!samples.some(o=>o.nonce===payload.nonce))write('qu-demo-orders',[{...payload,id:crypto.randomUUID(),created_at:new Date().toISOString(),category_name:categoryName(payload),fabric_name:f.name,status:statuses[0],estimate:price,paid:0,history:[]},...samples]);
  }else await rpc('place_order',{p:payload},true);
  saveCheckout({});draft={...blank(),category:payload.category_slug};saveDraft();notice(demo?'Тестовый заказ сохранён в этом браузере.':'Заказ принят. Статус доступен в разделе «Мои заказы».');go('#/orders');
}
const ownerSections=[
 ['orders','Заказы','Новые и текущие заказы','orders'],
 ['fabrics','Мой ассортимент','Категории, товары и ткани','fabrics'],
 ['messages','Сообщения','Переписка с покупателями','chat'],
 ['stats','Статистика','Оплаты, расходы и выручка','stats']
];
function ownerNav(){
 const current=route.split('/')[1];
 const links=[['','Обзор'],...ownerSections].map(([path,name])=>{
   const active=path===(current||'');
   return '<a href="#/owner'+(path?'/'+path:'')+'" '+(active?'aria-current="page"':'')+'>'+name+'</a>';
 });
 return '<nav class="owner-nav" aria-label="Разделы кабинета">'+links.join('')+'<button class="quiet" data-logout>Выйти</button></nav>';
}
function ownerPage(title,body){
 const heading='<h1>'+title+'</h1>';
 const intro=route.split('/')[1]
   ?ownerNav()+heading
   :'<div class="owner-intro">'+heading+'<button class="quiet" data-logout>Выйти</button></div>';
 return '<section class="wrap page stack owner-page">'+intro+body+'</section>';
}
const allOrders=()=>demo?Promise.resolve(demoOrders()):table('orders','?order=created_at.desc&limit=5000');
const allFabrics=()=>demo?Promise.resolve(initialFabrics()):table('fabrics','?order=name');
function login(){return panel('Кабинет владельца',demo?'<div class="panel stack"><p>В демонстрационном кабинете можно управлять тестовыми заказами и тканями в этом браузере.</p><button class="primary" data-demo-owner>Открыть демонстрационный кабинет</button></div>':'<form id="login" class="panel stack">'+field('Электронная почта','email','','required autocomplete="username"','email')+field('Пароль','password','','required autocomplete="current-password"','password')+error+'<button class="primary">Войти</button></form>');}
function dashboard(orders){
  const active=orders.filter(o=>o.status!=='Отменён');
  const received=active.reduce((sum,o)=>sum+Number(o.paid||0),0);
  return ownerPage('Здравствуйте, мастер!', '<dl class="owner-overview"><div><dt>Новые заказы</dt><dd>'+active.filter(o=>o.status===statuses[0]).length+'</dd></div><div><dt>Получено по заказам</dt><dd>'+rub(received)+'</dd></div></dl>'+href('#/owner/order/new','Создать заказ','primary')+'<div class="owner-sections">'+ownerSections.map(([id,name,desc,glyph])=>'<a class="card owner-tile" href="#/owner/'+id+'" aria-label="Открыть раздел «'+name+'»">'+icon(glyph)+'<div><h2>'+name+'</h2><p>'+desc+'</p></div></a>').join('')+'</div>');
}
function ownerOrderList(orders,section='orders'){
  if(section==='messages')return ownerPage('Сообщения',demo?'<p>Рабочий чат появится после подключения базы. Тестовые сообщения не отправляются.</p>':'<div class="stack">'+(orders.map(o=>'<div class="panel">'+href('#/owner/chat/'+o.id,esc(o.customer)+' · '+orderLabel(o))+' '+(o.customer_unread?'<span class="tag">Новые сообщения</span>':'')+'</div>').join('')||'<p>Переписок пока нет.</p>')+'</div>');
  return ownerPage('Заказы',actions(href('#/owner/order/new','Создать заказ','primary')+href('#/owner/clients','Клиенты')+'<button data-csv="orders">Экспорт CSV</button>')+'<form id="order-filters" class="row three">'+field('Имя или номер заказа','q','','','search')+select('Статус','status',['Все статусы',...statuses])+categoryPicker(orderCategories(orders),'','Все категории')+check('Показать архив','archived')+'</form><div id="owner-orders" class="stack"></div>');
}
function fillOwnerOrders(form,orders){
 const {q,status,archived,category_slug}=Object.fromEntries(new FormData(form));
 $('#owner-orders').innerHTML=orders.filter(o=>!!o.archived===!!archived&&(!category_slug||(o.category_slug||defaultCategory)===category_slug)&&(status==='Все статусы'||o.status===status)&&[o.id,o.customer].join(' ').toLowerCase().includes(q.trim().toLowerCase())).map(o=>'<article class="panel order-row"><div><h3>'+esc(o.customer)+'</h3><p class="order-meta"><span>'+orderLabel(o)+'</span><span>'+date(o.created_at)+'</span><span>'+esc(categoryName(o))+'</span>'+statusLabel(o)+'</p></div>'+href('#/owner/order/'+o.id,'Открыть заказ','quiet')+'</article>').join('')||'<p>Заказы не найдены.</p>';
}
function ownerOrderForm(o,list){
 const isNew=!o.id;
 const selected=o.fabric_id||list[0]?.id;
 const category=o.category_slug||defaultCategory;
 return ownerPage(isNew?'Создать заказ':orderLabel(o),'<form class="panel stack" id="owner-order" data-id="'+(o.id||'')+'">'+field('Имя','customer',o.customer,'required maxlength="80"')+field('Контакт','contact',o.contact,'required minlength="5" maxlength="120"')+select('Получение','delivery',['Самовывоз','Доставка по согласованию'],o.delivery)+area('Комментарий к получению','delivery_note',o.delivery_note,500)+(o.product_id?orderContents(o):categoryPicker(ownerCategories.filter(c=>c.kind!=='towel'&&(!c.archived||c.slug===category)),category)+'<label>Ткань<select name="fabric_id" required>'+list.map(f=>'<option value="'+esc(f.id)+'" '+(f.id===selected?'selected':'')+'>'+esc(f.name)+'</option>').join('')+'</select></label>'+field('Расцветка','color',o.color,'maxlength="80"')+area('Пожелания','comment',o.comment)+types.map(t=>'<details '+(o.items?.some(i=>i.type===t)?'open':'')+'><summary>'+products[t].name+'</summary>'+check('Добавить изделие','include_'+t,o.items?.some(i=>i.type===t))+dimensions(o.items?.find(i=>i.type===t)||firstItem(t,category),category)+'</details>').join(''))+
 '<div class="row">'+select('Статус','status',statuses,o.status)+field('Срок готовности','due',o.due,'','date')+
 field('Согласованная цена, ₽','final_price',o.final_price,'min="0" max="10000000"','number')+nField('Получено оплат, ₽','paid',o.paid||0,0,10000000)+field('Расход ткани вручную, м','meters',o.meters,'min="0" max="5000" step="0.1"','number')+field('Себестоимость вручную, ₽','cost',o.cost,'min="0" max="10000000"','number')+'</div>'+
 (!isNew?'<p>Предварительная цена: '+(o.estimate==null?'уточняется':rub(o.estimate))+' · Остаток: '+(o.final_price==null?'уточняется':rub(Math.max(0,o.final_price-o.paid)))+'</p>':'')+
 area('Заметки владельца','notes',o.notes)+check('В архиве','archived',o.archived)+error+actions('<button class="primary">Сохранить заказ</button>'+(!isNew?href('#/owner/chat/'+o.id,'Переписка'):'')+(!isNew?'<button type="button" data-delete-order="'+o.id+'">Удалить заказ и данные</button>':''))+'</form>'+
 (!isNew?'<details class="panel"><summary>История изменений</summary>'+((o.history||[]).map(h=>'<p>'+date(h.at)+' · '+esc(h.status)+' · '+(h.final_price==null?'без согласованной цены':rub(h.final_price))+' · получено '+rub(h.paid||0)+'</p>').reverse().join('')||'<p>Изменений пока нет.</p>')+'</details>':''));
}
function productPage(id){
 const product=publicProducts.find(p=>p.id===id&&p.available);
 if(!product)return panel('Товар недоступен',href('./catalog/','Вернуться в каталог'));
 const previous=load('qu-product-options',null);
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
 if(product.pricing==='fixed')return {price:product.price*selection.qty,pricing:'fixed'};
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
 const product=publicProducts.find(p=>p.id===form.dataset.id&&p.available);
 if(!product)throw new Error('Товар недоступен.');
 const size=v.size==='Свой размер'?Number(v.w)+' × '+Number(v.l):v.size;
 const selection={product_id:product.id,size,color:v.color,qty:Number(v.qty)};
 const signature=JSON.stringify(selection);
 if(!productSession||productSession.signature!==signature){
   const quote=demo?demoProductQuote(product,selection):await rpc('estimate_product',{p:selection});
   productSession={...quote,signature,nonce:crypto.randomUUID()};
   form.querySelector('#product-quote').innerHTML='<div class="price">'+rub(quote.price)+'</div><p>'+(quote.pricing==='fixed'?'Фиксированная стоимость':'Предварительная стоимость. Мастер подтвердит её после проверки.')+'</p>'+checkoutFields(v);
   form.querySelector('button[type=submit],button.primary').textContent=demo?'Создать тестовый заказ':'Отправить заказ';
   return;
 }
 const payload={...selection,nonce:productSession.nonce,expected_price:productSession.price,comment:v.comment,customer:v.customer.trim(),contact:v.contact.trim(),delivery:v.delivery,delivery_note:v.delivery_note,consent:!!v.consent};
 if(!payload.customer||payload.contact.length<5)throw new Error('Укажите имя и способ связи.');
 if(demo){
    const product_config={...selection,name:product.name,material:product.material,pricing:productSession.pricing};
    write('qu-demo-orders',[{...payload,id:crypto.randomUUID(),created_at:new Date().toISOString(),category_slug:product.category_slug,category_name:categoryName(product),fabric_id:product.fabric_id||null,fabric_name:product.name,items:[],product_config,status:statuses[0],estimate:productSession.price,final_price:productSession.pricing==='fixed'?productSession.price:null,paid:0,history:[]},...demoOrders()]);
 }else{
    try{await rpc('place_product_order',{p:payload},true);}
    catch(e){
      if(e.message.startsWith('Цена изменилась')){
        productSession=null;form.querySelector('#product-quote').innerHTML='';form.querySelector('button.primary').textContent='Проверить стоимость';
      }
      throw e;
    }
 }
 localStorage.removeItem('qu-product-options');
 productSession=null;notice(demo?'Тестовый заказ сохранён в этом браузере.':'Заказ принят.');go('#/orders');
}
function inventoryAdmin(list){
 const categoryList=ownerCategories.map(c=>'<article class="panel order-row"><div><h3>'+esc(c.name)+'</h3><p class="order-meta">Порядок '+c.position+(c.archived?' · В архиве':'')+'</p></div>'+href('#/owner/category/'+c.slug,'Редактировать категорию','quiet')+'</article>').join('');
 const productList=ownerProducts.map(p=>'<article class="panel order-row"><div><h3>'+esc(p.name)+'</h3><p class="order-meta">'+esc(categoryName(p))+' · '+(p.pricing==='fixed'?rub(p.price):'По расчёту')+(p.hidden?' · Скрыт':p.available?' · В наличии':' · Недоступен')+'</p></div>'+href('#/owner/product/'+p.id,'Редактировать товар','quiet')+'</article>').join('');
 const tools=actions(href('#/owner/fabric/new','Добавить ткань')+href('#/owner/rules','Настройки расчёта','quiet'));
 const fabricsList='<div class="grid">'+(list.map(f=>'<article class="card media"><img class="admin-image" src="'+esc(photo(f))+'" alt="'+esc(f.name)+'" loading="lazy"><div class="card-body"><h3>'+esc(f.name)+'</h3><p>'+f.stock+' м · '+rub(f.rate)+' за м</p><p>'+(f.hidden?'Скрыта из каталога':f.available?'В наличии':'Нет в наличии')+'</p>'+href('#/owner/fabric/'+f.id,'Редактировать')+'</div></article>').join('')||'<p>Добавьте первую ткань.</p>')+'</div>';
 return ownerPage('Мой ассортимент',(inventoryReady?'<section class="stack"><h2>Категории</h2>'+href('#/owner/category/new','Добавить категорию')+categoryList+'</section><section class="stack"><h2>Товары</h2>'+href('#/owner/product/new','Добавить товар')+(productList||'<p>Добавьте первый товар после согласования ассортимента.</p>')+'</section>':'<p>Для категорий и товаров нужна миграция Supabase версии 1.2.</p>')+'<section class="stack"><h2>Ткани</h2>'+tools+fabricsList+'</section>');
}
const kinds={adult:'Взрослое постельное бельё',child:'Детское постельное бельё',towel:'Полотенца'};
const fileField='<label>Фото с камеры или из галереи<input type="file" name="upload" accept="image/jpeg,image/png,image/webp"></label>';
function categoryForm(c){
 const options=Object.entries(kinds).map(([k,name])=>'<option value="'+k+'" '+(k===c.kind?'selected':'')+'>'+name+'</option>').join('');
 return ownerPage(c.slug?'Редактировать категорию':'Добавить категорию','<form id="category-edit" data-id="'+esc(c.slug)+'" class="panel stack">'+
 field('Название','name',c.name,'required maxlength="90"')+(c.slug?'<p>Адрес категории · '+esc(c.slug)+'</p>':field('Часть адреса латиницей','slug','','required maxlength="64" pattern="[a-z0-9]+(-[a-z0-9]+)*"'))+
 '<label>Тип конструктора<select name="kind">'+options+'</select></label>'+area('Описание','description',c.description,350)+nField('Порядок показа','position',c.position??100,0,9999)+
 '<details class="stack"><summary>Стандартные размеры для пошива белья</summary><p class="muted">По одному размеру на строку, например 60 × 120. Пустое поле сохраняет стандартные варианты конструктора.</p>'+types.map(type=>area(products[type].name,'preset_'+type,c.presets?.[type]?.map(pair=>pair.join(' × ')).join('\n'),300)).join('')+'</details>'+
 (c.image?'<img src="'+esc(imagery(c))+'" alt="Текущая фотография" width="160">':'')+fileField+check('Архивировать категорию','archived',c.archived)+error+'<button class="primary">Сохранить категорию</button></form>');
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
 check('В наличии','available',p.available??true)+check('Скрыть из каталога','hidden',p.hidden)+error+'<button class="primary">Сохранить товар</button></form>');
}
async function inventoryPhoto(file,previous,fallback){
 if(!file?.size)return previous||fallback;
 const blob=await imageFile(file);
 if(!demo)return upload('fabrics',crypto.randomUUID()+'/'+crypto.randomUUID()+'.jpg',blob);
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
 if(demo)write('qu-demo-categories',[c,...ownerCategories.filter(x=>x.slug!==slug)]);
 else await table('categories',old?'?slug=eq.'+encodeURIComponent(slug):'',old?'PATCH':'POST',c);
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
 if(demo)write('qu-demo-products',[p,...ownerProducts.filter(x=>x.id!==p.id)]);
 else await table('products',old?'?id=eq.'+p.id:'',old?'PATCH':'POST',p);
 go('#/owner/fabrics');
}
function fabricForm(f){
 return ownerPage(f.id?'Редактировать ткань':'Добавить ткань','<form class="panel stack" id="fabric-edit" data-id="'+(f.id||'')+'">'+field('Название','name',f.name,'required maxlength="100"')+field('Материал','material',f.material,'required maxlength="80"')+field('Состав','composition',f.composition,'required maxlength="100"')+area('Описание и свойства','description',f.description)+(inventoryReady?categoryPicker(ownerCategories,f.category_slug,'Для всех категорий'):'')+field('Расцветки через запятую','colors',f.colors?.join(', '),'required maxlength="500"')+'<div class="row three">'+nField('Ширина рулона, см','width',f.width||220,50,400)+nField('Цена за метр, ₽','rate',f.rate||0,0,100000)+nField('Остаток, м','stock',f.stock||0,0,100000,0.1)+'</div>'+check('У рисунка есть направление','direction',f.direction)+check('В наличии','available',f.available??true)+check('Скрыть из каталога','hidden',f.hidden)+(f.id?'<img src="'+esc(photo(f))+'" width="160" alt="Текущая фотография">':'')+'<label>Фото с камеры или из галереи<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label>'+error+actions('<button class="primary">Сохранить ткань</button>')+'</form>');
}
const ruleFields={seam:['Припуск на сторону, см',0,20],shrink:['Усадка, %',0,30],elastic:['Резинка на изделие, ₽',0,100000],zipper:['Молния на изделие, ₽',0,100000],packaging:['Упаковка, ₽',0,100000],extra:['Дополнительные расходы, ₽',0,100000],markup:['Наценка, %',0,500],discount:['Скидка, %',0,100]};
function rulesForm(){return ownerPage('Настройки расчёта','<form id="rules" class="panel stack"><p>Тестовая формула. Подтвердите нормы раскроя и цены мастерской.</p><div class="row">'+Object.entries(ruleFields).map(([k,[name,min,max]])=>nField(name,k,rules[k],min,max,0.1)).join('')+types.map(k=>nField('Пошив: '+products[k].name+', ₽','labor_'+k,rules.labor[k],0,100000)).join('')+'</div>'+error+'<button class="primary">Сохранить настройки</button></form>');}
function clientsPage(orders){
 return ownerPage('Клиенты','<form id="client-filters">'+categoryPicker(orderCategories(orders),'','Все категории')+'</form><div id="client-results" class="stack"></div>');
}
function fillClients(orders,category){
 orders=orders.filter(o=>!category||(o.category_slug||defaultCategory)===category);
 const groups=Object.groupBy?Object.groupBy(orders,o=>o.contact.trim().toLowerCase()):orders.reduce((a,o)=>{(a[o.contact.trim().toLowerCase()]??=[]).push(o);return a;},Object.create(null));
 $('#client-results').innerHTML=Object.values(groups).map(group=>'<details class="panel"><summary>'+esc(group[0].customer)+' · '+group.length+' заказов</summary><p>'+esc(group[0].contact)+'</p>'+group.map(o=>orderContents(o)+href('#/owner/order/'+o.id,'Открыть '+orderLabel(o))+(o.notes?'<p>'+esc(o.notes)+'</p>':'')).join('')+'</details>').join('')||'<p>Клиенты появятся после оформления первого заказа.</p>';
}
const periods={'Сегодня':1,'Неделя':7,'Месяц':30,'Год':365};
function statsCalc(orders,period,category=''){
 const start=new Date();start.setHours(0,0,0,0);start.setDate(start.getDate()-periods[period]+1);
 const eligible=orders.filter(o=>new Date(o.created_at)>=start&&(!category||(o.category_slug||defaultCategory)===category)&&o.status!=='Отменён');
 const sales=eligible.filter(o=>o.final_price!=null);
 const sum=(rows,prop)=>rows.reduce((s,o)=>s+Number(o[prop]||0),0);
 const revenue=sum(sales,'final_price'),paid=sum(eligible,'paid'),cost=sum(sales,'cost');
 const expenses=sum(sales,'extra_cost');
 const labels={'Согласованная выручка':revenue,'Полученные оплаты по заказам периода':paid,'Неоплаченные остатки':sales.reduce((sum,o)=>sum+Math.max(0,o.final_price-o.paid),0),'Себестоимость с расходами':cost,'Дополнительные расходы в себестоимости':expenses,'Расчётная прибыль':revenue-cost,'Количество заказов':eligible.length,'Средний чек':sales.length?revenue/sales.length:0,'Постоянные клиенты':new Set(eligible.filter(o=>orders.filter(a=>a.contact===o.contact&&a.status==='Завершён').length>1).map(o=>o.contact)).size};
 const popular=Object.entries(eligible.reduce((acc,o)=>{acc[o.fabric_name]=(acc[o.fabric_name]||0)+1;return acc;},Object.create(null))).sort((a,b)=>b[1]-a[1]);
 return {labels,popular};
}
function statsFill(orders,period){
 const {labels,popular}=statsCalc(orders,period,$('#stats [name=category_slug]').value);
 $('#stats-result').innerHTML='<div class="grid stat-grid">'+Object.entries(labels).map(([k,v])=>'<article class="card stat">'+k+'<strong>'+(['Количество заказов','Постоянные клиенты'].includes(k)?v:rub(v))+'</strong></article>').join('')+'</div><h2>Популярные ткани</h2>'+(popular.map(([k,v])=>'<p>'+esc(k)+' · '+v+'<meter aria-label="'+esc(k)+'" min="0" max="'+popular[0][1]+'" value="'+v+'"></meter></p>').join('')||'<p>За выбранный период заказов нет.</p>');
}
function csv(rows,name){
 const quote=v=>{let s=String(v??'');if(/^[\s]*[=+@\-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(row=>row.map(quote).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=name+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function imageFile(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024)throw new Error('Выберите изображение JPEG, PNG или WebP до 20 МБ.');
 const url=URL.createObjectURL(file);
 try{
   const img=new Image();img.src=url;await img.decode();
   const scale=Math.min(1,1400/Math.max(img.width,img.height));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
   canvas.getContext('2d',{alpha:false}).drawImage(img,0,0,canvas.width,canvas.height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));
   if(!blob||blob.size>2*1024*1024)throw new Error('Фотография слишком большая.');
   return blob;
 }catch(e){throw new Error(e.message==='Фотография слишком большая.'?e.message:'Не удалось открыть фотографию. Выберите другой файл.');}finally{URL.revokeObjectURL(url);}
}
let dataOrders=[],dataFabrics=[];
async function saveOwnerOrder(form){
 const values=Object.fromEntries(new FormData(form));
 const old=dataOrders.find(o=>o.id===form.dataset.id);
 const f=dataFabrics.find(f=>f.id===values.fabric_id);
 const items=[...form.querySelectorAll('[data-item]')].filter(box=>values['include_'+box.dataset.item]).map(box=>({...firstItem(box.dataset.item),...Object.fromEntries([...box.querySelectorAll('[name]:not([name=preset])')].map(el=>[el.name,el.type==='number'?Number(el.value):el.value]))}));
 if((!old?.product_id&&(!f||!items.length))||!values.customer.trim()||values.contact.trim().length<5)throw new Error('Укажите имя, контакт, ткань и хотя бы одно изделие.');
 if(values.archived&&!['Завершён','Отменён'].includes(values.status))throw new Error('В архив можно перенести завершённый или отменённый заказ.');
 if(values.status==='Отменён'&&old?.status!==values.status&&!confirm('Отменить этот заказ?'))return;
 let calc={};try{calc=calculate(items,f,rules);}catch{}
 const num=(value,fallback=null)=>value===''?fallback:Number(value);
 const cat=categoryBySlug(values.category_slug||old?.category_slug||defaultCategory);
 if(!old?.product_id&&inventoryReady&&(!cat||!matchesCategory(f,cat.slug)))throw new Error('Выберите ткань для этой категории.');
 const details=old?.product_id?{}:{fabric_id:f.id,fabric_name:f.name,color:values.color||f.colors[0],items,...(inventoryReady?{category_slug:cat.slug,category_name:cat.name}:{})};
 const o={...details,customer:values.customer.trim(),contact:values.contact.trim(),delivery:values.delivery,delivery_note:values.delivery_note,comment:values.comment,status:values.status,due:values.due||null,final_price:num(values.final_price),paid:Number(values.paid),meters:num(values.meters,calc.meters??null),cost:num(values.cost,calc.cost??null),estimate:old?.estimate??calc.price??null,extra_cost:old?.extra_cost??rules.extra,notes:values.notes,archived:!!values.archived};
 if(demo){
   o.history=[...(old?.history||[]),{at:new Date().toISOString(),status:o.status,paid:o.paid,final_price:o.final_price}];
   write('qu-demo-orders',[{...old,...o,id:old?.id||crypto.randomUUID(),created_at:old?.created_at||new Date().toISOString()},...dataOrders.filter(p=>p.id!==old?.id)]);
 }else await table('orders',old?'?id=eq.'+old.id:'',old?'PATCH':'POST',o);
 notice('Заказ сохранён.');go('#/owner/orders');
}
async function saveFabric(form){
 const v=Object.fromEntries(new FormData(form)),id=form.dataset.id||crypto.randomUUID(),old=dataFabrics.find(f=>f.id===id);
 const colors=[...new Set(v.colors.split(',').map(c=>c.trim()).filter(Boolean))];
 if(!colors.length||!v.name.trim()||!v.material.trim()||!v.composition.trim())throw new Error('Заполните название, материал, состав и расцветку.');
 let path=old?.photo||'';
 if(v.photo?.size){
   const blob=await imageFile(v.photo);
   if(demo){
     path=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
   }else path=await upload('fabrics',id+'/'+crypto.randomUUID()+'.jpg',blob);
 }else if(!path&&!demo)throw new Error('Добавьте фотографию ткани.');
 const f={id,...(inventoryReady?{category_slug:v.category_slug||null}:{}),name:v.name.trim(),material:v.material.trim(),composition:v.composition.trim(),description:v.description,colors,width:Number(v.width),rate:Number(v.rate),stock:Number(v.stock),direction:!!v.direction,available:!!v.available,hidden:!!v.hidden,photo:path};
 if(demo)write('qu-demo-fabrics',[f,...dataFabrics.filter(p=>p.id!==id)]);
 else await table('fabrics',old?'?id=eq.'+id:'',old?'PATCH':'POST',f);
 notice('Ткань сохранена.');go('#/owner/fabrics');
}
async function chatPage(id,isOwner,orders){
 if(demo)return panel('Чат с мастерской','<p>Демонстрационный режим. Отправка сообщений доступна после подключения сервера.</p>'+href('#/orders','Посмотреть тестовые заказы'));
 const order=orders.find(o=>o.id===id);
 if(!order)return panel('Чат с мастерской',orders.length?'<div class="stack">'+orders.map(o=>'<p>'+href('#/chat/'+o.id,orderLabel(o))+' '+(o.owner_unread?'<span class="tag">Новые сообщения</span>':'')+'</p>').join('')+'</div>':'<p>Переписка открывается после оформления заказа.</p>'+actions(href('#/build','Собрать свой комплект','primary')+(contactLink()!=='#/chat'?href(contactLink(),'Связаться с мастерской'):'')));
 return (isOwner?ownerPage:panel)('Переписка по заказу','<div class="stack"><p>'+orderLabel(order)+'</p><div class="messages" id="messages" role="log" aria-label="Сообщения"></div><p class="error" id="chat-error" role="alert" hidden></p><form id="chat-form" class="panel stack" data-id="'+id+'">'+area('Сообщение','message','',2000)+'<label>Прикрепить фото<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label>'+error+'<button class="primary">Отправить</button></form></div>');
}
async function watchChat(id){
 let last='',busy=false;
 async function refresh(){
   if(busy||!$('#messages'))return;busy=true;
   try{
     const ms=await table('messages','?order_id=eq.'+id+'&order=created_at.desc&limit=100');
     if(!$('#messages')||$('#chat-form')?.dataset.id!==id)return;
     const marker=ms[0]?.id||'empty';
     $('#chat-error').hidden=true;
     if(marker===last)return;
     const markup=await Promise.all([...ms].reverse().map(async m=>{
       let pic='';if(m.photo){try{pic='<img alt="Фотография из переписки" src="'+esc(await signedPhoto(m.photo))+'">';}catch{pic='<p>Фото недоступно.</p>';}}
       return '<div class="bubble '+(m.sender===auth()?.user?.id?'mine':'')+'">'+esc(m.body)+pic+'<br><small>'+date(m.created_at)+'</small></div>';
     }));
     if($('#chat-form')?.dataset.id!==id)return;
     const box=$('#messages');box.innerHTML=markup.join('')||'<p>Сообщений пока нет.</p>';box.scrollTop=box.scrollHeight;
     await rpc('read_chat',{oid:id});last=marker;$('#chat-error').hidden=true;
   }catch(e){if($('#chat-error')){$('#chat-error').textContent=e.message;$('#chat-error').hidden=false;}}finally{busy=false;}
 }
 const interval=setInterval(refresh,3500);
 const socketStop=await subscribeMessages(id,refresh).catch(()=>null);
 if($('#chat-form')?.dataset.id!==id){clearInterval(interval);socketStop?.();return;}
 chatStop=()=>{clearInterval(interval);socketStop?.();};
 refresh();
}
async function sendMessage(form){
 const id=form.dataset.id,v=Object.fromEntries(new FormData(form)),body=v.message.trim();
 if(!body&&!v.photo?.size)throw new Error('Напишите сообщение или прикрепите фото.');
 if(!navigator.onLine)throw new Error('Нет интернета. Сообщение сохранено в форме, попробуйте позже.');
 let path=null;
 if(v.photo?.size)path=await upload('chat',id+'/'+crypto.randomUUID()+'.jpg',await imageFile(v.photo));
 await rpc('send_chat',{oid:id,txt:body,pic:path});form.reset();notice('Сообщение отправлено.');
}
async function render(focus=true){
 const turn=++epoch;chatStop?.();chatStop=null;
 route=location.hash.replace(/^#\/?/,'')||(pathCategory?'category/'+pathCategory:pathCatalog?'fabrics':'');
 productSession=null;frame();updateRobots();
 const main=$('#content'),[area,sub,id]=route.split('/');
 const current=()=>turn===epoch;
 try{
   if(!area||['fabrics','category','product','build','orders'].includes(area)){
     const [assignments,materials]=await Promise.all([loadAssortment(),demo?initialFabrics().filter(f=>!f.hidden):rpc('catalog')]);
     fabrics=materials.map(f=>({...f,category_slug:assignments?.[f.id]||f.category_slug})).filter(f=>!f.category_slug||publicCategories.some(c=>c.slug===f.category_slug));
     if(demo)rules=load('qu-demo-rules',defaultRules);
   }
   if(!current())return;
   let html;
   if(!area)html=home();
   else if(area==='fabrics')html=catalog();
   else if(area==='category')html=categoryPage(sub);
   else if(area==='product')html=productPage(sub);
   else if(area==='build'){
     const slug=sub||defaultCategory;
     selectDraft(slug);
     html=builder();
   }
   else if(area==='orders'){dataOrders=await getOrders();html=ordersPage(dataOrders);}
   else if(area==='chat')html=await chatPage(sub,false,demo?[]:await getOrders());
   else if(['install','privacy'].includes(area))html=infoPage(area);
   else if(area==='owner'){
     owner=demo?sessionStorage.getItem('qu-demo-owner')==='1':auth()&&!auth().user?.is_anonymous?await rpc('owner_status'):false;
     if(!owner)html=login();
     else {
       if(['fabrics','fabric','order','category','product'].includes(sub)){
         [dataFabrics]=await Promise.all([allFabrics(),loadOwnerAssortment()]);
       }
       if(!['fabrics','fabric','rules','category','product'].includes(sub))dataOrders=await allOrders();
       if(['order','rules'].includes(sub))rules=demo?load('qu-demo-rules',defaultRules):(await table('settings','?id=eq.1'))[0]?.rules||defaultRules;
       const selected=dataOrders.find(o=>o.id===id);
       if(!sub)html=dashboard(dataOrders);
       else if(['orders','messages'].includes(sub))html=ownerOrderList(dataOrders,sub);
       else if(sub==='clients')html=clientsPage(dataOrders);
       else if(sub==='order')html=id==='new'||selected?ownerOrderForm(selected||{},dataFabrics):ownerPage('Заказ не найден','');
       else if(sub==='fabrics')html=inventoryAdmin(dataFabrics);
       else if(sub==='category'&&inventoryReady){const c=ownerCategories.find(c=>c.slug===id);html=id==='new'||c?categoryForm(c||{}):ownerPage('Категория не найдена','');}
       else if(sub==='product'&&inventoryReady){const p=ownerProducts.find(p=>p.id===id);html=id==='new'||p?productForm(p||{}):ownerPage('Товар не найден','');}
       else if(sub==='fabric'){const f=dataFabrics.find(f=>f.id===id);html=id==='new'||f?fabricForm(f||{}):ownerPage('Ткань не найдена','');}
       else if(sub==='rules')html=rulesForm();
       else if(sub==='stats')html=ownerPage('Статистика','<form class="row" id="stats">'+select('Период','period',Object.keys(periods))+categoryPicker(orderCategories(dataOrders),'','Все категории')+'<button type="button" data-csv="stats">Экспорт CSV</button></form><p class="muted">Период определяется по дате оформления заказа. Суммы оплаты отражают текущее состояние заказов.</p><div class="stack" id="stats-result"></div>');
       else if(sub==='chat')html=await chatPage(id,true,dataOrders);
     }
   }
   if(!current())return;
   main.innerHTML=html||panel('Страница не найдена',href('./','На главную'));
   if(focus)main.focus({preventScroll:true});
   if($('#client-results'))fillClients(dataOrders,'');
   if($('#owner-orders'))fillOwnerOrders($('#order-filters'),dataOrders);
   if($('#stats-result'))statsFill(dataOrders,$('#stats [name=period]').value);
   if($('#product-order'))syncProductSize($('#product-order'));
   if($('#product-edit'))$('#custom-pricing').hidden=$('#product-edit').elements.pricing.selectedIndex===0;
   if($('#chat-form'))watchChat($('#chat-form').dataset.id);
   if(!demo&&$('#estimate')){
     const text=await rpc('estimate_order',{p:{category_slug:draft.category||defaultCategory,fabric_id:draft.fabric,color:draft.color,items:draft.items}}).then(price=>estimateText(()=>price),e=>estimateText(()=>{throw e;}));
     if(current()&&$('#estimate'))$('#estimate').innerHTML=text;
   }
 }catch(e){if(current())main.innerHTML=panel('Не удалось загрузить страницу','<p class="error" role="alert">'+esc(e.message)+'</p><button data-retry>Попробовать снова</button>');}
}
document.addEventListener('input',e=>{
 const form=e.target.form;
 if(!form)return;
 if(form.id==='filters')applyFilters(form);
 if(form.id==='order-filters')fillOwnerOrders(form,dataOrders);
 if(form.id==='client-filters')fillClients(dataOrders,e.target.value);
 if(form.id==='stats')statsFill(dataOrders,$('#stats [name=period]').value);
 if(form.id==='product-order'&&['size','w','l','color','qty','comment'].includes(e.target.name)){
   const v=Object.fromEntries(new FormData(form));
   try{write('qu-product-options',{id:form.dataset.id,size:v.size,w:v.w,l:v.l,color:v.color,qty:v.qty,comment:v.comment});}catch{}
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
   return;
 }
 if(e.target.form?.id==='product-order')syncProductSize(e.target.form);
 if(e.target.form?.id==='product-edit'&&e.target.name==='pricing')$('#custom-pricing').hidden=e.target.selectedIndex===0;
 if(e.target.name!=='preset'||e.target.value==='Свои размеры')return;
 const [w,l]=e.target.value.split(' × ');
 const box=e.target.closest('[data-item]');
 box.querySelector('[name=w]').value=w;box.querySelector('[name=l]').value=l;
 if(e.target.form.id==='builder')syncBuilder(e.target.form);
});
document.addEventListener('click',async e=>{
 const skip=e.target.closest('.skip');
 if(skip){e.preventDefault();$('#content').focus();$('#content').scrollIntoView();return;}
 const b=e.target.closest('button');if(!b)return;
 try{
   if(b.dataset.choose){
     const slug=route.startsWith('category/')?route.split('/')[1]:b.dataset.category;
     if(categoryBySlug(slug)?.kind==='towel'){notice('Выберите полотенце в разделе «Товары».');return;}
     selectDraft(slug);
     draft.fabric=b.dataset.choose;draft.color=fabrics.find(f=>f.id===draft.fabric).colors[0];draft.step=1;saveDraft();go('#/build'+(slug===defaultCategory?'':'/'+slug));
   }
   if(b.dataset.photo){const f=fabrics.find(f=>f.id===b.dataset.photo);const img=$('#lightbox img');img.src=photo(f);img.alt=f.name;$('#lightbox').showModal();}
   if('back' in b.dataset){syncBuilder($('#builder'));draft.step--;saveDraft();render();}
   if('full' in b.dataset){draft.items=['sheet','duvet','pillow'].map(t=>draft.items.find(i=>i.type===t)||firstItem(t));saveDraft();render();}
   if('retry' in b.dataset)render();
   if('demoOwner' in b.dataset){sessionStorage.setItem('qu-demo-owner','1');render();}
   if('logout' in b.dataset){if(demo)sessionStorage.removeItem('qu-demo-owner');else await signOut();go('#/owner');}
   if(b.dataset.repeat){
     const o=dataOrders.find(o=>o.id===b.dataset.repeat);
     if(o.product_id){write('qu-product-options',{...o.product_config,id:o.product_id,comment:o.comment});go('#/product/'+o.product_id);}
     else{const slug=o.category_slug||defaultCategory;draft={...blank(),category:slug,fabric:o.fabric_id,color:o.color,items:o.items,comment:o.comment};saveDraft();go('#/build'+(slug===defaultCategory?'':'/'+slug));}
   }
   if(b.dataset.deleteOrder&&confirm('Удалить заказ, переписку и данные без возможности восстановления?')){
     if(demo)write('qu-demo-orders',demoOrders().filter(o=>o.id!==b.dataset.deleteOrder));else {await eraseOrderPhotos(b.dataset.deleteOrder);await rpc('delete_order',{oid:b.dataset.deleteOrder});}
     notice('Заказ удалён.');go('#/owner/orders');
   }
   if(b.dataset.csv==='orders')csv([['Номер','Дата','Имя','Контакт','Категория','Статус','Цена','Получено'],...dataOrders.map(o=>[o.id,o.created_at,o.customer,o.contact,categoryName(o),o.status,o.final_price,o.paid])],'Заказы');
   if(b.dataset.csv==='stats')csv([['Показатель','Значение'],...Object.entries(statsCalc(dataOrders,$('#stats [name=period]').value,$('#stats [name=category_slug]').value).labels)],'Статистика');
 }catch(e){notice(e.message);}
});
document.addEventListener('submit',async e=>{
 const form=e.target;
 if(!form.id)return;
 e.preventDefault();
 if(['filters','order-filters','client-filters','stats'].includes(form.id))return;
 const button=e.submitter;
 if(button)button.disabled=true;
 try{
   if(form.id==='builder'){
     syncBuilder(form);
     if(draft.step===2&&!draft.items.length)throw new Error('Выберите хотя бы одно изделие.');
     if(draft.step===5)await submitOrder(form);
     else {draft.step++;saveDraft();render();}
   }
   if(form.id==='login'){
     const v=Object.fromEntries(new FormData(form));await signIn(v.email,v.password);
     if(!await rpc('owner_status')){await signOut();throw new Error('Эта учётная запись не имеет доступа к кабинету.');}
     render();
   }
   if(form.id==='category-edit')await saveCategory(form);
   if(form.id==='product-edit')await saveProduct(form);
   if(form.id==='product-order')await submitProduct(form);
   if(form.id==='owner-order')await saveOwnerOrder(form);
   if(form.id==='fabric-edit')await saveFabric(form);
   if(form.id==='rules'){
     const v=Object.fromEntries(new FormData(form));
     rules={...Object.fromEntries(Object.keys(ruleFields).map(k=>[k,Number(v[k])])),labor:Object.fromEntries(types.map(k=>[k,Number(v['labor_'+k])]))};
     if(demo)write('qu-demo-rules',rules);else await table('settings','?id=eq.1','PATCH',{rules});
     notice('Настройки сохранены.');
   }
   if(form.id==='chat-form')await sendMessage(form);
 }catch(e){showError(form,e);}finally{if(button)button.disabled=false;}
});
window.addEventListener('hashchange',()=>{window.scrollTo(0,0);render();});
window.addEventListener('offline',()=>notice('Нет интернета. Отправка в рабочем режиме временно недоступна.'));
document.addEventListener('error',event=>{
 const img=event.target;
 if(img instanceof HTMLImageElement&&!img.dataset.fallback){
   img.dataset.fallback='1';img.src='./img/satin.webp';
 }
},true);
render(false);
if('serviceWorker' in navigator){let active=!!navigator.serviceWorker.controller;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(active)location.reload();active=true;});navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>{});}
