// Shared profile picture picker for the dashboard and profile page.
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const modal = $('#avatar-picker-modal');
  if (!modal) return;
  const localEmail = Store.get('session');
  const localKey = 'profile:' + localEmail;
  const msg = $('#avatar-picker-message');
  const presetRoot = $('#avatar-picker-presets');
  let currentAvatar = '';

  function showMessage(text, ok = true) {
    msg.textContent = text;
    msg.dataset.state = ok ? 'ok' : 'error';
  }
  function makeAvatar(bg, skin, hair, shirt, female) {
    const hairBack = female
      ? '<path d="M24 47C18 20 31 8 50 8s32 13 26 39l-3 20H27z" fill="'+hair+'"/>'
      : '<path d="M27 35C27 17 38 10 51 10s24 7 24 25l-8-8-7-5-10 6-14 1z" fill="'+hair+'"/>';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+bg+'"/><stop offset="1" stop-color="#0b1838"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#b)"/><circle cx="18" cy="22" r="2" fill="#fff" opacity=".6"/><circle cx="82" cy="32" r="1.7" fill="#fff" opacity=".5"/><path d="M14 100c2-23 15-32 36-32s34 9 36 32" fill="'+shirt+'"/><path d="M42 61h16v15H42z" fill="'+skin+'"/>'+hairBack+'<ellipse cx="50" cy="43" rx="21" ry="25" fill="'+skin+'"/>'+(female?'<path d="M29 42c-4-23 9-34 24-33 15 1 23 12 19 30l-6-17-12-5-11 9-12 1z" fill="'+hair+'"/><path d="M29 39c-5 12-2 29 5 35l-1-23zM71 39c5 12 2 29-5 35l1-23z" fill="'+hair+'"/>':'<path d="M30 34c4-15 14-22 25-20 7 1 12 5 15 12l-11-3-10 4-9 7z" fill="'+hair+'"/>')+'<ellipse cx="42" cy="44" rx="2" ry="2.6" fill="#17243a"/><ellipse cx="58" cy="44" rx="2" ry="2.6" fill="#17243a"/><path d="M44 55q6 5 12 0" fill="none" stroke="#8e4d48" stroke-width="2" stroke-linecap="round"/><path d="M36 38q6-4 11 0M54 38q6-4 11 0" fill="none" stroke="'+hair+'" stroke-width="2.5" stroke-linecap="round"/><path d="M38 79l12 8 12-8" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/><circle cx="50" cy="50" r="47" fill="none" stroke="#fff" stroke-opacity=".13" stroke-width="2"/></svg>';
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }
  const avatars = [
    {label:'Male • Blue', value:makeAvatar('#1c75bc','#e8b68d','#2a2030','#1570b8',false)},
    {label:'Male • Teal', value:makeAvatar('#0b8f91','#c88962','#30201a','#12a4a0',false)},
    {label:'Male • Violet', value:makeAvatar('#6552bd','#f0c7a2','#3c2b25','#755be0',false)},
    {label:'Female • Rose', value:makeAvatar('#d9578b','#f0c5a4','#3a1e2b','#e45b91',true)},
    {label:'Female • Purple', value:makeAvatar('#7653c9','#d99a75','#211a2e','#8a65e8',true)},
    {label:'Female • Teal', value:makeAvatar('#0a9297','#f4d0b3','#432b25','#0da8ad',true)}
  ];
  function applyAvatar(value) {
    currentAvatar = value || '';
    document.querySelectorAll('.avatar-trigger').forEach((el) => {
      el.replaceChildren();
      if (currentAvatar) {
        const img = document.createElement('img');
        img.src = currentAvatar; img.alt = 'প্রোফাইল ছবি';
        el.appendChild(img);
      } else {
        el.textContent = '👤';
      }
    });
    presetRoot.querySelectorAll('.avatar-choice').forEach((b) =>
      b.setAttribute('aria-pressed', b.dataset.avatarValue === currentAvatar ? 'true' : 'false'));
  }
  function openPicker() {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('avatar-picker-open');
  }
  function closePicker() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('avatar-picker-open');
  }
  document.querySelectorAll('.avatar-trigger').forEach((el) => {
    el.addEventListener('click', openPicker);
    el.setAttribute('aria-haspopup','dialog');
  });
  $('#avatar-picker-close').addEventListener('click', closePicker);
  modal.addEventListener('click', (e) => { if (e.target === modal) closePicker(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePicker(); });

  avatars.forEach((avatar) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'avatar-choice'; b.dataset.avatarValue = avatar.value;
    b.setAttribute('aria-label', avatar.label + ' অ্যাভাটার ব্যবহার করুন');
    const img = document.createElement('img'); img.src = avatar.value; img.alt = '';
    const label = document.createElement('span'); label.textContent = avatar.label;
    b.append(img,label); b.addEventListener('click', () => saveAvatar(avatar.value));
    presetRoot.appendChild(b);
  });
  async function saveAvatar(value) {
    const profile = Store.get(localKey, {});
    profile.avatarImage = value; Store.set(localKey, profile);
    applyAvatar(value);
    showMessage('ছবি সংরক্ষণ করা হচ্ছে…');
    try {
      const session = await window.hubUser;
      if (!session || !session.uid) throw new Error('Firebase session unavailable');
      const [{db}, F] = await Promise.all([
        import('./firebase-config.js'),
        import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
      ]);
      await F.updateDoc(F.doc(db,'users',session.uid),{avatarImage:value});
      showMessage('প্রোফাইল ছবি সংরক্ষণ হয়েছে।');
      setTimeoutSafeClose();
    } catch (error) {
      console.warn('Avatar cloud sync unavailable:', error && (error.code || error.message));
      showMessage('ডিভাইসে ছবি রাখা হয়েছে; Firebase সিঙ্ক সম্পন্ন হয়নি।', false);
    }
  }
  function setTimeoutSafeClose() { closePicker(); }
  $('#avatar-picker-upload').addEventListener('click', () => $('#avatar-picker-file').click());
  $('#avatar-picker-file').addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showMessage('শুধু ছবি ফাইল নির্বাচন করুন।',false); event.target.value=''; return; }
    if (file.size > 8*1024*1024) { showMessage('ছবিটি ৮ MB-এর কম হতে হবে।',false); event.target.value=''; return; }
    const reader = new FileReader();
    reader.onerror = () => showMessage('ছবিটি পড়া যায়নি।',false);
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => showMessage('ছবিটি খোলা যায়নি।',false);
      image.onload = () => {
        const canvas = document.createElement('canvas'); canvas.width=256; canvas.height=256;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(256/image.width,256/image.height);
        ctx.drawImage(image,(256-image.width*scale)/2,(256-image.height*scale)/2,image.width*scale,image.height*scale);
        saveAvatar(canvas.toDataURL('image/jpeg',0.78));
        event.target.value='';
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
  window.hubUser.then(async ({uid,email,profile}) => {
    const local = Store.get('profile:' + email, {});
    applyAvatar((profile && profile.avatarImage) || local.avatarImage || '');
    try {
      const [{db}, F] = await Promise.all([
        import('./firebase-config.js'),
        import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
      ]);
      F.onSnapshot(F.doc(db,'users',uid),(snap) => {
        if (!snap.exists()) return;
        const data = snap.data() || {};
        if (data.avatarImage && data.avatarImage !== currentAvatar) applyAvatar(data.avatarImage);
      });
    } catch (error) { console.warn('Profile avatar listener unavailable:',error); }
  }).catch(() => applyAvatar((Store.get(localKey,{}) || {}).avatarImage || ''));
})();
