
// guard.js - লগইন ছাড়া ভেতরের পেজে ঢুকতে দেয় না
(function () {
  if (!Store.get('session')) location.href = '../index.html';
})();
