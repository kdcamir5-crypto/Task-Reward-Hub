/* Activate bounded queries only after the required indexes are confirmed ready. */
(function(root){
'use strict';
function create(db,uid,onChange,legacy,paged){
 let stopped=false,controller=null,profile,mining,hasProfile=false,hasMining=false;const errors=new Set();
 onChange({rows:[],errors:[],loading:true,fromCache:false,hasMore:false,loadingMore:false});
 async function start(){
  let ready=false;
  try{const snap=await db.collection('appSettings').doc('activityHistory').get({source:'server'});ready=snap.exists&&snap.data().pagingReady===true&&snap.data().version===1;}catch(_){}
  if(stopped)return;
  controller=(ready?paged:legacy).create(db,uid,onChange);
  if(hasProfile)controller.updateProfile(profile);
  if(hasMining)controller.updateMining(mining);
  for(const name of errors)controller.reportError(name);
 }
 void start();
 return {loadMore:async()=>{if(!stopped)await controller?.loadMore?.();},updateProfile(value){profile=value;hasProfile=true;errors.delete('profile');controller?.updateProfile(value);},updateMining(value){mining=value;hasMining=true;errors.delete('mining');controller?.updateMining(value);},reportError(name){errors.add(name);controller?.reportError(name);},stop(){stopped=true;controller?.stop();}};
}
if(typeof module!=='undefined'&&module.exports)module.exports={create};
else{const legacy=root.HubActivity,paged=root.HubPagedActivity;root.HubActivity={...legacy,create:(db,uid,onChange)=>create(db,uid,onChange,legacy,paged)};}
})(typeof window!=='undefined'?window:globalThis);
