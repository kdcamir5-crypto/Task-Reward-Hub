(function(){
'use strict';
const Core=window.HubBotPurchase;
let db,user,profile={},selected=null,referrer=null,refLoading=false,refError='',method='wallet',settings=null,busy=false,orders=[],unsubscribeSettings,unsubscribeOrders,lookupVersion=0;
const el=id=>document.getElementById(id),money=n=>Number(n).toFixed(2),escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function mount(){
 if(el('bot-checkout'))return;
 const host=el('bot-shop-page');if(!host)return;
 const section=document.createElement('section');section.id='bot-checkout';section.className='bot-checkout';section.hidden=true;
 section.innerHTML=`<div class="bc-header"><h2>🛡️ বট ক্রয় ও সক্রিয়করণ নিশ্চিতকরণ</h2><button type="button" id="bc-close" aria-label="বন্ধ করুন">×</button></div>
 <div class="bc-identity"><span>🤖</span><div><h3 id="bc-name"></h3><p id="bc-engine"></p></div><b>⚡</b></div>
 <div class="bc-details"><div><span>আসল টাকা (বটের মূল্য)</span><b id="bc-price"></b></div><div><span>৬০% অতিরিক্ত লাভ</span><b id="bc-profit"></b></div><div class="bc-total"><strong>মোট রিটার্ন পাবেন (১৬০%)</strong><b id="bc-target"></b></div><div><span>অতিরিক্ত ডলার বোনাস 💵</span><b id="bc-bonus"></b></div><div class="bc-gift"><span>🎁 রেফারেল বোনাস (৫%)</span><b id="bc-commission"></b></div><div><span>বর্তমান ওয়ালেট ব্যালেন্স</span><b id="bc-balance"></b></div></div>
 <fieldset class="bc-methods"><legend>পেমেন্ট পদ্ধতি বেছে নিন</legend><label><input type="radio" name="bot-method" value="wallet" checked> 👛 Wallet Balance</label><label><input type="radio" name="bot-method" value="bKash"> 📱 সরাসরি bKash</label></fieldset>
 <div class="bc-alert" id="bc-insufficient" hidden>🚫 ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই! দয়া করে ওয়ালেট রিচার্জ করুন।</div>
 <div class="bc-referral"><label for="bc-ref-code">রেফার কোড / কালেক্টর ID <b>৫% কমিশন</b></label><div class="bc-input-row"><span>#</span><input id="bc-ref-code" inputmode="numeric" maxlength="8" placeholder="রেফারারের ৮ সংখ্যার ID"><button id="bc-verify-ref" type="button">যাচাই</button></div><p id="bc-ref-result" role="status"></p><small id="bc-ref-note"></small></div>
 <div id="bc-bkash" class="bc-payment" hidden><h4>bKash Personal — Send Money</h4><div class="bc-number"><strong id="bc-number">Not configured</strong><button id="bc-copy" type="button">Copy</button></div><p id="bc-instructions"></p><p>সঠিক পরিমাণ Send Money করে নিচের তথ্য দিন। Admin পেমেন্ট যাচাই করে Approve করলে বট আনলক হবে।</p><label for="bc-sender">আপনার bKash নম্বর</label><input id="bc-sender" type="tel" inputmode="numeric" maxlength="11" placeholder="01XXXXXXXXX"><label for="bc-trx">Transaction ID</label><input id="bc-trx" maxlength="100" autocomplete="off" placeholder="bKash Transaction ID"></div>
 <p id="bc-message" class="bc-message" role="status" aria-live="polite"></p><button id="bc-submit" class="bc-submit" type="button"></button><button id="bc-recharge" class="bc-recharge" type="button" hidden>ওয়ালেট রিচার্জ করুন →</button><p class="bc-footnote">মাইনিং মেয়াদ ৩০ দিন। কেনা সফল হলে প্যাকেজের ডলার বোনাস USD Balance-এ একবার জমা হয়।</p>`;
 host.appendChild(section);
 el('bc-close').onclick=close;
 section.querySelectorAll('[name="bot-method"]').forEach(r=>r.onchange=()=>{method=r.value;el('bc-message').textContent='';render();});
 el('bc-verify-ref').onclick=()=>resolveRef(el('bc-ref-code').value.trim());
 el('bc-ref-code').oninput=()=>{lookupVersion++;refLoading=false;referrer=null;refError='';render();};
 el('bc-copy').onclick=async()=>{if(!paymentReady())return;try{await navigator.clipboard.writeText(settings.bkashNumber);el('bc-message').textContent='bKash নম্বর কপি হয়েছে।';}catch(_){el('bc-message').textContent='নম্বরটি সিলেক্ট করে কপি করুন: '+settings.bkashNumber;}};
 el('bc-recharge').onclick=()=>{close();el('profile-shortcut-deposit')?.click();};
 el('bc-submit').onclick=submit;
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!section.hidden&&!busy)close();});
}
function paymentReady(){return settings&&settings.active===true&&/^01[3-9][0-9]{8}$/.test(settings.bkashNumber||'');}
function order(){return selected&&orders.find(o=>o.id===user.uid+'_'+selected.id);}
function render(){
 if(!selected||!el('bot-checkout'))return;
 const p=selected,balance=typeof profile.balance==='number'?profile.balance:null,already=Array.isArray(profile.unlockedBots)&&profile.unlockedBots.includes(p.id),pending=order()?.status==='pending';
 el('bc-name').textContent=p.name;el('bc-engine').textContent='মেয়াদ: ৩০ দিন';
 el('bc-price').textContent='৳ '+money(p.price);el('bc-profit').textContent='+৳ '+money(p.target-p.price)+' (৬০%)';el('bc-target').textContent='৳ '+money(p.target);el('bc-bonus').textContent='+$'+money(p.bonus)+' USD';el('bc-commission').textContent='+৳ '+money(p.price/20);el('bc-balance').textContent=balance===null?'লোড হচ্ছে…':'৳ '+money(balance);
 const insufficient=method==='wallet'&&balance!==null&&balance<p.price&&!already&&!pending;
 el('bc-insufficient').hidden=!insufficient;el('bc-recharge').hidden=!insufficient;el('bc-bkash').hidden=method!=='bKash';
 el('bc-number').textContent=paymentReady()?settings.bkashNumber:'Admin payment নম্বর চালু করেননি';el('bc-copy').disabled=!paymentReady();el('bc-instructions').textContent=settings?.instructions||'';
 el('bc-ref-result').textContent=refLoading?'রেফারার যাচাই হচ্ছে…':refError|| (referrer?'✓ রেফারার: '+referrer.displayName+' (কালেক্টর ID: #'+referrer.collectorId+')':'রেফারার থাকলে তার ৮ সংখ্যার Collector ID দিন।');
 el('bc-ref-note').textContent='💡 যিনি রেফার করেছেন তার ID বা কোড দিলে তিনি এই প্যাকেজে ৫% রেফার বোনাস (+৳'+money(p.price/20)+') পাবেন।';
 const code=el('bc-ref-code').value.trim(),badRef=refLoading||!!refError||(!!code&&!referrer)||(!!Core.boundReferrer(profile)&&!referrer);
 const button=el('bc-submit');button.disabled=busy||already||pending||badRef||balance===null||(method==='wallet'?insufficient:!paymentReady());
 button.textContent=busy?'প্রক্রিয়া চলছে…':already?'✓ বট সক্রিয় আছে':pending?'⏳ Admin অনুমোদনের অপেক্ষায়':insufficient?'🔒 ব্যালেন্স অপ্রতুল (রিচার্জ করুন)':method==='wallet'?'🔓 Wallet দিয়ে কিনুন ও সক্রিয় করুন — ৳'+money(p.price):'পেমেন্ট তথ্য জমা দিন — ৳'+money(p.price);
 el('bc-close').disabled=busy;sectionControls(busy);
 if(pending)el('bc-message').textContent='আপনার পেমেন্ট জমা হয়েছে। Admin যাচাই করে Approve করলে বট আনলক হবে।';
 else if(order()?.status==='rejected'&&!busy&&!el('bc-message').textContent)el('bc-message').textContent='পূর্বের আবেদন বাতিল: '+(order().rejectionReason||'Admin rejected')+'। সংশোধন করে নতুন Transaction ID দিয়ে আবার জমা দিন।';
}
function sectionControls(disabled){document.querySelectorAll('#bot-checkout input,#bc-verify-ref').forEach(e=>e.disabled=disabled);}
async function resolveRef(code,uid){
 const version=++lookupVersion;refLoading=true;refError='';referrer=null;render();
 try{
  if(!uid&&!/^\d{8}$/.test(code))throw Error('রেফারারের সঠিক ৮ সংখ্যার Collector ID দিন।');
  const snap=uid?await db.collection('publicLeaderboard').doc(uid).get():await db.collection('publicLeaderboard').where('collectorId','==',code).limit(2).get();
  if(version!==lookupVersion)return;
  const doc=uid?(snap.exists?snap:null):(snap.docs.length===1?snap.docs[0]:null);
  if(!doc)throw Error('রেফারার পাওয়া যায়নি। রেফারারকে একবার অ্যাপ খুলতে বলুন, তারপর ID যাচাই করুন।');
  const data=doc.data();if(doc.id===user.uid)throw Error('নিজের Collector ID ব্যবহার করা যাবে না।');
  referrer={uid:doc.id,collectorId:data.collectorId,displayName:data.displayName};el('bc-ref-code').value=data.collectorId;
 }catch(error){if(version===lookupVersion)refError=error.message;}
 finally{if(version===lookupVersion){refLoading=false;render();}}
}
async function open(id){
 if(!db||!user)return;mount();selected=Core.packages[id];if(!selected)return;
 method='wallet';referrer=null;refError='';refLoading=false;lookupVersion++;
 const host=el('bot-shop-page');host.classList.add('checkout-open');el('bot-checkout').hidden=false;
 el('bc-message').textContent='';el('bc-ref-code').value='';el('bc-sender').value='';el('bc-trx').value='';document.querySelector('[name="bot-method"][value="wallet"]').checked=true;
 const bound=Core.boundReferrer(profile);el('bc-ref-code').readOnly=!!bound;el('bc-verify-ref').hidden=!!bound;
 render();el('bot-checkout').scrollIntoView({block:'start'});
 if(bound)resolveRef('',bound);
 else {const code=String(profile.purchaseReferrerCode||profile.referredByCode||profile.referrerCode||(/^\d{8}$/.test(profile.referredBy||'')?profile.referredBy:'')||'');if(code){el('bc-ref-code').value=code;resolveRef(code);}}
}
function close(){if(busy)return;el('bot-checkout').hidden=true;el('bot-shop-page').classList.remove('checkout-open');lookupVersion++;selected=null;}
async function submit(){
 if(busy||el('bc-submit').disabled)return;
 busy=true;render();
 try{
  await Core.purchase(db,window.firebase.firestore.FieldValue,user,selected.id,method,referrer,{senderNumber:el('bc-sender').value,trxId:el('bc-trx').value});
  el('bc-message').textContent=method==='wallet'?'✓ বট কেনা ও সক্রিয় হয়েছে। AI Bots-এ মাইনিং দেখুন।':'✓ পেমেন্ট জমা হয়েছে। Admin অনুমোদনের অপেক্ষায়।';
 }catch(error){el('bc-message').textContent=error.code==='permission-denied'?'ক্রয় সম্পন্ন হয়নি। একই Transaction ID আগে ব্যবহার হয়েছে কি না যাচাই করুন অথবা support-এ যোগাযোগ করুন।':error.message;}
 finally{busy=false;render();}
}
window.HubBotCheckout={open,updateProfile(data){profile=data||{};render();},init(database,account){
 db=database;user=account;mount();unsubscribeSettings?.();unsubscribeOrders?.();
 unsubscribeSettings=db.collection('appSettings').doc('paymentSettings').onSnapshot(s=>{settings=s.exists?s.data():null;render();},()=>{settings=null;render();});
 unsubscribeOrders=db.collection('botPurchaseRequests').where('uid','==',user.uid).onSnapshot(s=>{orders=s.docs.map(d=>({id:d.id,...d.data()}));render();},error=>{if(selected)el('bc-message').textContent='ক্রয়ের অবস্থা লোড হয়নি: '+error.message;});
}};
})();

