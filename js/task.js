// tasks.js - টাস্ক তালিকা দেখায়, প্রমাণ জমা নেয়, অনুমোদনের পর রিওয়ার্ড যোগ করে
const $ = (s) => document.querySelector(s);
const email = Store.get('session');
const KEY = 'subs:' + email, WKEY = 'wallet:' + email;
const dev = new URLSearchParams(location.search).get('dev') === '1'; // শুধু পরীক্ষার জন্য
let filter = 'all';

const subs = () => Store.get(KEY, {});
const label = { pending: 'অনুমোদনের অপেক্ষায়', approved: 'সম্পন্ন', rejected: 'বাতিল' };
const cls = { pending: 'pill--pending', approved: 'pill--done', rejected: 'pill--rejected' };

function render() {
  const s = subs(), box = $('#list');
  box.textContent = '';
  const list = TASKS.filter(t => filter === 'all' || (filter === 'open' ? !s[t.id] : s[t.id]));
  if (!list.length) { box.innerHTML = '<p class="note">এই তালিকায় কোনো টাস্ক নেই।</p>'; return; }
  list.forEach(t => {
    const sub = s[t.id], el = document.createElement('article');
    el.className = 'task';
    el.innerHTML = `<div class="task__row"><div><h4></h4><p></p></div><span class="reward">৳ ${t.reward}</span></div>`;
    el.querySelector('h4').textContent = t.title;
    el.querySelector('p').textContent = t.desc;
    if (sub) {
      el.insertAdjacentHTML('beforeend', `<span class="pill ${cls[sub.status]}">${label[sub.status]}</span>`);
      if (dev && sub.status === 'pending') {
        const b = document.createElement('button');
        b.className = 'dev'; b.textContent = 'অনুমোদন (শুধু পরীক্ষা)';
        b.onclick = () => approve(t);
        el.appendChild(b);
      }
    } else {
      const f = document.createElement('form');
      f.innerHTML = `<input required minlength="3" placeholder="${t.proof}"><button class="go" type="submit">প্রমাণ জমা দিন</button>`;
      f.onsubmit = (e) => { e.preventDefault(); submit(t, f.querySelector('input').value.trim()); };
      el.appendChild(f);
    }
    box.appendChild(el);
  });
}

function submit(t, proof) {
  const s = subs(); s[t.id] = { proof, status: 'pending', at: Date.now() };
  Store.set(KEY, s); render();
}
function approve(t) {
  const s = subs(); s[t.id].status = 'approved'; Store.set(KEY, s);
  const w = Store.get(WKEY, { balance: 0, tasks: 0, referrals: 0 });
  w.balance += t.reward; w.tasks += 1; Store.set(WKEY, w); render();
}

document.querySelectorAll('.tabs2 button').forEach(b => b.addEventListener('click', () => {
  filter = b.dataset.f;
  document.querySelectorAll('.tabs2 button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  render();
}));
document.documentElement.dataset.theme = Store.get('theme', 'light');
render();
