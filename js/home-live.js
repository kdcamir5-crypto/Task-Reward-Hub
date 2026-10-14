// home-live.js - live AI-bot status and mining income on the home page.
// Reads users/{uid}.unlockedBots and users/{uid}/botMining (written only by the GitHub Actions worker).
import { db } from './firebase-config.js';
import { collection, doc, onSnapshot }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const BOT_IDS = ['pulse', 'quantum', 'neural', 'cyber', 'apex'];
const $ = (s) => document.querySelector(s);
const state = { unlocked: [], earned: 0, mineError: false };

function render() {
  const n = state.unlocked.length;
  const on = n > 0;
  $('#bots-n').textContent = n;
  $('#bot-card').classList.toggle('on', on);
  $('#bot-pill').textContent = n + (n === 1 ? ' BOT' : ' BOTS') + (on ? ' • ONLINE' : ' • OFFLINE');
  $('#bot-state').textContent = on ? 'Mining Active' : 'Sleeping';
  $('#bot-title').textContent = n + (n === 1 ? ' Bot' : ' Bots') + (on ? ' • Online' : ' • Offline');
  $('#bot-text').textContent = on
    ? 'আপনার ' + n + 'টি AI বট অটো-মাইনিং করছে। আয় নির্দিষ্ট বিরতিতে ব্যালেন্সে জমা হয়।'
    : 'আপনার কোনো AI বট সক্রিয় নেই। AI Bot Shop থেকে বট আনলক করে অটো-মাইনিং চালু করুন।';
  $('#bot-cta').textContent = on ? 'লাইভ মাইনিং দেখুন' : 'AI Bot Shop খুলুন';
  $('#mine-total').textContent = state.mineError ? '৳ —' : '৳ ' + state.earned.toFixed(2);
  $('#mine-sub').textContent = on ? n + 'টি বট চালু' : 'AI Bot চালু নেই';
}

(async () => {
  try {
    const user = await window.hubUser;
    if (!user || !user.uid) return;
    onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const d = snap.exists() ? snap.data() : {};
      state.unlocked = (Array.isArray(d.unlockedBots) ? d.unlockedBots : []).filter((id) => BOT_IDS.includes(id));
      render();
    }, (e) => console.warn('Bot status unavailable:', e && e.code));
    onSnapshot(collection(db, 'users', user.uid, 'botMining'), (snap) => {
      let sum = 0;
      snap.forEach((x) => { sum += Number((x.data() || {}).earnedReward || 0); });
      state.earned = sum; state.mineError = false;
      render();
    }, (e) => { state.mineError = true; render(); console.warn('Mining income unavailable:', e && e.code); });
  } catch (e) { console.warn('Home live data unavailable:', e && e.message); }
})();
