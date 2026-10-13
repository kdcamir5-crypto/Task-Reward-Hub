// tasks.js (module) - Firestore থেকে টাস্ক আনে, প্রমাণ জমা নেয়। অনুমোদন শুধু অ্যাডমিন করে।
import { db } from './firebase-config.js';
import { collection, getDocs, query, where, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const me = await window.hubUser;
let filter = 'all', tasks = [], subs = {};
const label = { pending: 'অনুমোদনের অপেক্ষায়', approved: 'সম্পন্ন', rejected: 'বাতিল' };
const cls = { pending: 'pill--pending', approved: 'pill--done', rejected: 'pill--rejected' };

async function load() {
  $('#list').innerHTML = '<p class="note">লোড হচ্ছে...</p>';
  try {
    const t = await getDocs(query(collection(db, 'tasks'), where('active', '==', true)));
    tasks = t.docs.map(d => ({ id: d.id, ...d.data() }));
    const s = await getDocs(query(collection(db, 'submissions'), where('uid', '==', me.uid)));
    subs = {}; s.docs.forEach(d => { subs[d.data().taskId] = d.data(); });
    render();
  } catch (e) { $('#list').innerHTML = '<p class="note">লোড করা যায়নি: ' + (e.code || e.message) + '</p>'; }
}

function render() {
  const box = $('#list'); box.textContent = '';
  const list = tasks.filter(t => filter === 'all' || (filter === 'open' ? !subs[t.id] : subs[t.id]));
  if (!list.length) { box.innerHTML = '<p class="note">এই তালিকায় কোনো টাস্ক নেই।</p>'; return; }
  list.forEach(t => {
    const sub = subs[t.id], el = document.createElement('article');
    el.className = 'task';
    el.innerHTML = '<div class="task__row"><div><h4></h4><p></p></div><span class="reward"></span></div>';
    el.querySelector('h4').textContent = t.title;
    el.querySelector('p').textContent = t.desc || '';
    el.querySelector('.reward').textContent = '৳ ' + t.reward;
    if (sub) {
      const pill = document.createElement('span');
      pill.className = 'pill ' + cls[sub.status]; pill.textContent = label[sub.status];
      el.appendChild(pill);
    } else {
      const f = document.createElement('form');
      f.innerHTML = '<input required minlength="3" maxlength="300"><button class="go" type="submit">প্রমাণ জমা দিন</button>';
      f.querySelector('input').placeholder = t.proof || 'প্রমাণ লিখুন';
      f.onsubmit = (e) => { e.preventDefault(); submit(t, f.querySelector('input').value.trim(), f.querySelector('button')); };
      el.appendChild(f);
    }
    box.appendChild(el);
  });
}

async function submit(t, proof, btn) {
  btn.disabled = true;
  try {
    await setDoc(doc(db, 'submissions', me.uid + '_' + t.id), {
      uid: me.uid, email: me.email, taskId: t.id, taskTitle: t.title,
      reward: t.reward, proof, status: 'pending', createdAt: serverTimestamp()
    });
    await load();
  } catch (e) { btn.disabled = false; alert('জমা দেওয়া যায়নি: ' + (e.code || e.message)); }
}

document.querySelectorAll('.tabs2 button').forEach(b => b.addEventListener('click', () => {
  filter = b.dataset.f;
  document.querySelectorAll('.tabs2 button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  render();
}));
document.documentElement.dataset.theme = Store.get('theme', 'light');
load();
