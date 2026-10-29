'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
let html=fs.readFileSync(path.join(root,'pages/dashboard.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
html=html.replace(/<link\b[^>]*href="(\.\.\/css\/[^"?]+)(?:\?[^" ]*)?"[^>]*>/g,(_,href)=>'<style>'+fs.readFileSync(path.resolve(root,'pages',href),'utf8')+'</style>');
const fit=fs.readFileSync(path.join(root,'js/home-fit.js'),'utf8');
const claimDialog=fs.readFileSync(path.join(root,'js/code-claim-dialog.js'),'utf8');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const [width,height] of [[320,568],[360,640],[375,667],[390,844],[430,932],[768,1024],[844,390]]){
   const page=await browser.newPage({viewport:{width,height}});await page.setContent(html);
   await page.evaluate(()=>{document.getElementById('header-user-name').textContent='KDCARIYAN';document.getElementById('collector-id').textContent='12345678';document.querySelector('.verified-badge').textContent='✓ Verified Member';document.querySelector('.level-badge').textContent='Level 5: Apex Sentinel AI';document.getElementById('balance-value').textContent='125,000.50';document.getElementById('bot-mining-value').textContent='10,000.00';});
   const geometry=()=>page.evaluate(()=>Object.fromEntries(['.topbar','.bottom-nav'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [s,{x:r.x,y:r.y,width:r.width,height:r.height}];})));
   const before=await geometry();await page.addScriptTag({content:fit});await page.addScriptTag({content:claimDialog});await page.waitForTimeout(120);
   const after=await geometry();assert.deepEqual(after,before,'header and navigation geometry stays unchanged');
   async function check(){const d=await page.evaluate(()=>{const home=document.querySelector('.home-reference-layout'),nav=document.querySelector('.bottom-nav').getBoundingClientRect();const quick=[...home.querySelectorAll('.reference-service')],explore=[...home.querySelectorAll('.explore-card')];const controls=[...quick,...explore,home.querySelector('.bot-sleep-card>button'),home.querySelector('#home-copy-referral-link')];return {active:document.body.classList.contains('home-fit-active'),height:innerHeight,scroll:document.scrollingElement.scrollHeight,quick:quick.length,explore:explore.length,exploreRows:new Set(explore.map(e=>Math.round(e.getBoundingClientRect().top))).size,removed:home.querySelectorAll('.reference-stats,.commission-card,.activity-card').length,controls:controls.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};}),top:home.getBoundingClientRect().top,bottom:nav.top};});assert(d.active);assert.equal(d.quick,8);assert.equal(d.explore,4);assert.equal(d.exploreRows,1);assert.equal(d.removed,0);assert(d.scroll<=height+1,'document does not scroll');for(const r of d.controls){assert(r.width>0&&r.height>0);assert(r.y>=d.top-1&&r.bottom<=d.bottom+1,'all controls fit above navigation');assert(r.x>=-1&&r.right<=width+1,'controls fit horizontally');}}
   await check();
   assert.equal(await page.locator('.home-reference-layout #home-claim-form').count(),0);
   assert.equal(await page.locator('#home-claim-code').isVisible(),false);
   assert.equal(await page.locator('.bot-sleep-card').evaluate(e=>getComputedStyle(e).minHeight),'200px');
   await page.locator('.home-reference-layout [data-code-claim-open]').click();
   assert.equal(await page.locator('#code-claim-dialog').evaluate(e=>e.open),true);
   assert.equal(await page.locator('#home-claim-code').isVisible(),true);
   await page.locator('#home-claim-code').fill('TRH-1234567890ABCDEF1234');
   await page.evaluate(()=>document.getElementById('home-claim-message').textContent='Code-এর মেয়াদ শেষ হয়েছে। অন্য code দিয়ে আবার চেষ্টা করুন।');
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('#home-claim-code').isVisible(),false);
   await page.locator('.home-reference-layout [data-code-claim-open]').click();
   assert.equal(await page.locator('#home-claim-code').inputValue(),'TRH-1234567890ABCDEF1234');
   await page.locator('#code-claim-close').click();await page.waitForTimeout(100);await check();
   // Inner features release Home-only scroll locking, then Home fits again.
   await page.evaluate(()=>{document.querySelector('.home-reference-layout').hidden=true;document.body.classList.add('wallet-page-active');});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.body.classList.contains('home-fit-active')),false);
   await page.evaluate(()=>{document.body.classList.remove('wallet-page-active');document.querySelector('.home-reference-layout').hidden=false;});await page.waitForTimeout(100);await check();
   console.log('PASS Home fit '+width+'x'+height);await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
