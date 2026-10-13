// Achievement badges: derived from this account's local virtual game progress only.
(() => {
 'use strict';
 const $ = s => document.querySelector(s);
 const session = Store.get('session');
 if (!session) return;
 const key = 'achievements:' + session;
 const read = (name, fallback) => {
   const value = Store.get(name + ':' + session, fallback);
   return value && typeof value === 'object' ? value : fallback;
 };
 const spin = read('lucky-spin', {xp:0,spins:0,badges:0,history:[]});
 const streak = read('daily-streak', {xp:0,current:0,best:0,total:0});
 const mystery = read('mystery-box', {xp:0,boxes:0,best:0,history:[]});
 const xp = Math.max(0,Number(spin.xp)||0)+Math.max(0,Number(streak.xp)||0)+Math.max(0,Number(mystery.xp)||0);
 const spins = Math.max(0,Number(spin.spins)||0);
 const checkins = Math.max(0,Number(streak.total)||0);
 const boxes = Math.max(0,Number(mystery.boxes)||0);
 const defs = [
  {id:'first-step',icon:'🌱',tier:'BRONZE',name:'প্রথম পদক্ষেপ',desc:'প্রথমবার লাকি স্পিন বা ডেইলি স্ট্রিক ব্যবহার করুন।',goal:'প্রথম স্পিন / চেক-ইন',test:()=>spins>=1||checkins>=1},
  {id:'spin-star',icon:'🎡',tier:'SILVER',name:'স্পিন স্টার',desc:'লাকি স্পিনে ৩ বার অংশ নিন।',goal:'৩টি স্পিন',test:()=>spins>=3},
  {id:'streak-hero',icon:'🔥',tier:'GOLD',name:'স্ট্রিক হিরো',desc:'মোট ৭টি দৈনিক চেক-ইন সম্পন্ন করুন।',goal:'৭টি চেক-ইন',test:()=>checkins>=7},
  {id:'box-hunter',icon:'🎁',tier:'SILVER',name:'বক্স হান্টার',desc:'৫টি মিস্ট্রি বক্স খুলুন।',goal:'৫টি বক্স',test:()=>boxes>=5},
  {id:'xp-collector',icon:'⭐',tier:'GOLD',name:'XP কালেক্টর',desc:'সব গেম মিলিয়ে ১০০ ভার্চুয়াল XP সংগ্রহ করুন।',goal:'১০০ XP',test:()=>xp>=100},
  {id:'diamond-player',icon:'💎',tier:'DIAMOND',name:'ডায়মন্ড প্লেয়ার',desc:'সব গেম মিলিয়ে ৫০০ ভার্চুয়াল XP সংগ্রহ করুন।',goal:'৫০০ XP',test:()=>xp>=500}
 ];
 let saved = Store.get(key,{unlocked:[],seen:[]});
 if(!saved||typeof saved!=='object')saved={unlocked:[],seen:[]};
 saved.unlocked=Array.isArray(saved.unlocked)?saved.unlocked:[];
 saved.seen=Array.isArray(saved.seen)?saved.seen:[];
 const newly=[];
 defs.forEach(d=>{if(d.test()&&!saved.unlocked.includes(d.id)){saved.unlocked.push(d.id);newly.push(d);}});
 Store.set(key,saved);
 const grid=$('#achievement-grid');
 defs.forEach(d=>{
  const unlocked=saved.unlocked.includes(d.id);
  const card=document.createElement('article');card.className='achievement-card'+(unlocked?' is-unlocked':'');
  const medal=document.createElement('div');medal.className='achievement-medal';medal.textContent=d.icon;
  const tier=document.createElement('span');tier.className='achievement-tier';tier.textContent=d.tier;
  const title=document.createElement('h3');title.textContent=d.name;
  const desc=document.createElement('p');desc.textContent=d.desc;
  const footer=document.createElement('footer');
  const goal=document.createElement('span');goal.textContent=d.goal;
  const status=document.createElement('strong');status.className='achievement-status';status.textContent=unlocked?'✓ আনলক':'🔒 লক';
  footer.append(goal,status);card.append(medal,tier,title,desc,footer);grid.appendChild(card);
 });
 $('#unlocked-count').textContent=String(saved.unlocked.length);
 $('#total-count').textContent=String(defs.length);
 $('#progress-fill').style.width=(saved.unlocked.length/defs.length*100)+'%';
 if(newly.length){
  const toast=$('#achievement-toast');
  toast.textContent='🎉 নতুন ব্যাজ আনলক হয়েছে: '+newly.map(d=>d.name).join(' · ');
  toast.classList.add('is-visible');
 }
 document.documentElement.dataset.theme=Store.get('theme','light');
})();