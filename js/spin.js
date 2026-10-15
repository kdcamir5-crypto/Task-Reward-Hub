// Lucky Spin: local XP game only. XP is not cash and never changes wallet balance.
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const email = Store.get('session');
  if (!email) {
    // Recover the legacy local session from the authenticated Firebase session.
    // Previously this silent return left the Spin button without any click handler.
    if (window.hubUser && typeof window.hubUser.then === 'function') {
      window.hubUser.then(user => {
        if (user && user.email) {
          Store.set('session', user.email);
          window.location.reload();
        }
      }).catch(() => {});
    }
    return;
  }
  const KEY = 'lucky-spin:' + email;
  const today = () => new Date().toLocaleDateString('en-CA');
  const prizes = [
    { label: '10 XP', xp: 10, type: 'xp' },
    { label: '20 XP', xp: 20, type: 'xp' },
    { label: '50 XP', xp: 50, type: 'xp' },
    { label: 'আবার চেষ্টা', xp: 0, type: 'none' },
    { label: 'বিশেষ ব্যাজ', xp: 0, type: 'badge' },
    { label: '100 XP', xp: 100, type: 'xp' },
    { label: '5 XP', xp: 5, type: 'xp' },
    { label: 'জ্যাকপট 200 XP', xp: 200, type: 'xp' }
  ];
  const read = () => Store.get(KEY, { xp: 0, spins: 0, badges: 0, lastDate: '', history: [] });
  let data = read();
  let busy = false;
  const wheel = $('#wheel');
  const button = $('#spin-button');

  function render() {
    $('#total-xp').textContent = String(data.xp || 0);
    $('#total-spins').textContent = String(data.spins || 0);
    $('#badge-count').textContent = String(data.badges || 0);
    const list = $('#spin-history-list');
    list.textContent = '';
    if (!data.history || !data.history.length) {
      const li = document.createElement('li');
      li.className = 'history-empty';
      li.textContent = 'এখনো কোনো স্পিন করা হয়নি।';
      list.appendChild(li);
    } else {
      data.history.slice(0, 8).forEach(item => {
        const li = document.createElement('li');
        const left = document.createElement('span');
        const right = document.createElement('strong');
        const date = document.createElement('small');
        left.textContent = item.label;
        date.textContent = ' • ' + item.date;
        right.textContent = item.xp ? '+' + item.xp + ' XP' : (item.type === 'badge' ? 'ব্যাজ' : '—');
        left.appendChild(date);
        li.append(left, right);
        list.appendChild(li);
      });
    }
    const used = data.lastDate === today();
    button.disabled = used || busy;
    button.textContent = used ? '✓ আজকের স্পিন সম্পন্ন' : '🎡 স্পিন করুন';
    if (used && !busy) $('#spin-status').textContent = 'আজকের স্পিন ব্যবহার করা হয়েছে। আগামীকাল আবার আসুন।';
  }

  button.addEventListener('click', () => {
    if (busy || data.lastDate === today()) return;
    busy = true;
    button.disabled = true;
    $('#spin-status').textContent = 'চাকা ঘুরছে...';
    $('#spin-result').textContent = 'আপনার পুরস্কার আসছে';
    $('#spin-subresult').textContent = 'একটু অপেক্ষা করুন!';
    const index = Math.floor(Math.random() * prizes.length);
    const prize = prizes[index];
    const segmentCenter = index * 45 + 22.5;
    const targetRotation = 360 * 6 + (360 - segmentCenter);
    wheel.style.transform = 'rotate(' + targetRotation + 'deg)';
    window.setTimeout(() => {
      data.xp = Number(data.xp || 0) + prize.xp;
      data.spins = Number(data.spins || 0) + 1;
      if (prize.type === 'badge') data.badges = Number(data.badges || 0) + 1;
      data.lastDate = today();
      data.history = [{ label: prize.label, xp: prize.xp, type: prize.type, date: new Date().toLocaleDateString('bn-BD') }, ...(data.history || [])].slice(0, 30);
      Store.set(KEY, data);
      $('#spin-result').textContent = prize.label === 'আবার চেষ্টা' ? 'আজ আরেকবার নয়!' : 'অভিনন্দন! ' + prize.label;
      $('#spin-subresult').textContent = prize.type === 'badge' ? 'আপনি একটি ভার্চুয়াল ব্যাজ পেয়েছেন।' : (prize.xp ? 'আপনার গেম XP যোগ হয়েছে।' : 'আগামীকাল আবার চেষ্টা করুন।');
      $('#spin-status').textContent = 'মনে রাখুন: XP শুধু গেমের অগ্রগতি, নগদ ব্যালেন্স নয়।';
      busy = false;
      render();
    }, 4300);
  });

  document.documentElement.dataset.theme = Store.get('theme', 'light');
  render();
})();