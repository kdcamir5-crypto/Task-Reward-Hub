// profile.js - প্রোফাইল তথ্য সংরক্ষণ, পাসওয়ার্ড বদল, রেফারেল কোড, সাইন আউট
const $ = (s) => document.querySelector(s);
const email = Store.get('session');
const PKEY = 'profile:' + email;
const user = Auth.users()[email] || { id: 'TRH00000' };

function say(id, msg, ok) { const el = $(id); el.textContent = msg; el.className = 'msg2 ' + (ok ? 'ok' : 'err'); }

function renderAvatar(value, fallbackName) {
  const el = $('#avatar');
  el.replaceChildren();
  if (value) {
    const img = document.createElement('img');
    img.src = value;
    img.alt = 'প্রোফাইল ছবি';
    el.appendChild(img);
  } else {
    el.textContent = (fallbackName || '?').charAt(0).toUpperCase();
  }
  document.querySelectorAll('.avatar-choice').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.avatarValue === value ? 'true' : 'false');
  });
}

function load() {
  const p = Store.get(PKEY, {});
  const name = p.name || email.split('@')[0];
  $('#hname').textContent = name;
  $('#hmail').textContent = email;
  renderAvatar(p.avatarImage || '', name);
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
  Store.set(PKEY, { ...Store.get(PKEY, {}), name: $('#name').value.trim(), phone, telegram: tg });
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


/* Built-in male/female illustrated avatars */
function makeAvatar(bg, skin, hair, shirt, female) {
  const hairBack = female
    ? '<path d="M24 47C18 20 31 8 50 8s32 13 26 39l-3 20H27z" fill="'+hair+'"/>'
    : '<path d="M27 35C27 17 38 10 51 10s24 7 24 25l-8-8-7-5-10 6-14 1z" fill="'+hair+'"/>';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+bg+'"/><stop offset="1" stop-color="#0b1838"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#b)"/><circle cx="18" cy="22" r="2" fill="#fff" opacity=".6"/><circle cx="82" cy="32" r="1.7" fill="#fff" opacity=".5"/><path d="M14 100c2-23 15-32 36-32s34 9 36 32" fill="'+shirt+'"/><path d="M42 61h16v15H42z" fill="'+skin+'"/>'+hairBack+'<ellipse cx="50" cy="43" rx="21" ry="25" fill="'+skin+'"/>'+ (female ? '<path d="M29 42c-4-23 9-34 24-33 15 1 23 12 19 30l-6-17-12-5-11 9-12 1z" fill="'+hair+'"/><path d="M29 39c-5 12-2 29 5 35l-1-23zM71 39c5 12 2 29-5 35l1-23z" fill="'+hair+'"/>' : '<path d="M30 34c4-15 14-22 25-20 7 1 12 5 15 12l-11-3-10 4-9 7z" fill="'+hair+'"/>')+'<ellipse cx="42" cy="44" rx="2" ry="2.6" fill="#17243a"/><ellipse cx="58" cy="44" rx="2" ry="2.6" fill="#17243a"/><path d="M44 55q6 5 12 0" fill="none" stroke="#8e4d48" stroke-width="2" stroke-linecap="round"/><path d="M36 38q6-4 11 0M54 38q6-4 11 0" fill="none" stroke="'+hair+'" stroke-width="2.5" stroke-linecap="round"/><path d="M38 79l12 8 12-8" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/><circle cx="50" cy="50" r="47" fill="none" stroke="#fff" stroke-opacity=".13" stroke-width="2"/></svg>';
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}
const READY_AVATARS = [
  {label:'Male • Blue', gender:'Male', value:makeAvatar('#1c75bc','#e8b68d','#2a2030','#1570b8',false)},
  {label:'Male • Teal', gender:'Male', value:makeAvatar('#0b8f91','#c88962','#30201a','#12a4a0',false)},
  {label:'Male • Violet', gender:'Male', value:makeAvatar('#6552bd','#f0c7a2','#3c2b25','#755be0',false)},
  {label:'Female • Rose', gender:'Female', value:makeAvatar('#d9578b','#f0c5a4','#3a1e2b','#e45b91',true)},
  {label:'Female • Purple', gender:'Female', value:makeAvatar('#7653c9','#d99a75','#211a2e','#8a65e8',true)},
  {label:'Female • Teal', gender:'Female', value:makeAvatar('#0a9297','#f4d0b3','#432b25','#0da8ad',true)}
];
const presetContainer = $('#avatar-presets');
READY_AVATARS.forEach((avatar, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'avatar-choice';
  button.dataset.avatarValue = avatar.value;
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', avatar.label + ' অ্যাভাটার ব্যবহার করুন');
  const img = document.createElement('img');
  img.src = avatar.value;
  img.alt = '';
  img.loading = 'lazy';
  const label = document.createElement('span');
  label.textContent = avatar.label;
  button.append(img, label);
  button.addEventListener('click', () => saveAvatar(avatar.value));
  presetContainer.appendChild(button);
});

async function saveAvatar(value) {
  const p = Store.get(PKEY, {});
  p.avatarImage = value;
  Store.set(PKEY, p);
  renderAvatar(value, p.name || email.split('@')[0]);
  say('#avatar-msg', 'ছবিটি এই ডিভাইসে সংরক্ষিত হচ্ছে…', true);
  try {
    if (!window.hubUser) throw new Error('Firebase session unavailable');
    const session = await window.hubUser;
    const [{ db }, F] = await Promise.all([
      import('./firebase-config.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
    ]);
    await F.updateDoc(F.doc(db, 'users', session.uid), { avatarImage: value });
    say('#avatar-msg', 'প্রোফাইল ছবি সংরক্ষণ হয়েছে এবং অ্যাকাউন্টে সিঙ্ক হয়েছে।', true);
  } catch (error) {
    console.warn('Avatar cloud sync unavailable:', error && (error.code || error.message));
    say('#avatar-msg', 'ছবিটি এই ডিভাইসে সংরক্ষিত হয়েছে। ক্লাউডে সিঙ্ক করতে Firebase অনুমতি লাগতে পারে।', false);
  }
}

$('#avatar-upload-btn').addEventListener('click', () => $('#avatar-upload').click());
$('#avatar-upload').addEventListener('change', (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    say('#avatar-msg', 'শুধু ছবি ফাইল নির্বাচন করুন।', false);
    event.target.value = '';
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    say('#avatar-msg', 'ছবিটি ৮ MB-এর কম হতে হবে।', false);
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => say('#avatar-msg', 'ছবিটি পড়া যায়নি। অন্য ছবি চেষ্টা করুন।', false);
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => say('#avatar-msg', 'ছবিটি খোলা যায়নি। অন্য ছবি চেষ্টা করুন।', false);
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 256;
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(size / image.width, size / image.height);
      const width = image.width * scale, height = image.height * scale;
      ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      saveAvatar(canvas.toDataURL('image/jpeg', 0.78));
      event.target.value = '';
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
});

$('#logout').addEventListener('click', () => window.hubLogout());
document.documentElement.dataset.theme = Store.get('theme', 'light');
load();
