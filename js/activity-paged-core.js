/* Read-only activity projection. Never writes balances or reconstructs missing credits. */
(function(root){
'use strict';
function time(value){
 if(value&&typeof value.toMillis==='function')return value.toMillis();
 if(value&&typeof value.toDate==='function')return value.toDate().getTime();
 if(value&&typeof value.seconds==='number')return value.seconds*1000+Math.floor((value.nanoseconds||0)/1e6);
 if(value instanceof Date)return value.getTime();
 if(typeof value==='number')return Number.isFinite(value)?value:0;
 if(typeof value==='string'){const n=Date.parse(value);return Number.isFinite(n)?n:0;}
 return 0;
}
function amount(n){return typeof n==='number'&&Number.isFinite(n)&&n>=0?n:null;}
function normalize(sources,profile,mining){
 const rows=[];
 function add(source,d,extra){
  const value=amount(extra.amount);if(value===null)return;
  rows.push({key:source+':'+d.id,source,id:d.id,kind:extra.kind||'rewards',currency:'BDT',effect:'none',status:d.status||'pending',timestamp:time(d.reviewedAt||d.createdAt),recent:true,detail:'',...extra,amount:value});
 }
 for(const d of sources.deposits||[])add('deposit',d,{kind:'deposits',title:'টাকা জমা',icon:'↙',amount:d.amount,effect:d.status==='approved'?'credit':'none',detail:[d.type,d.trxId&&'TRX: '+d.trxId,d.rejectionReason].filter(Boolean).join(' · ')});
 for(const d of sources.withdrawals||[]){
  const reserved=d.reservationVersion===2;
  add('withdrawal',d,{kind:'withdrawals',title:'উত্তোলন',icon:'↗',amount:d.amount,effect:d.status==='rejected'?(reserved?'refund':'none'):d.status==='paid'||(reserved&&d.status==='pending')?'debit':'none',detail:[d.type,d.number,d.payoutReference&&'TRX: '+d.payoutReference,d.rejectionReason,d.status==='pending'?(reserved?'টাকা reserve আছে':'পুরোনো request: টাকা reserve হয়নি'):d.status==='paid'?(reserved?'আগের reserve নিষ্পত্তি; দ্বিতীয়বার কাটা হয়নি':'Paid-এর সময় টাকা কাটা হয়েছে'):reserved?'Reserve ফেরত এসেছে':'কোনো refund যোগ হয়নি'].filter(Boolean).join(' · ')});
 }
 for(const d of sources.purchases||[]){
  add('purchase',d,{kind:'purchases',title:'বট ক্রয়',icon:'🤖',amount:d.amount,effect:d.status==='approved'&&d.paymentMethod==='wallet'?'debit':'none',detail:[d.botName||d.botId,d.paymentMethod,d.paymentMethod==='bKash'?'সরাসরি পেমেন্ট; wallet debit নয়':'',d.trxId&&'TRX: '+d.trxId,d.rejectionReason].filter(Boolean).join(' · ')});
  if(d.status==='approved'&&d.usdBonusCredited===true&&amount(d.usdBonus)>0)add('purchase-usd',d,{title:'বট কেনার USD bonus',icon:'💵',amount:d.usdBonus,currency:'USD',effect:'credit',detail:d.botName||d.botId});
 }
 for(const d of sources.spins||[]){if(d.claimed===true&&['BDT','USD'].includes(d.currency)&&Number.isInteger(d.amountMinor)&&d.amountMinor>0)add('spin',d,{title:'Spin reward',icon:'🎡',amount:d.amountMinor/100,currency:d.currency,effect:'credit',status:'claimed',timestamp:time(d.claimedAt),detail:d.currency+' wallet-এ জমা'});}
 for(const d of sources.tasks||[]){const paid=d.schemaVersion===2&&d.status==='approved'&&d.rewardCredited===true&&Number.isInteger(d.rewardMinor)&&d.rewardMinor>0&&d.rewardMinor<=1000000&&d.reward===d.rewardMinor/100;add('task',d,{title:paid?'টাস্ক সম্পন্ন করে আয়':'Task submission',icon:'🎯',amount:d.reward,taskVersion:d.schemaVersion,effect:paid?'credit':'none',detail:(d.taskTitle||d.taskId||'')+' · '+(paid?'Main Balance-এ task reward যোগ হয়েছে':d.schemaVersion!==2?'জমা দেওয়া task-এর reward; এটি wallet credit receipt নয়':d.rejectionReason||'Proof জমা হয়েছে; অনুমোদন না হওয়া পর্যন্ত reward জমা নয়')});}
 for(const d of sources.gifts||[])add('referral-bot',d,{title:'Referral free bot',icon:'🎁',amount:1,currency:'BOT',effect:'none',status:'awarded',detail:d.botId+' · Verified referral #'+d.ordinal});
 for(const d of sources.codes||[])add('code',d,{title:'Code reward',icon:'🎫',amount:d.rewardType==='bot'?1:d.amountMinor/100,currency:d.rewardType==='bot'?'BOT':d.rewardType,effect:d.rewardType==='bot'?'none':'credit',status:'claimed',detail:d.code+(d.botId?' · '+d.botId:'')});
 for(const d of mining||[]){if(amount(d.earnedReward)>0)add('mining',d,{title:'Bot mining • মোট অর্জিত',icon:'⛏',amount:d.earnedReward,effect:'total',status:d.status||'recorded',timestamp:time(d.updatedAt||d.lastProcessedAt||d.startedAt),detail:d.botName||d.botId||d.id});}
 if(profile&&amount(profile.referralEarnings)>0)add('referral-total',{id:'total'},{title:'Referral commission • সর্বমোট',icon:'👥',amount:profile.referralEarnings,effect:'total',status:'recorded',timestamp:0,recent:false,detail:'৫% commission-এর সংরক্ষিত মোট; প্রতিটি পুরোনো credit-এর আলাদা receipt নেই'});
 return rows.sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)||a.key.localeCompare(b.key));
}
function amountText(row){
 if(row.currency==='BOT')return row.amount+'টি বট';
 const formatted=(row.currency==='USD'?'$':'৳')+row.amount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
 return (row.effect==='credit'||row.effect==='refund'?'+':row.effect==='debit'?'−':row.effect==='total'?'মোট ':'')+formatted;
}
function create(db,uid,onChange){
 let stopped=false,profile=null,mining=[],unsubscribers=[],loadingMore=false;
 const pageSize=25,headSize=10,sources={},records={},errors=new Set(),pending=new Set(),cached=new Set();
 const userRef=db.collection('users').doc(uid);
 const specs=[['withdrawals',db.collection('withdrawals').where('uid','==',uid),'createdAt',true],['deposits',db.collection('walletDeposits').where('uid','==',uid),'createdAt',true],['purchases',db.collection('botPurchaseRequests').where('uid','==',uid),'createdAt',true],['tasks',db.collection('submissions').where('uid','==',uid),'createdAt',true],['spins',userRef.collection('spinTickets').where('claimed','==',true),'claimedAt',false],['gifts',db.collection('referralAwards').where('recipientUid','==',uid),'createdAt',false],['codes',userRef.collection('codeClaims'),'createdAt',false]];
 const archives=specs.map(([name,query])=>({name,query,cursor:null,more:true}));
 for(const [name] of specs)records[name]=new Map();
 for(const [name,,field,review] of specs){pending.add(name+'.'+field);if(review)pending.add(name+'.reviewedAt');}
 function emit(){if(!stopped)onChange({rows:normalize(sources,profile,mining),errors:[...errors],loading:pending.size>0,fromCache:cached.size>0,hasMore:archives.some(a=>a.more),loadingMore});}
 function merge(name,docs){for(const d of docs)records[name].set(d.id,{...d.data(),id:d.id});sources[name]=[...records[name].values()];}
 function watch(name,base,field){
  const key=name+'.'+field;
  try{unsubscribers.push(base.orderBy(field,'desc').limit(headSize).onSnapshot({includeMetadataChanges:true},snap=>{
   if(stopped)return;merge(name,snap.docs);pending.delete(key);errors.delete(key);if(snap.metadata?.fromCache)cached.add(key);else cached.delete(key);emit();
  },()=>{if(stopped)return;pending.delete(key);errors.add(key);emit();}));}
  catch(_){pending.delete(key);errors.add(key);emit();}
 }
 emit();
 for(const [name,query,field,review] of specs){watch(name,query,field);if(review)watch(name,query,'reviewedAt');}
 async function loadMore(){
  if(stopped||loadingMore||pending.size)return;
  loadingMore=true;emit();
  const documentId=root.firebase?.firestore?.FieldPath?.documentId?.()||'__name__';
  await Promise.all(archives.filter(a=>a.more).map(async archive=>{
   const key=archive.name+'.history';
   try{
    let query=archive.query.orderBy(documentId).limit(pageSize);if(archive.cursor)query=query.startAfter(archive.cursor);
    const snapshot=await query.get({source:'server'});if(stopped)return;
    merge(archive.name,snapshot.docs);if(snapshot.docs.length)archive.cursor=snapshot.docs.at(-1);archive.more=snapshot.docs.length===pageSize;errors.delete(key);
   }catch(_){if(!stopped)errors.add(key);}
  }));
  loadingMore=false;emit();
 }
 return {loadMore,updateProfile(p){profile=p;errors.delete('profile');emit();},updateMining(r){mining=r;errors.delete('mining');emit();},reportError(name){errors.add(name);emit();},stop(){stopped=true;unsubscribers.forEach(fn=>{if(typeof fn==='function')fn();});unsubscribers=[];}};
}
const api={time,normalize,amountText,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HubPagedActivity=api;
})(typeof window!=='undefined'?window:globalThis);
