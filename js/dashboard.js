(() => {
  "use strict";

  const config = window.TASK_REWARD_HUB_FIREBASE_CONFIG;
  const toast = document.getElementById("toast");
  let auth = null;
  let db = null;
  let toastHandle = null;
  let profileUnsubscribe = null;
  let miningUnsubscribe = null;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    if (toastHandle) clearTimeout(toastHandle);
    toastHandle = setTimeout(() => toast.classList.remove("is-visible"), 3200);
  }

  function safeNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
    return null;
  }

  function formatMoney(value) {
    const number = safeNumber(value);
    if (number === null) return "—";
    return number.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function countTasks(value) {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") {
      if (typeof value.completed === "number") return value.completed;
      if (typeof value.completedCount === "number") return value.completedCount;
      return Object.values(value).filter(item => item === true || (item && typeof item === "object" && (item.completed === true || item.status === "completed"))).length;
    }
    return safeNumber(value);
  }

  function countReferrals(value) {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") {
      if (typeof value.verified === "number") return value.verified;
      if (typeof value.count === "number") return value.count;
      return Object.keys(value).length;
    }
    return safeNumber(value);
  }

  function countBots(value) {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") {
      if (typeof value.count === "number") return value.count;
      return Object.values(value).filter(item => item === true || (item && typeof item === "object" && (item.unlocked === true || item.status === "unlocked" || item.status === "running"))).length;
    }
    return safeNumber(value);
  }

  let currentUnlockedBotCount = null;
  let currentMiningRecords = [];

  function botStatus(record) {
    const status = String((record && record.status) || "").toLowerCase();
    if (["running", "active", "mining", "started"].includes(status)) return "running";
    if (["completed", "complete", "finished", "stopped", "expired"].includes(status)) return "completed";
    if (["pending", "queued", "paused"].includes(status)) return "pending";
    return status || "unknown";
  }

  function readableBotName(record, index) {
    const raw = record && (record.botName || record.name || record.botId || record.packageId || record.bot);
    if (typeof raw === "string" && raw.trim()) {
      const value = raw.trim().replace(/[-_]+/g, " ");
      return value.replace(/\\b\\w/g, letter => letter.toUpperCase());
    }
    return "Mining Bot " + (index + 1);
  }

  function renderBotFleet() {
    const records = currentMiningRecords;
    const running = records.filter(record => botStatus(record) === "running");
    const totalKnown = currentUnlockedBotCount;
    const activeCount = running.length;
    const displayCount = totalKnown === null ? records.length : Math.max(totalKnown, records.length);
    const hasActive = activeCount > 0;
    const statusText = hasActive ? activeCount + (activeCount === 1 ? " Bot • Online" : " Bots • Online") : (displayCount > 0 ? displayCount + (displayCount === 1 ? " Bot • Not running" : " Bots • Not running") : "0 Bots • Offline");
    setText("fleet-header-status", (hasActive ? "🟢 " : "🔒 ") + statusText);
    setText("fleet-live-status", statusText);
    setText("fleet-active-count", String(activeCount));
    setText("fleet-hashrate", "— MH/s");
    const earnedText = document.getElementById("bot-mining-value");
    const earnedValue = earnedText ? safeNumber(earnedText.textContent.replace(/,/g, "")) : null;
    setText("fleet-earned", "৳ " + formatMoney(earnedValue === null ? 0 : earnedValue));
    setText("bots-detail-count", totalKnown === null ? String(records.length) : String(totalKnown));
    setText("bot-description", totalKnown === null ? "Your bot count is being read from Firebase." : "You have " + totalKnown + " unlocked " + (totalKnown === 1 ? "bot" : "bots") + " in your account.");
    const list = document.getElementById("fleet-deployed-list");
    if (!list) return;
    if (!records.length) {
      list.innerHTML = '<div class="fleet-empty-card"><div class="fleet-robot-illustration" aria-hidden="true"><span>🤖</span><i></i></div><strong>' + (displayCount > 0 ? displayCount + ' unlocked bot' + (displayCount === 1 ? '' : 's') + ' found' : '0 Bots • Offline') + '</strong><p>' + (displayCount > 0 ? 'আপনার বট অ্যাকাউন্টে আনলক করা আছে, তবে live mining record এখনো পাওয়া যায়নি।' : 'মাইনিং শুরু করতে বট শপ থেকে বট আনলক করুন অথবা verified member রেফার করুন।') + '</p><div class="fleet-empty-actions"><button class="fleet-outline-button" id="fleet-empty-shop" type="button">🤖 বট শপ-এ যান</button><button class="fleet-referral-button" id="fleet-referral-button" type="button">👤+ মেম্বার রেফার করুন</button></div></div>';
      bindFleetButtons();
      return;
    }
    list.innerHTML = records.map((record, index) => {
      const status = botStatus(record);
      const earned = safeNumber(record.earnedReward);
      const target = safeNumber(record.targetReward);
      const title = readableBotName(record, index);
      const statusLabel = status === "running" ? "LIVE MINING" : status === "completed" ? "COMPLETED" : status === "pending" ? "PENDING" : "STATUS UNAVAILABLE";
      const progress = earned !== null && target !== null && target > 0 ? Math.max(0, Math.min(100, earned / target * 100)) : null;
      return '<article class="fleet-bot-card"><div class="fleet-bot-card-top"><span class="fleet-bot-avatar">🤖</span><span class="fleet-bot-state ' + (status === "running" ? "is-running" : "") + '">' + statusLabel + '</span></div><h4>' + escapeHtml(title) + '</h4><div class="fleet-bot-stats"><span>মোট অর্জন<strong>৳ ' + formatMoney(earned === null ? 0 : earned) + '</strong></span><span>লক্ষ্য<strong>' + (target === null ? "—" : "৳ " + formatMoney(target)) + '</strong></span></div>' + (progress === null ? '' : '<div class="fleet-progress"><span style="width:' + progress.toFixed(1) + '%"></span></div>') + '<small class="fleet-bot-record">Record: ' + escapeHtml(String(record.status || "unknown")) + '</small></article>';
    }).join("");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
  }

  function bindFleetButtons() {
    ["fleet-shop-button", "fleet-unlock-button", "fleet-empty-shop"].forEach(id => {
      document.getElementById(id)?.addEventListener("click", () => showToast("Bot Shop page is not available in the current main branch yet."));
    });
    ["fleet-referral-button"].forEach(id => {
      document.getElementById(id)?.addEventListener("click", () => showTab("rank"));
    });
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function firstName(user, profile) {
    const candidates = [profile && profile.name, profile && profile.fullName, profile && profile.displayName, user && user.displayName, user && user.email && user.email.split("@")[0]];
    const name = candidates.find(value => typeof value === "string" && value.trim());
    return name ? name.trim().split(/\s+/)[0] : "Member";
  }

  function initials(name) {
    return (name || "U").trim().charAt(0).toUpperCase() || "U";
  }

  function showTab(tabName) {
    const valid = ["home", "rank", "bots", "feed", "profile"];
    const tab = valid.includes(tabName) ? tabName : "home";
    document.querySelectorAll("[data-tab]").forEach(button => {
      const active = button.dataset.tab === tab;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    document.querySelectorAll("[data-panel]").forEach(panel => {
      const active = panel.dataset.panel === tab;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
    const titleByTab = {home:"Home",rank:"Rank",bots:"AI Bots",feed:"Feed",profile:"Profile"};
    document.body.classList.toggle("reference-home-active", tab === "home");
    const homeLayout = document.querySelector(".home-reference-layout");
    if (homeLayout) homeLayout.hidden = tab !== "home";
    document.title = titleByTab[tab] + " · Task Reward Hub";
    if (tab === "profile") {
      const panel = document.getElementById("panel-profile");
      if (panel) panel.scrollIntoView({ block:"nearest", behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }

  document.querySelectorAll("[data-tab]").forEach(button => {
    button.addEventListener("click", () => showTab(button.dataset.tab));
  });
  document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => showTab(button.dataset.go));
  });

  bindFleetButtons();

  const supportToggle = document.getElementById("support-toggle");
  const supportPopover = document.getElementById("support-popover");
  function closeSupportPopover() {
    if (!supportToggle || !supportPopover) return;
    supportPopover.hidden = true;
    supportToggle.setAttribute("aria-expanded", "false");
  }
  supportToggle?.addEventListener("click", event => {
    event.stopPropagation();
    if (!supportPopover) return;
    const shouldOpen = supportPopover.hidden;
    supportPopover.hidden = !shouldOpen;
    supportToggle.setAttribute("aria-expanded", String(shouldOpen));
  });
  supportPopover?.addEventListener("click", event => event.stopPropagation());
  document.getElementById("home-support-shortcut")?.addEventListener("click", () => {
    if (!supportToggle || !supportPopover) return;
    supportPopover.hidden = false;
    supportToggle.setAttribute("aria-expanded", "true");
    supportToggle.focus();
  });
  document.getElementById("home-claim-form")?.addEventListener("submit", event => {
    event.preventDefault();
    const message = document.getElementById("home-claim-message");
    if (message) message.textContent = "Code claiming is not connected in this dashboard build yet.";
  });
  document.addEventListener("click", closeSupportPopover);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeSupportPopover();
  });

  async function signOut() {
    if (!auth) {
      window.location.replace("../index.html");
      return;
    }
    const button = document.getElementById("sign-out");
    const profileButton = document.getElementById("profile-sign-out");
    if (button) button.disabled = true;
    if (profileButton) profileButton.disabled = true;
    try {
      await auth.signOut();
      window.location.replace("../index.html");
    } catch (error) {
      console.error("Task Reward Hub sign-out failed:", error);
      showToast("Could not sign out. Please try again.");
      if (button) button.disabled = false;
      if (profileButton) profileButton.disabled = false;
    }
  }
  document.getElementById("sign-out")?.addEventListener("click", signOut);
  document.getElementById("profile-sign-out")?.addEventListener("click", signOut);
  const rankSearch = document.getElementById("rank-search");
  const rankRefresh = document.getElementById("rank-refresh");
  function filterRankRows() {
    const query = (rankSearch?.value || "").trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll("#rank-list .rank-list-row").forEach(row => {
      const match = (row.dataset.name + " " + row.dataset.id + " " + row.textContent).toLowerCase().includes(query);
      row.hidden = !match;
      if (match) visible++;
    });
    const empty = document.getElementById("rank-empty");
    if (empty) empty.hidden = visible !== 0;
  }
  rankSearch?.addEventListener("input", filterRankRows);
  rankRefresh?.addEventListener("click", () => {
    if (rankSearch) rankSearch.value = "";
    filterRankRows();
    showToast("Leaderboard view refreshed.");
  });


  function renderProfile(user, profile) {
    const name = firstName(user, profile);
    const balance = safeNumber(profile.balance);
    const tasks = countTasks(profile.tasks);
    const referrals = countReferrals(profile.referrals);
    const bots = countBots(profile.unlockedBots);
    const displayName = [profile.name, profile.fullName, user.displayName].find(value => typeof value === "string" && value.trim()) || name;

    setText("header-user-name", String(displayName).toUpperCase());
    const collectorId = profile.collectorId || profile.collector_id || profile.referralCode || profile.referral_code || "—";
    setText("collector-id", String(collectorId));
    setText("welcome-title", "Welcome back.");
    setText("welcome-subtitle", "Good to see you, " + name + ". Your reward space is ready.");
    setText("user-avatar", initials(displayName));
    setText("balance-value", formatMoney(balance));
    setText("tasks-value", tasks === null ? "—" : String(tasks));
    setText("referrals-value", referrals === null ? "—" : String(referrals));
    setText("bots-value", bots === null ? "—" : String(bots));
    setText("rank-tasks", tasks === null ? "—" : String(tasks));
    setText("rank-referrals", referrals === null ? "—" : String(referrals));
    currentUnlockedBotCount = bots;
    setText("bots-detail-count", bots === null ? "—" : String(bots));
    setText("bot-description", bots === null ? "Your profile does not yet contain a readable unlocked-bot count." : "You currently have " + bots + " unlocked " + (bots === 1 ? "bot" : "bots") + " recorded in your profile.");
    renderBotFleet();
    setText("profile-name", displayName);
    setText("profile-email", user.email || "Email not available");
    setText("profile-role", String(profile.role || "member").toUpperCase());
    setText("profile-avatar", initials(displayName));
    setText("profile-balance", "৳" + formatMoney(balance));
    setText("profile-tasks", tasks === null ? "—" : String(tasks));
    setText("profile-referrals", referrals === null ? "—" : String(referrals));

    const progress = [Boolean(user.email), Boolean(displayName), balance !== null].filter(Boolean).length / 3 * 100;
    const progressBar = document.getElementById("profile-progress");
    if (progressBar) progressBar.style.width = progress + "%";
    setText("profile-status", progress >= 100 ? "Profile loaded" : "Profile partially loaded");
    setText("dashboard-message", "Signed in securely as " + (user.email || "your account") + ". Profile values are read from your Firebase user document.");

    // Do not fabricate a rank. A real rank needs the full, verified leaderboard collection.
    setText("rank-label", "—");
    setText("rank-description", "Your profile is connected, but a verified leaderboard position is not available in this build.");
  }

  function loadUserProfile(user) {
    if (profileUnsubscribe) profileUnsubscribe();
    if (miningUnsubscribe) miningUnsubscribe();

    setText("welcome-subtitle", "Loading your account…");
    setText("dashboard-message", "Loading your Firebase profile…");

    const userRef = db.collection("users").doc(user.uid);
    profileUnsubscribe = userRef.onSnapshot(snapshot => {
      if (!snapshot.exists) {
        const basic = { name:user.displayName || (user.email ? user.email.split("@")[0] : "Member"), role:"member", balance:0 };
        renderProfile(user, basic);
        setText("dashboard-message", "You are signed in, but your users profile document was not found. Existing account data was not changed.");
        setText("profile-status", "Profile document missing");
        setText("balance-value", "—");
        showToast("Signed in, but the user profile document was not found.");
        return;
      }
      renderProfile(user, snapshot.data() || {});
    }, error => {
      console.error("Task Reward Hub profile listener failed:", error);
      setText("dashboard-message", "Signed in, but Firebase could not read your profile. Check Firestore rules and your connection.");
      setText("profile-status", "Profile unavailable");
      showToast("Your account profile could not be refreshed.");
    });

    // Mining runs securely through GitHub Actions. This listener only displays
    // its saved earnedReward total; it never credits the wallet from the browser.
    miningUnsubscribe = userRef.collection("botMining").onSnapshot(snapshot => {
      currentMiningRecords = snapshot.docs.map(doc => Object.assign({ id:doc.id }, doc.data() || {}));
      const total = currentMiningRecords.reduce((sum, record) => {
        const earned = safeNumber(record.earnedReward);
        return sum + (earned === null ? 0 : earned);
      }, 0);
      setText("bot-mining-value", formatMoney(Math.round((total + Number.EPSILON) * 100) / 100));
      renderBotFleet();
    }, error => {
      console.error("Task Reward Hub mining balance listener failed:", error);
      setText("bot-mining-value", "—");
    });
  }

  if (!window.firebase || !config) {
    setText("dashboard-message", "Firebase could not initialize. Please return to Login and try again.");
    showToast("Firebase could not start.");
    return;
  }

  try {
    const app = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(config);
    auth = app.auth();
    db = app.firestore();
    auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL).catch(error => console.warn("Firebase persistence setting:", error));
    auth.onAuthStateChanged(user => {
      if (!user) {
        window.location.replace("../index.html");
        return;
      }
      loadUserProfile(user);
    });
  } catch (error) {
    console.error("Task Reward Hub dashboard initialization failed:", error);
    setText("dashboard-message", "The dashboard could not initialize Firebase. Please return to Login and try again.");
    showToast("Could not connect to Firebase.");
  }
})();