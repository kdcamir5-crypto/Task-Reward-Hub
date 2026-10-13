// dashboard.js - ড্যাশবোর্ডে ইউজারের তথ্য বসায়, নোটিফিকেশন শিট খোলে
const $ = (s) => document.querySelector(s);
const email = Store.get('session');
const user = Auth.users()[email] || { id: 'TRH00000' };
const wallet = Store.get('wallet:' + email, { balance: 0, tasks: 0, referrals: 0 });

const prof = Store.get('profile:' + email, {});
$('#name').textContent = prof.name || email.split('@')[0];
$('#uid').textContent = 'আইডি: ' + user.id;
$('#balance').textContent = '৳ ' + wallet.balance.toFixed(2);
$('#tasks').textContent = wallet.tasks;
$('#refs').textContent = wallet.referrals;

const link = location.origin + location.pathname.replace('pages/dashboard.html', '') + 'index.html?ref=' + user.id;
$('#reflink').textContent = link;
$('#copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(link); $('#copy').textContent = 'কপি হয়েছে'; }
  catch { $('#copy').textContent = 'কপি করা গেল না'; }
});

const sheet = $('#sheet');
$('#bell').addEventListener('click', () => sheet.classList.add('open'));
$('#close').addEventListener('click', () => sheet.classList.remove('open'));
sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.classList.remove('open'); });

$('#logout').addEventListener('click', () => { localStorage.removeItem('session'); location.href = '../index.html'; });
document.documentElement.dataset.theme = Store.get('theme', 'light');
