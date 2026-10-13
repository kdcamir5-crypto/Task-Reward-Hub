// feed.js - কমিউনিটি ফিড: পোস্ট, রিঅ্যাকশন, নিজের পোস্ট মোছা (এখন ডেমো, ব্রাউজারে সংরক্ষিত)
const $ = (s) => document.querySelector(s);
const email = Store.get('session');
const MAX = 280;
let filter = 'all';
const EMO = [['like', '👍'], ['love', '❤️'], ['fire', '🔥']];
const posts = () => Store.get('feed', []);
const myName = () => (Store.get('profile:' + email, {}).name) || email.split('@')[0];

function ago(t) {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'এইমাত্র';
  if (m < 60) return m.toLocaleString('bn-BD') + ' মিনিট আগে';
  const h = Math.floor(m / 60);
  if (h < 24) return h.toLocaleString('bn-BD') + ' ঘণ্টা আগে';
  return Math.floor(h / 24).toLocaleString('bn-BD') + ' দিন আগে';
}

function render() {
  const box = $('#list'); box.textContent = '';
  const list = posts().filter(p => filter === 'all' || p.by === email);
  if (!list.length) { box.innerHTML = '<p class="note">এখনো কোনো পোস্ট নেই। প্রথম পোস্টটা আপনার হোক।</p>'; return; }
  list.forEach(p => {
    const el = document.createElement('article'); el.className = 'post';
    el.innerHTML = '<div class="post__head"><b></b><small></small></div><p class="post__text"></p><div class="reacts"></div>';
    el.querySelector('b').textContent = p.name;
    el.querySelector('small').textContent = ago(p.at);
    el.querySelector('.post__text').textContent = p.text;
    const r = el.querySelector('.reacts');
    EMO.forEach(([k, ic]) => {
      const who = p.reacts[k] || [], b = document.createElement('button');
      b.type = 'button'; b.textContent = ic + ' ' + who.length;
      b.setAttribute('aria-pressed', String(who.includes(email)));
      b.onclick = () => react(p.id, k); r.appendChild(b);
    });
    if (p.by === email) {
      const d = document.createElement('button');
      d.type = 'button'; d.className = 'del'; d.textContent = 'মুছুন';
      d.onclick = () => remove(p.id); r.appendChild(d);
    }
    box.appendChild(el);
  });
}

function react(id, k) {
  const all = posts(), p = all.find(x => x.id === id); if (!p) return;
  const who = p.reacts[k] || [], i = who.indexOf(email);
  if (i >= 0) who.splice(i, 1); else who.push(email);
  p.reacts[k] = who; Store.set('feed', all); render();
}
function remove(id) {
  if (!confirm('পোস্টটা মুছে ফেলবেন?')) return;
  Store.set('feed', posts().filter(p => !(p.id === id && p.by === email))); render();
}

$('#text').addEventListener('input', () => { $('#cnt').textContent = $('#text').value.length + '/' + MAX; });
$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#text').value.trim();
  if (text.length < 3) return ($('#fmsg').textContent = 'কমপক্ষে ৩ অক্ষর লিখুন।');
  const all = posts();
  all.unshift({ id: 'p' + Date.now(), by: email, name: myName(), text: text.slice(0, MAX), at: Date.now(), reacts: {} });
  Store.set('feed', all.slice(0, 200));
  $('#text').value = ''; $('#cnt').textContent = '0/' + MAX; $('#fmsg').textContent = ''; render();
});
document.querySelectorAll('.tabs2 button').forEach(b => b.addEventListener('click', () => {
  filter = b.dataset.f;
  document.querySelectorAll('.tabs2 button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  render();
}));
$('#cnt').textContent = '0/' + MAX;
document.documentElement.dataset.theme = Store.get('theme', 'light');
render();
