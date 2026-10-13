// wallet.js - Firestore-backed wallet methods and withdrawal requests
import { db } from './firebase-config.js';
import {
  collection, addDoc, getDocs, query, where, doc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const me = await window.hubUser;
const MIN_WITHDRAW = 100, MAX_WITHDRAW = 5000, MAX_WALLETS = 5;
const paymentTypes = ['bKash', 'Nagad', 'Rocket'];
const statusLabel = { pending: 'অপেক্ষায়', paid: 'পরিশোধিত', rejected: 'বাতিল' };
let methods = [], requests = [], currentBalance = 0;

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
}
async function loadData() {
  const [userSnap, methodSnap, requestSnap] = await Promise.all([
    getDoc(doc(db, 'users', me.uid)),
    getDocs(query(collection(db, 'wallets'), where('uid', '==', me.uid))),
    getDocs(query(collection(db, 'withdrawals'), where('uid', '==', me.uid)))
  ]);
  if (!userSnap.exists()) throw new Error('আপনার ইউজার প্রোফাইল পাওয়া যায়নি।');
  currentBalance = Number(userSnap.data().balance || 0);
  methods = methodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  requests = requestSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  requests.sort((a, b) => {
    const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return tb - ta;
  });
  render();
}
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
