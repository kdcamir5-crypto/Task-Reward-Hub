// login.js - লগইন পেজের UI আচরণ
const $ = (s) => document.querySelector(s);
let mode = 'signin';
const ref = new URLSearchParams(location.search).get('ref');

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

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = $('#email').value.trim().toLowerCase(), pw = $('#password').value;
  if (pw.length < 6) return ($('#msg').textContent = 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
  if (mode === 'signup' && pw !== $('#confirm').value) return ($('#msg').textContent = 'দুটো পাসওয়ার্ড মেলেনি।');
  const err = mode === 'signin' ? Auth.login(email, pw) : Auth.register(email, pw, ref);
  if (err) return ($('#msg').textContent = err);
  location.href = 'pages/dashboard.html'; // পরের ধাপে বানানো হবে
});

const root = document.documentElement;
root.dataset.theme = Store.get('theme', 'light');
$('#theme').addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  Store.set('theme', root.dataset.theme);
});
