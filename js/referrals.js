(function(){
'use strict';
let db,user,profile={},settings=null,incoming=null,stops=[];
const el=id=>document.getElementById(id);
function mount(){
 if(el('referral-verification'))return;const host=el('referral-page');if(!host)return;
 const panel=document.createElement('section');panel.id='referral-verification';panel.className='rv-panel';
 panel.innerHTML='<h3>আমার Referral Verification</h3><p>দুটি শর্ত পূরণ হলে আপনার রেফারার একটি বট পাবেন।</p><ul><li id="rv-registration"></li><li id="rv-channel"></li></ul><div class="rv-actions"><a href="https://t.me/freelancing_incom" target="_blank" rel="noopener noreferrer">➤ Channel-এ Join করুন</a><button id="rv-link" type="button">Telegram account যাচাই করুন</button></div><p id="rv-status" role="status"></p><small>যাচাইকারী bot-এ Start চাপার পর অ্যাপে ফিরুন। যাচাই স্বয়ংক্রিয়ভাবে চলে; ফলাফল আসতে কয়েক মিনিট লাগতে পারে।</small>';
 host.insertBefore(panel,host.querySelector('.rf-members'));
 el('rv-link').onclick=linkTelegram;
}
function render(){
 mount();if(!el('rv-status'))return;
 el('rv-registration').textContent=incoming?'✓ Referral link দিয়ে account তৈরি হয়েছে':'— এই account-এ signup referral সংরক্ষিত নেই';
 el('rv-channel').textContent=incoming?.channelVerified?'✓ @freelancing_incom-এ membership যাচাই হয়েছে':'○ @freelancing_incom-এ join ও Telegram account যাচাই করুন';
 el('rv-link').disabled=!!profile.telegramUserId||!settings?.active;
 el('rv-link').textContent=profile.telegramUserId?'✓ Telegram account যুক্ত আছে':'Telegram account যাচাই করুন';
 el('rv-status').textContent=incoming?.status==='verified'?'✓ Verified referral — আপনার রেফারার বট পেয়েছেন।':!settings?.active?'Telegram verification service এখনো প্রস্তুত হয়নি। Channel-এ join করে রাখতে পারেন।':profile.telegramUserId?'Telegram account যুক্ত আছে। দুটি শর্তের স্বয়ংক্রিয় যাচাইয়ের অপেক্ষায়।':'Telegram account যুক্ত করুন, bot-এ Start চাপুন, তারপর অ্যাপে ফিরুন।';
}
async function linkTelegram(){
 if(!settings?.active||!settings.botUsername||profile.telegramUserId)return;
 // Open synchronously so Telegram's browser popup policy does not block the link.
 const tab=window.open('about:blank','_blank');const button=el('rv-link');button.disabled=true;
 try{
  const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);const token=[...bytes].map(n=>n.toString(16).padStart(2,'0')).join('');
  await db.collection('telegramLinkRequests').doc(user.uid).set({uid:user.uid,token,expiresAtMs:Date.now()+15*60000,createdAt:window.firebase.firestore.FieldValue.serverTimestamp()});
  const url='https://t.me/'+encodeURIComponent(settings.botUsername)+'?start=verify_'+token;
  if(tab)tab.location.replace(url);else window.location.href=url;
  el('rv-status').textContent='Bot-এ Start চাপুন। তারপর অ্যাপে ফিরে অপেক্ষা করুন।';
 }catch(error){tab?.close();el('rv-status').textContent='যাচাই শুরু করা যায়নি। সংযোগ ও account-এর অবস্থা পরীক্ষা করুন।';console.error('Telegram link request failed:',error.code);}
 finally{button.disabled=!!profile.telegramUserId||!settings?.active;}
}
window.HubReferrals={updateProfile(data){profile=data||{};render();},init(database,account){
 stops.forEach(stop=>stop());stops=[];db=database;user=account;profile={};incoming=null;settings=null;render();
 stops.push(db.collection('appSettings').doc('referralSettings').onSnapshot(s=>{settings=s.exists?s.data():null;render();},()=>{settings=null;render();}));
 stops.push(db.collection('referrals').doc(user.uid).onSnapshot(s=>{incoming=s.exists?s.data():null;render();},()=>{el('rv-status').textContent='Referral verification লোড হয়নি।';}));
 const ownerUid=user.uid;
 stops.push(db.collection('referrals').where('referrerUid','==',ownerUid).onSnapshot({includeMetadataChanges:true},s=>{
  const rows=s.docs.map(d=>{const x=d.data();return {name:x.inviteeName||'Member',id:x.collectorId||d.id,code:x.collectorId,status:x.status==='verified'?'verified':'quarantine'};});
  window.dispatchEvent(new CustomEvent('hub-referrals-updated',{detail:{uid:ownerUid,rows,fromCache:s.metadata.fromCache,error:false}}));
 },()=>{window.dispatchEvent(new CustomEvent('hub-referrals-updated',{detail:{uid:ownerUid,rows:null,error:true}}));const list=el('referral-empty-copy');if(list)list.textContent='Referral তালিকা লোড করা যায়নি।';}));
}};
})();
