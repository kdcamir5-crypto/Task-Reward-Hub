const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('../js/activity-core.js');
test('sorts saved dates numerically across month and year boundaries',()=>{
 const rows=A.normalize({deposits:[{id:'old',amount:100,status:'approved',createdAt:{seconds:1735603200}},{id:'new',amount:200,status:'approved',createdAt:'2025-02-01T00:00:00Z'}]});assert.deepEqual(rows.map(r=>r.id),['new','old']);
});
test('claimed USD and BDT spins remain separate currencies',()=>{
 const rows=A.normalize({spins:[{id:'usd',claimed:true,currency:'USD',amountMinor:20,claimedAt:{seconds:100}},{id:'bdt',claimed:true,currency:'BDT',amountMinor:1000,claimedAt:{seconds:200}},{id:'unclaimed',claimed:false,currency:'BDT',amountMinor:30000}]});assert.equal(rows.length,2);assert.equal(A.amountText(rows[0]),'+৳10.00');assert.equal(A.amountText(rows[1]),'+$0.20');
});
test('wallet purchase debit and one-time USD receipt are distinct',()=>{
 const rows=A.normalize({purchases:[{id:'pulse',amount:50,paymentMethod:'wallet',status:'approved',usdBonus:.1,usdBonusCredited:true}]});assert.equal(rows.length,2);assert.equal(A.amountText(rows.find(r=>r.currency==='BDT')),'−৳50.00');assert.equal(A.amountText(rows.find(r=>r.currency==='USD')),'+$0.10');
});
test('direct bKash is not misrepresented as wallet debit',()=>{const rows=A.normalize({purchases:[{id:'x',amount:100,paymentMethod:'bKash',status:'approved',usdBonus:.2,usdBonusCredited:true}]});assert.equal(rows.find(r=>r.currency==='BDT').effect,'none');assert.equal(rows.find(r=>r.currency==='USD').effect,'credit');});
test('pending and rejected purchases or deposits never imply credits',()=>{
 const rows=A.normalize({purchases:[{id:'x',amount:50,status:'pending',usdBonus:.1,usdBonusCredited:false}],deposits:[{id:'y',amount:100,status:'rejected'}]});assert.equal(rows.length,2);assert(rows.every(r=>r.effect==='none'));
});
test('reserve, paid, rejection and legacy withdrawal effects are explicit',()=>{
 for(const [version,status,effect] of [[2,'pending','debit'],[2,'paid','debit'],[2,'rejected','refund'],[0,'pending','none'],[0,'rejected','none'],[0,'paid','debit']]){const [row]=A.normalize({withdrawals:[{id:'x',amount:100,status,reservationVersion:version}]});assert.equal(row.effect,effect);}
});
test('mining and referral totals cannot masquerade as new individual credits',()=>{
 const rows=A.normalize({}, {referralEarnings:25}, [{id:'pulse',botId:'pulse',earnedReward:12.34,updatedAt:{seconds:123},status:'running'}]);assert(rows.every(r=>r.effect==='total'));const referral=rows.find(r=>r.source==='referral-total');assert.equal(referral.timestamp,0);assert.equal(referral.recent,false);assert.equal(A.amountText(referral),'মোট ৳25.00');assert.match(rows[0].title,/মোট/);
});
test('free referral bot is a bot award, not a cash credit',()=>{const [r]=A.normalize({gifts:[{id:'friend',botId:'pulse',ordinal:1}]});assert.equal(r.currency,'BOT');assert.equal(A.amountText(r),'1টি বট');});
test('saved code receipts keep BDT, USD and bot rewards distinct',()=>{const rows=A.normalize({codes:[{id:'a',code:'a',rewardType:'USD',amountMinor:25},{id:'b',code:'b',rewardType:'BDT',amountMinor:1000},{id:'c',code:'c',rewardType:'bot',amountMinor:0,botId:'pulse'}]});assert.deepEqual(new Set(rows.map(A.amountText)),new Set(['+$0.25','+৳10.00','1টি বট']));});
test('task submission is not proof of wallet credit',()=>{const [r]=A.normalize({tasks:[{id:'task',reward:3,status:'approved'}]});assert.equal(r.effect,'none');assert.match(r.detail,/wallet credit receipt নয়/);});
test('invalid money values and unclaimed tickets do not create fake earnings',()=>{assert.deepEqual(A.normalize({deposits:[{id:'bad',amount:NaN},{id:'neg',amount:-5}],spins:[{id:'bad',claimed:true,currency:'EUR',amountMinor:100}]}),[]);});
test('timestamp formats preserve milliseconds',()=>{assert.equal(A.time({seconds:123,nanoseconds:500000000}),123500);assert.equal(A.time({toMillis:()=>500}),500);assert.equal(A.time(null),0);assert.equal(A.time('not-a-date'),0);});
function fake(){const listeners=[];function ref(path,filters=[]){return {doc:id=>ref(path+'/'+id),collection:n=>ref(path+'/'+n),where:(...f)=>ref(path,[...filters,f]),onSnapshot(next,error){const l={path,filters,next,error,stopped:false};listeners.push(l);return()=>{l.stopped=true;};}};}return {db:{collection:n=>ref(n)},listeners};}
test('subscriptions use only the signed-in account and report partial failures',()=>{
 const f=fake(),states=[];const controller=A.create(f.db,'owner',s=>states.push(s));assert.equal(f.listeners.length,7);for(const l of f.listeners){if(l.path.includes('/spinTickets')||l.path.includes('/codeClaims'))assert(l.path.startsWith('users/owner/'));else assert(l.filters.some(x=>x[2]==='owner'));}
 for(const l of f.listeners){if(l.path==='walletDeposits')l.error(new Error('denied'));else l.next({docs:[]});}assert.equal(states.at(-1).loading,false);assert.deepEqual(states.at(-1).errors,['deposits']);controller.stop();assert(f.listeners.every(l=>l.stopped));
});
test('snapshot updates replace rows; stopped callbacks cannot leak into another session',()=>{
 const f=fake(),states=[],c=A.create(f.db,'one',s=>states.push(s));const l=f.listeners.find(x=>x.path==='withdrawals');const send=status=>l.next({docs:[{id:'r',data:()=>({uid:'one',amount:100,reservationVersion:2,status,createdAt:{seconds:10}})}]});send('pending');send('paid');assert.equal(states.at(-1).rows.length,1);assert.equal(states.at(-1).rows[0].status,'paid');const before=states.length;c.stop();send('rejected');assert.equal(states.length,before);
});
test('cache and mining/profile errors remain visible and recover on new data',()=>{
 const f=fake(),states=[],c=A.create(f.db,'one',s=>states.push(s));f.listeners[0].next({docs:[],metadata:{fromCache:true}});assert(states.at(-1).fromCache);c.reportError('mining');assert(states.at(-1).errors.includes('mining'));c.updateMining([]);assert(!states.at(-1).errors.includes('mining'));c.stop();
});
