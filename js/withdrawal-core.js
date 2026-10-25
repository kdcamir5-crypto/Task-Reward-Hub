/* Available balance excludes funds held for pending withdrawals. */
(function(root){
'use strict';
function fail(message){throw new Error(message);}
function money(n){return typeof n==='number'&&Number.isFinite(n)&&n>=0;}
async function request(db,F,user,amount,walletId,id){
 if(!user||!user.uid||!Number.isInteger(amount)||amount<100||amount>5000||!walletId)fail('সঠিক amount ও wallet নির্বাচন করুন।');
 const ref=id?db.collection('withdrawals').doc(id):db.collection('withdrawals').doc();
 const profileRef=db.collection('users').doc(user.uid),walletRef=db.collection('wallets').doc(walletId);
 await db.runTransaction(async tx=>{
  const [profileSnap,walletSnap,old]=await Promise.all([tx.get(profileRef),tx.get(walletRef),tx.get(ref)]);
  if(old.exists){const data=old.data();if(data.uid===user.uid&&data.amount===amount&&data.walletId===walletId)return;fail('Request ID ইতিমধ্যে ব্যবহৃত হয়েছে।');}
  if(!profileSnap.exists||!walletSnap.exists)fail('Profile অথবা wallet পাওয়া যায়নি।');
  const p=profileSnap.data(),w=walletSnap.data(),held=p.withdrawReserved===undefined?0:p.withdrawReserved;
  if(p.activeWithdrawalId)fail('আপনার একটি withdrawal pending আছে।');
  if(!money(p.balance)||!money(held)||p.balance<amount)fail('ওয়ালেটে পর্যাপ্ত available balance নেই।');
  if(w.uid!==user.uid||!['bKash','Nagad','Rocket'].includes(w.type)||!/^01[3-9][0-9]{8}$/.test(w.number))fail('নিজের সঠিক wallet নির্বাচন করুন।');
  tx.set(ref,{uid:user.uid,amount,type:w.type,number:w.number,walletId,status:'pending',reservationVersion:2,reservedAmount:amount,createdAt:F.serverTimestamp()});
  tx.update(profileRef,{balance:p.balance-amount,withdrawReserved:held+amount,activeWithdrawalId:ref.id,lastWithdrawalId:ref.id,updatedAt:F.serverTimestamp()});
 });
 return ref.id;
}
async function settle(db,F,admin,id,paid,reference){
 reference=String(reference||'').trim();
 if(!admin||!admin.uid||reference.length<3||reference.length>100)fail(paid?'Payment transaction/reference দিন।':'Reject করার কারণ দিন (৩–১০০ অক্ষর)।');
 const ref=db.collection('withdrawals').doc(id);
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);if(!snap.exists)fail('Request পাওয়া যায়নি।');
  const d=snap.data();if(d.status!=='pending')fail('এই request ইতিমধ্যে নিষ্পত্তি হয়েছে।');
  const userRef=db.collection('users').doc(d.uid),pSnap=await tx.get(userRef);
  if(!pSnap.exists)fail('User profile পাওয়া যায়নি।');
  const p=pSnap.data();if(!Number.isInteger(d.amount)||d.amount<100||d.amount>5000||!money(p.balance))fail('পুরোনো request যাচাই করতে হবে।');
  if(d.reservationVersion===2){
   if(d.reservedAmount!==d.amount||!money(p.withdrawReserved)||p.withdrawReserved<d.amount||p.activeWithdrawalId!==id)fail('Reserved balance মিলছে না। Support review প্রয়োজন।');
   tx.update(userRef,{balance:paid?p.balance:p.balance+d.amount,withdrawReserved:p.withdrawReserved-d.amount,activeWithdrawalId:'',lastWithdrawalReviewId:id,updatedAt:F.serverTimestamp()});
  }else if(paid){
   // Legacy requests never reserved money. Deduct only when marking the payout paid.
   if(p.balance<d.amount)fail('পুরোনো request-এর জন্য পর্যাপ্ত available balance নেই। টাকা পাঠাবেন না।');
   tx.update(userRef,{balance:p.balance-d.amount,lastWithdrawalReviewId:id,updatedAt:F.serverTimestamp()});
  }
  tx.update(ref,{status:paid?'paid':'rejected',reviewedBy:admin.uid,reviewedAt:F.serverTimestamp(),payoutReference:paid?reference:'',rejectionReason:paid?'':reference,settlementVersion:2});
 });
}
const api={request,settle};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HubWithdrawals=api;
})(typeof window!=='undefined'?window:globalThis);
