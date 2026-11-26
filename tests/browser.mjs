import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const base=process.env.TEST_URL||'http://127.0.0.1:3000/';
const ownerUrl=new URL('?mode=owner#/owner',base).href;
const widths=[320,360,390,412,768,1440];
const browser=await chromium.launch();
const context=await browser.newContext({locale:'ru-RU'});
const page=await context.newPage();
const errors=[];
page.on('pageerror',err=>errors.push(err.message));
const role=(type,name)=>page.getByRole(type,{name,exact:true});
const click=(type,name)=>role(type,name).click();
const heading=name=>role('heading',name).waitFor();
await mkdir('artifacts',{recursive:true});
try {
  await page.goto(base);
  const defaultSize=await assertTextSize('normal');
  await checkLayouts('normal');
  await chooseTextSize('Увеличенный');
  const largeSize=await assertTextSize('large');
  assert.ok(largeSize>defaultSize,'Увеличенный режим меняет размер текста');
  await checkLayouts('large');
  await chooseTextSize('Обычный');
  await assertTextSize('normal');
  await page.setViewportSize({width:390,height:844});
  await click('link','Посмотреть ткани');
  await page.getByLabel('Поиск по названию или цвету').fill('шалфей');
  assert.equal(await page.locator('#catalog-results article').count(),1);
  await click('button','Увеличить фото Сатин «Шалфей»');
  await page.getByRole('dialog').waitFor();
  await click('button','Закрыть');
  await click('button','Выбрать ткань');
  await click('button','Продолжить');
  await click('button','Выбрать полный комплект');
  await click('button','Продолжить');
  await page.getByLabel('Ширина, см').first().fill('155');
  await click('button','Продолжить');
  await page.getByLabel('Пожелания к пошиву').fill('Тестовый заказ');
  await page.reload();
  assert.equal(await page.getByLabel('Пожелания к пошиву').inputValue(),'Тестовый заказ');
  await click('button','Назад');
  assert.equal(await page.getByLabel('Ширина, см').first().inputValue(),'155');
  await click('button','Продолжить');
  await click('button','Продолжить');
  await heading('Проверка и оформление');
  await page.getByLabel('Имя',{exact:true}).fill('Тестовый покупатель');
  await page.getByLabel('Телефон или другой способ связи').fill('test@example.invalid');
  await page.reload();
  assert.equal(await page.getByLabel('Телефон или другой способ связи').inputValue(),'test@example.invalid');
  await page.getByLabel('Согласен на обработку данных для оформления заказа').check();
  await click('button','Создать тестовый заказ');
  await heading('Мои заказы');
  await page.getByText('155 × 220 см',{exact:false}).waitFor();
  await click('link','Открыть чат');
  await page.getByText('Демонстрационный режим. Отправка сообщений доступна после подключения сервера.').waitFor();
  await click('link','Кабинет владельца');
  assert.equal(page.url(),ownerUrl);
  await heading('Кабинет владельца');
  const manifest=await page.locator('link[rel=manifest]').getAttribute('href');
  const ownerManifest=await (await page.request.get(new URL(manifest,base).href)).json();
  const shopManifest=await (await page.request.get(new URL('manifest.webmanifest',base).href)).json();
  assert.equal(new URL(ownerManifest.start_url,base).href,ownerUrl);
  assert.notEqual(ownerManifest.id,shopManifest.id);
  await click('button','Открыть демонстрационный кабинет');
  await heading('Здравствуйте, мастер!');
  await checkOwnerLayouts('normal');
  await chooseTextSize('Увеличенный');
  await checkOwnerLayouts('large');
  await page.setViewportSize({width:390,height:844});
  await click('link','Открыть раздел «Заказы»');
  await click('link','Открыть заказ');
  await page.locator('#owner-order select[name=status]').selectOption('Цена согласована');
  await page.getByLabel('Согласованная цена, ₽').fill('4200');
  await page.getByLabel('Получено оплат, ₽').fill('1500');
  await click('button','Сохранить заказ');
  await click('link','Статистика');
  await heading('Статистика');
  assert.match(await page.locator('#stats-result').innerText(),/2\s?700/);
  await checkGeometry('Статистика владельца');
  await click('link','Кабинет владельца');
  await role('heading','Здравствуйте, мастер!').waitFor();
  await click('link','Открыть раздел «Мои ткани»');
  await heading('Мои ткани');
  await page.getByRole('link',{name:'Редактировать',exact:true}).first().click();
  await heading('Редактировать ткань');
  await checkGeometry('Форма ткани');
  await page.getByRole('link',{name:'Сообщения',exact:true}).click();
  await heading('Сообщения');
  await page.getByText('Рабочий чат появится после подключения базы.',{exact:false}).waitFor();
  await page.goto(base);
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  await context.setOffline(true);
  await page.reload();
  await heading('Уют, сшитый специально для вас');
  await page.goto(ownerUrl);
  await heading('Здравствуйте, мастер!');
  await context.setOffline(false);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(base);
  assert.equal(await page.locator('.hero').evaluate(el=>getComputedStyle(el.parentElement).animationName),'none');
  assert.deepEqual(errors,[]);
  console.log('Playwright Chromium: шесть ширин в обоих режимах; фотографии, каталог, конструктор, сохранение, заказ, кабинет, статистика, манифесты, офлайн PWA и сниженное движение.');
}catch(error){
  await page.screenshot({path:'artifacts/failure.png',fullPage:true}).catch(()=>{});
  console.error('Страница сбоя:',page.url(),await page.locator('h1').allTextContents());
  const reported=await page.locator('.error:visible').allTextContents();
  if(reported.length)console.error('Сообщения интерфейса:',reported);
  throw error;
}finally{await browser.close();}

async function chooseTextSize(label){
  const disclosure=page.locator('.display-settings');
  if(await disclosure.getAttribute('open')===null)await disclosure.locator('summary').click();
  await page.getByRole('radio',{name:label,exact:true}).check();
}
async function assertTextSize(mode){
  assert.equal(await page.locator('html').getAttribute('data-text-size'),mode);
  return page.locator('body').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
}
async function checkGeometry(label){
  const {width,scroll,clipped}=await page.evaluate(()=>{
    const clipped=[...document.querySelectorAll('h1,h2,h3,button,.button,.nav a,.owner-nav a,.owner-tile,summary')]
      .filter(el=>el.getClientRects().length&&(el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1))
      .filter(el=>!el.classList.contains('image-btn'))
      .map(el=>el.textContent.trim());
    return {width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,clipped};
  });
  assert.equal(scroll,width,label+' · горизонтальная прокрутка');
  assert.deepEqual(clipped,[],label+' · обрезанный текст');
}
async function checkImages(label){
  await page.evaluate(()=>{for(const img of document.querySelectorAll('img[src]'))img.loading='eager';});
  await page.waitForFunction(()=>[...document.querySelectorAll('img[src]')].every(img=>img.complete));
  const broken=await page.evaluate(()=>[...document.querySelectorAll('img[src]')]
    .filter(img=>!img.naturalWidth||img.dataset.fallback).map(img=>img.getAttribute('src')));
  assert.deepEqual(broken,[],label+' · изображения');
}
async function checkLayouts(mode){
  for(const width of widths){
    await page.setViewportSize({width,height:width===320?640:800});
    await page.goto(base);
    await heading('Уют, сшитый специально для вас');
    await assertTextSize(mode);
    const label='Главная '+mode+' '+width;
    await checkGeometry(label);
    await checkImages(label);
    if(mode==='normal'&&width<=412){
      const heroImage=await page.locator('.hero-image').boundingBox();
      const title=await role('heading','Уют, сшитый специально для вас').boundingBox();
      const primary=await role('link','Собрать свой комплект').boundingBox();
      const nav=await page.locator('.nav').boundingBox();
      assert.ok(heroImage.y+heroImage.height<=title.y,label+' · фотография перед заголовком');
      assert.ok(primary.y+primary.height<=nav.y,label+' · основное действие над навигацией');
      assert.ok(primary.height>=48,label+' · высота кнопки');
    }
    await page.screenshot({path:'artifacts/home-'+mode+'-'+width+'.jpg',type:'jpeg',quality:82,fullPage:true,animations:'disabled'});
  }
}
async function checkOwnerLayouts(mode){
  for(const width of widths){
    await page.setViewportSize({width,height:800});
    await assertTextSize(mode);
    await checkGeometry('Кабинет '+mode+' '+width);
    await page.screenshot({path:'artifacts/owner-'+mode+'-'+width+'.jpg',type:'jpeg',quality:82,fullPage:true,animations:'disabled'});
  }
}
