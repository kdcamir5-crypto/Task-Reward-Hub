// dashboard.js - Firestore user info + live balance updates.
(function () {
  const $ = (s) => document.querySelector(s);

  window.hubUser.then(async ({ uid, email, profile }) => {
    const p = profile || { refCode: 'TRH00000', balance: 0, tasks: 0, referrals: 0 };
    const local = Store.get('profile:' + email, {});
    const avatarEl = document.querySelector('.who__main .avatar');
    function applyAvatar(value) {
      if (!avatarEl) return;
      if (!value) return;
      avatarEl.replaceChildren();
      const img = document.createElement('img');
      img.src = value;
      img.alt = 'প্রোফাইল ছবি';
      img.width = 62;
      img.height = 62;
      img.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;border-radius:50%';
      avatarEl.appendChild(img);
    }
    applyAvatar(p.avatarImage || local.avatarImage || '');
    $('#name').textContent = (local.namePendingSync && local.name) || p.name || local.name || (email || 'বন্ধু').split('@')[0];
    $('#uid').textContent = 'আইডি: ' + (p.refCode || 'TRH00000');
    $('#balance').textContent = '৳ ' + Number(p.balance || 0).toFixed(2);
    $('#tasks').textContent = p.tasks || 0;
    $('#refs').textContent = p.referrals || 0;

    const makeReferralLink = (code) => 'https://t.me/Taskrewardhub_bot?start=' + encodeURIComponent(code || 'TRH00000');
    const link = makeReferralLink(p.refCode);
    $('#reflink').textContent = link;
    $('#copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(link); $('#copy').textContent = 'কপি হয়েছে'; }
      catch { $('#copy').textContent = 'কপি করা গেল না'; }
    });

    // Keep the dashboard balance in sync when the secure mining worker credits Firestore.
    try {
      const [{ db }, F] = await Promise.all([
        import('./firebase-config.js'),
        import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
      ]);
      F.onSnapshot(F.doc(db, 'users', uid), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() || {};
        $('#balance').textContent = '৳ ' + Number(data.balance || 0).toFixed(2);
        $('#tasks').textContent = data.tasks || 0;
        $('#refs').textContent = data.referrals || 0;
        const localProfile = Store.get('profile:' + email, {});
        if (localProfile.namePendingSync && localProfile.name) {
          $('#name').textContent = localProfile.name;
        } else if (data.name) {
          $('#name').textContent = data.name;
        }
        if (data.avatarImage) applyAvatar(data.avatarImage);
        if (data.refCode) {
          $('#uid').textContent = 'আইডি: ' + data.refCode;
          const updatedLink = makeReferralLink(data.refCode);
          $('#reflink').textContent = updatedLink;
        }
      }, (error) => {
        console.warn('Live dashboard update unavailable:', error && error.code ? error.code : 'unknown error');
      });
    } catch (error) {
      console.warn('Could not start live dashboard updates:', error && error.message ? error.message : 'unknown error');
    }
  }).catch((error) => {
    console.warn('Dashboard profile could not load:', error && error.message ? error.message : 'unknown error');
  });

  const sheet = $('#sheet');
  $('#bell').addEventListener('click', () => sheet.classList.add('open'));
  $('#close').addEventListener('click', () => sheet.classList.remove('open'));
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.classList.remove('open'); });

  $('#logout').addEventListener('click', () => window.hubLogout());
  document.documentElement.dataset.theme = Store.get('theme', 'light');
})();
