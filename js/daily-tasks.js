(function(){
'use strict';
const Core=window.HubDailyTaskCore,el=id=>document.getElementById(id),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db,user,rows=[],receipts=[],taskReady=false,receiptReady=false,failed=false,cached=false,busy=new Set(),drafts=new Map(),unsubscribers=[],generation=0,timer;
function render(){
 const list=el('daily-task-list');if(!list)return;const ready=taskReady&&receiptReady&&!failed;
 const visible=ready?Core.available(rows,receipts):[];
 const active=document.activeElement,focusId=active?.matches('[data-daily-proof]')?active.dataset.dailyProof:null,start=active?.selectionStart,end=active?.selectionEnd;
 list.innerHTML=visible.length?visible.map(t=>{let url='';try{url=Core.link(t.url);}catch(_){}return '<article class="dt-card"><div class="dt-card-title"><h2>'+escape(t.title)+'</h2><strong>৳'+(t.rewardMinor/100).toFixed(2)+'</strong></div><p class="dt-description">'+escape(t.description)+'</p>'+(url?'<a class="dt-link" href="'+escape(url)+'" target="_blank" rel="noopener noreferrer">কাজের লিংক খুলুন ↗</a>':'<p>Task link সঠিক নয়। Support-এ জানান।</p>')+'<form data-daily-submit="'+escape(t.id)+'"><label>কাজ শেষ করে লিখিত proof দিন<textarea data-daily-proof="'+escape(t.id)+'" rows="3" minlength="3" maxlength="1000" required placeholder="আপনার username বা কাজের প্রমাণ লিখুন">'+escape(drafts.get(t.id)||'')+'</textarea></label><button type="submit" '+(busy.has(t.id)||cached||!url?'disabled':'')+'>'+(busy.has(t.id)?'জমা হচ্ছে…':'Proof জমা দিন')+'</button></form></article>';}).join(''):'<div class="dt-empty">'+(!ready?(failed?'Task লোড হয়নি। Refresh করে আবার চেষ্টা করুন।':'Task লোড হচ্ছে…'):'এখন কোনো নতুন task নেই। পরের দিন admin নতুন task দিলে এখানে দেখাবে।')+'</div>';
 el('daily-task-source').textContent=!ready?'':cached?'সংরক্ষিত তথ্য দেখাচ্ছে। সংযোগ ফিরে এলে proof জমা দিতে পারবেন।':visible.length+'টি task বাকি • বাংলাদেশ সময় রাত ১২টায় শেষ হবে';
 if(focusId){const input=[...list.querySelectorAll('[data-daily-proof]')].find(x=>x.dataset.dailyProof===focusId);if(input){input.focus();input.setSelectionRange(start,end);}}
 clearTimeout(timer);if(!el('daily-tasks-page')?.hidden)timer=setTimeout(()=>{watch();},Math.max(50,Core.dayEnd()-Date.now()+50));
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
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!el('daily-tasks-page')?.hidden)watch();});
window.HubDailyTasks={init(database,account){stop();db=database;user=account;rows=[];receipts=[];drafts.clear();busy.clear();if(!el('daily-tasks-page')?.hidden)watch();},show(active){if(active)watch();else stop();},stop(){stop();user=null;rows=[];receipts=[];drafts.clear();busy.clear();}};
})();
