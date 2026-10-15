// profile.js - প্রোফাইল তথ্য Firestore ও লোকাল স্টোরেজে সিঙ্ক, পাসওয়ার্ড, রেফারেল ও সাইন আউট
const $ = (s) => document.querySelector(s);
const email = Store.get('session');
const PKEY = 'profile:' + email;
const user = Auth.users()[email] || { id: 'TRH00000' };

function say(id, msg, ok) {
  const el = $(id);
  el.textContent = msg;
  el.className = 'msg2 ' + (ok ? 'ok' : 'err');
}

function load() {
  const p = Store.get(PKEY, {});
  const name = p.name || (email || '').split('@')[0];
  $('#hname').textContent = name;
  $('#hmail').textContent = email || '';
  $('#name').value = p.name || '';
  $('#phone').value = p.phone || '';
  $('#tg').value = p.telegram || '';
  $('#email').value = email || '';
  $('#refcode').textContent = user.id;
}

// Firestore profile is the shared source of truth for the homepage and profile page.
if (window.hubUser) {
  window.hubUser.then(({ profile }) => {
    if (!profile) return;
    const current = Store.get(PKEY, {});
    const synced = {
      ...current,
      ...(typeof profile.name === 'string' ? { name: profile.name } : {}),
      ...(typeof profile.phone === 'string' ? { phone: profile.phone } : {}),
      ...(typeof profile.telegram === 'string' ? { telegram: profile.telegram } : {})
    };
    Store.set(PKEY, synced);
    load();
  }).catch((error) => console.warn('Could not load shared profile:', error));
}

$('#info').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#name').value.trim();
  const phone = $('#phone').value.trim();
  const tg = $('#tg').value.trim().replace(/^@/, '');

  if (!name) return say('#imsg', 'আপনার নাম লিখুন।', false);
  if (phone && !/^01[3-9]\d{8}$/.test(phone)) return say('#imsg', 'সঠিক ১১ ডিজিটের নম্বর দিন।', false);
  if (tg && !/^[A-Za-z0-9_]{5,32}$/.test(tg)) return say('#imsg', 'Telegram ইউজারনেম ৫-৩২ অক্ষরের (ইংরেজি, সংখ্যা, _) হতে হবে।', false);

  const button = $('#info button[type="submit"]');
  button.disabled = true;
  button.textContent = 'সংরক্ষণ হচ্ছে…';

  try {
    const session = await window.hubUser;
    if (!session || !session.uid) throw new Error('Firebase session unavailable');

    const [{ db }, F] = await Promise.all([
      import('./firebase-config.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
    ]);

    // Updating these permitted profile fields triggers the homepage's live Firestore listener.
    await F.updateDoc(F.doc(db, 'users', session.uid), {
      name,
      phone,
      telegram: tg
    });

    Store.set(PKEY, { ...Store.get(PKEY, {}), name, phone, telegram: tg });
    load();
    say('#imsg', 'সংরক্ষণ হয়েছে। Homepage-এ নামও আপডেট হবে।', true);
  } catch (error) {
    console.error('Profile save failed:', error);
    say('#imsg', 'Firebase-এ সংরক্ষণ হয়নি। ইন্টারনেট বা Firestore permission পরীক্ষা করুন, তারপর আবার চেষ্টা করুন।', false);
  } finally {
    button.disabled = false;
    button.textContent = 'পরিবর্তন সংরক্ষণ করুন ↗';
  }
});

$('#pw').addEventListener('submit', (e) => {
  e.preventDefault();
  const users = Auth.users(), u = users[email];
  const cur = $('#cur').value, nw = $('#new').value, cf = $('#cf').value;
  if (!u || u.password !== cur) return say('#pmsg', 'বর্তমান পাসওয়ার্ড ঠিক নয়।', false);
  if (nw.length < 6) return say('#pmsg', 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।', false);
  if (nw !== cf) return say('#pmsg', 'দুটো নতুন পাসওয়ার্ড মেলেনি।', false);
  u.password = nw;
  Store.set('users', users);
  $('#pw').reset();
  say('#pmsg', 'পাসওয়ার্ড বদলানো হয়েছে।', true);
});

$('#copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(user.id);
    $('#copy').textContent = 'কপি হয়েছে';
  } catch {
    $('#copy').textContent = 'কপি করা গেল না';
  }
});

$('#logout').addEventListener('click', () => window.hubLogout());
document.documentElement.dataset.theme = Store.get('theme', 'light');
load();
