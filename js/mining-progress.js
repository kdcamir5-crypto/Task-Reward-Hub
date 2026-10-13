// mining-progress.js - Live mining progress bars for the AI Bot shop page.
// Reads users/{uid}/botMining (written only by the GitHub Actions worker) in real time.
// The bar ticks every second using the same formula as scripts/auto-mining.js,
// and shows the amount the server has actually credited to the balance separately.
import { db } from './firebase-config.js';
import { collection, doc, onSnapshot }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const DURATION_MS = 30 * 24 * 60 * 60 * 1000; // must match MINING_DURATION_MS in the worker
const BOTS = {
  pulse:   { name: 'AI Pulse Bot v2',   target: 80,  icon: '⚡' },
  quantum: { name: 'Quantum Core Pro',  target: 160, icon: '🔷' },
  neural:  { name: 'Neural Matrix Bot', target: 320, icon: '🧠' },
  cyber:   { name: 'Cyber Forge Titan', target: 480, icon: '🛡️' },
  apex:    { name: 'Apex Sentinel AI',  target: 800, icon: '👑' }
};
const ORDER = Object.keys(BOTS);

const root = document.getElementById('live-mining');
if (root) start();

function toMs(v) {
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}
const taka = (n, d) => '৳' + Number(n || 0).toFixed(d);

function ago(ms) {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return s + ' সেকেন্ড আগে';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' মিনিট আগে';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' ঘণ্টা আগে';
  return Math.floor(h / 24) + ' দিন আগে';
}
function left(ms) {
  if (ms <= 0) return 'শেষ';
  const t = Math.floor(ms / 1000);
  const d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return d + ' দিন ' + h + ' ঘণ্টা ' + m + ' মিনিট ' + s + ' সেকেন্ড';
}

function start() {
  const state = { unlocked: [], records: {}, ready: { user: false, mining: false }, error: null };
  const list = root.querySelector('[data-list]');
  const note = root.querySelector('[data-note]');
  let cards = {};

  function card(botId) {
    const b = BOTS[botId];
    const el = document.createElement('article');
    el.className = 'mine-card';
    el.dataset.bot = botId;
    el.innerHTML =
      '<div class="mine-head"><span class="mine-icon" aria-hidden="true">' + b.icon + '</span>' +
      '<div class="mine-title"><h3></h3><span class="mine-status" data-status></span></div>' +
      '<strong class="mine-pct" data-pct>0.00%</strong></div>' +
      '<div class="mine-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i data-bar></i></div>' +
      '<div class="mine-grid">' +
      '<div><span>এখন পর্যন্ত আর্ন (লাইভ)</span><strong data-live>৳0.0000</strong></div>' +
      '<div><span>ব্যালেন্সে জমা হয়েছে</span><strong class="ok" data-credited>৳0.00</strong></div>' +
      '<div><span>লক্ষ্য রিওয়ার্ড</span><strong data-target></strong></div>' +
      '<div><span>বাকি সময়</span><strong data-left>—</strong></div></div>' +
      '<p class="mine-foot" data-foot></p>';
    el.querySelector('h3').textContent = b.name;
    el.querySelector('[data-target]').textContent = taka(b.target, 0);
    return el;
  }

  function render() {
    if (state.error) {
      note.hidden = false;
      note.className = 'mine-note err';
      note.textContent = state.error;
    } else {
      note.hidden = true;
    }
    const ids = ORDER.filter((id) => state.records[id] || state.unlocked.includes(id));
    list.textContent = '';
    cards = {};
    if (!ids.length && state.ready.user && state.ready.mining && !state.error) {
      const p = document.createElement('p');
      p.className = 'mine-empty';
      p.textContent = 'এখনো কোনো বট আনলক করা নেই। রিডিম কোড দিয়ে বট আনলক করলে অটো-মাইনিং চালু হবে এবং এখানে লাইভ প্রগ্রেস দেখা যাবে।';
      list.appendChild(p);
    }
    ids.forEach((id) => { cards[id] = card(id); list.appendChild(cards[id]); });
    tick();
  }

  function tick() {
    const now = Date.now();
    Object.keys(cards).forEach((id) => {
      const el = cards[id], b = BOTS[id], rec = state.records[id];
      const q = (s) => el.querySelector(s);
      let pct = 0, live = 0, status = 'pending', leftTxt = '—', foot = '';
      if (!rec) {
        foot = 'বট আনলক হয়েছে। পরের অটো-মাইনিং রানে (সাধারণত ৫-৩০ মিনিটের মধ্যে) মাইনিং শুরু হবে।';
      } else {
        const startedMs = toMs(rec.startedAt);
        const lastMs = toMs(rec.lastProcessedAt);
        if (rec.status === 'error' || startedMs === null) {
          status = 'error';
          foot = 'এই বটের মাইনিং রেকর্ডে সমস্যা আছে। অ্যাডমিনকে জানান।';
        } else if (rec.status === 'completed') {
          status = 'done'; pct = 100; live = b.target; leftTxt = 'সম্পন্ন';
        } else {
          status = 'running';
          const elapsed = Math.max(0, now - startedMs);
          pct = Math.min(100, (elapsed / DURATION_MS) * 100);
          live = Math.min(b.target, (b.target * elapsed) / DURATION_MS);
          leftTxt = left(DURATION_MS - elapsed);
        }
        if (lastMs !== null && status !== 'error') {
          foot = 'শেষ সার্ভার আপডেট: ' + ago(lastMs) + ' · অটো-মাইনিং ব্যালেন্সে জমা করে নির্দিষ্ট বিরতিতে (সাধারণত ৫-৩০ মিনিট)।';
        }
      }
      const labels = { pending: '⏳ শুরুর অপেক্ষায়', running: '● চলছে', done: '✅ সম্পন্ন', error: '⚠️ সমস্যা' };
      const s = q('[data-status]');
      s.textContent = labels[status];
      s.className = 'mine-status ' + status;
      q('[data-pct]').textContent = pct.toFixed(2) + '%';
      q('[data-bar]').style.width = pct.toFixed(3) + '%';
      q('.mine-bar').setAttribute('aria-valuenow', pct.toFixed(1));
      q('[data-live]').textContent = taka(live, 4);
      q('[data-credited]').textContent = taka(rec ? rec.earnedReward : 0, 2);
      q('[data-left]').textContent = leftTxt;
      q('[data-foot]').textContent = foot;
    });
  }

  function fail(e) {
    const code = e && e.code ? e.code : 'unknown';
    state.error = code === 'permission-denied'
      ? 'মাইনিং ডেটা পড়ার অনুমতি নেই। Firestore Rules-এ users/{uid}/botMining কালেকশনে নিজের ডেটা read করার অনুমতি দিতে হবে।'
      : 'লাইভ মাইনিং ডেটা লোড করা যায়নি (' + code + ')। পেজ রিফ্রেশ করুন।';
    render();
  }

  (async () => {
    try {
      const user = await window.hubUser;
      if (!user || !user.uid) throw { code: 'no-user' };
      onSnapshot(doc(db, 'users', user.uid), (snap) => {
        const d = snap.exists() ? snap.data() : {};
        state.unlocked = Array.isArray(d.unlockedBots) ? d.unlockedBots : [];
        state.ready.user = true;
        render();
      }, fail);
      onSnapshot(collection(db, 'users', user.uid, 'botMining'), (snap) => {
        const r = {};
        snap.forEach((x) => { r[x.id] = x.data() || {}; });
        state.records = r;
        state.ready.mining = true;
        render();
      }, fail);
      setInterval(tick, 1000);
    } catch (e) { fail(e); }
  })();
}
