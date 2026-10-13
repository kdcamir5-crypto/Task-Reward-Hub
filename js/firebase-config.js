// firebase-config.js - Firebase চালু করে (প্রজেক্ট: reward-hub-bd)। এই কনফিগ ওয়েবসাইটে থাকাই নিয়ম, গোপন নয়।
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB7aAoaiSvYjfj9HWdY-TmJmfeDBF8stiY",
  authDomain: "reward-hub-bd.firebaseapp.com",
  projectId: "reward-hub-bd",
  storageBucket: "reward-hub-bd.firebasestorage.app",
  messagingSenderId: "673282864149",
  appId: "1:673282864149:web:83e6ddcd0f7a99f8e18a1c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
