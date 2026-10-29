'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');const root=path.resolve(__dirname,'..');
let html=fs.readFileSync(path.join(root,'pages/dashboard.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
html=html.replace(/<link\b[^>]*href="(\.\.\/css\/[^"?]+)(?:\?[^" ]*)?"[^>]*>/g,(_,href)=>'<style>'+fs.readFileSync(path.resolve(root,'pages',href),'utf8')+'</style>');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const [width,height] of [[320,568],[360,640],[375,667],[390,844],[430,932],[768,1024],[844,390]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setContent(html);
   await page.evaluate(()=>{
    window.testEvents=[];window.testWrites=[];window.testTelegram=[];
    const user={uid:'owner',email:'owner@example.com',displayName:'Owner',emailVerified:false,getIdToken:async()=>'test-token',reload:async()=>{user.emailVerified=true;},updateProfile:async()=>{},reauthenticateWithCredential:async c=>window.testEvents.push(['reauth',c.password]),updatePassword:async p=>window.testEvents.push(['password',p])};
    const auth={currentUser:user,setPersistence:async()=>{},onAuthStateChanged(){},signOut:()=>{window.testEvents.push(['signout']);return new Promise(()=>{});}};
    const db={collection:collection=>({doc:id=>({update:async patch=>window.testWrites.push({collection,id,patch}),onSnapshot:next=>{next({exists:false,data:()=>({})});return()=>{};}})})};
    const authFactory=Object.assign(()=>auth,{Auth:{Persistence:{LOCAL:'LOCAL'}},EmailAuthProvider:{credential:(email,password)=>({email,password})}});
    const firestoreFactory=Object.assign(()=>db,{FieldValue:{serverTimestamp:()=>({serverTimestamp:true})}});
    window.TASK_REWARD_HUB_FIREBASE_CONFIG={projectId:'test-only'};
    window.firebase={apps:[],auth:authFactory,firestore:firestoreFactory,initializeApp:()=>({auth:()=>auth,firestore:()=>db})};
    window.HubSpin={rewards:[]};
    window.HubTelegramLogin={link:async(_auth,password)=>{window.testTelegram.push(password);if(!password)throw Object.assign(new Error('বর্তমান password দিন'),{code:'RECENT_LOGIN_REQUIRED'});return{ok:true};}};
    window.HubRecovery={realEmail:e=>e?.endsWith('@example.com'),configure:async(_auth,_db,email,password)=>{window.testEvents.push(['verification',email,password]);return email;}};
    window.testAuth=auth;window.testDb=db;
    document.getElementById('header-user-name').textContent='KDCARIYAN';document.getElementById('collector-id').textContent='12345678';document.querySelector('.verified-badge').textContent='✓ Verified Member';document.querySelector('.level-badge').textContent='Level 5: Apex Sentinel AI';
   });
   // Initialize the signed-in wallet identity without contacting any real backend.
   for(const file of ['dashboard.js','home-fit.js','profile-fit.js','recovery-ui.js']){let source=fs.readFileSync(path.join(root,'js',file),'utf8');if(file==='dashboard.js')source=source.replace('auth = app.auth();','auth = app.auth(); walletUser = auth.currentUser;');await page.addScriptTag({content:source});}
   await page.evaluate(()=>window.HubRecoveryUI.init(window.testDb,window.testAuth));await page.waitForTimeout(100);
   const geometry=()=>page.evaluate(()=>Object.fromEntries(['.topbar','.bottom-nav'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [s,{x:r.x,y:r.y,width:r.width,height:r.height}];})));
   const before=await geometry();await page.locator('[data-tab="profile"]').click();await page.waitForTimeout(100);
   async function check(view){const d=await page.evaluate(()=>{const panel=document.getElementById('panel-profile'),content=panel.querySelector('[data-profile-view]:not([hidden])'),nav=document.querySelector('.bottom-nav').getBoundingClientRect(),v=panel.querySelector('.profile-fit-viewport').getBoundingClientRect();return{active:document.body.classList.contains('profile-fit-active'),view:content.dataset.profileView,scroll:document.scrollingElement.scrollHeight,top:v.top,bottom:nav.top,controls:[...content.querySelectorAll('input:not([type=file]),button,.profile-upload-button')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};})};});assert(d.active);assert.equal(d.view,view);assert(d.scroll<=height+1,'no Profile document scrolling');for(const r of d.controls){assert(r.width>0&&r.height>0);assert(r.y>=d.top-1&&r.bottom<=d.bottom+1,'all Profile controls fit between header and navigation');assert(r.x>=-1&&r.right<=width+1,'Profile controls stay in viewport');}assert.deepEqual(await geometry(),before,'shared header and navigation unchanged');}
   await check('main');
   assert.deepEqual(await page.locator('[data-profile-view="main"] .profile-shortcut-row strong').allTextContents(),['Deposit Money','Collection Ledger History','Profile Recovery','Telegram Login','Sign Out Account']);
   assert.equal(await page.locator('#panel-profile .profile-identity-card,#panel-profile .profile-section-header,#panel-profile .profile-referral-code').count(),0);
   await page.locator('#profile-full-name-input').fill('Updated Owner');await page.locator('#profile-phone-input').fill('01712345678');await page.locator('#profile-telegram-input').fill('@owner');await page.locator('#profile-save-button').click();await page.waitForTimeout(60);assert.equal((await page.evaluate(()=>window.testWrites.at(-1))).patch.name,'Updated Owner');await check('main');
   await page.locator('#profile-recovery-open').click();await page.waitForTimeout(100);await check('recovery');
   await page.locator('#recovery-email').fill('recovery@example.com');await page.locator('#recovery-send').click();await page.waitForTimeout(80);assert((await page.evaluate(()=>window.testEvents)).some(e=>e[0]==='verification'));await check('recovery');
   await page.locator('#recovery-refresh').click();await page.waitForTimeout(40);assert.match(await page.locator('#recovery-message').textContent(),/যাচাই হয়েছে/);
   await page.locator('[data-recovery-tab="password"]').click();await page.waitForTimeout(100);await check('recovery');
   await page.locator('#profile-current-password').fill('old-password');await page.locator('#profile-new-password').fill('new-password');await page.locator('#profile-confirm-password').fill('new-password');await page.locator('#profile-password-button').click();await page.waitForTimeout(60);assert((await page.evaluate(()=>window.testEvents)).some(e=>e[0]==='password'&&e[1]==='new-password'));
   await page.locator('[data-profile-view="recovery"] [data-profile-back]').click();await page.waitForTimeout(100);await check('main');
   await page.locator('#telegram-login-link').click();await page.waitForTimeout(60);assert.equal(await page.locator('#telegram-confirm-dialog').evaluate(e=>e.open),true);await page.locator('#telegram-link-password').fill('old-password');await page.locator('#telegram-confirm-submit').click();await page.waitForTimeout(60);assert.equal(await page.locator('#telegram-confirm-dialog').evaluate(e=>e.open),false);assert.deepEqual(await page.evaluate(()=>window.testTelegram),['','old-password']);await check('main');
   await page.locator('#user-avatar').click();await page.waitForTimeout(100);await check('avatar');
   await page.locator('[data-profile-avatar]').first().click();await page.locator('#profile-avatar-save').click();await page.waitForTimeout(60);let saved=await page.evaluate(()=>window.testWrites.at(-1));assert.equal(saved.patch.profilePhotoData,'');assert(saved.patch.profileAvatar);await check('avatar');
   await page.locator('#profile-photo-input').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=2;c.height=2;c.getContext('2d').fillRect(0,0,2,2);return c.toDataURL('image/png').split(',')[1];}),'base64')});await page.waitForFunction(()=>document.getElementById('profile-photo').getAttribute('src')?.startsWith('data:image/jpeg'));await page.locator('#profile-avatar-save').click();await page.waitForTimeout(60);saved=await page.evaluate(()=>window.testWrites.at(-1));assert.equal(saved.patch.profileAvatar,'');assert(saved.patch.profilePhotoData.startsWith('data:image/jpeg'));assert.deepEqual(Object.keys(saved.patch).sort(),['profileAvatar','profilePhotoData']);await check('avatar');
   await page.locator('[data-profile-view="avatar"] [data-profile-back]').click();await page.locator('#profile-shortcut-deposit').click();await page.waitForTimeout(100);assert.equal(await page.locator('#deposit-page').isVisible(),true);assert.equal(await page.evaluate(()=>document.body.classList.contains('profile-fit-active')),false);
   await page.locator('[data-tab="profile"]').click();await page.waitForTimeout(100);await page.locator('#profile-shortcut-ledger').click();assert.equal(await page.locator('#ledger-drawer').isVisible(),true);await page.locator('[data-ledger-close]').first().click();
   await page.locator('[data-tab="home"]').click();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.body.classList.contains('home-fit-active')),true);await page.locator('#user-avatar').click();await page.waitForTimeout(100);await check('avatar');
   await page.locator('[data-tab="profile"]').click();await page.waitForTimeout(100);await check('main');await page.locator('#profile-sign-out').click();assert((await page.evaluate(()=>window.testEvents)).some(e=>e[0]==='signout'));
   assert.deepEqual(errors,[]);console.log('PASS Profile, recovery, avatar, Telegram and retained actions '+width+'x'+height);await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
