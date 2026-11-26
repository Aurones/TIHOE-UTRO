export const defaultCategory = 'postelnoe-belie';
export const categories = [
  {slug:defaultCategory,kind:'adult',name:'Постельное бельё',description:'Постельное бельё на заказ по вашим размерам. Комплекты и отдельные изделия для дома.',image:'./img/category-bedding.webp',position:10},
  {slug:'polotentsa',kind:'towel',name:'Полотенца',description:'Мягкие полотенца для рук, лица и ванной. Выберите готовое изделие или соберите набор.',image:'./img/category-towels.webp',position:20},
  {slug:'detskoe-postelnoe-belie',kind:'child',name:'Детское постельное бельё',description:'Бельё для детской кроватки. Подберите рисунок и соберите комплект по размеру матраса.',image:'./img/category-child.webp',position:30}
];

export const childSizes = {
  sheet:[[60,120],[70,140],[80,160]], fitted:[[60,120],[70,140],[80,160]],
  duvet:[[100,135],[110,140],[120,150]], pillow:[[40,60],[35,45],[50,70]]
};

const towel = {category_slug:'polotentsa',material:'Хлопковая махра',colors:['Молочный','Шалфейный'],available:true,image:'./img/category-towels.webp',sample:true};
export const demoProducts = [
  {...towel,id:'demo-towel-fixed',name:'Банное полотенце',description:'Готовое полотенце для ванной.',sizes:['70 × 140'],pricing:'fixed',price:990},
  {...towel,id:'demo-towel-custom',name:'Полотенце по вашим размерам',description:'Полотенце для рук, лица или ванной в одном размере.',sizes:['30 × 50','50 × 90','70 × 140'],pricing:'custom',fabric_id:'terry',custom_size:true,price:180},
  {...towel,id:'demo-towel-set',name:'Набор из трёх полотенец',description:'Полотенца для рук, лица и ванной в одной расцветке.',sizes:['30 × 50; 50 × 90; 70 × 140'],pricing:'fixed',price:1790}
];

export const demoFabrics = [
  {id:'child-cotton',name:'Поплин «Лесные веточки»',material:'Поплин',composition:'100% хлопок',description:'Мягкий хлопок с мелким растительным рисунком.',colors:['Пудровый с веточками','Шалфейный с веточками'],available:true,width:240,rate:560,stock:20,direction:true,photo:'./img/category-child.webp',category_slug:'detskoe-postelnoe-belie'},
  {id:'terry',name:'Хлопковая махра',material:'Махра',composition:'100% хлопок',description:'Впитывающая ткань с мягким ворсом.',colors:['Молочный','Шалфейный'],available:true,width:180,rate:480,stock:20,direction:true,photo:'./img/category-towels.webp',category_slug:'polotentsa'}
];

export const publicCategoryPath=(slug,cleanSlugs=categories.map(c=>c.slug))=>cleanSlugs.includes(slug)
  ?'./catalog/'+slug+'/' : './?category='+encodeURIComponent(slug);
export const sortCategories=list=>[...list].sort((a,b)=>a.position-b.position||a.name.localeCompare(b.name,'ru'));
export const matchesCategory=(fabric,slug)=>!fabric.category_slug||fabric.category_slug===slug;
export const sizePattern=/^(?:[1-9]\d{1,2} × [1-9]\d{1,2})(?:; [1-9]\d{1,2} × [1-9]\d{1,2}){0,3}$/;
