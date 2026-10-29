const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../js/referrals.js','utf8');
test('referral interface displays only signup and verified Telegram channel conditions',()=>{
 const nodes=new Map(),listeners=[];const el=id=>{assert.notEqual(id,'rv-purchase');if(!nodes.has(id))nodes.set(id,{textContent:'',disabled:false});return nodes.get(id);};
 function ref(path){return{doc:id=>ref(path+'/'+id),where(){return this;},onSnapshot(next){if(typeof next==='function')listeners.push({path,next});return()=>{};}};}
 const window={HubReferrals:null,dispatchEvent(){}},ctx={window,document:{getElementById:el},console};vm.runInNewContext(source,ctx);
 window.HubReferrals.init({collection:ref},{uid:'friend'});
 listeners.find(l=>l.path==='appSettings/referralSettings').next({exists:true,data:()=>({active:true})});
 listeners.find(l=>l.path==='referrals/friend').next({exists:true,data:()=>({status:'pending',purchaseVerified:false})});
 window.HubReferrals.updateProfile({telegramUserId:'123'});
 assert.match(el('rv-status').textContent,/দুটি শর্ত/);assert(!el('rv-status').textContent.includes('বট কেনা'));
 assert.match(el('rv-registration').textContent,/✓/);assert.equal(el('rv-link').disabled,true);
 listeners.find(l=>l.path==='referrals/friend').next({exists:true,data:()=>({status:'verified',channelVerified:true,purchaseVerified:false})});
 assert.match(el('rv-status').textContent,/রেফারার বট পেয়েছেন/);assert.match(el('rv-channel').textContent,/✓/);
 assert(!source.includes('rv-purchase'));assert(!source.includes('তিনটি শর্ত'));assert(!source.includes('প্রথম বট কেনা'));
});
