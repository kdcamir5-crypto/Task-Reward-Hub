// admin.js (module) - অ্যাডমিন: টাস্ক বানানো, জমা অনুমোদন/বাতিল। রোল না থাকলে ঢুকতে দেয় না।
import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, runTransaction, increment, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const me = await window.hubUser;
document.documentElement.dataset.theme = Store.get('theme', 'light');

if (!me.profile || me.profile.role !== 'admin') {
  $('#gate').classList.remove('hidden');
} else {
  $('#panel').classList.remove('hidden');
  loadAll();
}

function say(id, m, ok) { const e = $(id); e.textContent = m; e.className = 'msg2 ' + (ok ? 'ok' : 'err'); }
function row(html) { const d = document.createElement('div'); d.className = 'row'; d.innerHTML = html; return d; }

async function loadAll() { await Promise.all([loadSubs(), loadTasks()]); }

async function loadSubs() {
  const box = $('#subs'); box.textContent = '...';
  try {
    const s = await getDocs(query(collection(db, 'submissions'), where('status', '==', 'pending')));
    box.textContent = '';
    if (s.empty) { box.innerHTML = '<p class="lock">অপেক্ষায় কোনো জমা নেই।</p>'; return; }
    s.docs.forEach(d => {
      const x = d.data(), r = row('<span><b></b><small></small><small></small></span><span class="acts"></span>');
      const sm = r.querySelectorAll('small');
      r.querySelector('b').textContent = x.taskTitle + ' (৳ ' + x.reward + ')';
      sm[0].textContent = x.email;
      sm[1].textContent = x.image ? 'প্রমাণ: স্ক্রিনশট (ছবিতে চাপলে বড় হবে)' : 'প্রমাণ: ' + x.proof;
      if (x.image && x.image.startsWith('data:image/jpeg;base64,')) {
        const im = document.createElement('img'); im.src = x.image; im.alt = 'স্ক্রিনশট'; im.className = 'thumb';
        im.onclick = () => im.classList.toggle('big'); r.querySelector('span').appendChild(im);
      }
      const ok = document.createElement('button'); ok.className = 'mini ok'; ok.textContent = 'অনুমোদন';
      const no = document.createElement('button'); no.className = 'mini no'; no.textContent = 'বাতিল';
      ok.onclick = () => approve(d.id, ok, no); no.onclick = () => reject(d.id, ok, no);
      r.querySelector('.acts').append(ok, no); box.appendChild(r);
    });
  } catch (e) { box.textContent = 'লোড করা যায়নি: ' + (e.code || e.message); }
}

async function approve(id, ok, no) {
  ok.disabled = no.disabled = true;
  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'submissions', id), snap = await tx.get(ref);
      if (!snap.exists() || snap.data().status !== 'pending') throw new Error('আগেই নিষ্পত্তি হয়েছে');
      const x = snap.data();
      tx.update(ref, { status: 'approved', reviewedBy: me.uid, reviewedAt: serverTimestamp() });
      tx.update(doc(db, 'users', x.uid), { balance: increment(x.reward), tasks: increment(1) });
    });
  } catch (e) { alert('ব্যর্থ: ' + (e.code || e.message)); }
  loadSubs();
}
async function reject(id, ok, no) {
  ok.disabled = no.disabled = true;
  try { await updateDoc(doc(db, 'submissions', id), { status: 'rejected', reviewedBy: me.uid, reviewedAt: serverTimestamp() }); }
  catch (e) { alert('ব্যর্থ: ' + (e.code || e.message)); }
  loadSubs();
}

async function loadTasks() {
  const box = $('#tlist'); box.textContent = '...';
  try {
    const t = await getDocs(collection(db, 'tasks'));
    box.textContent = '';
    if (t.empty) { box.innerHTML = '<p class="lock">এখনো কোনো টাস্ক নেই।</p>'; return; }
    t.docs.forEach(d => {
      const x = d.data(), r = row('<span><b></b><small></small></span><span class="acts"></span>');
      r.querySelector('b').textContent = x.title + ' (৳ ' + x.reward + ')';
      r.querySelector('small').textContent = x.active ? 'চালু' : 'বন্ধ';
      const b = document.createElement('button'); b.className = 'mini'; b.textContent = x.active ? 'বন্ধ করুন' : 'চালু করুন';
      b.onclick = async () => { b.disabled = true; await updateDoc(doc(db, 'tasks', d.id), { active: !x.active }); loadTasks(); };
      r.querySelector('.acts').appendChild(b); box.appendChild(r);
    });
  } catch (e) { box.textContent = 'লোড করা যায়নি: ' + (e.code || e.message); }
}

$('#tform').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = $('#ttitle').value.trim(), desc = $('#tdesc').value.trim(),
        reward = Number($('#treward').value), proof = $('#tproof').value.trim(),
        link = $('#tlink').value.trim(), proofType = $('#tptype').value;
  if (title.length < 3 || !(reward > 0)) return say('#tmsg', 'শিরোনাম ও সঠিক রিওয়ার্ড দিন।', false);
  if (link) { try { const u = new URL(link); if (!['http:', 'https:'].includes(u.protocol)) throw 0; } catch { return say('#tmsg', 'লিংক http:// বা https:// দিয়ে শুরু হতে হবে।', false); } }
  try {
    await addDoc(collection(db, 'tasks'), { title, desc, reward, proof, link, proofType, active: true, createdAt: serverTimestamp() });
    $('#tform').reset(); say('#tmsg', 'টাস্ক যুক্ত হয়েছে।', true); loadTasks();
  } catch (e) { say('#tmsg', 'ব্যর্থ: ' + (e.code || e.message), false); }
});
