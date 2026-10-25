/* Notifications are projections of real receipts. Only read acknowledgements are written. */
(function(root){
'use strict';
function events(rows){
 const seen=new Set(),result=[];
 for(const row of rows||[]){
  const allowed=(row.source==='deposit'&&['approved','rejected'].includes(row.status))
   ||(row.source==='purchase'&&['approved','rejected'].includes(row.status))
   ||(row.source==='withdrawal'&&['paid','rejected'].includes(row.status))
   ||(row.source==='referral-bot'&&row.status==='awarded')
   ||(row.source==='spin'&&row.status==='claimed')
   ||(row.source==='code'&&row.status==='claimed')
   ||(row.source==='mining'&&['completed','complete','finished'].includes(row.status));
  if(!allowed)continue;
  // A rejected bot order may be resubmitted under the same document ID.
  const id=encodeURIComponent(row.key+'|'+row.status+'|'+(row.timestamp||0));
  if(id.length>1400||seen.has(id))continue;
  seen.add(id);
  const title=row.source==='deposit'?(row.status==='approved'?'Deposit অনুমোদিত হয়েছে':'Deposit বাতিল হয়েছে')
   :row.source==='purchase'?(row.status==='approved'?'কেনা বট unlock হয়েছে':'Bot payment বাতিল হয়েছে')
   :row.source==='withdrawal'?(row.status==='paid'?'Withdrawal paid হয়েছে':'Withdrawal বাতিল হয়েছে')
   :row.source==='referral-bot'?'Verified referral থেকে free bot পেয়েছেন'
   :row.source==='spin'?'Spin reward জমা হয়েছে':row.source==='code'?'Code reward পেয়েছেন':'Bot mining সম্পন্ন হয়েছে';
  result.push({...row,id,title});
 }
 return result.sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)||a.id.localeCompare(b.id));
}
function create(db,F,uid,onChange){
 let stopped=false,ready=false,readError=false,saving=false,activity={rows:[],loading:true,errors:[],fromCache:false},readIds=new Set(),cached=false;
 const ref=db.collection('users').doc(uid).collection('notificationReads');
 function state(){const list=events(activity.rows).map(e=>({...e,read:readIds.has(e.id)}));return {events:list,unread:list.filter(e=>!e.read).length,ready,readError,saving,loading:activity.loading,sourceErrors:activity.errors||[],fromCache:cached||activity.fromCache};}
 function emit(){if(!stopped)onChange(state());}
 function watch(){return ref.onSnapshot({includeMetadataChanges:true},snapshot=>{if(stopped)return;readIds=new Set(snapshot.docs.filter(d=>d.data().read===true&&!d.metadata?.hasPendingWrites).map(d=>d.id));ready=true;readError=false;cached=snapshot.metadata?.fromCache===true;emit();},()=>{if(stopped)return;ready=false;readError=true;emit();});}
 let unsubscribe;
 try{unsubscribe=watch();}catch(_){readError=true;emit();}
 async function mark(ids){
  if(stopped||!ready||readError)throw new Error('পড়া হয়েছে কি না লোড হয়নি। Refresh করুন এবং Firestore rules পরীক্ষা করুন।');
  if(saving)return;
  const unread=new Set(state().events.filter(e=>!e.read).map(e=>e.id));const valid=[...new Set(ids)].filter(id=>unread.has(id));if(!valid.length)return;
  saving=true;emit();
  try{for(let i=0;i<valid.length;i+=400){if(stopped)break;const batch=db.batch();for(const id of valid.slice(i,i+400))batch.set(ref.doc(id),{eventId:id,read:true,readAt:F.serverTimestamp()});await batch.commit();}}
  finally{saving=false;emit();}
 }
 emit();
 return {setActivity(s){activity=s;emit();},markRead:id=>mark([id]),markAll:()=>mark(state().events.filter(e=>!e.read).map(e=>e.id)),retry(){if(stopped)return;if(unsubscribe)unsubscribe();ready=false;readError=false;emit();try{unsubscribe=watch();}catch(_){readError=true;emit();}},stop(){stopped=true;if(unsubscribe)unsubscribe();}};
}
const api={events,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HubNotifications=api;
})(typeof window!=='undefined'?window:globalThis);
