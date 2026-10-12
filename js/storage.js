// storage.js - এখনকার জন্য ব্রাউজারের localStorage। পরে Firebase দিয়ে বদলানো হবে।
const Store = {
  get(k, d = null) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
