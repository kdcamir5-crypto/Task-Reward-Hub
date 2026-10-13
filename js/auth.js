// auth.js - সাইন-ইন ও অ্যাকাউন্ট তৈরির লজিক (শুধু ডেমো; পাসওয়ার্ড এখানে হ্যাশ হয় না)
const Auth = {
  users() { return Store.get('users', {}); },
  register(email, password, ref) {
    const users = this.users();
    if (users[email]) return 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট আছে।';
    users[email] = { password, ref: ref || null, id: 'TRH' + Math.floor(10000 + Math.random() * 90000) };
    Store.set('users', users);
    Store.set('session', email);
    return null;
  },
  login(email, password) {
    const u = this.users()[email];
    if (!u || u.password !== password) return 'ইমেইল বা পাসওয়ার্ড ঠিক নয়।';
    Store.set('session', email);
    return null;
  }
};
