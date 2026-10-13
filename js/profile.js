// profile.js - প্রোফাইল তথ্য সংরক্ষণ, পাসওয়ার্ড বদল, রেফারেল কোড, সাইন আউট
const $ = (s) => document.querySelector(s);
const email = Store.get('session');
const PKEY = 'profile:' + email;
const user = Auth.users()[email] || { id: 'TRH00000' };

function say(id, msg, ok) { const el = $(id); el.textContent = msg; el.className = 'msg2 ' + (ok ? 'ok' : 'err'); }

function load() {
  const p = Store.get(PKEY, {});
  const name = p.name || email.split('@')[0];
  $('#hname').textContent = name;
  $('#hmail').textContent = email;
  $('#avatar').textContent = name.charAt(0).toUpperCase();
  $('#name').value = p.name || '';
  $('#phone').value = p.phone || '';
  $('#tg').value = p.telegram || '';
  $('#email').value = email;
  $('#refcode').textContent = user.id;
}

$('#info').addEventListener('submit', (e) => {
  e.preventDefault();
  const phone = $('#phone').value.trim(), tg = $('#tg').value.trim().replace(/^@/, '');
  if (phone && !/^01[3-9]\d{8}$/.test(phone)) return say('#imsg', 'সঠিক ১১ ডিজিটের নম্বর দিন।', false);
  if (tg && !/^[A-Za-z0-9_]{5,32}$/.test(tg)) return say('#imsg', 'Telegram ইউজারনেম ৫-৩২ অক্ষরের (ইংরেজি, সংখ্যা, _) হতে হবে।', false);
  Store.set(PKEY, { name: $('#name').value.trim(), phone, telegram: tg });
  say('#imsg', 'সংরক্ষণ হয়েছে।', true); load();
});

$('#pw').addEventListener('submit', (e) => {
  e.preventDefault();
  const users = Auth.users(), u = users[email];
  const cur = $('#cur').value, nw = $('#new').value, cf = $('#cf').value;
  if (!u || u.password !== cur) return say('#pmsg', 'বর্তমান পাসওয়ার্ড ঠিক নয়।', false);
  if (nw.length < 6) return say('#pmsg', 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।', false);
  if (nw !== cf) return say('#pmsg', 'দুটো নতুন পাসওয়ার্ড মেলেনি।', false);
  u.password = nw; Store.set('users', users);
  $('#pw').reset(); say('#pmsg', 'পাসওয়ার্ড বদলানো হয়েছে।', true);
});

$('#copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(user.id); $('#copy').textContent = 'কপি হয়েছে'; }
  catch { $('#copy').textContent = 'কপি করা গেল না'; }
});

$('#logout').addEventListener('click', () => window.hubLogout());
document.documentElement.dataset.theme = Store.get('theme', 'light');
load();
