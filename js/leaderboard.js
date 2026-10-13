// Local XP leaderboard. This is browser-local until shared server-side XP is implemented.
(() => {
'use strict';
const $=s=>document.querySelector(s);
const currentEmail=Store.get('session');
if(!currentEmail)return;
const users=Store.get('users',{});
const emails=Object.keys(users);
if(!emails.includes(currentEmail))emails.push(currentEmail);
const records=emails.map(email=>{
 const profile=Store.get('profile:'+email,{});
 const spin=Store.get('lucky-spin:'+email,{xp:0,spins:0,badges:0});
 const streak=Store.get('daily-streak:'+email,{xp:0,current:0,best:0,total:0});
 const xp=Math.max(0,Number(spin.xp)||0)+Math.max(0,Number(streak.xp)||0);
 const name=profile.name||email.split('@')[0]||'Player';
 return {email,name,xp,spins:Number(spin.spins)||0,checkins:Number(streak.total)||0,isMe:email===currentEmail};
}).sort((a,b)=>b.xp-a.xp||a.name.localeCompare(b.name));
const mine=records.find(x=>x.isMe)||{xp:0};
$('#my-rank').textContent=records.findIndex(x=>x.isMe)+1;
$('#my-xp').textContent=String(mine.xp);
$('#account-count').textContent=String(records.length);
const list=$('#leader-list');list.textContent='';
records.forEach((p,i)=>{
 const li=document.createElement('li');if(p.isMe)li.className='leader-you';
 const rank=document.createElement('span');rank.className='leader-rank';rank.textContent=i===0?'👑':String(i+1);
 const person=document.createElement('span');person.className='leader-person';
 const name=document.createElement('strong');name.textContent=p.name;
 const detail=document.createElement('small');detail.textContent=p.spins+' স্পিন · '+p.checkins+' চেক-ইন';
 person.append(name,detail);
 const score=document.createElement('span');score.className='leader-score';
 const points=document.createElement('strong');points.textContent=p.xp.toLocaleString('en-US')+' XP';
 const label=document.createElement('small');label.textContent='মোট ভার্চুয়াল XP';
 score.append(points,label);li.append(rank,person,score);list.appendChild(li);
});
})();