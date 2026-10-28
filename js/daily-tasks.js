(function(){
'use strict';
const Core=window.HubDailyTaskCore,el=id=>document.getElementById(id),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db,user,rows=[],receipts=[],taskReady=false,receiptReady=false,failed=false,cached=false,busy=new Set(),drafts=new Map(),unsubscribers=[],generation=0,timer,historyVisible=false,historyLimit=50;
function time(value){
 if(value&&typeof value.toMillis==='function')return value.toMillis();
 if(value&&typeof value.seconds==='number')return value.seconds*1000+Math.floor((value.nanoseconds||0)/1e6);
 return value instanceof Date?value.getTime():0;
}
function date(value){const ms=time(value);return Number.isFinite(ms)&&ms>0?new Date(ms).toLocaleString('bn-BD',{timeZone:'Asia/Dhaka',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'সময় নিশ্চিত হয়নি';}
function renderHistory(ready){
 const host=el('daily-task-history');if(!host)return;
 const own=receipts.filter(r=>r.schemaVersion===2&&r.uid===user?.uid).sort((a,b)=>time(b.reviewedAt||b.createdAt)-time(a.reviewedAt||a.createdAt)||a.id.localeCompare(b.id));
 const earnedMinor=own.filter(r=>r.status==='approved'&&r.rewardCredited===true&&Number.isInteger(r.rewardMinor)&&r.rewardMinor>0&&r.rewardMinor<=1000000&&r.reward===r.rewardMinor/100).reduce((total,r)=>total+r.rewardMinor,0);
 const button=el('daily-tasks-history');if(button){button.textContent='কাজের History'+(ready?' ('+own.length+')':'');button.setAttribute('aria-pressed',String(historyVisible));}
 el('daily-tasks-available')?.setAttribute('aria-pressed',String(!historyVisible));
 host.hidden=!historyVisible;el('daily-task-list').hidden=historyVisible;
 const more=el('daily-task-history-more');if(more)more.hidden=!historyVisible||!ready||own.length<=historyLimit;
 host.innerHTML=!ready?'<div class="dt-empty">'+(failed?'History লোড হয়নি। Refresh করে আবার চেষ্টা করুন।':'History লোড হচ্ছে…')+'</div>':!own.length?'<div class="dt-empty">এখনো কোনো task জমা দেননি। Proof জমা দিলে তার অবস্থা এখানে দেখাবে।</div>':'<div class="dt-note"><strong>Task থেকে মোট আয়: ৳'+(earnedMinor/100).toFixed(2)+'</strong><br>অনুমোদিত কাজের এই টাকা Main Balance-এ যোগ হয়েছে।</div>'+own.slice(0,historyLimit).map(r=>{
  const valid=Number.isInteger(r.rewardMinor)&&r.rewardMinor>0&&r.rewardMinor<=1000000&&r.reward===r.rewardMinor/100;
  const paid=r.status==='approved'&&r.rewardCredited===true&&valid;
  const status=r.status==='approved'?'Approved':r.status==='rejected'?'Rejected':r.status==='pending'?'Pending':'অবস্থা নিশ্চিত নয়';
  const state=r.status==='approved'?'approved':r.status==='rejected'?'rejected':'pending';
  const amount=valid?'৳'+(r.rewardMinor/100).toFixed(2):'পরিমাণ নিশ্চিত নয়';
  return '<article class="dt-card dt-history-card"><div class="dt-card-title"><h2>'+escape(r.taskTitle||'Task')+'</h2><span class="dt-status dt-status-'+state+'">'+status+'</span></div><dl class="dt-history-details"><div><dt>Task reward</dt><dd>'+amount+'</dd></div><div><dt>জমা দিয়েছেন</dt><dd>'+escape(date(r.createdAt))+'</dd></div>'+(r.reviewedAt?'<div><dt>Review হয়েছে</dt><dd>'+escape(date(r.reviewedAt))+'</dd></div>':'')+'</dl><p class="dt-credit-note">'+(paid?'✓ '+amount+' আপনার Main Balance-এ যোগ হয়েছে।':r.status==='pending'?'Admin যাচাই করছেন। এখনো টাকা যোগ হয়নি।':r.status==='rejected'?'কাজটি বাতিল হয়েছে। কোনো টাকা যোগ হয়নি।':'Reward credit নিশ্চিত করা যায়নি। Support-এ যোগাযোগ করুন।')+'</p>'+(r.rejectionReason?'<p class="dt-rejection-reason">বাতিলের কারণ: '+escape(r.rejectionReason)+'</p>':'')+'<details class="dt-proof-history"><summary>আপনার জমা দেওয়া proof</summary><p>'+escape(r.proof||'')+'</p></details></article>';
 }).join('');
}
function render(){
 const list=el('daily-task-list');if(!list)return;const ready=taskReady&&receiptReady&&!failed;
 const visible=ready?Core.available(rows,receipts):[];
 const active=document.activeElement,focusId=active?.matches('[data-daily-proof]')?active.dataset.dailyProof:null,start=active?.selectionStart,end=active?.selectionEnd;
 list.innerHTML=visible.length?visible.map(t=>{let url='';try{url=Core.link(t.url);}catch(_){}return '<article class="dt-card"><div class="dt-card-title"><h2>'+escape(t.title)+'</h2><strong>৳'+(t.rewardMinor/100).toFixed(2)+'</strong></div><p class="dt-description">'+escape(t.description)+'</p>'+(url?'<a class="dt-link" href="'+escape(url)+'" target="_blank" rel="noopener noreferrer">কাজের লিংক খুলুন ↗</a>':'<p>Task link সঠিক নয়। Support-এ জানান।</p>')+'<form data-daily-submit="'+escape(t.id)+'"><label>কাজ শেষ করে লিখিত proof দিন<textarea data-daily-proof="'+escape(t.id)+'" rows="3" minlength="3" maxlength="1000" required placeholder="আপনার username বা কাজের প্রমাণ লিখুন">'+escape(drafts.get(t.id)||'')+'</textarea></label><button type="submit" '+(busy.has(t.id)||cached||!url?'disabled':'')+'>'+(busy.has(t.id)?'জমা হচ্ছে…':'Proof জমা দিন')+'</button></form></article>';}).join(''):'<div class="dt-empty">'+(!ready?(failed?'Task লোড হয়নি। Refresh করে আবার চেষ্টা করুন।':'Task লোড হচ্ছে…'):'এখন কোনো নতুন task নেই। পরের দিন admin নতুন task দিলে এখানে দেখাবে।')+'</div>';
 renderHistory(ready);
 el('daily-task-source').textContent=!ready?'':cached?'সংরক্ষিত তথ্য দেখাচ্ছে। সংযোগ ফিরে এলে আপডেট হবে।':historyVisible?'আপনার জমা দেওয়া কাজ ও reward-এর সংরক্ষিত ইতিহাস।':visible.length+'টি task বাকি • বাংলাদেশ সময় রাত ১২টায় শেষ হবে';
 if(focusId){const input=[...list.querySelectorAll('[data-daily-proof]')].find(x=>x.dataset.dailyProof===focusId);if(input){input.focus();input.setSelectionRange(start,end);}}
 clearTimeout(timer);if(user&&!el('daily-tasks-page')?.hidden)timer=setTimeout(()=>{watch();},Math.max(50,Core.dayEnd()-Date.now()+50));
}
function stop(){generation++;unsubscribers.forEach(fn=>fn());unsubscribers=[];clearTimeout(timer);}
function watch(){
 stop();if(!db||!user||el('daily-tasks-page')?.hidden)return;const version=generation;taskReady=false;receiptReady=false;failed=false;cached=false;render();
 const specs=[['task',db.collection('tasks').where('expiresAtMs','>',Date.now())],['receipt',db.collection('submissions').where('uid','==',user.uid)]];
 const cache={task:true,receipt:true};
 for(const [name,query] of specs)unsubscribers.push(query.onSnapshot({includeMetadataChanges:true},snap=>{if(version!==generation)return;const data=snap.docs.filter(d=>!d.metadata?.hasPendingWrites).map(d=>({...d.data(),id:d.id}));if(name==='task'){rows=data;taskReady=true;}else{receipts=data;receiptReady=true;}cache[name]=snap.metadata?.fromCache===true;cached=cache.task||cache.receipt;render();},()=>{if(version!==generation)return;failed=true;render();}));
}
el('daily-task-list')?.addEventListener('input',event=>{if(event.target.matches('[data-daily-proof]'))drafts.set(event.target.dataset.dailyProof,event.target.value);});
el('daily-task-list')?.addEventListener('submit',async event=>{
 const form=event.target.closest('[data-daily-submit]');if(!form)return;event.preventDefault();const id=form.dataset.dailySubmit;if(busy.has(id)||!taskReady||!receiptReady||failed||cached||!user)return;
 const actor=user,version=generation,proof=drafts.get(id)||'';busy.add(id);render();el('daily-task-message').textContent='';
 try{await Core.submit(db,window.firebase.firestore.FieldValue,actor,id,proof);if(user?.uid!==actor.uid)return;drafts.delete(id);el('daily-task-message').textContent='Proof জমা হয়েছে। Admin approve করলে reward যোগ হবে।';}
 catch(error){if(user?.uid===actor.uid)el('daily-task-message').textContent=error.code==='permission-denied'?'Proof জমা হয়নি। Task মুছে গেছে, সময় শেষ হয়েছে অথবা নতুন Firestore rules প্রকাশ হয়নি।':error.message;}
 finally{if(user?.uid===actor.uid){busy.delete(id);if(version===generation)render();}}
});
el('daily-tasks-refresh')?.addEventListener('click',watch);
el('daily-tasks-history')?.addEventListener('click',()=>{historyVisible=true;render();});
el('daily-tasks-available')?.addEventListener('click',()=>{historyVisible=false;render();});
el('daily-task-history-more')?.addEventListener('click',()=>{historyLimit+=50;render();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!el('daily-tasks-page')?.hidden)watch();});
window.HubDailyTasks={init(database,account){stop();db=database;user=account;rows=[];receipts=[];taskReady=false;receiptReady=false;failed=false;cached=false;historyVisible=false;historyLimit=50;drafts.clear();busy.clear();el('daily-task-message').textContent='';render();if(!el('daily-tasks-page')?.hidden)watch();},show(active){if(active)watch();else stop();},stop(){stop();user=null;rows=[];receipts=[];taskReady=false;receiptReady=false;historyVisible=false;historyLimit=50;drafts.clear();busy.clear();el('daily-task-message').textContent='';render();}};
})();
