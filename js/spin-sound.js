/* Optional local audio only. Reward and wallet logic never depends on sound. */
(function(){
'use strict';
const button=document.getElementById('spin-sound-button'),page=document.getElementById('spin-wheel-page');
let enabled=false,context=null,timer=null,spinning=false;const voices=new Set(),key='trh-spin-sound';
try{enabled=localStorage.getItem(key)==='on';}catch(_){}
function visible(){return !document.hidden&&page&&!page.hidden&&document.body.classList.contains('spin-wheel-active');}
function sync(){if(button){button.textContent=enabled?'🔊':'🔇';button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',enabled?'Mute spin sound':'Enable spin sound');button.title=enabled?'Sound on':'Sound off';}}
function unlock(){
 if(!enabled)return;
 try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;if(!context)context=new Audio();if(context.state==='suspended')Promise.resolve(context.resume()).catch(()=>{});}catch(_){}
}
function tone(frequency,duration=.035,delay=0){
 if(!enabled||!visible()||!context||context.state!=='running')return;
 let oscillator,gain;
 try{oscillator=context.createOscillator();gain=context.createGain();const start=context.currentTime+delay;oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.045,start+.006);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);oscillator.connect(gain);gain.connect(context.destination);voices.add(oscillator);oscillator.onended=()=>{voices.delete(oscillator);oscillator.disconnect();gain.disconnect();};oscillator.start(start);oscillator.stop(start+duration+.01);}catch(_){try{oscillator?.disconnect();gain?.disconnect();}catch(_){}voices.delete(oscillator);}
}
function silence(){if(timer!==null){clearInterval(timer);timer=null;}for(const voice of voices){try{voice.stop();}catch(_){}}voices.clear();}
function stop(){spinning=false;silence();}
function loop(){if(timer!==null)return;timer=setInterval(()=>{if(!visible()){stop();return;}tone(620,.025);},130);}
function start(){spinning=true;if(enabled&&visible())loop();}
function finish(){stop();tone(660,.13);tone(830,.13,.14);tone(990,.22,.28);}
button?.addEventListener('click',()=>{enabled=!enabled;try{localStorage.setItem(key,enabled?'on':'off');}catch(_){}sync();if(!enabled){silence();return;}unlock();if(spinning&&visible())loop();else tone(720,.08);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
window.addEventListener('pagehide',stop);
if(page)new MutationObserver(()=>{if(!visible())stop();}).observe(document.body,{attributes:true,attributeFilter:['class'],subtree:false});
sync();window.HubSpinSound={unlock,start,finish,stop};
})();
