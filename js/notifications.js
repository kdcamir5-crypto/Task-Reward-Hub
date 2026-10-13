// Notification Center: local browser inbox; does not alter real-money balances.
(function(){
  'use strict';
  const $=s=>document.querySelector(s);
  const session=Store.get('session','guest');
  const key='hub-notifications:'+session;
  const snapshotKey='hub-notification-snapshot:'+session;
  const icons={welcome:'👋',achievement:'🏅',streak:'🔥',spin:'🎡',box:'🎁',system:'🔔'};
  const now=()=>new Date().toISOString();
  let filter='all';
  function read(){const v=Store.get(key,[]);return Array.isArray(v)?v:[]}
  function save(items){Store.set(key,items)}
  function addOnce(id,type,title,message){
    const items=read();if(items.some(n=>n.id===id))return;
    items.unshift({id,type,title,message,time:now(),read:false});save(items);
  }
  function seed(){
    if(!Store.get('hub-notification-initialized:'+session,false)){
      addOnce('welcome-'+session,'welcome','নোটিফিকেশন সেন্টারে স্বাগতম','আপনার টাস্ক, স্ট্রিক ও ভার্চুয়াল ব্যাজের আপডেট এখানে দেখতে পাবেন।');
      addOnce('first-task-'+session,'system','আপনার পরবর্তী ধাপ','ডেইলি টাস্ক সম্পন্ন করুন এবং অ্যাচিভমেন্ট পেজে আপনার অগ্রগতি দেখুন।');
      Store.set('hub-notification-initialized:'+session,true);
    }
  }
  function metricSnapshot(){
    const paths=['lucky-spin:'+session,'daily-streak:'+session,'mystery-box:'+session,'achievements:'+session];
    const data={};paths.forEach(k=>data[k]=Store.get(k,null));return data;
  }
  function scanChanges(){
    const current=metricSnapshot(),previous=Store.get(snapshotKey,null);
    if(previous){
      const s=current['lucky-spin:'+session],p=previous['lucky-spin:'+session];
      const sc=x=>x&&typeof x==='object'?(x.spins??x.totalSpins??x.spinCount??0):0;
      if(sc(s)>sc(p))addOnce('spin-'+sc(s)+'-'+session,'spin','লাকি স্পিন আপডেট','আপনার স্পিন অগ্রগতি আপডেট হয়েছে। পেজে গিয়ে বিস্তারিত দেখুন।');
      const st=current['daily-streak:'+session],pst=previous['daily-streak:'+session];
      const streak=x=>x&&typeof x==='object'?(x.current??x.currentStreak??x.streak??0):0;
      if(streak(st)>streak(pst))addOnce('streak-'+streak(st)+'-'+session,'streak','ডেইলি স্ট্রিক বেড়েছে!','নিয়মিত চেক-ইন চালিয়ে যান। আপনার স্ট্রিকের অগ্রগতি আপডেট হয়েছে।');
      const bx=current['mystery-box:'+session],pb=previous['mystery-box:'+session];
      const boxes=x=>x&&typeof x==='object'?(x.boxes??x.opened??x.totalBoxes??x.openCount??0):0;
      if(boxes(bx)>boxes(pb))addOnce('box-'+boxes(bx)+'-'+session,'box','মিস্ট্রি বক্স খোলা হয়েছে','আপনার মিস্ট্রি বক্সের অগ্রগতি আপডেট হয়েছে।');
      const ac=current['achievements:'+session],pac=previous['achievements:'+session];
      const count=x=>Array.isArray(x)?x.length:x&&typeof x==='object'?(Array.isArray(x.unlocked)?x.unlocked.length:Array.isArray(x.badges)?x.badges.length:0):0;
      if(count(ac)>count(pac))addOnce('achievement-'+count(ac)+'-'+session,'achievement','নতুন ব্যাজ আনলক হয়েছে!','অ্যাচিভমেন্ট পেজে গিয়ে আপনার ব্যাজগুলো দেখুন।');
    }
    Store.set(snapshotKey,current);
  }
  function fmt(value){try{return new Intl.DateTimeFormat('bn-BD',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}catch{return ''}}
  function render(){
    const all=read(),unread=all.filter(n=>!n.read).length;
    $('#totalCount').textContent=all.length;$('#unreadCount').textContent=unread;
    const list=$('#noticeList');const visible=all.filter(n=>filter==='all'||(filter==='unread'&&!n.read)||(filter==='achievement'&&['achievement','streak','spin','box'].includes(n.type)));
    if(!visible.length){list.innerHTML='<div class="empty-state"><div class="empty-icon">✨</div><strong>এখানে আপাতত কিছু নেই</strong><span>নতুন আপডেট এলে এখানে দেখা যাবে।</span></div>';return}
    list.innerHTML=visible.map(n=>'<article class="notice-item '+(!n.read?'unread':'')+'"><div class="notice-icon">'+(icons[n.type]||icons.system)+'</div><div class="notice-content"><h2>'+esc(n.title)+'</h2><p>'+esc(n.message)+'</p><span class="notice-time">'+esc(fmt(n.time))+'</span></div><div class="notice-actions">'+(!n.read?'<span class="unread-dot" aria-label="নতুন"></span>':'')+'<button class="item-action" data-read="'+esc(n.id)+'" type="button">'+(n.read?'পড়া হয়েছে':'পড়ে ফেলুন')+'</button><button class="item-action" data-delete="'+esc(n.id)+'" type="button">মুছুন</button></div></article>').join('');
  }
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  seed();scanChanges();render();
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));render()}));
  $('#readAll').addEventListener('click',()=>{save(read().map(n=>({...n,read:true})));render()});
  $('#clearAll').addEventListener('click',()=>{if(!read().length)return;if(confirm('সব নোটিফিকেশন মুছে ফেলবেন?')){save([]);render()}});
  $('#noticeList').addEventListener('click',e=>{const r=e.target.closest('[data-read]'),d=e.target.closest('[data-delete]');if(r){save(read().map(n=>n.id===r.dataset.read?({...n,read:true}):n));render()}if(d){save(read().filter(n=>n.id!==d.dataset.delete));render()}});
})();