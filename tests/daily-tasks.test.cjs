const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../js/daily-tasks-core.js');
test('Bangladesh midnight expires the preceding day, including month and year rollover',()=>{
 for(const [before,end] of [['2026-10-28T17:59:59Z','2026-10-28T18:00:00Z'],['2026-10-28T18:00:00Z','2026-10-29T18:00:00Z'],['2026-12-31T17:59:59Z','2026-12-31T18:00:00Z']])assert.equal(C.dayEnd(Date.parse(before)),Date.parse(end));
});
test('submission removes a task only from that user and expiry removes it for everyone',()=>{
 const tasks=[{id:'a',schemaVersion:2,expiresAtMs:100},{id:'b',schemaVersion:2,expiresAtMs:100}];
 assert.deepEqual(C.available(tasks,[{taskId:'a',status:'pending'}],99).map(x=>x.id),['b']);
 assert.equal(C.available(tasks,[],99).length,2);assert.equal(C.available(tasks,[],100).length,0);
});
test('amounts and task links reject unsafe values',()=>{
 assert.equal(C.rewardMinor('0.10'),10);assert.equal(C.rewardMinor('10000'),1000000);
 for(const n of ['-1','1.234','NaN','Infinity','10001','0'])assert.throws(()=>C.rewardMinor(n));
 for(const u of ['javascript:alert(1)','data:text/html,x','http://example.com','https://a:b@example.com'])assert.throws(()=>C.link(u));
 assert.equal(C.link('https://t.me/example'),'https://t.me/example');
});
