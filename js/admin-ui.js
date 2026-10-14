// admin-ui.js - tabs and pending counters for the admin panel (display only; admin.js is untouched)
(function () {
  'use strict';
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-tab]'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('[data-panel]'));
  if (!tabs.length) return;

  function show(name, focus) {
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-tab') === name;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    panels.forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== name; });
    try { sessionStorage.setItem('adminTab', name); } catch (e) { /* storage may be blocked */ }
  }

  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { show(t.getAttribute('data-tab'), false); });
    t.addEventListener('keydown', function (e) {
      var step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      show(tabs[(i + step + tabs.length) % tabs.length].getAttribute('data-tab'), true);
    });
  });

  var saved = null;
  try { saved = sessionStorage.getItem('adminTab'); } catch (e) { /* ignore */ }
  var valid = tabs.some(function (t) { return t.getAttribute('data-tab') === saved; });
  show(valid ? saved : tabs[0].getAttribute('data-tab'), false);

  // Pending counters: count the request rows that admin.js renders into each queue.
  var queues = ['wallet-deposits', 'bot-purchase-requests', 'withdrawals', 'subs'];
  function update() {
    var total = 0;
    queues.forEach(function (id) {
      var host = document.getElementById(id);
      if (!host) return;
      var n = host.querySelectorAll(':scope > .row').length;
      total += n;
      var pill = document.querySelector('[data-count="' + id + '"]');
      if (pill) { pill.textContent = n; pill.classList.toggle('on', n > 0); }
    });
    var badge = document.getElementById('b-total');
    if (badge) { badge.textContent = total; badge.hidden = total === 0; }
  }
  if (window.MutationObserver) {
    queues.forEach(function (id) {
      var host = document.getElementById(id);
      if (host) new MutationObserver(update).observe(host, { childList: true });
    });
  }
  update();
})();
