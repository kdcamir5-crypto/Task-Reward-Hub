'use strict';
const {randomInt}=require('node:crypto');
const Spin=require('../js/spin-core.js');
// Idempotent provisioning: existing outcomes and claimed tickets are never overwritten.
async function prepare(db,F,{now=Date.now(),randomIndex=()=>randomInt(Spin.rewards.length)}={}){
 const day=Spin.dayKey(now),stateRef=db.collection('systemState').doc('spinProvisioning');
 const stateSnap=await stateRef.get(),state=stateSnap.exists?stateSnap.data():{};
 const fullScan=state.preparedDay!==day||!state.scanAfter;
 const users=await (fullScan?db.collection('users').select():db.collection('users').where('createdAt','>=',F.Timestamp.fromMillis(state.scanAfter.toMillis()-60000)).select()).get();
 let prepared=0;let batch=db.batch(),writes=0;
 for(const user of users.docs){
  const refs=[];for(let offset=0;offset<3;offset++)for(let slot=1;slot<=2;slot++)refs.push(user.ref.collection('spinTickets').doc((day+offset)+'_'+slot));
  const snapshots=await db.getAll(...refs);
  for(let i=0;i<refs.length;i++){
   if(snapshots[i].exists)continue;
   const rewardIndex=randomIndex(),prize=Spin.rewards[rewardIndex];if(!prize)throw new Error('Invalid server reward index.');
   batch.create(refs[i],{uid:user.id,day:day+Math.floor(i/2),slot:i%2+1,rewardIndex,currency:prize.currency,amountMinor:prize.amountMinor,claimed:false,claimedAt:null,createdAt:F.FieldValue.serverTimestamp()});
   writes++;prepared++;
   if(writes===400){await batch.commit();batch=db.batch();writes=0;}
  }
 }
 if(writes)await batch.commit();
 await stateRef.set({preparedDay:day,scanAfter:F.Timestamp.fromMillis(now),updatedAt:F.FieldValue.serverTimestamp()});
 return {accountsChecked:users.size,ticketsPrepared:prepared,fullScan};
}
async function main(){
 if(!process.env.FIREBASE_SERVICE_ACCOUNT)throw new Error('Configure the FIREBASE_SERVICE_ACCOUNT repository secret before running the spin worker.');
 const admin=require('firebase-admin');let credentials;
 try{credentials=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);}catch(_){throw new Error('FIREBASE_SERVICE_ACCOUNT must contain valid service-account JSON.');}
 if(credentials.project_id!=='reward-hub-bd')throw new Error('The service account must belong to reward-hub-bd.');
 admin.initializeApp({credential:admin.credential.cert(credentials)});
 const result=await prepare(admin.firestore(),admin.firestore);
 console.log(JSON.stringify(result)); // Counts only; no identities, prizes or credentials.
}
if(require.main===module)main().catch(()=>{console.error('Spin preparation failed. Check FIREBASE_SERVICE_ACCOUNT, its project and Firestore access. Existing tickets were preserved.');process.exitCode=1;});
module.exports={prepare};
