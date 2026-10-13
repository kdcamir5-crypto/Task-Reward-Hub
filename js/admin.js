// admin.js - Admin: task submissions, withdrawals, and task management
import { db } from './firebase-config.js';
import {
  collection, getDocs, addDoc, updateDoc, doc, query, where,
  runTransaction, increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const me = await window.hubUser;
document.documentElement.dataset.theme = Store.get('theme', 'light');

if (!me.profile || me.profile.role !== 'admin') {
  $('#gate').classList.remove('hidden');
  $('#why').textContent = 'লগইন ইমেইল: ' + me.email + ' | UID: ' + me.uid + ' | role: ' +
    (me.profile ? JSON.stringify(me.profile.role) : 'নথি পাওয়া যায়নি') + (me.error ? ' | ত্রুটি: ' + me.error : '');
} else {
  $('#panel').classList.remove('hidden');
  loadAll();
  setupBotCodeGenerators();
}


const BOT_PACKAGES = [
  { id: 'pulse', name: 'AI Pulse Bot v2' },
  { id: 'quantum', name: 'Quantum Core Pro' },
  { id: 'neural', name: 'Neural Matrix Bot' },
  { id: 'cyber', name: 'Cyber Forge Titan' },
  { id: 'apex', name: 'Apex Sentinel AI' }
];
function randomRedeemCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let code = 'BOT-';
  for (let i = 0; i < bytes.length; i++) code += chars[bytes[i] % chars.length];
  return code;
}
function setupBotCodeGenerators() {
  const host = $('#bot-code-generators');
  if (!host) return;
  host.textContent = '';
  BOT_PACKAGES.forEach(bot => {
    const card = document.createElement('div');
    card.style.cssText = 'padding:12px;border:1px solid #8aa2bd55;border-radius:12px;display:grid;gap:8px';
    const title = document.createElement('strong'); title.textContent = bot.name;
    const info = document.createElement('small'); info.textContent = 'কোড তৈরি করলে ৩০ মিনিট বৈধ থাকবে';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'go'; button.textContent = 'এই বটের কোড তৈরি করুন';
    const output = document.createElement('input'); output.readOnly = true; output.placeholder = 'এখানে নতুন কোড দেখা যাবে'; output.setAttribute('aria-label', bot.name + ' redeem code');
    const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'mini'; copy.textContent = 'কোড কপি করুন'; copy.disabled = true;
    button.onclick = async () => {
      button.disabled = true;
      try {
        const code = randomRedeemCode();
        const now = Date.now();
        await addDoc(collection(db, 'botRedeemCodes'), {
          code, botId: bot.id, botName: bot.name,
          createdBy: me.uid, createdAt: serverTimestamp(),
          expiresAtMs: now + 30 * 60 * 1000,
          used: false, usedBy: null, usedAt: null
        });
        output.value = code;
        copy.disabled = false;
        say('#bot-code-msg', bot.name + ' এর নতুন কোড তৈরি হয়েছে। ৩০ মিনিটের মধ্যে Telegram-এ ইউজারকে পাঠান।', true);
        await loadBotCodeHistory();
      } catch (e) {
        say('#bot-code-msg', 'কোড তৈরি হয়নি: ' + readableError(e) + ' Firestore Rules-এ botRedeemCodes admin permission লাগতে পারে।', false);
      } finally { button.disabled = false; }
    };
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(output.value); copy.textContent = 'কপি হয়েছে ✓'; }
      catch { output.focus(); output.select(); say('#bot-code-msg', 'কোডটি সিলেক্ট হয়েছে—Ctrl+C চাপুন।', true); }
    };
    card.append(title, info, button, output, copy);
    host.appendChild(card);
  });
  loadBotCodeHistory();
}
async function loadBotCodeHistory() {
  const host = $('#bot-code-history');
  if (!host) return;
  host.textContent = 'সাম্প্রতিক কোড লোড হচ্ছে...';
  try {
    const snap = await getDocs(collection(db, 'botRedeemCodes'));
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => Number(b.expiresAtMs || 0) - Number(a.expiresAtMs || 0)).slice(0, 15);
    host.textContent = '';
    if (!docs.length) { host.textContent = 'এখনো কোনো redeem code তৈরি হয়নি।'; return; }
    docs.forEach(x => {
      const line = document.createElement('div');
      line.style.cssText = 'padding:10px;border:1px solid #8aa2bd44;border-radius:10px;display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap';
      const textBox = document.createElement('span');
      const status = x.used ? 'ব্যবহৃত' : (Number(x.expiresAtMs) <= Date.now() ? 'মেয়াদ শেষ' : 'সক্রিয়');
      textBox.textContent = (x.botName || x.botId) + ' · ' + x.code + ' · ' + status;
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'mini'; copy.textContent = 'কপি';
      copy.onclick = async () => { try { await navigator.clipboard.writeText(x.code); copy.textContent = 'কপি ✓'; } catch { window.prompt('কোড কপি করুন', x.code); } };
      line.append(textBox, copy); host.appendChild(line);
    });
  } catch (e) { host.textContent = 'কোডের তালিকা লোড হয়নি: ' + readableError(e); }
}

function say(id, m, ok) { const e = $(id); e.textContent = m; e.className = 'msg2 ' + (ok ? 'ok' : 'err'); }
function row(html) { const d = document.createElement('div'); d.className = 'row'; d.innerHTML = html; return d; }
function readableError(e) {
  if (e.code === 'permission-denied') return 'Firestore অনুমতি দেয়নি। Rules যাচাই করুন।';
  return e.message || e.code || 'অজানা সমস্যা';
}
async function loadAll() { await Promise.all([loadSubs(), loadWithdrawals(), loadTasks()]); }

async function loadWithdrawals() {
  const box = $('#withdrawals'); box.textContent = 'লোড হচ্ছে...';
  try {
    const snap = await getDocs(query(collection(db, 'withdrawals'), where('status', '==', 'pending')));
    box.textContent = '';
    if (snap.empty) { box.innerHTML = '<p class="lock">অপেক্ষায় কোনো উইথড্র আবেদন নেই।</p>'; return; }
    snap.docs.forEach(d => {
      const x = d.data();
      const r = row('<span><b></b><small></small><small></small></span><span class="acts"></span>');
      const spans = r.querySelectorAll('small');
      r.querySelector('b').textContent = '৳ ' + Number(x.amount).toFixed(2) + ' • ' + x.type;
      spans[0].textContent = 'ইউজার UID: ' + x.uid;
      spans[1].textContent = 'নম্বর: ' + x.number;
      const acts = r.querySelector('.acts');
      const paid = document.createElement('button'); paid.className = 'mini ok'; paid.textContent = 'Approve / Paid';
      const rejectBtn = document.createElement('button'); rejectBtn.className = 'mini no'; rejectBtn.textContent = 'Reject';
      paid.onclick = () => settleWithdrawal(d.id, 'paid', paid, rejectBtn);
      rejectBtn.onclick = () => settleWithdrawal(d.id, 'rejected', paid, rejectBtn);
      acts.append(paid, rejectBtn); box.appendChild(r);
    });
  } catch (e) { box.textContent = 'উইথড্র আবেদন লোড হয়নি: ' + readableError(e); }
}

async function settleWithdrawal(id, outcome, approveBtn, rejectBtn) {
  if (outcome === 'paid' && !confirm('এই আবেদন Approve করলে ইউজারের Firestore balance থেকে টাকা কাটা হবে। পেমেন্ট যাচাই করেছেন তো?')) return;
  approveBtn.disabled = rejectBtn.disabled = true;
  try {
    await runTransaction(db, async tx => {
      const requestRef = doc(db, 'withdrawals', id);
      const requestSnap = await tx.get(requestRef);
      if (!requestSnap.exists() || requestSnap.data().status !== 'pending')
        throw new Error('এই আবেদন আগেই নিষ্পত্তি হয়েছে।');
      const request = requestSnap.data();
      if (outcome === 'paid') {
        const userRef = doc(db, 'users', request.uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new Error('ইউজারের প্রোফাইল পাওয়া যায়নি।');
        const balance = Number(userSnap.data().balance || 0);
        const amount = Number(request.amount);
        if (!Number.isFinite(amount) || amount < 100 || amount > 5000)
          throw new Error('আবেদনের পরিমাণ গ্রহণযোগ্য নয়।');
        if (balance < amount) throw new Error('ইউজারের ব্যালেন্স যথেষ্ট নয়।');
        tx.update(userRef, { balance: balance - amount });
      }
      tx.update(requestRef, {
        status: outcome,
        reviewedBy: me.uid,
        reviewedAt: serverTimestamp()
      });
    });
    await loadWithdrawals();
  } catch (e) {
    alert('উইথড্র নিষ্পত্তি হয়নি: ' + readableError(e));
    approveBtn.disabled = rejectBtn.disabled = false;
  }
}

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
  } catch (e) { box.textContent = 'লোড করা যায়নি: ' + readableError(e); }
}
async function approve(id, ok, no) {
  ok.disabled = no.disabled = true;
  try {
    await runTransaction(db, async tx => {
      const ref = doc(db, 'submissions', id), snap = await tx.get(ref);
      if (!snap.exists() || snap.data().status !== 'pending') throw new Error('আগেই নিষ্পত্তি হয়েছে');
      const x = snap.data();
      tx.update(ref, { status: 'approved', reviewedBy: me.uid, reviewedAt: serverTimestamp() });
      tx.update(doc(db, 'users', x.uid), { balance: increment(x.reward), tasks: increment(1) });
    });
  } catch (e) { alert('ব্যর্থ: ' + readableError(e)); }
  loadSubs();
}
async function reject(id, ok, no) {
  ok.disabled = no.disabled = true;
  try { await updateDoc(doc(db, 'submissions', id), { status: 'rejected', reviewedBy: me.uid, reviewedAt: serverTimestamp() }); }
  catch (e) { alert('ব্যর্থ: ' + readableError(e)); }
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
      b.onclick = async () => { b.disabled = true; try { await updateDoc(doc(db, 'tasks', d.id), { active: !x.active }); await loadTasks(); } catch (e) { alert(readableError(e)); b.disabled = false; } };
      r.querySelector('.acts').appendChild(b); box.appendChild(r);
    });
  } catch (e) { box.textContent = 'লোড করা যায়নি: ' + readableError(e); }
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
  } catch (e) { say('#tmsg', 'ব্যর্থ: ' + readableError(e), false); }
});
