import {config} from './config.js';

export const demo=config.mode!=='live';
const base=config.url.replace(/\/$/,'');
const authKey='qu-storefront-owner';
export function load(key,fallback){
  try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}
}
export const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
export const auth=()=>load(authKey,null);
let refresh;
async function request(path,{method='GET',body,access,type='application/json'}={}){
  if(demo)throw new Error('В деморежиме изменения доступны только в этом браузере.');
  let response;
  try{
    response=await fetch(base+path,{method,body,cache:'no-store',headers:{
      apikey:config.key,'Content-Type':type,...(access?{Authorization:'Bearer '+access}:{})
    }});
  }catch{throw new Error('Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.');}
  const result=await response.json().catch(()=>null);
  if(!response.ok){
    const known=result?.code==='P0001'&&result.message;
    throw new Error(known||(
      response.status===401||response.status===403?'Доступ закрыт. Проверьте данные для входа.':
      response.status===429?'Слишком много запросов. Попробуйте чуть позже.':
      'Сервер не смог выполнить запрос. Проверьте настройку базы или попробуйте ещё раз.'));
  }
  return result;
}
function storeSession(session){
  const value={...session,until:Date.now()+session.expires_in*1000};
  write(authKey,value);
  return value.access_token;
}
export async function signIn(email,password){
  return storeSession(await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})}));
}
async function ownerToken(){
  const session=auth();
  if(!session)throw new Error('Войдите в кабинет владельца.');
  if(session.until>Date.now()+30000)return session.access_token;
  if(!refresh)refresh=request('/auth/v1/token?grant_type=refresh_token',{
    method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})
  }).then(storeSession).finally(()=>{refresh=null;});
  return refresh;
}
export async function signOut(){
  const access=auth()?.access_token;
  if(access)await request('/auth/v1/logout?scope=local',{method:'POST',access}).catch(()=>{});
  localStorage.removeItem(authKey);
}
export async function rpc(name,data={},owner=false){
  return request('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(data),access:owner?await ownerToken():undefined});
}
export async function uploadPhoto(path,blob){
  await request('/storage/v1/object/site-media/'+path,{method:'POST',body:blob,type:blob.type,access:await ownerToken()});
  return path;
}
export async function signPhotos(paths,owner=false){
  if(!paths.length)return {};
  const response=await request('/storage/v1/object/sign/site-media',{method:'POST',
    body:JSON.stringify({paths,expiresIn:600}),access:owner?await ownerToken():undefined});
  return Object.fromEntries(response.filter(image=>image.signedURL).map(image=>[
    image.path,base+(image.signedURL.startsWith('/storage/v1/')?'':'/storage/v1')+image.signedURL
  ]));
}
