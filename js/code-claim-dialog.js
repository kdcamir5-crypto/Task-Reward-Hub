/* Presentation only: reward verification/credit remains in the existing form handler. */
(()=>{
 'use strict';
 const dialog=document.getElementById('code-claim-dialog'),input=document.getElementById('home-claim-code');
 if(!dialog||!input)return;
 let opener=null;
 document.querySelectorAll('[data-code-claim-open]').forEach(button=>{
  button.setAttribute('aria-haspopup','dialog');
  button.setAttribute('aria-controls',dialog.id);
  button.addEventListener('click',()=>{
   opener=button;
   if(!dialog.open)dialog.showModal();
   input.focus({preventScroll:true});
  });
 });
 document.getElementById('code-claim-close')?.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{
  if(event.target!==dialog)return;
  const r=dialog.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
 });
 dialog.addEventListener('close',()=>opener?.focus({preventScroll:true}));
})();
