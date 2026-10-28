/* Shared task rules for the user app and admin review. Money is written only by review(). */
(function(root){
'use strict';
const DAY=86400000,OFFSET=21600000;
function dayEnd(now=Date.now()){return (Math.floor((now+OFFSET)/DAY)+1)*DAY-OFFSET;}
function text(value,min,max,label){const s=String(value??'').trim();if(s.length<min||s.length>max)throw Error(label+' সঠিকভাবে লিখুন ('+min+'–'+max+' অক্ষর)।');return s;}
function link(value){const url=new URL(String(value||'').trim());if(url.protocol!=='https:'||!url.hostname||url.username||url.password||url.href.length>1000)throw Error('সঠিক https task link দিন।');return url.href;}
function rewardMinor(value){const s=String(value??'').trim();if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('Reward সর্বোচ্চ দুই দশমিকসহ লিখুন।');const n=Math.round(Number(s)*100);if(!Number.isSafeInteger(n)||n<1||n>1000000)throw Error('Reward ৳0.01 থেকে ৳10,000 হতে হবে।');return n;}
function taskInput(data,now=Date.now()){const minor=rewardMinor(data.reward);return {schemaVersion:2,title:text(data.title,3,120,'Task title'),description:text(data.description,3,1500,'নির্দেশনা'),url:link(data.url),rewardMinor:minor,reward:minor/100,expiresAtMs:dayEnd(now)};}
function available(tasks,submissions,now=Date.now()){const done=new Set(submissions.map(s=>s.taskId));return tasks.filter(t=>t.schemaVersion===2&&t.expiresAtMs>now&&!done.has(t.id)).sort((a,b)=>a.expiresAtMs-b.expiresAtMs||a.id.localeCompare(b.id));}
async function create(db,F,admin,input,id,now=Date.now()){
 if(!admin?.uid)throw Error('Admin login প্রয়োজন।');const data=taskInput(input,now),ref=db.collection('tasks').doc(id);
 await db.runTransaction(async tx=>{const existing=await tx.get(ref);if(existing.exists)throw Error('Task ইতিমধ্যে তৈরি হয়েছে।');tx.set(ref,{...data,createdAt:F.serverTimestamp(),createdBy:admin.uid});});return ref.id;
}
async function submit(db,F,user,taskId,proof){
 if(!user?.uid)throw Error('Login প্রয়োজন।');const body=text(proof,3,1000,'লিখিত proof'),taskRef=db.collection('tasks').doc(taskId),ref=db.collection('submissions').doc(user.uid+'_'+taskId);
 return db.runTransaction(async tx=>{const task=await tx.get(taskRef),old=await tx.get(ref);if(old.exists)throw Error('এই task আগেই জমা দিয়েছেন।');if(!task.exists)throw Error('Task সরানো হয়েছে।');const t=task.data();if(t.schemaVersion!==2||t.expiresAtMs<=Date.now())throw Error('Task-এর সময় শেষ হয়েছে।');tx.set(ref,{schemaVersion:2,uid:user.uid,email:user.email||'',taskId,taskTitle:t.title,taskUrl:t.url,taskExpiresAtMs:t.expiresAtMs,rewardMinor:t.rewardMinor,reward:t.reward,proof:body,status:'pending',createdAt:F.serverTimestamp()});});
}
async function review(db,F,admin,id,approved,reason=''){
 if(!admin?.uid)throw Error('Admin login প্রয়োজন।');const rejection=approved?'':text(reason,3,300,'বাতিলের কারণ'),ref=db.collection('submissions').doc(id);
 return db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)throw Error('Submission পাওয়া যায়নি।');const d=snap.data();if(d.schemaVersion!==2)throw Error('পুরোনো submission এই flow-তে review করা যাবে না।');if(d.status!=='pending')throw Error('Submission আগেই review করা হয়েছে।');if(!Number.isInteger(d.rewardMinor)||d.rewardMinor<1||d.rewardMinor>1000000||d.reward!==d.rewardMinor/100)throw Error('Reward সঠিক নয়।');
 const userRef=db.collection('users').doc(d.uid),user=approved?await tx.get(userRef):null;
 if(approved){const p=user?.exists?user.data():null;if(!p||typeof p.balance!=='number'||!Number.isFinite(p.balance)||p.balance<0||!Number.isInteger(p.tasks??0)||(p.tasks??0)<0)throw Error('User balance বা task count সঠিক নয়।');tx.update(userRef,{balance:p.balance+d.reward,tasks:(p.tasks??0)+1,lastTaskRewardId:id,updatedAt:F.serverTimestamp()});}
 tx.update(ref,{status:approved?'approved':'rejected',reviewedBy:admin.uid,reviewedAt:F.serverTimestamp(),rejectionReason:rejection,rewardCredited:approved});
 });
}
async function remove(db,admin,id){if(!admin?.uid)throw Error('Admin login প্রয়োজন।');await db.collection('tasks').doc(id).delete();}
const api={DAY,OFFSET,dayEnd,link,rewardMinor,taskInput,available,create,submit,review,remove};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HubDailyTaskCore=api;
})(typeof window!=='undefined'?window:globalThis);
