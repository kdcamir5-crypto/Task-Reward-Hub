/* Free spin prizes are prepared by the trusted worker, never chosen by the browser. */
(function(root){
'use strict';
const rewards=Object.freeze([
 {label:'৳১০',currency:'BDT',amountMinor:1000},
 {label:'$0.20',currency:'USD',amountMinor:20},
 {label:'৳৩০০',currency:'BDT',amountMinor:30000},
 {label:'৳0.50',currency:'BDT',amountMinor:50},
 {label:'৳৫০',currency:'BDT',amountMinor:5000},
 {label:'$1',currency:'USD',amountMinor:100},
 {label:'৳২০',currency:'BDT',amountMinor:2000},
 {label:'$0.10',currency:'USD',amountMinor:10}
].map(Object.freeze));
function dayKey(now=Date.now()){return Math.floor((now+21600000)/86400000);}
function validate(ticket){
 const prize=rewards[ticket.rewardIndex];
 if(!prize||ticket.currency!==prize.currency||ticket.amountMinor!==prize.amountMinor||![1,2].includes(ticket.slot))throw new Error('Spin reward যাচাই করা যায়নি। Support-এ যোগাযোগ করুন।');
 return prize;
}
async function claim(db,F,user,ticketId){
 if(!user||!user.uid)throw new Error('স্পিন করতে লগইন করুন।');
 const userRef=db.collection('users').doc(user.uid),ticketRef=userRef.collection('spinTickets').doc(ticketId);
 try { return await db.runTransaction(async tx=>{
  const [ticketSnap,profileSnap]=await Promise.all([tx.get(ticketRef),tx.get(userRef)]);
  if(!ticketSnap.exists||!profileSnap.exists)throw new Error('Spin প্রস্তুত হয়নি। একটু পর আবার চেষ্টা করুন।');
  const ticket=ticketSnap.data(),profile=profileSnap.data(),prize=validate(ticket);
  if(ticket.uid!==user.uid)throw new Error('এই Spin আপনার নয়।');
  // Return a committed outcome on retries; do not write or credit a second time.
  if(ticket.claimed===true)return {...ticket,id:ticketId,alreadyClaimed:true};
  if(ticket.day!==dayKey())throw new Error('এই Spin-এর দিন শেষ হয়েছে। আজকের Spin আবার লোড করুন।');
  const field=prize.currency==='BDT'?'balance':'usdBalance';
  const balance=profile[field]===undefined&&field==='usdBalance'?0:profile[field];
  if(typeof balance!=='number'||!Number.isFinite(balance)||balance<0)throw new Error('Wallet balance যাচাই করা যায়নি।');
  tx.update(userRef,{[field]:F.increment(prize.amountMinor/100),lastSpinTicketId:ticketId,updatedAt:F.serverTimestamp()});
  tx.update(ticketRef,{claimed:true,claimedAt:F.serverTimestamp()});
  return {...ticket,id:ticketId,claimed:true,alreadyClaimed:false};
 });
 } catch (error) {
  // Another tab may have committed the same spin while this transaction retried,
  // or the connection may have dropped after commit. Confirm the saved receipt.
  try {
   const saved=await ticketRef.get({source:'server'});
   if(saved.exists){const ticket=saved.data();validate(ticket);if(ticket.uid===user.uid&&ticket.claimed===true)return {...ticket,id:ticketId,alreadyClaimed:true};}
  } catch (_) {}
  throw error;
 }
}
// Authenticated request to the trusted server; no money or prize is selected here.
const preparing=new Map();
function prepare(user,endpoint,fetcher=globalThis.fetch){
 if(!user?.uid||!endpoint)return Promise.reject(new Error('Spin server পাওয়া যায়নি। পরে আবার চেষ্টা করুন।'));
 const key=user.uid+':'+dayKey();if(preparing.has(key))return preparing.get(key);
 const pending=(async()=>{
  const token=await user.getIdToken();
  const response=await fetcher(endpoint.replace(/\/$/,'')+'/spin/prepare',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:'{}',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(20000)});
  let data;try{data=await response.json();}catch(_){throw new Error('Spin প্রস্তুত করা যায়নি। আবার চাপ দিয়ে চেষ্টা করুন।');}
  if(!response.ok||data.ok!==true)throw new Error('Spin প্রস্তুত করা যায়নি। আবার চাপ দিয়ে চেষ্টা করুন।');
  return data;
 })().finally(()=>preparing.delete(key));
 preparing.set(key,pending);return pending;
}
root.HubSpin={rewards,dayKey,validate,claim,prepare};
if(typeof module!=='undefined'&&module.exports)module.exports=root.HubSpin;
})(typeof window==='undefined'?globalThis:window);

