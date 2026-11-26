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
  await click('link','Посмотреть каталог');
  await page.getByLabel('Поиск по названию или цвету').fill('Сатин «Шалфей»');
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
  await click('link','Открыть раздел «Мой ассортимент»');
  await heading('Мой ассортимент');
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
  await checkAssortment();
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
      assert.ok(await role('link','Собрать свой комплект').evaluate(el=>el.offsetHeight)>=48,label+' · высота кнопки');
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

async function checkAssortment(){
  const to=slug=>new URL('catalog/'+slug+'/',base).href;
  const slugs=['postelnoe-belie','polotentsa','detskoe-postelnoe-belie'];
  for(const [label,mode] of [['Обычный','normal'],['Увеличенный','large']]){
    await chooseTextSize(label);
    for(const width of widths){
      await page.setViewportSize({width,height:800});
      for(const slug of slugs){
        const response=await page.goto(to(slug));
        assert.equal(response.status(),200);
        await page.locator('.category-intro').waitFor();
        await assertTextSize(mode);
        await checkGeometry(slug+' '+mode+' '+width);
        await checkImages(slug+' '+width);
        assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://aurones.github.io/TIHOE-UTRO/catalog/'+slug+'/');
        assert.match(await page.locator('meta[name=robots]').getAttribute('content'),/noindex/);
        await page.screenshot({path:'artifacts/category-'+slug+'-'+mode+'-'+width+'.jpg',type:'jpeg',quality:82,fullPage:true,animations:'disabled'});
      }
    }
  }
  await page.setViewportSize({width:390,height:844});
  await click('link','Собрать детский комплект');
  await heading('Собрать детский комплект');
  await page.locator('#builder select[name=fabric]').selectOption('child-cotton');
  await page.locator('#builder select[name=color]').selectOption('Шалфейный с веточками');
  await click('button','Продолжить');
  await page.getByRole('checkbox',{name:'Простыня на резинке'}).check();
  await click('button','Продолжить');
  assert.equal(await page.getByLabel('Длина, см').inputValue(),'120');
  await page.locator('[name=preset]').selectOption('70 × 140');
  assert.equal(await page.getByLabel('Длина, см').inputValue(),'140');
  await click('button','Продолжить');
  await page.getByLabel('Пожелания к пошиву').fill('Детский комплект');
  await click('button','Продолжить');
  await finishTestOrder();
  await page.getByText('Детское постельное бельё',{exact:true}).waitFor();
  await page.goto(to('polotentsa'));
  await click('link','Выбрать «Полотенце по вашим размерам»');
  await heading('Полотенце по вашим размерам');
  await checkGeometry('Форма полотенца');
  await page.locator('#product-order select[name=size]').selectOption('Свой размер');
  await page.getByLabel('Ширина, см').fill('55');
  await page.getByLabel('Длина, см').fill('85');
  await page.getByLabel('Количество',{exact:true}).fill('2');
  await click('button','Проверить стоимость');
  await page.getByText('Предварительная стоимость. Мастер подтвердит её после проверки.').waitFor();
  await finishTestOrder();
  await page.getByText(/55 × 85 см.*2 шт/).waitFor();
  await page.goto(to('polotentsa'));
  await click('link','Выбрать «Набор из трёх полотенец»');
  await click('button','Проверить стоимость');
  await page.getByText('Фиксированная стоимость',{exact:true}).waitFor();
  await finishTestOrder();
  await page.getByText(/Фиксированная цена/).waitFor();
  await page.goto(ownerUrl);
  await heading('Здравствуйте, мастер!');
  await click('link','Открыть раздел «Мой ассортимент»');
  await click('link','Добавить категорию');
  await page.getByLabel('Название',{exact:true}).fill('Текстиль для кухни');
  await page.getByLabel('Часть адреса латиницей').fill('kuhnya');
  await page.getByLabel('Описание',{exact:true}).fill('Тестовая категория для кухни.');
  await page.getByLabel('Порядок показа').fill('1');
  await page.getByText('Стандартные размеры для пошива белья',{exact:true}).click();
  await page.getByLabel('Простыня',{exact:true}).fill('70 × 130');
  await click('button','Сохранить категорию');
  await heading('Мой ассортимент');
  assert.equal(await page.locator('.order-row h3').first().textContent(),'Текстиль для кухни');
  await click('link','Добавить товар');
  await heading('Добавить товар');
  await checkGeometry('Форма товара');
  await page.getByLabel('Название',{exact:true}).fill('Кухонное полотенце');
  await page.locator('#product-edit select[name=category_slug]').selectOption('kuhnya');
  await page.getByLabel('Материал',{exact:true}).fill('Хлопок');
  await page.getByLabel('Размеры, по одному варианту на строку').fill('30 x 50');
  await page.getByLabel('Расцветки через запятую').fill('Льняной');
  await page.getByLabel('Цена за товар или пошив одной детали, ₽').fill('450');
  await page.locator('#product-edit input[type=file]').setInputFiles('public/img/category-towels.webp');
  await click('button','Сохранить товар');
  await heading('Мой ассортимент');
  await page.getByRole('heading',{name:'Кухонное полотенце'}).waitFor();
  await page.goto(new URL('?category=kuhnya',base).href);
  await page.locator('.category-intro').waitFor();
  await heading('Кухонное полотенце');
  await page.goto(ownerUrl);
  await heading('Здравствуйте, мастер!');
  await click('link','Открыть раздел «Мой ассортимент»');
  const row=page.locator('.order-row').filter({has:role('heading','Текстиль для кухни')});
  await row.getByRole('link',{name:'Редактировать категорию'}).click();
  await page.getByRole('checkbox',{name:'Архивировать категорию'}).check();
  await click('button','Сохранить категорию');
  await heading('Мой ассортимент');
  await page.getByText('Порядок 1 · В архиве').waitFor();
  await page.goto(new URL('?category=kuhnya',base).href);
  await heading('Категория недоступна');
  const robots=await (await page.request.get(new URL('robots.txt',base).href)).text();
  assert.match(robots,/Disallow: \/\n/);
  const sitemap=await (await page.request.get(new URL('sitemap.xml',base).href)).text();
  assert.ok(!sitemap.includes('<url>'));
}
async function finishTestOrder(){
  await page.getByLabel('Имя',{exact:true}).fill('Тестовый покупатель');
  await page.getByLabel('Телефон или другой способ связи').fill('test@example.invalid');
  await page.getByRole('checkbox',{name:'Согласен на обработку данных для оформления заказа'}).check();
  await click('button','Создать тестовый заказ');
  await heading('Мои заказы');
}
