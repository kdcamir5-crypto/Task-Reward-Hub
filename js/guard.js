// guard.js - Firebase দিয়ে যাচাই করে: লগইন না থাকলে লগইন পেজে পাঠায়।
// পেজগুলোতে আগের মতো সাধারণ <script> হিসেবেই থাকবে, কোনো পেজ বদলাতে হবে না।
(function () {
  var base = document.currentScript.src;
  var url = function (f) { return new URL(f, base).href; };
  document.documentElement.style.visibility = 'hidden'; // যাচাই শেষ না হওয়া পর্যন্ত পেজ লুকানো

  window.hubUser = new Promise(function (resolve) {
    Promise.all([
      import(url('firebase-config.js')),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
    ]).then(function (m) {
      var cfg = m[0], A = m[1], F = m[2];
      A.onAuthStateChanged(cfg.auth, function (u) {
        if (!u) { localStorage.removeItem('session'); location.href = '../index.html'; return; }
        F.getDoc(F.doc(cfg.db, 'users', u.uid)).then(function (snap) {
          document.documentElement.style.visibility = '';
          resolve({ uid: u.uid, email: u.email, profile: snap.exists() ? snap.data() : null });
        }).catch(function (e) {
          document.documentElement.style.visibility = '';
          resolve({ uid: u.uid, email: u.email, profile: null, error: e && (e.code || e.message) });
        });
      });
    }).catch(function () { location.href = '../index.html'; });
  });

  window.hubLogout = function () {
    import(url('fb-auth.js')).then(function (m) { return m.logout(); })
      .finally(function () { location.href = '../index.html'; });
  };
})();
