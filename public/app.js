import {demo,load,write,auth,signIn,signOut,rpc,table,upload,publicPhoto,signedPhoto,subscribeMessages,eraseOrderPhotos} from './api.js';
import {config} from './config.js';
import {products,defaultRules,calculate} from './calc.js';

const $=s=>document.querySelector(s);
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
let fabrics=[],rules=defaultRules,owner=false,route='',epoch=0,timer,chatStop;
const draftKey=demo?'qu-demo-draft':'qu-live-draft';
const saveDraft=()=>write(draftKey,draft);
const map={home:'Главная',fabrics:'Ткани',orders:'Мои заказы',chat:'Чат'};
const links={home:'#/',fabrics:'#/fabrics',orders:'#/orders',chat:'#/chat'};
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
function go(path){if(location.hash===path) render();else location.hash=path;}
function frame(){
  const active=route.split('/')[0]||'home';
  $('#header').innerHTML='<div class="bar"><a class="brand" href="#/"><img src="./img/sun.svg" alt="">Тихое утро</a><nav class="nav" aria-label="Основная навигация">'+Object.entries(map).map(([k,v])=>'<a href="'+links[k]+'" '+(k===active?'aria-current="page"':'')+'>'+icon(k)+'<span>'+v+'</span></a>').join('')+'</nav>'+href(contactLink(),'Связаться','contact')+'</div>';
  $('#mode').innerHTML=demo?'<div class="mode"><strong>Демонстрационный режим</strong> · тестовые заказы</div>':'';
  const size=document.documentElement.dataset.textSize;
  $('#footer').innerHTML='<div class="wrap foot"><div class="foot-brand"><span>Сшито с любовью. Создано для уюта</span><small>Версия 1.1</small></div><div class="foot-links"><a href="#/install">Установить приложение</a><a href="#/privacy">Конфиденциальность</a><a href="'+ownerEntry+'">Кабинет владельца</a></div><details class="display-settings"><summary>Размер текста</summary><fieldset><legend>Размер интерфейса</legend>'+[['normal','Обычный'],['large','Увеличенный']].map(([value,label])=>'<label class="check"><input type="radio" name="text-size" value="'+value+'" '+(size===value?'checked':'')+'>'+label+'</label>').join('')+'</fieldset></details></div>';
}
function cards(list,full=false){
  if(!list.length)return '<p>По этим условиям ткани не найдены.</p>';
  return '<div class="grid">'+list.map(f=>'<article class="card media"><button type="button" class="image-btn" data-photo="'+esc(f.id)+'" aria-label="Увеличить фото '+esc(f.name)+'"><img src="'+esc(photo(f))+'" alt="'+esc(f.name)+'" loading="lazy"></button><div class="card-body stack"><h3>'+esc(f.name)+'</h3><p class="muted">'+esc(f.composition)+'</p>'+(full?'<p>'+esc(f.description)+'</p><p>Расцветки: '+esc(f.colors.join(', '))+'</p><p>Ширина рулона: '+f.width+' см</p>':'')+'<p><span class="tag">'+(f.available?'В наличии':'Нет в наличии')+'</span></p>'+(full&&f.available?'<button class="primary" data-choose="'+esc(f.id)+'">Выбрать ткань</button>':'')+'</div></article>').join('')+'</div>';
}
function home(){
  return '<div class="wrap"><section class="hero"><img class="hero-image" src="./img/hero.webp" alt="Постельное бельё шалфейного цвета в мягком утреннем свете" width="1200" height="800" fetchpriority="high"><div class="hero-copy"><p class="eyebrow">Семейная мастерская</p><h1>Уют, сшитый специально для вас</h1><p class="hero-description">Шьём постельное бельё по вашим размерам и из выбранной вами ткани.</p>'+actions(href('#/build','Собрать свой комплект','primary')+href('#/fabrics','Посмотреть ткани','quiet'))+'</div></section><ul class="features"><li>'+icon('leaf')+'Натуральные ткани</li><li>'+icon('ruler')+'Пошив по вашим размерам</li><li>'+icon('heart')+'Ручная работа</li></ul><section class="section"><div class="section-top"><h2>Ткани для вашего дома</h2>'+href('#/fabrics','Все ткани','quiet')+'</div>'+cards(fabrics.slice(0,3))+'</section></div>';
}
function catalog(){return '<section class="wrap page stack"><h1>Ткани</h1><form id="filters" class="row three">'+field('Поиск по названию или цвету','q','','','search')+select('Материал','material',['Все материалы',...new Set(fabrics.map(f=>f.material))])+check('Только в наличии','stock')+'</form><div id="catalog-results">'+cards(fabrics,true)+'</div></section>';}
function applyFilters(form){const {q,material,stock}=Object.fromEntries(new FormData(form));$('#catalog-results').innerHTML=cards(fabrics.filter(f=>(material==='Все материалы'||f.material===material)&&(!stock||f.available)&&[f.name,f.material,...f.colors].join(' ').toLowerCase().includes(q.trim().toLowerCase())),true);}
const firstItem=type=>({type,w:products[type].sizes[0][0],l:products[type].sizes[0][1],h:20,qty:type==='pillow'?2:1,closure:type==='pillow'?'Клапан':type==='duvet'?'Молния':'Без застёжки'});
function summary(items){
  return '<ul>'+items.map(i=>'<li>'+esc(products[i.type]?.name)+' · '+i.w+' × '+i.l+' см'+(i.type==='fitted'?', высота '+i.h+' см':'')+' · '+i.qty+' шт.'+(['pillow','duvet'].includes(i.type)?' · '+esc(i.closure):'')+'</li>').join('')+'</ul>';
}
function dimensions(i){
  return '<fieldset class="stack" data-item="'+i.type+'"><legend>'+products[i.type].name+'</legend>'+select('Стандартный размер','preset',['Свои размеры',...products[i.type].sizes.map(([w,l])=>w+' × '+l)],i.w+' × '+i.l)+'<div class="row">'+nField('Ширина, см','w',i.w,20,400)+nField('Длина, см','l',i.l,20,400)+(i.type==='fitted'?nField('Высота матраса, см','h',i.h,5,60):'')+nField('Количество, шт.','qty',i.qty,1,12)+(['duvet','pillow'].includes(i.type)?select('Застёжка','closure',i.type==='pillow'?['Клапан','Молния']:['Молния','Без застёжки'],i.closure):'')+'</div></fieldset>';
}
function measure(){return '<details><summary>Как снять мерки</summary><div class="measure"><svg role="img" aria-label="Прямоугольник, ширина по горизонтали и длина по вертикали" viewBox="0 0 140 94"><path d="M17 22h91v56H17zM17 12h91m-91-4v8m91-8v8m11 6v56m-4-56h8m-8 56h8" fill="none" stroke="currentColor" stroke-width="2"/></svg><p>Измерьте ширину и длину матраса, одеяла или подушки по краям. Для простыни на резинке измерьте также высоту матраса сбоку.</p></div>'+href(contactLink(),'Попросить помощи')+'</details>';}
function builder(){
  const f=fabrics.find(f=>f.id===draft.fabric);
  const steps=['Ткань и расцветка','Комплектация','Размеры изделий','Пожелания','Проверка и оформление'];
  let body='';
  if(draft.step===1){
    body='<label>Ткань<select required name="fabric"><option value="">Выберите ткань</option>'+fabrics.filter(f=>f.available).map(f=>'<option value="'+esc(f.id)+'" '+(f.id===draft.fabric?'selected':'')+'>'+esc(f.name)+'</option>').join('')+'</select></label>'+select('Расцветка','color',f?.colors??['Сначала выберите ткань'],draft.color)+href('#/fabrics','Посмотреть фотографии тканей');
  }
  if(draft.step===2)body='<fieldset><legend>Что сшить</legend><button type="button" data-full>Выбрать полный комплект</button>'+types.map(t=>check(products[t].name,t,draft.items.some(i=>i.type===t))).join('')+'</fieldset>';
  if(draft.step===3)body=measure()+draft.items.map(dimensions).join('');
  if(draft.step===4)body=area('Пожелания к пошиву', 'comment',draft.comment)+'<p class="muted">Например, укажите расположение застёжки или пожелания по рисунку.</p>';
  if(draft.step===5){
    body='<div class="panel"><strong>'+esc(f?.name)+' · '+esc(draft.color)+'</strong>'+summary(draft.items)+(draft.comment?'<p>'+esc(draft.comment)+'</p>':'')+'<div id="estimate" aria-live="polite">'+(demo?estimateText(()=>calculate(draft.items,f,rules).price):'Рассчитываем предварительную стоимость…')+'</div></div>'+field('Имя','customer',checkout.customer,'required maxlength="80" autocomplete="name"')+field('Телефон или другой способ связи','contact',checkout.contact,'required minlength="5" maxlength="120"')+select('Получение заказа','delivery',['Самовывоз','Доставка по согласованию'],checkout.delivery)+area('Комментарий к получению','delivery_note',checkout.delivery_note,500)+check('Согласен на обработку данных для оформления заказа','consent',checkout.consent,'required')+'<a href="#/privacy">Политика конфиденциальности</a>';
  }
  return panel('Собрать свой комплект','<div class="stack"><p class="muted">Шаг '+draft.step+' из 5</p><progress value="'+draft.step+'" max="5" aria-label="Шаг '+draft.step+' из 5"></progress><h2>'+steps[draft.step-1]+'</h2><form class="stack" id="builder">'+body+error+actions((draft.step>1?'<button type="button" data-back>Назад</button>':'')+'<button class="primary">'+(draft.step<5?'Продолжить':demo?'Создать тестовый заказ':'Отправить заказ')+'</button>')+'</form></div>');
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
async function getOrders(){return demo?demoOrders():rpc('my_orders');}
const orderLabel=o=>'Заказ № '+o.id.slice(0,8).toUpperCase();
function statusLabel(o){return '<span class="tag">'+esc(o.status)+'</span>';}
function ordersPage(orders){
  return panel('Мои заказы','<div class="stack">'+(demo?'<p>Здесь отображаются тестовые заказы из этого браузера.</p>':'<p>Заказы доступны в браузере, в котором вы их оформили.</p>')+(orders.length?orders.map(o=>'<article class="card stack"><h2>'+orderLabel(o)+'</h2><p>'+statusLabel(o)+'</p><p>'+esc(o.fabric_name)+' · '+date(o.created_at)+'</p>'+summary(o.items||[])+(o.final_price!=null?'<p>Согласованная цена: '+rub(o.final_price)+'</p>':o.estimate!=null?'<p>Предварительная стоимость: '+rub(o.estimate)+'</p>':'')+(o.due?'<p>Срок готовности: '+esc(o.due)+'</p>':'')+actions(href('#/chat/'+o.id,'Открыть чат')+'<button data-repeat="'+o.id+'">Повторить заказ</button>')+'</article>').join(''):'<p>У вас пока нет заказов.</p>'+href('#/build','Собрать свой комплект','primary'))+'</div>');
}
function infoPage(kind){
  if(kind==='install')return panel('Установить приложение','<div class="panel stack"><h2>На Android</h2><p>Откройте сайт в Chrome. Нажмите меню ⋮ и выберите «Установить приложение» или «Добавить на главный экран».</p><h2>На iPhone</h2><p>Откройте сайт в Safari. Нажмите «Поделиться», затем «На экран Домой» и «Добавить».</p><p>Для отдельного значка кабинета на Android откройте <a href="'+ownerEntry+'">кабинет владельца</a> в Chrome и установите его через то же меню. В рабочем режиме понадобится вход.</p><p>Каталог и отправка заказов в рабочем режиме требуют интернета.</p></div>');
  return panel('Конфиденциальность','<div class="panel stack"><p>Имя и контакт используют, чтобы уточнить размеры, согласовать цену и передать заказ. В переписке можно прикреплять фото, связанные с заказом.</p><p>Доступ к заказу получают мастерская и браузер, из которого вы отправили заказ. В демонстрации данные заказов хранятся в этом браузере. Вводите только вымышленные имя и контакт.</p><p>В рабочей версии запросить исправление или удаление данных можно в переписке по заказу.</p>'+href('#/chat','Открыть чат')+'</div>');
}
async function submitOrder(form){
  syncBuilder(form);
  const f=fabrics.find(f=>f.id===draft.fabric&&f.available);
  if(!f||!f.colors.includes(draft.color)||!draft.items.length)throw new Error('Проверьте ткань, расцветку и комплектацию.');
  const payload={fabric_id:f.id,color:draft.color,items:draft.items,comment:draft.comment,nonce:draft.nonce,
    customer:checkout.customer.trim(),contact:checkout.contact.trim(),delivery:checkout.delivery,delivery_note:checkout.delivery_note,consent:!!checkout.consent};
  if(!payload.customer||payload.contact.length<5)throw new Error('Укажите имя и способ связи.');
  if(demo){
    let price=null;try{price=calculate(draft.items,f,rules).price;}catch{}
    const samples=demoOrders();
    if(!samples.some(o=>o.nonce===payload.nonce))write('qu-demo-orders',[{...payload,id:crypto.randomUUID(),created_at:new Date().toISOString(),fabric_name:f.name,status:statuses[0],estimate:price,paid:0,history:[]},...samples]);
  }else await rpc('place_order',{p:payload},true);
  saveCheckout({});draft=blank();saveDraft();notice(demo?'Тестовый заказ сохранён в этом браузере.':'Заказ принят. Статус доступен в разделе «Мои заказы».');go('#/orders');
}
const ownerSections=[
 ['orders','Заказы','Новые и текущие заказы','orders'],
 ['fabrics','Мои ткани','Фотографии и остатки','fabrics'],
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
const allFabrics=()=>demo?Promise.resolve(load('qu-demo-fabrics',sample)):table('fabrics','?order=name');
function login(){return panel('Кабинет владельца',demo?'<div class="panel stack"><p>В демонстрационном кабинете можно управлять тестовыми заказами и тканями в этом браузере.</p><button class="primary" data-demo-owner>Открыть демонстрационный кабинет</button></div>':'<form id="login" class="panel stack">'+field('Электронная почта','email','','required autocomplete="username"','email')+field('Пароль','password','','required autocomplete="current-password"','password')+error+'<button class="primary">Войти</button></form>');}
function dashboard(orders){
  const active=orders.filter(o=>o.status!=='Отменён');
  const received=active.reduce((sum,o)=>sum+Number(o.paid||0),0);
  return ownerPage('Здравствуйте, мастер!', '<dl class="owner-overview"><div><dt>Новые заказы</dt><dd>'+active.filter(o=>o.status===statuses[0]).length+'</dd></div><div><dt>Получено по заказам</dt><dd>'+rub(received)+'</dd></div></dl>'+href('#/owner/order/new','Создать заказ','primary')+'<div class="owner-sections">'+ownerSections.map(([id,name,desc,glyph])=>'<a class="card owner-tile" href="#/owner/'+id+'" aria-label="Открыть раздел «'+name+'»">'+icon(glyph)+'<div><h2>'+name+'</h2><p>'+desc+'</p></div></a>').join('')+'</div>');
}
function ownerOrderList(orders,section='orders'){
  if(section==='messages')return ownerPage('Сообщения',demo?'<p>Рабочий чат появится после подключения базы. Тестовые сообщения не отправляются.</p>':'<div class="stack">'+(orders.map(o=>'<div class="panel">'+href('#/owner/chat/'+o.id,esc(o.customer)+' · '+orderLabel(o))+' '+(o.customer_unread?'<span class="tag">Новые сообщения</span>':'')+'</div>').join('')||'<p>Переписок пока нет.</p>')+'</div>');
  return ownerPage('Заказы',actions(href('#/owner/order/new','Создать заказ','primary')+href('#/owner/clients','Клиенты')+'<button data-csv="orders">Экспорт CSV</button>')+'<form id="order-filters" class="row three">'+field('Имя или номер заказа','q','','','search')+select('Статус','status',['Все статусы',...statuses])+check('Показать архив','archived')+'</form><div id="owner-orders" class="stack"></div>');
}
function fillOwnerOrders(form,orders){
 const {q,status,archived}=Object.fromEntries(new FormData(form));
 $('#owner-orders').innerHTML=orders.filter(o=>!!o.archived===!!archived&&(status==='Все статусы'||o.status===status)&&[o.id,o.customer].join(' ').toLowerCase().includes(q.trim().toLowerCase())).map(o=>'<article class="panel order-row"><div><h3>'+esc(o.customer)+'</h3><p class="order-meta"><span>'+orderLabel(o)+'</span><span>'+date(o.created_at)+'</span>'+statusLabel(o)+'</p></div>'+href('#/owner/order/'+o.id,'Открыть заказ','quiet')+'</article>').join('')||'<p>Заказы не найдены.</p>';
}
function ownerOrderForm(o,list){
 const isNew=!o.id;
 const selected=o.fabric_id||list[0]?.id;
 return ownerPage(isNew?'Создать заказ':orderLabel(o),'<form class="panel stack" id="owner-order" data-id="'+(o.id||'')+'">'+field('Имя','customer',o.customer,'required maxlength="80"')+field('Контакт','contact',o.contact,'required minlength="5" maxlength="120"')+select('Получение','delivery',['Самовывоз','Доставка по согласованию'],o.delivery)+area('Комментарий к получению','delivery_note',o.delivery_note,500)+'<label>Ткань<select name="fabric_id" required>'+list.map(f=>'<option value="'+esc(f.id)+'" '+(f.id===selected?'selected':'')+'>'+esc(f.name)+'</option>').join('')+'</select></label>'+field('Расцветка','color',o.color,'maxlength="80"')+area('Пожелания','comment',o.comment)+types.map(t=>'<details '+(o.items?.some(i=>i.type===t)?'open':'')+'><summary>'+products[t].name+'</summary>'+check('Добавить изделие','include_'+t,o.items?.some(i=>i.type===t))+dimensions(o.items?.find(i=>i.type===t)||firstItem(t))+'</details>').join('')+
 '<div class="row">'+select('Статус','status',statuses,o.status)+field('Срок готовности','due',o.due,'','date')+
 field('Согласованная цена, ₽','final_price',o.final_price,'min="0" max="10000000"','number')+nField('Получено оплат, ₽','paid',o.paid||0,0,10000000)+field('Расход ткани вручную, м','meters',o.meters,'min="0" max="5000" step="0.1"','number')+field('Себестоимость вручную, ₽','cost',o.cost,'min="0" max="10000000"','number')+'</div>'+
 (!isNew?'<p>Предварительная цена: '+(o.estimate==null?'уточняется':rub(o.estimate))+' · Остаток: '+(o.final_price==null?'уточняется':rub(Math.max(0,o.final_price-o.paid)))+'</p>':'')+
 area('Заметки владельца','notes',o.notes)+check('В архиве','archived',o.archived)+error+actions('<button class="primary">Сохранить заказ</button>'+(!isNew?href('#/owner/chat/'+o.id,'Переписка'):'')+(!isNew?'<button type="button" data-delete-order="'+o.id+'">Удалить заказ и данные</button>':''))+'</form>'+
 (!isNew?'<details class="panel"><summary>История изменений</summary>'+((o.history||[]).map(h=>'<p>'+date(h.at)+' · '+esc(h.status)+' · '+(h.final_price==null?'без согласованной цены':rub(h.final_price))+' · получено '+rub(h.paid||0)+'</p>').reverse().join('')||'<p>Изменений пока нет.</p>')+'</details>':''));
}
function fabricAdmin(list){
 return ownerPage('Мои ткани',actions(href('#/owner/fabric/new','Добавить ткань','primary')+href('#/owner/rules','Настройки расчёта'))+'<div class="grid">'+(list.map(f=>'<article class="card media"><img class="admin-image" src="'+esc(photo(f))+'" alt="'+esc(f.name)+'" loading="lazy"><div class="card-body"><h3>'+esc(f.name)+'</h3><p>'+f.stock+' м · '+rub(f.rate)+' за м</p><p>'+(f.hidden?'Скрыта из каталога':f.available?'В наличии':'Нет в наличии')+'</p>'+href('#/owner/fabric/'+f.id,'Редактировать')+'</div></article>').join('')||'<p>Добавьте первую ткань.</p>')+'</div>');
}
function fabricForm(f){
 return ownerPage(f.id?'Редактировать ткань':'Добавить ткань','<form class="panel stack" id="fabric-edit" data-id="'+(f.id||'')+'">'+field('Название','name',f.name,'required maxlength="100"')+field('Материал','material',f.material,'required maxlength="80"')+field('Состав','composition',f.composition,'required maxlength="100"')+area('Описание и свойства','description',f.description)+field('Расцветки через запятую','colors',f.colors?.join(', '),'required maxlength="500"')+'<div class="row three">'+nField('Ширина рулона, см','width',f.width||220,50,400)+nField('Цена за метр, ₽','rate',f.rate||0,0,100000)+nField('Остаток, м','stock',f.stock||0,0,100000,0.1)+'</div>'+check('У рисунка есть направление','direction',f.direction)+check('В наличии','available',f.available??true)+check('Скрыть из каталога','hidden',f.hidden)+(f.id?'<img src="'+esc(photo(f))+'" width="160" alt="Текущая фотография">':'')+'<label>Фото с камеры или из галереи<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label>'+error+actions('<button class="primary">Сохранить ткань</button>')+'</form>');
}
const ruleFields={seam:['Припуск на сторону, см',0,20],shrink:['Усадка, %',0,30],elastic:['Резинка на изделие, ₽',0,100000],zipper:['Молния на изделие, ₽',0,100000],packaging:['Упаковка, ₽',0,100000],extra:['Дополнительные расходы, ₽',0,100000],markup:['Наценка, %',0,500],discount:['Скидка, %',0,100]};
function rulesForm(){return ownerPage('Настройки расчёта','<form id="rules" class="panel stack"><p>Тестовая формула. Подтвердите нормы раскроя и цены мастерской.</p><div class="row">'+Object.entries(ruleFields).map(([k,[name,min,max]])=>nField(name,k,rules[k],min,max,0.1)).join('')+types.map(k=>nField('Пошив: '+products[k].name+', ₽','labor_'+k,rules.labor[k],0,100000)).join('')+'</div>'+error+'<button class="primary">Сохранить настройки</button></form>');}
function clientsPage(orders){
 const groups=Object.groupBy?Object.groupBy(orders,o=>o.contact.trim().toLowerCase()):orders.reduce((a,o)=>{(a[o.contact.trim().toLowerCase()]??=[]).push(o);return a;},Object.create(null));
 return ownerPage('Клиенты',Object.values(groups).map(group=>'<details class="panel"><summary>'+esc(group[0].customer)+' · '+group.length+' заказов</summary><p>'+esc(group[0].contact)+'</p>'+group.map(o=>summary(o.items)+href('#/owner/order/'+o.id,'Открыть '+orderLabel(o))+(o.notes?'<p>'+esc(o.notes)+'</p>':'')).join('')+'</details>').join('')||'<p>Клиенты появятся после оформления первого заказа.</p>');
}
const periods={'Сегодня':1,'Неделя':7,'Месяц':30,'Год':365};
function statsCalc(orders,period){
 const start=new Date();start.setHours(0,0,0,0);start.setDate(start.getDate()-periods[period]+1);
 const eligible=orders.filter(o=>new Date(o.created_at)>=start&&o.status!=='Отменён');
 const sales=eligible.filter(o=>o.final_price!=null);
 const sum=(rows,prop)=>rows.reduce((s,o)=>s+Number(o[prop]||0),0);
 const revenue=sum(sales,'final_price'),paid=sum(eligible,'paid'),cost=sum(sales,'cost');
 const expenses=sum(sales,'extra_cost');
 const labels={'Согласованная выручка':revenue,'Полученные оплаты по заказам периода':paid,'Неоплаченные остатки':sales.reduce((sum,o)=>sum+Math.max(0,o.final_price-o.paid),0),'Себестоимость с расходами':cost,'Дополнительные расходы в себестоимости':expenses,'Расчётная прибыль':revenue-cost,'Количество заказов':eligible.length,'Средний чек':sales.length?revenue/sales.length:0,'Постоянные клиенты':new Set(eligible.filter(o=>orders.filter(a=>a.contact===o.contact&&a.status==='Завершён').length>1).map(o=>o.contact)).size};
 const popular=Object.entries(eligible.reduce((acc,o)=>{acc[o.fabric_name]=(acc[o.fabric_name]||0)+1;return acc;},Object.create(null))).sort((a,b)=>b[1]-a[1]);
 return {labels,popular};
}
function statsFill(orders,period){
 const {labels,popular}=statsCalc(orders,period);
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
 if(!f||!items.length||!values.customer.trim()||values.contact.trim().length<5)throw new Error('Укажите имя, контакт, ткань и хотя бы одно изделие.');
 if(values.archived&&!['Завершён','Отменён'].includes(values.status))throw new Error('В архив можно перенести завершённый или отменённый заказ.');
 if(values.status==='Отменён'&&old?.status!==values.status&&!confirm('Отменить этот заказ?'))return;
 let calc={};try{calc=calculate(items,f,rules);}catch{}
 const num=(value,fallback=null)=>value===''?fallback:Number(value);
 const o={fabric_id:f.id,fabric_name:f.name,color:values.color||f.colors[0],items,customer:values.customer.trim(),contact:values.contact.trim(),delivery:values.delivery,delivery_note:values.delivery_note,comment:values.comment,status:values.status,due:values.due||null,final_price:num(values.final_price),paid:Number(values.paid),meters:num(values.meters,calc.meters??null),cost:num(values.cost,calc.cost??null),estimate:old?.estimate??calc.price??null,extra_cost:old?.extra_cost??rules.extra,notes:values.notes,archived:!!values.archived};
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
 const f={id,name:v.name.trim(),material:v.material.trim(),composition:v.composition.trim(),description:v.description,colors,width:Number(v.width),rate:Number(v.rate),stock:Number(v.stock),direction:!!v.direction,available:!!v.available,hidden:!!v.hidden,photo:path};
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
 route=location.hash.replace(/^#\/?/,'');frame();
 const main=$('#content'),[area,sub,id]=route.split('/');
 const current=()=>turn===epoch;
 try{
   if(!area||area==='fabrics'||area==='build'||area==='orders'){
     fabrics=demo?load('qu-demo-fabrics',sample).filter(f=>!f.hidden):await rpc('catalog');
     if(demo)rules=load('qu-demo-rules',defaultRules);
   }
   if(!current())return;
   let html;
   if(!area)html=home();
   else if(area==='fabrics')html=catalog();
   else if(area==='build')html=builder();
   else if(area==='orders'){dataOrders=await getOrders();html=ordersPage(dataOrders);}
   else if(area==='chat')html=await chatPage(sub,false,demo?[]:await getOrders());
   else if(['install','privacy'].includes(area))html=infoPage(area);
   else if(area==='owner'){
     owner=demo?sessionStorage.getItem('qu-demo-owner')==='1':auth()&&!auth().user?.is_anonymous?await rpc('owner_status'):false;
     if(!owner)html=login();
     else {
       if(['fabrics','fabric','order'].includes(sub))dataFabrics=await allFabrics();
       if(!['fabrics','fabric','rules'].includes(sub))dataOrders=await allOrders();
       if(['order','rules'].includes(sub))rules=demo?load('qu-demo-rules',defaultRules):(await table('settings','?id=eq.1'))[0]?.rules||defaultRules;
       const selected=dataOrders.find(o=>o.id===id);
       if(!sub)html=dashboard(dataOrders);
       else if(['orders','messages'].includes(sub))html=ownerOrderList(dataOrders,sub);
       else if(sub==='clients')html=clientsPage(dataOrders);
       else if(sub==='order')html=id==='new'||selected?ownerOrderForm(selected||{},dataFabrics):ownerPage('Заказ не найден','');
       else if(sub==='fabrics')html=fabricAdmin(dataFabrics);
       else if(sub==='fabric'){const f=dataFabrics.find(f=>f.id===id);html=id==='new'||f?fabricForm(f||{}):ownerPage('Ткань не найдена','');}
       else if(sub==='rules')html=rulesForm();
       else if(sub==='stats')html=ownerPage('Статистика','<form class="row" id="stats">'+select('Период','period',Object.keys(periods))+'<button type="button" data-csv="stats">Экспорт CSV</button></form><p class="muted">Период определяется по дате оформления заказа. Суммы оплаты отражают текущее состояние заказов.</p><div class="stack" id="stats-result"></div>');
       else if(sub==='chat')html=await chatPage(id,true,dataOrders);
     }
   }
   if(!current())return;
   main.innerHTML=html||panel('Страница не найдена',href('#/','На главную'));
   if(focus)main.focus({preventScroll:true});
   if($('#owner-orders'))fillOwnerOrders($('#order-filters'),dataOrders);
   if($('#stats-result'))statsFill(dataOrders,$('#stats [name=period]').value);
   if($('#chat-form'))watchChat($('#chat-form').dataset.id);
   if(!demo&&$('#estimate')){
     const text=await rpc('estimate_order',{p:{fabric_id:draft.fabric,color:draft.color,items:draft.items}}).then(price=>estimateText(()=>price),e=>estimateText(()=>{throw e;}));
     if(current()&&$('#estimate'))$('#estimate').innerHTML=text;
   }
 }catch(e){if(current())main.innerHTML=panel('Не удалось загрузить страницу','<p class="error" role="alert">'+esc(e.message)+'</p><button data-retry>Попробовать снова</button>');}
}
document.addEventListener('input',e=>{
 const form=e.target.form;
 if(!form)return;
 if(form.id==='filters')applyFilters(form);
 if(form.id==='order-filters')fillOwnerOrders(form,dataOrders);
 if(form.id==='stats')statsFill(dataOrders,e.target.value);
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
   if(b.dataset.choose){draft.fabric=b.dataset.choose;draft.color=fabrics.find(f=>f.id===draft.fabric).colors[0];draft.step=1;saveDraft();go('#/build');}
   if(b.dataset.photo){const f=fabrics.find(f=>f.id===b.dataset.photo);const img=$('#lightbox img');img.src=photo(f);img.alt=f.name;$('#lightbox').showModal();}
   if('back' in b.dataset){syncBuilder($('#builder'));draft.step--;saveDraft();render();}
   if('full' in b.dataset){draft.items=['sheet','duvet','pillow'].map(t=>draft.items.find(i=>i.type===t)||firstItem(t));saveDraft();render();}
   if('retry' in b.dataset)render();
   if('demoOwner' in b.dataset){sessionStorage.setItem('qu-demo-owner','1');render();}
   if('logout' in b.dataset){if(demo)sessionStorage.removeItem('qu-demo-owner');else await signOut();go('#/owner');}
   if(b.dataset.repeat){const o=dataOrders.find(o=>o.id===b.dataset.repeat);draft={...blank(),fabric:o.fabric_id,color:o.color,items:o.items,comment:o.comment};saveDraft();go('#/build');}
   if(b.dataset.deleteOrder&&confirm('Удалить заказ, переписку и данные без возможности восстановления?')){
     if(demo)write('qu-demo-orders',demoOrders().filter(o=>o.id!==b.dataset.deleteOrder));else {await eraseOrderPhotos(b.dataset.deleteOrder);await rpc('delete_order',{oid:b.dataset.deleteOrder});}
     notice('Заказ удалён.');go('#/owner/orders');
   }
   if(b.dataset.csv==='orders')csv([['Номер','Дата','Имя','Контакт','Статус','Цена','Получено'],...dataOrders.map(o=>[o.id,o.created_at,o.customer,o.contact,o.status,o.final_price,o.paid])],'Заказы');
   if(b.dataset.csv==='stats')csv([['Показатель','Значение'],...Object.entries(statsCalc(dataOrders,$('#stats [name=period]').value).labels)],'Статистика');
 }catch(e){notice(e.message);}
});
document.addEventListener('submit',async e=>{
 const form=e.target;
 if(!form.id)return;
 e.preventDefault();
 if(['filters','order-filters','stats'].includes(form.id))return;
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
