// login.js - লগইন পেজের UI আচরণ ও আগের লগইন সেশন যাচাই
import { register, login } from './fb-auth.js';
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const $ = (s) => document.querySelector(s);
let mode = 'signin';
let authCheckFinished = false;
const ref = new URLSearchParams(location.search).get('ref');

// আগে লগইন করা থাকলে পাসওয়ার্ড না চেয়ে সরাসরি ড্যাশবোর্ডে পাঠায়।
onAuthStateChanged(auth, (user) => {
  if (user) {
    location.replace('pages/dashboard.html');
    return;
  }
  authCheckFinished = true;
});

function setMode(m) {
  mode = m;
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
  $('#confirm-wrap').classList.toggle('hidden', m === 'signin');
  $('#submit').textContent = m === 'signin' ? 'সাইন ইন' : 'অ্যাকাউন্ট তৈরি করুন';
  $('#msg').textContent = '';
}
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
if (ref) setMode('signup');

$('#toggle-pw').addEventListener('click', () => {
  const p = $('#password'); p.type = p.type === 'password' ? 'text' : 'password';
});

$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#email').value.trim().toLowerCase(), pw = $('#password').value;
  if (pw.length < 6) return ($('#msg').textContent = 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
  if (mode === 'signup' && pw !== $('#confirm').value) return ($('#msg').textContent = 'দুটো পাসওয়ার্ড মেলেনি।');
  const btn = $('#submit'); btn.disabled = true; $('#msg').textContent = 'অপেক্ষা করুন...';
  const err = mode === 'signin' ? await login(email, pw) : await register(email, pw, ref);
  btn.disabled = false;
  if (err) return ($('#msg').textContent = err);
  location.replace('pages/dashboard.html');
});

const root = document.documentElement;
root.dataset.theme = Store.get('theme', 'light');
$('#theme').addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  Store.set('theme', root.dataset.theme);
});
