import assert from 'node:assert/strict';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';

const fixturePath='/tmp/tihoe-live-browser.json';
const {email,password,url,key}=JSON.parse(await readFile(fixturePath,'utf8'));
assert.match(url,/^http:\/\/127\.0\.0\.1:/,'Use only disposable local data');
const configPath='public/config.js';
const previous=await readFile(configPath,'utf8');
const serverPort='3008';
const base='http://127.0.0.1:'+serverPort+'/';
let server,browser;
try{
  await writeFile(configPath,'export const config='+JSON.stringify({mode:'live',url,key})+';');
  server=spawn(process.execPath,['scripts/dev.mjs','--port',serverPort],{stdio:'ignore'});
  let serving=false;
  for(let attempt=0;attempt<45;attempt++){
    if(server.exitCode!==null)break;
    if(await fetch(base).then(r=>r.ok,()=>false)){serving=true;break;}
    await delay(300);
  }
  assert.ok(serving,'Could not start the storefront against local Supabase.');
  browser=await chromium.launch();
  const guestContext=await browser.newContext({serviceWorkers:'block'});
  const ownerContext=await browser.newContext({serviceWorkers:'block'});
  const guest=await guestContext.newPage(),owner=await ownerContext.newPage();
  await guest.goto(base);
  await guest.getByRole('heading',{name:'Опубликованный заголовок'}).waitFor();
  await guest.waitForFunction(()=>{const image=document.querySelector('.hero-image');return image?.naturalWidth>0&&image.src.includes('/object/sign/');});
  assert.deepEqual(await guest.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes('auth')||k.includes('owner'))),[]);

  await owner.goto(new URL('?mode=owner#/owner',base).href);
  await owner.getByLabel('Электронная почта').fill(email);
  await owner.getByLabel('Пароль').fill(password);
  await owner.getByRole('button',{name:'Войти',exact:true}).click();
  await owner.getByRole('link',{name:'Открыть раздел «Главная страница»'}).click();
  const title='Синхронизированный заголовок';
  await owner.getByLabel('Главный заголовок').fill(title);
  await owner.route('**/rpc/save_storefront_draft',route=>route.abort('failed'));
  await owner.getByRole('button',{name:'Сохранить черновик'}).click();
  await owner.getByText('Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.',{exact:true}).waitFor();
  assert.equal(await owner.getByLabel('Главный заголовок').inputValue(),title);
  await owner.unroute('**/rpc/save_storefront_draft');
  await owner.getByRole('button',{name:'Сохранить черновик'}).click();
  await owner.getByRole('link',{name:'Предварительный просмотр'}).click();
  assert.equal(await owner.locator('.draft-preview h1').innerText(),title);
  await guest.reload();
  await guest.getByRole('heading',{name:'Опубликованный заголовок'}).waitFor();
  await owner.getByRole('link',{name:'Редактор',exact:true}).click();
  await owner.getByRole('button',{name:'Сохранить и опубликовать'}).click();
  await owner.getByText('Все сохранённые изменения опубликованы.').waitFor();
  await guest.reload();
  await guest.getByRole('heading',{name:title}).waitFor();
  console.log('Live browser: separate sessions, private draft, signed image, safe retry after a network error and cross-session publication.');
}finally{
  await browser?.close();
  server?.kill();
  await writeFile(configPath,previous);
  await rm(fixturePath,{force:true});
}
