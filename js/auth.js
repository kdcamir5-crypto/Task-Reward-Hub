// fb-auth.js - Firebase দিয়ে আসল রেজিস্টার, লগইন ও সাইন আউট
import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const ERR = {
  'auth/email-already-in-use': 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট আছে।',
  'auth/invalid-email': 'ইমেইলের ফরম্যাট ঠিক নয়।',
  'auth/weak-password': 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।',
  'auth/invalid-credential': 'ইমেইল বা পাসওয়ার্ড ঠিক নয়।',
  'auth/user-not-found': 'ইমেইল বা পাসওয়ার্ড ঠিক নয়।',
  'auth/wrong-password': 'ইমেইল বা পাসওয়ার্ড ঠিক নয়।',
  'auth/too-many-requests': 'অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
  'auth/network-request-failed': 'ইন্টারনেট সংযোগ পরীক্ষা করুন।',
  'permission-denied': 'অনুমতি নেই। Firestore-এর নিয়ম (Rules) ঠিকমতো বসানো হয়েছে কি না দেখুন।'
};
const msg = (e) => ERR[e.code] || ('সমস্যা হয়েছে: ' + (e.code || e.message));

// পুরনো পেজগুলো (ওয়ালেট, কোড, ফিড) এখনো localStorage-এর "session" দেখে, তাই সাময়িক সেতু
function bridge(email, refCode) {
  const users = Store.get('users', {});
  users[email] = { ...(users[email] || {}), id: refCode };
  Store.set('users', users);
  Store.set('session', email);
}

// ইউজারের Firestore নথি না থাকলে বানায় (কনসোল থেকে বা আগের ব্যর্থ চেষ্টায় তৈরি অ্যাকাউন্টের জন্য)
async function ensureProfile(user, email, ref) {
  const ref_ = doc(db, 'users', user.uid), snap = await getDoc(ref_);
  if (snap.exists()) return snap.data().refCode;
  const refCode = 'TRH' + user.uid.slice(0, 6).toUpperCase();
  await setDoc(ref_, {
    email, refCode, referredBy: ref || null, role: 'user',
    balance: 0, tasks: 0, referrals: 0, createdAt: serverTimestamp()
  });
  return refCode;
}

export async function register(email, password, ref) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    bridge(email, await ensureProfile(cred.user, email, ref));
    return null;
  } catch (e) { return msg(e); }
}

export async function login(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    bridge(email, await ensureProfile(cred.user, email, null));
    return null;
  } catch (e) { return msg(e); }
}

export async function logout() {
  localStorage.removeItem('session');
  await signOut(auth);
}
