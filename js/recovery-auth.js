(function(){
'use strict';
function realEmail(value){return typeof value==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)&&!value.toLowerCase().endsWith('@accounts.task-reward-hub.invalid');}
function endpoint(){const value=window.TASK_REWARD_HUB_TELEGRAM_AUTH?.endpoint;if(!value||!/^https:\/\/[^/]+\/?$/.test(value))throw Error('Recovery server প্রস্তুত হয়নি।');return value.replace(/\/$/,'');}
async function ready(){const r=await fetch(endpoint()+'/health',{cache:'no-store',signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok||!d.configured||d.passwordRecovery!==true)throw Error('Recovery server update বাকি। এখনো email পরিবর্তন করা হয়নি।');}
async function signInUsername(auth,username,password){
 const r=await fetch(endpoint()+'/password-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:username.trim().toLowerCase(),password}),cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(25000)});
 const d=await r.json();if(!r.ok||!d.ok||typeof d.customToken!=='string')throw Error(d.code==='NOT_FOUND'?'Username login server update বাকি। আগে Recovery Email যুক্ত করলে সেই email দিয়ে login করুন।':'Username/password যাচাই হয়নি। Recovery Email অথবা Telegram Login ব্যবহার করতে পারেন।');
 await auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);return auth.signInWithCustomToken(d.customToken);
}
async function reserve(db,user,profile){
 const username=profile.usernameLower;
 if(!username)return; // Older accounts created with a real Auth email have no username alias.
 if(!/^[a-z0-9_]{3,24}$/.test(username))throw Error('Username যাচাই করা যায়নি। Support-এ যোগাযোগ করুন।');
 const ref=db.collection('usernameClaims').doc(username);
 await db.runTransaction(async tx=>{const snapshot=await tx.get(ref);if(snapshot.exists){if(snapshot.data().uid!==user.uid||snapshot.data().username!==username)throw Error('Username অন্য account-এ যুক্ত। Email পরিবর্তন করা হয়নি।');return;}tx.set(ref,{uid:user.uid,username,createdAt:window.firebase.firestore.FieldValue.serverTimestamp()});});
}
async function configure(auth,db,email,password){
 email=email.trim();if(!realEmail(email))throw Error('আপনার ব্যবহারযোগ্য আসল email address দিন।');
 await ready();const user=auth.currentUser;if(!user)throw Error('আপনার account login যাচাই করুন।');const uid=user.uid;
 if(password)await user.reauthenticateWithCredential(window.firebase.auth.EmailAuthProvider.credential(user.email,password));
 const snapshot=await db.collection('users').doc(uid).get();if(!snapshot.exists)throw Error('Account profile পাওয়া যায়নি।');
 await reserve(db,user,snapshot.data());if(auth.currentUser?.uid!==uid)throw Error('Account পরিবর্তিত হয়েছে। আবার চেষ্টা করুন।');
 await user.verifyBeforeUpdateEmail(email);
 // Never mark the email verified or overwrite Auth email from client profile data.
 return email;
}
window.HubRecovery={realEmail,ready,signInUsername,reserve,configure};
})();
