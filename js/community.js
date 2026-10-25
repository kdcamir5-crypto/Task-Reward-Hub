(function(){
'use strict';
const Core=window.HubCommunity,el=id=>document.getElementById(id);
let db,user=null,visible=false,view='public',rows=[],loading=false,error=false,fromCache=false,unsubscribe=null,version=0,busy=false,attempt=null,limit=50;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function date(value){const ms=Core.time(value);return ms?new Date(ms).toLocaleString('bn-BD',{timeZone:'Asia/Dhaka',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'Server confirmation-এর অপেক্ষায়';}
function render(){
 const list=el('feed-post-list');if(!list)return;
 const shown=rows.slice(0,limit);
 list.innerHTML=shown.length?shown.map(p=>'<article class="cf-post"><div class="cf-post-head"><span class="cf-avatar" aria-hidden="true">'+escape(String(p.authorName||'Member').trim().slice(0,1).toUpperCase())+'</span><div><strong>'+escape(p.authorName)+'</strong><small>'+escape(p.collectorId?'#'+p.collectorId:'Member')+' · '+escape(date(p.createdAt))+'</small></div>'+(p.uid===user?.uid?'<button type="button" data-community-delete="'+escape(p.id)+'">Delete</button>':'')+'</div><p class="cf-text">'+escape(p.text)+'</p></article>').join(''):'<div class="feed-empty-state"><strong>'+(loading?'পোস্ট লোড হচ্ছে…':error?'পোস্ট লোড করা যায়নি':'এখনো কোনো পোস্ট নেই')+'</strong><p>'+(error?'Connection ও নতুন Firestore rules পরীক্ষা করে Refresh করুন।':view==='mine'?'আপনার প্রকাশিত লেখা এখানে থাকবে।':'প্রথম লেখা পোস্টটি শেয়ার করুন।')+'</p></div>';
 const more=el('feed-load-more');if(more)more.hidden=rows.length<=limit;
 const count=view==='mine'?'আপনার '+rows.length+'টি পোস্ট':'সর্বশেষ সর্বোচ্চ ৫০টি পাবলিক পোস্ট';
 el('feed-source-status').textContent=error?'পোস্ট লোড হয়নি। Refresh করে আবার চেষ্টা করুন।':loading?'Firestore থেকে পোস্ট লোড হচ্ছে…':fromCache?'সংরক্ষিত পোস্ট দেখাচ্ছে; connection হলে আপডেট হবে।':count+' • নতুন পোস্ট সরাসরি আপডেট হবে';
 document.querySelectorAll('[data-feed-view]').forEach(b=>{const active=b.dataset.feedView===view;b.classList.toggle('is-active',active);b.setAttribute('aria-selected',String(active));});
}
function stop(){version++;if(unsubscribe)unsubscribe();unsubscribe=null;}
function watch(){
 stop();if(!visible||!db||!user)return;const token=version;rows=[];limit=50;loading=true;error=false;render();
 unsubscribe=Core.query(db,user.uid,view).onSnapshot({includeMetadataChanges:true},snapshot=>{if(token!==version)return;rows=Core.sort(snapshot.docs.map(d=>({...d.data(),id:d.id})));loading=false;error=false;fromCache=snapshot.metadata?.fromCache===true;render();},()=>{if(token!==version)return;loading=false;error=true;render();});
}
function init(nextDb,nextUser){
 stop();db=nextDb;user=nextUser;rows=[];view='public';attempt=null;busy=false;
 if(el('feed-post-text'))el('feed-post-text').value='';if(el('feed-compose-message'))el('feed-compose-message').textContent='';
 if(el('feed-submit'))el('feed-submit').disabled=false;
 visible=!el('panel-feed')?.hidden;if(visible)watch();else render();
}
el('feed-compose-form')?.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;const input=el('feed-post-text'),message=el('feed-compose-message'),button=el('feed-submit');
 if(!db||!user){message.textContent='Account লোড হয়নি। Login যাচাই করুন।';return;}
 let body;try{body=Core.text(input.value);}catch(e){message.textContent=e.message;return;}
 const postingUser=user,postingDb=db;const key=postingUser.uid+'|'+body;
 if(!attempt||attempt.key!==key)attempt={key,id:db.collection('communityPosts').doc().id};
 busy=true;button.disabled=true;message.textContent='পোস্ট প্রকাশ হচ্ছে…';
 try{await Core.publish(postingDb,window.firebase.firestore.FieldValue,postingUser,body,attempt.id);if(user?.uid!==postingUser.uid)return;attempt=null;if(input.value.trim()===body)input.value='';message.textContent='পোস্ট প্রকাশ হয়েছে।';}
 catch(e){if(user?.uid===postingUser.uid)message.textContent=e.code==='permission-denied'?'পোস্ট প্রকাশ হয়নি। নতুন Firestore rules Publish করা আছে কি না যাচাই করুন।':e.message||'Connection পরীক্ষা করে আবার চেষ্টা করুন।';}
 finally{if(user?.uid===postingUser.uid){busy=false;button.disabled=false;}}
});
el('feed-post-list')?.addEventListener('click',async event=>{
 const button=event.target.closest('[data-community-delete]');if(!button||!db||!user)return;
 const actor=user;button.disabled=true;el('feed-compose-message').textContent='';
 try{await Core.remove(db,actor,button.dataset.communityDelete);if(user?.uid===actor.uid)el('feed-compose-message').textContent='আপনার পোস্ট সরানো হয়েছে।';}
 catch(e){if(user?.uid===actor.uid)el('feed-compose-message').textContent='পোস্ট সরানো যায়নি। অনুমতি ও connection পরীক্ষা করুন।';button.disabled=false;}
});
document.querySelectorAll('[data-feed-view]').forEach(button=>button.addEventListener('click',()=>{view=button.dataset.feedView;watch();}));
el('feed-refresh')?.addEventListener('click',watch);
el('feed-load-more')?.addEventListener('click',()=>{limit+=50;render();});
window.HubFeed={init,show(active){if(visible===active&&(!active||unsubscribe))return;visible=active;if(active)watch();else stop();},stop(){visible=false;stop();user=null;rows=[];render();}};
const panel=el('panel-feed');
if(panel)new MutationObserver(()=>window.HubFeed.show(!panel.hidden)).observe(panel,{attributes:true,attributeFilter:['hidden']});
})();
