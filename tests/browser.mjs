import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const base=process.env.TEST_URL||'http://127.0.0.1:3000/';
const ownerUrl=new URL('?mode=owner#/owner',base).href;
const browser=await chromium.launch();
const context=await browser.newContext({locale:'ru-RU',permissions:['clipboard-read','clipboard-write']});
const page=await context.newPage();
const errors=[];
let callsOutsideSite=0;
context.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).origin!==new URL(base).origin)callsOutsideSite++;});
page.on('pageerror',err=>errors.push(err.message));
const role=(type,name)=>page.getByRole(type,{name,exact:true});
const click=(type,name)=>role(type,name).click();
const heading=name=>role('heading',name).waitFor();
const widths=[320,360,390,412,768,1440];
await mkdir('artifacts',{recursive:true});
try{
  await page.goto(base);
  for(const mode of ['Обычный','Увеличенный']){
    const disclosure=page.locator('.display-settings');
    if(await disclosure.getAttribute('open')===null)await disclosure.locator('summary').click();
    await role('radio',mode).check();
    for(const width of widths){
      await page.setViewportSize({width,height:800});
      await page.goto(base);
      await page.locator('.hero-image').waitFor();
      await checkGeometryAndImages(mode+' '+width);
      await page.screenshot({path:'artifacts/1.3-home-'+mode+'-'+width+'.jpg',type:'jpeg',quality:80,fullPage:true});
    }
  }

  await page.setViewportSize({width:390,height:844});
  await click('link','Посмотреть каталог');
  await heading('Каталог');
  await page.getByLabel('Поиск по названию или цвету').fill('Сатин «Шалфей»');
  await click('button','Выбрать ткань');
  await heading('Собрать свой комплект');
  await click('button','Продолжить');
  await click('button','Выбрать полный комплект');
  await click('button','Продолжить');
  await page.getByLabel('Ширина, см').first().fill('155');
  await click('button','Продолжить');
  await page.getByLabel('Пожелания к пошиву').fill('Плотная окантовка');
  await page.reload();
  assert.equal(await page.getByLabel('Пожелания к пошиву').inputValue(),'Плотная окантовка');
  await click('button','Продолжить');
  await click('button','Добавить в корзину');
  await heading('Корзина');
  assert.match(await page.locator('#cart-message').inputValue(),/155 × 220 см[\s\S]*Плотная окантовка[\s\S]*Предварительная стоимость всего/);
  await page.locator('[name=delivery]').selectOption('СДЭК');
  await click('button','Скопировать текст');
  const copied=await page.evaluate(()=>navigator.clipboard.readText());
  assert.match(copied,/Получение: СДЭК/);
  await page.reload();
  assert.equal(await page.locator('[name=delivery]').inputValue(),'СДЭК');
  assert.equal(await page.locator('#cart-message').inputValue(),copied);
  assert.equal(await page.locator('#content input').count(),0);

  await page.goto(new URL('catalog/detskoe-postelnoe-belie/',base).href);
  await click('link','Собрать детский комплект');
  await page.locator('#builder select[name=fabric]').selectOption('child-cotton');
  await page.locator('#builder select[name=color]').selectOption('Шалфейный с веточками');
  await click('button','Продолжить');
  await role('checkbox','Простыня на резинке').check();
  await click('button','Продолжить');
  await page.locator('[name=preset]').selectOption('70 × 140');
  await click('button','Продолжить');
  await click('button','Продолжить');
  await click('button','Добавить в корзину');
  await heading('Корзина');
  assert.match(await page.locator('#cart-message').inputValue(),/Детское постельное бельё[\s\S]*70 × 140 см/);

  await page.goto(new URL('catalog/polotentsa/',base).href);
  await page.getByText('Продажа готовых изделий приостановлена').first().waitFor();
  assert.equal(await role('link','Выбрать «Банное полотенце»').count(),0);
  await page.goto(new URL('#/product/demo-towel-fixed',base).href);
  await heading('Товар недоступен');
  await page.goto(new URL('catalog/polotentsa/',base).href);
  await click('link','Выбрать «Полотенце по вашим размерам»');
  await page.locator('#product-order select[name=size]').selectOption('Свой размер');
  await page.getByLabel('Ширина, см').fill('55');
  await page.getByLabel('Длина, см').fill('85');
  await click('button','Проверить стоимость');
  await click('button','Добавить в корзину');
  await heading('Корзина');
  assert.match(await page.locator('#cart-message').inputValue(),/55 × 85 см/);
  await role('button','Убрать из корзины: Полотенце по вашим размерам').click();
  assert.doesNotMatch(await page.locator('#cart-message').inputValue(),/55 × 85 см/);
  await checkGeometryAndImages('Корзина');
  await page.screenshot({path:'artifacts/1.3-cart.jpg',type:'jpeg',quality:85,fullPage:true});

  await page.goto(ownerUrl);
  await heading('Кабинет владельца');
  const manifest=await page.locator('link[rel=manifest]').getAttribute('href');
  const parsed=await (await page.request.get(new URL(manifest,base).href)).json();
  assert.equal(new URL(parsed.start_url,base).href,ownerUrl);
  await click('button','Открыть демонстрационный редактор');
  await heading('Редактор витрины');
  await click('link','Открыть раздел «Главная страница»');
  await page.getByLabel('Главный заголовок').fill('Текстиль для тихих дней');
  await page.locator('#home-edit input[name=hero]').setInputFiles('public/img/category-bedding.webp');
  await page.locator('#home-edit input[name=logo]').setInputFiles('public/img/category-towels.webp');
  await click('button','Сохранить черновик');
  await click('link','Открыть раздел «Акции и объявления»');
  const notice=page.getByRole('group',{name:'Объявление'});
  await notice.getByLabel('Заголовок').fill('Принимаем заявки на пошив');
  await notice.getByLabel('Текст').fill('Подробности можно уточнить у мастера.');
  await notice.getByLabel('Показывать на главной').check();
  await click('button','Сохранить черновик');
  await click('link','Открыть раздел «Контакты и доставка»');
  await page.getByLabel('Имя пользователя Telegram').fill('@atelier_example');
  await page.getByLabel('Имя или ID страницы ВКонтакте').fill('atelier-example');
  await page.getByLabel('Телефон мастерской').fill('+7 000 000 00 00');
  await page.getByLabel('Условия получения и доставки').fill('Дату самовывоза согласуйте с мастерской.');
  await click('button','Сохранить черновик');
  await click('link','Предварительный просмотр');
  await heading('Предварительный просмотр');
  await page.locator('.draft-preview h1').waitFor();
  assert.equal(await page.locator('.draft-preview h1').innerText(),'Текстиль для тихих дней');
  const uploaded=await page.locator('.draft-preview .hero-image').getAttribute('src');
  assert.match(uploaded,/^data:image\/jpeg;base64,/);
  assert.ok(uploaded.length<200000);
  const guest=await context.newPage();
  await guest.goto(base);
  await guest.locator('.hero h1').waitFor();
  assert.equal(await guest.locator('.hero h1').innerText(),'Уют, сшитый специально для вас');
  await click('link','Редактор');
  await click('button','Сохранить и опубликовать');
  await page.getByText('Все сохранённые изменения опубликованы.').waitFor();
  await guest.reload();
  await guest.getByRole('heading',{name:'Текстиль для тихих дней'}).waitFor();
  await guest.getByRole('heading',{name:'Принимаем заявки на пошив'}).waitFor();
  await guest.goto(new URL('#/cart',base).href);
  const tg=await guest.getByRole('link',{name:'Telegram',exact:true}).getAttribute('href');
  assert.match(decodeURIComponent(tg),/t\.me\/atelier_example\?text=.*Здравствуйте/s);
  assert.equal(await guest.getByRole('link',{name:'Позвонить'}).getAttribute('href'),'tel:+70000000000');
  await guest.getByRole('button',{name:'Скопировать и открыть ВКонтакте'}).waitFor();
  await page.screenshot({path:'artifacts/1.3-editor.jpg',type:'jpeg',quality:85,fullPage:true});

  assert.match(await guest.locator('meta[name=robots]').getAttribute('content'),/noindex/);
  await guest.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  await context.setOffline(true);
  await guest.reload();
  await guest.getByRole('heading',{name:'Корзина'}).waitFor();
  assert.match(await guest.locator('#cart-message').inputValue(),/Получение: СДЭК/);
  await context.setOffline(false);
  assert.equal(callsOutsideSite,0,'Demo must not call TatNet or external services.');
  assert.deepEqual(errors,[]);
  console.log('Storefront: responsive layouts, three builders, disabled ready-made purchase, basket, copy, contacts, draft, publication, image compression and offline.');
}catch(error){
  await page.screenshot({path:'artifacts/failure.png',fullPage:true}).catch(()=>{});
  console.error(page.url(),await page.locator('h1').allTextContents(),await page.locator('.error:visible').allTextContents());
  throw error;
}finally{await browser.close();}

async function checkGeometryAndImages(label){
 const {width,scroll}=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.equal(scroll,width,label);
 await page.evaluate(()=>{for(const img of document.querySelectorAll('img[src]'))img.loading='eager';});
 await page.waitForFunction(()=>[...document.querySelectorAll('img[src]')].every(img=>img.complete&&img.naturalWidth>0&&!img.dataset.fallback));
}
