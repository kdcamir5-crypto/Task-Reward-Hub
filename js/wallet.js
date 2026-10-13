// wallet.js - ই-ওয়ালেট বাইন্ড (একবার, লক), উইথড্র রিকোয়েস্ট ও ইতিহাস
const $ = (s) => document.querySelector(s);
const email = Store.get('session');
const WKEY = 'wallet:' + email, EKEY = 'ewallets:' + email, RKEY = 'withdrawals:' + email;
const MIN_WITHDRAW = 100, MAX_WALLETS = 5;
const wallet = () => Store.get(WKEY, { balance: 0, tasks: 0, referrals: 0 });
const ewallets = () => Store.get(EKEY, []);
const reqs = () => Store.get(RKEY, []);
const status = { pending: 'অপেক্ষায়', paid: 'পরিশোধিত', rejected: 'বাতিল' };

function say(id, msg, ok) { const el = $(id); el.textContent = msg; el.className = 'msg2 ' + (ok ? 'ok' : 'err'); }

function render() {
  $('#bal').textContent = '৳ ' + wallet().balance.toFixed(2);
  const list = ewallets(), l = $('#wallets');
  l.textContent = '';
  if (!list.length) l.innerHTML = '<p class="lock">এখনো কোনো ওয়ালেট যুক্ত নেই।</p>';
  list.forEach(w => {
    const d = document.createElement('div'); d.className = 'row';
    d.innerHTML = '<span><b></b><small></small></span><span class="lock">লক করা</span>';
    d.querySelector('b').textContent = w.type;
    d.querySelector('small').textContent = w.number.slice(0, 3) + '••••' + w.number.slice(-4);
    l.appendChild(d);
  });
  $('#bind-box').classList.toggle('hidden', list.length >= MAX_WALLETS);
  const sel = $('#dest'); sel.textContent = '';
  list.forEach((w, i) => sel.add(new Option(w.type + ' ' + w.number.slice(-4), i)));
  const h = reqs(), hl = $('#hist'); hl.textContent = '';
  if (!h.length) hl.innerHTML = '<p class="lock">এখনো কোনো উইথড্র রিকোয়েস্ট নেই।</p>';
  h.forEach(r => {
    const d = document.createElement('div'); d.className = 'row';
    d.innerHTML = '<span><b></b><small></small></span><span class="lock"></span>';
    d.querySelector('b').textContent = '৳ ' + r.amount;
    d.querySelector('small').textContent = r.type + ' • ' + new Date(r.at).toLocaleDateString('bn-BD');
    d.querySelector('.lock').textContent = status[r.status];
    hl.appendChild(d);
  });
}

$('#bind').addEventListener('submit', (e) => {
  e.preventDefault();
  const type = $('#type').value, num = $('#num').value.trim();
  if (!/^01[3-9]\d{8}$/.test(num)) return say('#bmsg', 'সঠিক ১১ ডিজিটের নম্বর দিন (01XXXXXXXXX)।', false);
  const list = ewallets();
  if (list.some(w => w.number === num)) return say('#bmsg', 'এই নম্বর আগেই যুক্ত আছে।', false);
  list.push({ type, number: num, at: Date.now() });
  Store.set(EKEY, list); $('#num').value = ''; say('#bmsg', 'ওয়ালেট যুক্ত ও লক হয়েছে।', true); render();
});

$('#wd').addEventListener('submit', (e) => {
  e.preventDefault();
  const list = ewallets(), amt = Number($('#amt').value), w = wallet();
  if (!list.length) return say('#wmsg', 'আগে একটা ই-ওয়ালেট যুক্ত করুন।', false);
  if (!Number.isFinite(amt) || amt < MIN_WITHDRAW) return say('#wmsg', 'ন্যূনতম উইথড্র ৳ ' + MIN_WITHDRAW + '।', false);
  if (amt > w.balance) return say('#wmsg', 'ব্যালেন্স যথেষ্ট নয়।', false);
  const dest = list[Number($('#dest').value)];
  w.balance -= amt; Store.set(WKEY, w); // রিকোয়েস্ট জমা হলে টাকা আটকে থাকে
  const h = reqs(); h.unshift({ amount: amt, type: dest.type, number: dest.number, status: 'pending', at: Date.now() });
  Store.set(RKEY, h); $('#amt').value = ''; say('#wmsg', 'রিকোয়েস্ট জমা হয়েছে। অ্যাডমিন যাচাই করবেন।', true); render();
});

$('#minlabel').textContent = '৳ ' + MIN_WITHDRAW;
document.documentElement.dataset.theme = Store.get('theme', 'light');
render();
