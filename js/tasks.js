// tasks.js (module) - টাস্ক তালিকা, ক্লিকযোগ্য লিংক, স্ক্রিনশট আপলোড (ছোট করে Firestore-এ জমা), প্রমাণ জমা
import { db, auth } from './firebase-config.js';
import { collection, getDocs, query, where, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const me = await window.hubUser;

const MONETAG_WORKER_URL = 'https://task-reward-hub-monetag-rewards.kdcamir5.workers.dev';

function setupMonetagReward() {
  const button = $('#monetag-watch');
  const status = $('#monetag-status');
  if (!button || !status) return;

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    status.className = 'monetag-status';
    status.textContent = 'বিজ্ঞাপনের সেশন প্রস্তুত হচ্ছে...';

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('আপনার সাইন-ইন সেশন পাওয়া যায়নি। আবার সাইন ইন করুন।');
      if (typeof window.show_12051888 !== 'function') {
        throw new Error('Monetag SDK লোড হয়নি। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।');
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch(MONETAG_WORKER_URL + '/ad-session', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + idToken,
          'Content-Type': 'application/json'
        },
        body: '{}'
      });
      const session = await response.json().catch(() => ({}));
      if (!response.ok || !session.ymid) {
        throw new Error(session.error || 'বিজ্ঞাপন সেশন তৈরি করা যায়নি। একটু পরে চেষ্টা করুন।');
      }

      status.textContent = 'বিজ্ঞাপন চালু হচ্ছে। অনুগ্রহ করে শেষ হওয়া পর্যন্ত দেখুন।';
      const result = await window.show_12051888({
        ymid: session.ymid,
        requestVar: 'daily_reward'
      });

      if (result?.reward_event_type === 'valued') {
        status.className = 'monetag-status monetag-status--success';
        status.textContent = 'বিজ্ঞাপন যাচাই হয়েছে। সার্ভার রিওয়ার্ড নিশ্চিত করলে ৳৩ ব্যালেন্সে যোগ হবে।';
      } else if (result?.reward_event_type === 'non_valued') {
        status.className = 'monetag-status monetag-status--warning';
        status.textContent = 'এই বিজ্ঞাপনটি রিওয়ার্ডযোগ্য নয়। এতে ব্যালেন্স যোগ হবে না।';
      } else {
        status.textContent = 'বিজ্ঞাপন প্রক্রিয়া শেষ। রিওয়ার্ড সার্ভারের যাচাইয়ের ওপর নির্ভর করবে।';
      }
    } catch (error) {
      status.className = 'monetag-status monetag-status--warning';
      status.textContent = error?.message || 'বিজ্ঞাপন চালানো যায়নি। পরে আবার চেষ্টা করুন।';
    } finally {
      button.disabled = false;
    }
  });
}
let filter = 'all', tasks = [], subs = {};
const label = { pending: 'অনুমোদনের অপেক্ষায়', approved: 'সম্পন্ন', rejected: 'বাতিল' };
const cls = { pending: 'pill--pending', approved: 'pill--done', rejected: 'pill--rejected' };

// শুধু http/https লিংক গ্রহণযোগ্য (javascript: ইত্যাদি আটকানো হয়)
function safeUrl(u) {
  try { const x = new URL(u); return (x.protocol === 'https:' || x.protocol === 'http:') ? x.href : null; }
  catch { return null; }
}
// লেখার ভেতরের লিংককে ক্লিকযোগ্য করে (innerHTML ছাড়া, নিরাপদে)
function linkify(el, text) {
  el.textContent = '';
  (text || '').split(/(https?:\/\/[^\s]+)/g).forEach(part => {
    const u = /^https?:\/\//.test(part) ? safeUrl(part) : null;
    if (u) { const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = part; el.appendChild(a); }
    else el.appendChild(document.createTextNode(part));
  });
}
// ছবি ছোট করে JPEG বানায় (সর্বোচ্চ ~৪০০ কিলোবাইট)
function compress(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let q = 0.7, d = c.toDataURL('image/jpeg', q);
      while (d.length > 400000 && q > 0.3) { q -= 0.1; d = c.toDataURL('image/jpeg', q); }
      d.length > 440000 ? reject(new Error('ছবিটা অনেক বড়')) : resolve(d);
    };
    img.onerror = () => reject(new Error('ছবি পড়া যায়নি'));
    img.src = url;
  });
}

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
    linkify(el.querySelector('p'), t.desc);
    el.querySelector('.reward').textContent = '৳ ' + t.reward;

    const url = safeUrl(t.link);
    if (url) {
      const a = document.createElement('a');
      a.className = 'linkbtn'; a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.textContent = 'লিংকে যান ↗'; el.appendChild(a);
    }

    if (sub) {
      const pill = document.createElement('span');
      pill.className = 'pill ' + cls[sub.status]; pill.textContent = label[sub.status];
      el.appendChild(pill);
    } else if (t.proofType === 'screenshot') {
      const f = document.createElement('form');
      f.innerHTML = '<label class="upl"><input type="file" accept="image/*" required><span>স্ক্রিনশট বেছে নিন</span></label><img class="prev hidden" alt="প্রিভিউ"><button class="go" type="submit">প্রমাণ জমা দিন</button><p class="msg2" role="status"></p>';
      const inp = f.querySelector('input'), prev = f.querySelector('.prev'), msg = f.querySelector('.msg2');
      let data = null;
      inp.onchange = async () => {
        data = null; msg.textContent = ''; const file = inp.files[0]; if (!file) return;
        if (!file.type.startsWith('image/')) { msg.className = 'msg2 err'; msg.textContent = 'শুধু ছবি দিন।'; return; }
        try { data = await compress(file); prev.src = data; prev.classList.remove('hidden'); f.querySelector('.upl span').textContent = file.name; }
        catch (e) { msg.className = 'msg2 err'; msg.textContent = e.message; }
      };
      f.onsubmit = (e) => { e.preventDefault(); if (!data) { msg.className = 'msg2 err'; msg.textContent = 'আগে একটা স্ক্রিনশট বেছে নিন।'; return; } submit(t, '', data, f.querySelector('.go')); };
      el.appendChild(f);
    } else {
      const f = document.createElement('form');
      f.innerHTML = '<input required minlength="3" maxlength="300"><button class="go" type="submit">প্রমাণ জমা দিন</button>';
      f.querySelector('input').placeholder = t.proof || 'প্রমাণ লিখুন';
      f.onsubmit = (e) => { e.preventDefault(); submit(t, f.querySelector('input').value.trim(), '', f.querySelector('.go')); };
      el.appendChild(f);
    }
    box.appendChild(el);
  });
}

async function submit(t, proof, image, btn) {
  btn.disabled = true;
  try {
    await setDoc(doc(db, 'submissions', me.uid + '_' + t.id), {
      uid: me.uid, email: me.email, taskId: t.id, taskTitle: t.title,
      reward: t.reward, proof, image, status: 'pending', createdAt: serverTimestamp()
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
setupMonetagReward();
load();
