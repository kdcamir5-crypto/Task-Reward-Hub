'use strict';
const fs=require('node:fs'),admin=require('firebase-admin');
async function main(){
 const account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT||'{}');
 if(account.project_id!=='reward-hub-bd')throw Error('Expected reward-hub-bd service account');
 const credential=admin.credential.cert(account);
 const definitions=JSON.parse(fs.readFileSync(__dirname+'/../firestore.activity-indexes.json','utf8')).indexes;
 async function request(url,method='GET',body){
  const token=(await credential.getAccessToken()).access_token;
  const response=await fetch(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok){const body=await response.json().catch(()=>({}));const detail=String(body.error?.message||'').split(token).join('[redacted]').replace(/[\r\n]/g,' ').slice(0,250);throw Error('INDEX_API_HTTP_'+response.status+' '+method+' '+detail);}
  return response.json();
 }
 const base='https://firestore.googleapis.com/v1/projects/reward-hub-bd/databases/(default)/collectionGroups/';
 const collections=[...new Set(definitions.map(d=>d.collectionGroup))];
 async function list(collection){const result=[];let token='';do{const body=await request(base+collection+'/indexes'+(token?'?pageToken='+encodeURIComponent(token):''));result.push(...body.indexes||[]);token=body.nextPageToken||'';}while(token);return result;}
 const same=(a,b)=>a.queryScope===b.queryScope&&JSON.stringify(a.fields.filter(f=>f.fieldPath!=='__name__'))===JSON.stringify(b.fields);
 for(const collection of collections){const indexes=await list(collection);for(const d of definitions.filter(d=>d.collectionGroup===collection)){if(!indexes.some(i=>same(i,d))){await request(base+collection+'/indexes','POST',{queryScope:d.queryScope,fields:d.fields});console.log('Created activity index:',collection,d.fields.map(f=>f.fieldPath).join(','));}}}
 for(let attempt=0;attempt<45;attempt++){
  let pending=0;for(const collection of collections){const indexes=await list(collection);for(const d of definitions.filter(d=>d.collectionGroup===collection)){const index=indexes.find(i=>same(i,d));if(index?.state==='NEEDS_REPAIR')throw Error('INDEX_NEEDS_REPAIR');if(index?.state!=='READY')pending++;}}
  console.log('Activity indexes still building:',pending);if(!pending)return;
  await new Promise(r=>setTimeout(r,20000));
 }
 throw Error('INDEX_BUILD_PENDING');
}
main().catch(error=>{console.error('Activity index preparation failed:',/^INDEX_|^Expected /.test(error.message)?error.message:'SETUP_ERROR');process.exitCode=1;});
