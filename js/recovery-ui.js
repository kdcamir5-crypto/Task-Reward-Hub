(function(){
'use strict';
const el=id=>document.getElementById(id);let auth,db,busy=false;
function render(){const user=auth?.currentUser;if(!user)return;const email=window.HubRecovery.realEmail(user.email)?user.email:'';el('recovery-current').textContent=email?'Firebase email: '+email+(user.emailVerified?' · Verified':' · যাচাই বাকি'):'Recovery email এখনো যুক্ত নেই। Signup-এর contact email এখানে স্বয়ংক্রিয়ভাবে যুক্ত হয় না।';if(!el('recovery-email').value&&email)el('recovery-email').value=email;}
function message(text){el('recovery-message').textContent=text;}
window.HubRecoveryUI={init(database,authClient){db=database;auth=authClient;render();}};
el('recovery-form')?.addEventListener('submit',async event=>{
 event.preventDefault();if(busy||!auth?.currentUser)return;
 const input=el('recovery-password');busy=true;el('recovery-send').disabled=true;message('Recovery email যাচাইয়ের অনুরোধ হচ্ছে…');
 try{const email=await window.HubRecovery.configure(auth,db,el('recovery-email').value,input.value);message(email+'-এ verification link পাঠানো হয়েছে। Link নিশ্চিত করার পর এই email দিয়ে Forgot Password ব্যবহার করুন। Username login-ও থাকবে।');}
 catch(error){const code=error.code;message(code==='auth/requires-recent-login'?'এই নিরাপত্তা পরিবর্তন একবার বর্তমান password দিয়ে নিশ্চিত করুন। Password মনে না থাকলে যুক্ত Telegram Login দিয়ে আবার ঢুকে চেষ্টা করুন।':code==='auth/email-already-in-use'?'এই email অন্য account-এ যুক্ত আছে। অন্য email দিন।':code==='auth/invalid-credential'||code==='auth/wrong-password'?'বর্তমান password সঠিক নয়।':code==='permission-denied'?'Recovery-এর নতুন Firestore rules এখনো publish হয়নি।':code==='auth/too-many-requests'?'বেশি চেষ্টা হয়েছে। কিছুক্ষণ পরে চেষ্টা করুন।':code==='auth/operation-not-allowed'?'Firebase এই email পরিবর্তন অনুমোদন করেনি। Support-এ যোগাযোগ করুন।':error.message||'অনুরোধ সম্পন্ন হয়নি।');}
 finally{input.value='';busy=false;el('recovery-send').disabled=false;}
});
el('recovery-refresh')?.addEventListener('click',async()=>{
 if(busy||!auth?.currentUser)return;busy=true;el('recovery-refresh').disabled=true;
 try{await auth.currentUser.reload();render();message(auth.currentUser?.emailVerified&&window.HubRecovery.realEmail(auth.currentUser.email)?'Recovery email যাচাই হয়েছে। এই email দিয়ে password reset করতে পারবেন।':'Verification link নিশ্চিত করে আবার পরীক্ষা করুন।');}
 catch(_){message('যাচাইয়ের পরে Firebase আবার পরিচয় নিশ্চিত করতে বললে আপনার Recovery Email দিয়ে login করুন।');}
 finally{busy=false;el('recovery-refresh').disabled=false;}
});
})();
