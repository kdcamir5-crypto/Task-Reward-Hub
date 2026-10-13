// dashboard.js - ড্যাশবোর্ডে Firestore থেকে ইউজারের তথ্য বসায়, নোটিফিকেশন শিট খোলে
(function () {
  const $ = (s) => document.querySelector(s);

  window.hubUser.then(({ email, profile }) => {
    const p = profile || { refCode: 'TRH00000', balance: 0, tasks: 0, referrals: 0 };
    const local = Store.get('profile:' + email, {});
    $('#name').textContent = p.name || local.name || email.split('@')[0];
    $('#uid').textContent = 'আইডি: ' + p.refCode;
    $('#balance').textContent = '৳ ' + Number(p.balance || 0).toFixed(2);
    $('#tasks').textContent = p.tasks || 0;
    $('#refs').textContent = p.referrals || 0;

    const link = location.origin + location.pathname.replace('pages/dashboard.html', '') + 'index.html?ref=' + p.refCode;
    $('#reflink').textContent = link;
    $('#copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(link); $('#copy').textContent = 'কপি হয়েছে'; }
      catch { $('#copy').textContent = 'কপি করা গেল না'; }
    });
  });

  const sheet = $('#sheet');
  $('#bell').addEventListener('click', () => sheet.classList.add('open'));
  $('#close').addEventListener('click', () => sheet.classList.remove('open'));
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.classList.remove('open'); });

  $('#logout').addEventListener('click', () => window.hubLogout());
  document.documentElement.dataset.theme = Store.get('theme', 'light');
})();
