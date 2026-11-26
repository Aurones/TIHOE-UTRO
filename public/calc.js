export const products = {
  sheet: {name:'Простыня', sizes:[[150,220],[180,220],[220,240]]},
  fitted: {name:'Простыня на резинке',sizes:[[90,200],[140,200],[160,200],[180,200]]},
  duvet: {name:'Пододеяльник',sizes:[[145,215],[175,215],[200,220]]},
  pillow: {name:'Наволочка',sizes:[[50,70],[70,70]]}
};
export const defaultRules = {
  seam:2, shrink:5, labor:{sheet:450,fitted:650,duvet:950,pillow:240},
  elastic:160, zipper:120, packaging:120, extra:0, markup:25, discount:0
};
export function calculate(items,fabric,r=defaultRules) {
  const pieces=[];
  let labor=0, hardware=0;
  for(const item of items) {
    const {type,w,l,h=0,qty,closure}=item;
    if(!Object.hasOwn(products,type) || ![w,l].every(n=>Number.isInteger(n)&&n>=20&&n<=400)
      || !Number.isInteger(qty)||qty<1||qty>12 || (type==='fitted'&& (!Number.isInteger(h)||h<5||h>60))) throw new Error('Проверьте размеры и количество изделий.');
    const depth=type==='fitted'?2*(h+8):0;
    const flap=type==='pillow'&&closure==='Клапан'?20:0;
    const factor=1/(1-r.shrink/100);
    for(let i=0;i<qty;i++) {
      pieces.push([(w+depth+2*r.seam)*factor,(l+depth+2*r.seam)*factor]);
      if(type==='duvet'||type==='pillow') pieces.push([(w+2*r.seam)*factor,(l+flap+2*r.seam)*factor]);
    }
    labor+=qty*r.labor[type];
    hardware+=qty*(type==='fitted'?r.elastic:closure==='Молния'?r.zipper:0);
  }
  const oriented=pieces.map(([width,length])=>{
    if(!fabric.direction && length<=fabric.width && (width>fabric.width || width<length)) return [length,width];
    if(width>fabric.width) throw new Error('Деталь не помещается по ширине рулона. Выберите другую ткань или обсудите раскрой с мастером.');
    return [width,length];
  }).sort((a,b)=>b[1]-a[1]);
  const rows=[];
  for(const [width,length] of oriented) {
    const row=rows.find(row=>row.width+width<=fabric.width && row.length>=length);
    if(row) row.width+=width;
    else rows.push({width,length});
  }
  const meters=Math.ceil(rows.reduce((sum,row)=>sum+row.length,0)/10)/10;
  const cost=Math.round(meters*fabric.rate+labor+hardware+r.packaging+r.extra);
  return {meters,cost,price:Math.round(cost*(1+r.markup/100)*(1-r.discount/100))};
}
