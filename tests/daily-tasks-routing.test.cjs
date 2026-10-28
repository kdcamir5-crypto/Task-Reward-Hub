const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('task page replaces Home content and returns to the existing five-tab shell',()=>{
 const source=fs.readFileSync(__dirname+'/../js/dashboard.js','utf8');
 const extract=name=>{const pattern=new RegExp('  function '+name+'\\([^\\n]*\\) \\{[\\s\\S]*?\\n  \\}');const found=source.match(pattern);assert(found,name+' exists');return found[0];};
 function element(dataset={}){const classes=new Set();return {dataset,hidden:true,classList:{add:(...c)=>c.forEach(x=>classes.add(x)),remove:(...c)=>c.forEach(x=>classes.delete(x)),toggle:(c,on)=>on?classes.add(c):classes.delete(c)},setAttribute(){},removeAttribute(){},scrollIntoView(){}};}
 const panels=['home','rank','bots','feed','profile'].map(panel=>element({panel})),tabs=panels.map(p=>element({tab:p.dataset.panel})),home=element(),nodes=new Map([['daily-tasks-page',element()]]),calls=[];
 const context={closeNotificationsView(){},syncProfileNavigation(){},document:{body:element(),querySelector:s=>s==='.home-reference-layout'?home:null,querySelectorAll:s=>s==='[data-panel]'?panels:s==='[data-tab]'?tabs:[],getElementById:id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);}},window:{HubDailyTasks:{show:x=>calls.push(x)},scrollTo(){},matchMedia:()=>({matches:true})}};
 vm.createContext(context);vm.runInContext(['hideDailyTasks','openDailyTasks','showTab'].map(extract).join('\n'),context);
 context.openDailyTasks();assert.equal(nodes.get('daily-tasks-page').hidden,false);assert(home.hidden);assert(panels.every(p=>p.hidden));assert.equal(tabs.length,5);assert(calls.includes(true));
 context.showTab('rank');assert(nodes.get('daily-tasks-page').hidden);assert.equal(panels[1].hidden,false);assert(panels.filter(p=>!p.hidden).length===1);assert(calls.includes(false));
});
