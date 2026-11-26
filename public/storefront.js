import {products} from './calc.js';

export const deliveryMethods=['Самовывоз','Местная доставка','СДЭК','Почта России'];
export const defaults={
  home:{
    eyebrow:'Семейная мастерская',
    title:'Уют, сшитый специально для вас',
    description:'Шьём постельное бельё по вашим размерам и из выбранной вами ткани.',
    hero:'./img/hero.webp',heroAlt:'Постельное бельё шалфейного цвета в мягком утреннем свете',
    logo:'./img/sun.svg'
  },
  promo:{title:'',text:'',enabled:false},
  notice:{title:'',text:'',enabled:false},
  contact:{telegram:'',vk:'',phone:'',description:'',delivery:''}
};

export function contactUrls(contact={}){
  const handle=value=>String(value||'').trim().replace(/^@/,'');
  const telegram=handle(contact.telegram);
  const vk=handle(contact.vk);
  const raw=String(contact.phone||'').trim();
  const phone=/^[+0-9 ()-]{5,30}$/.test(raw)?raw.replace(/[^+0-9]/g,''):'';
  return {
    telegram:/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(telegram)?'https://t.me/'+telegram:'',
    vk:/^[a-zA-Z0-9_.-]{2,64}$/.test(vk)?'https://vk.me/'+vk:'',
    phone:/^\+?[0-9]{5,16}$/.test(phone)?'tel:'+phone:''
  };
}
export function itemDescription(item){
  return [products[item.type]?.name||'Изделие',item.w+' × '+item.l+' см',
    item.type==='fitted'?'матрас '+item.h+' см':'',item.qty+' шт.',
    ['pillow','duvet'].includes(item.type)?item.closure:''].filter(Boolean).join(', ');
}
export function messageText(cart,delivery,format){
  const list=cart.flatMap((row,index)=>[
    (index+1)+'. '+row.name,
    [row.material,row.color].filter(Boolean).join(' · '),
    ...row.details,
    row.comment?'Пожелания: '+row.comment:'',
    row.price==null?'Стоимость уточнит мастер':'Предварительно: '+format(row.price)
  ].filter(Boolean).concat(''));
  const known=cart.every(row=>row.price!=null);
  return ['Здравствуйте! Хочу уточнить возможность пошива в мастерской «Тихое утро».','',
    ...list,'Получение: '+delivery,
    known?'Предварительная стоимость всего: '+format(cart.reduce((sum,row)=>sum+row.price,0)):'Окончательную стоимость уточнит мастер.'
  ].join('\n');
}
