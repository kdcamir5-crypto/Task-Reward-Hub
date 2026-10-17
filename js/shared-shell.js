(()=>{'use strict';const path=location.pathname.split('/').pop()||'',isHome=path==='dashboard.html';const items=[['dashboard.html','হোম','M3 10l9-7 9 7v10h-7v-7h-4v7H4z'],['leaderboard.html','র‍্যাঙ্ক','M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z'],['mining-robot.html','AI Bot Shop','M4 9h16v11H4zM12 9V4M9 14h.01M15 14h.01'],['feed.html','ফিড','M21 11.5a8 8 0 0 1-12 7.6L3 21l2-6a8 8 0 0 1 8-12'],['profile.html','প্রোফাইল','M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10']];const nav=document.querySelector('.nav');if(nav)nav.innerHTML=items.map(([h,l,d])=>'<a href="'+h+'" '+(path===h?'aria-current="page"':'')+'><svg viewBox="0 0 24 24"><path d="'+d+'"/></svg><span>'+l+'</span></a>').join('');const svg='<svg viewBox="0 0 24 24"><path d="M4 13v-2a8 8 0 0 1 16 0v2M4 13a2 2 0 0 0 2 2h2v-5H6a2 2 0 0 0-2 2zM20 13a2 2 0 0 1-2 2h-2v-5h2a2 2 0 0 1 2 2z"/></svg>';if(isHome){const t=document.querySelector('.hero__top');if(t&&!document.getElementById('support-headphones')){const b=document.createElement('button');b.className='round';b.id='support-headphones';b.type='button';b.setAttribute('aria-label','অ্যাডমিনের সঙ্গে যোগাযোগ');b.innerHTML=svg;t.insertBefore(b,t.lastElementChild)}}else if(!document.querySelector('.shared-header')){const app=document.querySelector('.app')||document.body,old=app.querySelector('header'),h=document.createElement('header');h.className='shared-header';h.hidden=false;h.style.display='block';h.innerHTML='<div class="shared-header-top"><a class="shared-brand" href="dashboard.html"><span class="shared-brand-mark">TR</span>Task Reward Hub</a><div class="shared-actions"><button class="shared-action" id="support-headphones" type="button" aria-label="অ্যাডমিনের সঙ্গে যোগাযোগ">'+svg+'</button><a class="shared-action" href="notifications.html" aria-label="নোটিফিকেশন">♧</a></div></div><div class="shared-user"><div class="shared-avatar" id="shared-avatar">👤</div><div class="shared-user-copy"><strong id="shared-name">স্বাগতম</strong><small id="shared-id">Collector ID: —</small><div class="shared-user-pills"><span class="shared-pill">♛ Verified Member</span><span class="shared-pill">◈ Level 1: Starter Novice</span></div></div></div><div class="shared-balances"><div class="shared-balance"><small>BDT BALANCE</small><strong id="shared-balance">৳ 0.00</strong><em>+ Withdraw</em></div><div class="shared-balance green"><small>USD EQUIV.</small><strong id="shared-usd">$0.00</strong><em id="shared-bdt">≈ ৳0.00</em></div></div>';app.insertBefore(h,app.firstChild);h.hidden=false;h.removeAttribute('aria-hidden');h.style.setProperty('display','block','important');h.style.setProperty('visibility','visible','important');h.style.setProperty('opacity','1','important');const m=app.querySelector('main');if(m)m.style.paddingTop='14px'}const modal=document.createElement('div');modal.className='shared-support-modal';modal.id='shared-support-modal';modal.innerHTML='<div class="shared-support-card" role="dialog" aria-modal="true"><div style="font-size:32px">🎧</div><h2>অ্যাডমিনের সাথে যোগাযোগ করতে মেসেজ দিন</h2><p>যেকোনো সাহায্যের জন্য সরাসরি Telegram-এ অ্যাডমিনকে মেসেজ করুন।</p><a href="https://t.me/Kdcariyan1" target="_blank" rel="noopener noreferrer">Telegram-এ মেসেজ দিন ↗</a><button id="support-close" type="button">বন্ধ করুন</button></div>';document.body.appendChild(modal);document.addEventListener('click',e=>{if(e.target.closest('#support-headphones'))modal.classList.add('open');if(e.target.closest('#support-close')||e.target===modal)modal.classList.remove('open')});if(window.hubUser)window.hubUser.then(({profile,email})=>{if(!profile)return;const n=document.getElementById('shared-name');if(n)n.textContent=profile.name||email;const id=document.getElementById('shared-id');if(id)id.textContent='Collector ID: '+(profile.refCode||'TRH00000');const v=Number(profile.balance)||0;const b=document.getElementById('shared-balance');if(b)b.textContent='৳ '+v.toFixed(2);const u=document.getElementById('shared-usd');if(u)u.textContent='$'+(v/110).toFixed(2);const bd=document.getElementById('shared-bdt');if(bd)bd.textContent='≈ ৳'+v.toFixed(2);const a=document.getElementById('shared-avatar');if(a&&profile.avatarImage){a.textContent='';const im=document.createElement('img');im.src=profile.avatarImage;im.alt='প্রোফাইল ছবি';a.appendChild(im)}}).catch(()=>{});
/*
 * Realtime balance sync for every page using the shared shell.
 * Firestore users/{uid} remains the single source of truth; this is read-only.
 */
if(window.hubUser){
  window.hubUser.then(async({uid})=>{
    if(!uid)return;
    try{
      const [{db},F]=await Promise.all([
        import('../js/firebase-config.js'),
        import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
      ]);
      F.onSnapshot(F.doc(db,'users',uid),(snap)=>{
        if(!snap.exists())return;
        const data=snap.data()||{};
        const balance=Number(data.balance||0);
        if(!Number.isFinite(balance))return;
        const formatted='৳ '+balance.toFixed(2);
        ['shared-balance','balance','bal'].forEach(id=>{
          const el=document.getElementById(id);
          if(el)el.textContent=formatted;
        });
        const usd=document.getElementById('shared-usd');
        if(usd)usd.textContent=String.fromCharCode(36)+(balance/110).toFixed(2);
        const bdt=document.getElementById('shared-bdt');
        if(bdt)bdt.textContent='≈ ৳'+balance.toFixed(2);
      },(error)=>{
        console.warn('Realtime balance sync unavailable:',error&&error.code?error.code:'unknown error');
      });
    }catch(error){
      console.warn('Could not start realtime balance sync:',error&&error.message?error.message:'unknown error');
    }
  }).catch(()=>{});
})();