/* Size only Home's content to the real gap between the existing header and tabs. */
(()=>{
 'use strict';
 const body=document.body,home=document.querySelector('.home-reference-layout'),content=home?.querySelector('.home-fit-content');
 const header=document.querySelector('.app-shell>.topbar'),nav=document.querySelector('.bottom-nav');
 if(!home||!content||!header||!nav)return;
 let frame=0;
 function set(name,value){if(body.style.getPropertyValue(name)!==value)body.style.setProperty(name,value);}
 function update(){
  frame=0;
  const active=body.classList.contains('reference-home-active')&&!home.hidden;
  if(body.classList.contains('home-fit-active')!==active)body.classList.toggle('home-fit-active',active);
  if(!active)return;
  const viewport=window.visualViewport;
  const height=Math.max(1,Math.min(window.innerHeight,viewport?.height||window.innerHeight));
  set('--home-viewport-height',height+'px');
  const navRect=nav.getBoundingClientRect();
  set('--home-nav-space',Math.max(0,height-navRect.top)+'px');
  const available=home.clientHeight,natural=content.scrollHeight;
  if(available>0&&natural>0)set('--home-fit-scale',String(Math.min(1,Math.max(0,available-1)/natural)));
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(update);}
 new MutationObserver(schedule).observe(body,{attributes:true,attributeFilter:['class']});
 new MutationObserver(schedule).observe(home,{attributes:true,attributeFilter:['hidden']});
 new MutationObserver(schedule).observe(content,{childList:true,subtree:true,characterData:true});
 if(window.ResizeObserver){const observer=new ResizeObserver(schedule);[header,nav,home,content].forEach(el=>observer.observe(el));}
 window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);
 window.Telegram?.WebApp?.onEvent?.('viewportChanged',schedule);
 document.fonts?.ready.then(schedule);
 schedule();
})();
