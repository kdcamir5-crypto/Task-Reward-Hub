/* Dedicated Cloudflare Worker. Secrets belong in Worker settings, never in this file. */
export const PROJECT='reward-hub-bd';
const ORIGIN='https://kdcamir5-crypto.github.io',encoder=new TextEncoder();
export class AuthError extends Error{constructor(code,status=401){super(code);this.code=code;this.status=status;}}
const fail=(code,status)=>{throw new AuthError(code,status);};
export function base64url(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
function bytes(s){try{return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}catch(_){fail('INVALID_TOKEN');}}
function jsonPart(s){try{return JSON.parse(new TextDecoder().decode(bytes(s)));}catch(_){fail('INVALID_TOKEN');}}
async function hmac(key,message){const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);return crypto.subtle.sign('HMAC',k,encoder.encode(message));}
export async function verifyTelegram(raw,botToken,now=Math.floor(Date.now()/1000)){
 if(typeof raw!=='string'||!raw||raw.length>16384)fail('INVALID_TELEGRAM');
 const params=new URLSearchParams(raw),seen=new Set();for(const [key]of params){if(seen.has(key))fail('INVALID_TELEGRAM');seen.add(key);}
 const hash=params.get('hash');if(!/^[a-fA-F0-9]{64}$/.test(hash||''))fail('INVALID_TELEGRAM');
 const check=[...params].filter(([key])=>key!=='hash').sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,v])=>key+'='+v).join('\n');
 const secret=await hmac(encoder.encode('WebAppData'),botToken),key=await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const signature=Uint8Array.from(hash.match(/../g),h=>parseInt(h,16));
 if(!await crypto.subtle.verify('HMAC',key,signature,encoder.encode(check)))fail('INVALID_TELEGRAM');
 const issued=Number(params.get('auth_date'));if(!Number.isInteger(issued)||issued<=0||issued>now+30||now-issued>600)fail('TELEGRAM_EXPIRED');
 let user;try{user=JSON.parse(params.get('user'));}catch(_){fail('INVALID_TELEGRAM');}
 if(!user||!Number.isSafeInteger(user.id)||user.id<=0||user.is_bot===true)fail('INVALID_TELEGRAM');
 return {id:String(user.id)}; // Usernames, unsafe initData and client-supplied UIDs are never identity proof.
}
let keyCache=null,oauthCache=null,jwkCache=null;
export function serviceAccount(env){
 let sa;try{sa=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT||'');}catch(_){fail('SETUP_REQUIRED',503);}
 if(sa.project_id!==PROJECT||typeof sa.client_email!=='string'||!sa.client_email.endsWith('.iam.gserviceaccount.com')||typeof sa.private_key!=='string'||!sa.private_key.includes('BEGIN PRIVATE KEY'))fail('SETUP_REQUIRED',503);
 return sa;
}
export async function signJwt(sa,payload){
 const pem=sa.private_key.replace(/\\n/g,'\n');
 if(!keyCache||keyCache.pem!==pem){const der=bytes(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,''));keyCache={pem,key:await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign'])};}
 const input=base64url(encoder.encode(JSON.stringify({alg:'RS256',typ:'JWT'})))+'.'+base64url(encoder.encode(JSON.stringify(payload)));
 return input+'.'+base64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keyCache.key,encoder.encode(input)));
}
export async function customToken(sa,uid,now=Math.floor(Date.now()/1000)){
 if(typeof uid!=='string'||!uid.length||uid.length>128)fail('IDENTITY_CONFLICT',409);
 return signJwt(sa,{iss:sa.client_email,sub:sa.client_email,aud:'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',iat:now,exp:now+300,uid});
}
async function requestJson(url,options={},fetcher=fetch){
 const response=await fetcher(url,{...options,signal:AbortSignal.timeout(15000)});let data;try{data=await response.json();}catch(_){fail('UPSTREAM_UNAVAILABLE',503);}
 if(!response.ok){const error=new AuthError('UPSTREAM_UNAVAILABLE',503);error.upstream=data.error?.status||'';error.httpStatus=response.status;throw error;}return data;
}
async function oauth(sa,fetcher=fetch){
 const now=Math.floor(Date.now()/1000);if(oauthCache?.email===sa.client_email&&oauthCache.key===sa.private_key&&oauthCache.expires>now+60)return oauthCache.token;
 const assertion=await signJwt(sa,{iss:sa.client_email,scope:'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const d=await requestJson('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}).toString()},fetcher);
 if(typeof d.access_token!=='string')fail('SETUP_REQUIRED',503);oauthCache={email:sa.client_email,key:sa.private_key,token:d.access_token,expires:now+Math.min(Number(d.expires_in)||3600,3600)};return d.access_token;
}
function value(v){if('stringValue'in v)return v.stringValue;if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('booleanValue'in v)return v.booleanValue;if('timestampValue'in v)return v.timestampValue;return null;}
export class IdentityStore{
 constructor(project,authorize,fetcher=fetch,base='https://firestore.googleapis.com/v1'){this.root=base+'/projects/'+project+'/databases/(default)/documents';this.authorize=authorize;this.fetcher=fetcher;}
 async call(suffix,body,method='POST'){
  try{return await requestJson(this.root+suffix,{method,headers:{Authorization:'Bearer '+await this.authorize(),'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})},this.fetcher);}catch(e){if(e.httpStatus===404&&method==='GET')return null;throw e;}
 }
 async get(path,transaction){const d=await this.call('/'+path+(transaction?'?transaction='+encodeURIComponent(transaction):''),null,'GET');return d?Object.fromEntries(Object.entries(d.fields||{}).map(([k,v])=>[k,value(v)])):null;}
 async read(paths,transaction){
  const name=this.root.replace(/^https?:\/\/[^/]+\/v1\//,'');
  const documents=paths.map(p=>name+'/'+p),responses=await this.call(':batchGet',{documents,transaction});
  if(!Array.isArray(responses))fail('UPSTREAM_UNAVAILABLE',503);
  return documents.map(n=>{const found=responses.find(r=>r.found?.name===n)?.found;return found?Object.fromEntries(Object.entries(found.fields||{}).map(([k,v])=>[k,value(v)])):null;});
 }
 async linkedUid(id){const identity=await this.get('telegramIdentities/'+id);if(!identity)fail('TELEGRAM_NOT_LINKED',409);const uid=identity.uid;if(typeof uid!=='string'||!uid.length||uid.length>128)fail('IDENTITY_CONFLICT',409);const p=await this.get('users/'+encodeURIComponent(uid));if(!p||p.telegramUserId!==id||identity.telegramUserId!==id)fail('IDENTITY_CONFLICT',409);return uid;}
 async link(uid,id){
  for(let attempt=0;attempt<4;attempt++){
   const begun=await this.call(':beginTransaction',{options:{readWrite:{}}}),transaction=begun.transaction;let committed=false;
   try{
    const [identity,p]=await this.read(['telegramIdentities/'+id,'users/'+uid],transaction);
    if(!p)fail('PROFILE_MISSING',409);
    if((identity&&identity.uid!==uid)||(p.telegramUserId&&p.telegramUserId!==id))fail('IDENTITY_CONFLICT',409);
    if(identity&&identity.telegramUserId!==id)fail('IDENTITY_CONFLICT',409);
    if(identity&&p.telegramUserId===id)return;
    const name=this.root.replace('https://firestore.googleapis.com/v1/','').replace(/^https?:\/\/[^/]+\/v1\//,'');
    const idPath='telegramIdentities/'+id,userPath='users/'+uid;
    const writes=[{update:{name:name+'/'+idPath,fields:{uid:{stringValue:uid},telegramUserId:{stringValue:id}}},updateMask:{fieldPaths:['uid','telegramUserId']},currentDocument:identity?{exists:true}:{exists:false},updateTransforms:[{fieldPath:'linkedAt',setToServerValue:'REQUEST_TIME'}]},
      {update:{name:name+'/'+userPath,fields:{telegramUserId:{stringValue:id}}},updateMask:{fieldPaths:['telegramUserId']},currentDocument:{exists:true},updateTransforms:[{fieldPath:'telegramLinkedAt',setToServerValue:'REQUEST_TIME'}]}];
    await this.call(':commit',{transaction,writes});committed=true;return;
   }catch(e){if(attempt===3||!['ABORTED','FAILED_PRECONDITION','ALREADY_EXISTS'].includes(e.upstream))throw e;}
   finally{if(!committed)try{await this.call(':rollback',{transaction});}catch(_){/* No tokens or profile data are logged. */}}
  }
 }
}
export async function checkAccount(uid,accessToken,fetcher=fetch){
 const data=await requestJson('https://identitytoolkit.googleapis.com/v1/projects/'+PROJECT+'/accounts:lookup',{method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify({localId:[uid]})},fetcher);
 const account=data.users?.find(u=>u.localId===uid);if(!account||account.disabled)fail('ACCOUNT_UNAVAILABLE',403);return account;
}
export async function verifyFirebase(token,fetcher=fetch,now=Math.floor(Date.now()/1000)){
 if(typeof token!=='string'||token.length>8192)fail('INVALID_TOKEN');const parts=token.split('.');if(parts.length!==3)fail('INVALID_TOKEN');
 const header=jsonPart(parts[0]),claims=jsonPart(parts[1]);
 if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>200||claims.aud!==PROJECT||claims.iss!=='https://securetoken.google.com/'+PROJECT||typeof claims.sub!=='string'||!claims.sub.length||claims.sub.length>128||!Number.isInteger(claims.exp)||claims.exp<=now||!Number.isInteger(claims.iat)||claims.iat>now+30||!Number.isInteger(claims.auth_time)||claims.auth_time>now+30)fail('INVALID_TOKEN');
 if(!jwkCache||jwkCache.expires<now||!jwkCache.keys.some(k=>k.kid===header.kid)){
  const d=await requestJson('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',{},fetcher);jwkCache={keys:d.keys||[],expires:now+3600};
 }
 const jwk=jwkCache.keys.find(k=>k.kid===header.kid);if(!jwk)fail('INVALID_TOKEN');
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(parts[2]),encoder.encode(parts[0]+'.'+parts[1])))fail('INVALID_TOKEN');
 return claims;
}
async function bodyJson(request){
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))fail('INVALID_REQUEST',400);
 const reader=request.body?.getReader();if(!reader)fail('INVALID_REQUEST',400);let size=0,chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>32768){await reader.cancel();fail('INVALID_REQUEST',413);}chunks.push(value);}
 const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(data));}catch(_){fail('INVALID_REQUEST',400);}
}
export function createHandler(dependencies={}){return async(request,env)=>{
 const origin=request.headers.get('Origin'),url=new URL(request.url),headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',Vary:'Origin'};
 if(origin===ORIGIN){headers['Access-Control-Allow-Origin']=ORIGIN;headers['Access-Control-Allow-Headers']='Content-Type, Authorization';headers['Access-Control-Allow-Methods']='POST, GET, OPTIONS';}
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(request.method==='GET'&&url.pathname==='/health'){let configured=true;try{serviceAccount(env);if(!/^\d+:[A-Za-z0-9_-]+$/.test(env.TELEGRAM_BOT_TOKEN||''))configured=false;}catch(_){configured=false;}return reply({ok:true,service:'telegram-auth',configured,version:1});}
 if(origin!==ORIGIN)return reply({ok:false,code:'ORIGIN_DENIED'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST'||!['/login','/link'].includes(url.pathname))return reply({ok:false,code:'NOT_FOUND'},404);
 try{
  const sa=serviceAccount(env);if(!/^\d+:[A-Za-z0-9_-]+$/.test(env.TELEGRAM_BOT_TOKEN||''))fail('SETUP_REQUIRED',503);
  const body=await bodyJson(request);if(!body||typeof body!=='object'||Array.isArray(body))fail('INVALID_REQUEST',400);
  const telegram=await verifyTelegram(body.initData,env.TELEGRAM_BOT_TOKEN);
  const fetcher=dependencies.fetcher||fetch,access=dependencies.accessToken||(()=>oauth(sa,fetcher));
  const store=dependencies.store||new IdentityStore(PROJECT,access,fetcher);
  if(url.pathname==='/link'){
   const bearer=request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
   const claims=await (dependencies.verifyFirebase||verifyFirebase)(bearer,fetcher);
   const account=await (dependencies.checkAccount||checkAccount)(claims.sub,await access(),fetcher),now=Math.floor(Date.now()/1000);
   if(claims.auth_time<Number(account.validSince||0))fail('INVALID_TOKEN');
   if(now-claims.auth_time>600)fail('RECENT_LOGIN_REQUIRED',401);
   await store.link(claims.sub,telegram.id);return reply({ok:true,linked:true});
  }
  const uid=await store.linkedUid(telegram.id);
  await (dependencies.checkAccount||checkAccount)(uid,await access(),fetcher);
  const token=await (dependencies.customToken||customToken)(sa,uid);
  return reply({ok:true,customToken:token});
 }catch(e){return reply({ok:false,code:e instanceof AuthError?e.code:'SERVER_UNAVAILABLE'},e instanceof AuthError?e.status:503);}
};}
export default {fetch:createHandler()};
