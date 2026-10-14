// wallet.js - Firestore-backed wallet methods and withdrawal requests
import { db } from './firebase-config.js';
import {
  collection, addDoc, getDocs, query, where, doc, getDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const me = await window.hubUser;
const MIN_WITHDRAW = 100, MAX_WITHDRAW = 5000, MAX_WALLETS = 5;
const paymentTypes = ['bKash', 'Nagad', 'Rocket'];
const statusLabel = { pending: 'অপেক্ষায়', paid: 'পরিশোধিত', rejected: 'বাতিল' };
let methods = [], requests = [], deposits = [], currentBalance = 0;

function say(id, msg, ok) {
  const el = $(id);
  el.textContent = msg;
  el.className = 'msg2 ' + (ok ? 'ok' : 'err');
}
function errorText(e) {
  if (e.code === 'permission-denied') return 'Firestore অনুমতি দেয়নি। Rules আপডেট হয়েছে কি না যাচাই করুন।';
  if (e.code === 'unavailable') return 'ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।';
  return e.message || e.code || 'অজানা সমস্যা';
}
function maskNumber(n) {
  return n.length >= 7 ? n.slice(0, 3) + '••••' + n.slice(-4) : n;
}
function render() {
  $('#bal').textContent = '৳ ' + currentBalance.toFixed(2);
  const list = $('#wallets');
  list.textContent = '';
  if (!methods.length) list.innerHTML = '<p class="lock">এখনো কোনো ওয়ালেট যুক্ত নেই।</p>';
  methods.forEach(w => {
    const d = document.createElement('div'); d.className = 'row';
    const span = document.createElement('span');
    const b = document.createElement('b'); b.textContent = w.type;
    const small = document.createElement('small'); small.textContent = maskNumber(w.number);
    span.append(b, small);
    const lock = document.createElement('span'); lock.className = 'lock'; lock.textContent = 'সেভ করা';
    d.append(span, lock); list.appendChild(d);
  });
  $('#bind-box').classList.toggle('hidden', methods.length >= MAX_WALLETS);
  const dest = $('#dest'); dest.textContent = '';
  methods.forEach((w, i) => dest.add(new Option(w.type + ' ' + maskNumber(w.number), String(i))));
  const hist = $('#hist'); hist.textContent = '';
  if (!requests.length) hist.innerHTML = '<p class="lock">এখনো কোনো উইথড্র রিকোয়েস্ট নেই।</p>';
  requests.forEach(r => {
    const d = document.createElement('div'); d.className = 'row';
    const span = document.createElement('span');
    const b = document.createElement('b'); b.textContent = '৳ ' + Number(r.amount).toFixed(2);
    const small = document.createElement('small');
    const date = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate() : null;
    small.textContent = r.type + ' • ' + (date ? date.toLocaleDateString('bn-BD') : 'তারিখ প্রক্রিয়াধীন');
    span.append(b, small);
    const state = document.createElement('span'); state.className = 'lock';
    state.textContent = statusLabel[r.status] || r.status || 'অজানা';
    d.append(span, state); hist.appendChild(d);
  });
  const depositHistory = $('#deposit-history');
  if (depositHistory) {
    depositHistory.textContent = '';
    if (!deposits.length) depositHistory.innerHTML = '<p class="lock">এখনো কোনো ডিপোজিট রিকোয়েস্ট নেই।</p>';
    deposits.forEach(item => {
      const d = document.createElement('div'); d.className = 'row';
      const left = document.createElement('span');
      const title = document.createElement('b'); title.textContent = '৳ ' + Number(item.amount).toFixed(2) + ' · ' + item.type;
      const meta = document.createElement('small'); meta.textContent = 'TrxID: ' + item.trxId;
      const date = document.createElement('small');
      const when = item.createdAt && item.createdAt.toDate ? item.createdAt.toDate() : null;
      date.textContent = when ? when.toLocaleDateString('bn-BD') : 'তারিখ প্রক্রিয়াধীন';
      left.append(title, meta, date);
      const state = document.createElement('span'); state.className = 'lock';
      state.textContent = statusLabel[item.status] || (item.status === 'approved' ? 'অনুমোদিত' : item.status === 'rejected' ? 'বাতিল' : 'অপেক্ষায়');
      d.append(left, state); depositHistory.appendChild(d);
    });
  }
}
async function loadData() {
  const [userSnap, methodSnap, requestSnap, depositSnap] = await Promise.all([
    getDoc(doc(db, 'users', me.uid)),
    getDocs(query(collection(db, 'wallets'), where('uid', '==', me.uid))),
    getDocs(query(collection(db, 'withdrawals'), where('uid', '==', me.uid))),
    getDocs(query(collection(db, 'walletDeposits'), where('uid', '==', me.uid)))
  ]);
  if (!userSnap.exists()) throw new Error('আপনার ইউজার প্রোফাইল পাওয়া যায়নি।');
  currentBalance = Number(userSnap.data().balance || 0);
  methods = methodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  requests = requestSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  deposits = depositSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  requests.sort((a, b) => {
    const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return tb - ta;
  });
  deposits.sort((a, b) => {
    const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return tb - ta;
  });
  render();
}
$('#deposit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = $('#deposit-type').value;
  const amount = Number($('#deposit-amount').value);
  const senderNumber = $('#deposit-sender').value.trim();
  const trxId = $('#deposit-trx').value.trim().replace(/\s+/g, '');
  if (!['bKash', 'Nagad'].includes(type)) return say('#deposit-msg', 'শুধু bKash বা Nagad নির্বাচন করুন।', false);
  if (!Number.isFinite(amount) || amount < 10 || amount > 50000 || !Number.isInteger(amount))
    return say('#deposit-msg', 'জমার পরিমাণ ৳10 থেকে ৳50,000-এর মধ্যে পূর্ণ সংখ্যা হতে হবে।', false);
  if (!/^01[3-9]\d{8}$/.test(senderNumber)) return say('#deposit-msg', 'সঠিক ১১ ডিজিটের প্রেরক নম্বর দিন।', false);
  if (trxId.length < 5 || trxId.length > 100) return say('#deposit-msg', 'সঠিক Transaction ID লিখুন।', false);
  const btn = $('#deposit-submit'); btn.disabled = true;
  try {
    const userSnap = await getDoc(doc(db, 'users', me.uid));
    if (!userSnap.exists()) throw new Error('আপনার ইউজার প্রোফাইল পাওয়া যায়নি।');
    const profile = userSnap.data();
    await addDoc(collection(db, 'walletDeposits'), {
      uid: me.uid,
      userName: String(profile.name || profile.displayName || me.displayName || 'নাম দেওয়া হয়নি').slice(0, 100),
      email: String(me.email || profile.email || '').slice(0, 160),
      type, amount, senderNumber, trxId,
      status: 'pending', createdAt: serverTimestamp()
    });
    $('#deposit-form').reset();
    await loadData();
    say('#deposit-msg', 'ডিপোজিট রিকোয়েস্ট জমা হয়েছে। Admin TrxID যাচাই করে Approve করলে ব্যালেন্স যোগ হবে।', true);
  } catch (err) { say('#deposit-msg', 'ডিপোজিট জমা হয়নি: ' + errorText(err), false); }
  finally { btn.disabled = false; }
});

$('#bind').addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = $('#type').value, number = $('#num').value.trim();
  if (!paymentTypes.includes(type)) return say('#bmsg', 'সঠিক পেমেন্ট মাধ্যম নির্বাচন করুন।', false);
  if (!/^01[3-9]\d{8}$/.test(number)) return say('#bmsg', 'সঠিক ১১ ডিজিটের নম্বর দিন (01XXXXXXXXX)।', false);
  if (methods.length >= MAX_WALLETS) return say('#bmsg', 'সর্বোচ্চ ৫টি ওয়ালেট যুক্ত করা যাবে।', false);
  if (methods.some(w => w.number === number)) return say('#bmsg', 'এই নম্বর আগেই যুক্ত আছে।', false);
  const btn = $('#bind').querySelector('button[type="submit"]'); btn.disabled = true;
  try {
    await addDoc(collection(db, 'wallets'), { uid: me.uid, type, number, createdAt: serverTimestamp() });
    $('#num').value = '';
    await loadData();
    say('#bmsg', 'ওয়ালেট Firestore-এ সেভ হয়েছে।', true);
  } catch (err) { say('#bmsg', errorText(err), false); }
  finally { btn.disabled = false; }
});
$('#wd').addEventListener('submit', async (e) => {
  e.preventDefault();
  const amount = Number($('#amt').value);
  if (!methods.length) return say('#wmsg', 'আগে একটি পেমেন্ট মাধ্যম যুক্ত করুন।', false);
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAW || amount > MAX_WITHDRAW)
    return say('#wmsg', 'উইথড্র পরিমাণ ৳' + MIN_WITHDRAW + ' থেকে ৳' + MAX_WITHDRAW + ' এর মধ্যে হতে হবে।', false);
  if (amount > currentBalance) return say('#wmsg', 'ব্যালেন্স যথেষ্ট নয়।', false);
  const index = Number($('#dest').value), dest = methods[index];
  if (!dest) return say('#wmsg', 'একটি পেমেন্ট মাধ্যম নির্বাচন করুন।', false);
  const btn = $('#wd').querySelector('button[type="submit"]'); btn.disabled = true;
  try {
    await addDoc(collection(db, 'withdrawals'), {
      uid: me.uid, amount, type: dest.type, number: dest.number,
      status: 'pending', createdAt: serverTimestamp()
    });
    $('#amt').value = '';
    await loadData();
    say('#wmsg', 'আবেদন জমা হয়েছে। Admin যাচাই করার পর ব্যালেন্স থেকে টাকা কাটা হবে।', true);
  } catch (err) { say('#wmsg', errorText(err), false); }
  finally { btn.disabled = false; }
});
$('#minlabel').textContent = '৳ ' + MIN_WITHDRAW + '–৳ ' + MAX_WITHDRAW;
document.documentElement.dataset.theme = Store.get('theme', 'light');
loadData().catch(err => {
  say('#wmsg', 'ওয়ালেট লোড করা যায়নি: ' + errorText(err), false);
  $('#bal').textContent = '৳ —';
});

// Live balance: auto-mining, admin approvals and withdrawals update the balance without a page refresh.
onSnapshot(doc(db, 'users', me.uid), (snap) => {
  if (!snap.exists()) return;
  const next = Number(snap.data().balance || 0);
  if (!Number.isFinite(next) || next === currentBalance) return;
  const grew = next > currentBalance;
  currentBalance = next;
  const el = $('#bal');
  el.textContent = '৳ ' + next.toFixed(2);
  if (el.animate) el.animate(
    [{ opacity: 0.35, transform: 'scale(1.06)' }, { opacity: 1, transform: 'scale(1)' }],
    { duration: grew ? 900 : 500, easing: 'ease-out' }
  );
}, (err) => console.warn('Live balance unavailable:', err && err.code));
