// rewards.js - কোড যাচাই করে একবারই রিওয়ার্ড দেয়, ইতিহাস দেখায়
const $ = (s) => document.querySelector(s);
const email = Store.get('session');
const HKEY = 'codes:' + email, WKEY = 'wallet:' + email;
const history = () => Store.get(HKEY, []);

function show(msg, ok) { const r = $('#result'); r.textContent = msg; r.className = 'result ' + (ok ? 'ok' : 'err'); }

function claim(raw) {
  const code = raw.trim().toUpperCase();
  if (!code) return show('কোড লিখুন।', false);
  const info = CODES[code];
  if (!info) return show('কোডটি ঠিক নয়।', false);
  if (new Date(info.expires + 'T23:59:59') < new Date()) return show('কোডের মেয়াদ শেষ।', false);
  const h = history();
  if (h.some(x => x.code === code)) return show('এই কোড আপনি আগেই ব্যবহার করেছেন।', false);
  h.unshift({ code, reward: info.reward, at: Date.now() });
  Store.set(HKEY, h);
  const w = Store.get(WKEY, { balance: 0, tasks: 0, referrals: 0 });
  w.balance += info.reward; Store.set(WKEY, w);
  show('অভিনন্দন! ৳ ' + info.reward + ' যোগ হয়েছে।', true);
  render();
}

function render() {
  const h = history(), ul = $('#hist');
  ul.textContent = '';
  if (!h.length) { ul.innerHTML = '<li><span>এখনো কোনো কোড ব্যবহার করেননি।</span></li>'; return; }
  h.forEach(x => {
    const li = document.createElement('li');
    const d = new Date(x.at).toLocaleDateString('bn-BD');
    li.innerHTML = '<span><b></b><small></small></span><strong></strong>';
    li.querySelector('b').textContent = x.code;
    li.querySelector('small').textContent = d;
    li.querySelector('strong').textContent = '+৳ ' + x.reward;
    ul.appendChild(li);
  });
}

$('#form').addEventListener('submit', (e) => { e.preventDefault(); claim($('#code').value); $('#code').value = ''; });
document.documentElement.dataset.theme = Store.get('theme', 'light');
render();
