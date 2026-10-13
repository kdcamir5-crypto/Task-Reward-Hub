// Mystery Box: browser-local virtual XP only. It never changes wallet/cash balance.
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const session = Store.get('session');
  if (!session) return;

  const KEY = 'mystery-box:' + session;
  const dateKey = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  };
  const initial = () => ({ xp: 0, boxes: 0, best: 0, lastDate: '', history: [] });
  let data = Store.get(KEY, initial());
  if (!data || typeof data !== 'object') data = initial();
  data.xp = Number(data.xp || 0);
  data.boxes = Number(data.boxes || 0);
  data.best = Number(data.best || 0);
  data.history = Array.isArray(data.history) ? data.history : [];
  let busy = false;

  const box = $('#mystery-box');
  const button = $('#open-box-button');
  const result = $('#mystery-result');
  const subresult = $('#mystery-subresult');
  const status = $('#mystery-status');

  function render() {
    $('#mystery-total-xp').textContent = String(data.xp);
    $('#mystery-total-boxes').textContent = String(data.boxes);
    $('#mystery-best-prize').textContent = String(data.best) + ' XP';
    const list = $('#mystery-history-list');
    list.textContent = '';
    if (!data.history.length) {
      const li = document.createElement('li');
      li.className = 'mystery-history-empty';
      li.textContent = 'এখনো কোনো বক্স খোলা হয়নি।';
      list.appendChild(li);
    } else {
      data.history.slice(0, 10).forEach(item => {
        const li = document.createElement('li');
        const left = document.createElement('span');
        const title = document.createElement('strong');
        const date = document.createElement('small');
        title.textContent = 'মিস্ট্রি বক্স';
        date.textContent = item.date;
        left.append(title, date);
        const reward = document.createElement('strong');
        reward.textContent = '+' + item.xp + ' XP';
        li.append(left, reward);
        list.appendChild(li);
      });
    }
    const used = data.lastDate === dateKey();
    button.disabled = used || busy;
    button.textContent = used ? '✓ আজকের বক্স খোলা হয়েছে' : '🎁 বক্স খুলুন';
    if (used && !busy) {
      result.textContent = 'আজকের সারপ্রাইজ পাওয়া হয়েছে!';
      subresult.textContent = 'আগামীকাল নতুন বক্স খুলতে পারবেন।';
      status.textContent = 'প্রতিদিন একটি বক্স খোলা যায়।';
      box.classList.add('is-open');
    }
    Store.set(KEY, data);
  }

  button.addEventListener('click', () => {
    if (busy || data.lastDate === dateKey()) return;
    busy = true;
    button.disabled = true;
    status.textContent = 'বক্সটি খুলছে...';
    result.textContent = 'সারপ্রাইজ আসছে';
    subresult.textContent = 'একটু অপেক্ষা করুন!';
    box.classList.remove('is-open');
    box.classList.add('is-opening');

    // Reward values are virtual XP only, selected at random on this device.
    const rewards = [5, 10, 15, 20, 25, 30, 50, 75, 100];
    const reward = rewards[Math.floor(Math.random() * rewards.length)];
    window.setTimeout(() => {
      box.classList.remove('is-opening');
      box.classList.add('is-open');
      data.xp += reward;
      data.boxes += 1;
      data.best = Math.max(data.best, reward);
      data.lastDate = dateKey();
      data.history.unshift({ xp: reward, date: new Date().toLocaleDateString('bn-BD') });
      data.history = data.history.slice(0, 30);
      Store.set(KEY, data);
      result.textContent = 'অভিনন্দন! +' + reward + ' XP 🎉';
      subresult.textContent = 'আপনার ভার্চুয়াল XP যোগ হয়েছে।';
      status.textContent = 'মনে রাখুন: XP শুধু গেমের অগ্রগতি, নগদ ব্যালেন্স নয়।';
      busy = false;
      render();
    }, 1500);
  });

  document.documentElement.dataset.theme = Store.get('theme', 'light');
  render();
})();