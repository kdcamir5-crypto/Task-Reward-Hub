// Daily Streak: browser-local virtual XP only. Does not touch wallet or cash balance.
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const session = Store.get('session');
  if (!session) {
    // Recover the legacy local session from the authenticated Firebase session.
    // Previously this silent return left the feature button without any click handler.
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
  const KEY = 'daily-streak:' + session;
  const rewards = [10, 15, 20, 25, 30, 40, 75];
  const dateKey = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  };
  const shiftDate = (key, amount) => {
    const parts = key.split('-').map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    date.setDate(date.getDate() + amount);
    return dateKey(date);
  };
  const initial = () => ({ current: 0, best: 0, total: 0, xp: 0, lastDate: '', history: [] });
  let data = Store.get(KEY, initial());
  if (!data || typeof data !== 'object') data = initial();
  data.history = Array.isArray(data.history) ? data.history : [];
  const today = dateKey();
  const last = data.lastDate;
  let already = last === today;
  let streak = Number(data.current || 0);
  if (last && last !== today && last !== shiftDate(today, -1)) streak = 0;
  data.current = streak;

  function render() {
    $('#current-streak').textContent = String(data.current || 0);
    $('#best-streak').textContent = String(data.best || 0) + ' দিন';
    $('#total-checkins').textContent = String(data.total || 0);
    $('#streak-xp').textContent = String(data.xp || 0);
    $('#week-progress').textContent = Math.min(Number(data.current || 0), 7) + '/7';
    document.querySelectorAll('.streak-day').forEach((el, index) => {
      el.classList.toggle('is-done', Number(data.current || 0) > index);
      el.classList.toggle('is-current', !already && Number(data.current || 0) === index);
      const label = el.querySelector('b');
      if (label) label.textContent = Number(data.current || 0) > index ? '✓ সম্পন্ন' : '+' + rewards[index] + ' XP';
    });
    const button = $('#checkin-button');
    button.disabled = already;
    button.textContent = already ? '✓ আজকের চেক-ইন সম্পন্ন' : '🔥 আজকের চেক-ইন';
    if (already) $('#streak-status').textContent = 'আজকের চেক-ইন হয়ে গেছে। আগামীকাল আবার আসুন!';
    const list = $('#streak-history-list');
    list.textContent = '';
    if (!data.history.length) {
      const li = document.createElement('li');
      li.className = 'streak-history-empty';
      li.textContent = 'এখনো কোনো চেক-ইন করা হয়নি।';
      list.appendChild(li);
    } else {
      data.history.slice(0, 10).forEach(item => {
        const li = document.createElement('li');
        const left = document.createElement('span');
        const title = document.createElement('strong');
        const date = document.createElement('small');
        title.textContent = item.day + ' দিনের স্ট্রিক';
        date.textContent = item.date;
        left.append(title, date);
        const reward = document.createElement('strong');
        reward.textContent = '+' + item.xp + ' XP';
        li.append(left, reward);
        list.appendChild(li);
      });
    }
    Store.set(KEY, data);
  }
  $('#checkin-button').addEventListener('click', () => {
    if (data.lastDate === today) return;
    const consecutive = data.lastDate === shiftDate(today, -1);
    data.current = consecutive ? Number(data.current || 0) + 1 : 1;
    const rewardIndex = Math.min(data.current, 7) - 1;
    const reward = rewards[rewardIndex];
    data.best = Math.max(Number(data.best || 0), data.current);
    data.total = Number(data.total || 0) + 1;
    data.xp = Number(data.xp || 0) + reward;
    data.lastDate = today;
    already = true;
    data.history.unshift({ day: data.current, xp: reward, date: new Date().toLocaleDateString('bn-BD') });
    data.history = data.history.slice(0, 30);
    Store.set(KEY, data);
    $('#streak-status').textContent = 'অভিনন্দন! আপনার অ্যাকাউন্টে +' + reward + ' ভার্চুয়াল XP যোগ হয়েছে।';
    render();
  });
  document.documentElement.dataset.theme = Store.get('theme', 'light');
  render();
})();