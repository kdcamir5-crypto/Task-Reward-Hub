/* Profile subviews and viewport fitting; account mutations stay in their existing handlers. */
(()=>{
 'use strict';
 const body=document.body,panel=document.getElementById('panel-profile'),viewport=panel?.querySelector('.profile-fit-viewport');
 const header=document.querySelector('.app-shell>.topbar'),nav=document.querySelector('.bottom-nav');
 if(!panel||!viewport||!header||!nav)return;
 const views=[...panel.querySelectorAll('[data-profile-view]')];let frame=0;
 function set(name,value){if(body.style.getPropertyValue(name)!==value)body.style.setProperty(name,value);}
 function schedule(){if(!frame)frame=requestAnimationFrame(update);}
 function update(){
  frame=0;
  const active=!panel.hidden&&panel.classList.contains('is-active')&&getComputedStyle(panel).display!=='none';
  if(body.classList.contains('profile-fit-active')!==active)body.classList.toggle('profile-fit-active',active);
  if(!active)return;
  const height=Math.max(1,Math.min(window.innerHeight,window.visualViewport?.height||window.innerHeight));
  set('--profile-viewport-height',height+'px');
  set('--profile-nav-space',Math.max(0,height-nav.getBoundingClientRect().top)+'px');
  const content=views.find(view=>!view.hidden),natural=content?.scrollHeight,available=viewport.clientHeight;
  if(natural>0&&available>0)set('--profile-fit-scale',String(Math.min(1,Math.max(0,available-1)/natural)));
 }
 function recoveryTab(tab){
  panel.querySelectorAll('[data-recovery-tab]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.recoveryTab===tab)));
  document.getElementById('recovery-form').hidden=tab!=='email';
  document.getElementById('profile-password-form').hidden=tab!=='password';schedule();
 }
 function show(view){views.forEach(el=>{el.hidden=el.dataset.profileView!==view;});schedule();}
 function reset(){show('main');recoveryTab('email');}
 window.HubProfileViews={reset,open(view){window.dispatchEvent(new CustomEvent('hub-profile-open'));show(view==='avatar'?'avatar':'recovery');if(view!=='avatar')recoveryTab('email');}};
 document.getElementById('profile-recovery-open')?.addEventListener('click',()=>show('recovery'));
 panel.querySelectorAll('[data-profile-back]').forEach(button=>button.addEventListener('click',reset));
 panel.querySelectorAll('[data-recovery-tab]').forEach(button=>button.addEventListener('click',()=>recoveryTab(button.dataset.recoveryTab)));
 const picture=document.getElementById('user-avatar');
 if(picture){picture.setAttribute('role','button');picture.setAttribute('tabindex','0');picture.setAttribute('aria-label','Change profile picture or avatar');picture.addEventListener('click',()=>window.HubProfileViews.open('avatar'));picture.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();window.HubProfileViews.open('avatar');}});}
 const confirm=document.getElementById('telegram-confirm-dialog');
 document.getElementById('telegram-confirm-submit')?.addEventListener('click',()=>document.getElementById('telegram-login-link')?.click());
 document.getElementById('telegram-confirm-close')?.addEventListener('click',()=>confirm?.close());
 confirm?.addEventListener('close',()=>{document.getElementById('telegram-link-password').value='';});
 new MutationObserver(schedule).observe(body,{attributes:true,attributeFilter:['class']});
 new MutationObserver(schedule).observe(panel,{attributes:true,attributeFilter:['class','hidden'],childList:true,subtree:true,characterData:true});
 if(window.ResizeObserver){const observer=new ResizeObserver(schedule);[header,nav,viewport,...views].forEach(el=>observer.observe(el));}
 window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);
 window.Telegram?.WebApp?.onEvent?.('viewportChanged',schedule);document.fonts?.ready.then(schedule);schedule();
})();
