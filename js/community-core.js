/* Text-only public community posts. No wallet or media writes. */
(function(root){
'use strict';
function text(value){if(typeof value!=='string')throw new Error('পোস্টের লেখা দিন।');const t=value.trim();if(!t||t.length>2000)throw new Error('১–২০০০ অক্ষরের লেখা দিন।');return t;}
function time(value){if(value?.toMillis)return value.toMillis();if(typeof value?.seconds==='number')return value.seconds*1000;return 0;}
function sort(rows){return [...rows].sort((a,b)=>time(b.createdAt)-time(a.createdAt)||String(a.id).localeCompare(String(b.id)));}
function query(db,uid,view){const ref=db.collection('communityPosts');return view==='mine'?ref.where('uid','==',uid):ref.orderBy('createdAt','desc').limit(50);}
async function publish(db,F,user,input,id){
 const body=text(input);if(!user?.uid)throw new Error('আগে login করুন।');
 const ref=id?db.collection('communityPosts').doc(id):db.collection('communityPosts').doc();
 await db.runTransaction(async tx=>{
  const [existing,profile]=await Promise.all([tx.get(ref),tx.get(db.collection('users').doc(user.uid))]);
  if(existing.exists){if(existing.data().uid===user.uid&&existing.data().text===body)return;throw new Error('Post ID মিলছে না। আবার চেষ্টা করুন।');}
  if(!profile.exists)throw new Error('Account profile পাওয়া যায়নি।');const p=profile.data();
  const authorName=p.name===undefined?(p.fullName===undefined?'Member':p.fullName):p.name;
  if(typeof authorName!=='string'||!authorName.length||authorName.length>200)throw new Error('Profile-এর নাম যাচাই করুন।');
  tx.set(ref,{uid:user.uid,authorName,collectorId:p.collectorId||'',text:body,createdAt:F.serverTimestamp()});
 });return ref.id;
}
async function remove(db,user,id){
 if(!user?.uid||!id)throw new Error('Login অথবা post পাওয়া যায়নি।');
 const ref=db.collection('communityPosts').doc(id);
 await db.runTransaction(async tx=>{
  const [post,actor]=await Promise.all([tx.get(ref),tx.get(db.collection('users').doc(user.uid))]);
  if(!post.exists)return;
  if(post.data().uid!==user.uid&&(!actor.exists||actor.data().role!=='admin'))throw new Error('এই পোস্ট সরানোর অনুমতি নেই।');
  tx.delete(ref);
 });
}
const api={text,time,sort,query,publish,remove};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HubCommunity=api;
})(typeof window!=='undefined'?window:globalThis);
