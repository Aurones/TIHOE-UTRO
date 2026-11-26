import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculate,defaultRules} from '../public/calc.js';

const rules={...defaultRules,seam:0,shrink:0,markup:0,discount:0,packaging:0};
const fabric={rate:100,width:120,direction:true};
const one=(type,w,l,qty=1,extra={})=>({type,w,l,qty,h:20,closure:'Без застёжки',...extra});

test('pairs two panels across the roll without counting the same length twice',()=>{
 assert.equal(calculate([one('duvet',60,100)],fabric,rules).meters,1);
 assert.equal(calculate([one('duvet',61,100)],fabric,rules).meters,2);
});
test('rotation is forbidden for directional prints',()=>{
 const item=[one('sheet',130,75)];
 assert.throws(()=>calculate(item,fabric,rules),/ширине/);
 assert.equal(calculate(item,{...fabric,direction:false},rules).meters,1.3);
});
test('fitted sheet accounts for mattress depth and elastic',()=>{
 assert.deepEqual(calculate([one('fitted',60,90)],fabric,rules),{meters:1.5,cost:960,price:960});
 assert.throws(()=>calculate([one('fitted',60,90,1,{h:30})],fabric,rules),/ширине/);
});
test('allowances and shrinkage can prevent side-by-side placement',()=>{
 assert.equal(calculate([one('pillow',60,100)],fabric,{...rules,seam:2,shrink:5}).meters,2.2);
});
test('settings apply overhead, hardware, markup and discount',()=>{
 const result=calculate([one('pillow',50,70,1,{closure:'Молния'})],fabric,{...rules,packaging:100,extra:20,markup:25,discount:10});
 assert.deepEqual(result,{meters:.7,cost:550,price:619});
});
test('invalid custom dimensions and quantities fail validation',()=>{
 assert.throws(()=>calculate([one('sheet',14,50)],fabric,rules),/размеры/);
 assert.throws(()=>calculate([one('sheet',50,50,0)],fabric,rules),/количество/);
});
