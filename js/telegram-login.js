(function(){
'use strict';
try{window.Telegram?.WebApp?.ready?.();}catch(_){/* Email login remains available outside Telegram. */}
const messages={
 TELEGRAM_NOT_LINKED:'এই Telegram এখনও কোনো account-এর সাথে যুক্ত নেই। Email/username দিয়ে login বা signup করে Profile থেকে Telegram Login যুক্ত করুন।',
 TELEGRAM_EXPIRED:'Telegram পরিচয়ের মেয়াদ শেষ। Mini App বন্ধ করে Telegram থেকে আবার খুলুন। Firebase থেকে sign out করতে হবে না।',
 INVALID_TELEGRAM:'Telegram পরিচয় যাচাই হয়নি। @Taskrewardhub_bot-এর Mini App থেকে খুলুন।',
 IDENTITY_CONFLICT:'এই Telegram বা account অন্য পরিচয়ের সাথে যুক্ত আছে। Support-এ যোগাযোগ করুন; account স্বয়ংক্রিয়ভাবে বদলানো হয়নি।',
 RECENT_LOGIN_REQUIRED:'একবার বর্তমান password দিয়ে Telegram link নিশ্চিত করুন। আপনার account sign out হবে না।',
 ACCOUNT_UNAVAILABLE:'এই account দিয়ে login অনুমোদিত হয়নি। Support-এ যোগাযোগ করুন।',
 PROFILE_MISSING:'আপনার account profile পাওয়া যায়নি। Support-এ যোগাযোগ করুন।',
 INVALID_TOKEN:'Firebase session যাচাই হয়নি। Account login যাচাই করে আবার চেষ্টা করুন।',
 SETUP_REQUIRED:'Telegram Login server-এর setup এখনো সম্পূর্ণ হয়নি। Email/username login ব্যবহার করুন।',
 SERVER_UNAVAILABLE:'Telegram Login server-এ সংযোগ হয়নি। Email/username login ব্যবহার করতে পারবেন।',
 UPSTREAM_UNAVAILABLE:'পরিচয় যাচাইয়ের service-এ সংযোগ হয়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।'
};
function error(code){return Object.assign(new Error(messages[code]||messages.SERVER_UNAVAILABLE),{code});}
function initData(){const data=window.Telegram?.WebApp?.initData;if(typeof data!=='string'||!data){const e=new Error('Telegram Login করতে @Taskrewardhub_bot-এর Mini App থেকে অ্যাপটি খুলুন।');e.code='OPEN_TELEGRAM';throw e;}return data;}
async function request(path,token){
 const raw=initData(),config=window.TASK_REWARD_HUB_TELEGRAM_AUTH;
 if(!config?.endpoint||!/^https:\/\/[^/]+(?:\/)?$/.test(config.endpoint))throw error('SETUP_REQUIRED');
 let response,data;try{response=await fetch(config.endpoint.replace(/\/$/,'')+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({initData:raw}),cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(25000)});data=await response.json();}catch(_){throw error('SERVER_UNAVAILABLE');}
 if(!response.ok||data.ok!==true)throw error(data.code);
 return data;
}
async function signIn(auth){
 const data=await request('/login');if(typeof data.customToken!=='string')throw error('SERVER_UNAVAILABLE');
 await auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);
 return auth.signInWithCustomToken(data.customToken);
}
async function link(auth,password=''){
 initData();const user=auth.currentUser;if(!user)throw error('INVALID_TOKEN');const uid=user.uid;
 if(password){if(!user.email)throw error('RECENT_LOGIN_REQUIRED');await user.reauthenticateWithCredential(window.firebase.auth.EmailAuthProvider.credential(user.email,password));}
 const token=await user.getIdToken(true);if(auth.currentUser?.uid!==uid)throw error('INVALID_TOKEN');
 return request('/link',token);
}
window.HubTelegramLogin={signIn,link};
})();
