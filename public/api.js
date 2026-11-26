import {config} from './config.js';
export const demo=!(config.url && config.key);
const base=config.url.replace(/\/$/,'');
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}};
export const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
export const load=read;
const scope=()=>location.hash.startsWith('#/owner')?'owner':'buyer';
const sessionKey=kind=>'qu-auth-'+kind;
export const auth=()=>read(sessionKey(scope()),null);
const refreshes=new Map();
async function request(path,options={},token=config.key) {
  let res;
  try {res=await fetch(base+path,{...options,cache:'no-store',headers:{apikey:config.key,...(token&&token!==config.key?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',...options.headers}});}
  catch {throw new Error('Нет связи с сервером. Проверьте интернет и повторите попытку.');}
  const data=await res.json().catch(()=>null);
  if(!res.ok) throw new Error(data?.code==='P0001'?data.message:res.status===429?'Слишком много запросов. Попробуйте позже.':res.status===401||res.status===403?'Доступ закрыт. Проверьте данные для входа.':'Сервер не смог выполнить запрос. Попробуйте ещё раз.');
  return data;
}
function saveSession(data,kind) {
  const session={...data,until:Date.now()+data.expires_in*1000};
  write(sessionKey(kind),session);
  return session;
}
export async function signIn(email,password) {
  return saveSession(await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})}),'owner');
}
export async function token(customer=false) {
  const kind=scope(), session=auth();
  if(session && session.until>Date.now()+30000) return session.access_token;
  if(!session&&!customer)return config.key;
  if(!refreshes.has(kind)){
    const pending=(session
      ?request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})})
      :request('/auth/v1/signup',{method:'POST',body:'{}'}))
      .then(data=>saveSession(data,kind).access_token)
      .finally(()=>refreshes.delete(kind));
    refreshes.set(kind,pending);
  }
  return refreshes.get(kind);
}
export async function signOut(){
  const session=auth();
  if(session) await request('/auth/v1/logout?scope=local',{method:'POST'},session.access_token).catch(()=>{});
  localStorage.removeItem(sessionKey(scope()));
}
export async function rpc(name,data={},customer=false){
  return request('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(data)},await token(customer));
}
export async function table(name,params='',method='GET',data){
  return request('/rest/v1/'+name+params,{method,body:data===undefined?undefined:JSON.stringify(data),headers:{Prefer:'return=representation'}},await token());
}
export async function upload(bucket,path,file){
  await request('/storage/v1/object/'+bucket+'/'+path,{method:'POST',body:file,headers:{'Content-Type':file.type}},await token());
  return path;
}
export const publicPhoto=path=>base+'/storage/v1/object/public/fabrics/'+path;
export async function signedPhoto(path){
  const result=await request('/storage/v1/object/sign/chat/'+path,{method:'POST',body:JSON.stringify({expiresIn:300})},await token());
  return base+(result.signedURL.startsWith('/storage/v1/')?'':'/storage/v1')+result.signedURL;
}
export async function subscribeMessages(id,refresh){
 const access=await token();
 const url=new URL(base+'/realtime/v1/websocket');url.protocol=url.protocol==='https:'?'wss:':'ws:';
 url.searchParams.set('apikey',config.key);url.searchParams.set('vsn','1.0.0');
 const ws=new WebSocket(url);
 const topic='realtime:order-'+id;
 ws.addEventListener('open',()=>ws.send(JSON.stringify({topic,event:'phx_join',payload:{config:{broadcast:{ack:false,self:false},presence:{key:''},postgres_changes:[{event:'INSERT',schema:'public',table:'messages',filter:'order_id=eq.'+id}]},access_token:access},ref:'1'})));
 ws.addEventListener('message',event=>{try{if(JSON.parse(event.data).event==='postgres_changes')refresh();}catch{}});
 let ref=1;
 const heartbeat=setInterval(()=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:String(++ref)}));},24000);
 return ()=>{clearInterval(heartbeat);ws.close();};
}
export async function eraseOrderPhotos(id){
  const access=await token();
  const list=()=>request('/storage/v1/object/list/chat',{method:'POST',body:JSON.stringify({prefix:id,limit:100,offset:0})},access);
  for(let batch=await list();batch.length;batch=await list()){
    await request('/storage/v1/object/chat',{method:'DELETE',body:JSON.stringify({prefixes:batch.map(file=>id+'/'+file.name)})},access);
  }
}
