(()=>{'use strict';
const path=location.pathname.split('/').pop()||'';
const isHome=path==='dashboard.html';
const items=[
 ['dashboard.html','Home','M3 10l9-7 9 7v10h-7v-7h-4v7H4z'],
 ['leaderboard.html','Rank','M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z'],
 ['mining-robot.html','AI Bot','M4 9h16v11H4zM12 9V4M9 14h.01M15 14h.01'],
 ['feed.html','Community','M21 11.5a8 8 0 0 1-12 7.6L3 21l2-6a8 8 0 0 1 8-12'],
 ['profile.html','Profile','M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10']
];
const nav=document.querySelector('.nav');
if(nav){
 nav.innerHTML=items.map(([href,label,d])=>'<a href="'+href+'" '+(path===href?'aria-current="page"':'')+'><svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+d+'"/></svg><span>'+label+'</span></a>').join('');
 nav.setAttribute('aria-label','Main navigation');
}
const supportSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13v-2a8 8 0 0 1 16 0v2M4 13a2 2 0 0 0 2 2h2v-5H6a2 2 0 0 0-2 2zM20 13a2 2 0 0 1-2 2h-2v-5h2a2 2 0 0 1 2 2z"/></svg>';
if(isHome){
 const top=document.querySelector('.hero__top');
 if(top&&!document.getElementById('support-headphones')){
  const button=document.createElement('button');
  button.className='round';button.id='support-headphones';button.type='button';
  button.setAttribute('aria-label','অ্যাডমিনের সঙ্গে যোগাযোগ');button.innerHTML=supportSvg;
  top.appendChild(button);
 }
}
const modal=document.createElement('div');
modal.className='shared-support-modal';modal.id='shared-support-modal';
modal.innerHTML='<div class="shared-support-card" role="dialog" aria-modal="true" aria-labelledby="shared-support-title"><div style="font-size:32px">🎧</div><h2 id="shared-support-title">অ্যাডমিনের সাথে যোগাযোগ</h2><p>যেকোনো সাহায্যের জন্য সরাসরি Telegram-এ অ্যাডমিনকে মেসেজ করুন।</p><a href="https://t.me/Kdcariyan1" target="_blank" rel="noopener noreferrer">Telegram-এ মেসেজ দিন ↗</a><button id="support-close" type="button">বন্ধ করুন</button></div>';
document.body.appendChild(modal);
document.addEventListener('click',event=>{
 if(event.target.closest('#shared-logout')&&window.hubLogout)window.hubLogout();
 if(event.target.closest('#support-headphones'))modal.classList.add('open');
 if(event.target.closest('#support-close')||event.target===modal)modal.classList.remove('open');
});
if(window.hubUser){
 window.hubUser.then(({uid,profile,email})=>{
  if(profile){
   const name=document.getElementById('shared-name');
   if(name)name.textContent=profile.name||email||'বন্ধু';
   const id=document.getElementById('shared-id');
   if(id)id.textContent='আইডি: '+(profile.refCode||'—');
   const avatar=document.getElementById('shared-avatar');
   if(avatar&&profile.avatarImage){
    avatar.textContent='';
    const image=document.createElement('img');image.src=profile.avatarImage;image.alt='প্রোফাইল ছবি';avatar.appendChild(image);
   }
  }
  if(!uid)return;
  return Promise.all([
   import('../js/firebase-config.js'),
   import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
  ]).then(([config,F])=>{
   const db=config.db;
   F.onSnapshot(F.doc(db,'users',uid),snapshot=>{
    if(!snapshot.exists())return;
    const data=snapshot.data()||{};
    const balance=Number(data.balance||0);
    if(!Number.isFinite(balance))return;
    const formatted='৳ '+balance.toFixed(2);
    ['shared-balance','balance','bal'].forEach(id=>{
     const element=document.getElementById(id);
     if(element)element.textContent=formatted;
    });
    const usd=document.getElementById('shared-usd');
    if(usd)usd.textContent='$'+(balance/110).toFixed(2);
    const bdt=document.getElementById('shared-bdt');
    if(bdt)bdt.textContent='≈ ৳'+balance.toFixed(2);
    const bots=Array.isArray(data.unlockedBots)?data.unlockedBots.length:0;
    const mineSub=document.getElementById('shared-mine-sub');
    if(mineSub)mineSub.textContent=bots?bots+'টি বট চালু':'AI Bot চালু নেই';
   },error=>console.warn('Realtime balance sync unavailable:',error&&error.code?error.code:'unknown error'));
   F.onSnapshot(F.collection(db,'users',uid,'botMining'),snapshot=>{
    let earned=0;
    snapshot.forEach(item=>{earned+=Number((item.data()||{}).earnedReward||0)});
    const mine=document.getElementById('shared-mine-total');
    if(mine)mine.textContent='৳ '+earned.toFixed(2);
   },error=>console.warn('Mining total unavailable:',error&&error.code?error.code:'unknown error'));
  });
 }).catch(error=>console.warn('Shared account setup unavailable:',error&&error.message?error.message:'unknown error'));
}
})();