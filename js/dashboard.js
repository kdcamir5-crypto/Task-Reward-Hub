(() => {
  "use strict";

  const config = window.TASK_REWARD_HUB_FIREBASE_CONFIG;
  const toast = document.getElementById("toast");
  let auth = null;
  let db = null;
  let toastHandle = null;
  let profileUnsubscribe = null;
  let miningUnsubscribe = null;
  let leaderboardUnsubscribe = null;
  let leaderboardRows = [];
  let leaderboardGeneration = 0, leaderboardRefreshBusy = false, leaderboardStatus = "loading";
  const collectorIdMigrationTasks = new Map();

  function generateCollectorId() {
    return String(Math.floor(10000000 + Math.random() * 90000000));
  }

  async function ensureCollectorId(user, profile) {
    const existing = profile && (profile.collectorId || profile.collector_id);
    if (typeof existing === "string" && /^\d{8}$/.test(existing.trim())) return existing.trim();
    if (!user || !user.uid || !db) return null;
    if (collectorIdMigrationTasks.has(user.uid)) return collectorIdMigrationTasks.get(user.uid);

    const task = (async () => {
      let lastError = null;
      for (let attempt = 0; attempt < 12; attempt++) {
        const collectorId = generateCollectorId();
        const batch = db.batch();
        batch.set(db.collection("collectorIds").doc(collectorId), {
          uid: user.uid,
          collectorId: collectorId,
          createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
        batch.update(db.collection("users").doc(user.uid), {
          collectorId: collectorId,
          referralCode: collectorId,
          updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
        try {
          await batch.commit();
          return collectorId;
        } catch (error) {
          lastError = error;
          if (error && error.code !== "already-exists" && error.code !== "permission-denied") throw error;
        }
      }
      throw lastError || new Error("Could not allocate a unique Collector ID.");
    })();

    collectorIdMigrationTasks.set(user.uid, task);
    try {
      return await task;
    } finally {
      collectorIdMigrationTasks.delete(user.uid);
    }
  }

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
      return value.replace(/\b\w/g, letter => letter.toUpperCase());
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
    const homeBot=document.querySelector('.bot-sleep-card');
    if(homeBot){
      const title=homeBot.querySelector(':scope > strong'),line=homeBot.querySelector('.bot-status-row > span'),note=homeBot.querySelector('.bot-status-row > small');
      if(title)title.textContent=statusText;
      if(line)line.innerHTML=(hasActive?'🟢 ':'🔒 ')+'<b id="bots-value">'+displayCount+'</b> BOTS • '+(hasActive?'ONLINE':'OFFLINE');
      if(note)note.textContent=hasActive?'Live Mining':'Not running';
      const sleep=homeBot.querySelector('.sleeping-bot > span');if(sleep)sleep.hidden=hasActive;
    }
    setText("fleet-active-count", String(activeCount));
    setText("fleet-completed-count", String(records.filter(record => botStatus(record) === "completed").length));
    const earnedText = document.getElementById("bot-mining-value");
    const earnedValue = earnedText ? safeNumber(earnedText.textContent.replace(/,/g, "")) : null;
    setText("fleet-earned", "৳ " + formatMoney(earnedValue === null ? 0 : earnedValue));
    setText("bots-detail-count", totalKnown === null ? String(records.length) : String(totalKnown));
    setText("bot-description", totalKnown === null ? "Your bot count is being read from Firebase." : "You have " + totalKnown + " unlocked " + (totalKnown === 1 ? "bot" : "bots") + " in your account.");
    const list = document.getElementById("fleet-deployed-list");
    if (!list) return;
    if (!records.length) {
      list.innerHTML = '<div class="fleet-empty-card"><div class="fleet-robot-illustration" aria-hidden="true"><span>🤖</span><i></i></div><strong>' + (displayCount > 0 ? displayCount + ' unlocked bot' + (displayCount === 1 ? '' : 's') + ' found' : '0 Bots • Offline') + '</strong><p>' + (displayCount > 0 ? 'আপনার বট অ্যাকাউন্টে আনলক করা আছে, তবে live mining record এখনো পাওয়া যায়নি।' : 'মাইনিং শুরু করতে বট শপ থেকে বট আনলক করুন অথবা verified member রেফার করুন।') + '</p><div class="fleet-empty-actions"><button class="fleet-outline-button" id="fleet-empty-shop" type="button">🤖 বট শপ-এ যান</button><button class="fleet-referral-button" id="fleet-referral-button" type="button">👤+ মেম্বার রেফার করুন</button></div></div>';

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
    ["fleet-shop-button", "fleet-empty-shop"].forEach(id => {
      const button = document.getElementById(id);
      if (button) button.onclick = openBotShop;
    });
    const unlockButton = document.getElementById("fleet-unlock-button");
    if (unlockButton) unlockButton.onclick = openBotShop;
    const backButton = document.getElementById("bot-shop-back");
    if (backButton) backButton.onclick = closeBotShop;
    document.querySelectorAll("[data-shop-bot]").forEach(button => {
      button.addEventListener("click", () => window.HubBotCheckout.open(button.dataset.shopBot));
    });
    const referralButton = document.getElementById("fleet-referral-button");
    if (referralButton) referralButton.onclick = openReferralPage
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

  function openBotShop() {
    closeNotificationsView();
    const fleet = document.getElementById("panel-bots");
    const shop = document.getElementById("bot-shop-page");
    if (!fleet || !shop) {
      showToast("Bot Shop interface could not be opened.");
      return;
    }
    fleet.hidden = true;
    shop.hidden = false;
    shop.scrollIntoView({ block:"start", behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    document.title = "AI Bot Shop · Task Reward Hub";
  }

  function closeBotShop() {
    const fleet = document.getElementById("panel-bots");
    const shop = document.getElementById("bot-shop-page");
    if (shop) shop.hidden = true;
    if (fleet) fleet.hidden = false;
    document.title = "AI Bots · Task Reward Hub";
    if (fleet) fleet.scrollIntoView({ block:"start", behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function showTab(tabName) {
    closeNotificationsView();
    document.body.classList.remove("tap-earning-active", "spin-wheel-active", "referral-page-active", "support-page-active", "wallet-page-active", "deposit-page-active");
    const supportPage = document.getElementById("support-page");
    if (supportPage) supportPage.hidden = true;
    const walletPage = document.getElementById("wallet-page");
    if (walletPage) walletPage.hidden = true;
    const depositPage = document.getElementById("deposit-page");
    if (depositPage) depositPage.hidden = true;
    const referralPage = document.getElementById("referral-page");
    if (referralPage) referralPage.hidden = true;
    const spinPage = document.getElementById("spin-wheel-page");
    if (spinPage) spinPage.hidden = true;
    const valid = ["home", "rank", "bots", "feed", "profile"];
    const tab = valid.includes(tabName) ? tabName : "home";
    syncProfileNavigation(tab);
    document.querySelectorAll("[data-tab]").forEach(button => {
      const active = button.dataset.tab === tab;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    const botShop = document.getElementById("bot-shop-page");
    if (botShop) botShop.hidden = true;
    const tapPage = document.getElementById("tap-earning-page");
    if (tapPage) tapPage.hidden = true;
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


  let walletUser = null, walletProfile = {}, walletDocRef = null, walletProfileAvailable = false, walletReturnTab = "home", selectedMfsProvider = "bKash", walletRecords = [], walletRecordsUnsubscribe = null, withdrawalSubmitting = false;
  let depositReturnTab = "profile", depositSettings = null, depositSettingsUnsubscribe = null, depositSubmitting = false;
  function walletMoney(value) {
    const number = safeNumber(value);
    return number === null ? "—" : formatMoney(number);
  }
  function walletProviderClass(provider) {
    return provider === "bKash" ? "wlt-bkash" : provider === "Nagad" ? "wlt-nagad" : "wlt-rocket";
  }
  function maskWalletNumber(number) {
    const digits = String(number || "").replace(/\D/g, "");
    return digits.length === 11 ? digits.slice(0, 4) + "••••" + digits.slice(-3) : "Number unavailable";
  }
  function renderWalletPage() {
    const balance = walletProfileAvailable ? safeNumber(walletProfile && walletProfile.balance) : null;
    setText("wallet-main-balance", walletMoney(balance));
    setText("wallet-usd-equivalent", walletProfileAvailable ? "$" + formatMoney(walletProfile.usdBalance === undefined ? 0 : walletProfile.usdBalance) + " USD Wallet" : "USD balance loading…");
    const saved = walletRecords;
    const badge = document.getElementById("wallet-count-badge");
    if (badge) badge.textContent = Math.min(saved.length, 5) + "/5 Used";
    const list = document.getElementById("wallet-linked-list");
    if (!list) return;
    if (!saved.length) {
      list.innerHTML = '<div class="wlt-empty"><span>▣</span><strong>No linked wallets yet</strong><p>Bind a payment wallet below. No sample account is displayed.</p></div>';
      return;
    }
    list.innerHTML = saved.slice(0, 5).map(item => {
      const providerValue = item.type || item.provider;
      const provider = ["bKash","Nagad","Rocket"].includes(providerValue) ? providerValue : "MFS Wallet";
      const number = maskWalletNumber(item.number || item.mobileNumber);
      const dateValue = item.boundAt ? new Date(item.boundAt) : null;
      const dateText = dateValue && !Number.isNaN(dateValue.getTime()) ? dateValue.toLocaleDateString(undefined, {month:"short", day:"2-digit"}) : "Date unavailable";
      return '<article class="wlt-linked-row"><span class="wlt-linked-logo ' + walletProviderClass(provider) + '">' + escapeHtml(provider === "bKash" ? "b" : provider === "Nagad" ? "N" : provider === "Rocket" ? "R" : "▣") + '</span><span class="wlt-linked-copy"><strong>' + escapeHtml(provider) + ' ' + escapeHtml(String(item.accountType || "Personal")) + '</strong><small>' + escapeHtml(number) + '</small></span><span class="wlt-linked-status"><b>🔒 Locked</b><small>' + escapeHtml(dateText) + '</small></span></article>';
    }).join("");
  }
  function openWalletPage() {
    closeNotificationsView();
    syncProfileNavigation("home");
    document.body.classList.remove("deposit-page-active");
    const depositPage = document.getElementById("deposit-page");
    if (depositPage) depositPage.hidden = true;
    if (depositSettingsUnsubscribe) depositSettingsUnsubscribe();
    depositSettingsUnsubscribe = null;
    const page = document.getElementById("wallet-page");
    if (!page) { showToast("Wallet interface could not be opened."); return; }
    const activeTab = document.querySelector(".bottom-nav [data-tab].is-active");
    if (activeTab?.dataset.tab) walletReturnTab = activeTab.dataset.tab;
    document.body.classList.remove("tap-earning-active", "spin-wheel-active", "referral-page-active", "support-page-active");
    ["support-page","referral-page","spin-wheel-page","tap-earning-page","bot-shop-page"].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.hidden = true;
    });
    document.querySelectorAll("[data-panel]").forEach(panel => { panel.hidden = true; panel.classList.remove("is-active"); });
    const home = document.querySelector(".home-reference-layout");
    if (home) home.hidden = true;
    page.hidden = false;
    document.body.classList.add("wallet-page-active");
    document.title = "Wallet & Balances · Task Reward Hub";
    renderWalletPage();
    window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
  }
  function closeWalletPage() {
    const page = document.getElementById("wallet-page");
    if (page) page.hidden = true;
    document.body.classList.remove("wallet-page-active");
    showTab(walletReturnTab);
  }

  function depositSettingsReady() {
    return !!(depositSettings && depositSettings.active === true && /^01[3-9][0-9]{8}$/.test(String(depositSettings.bkashNumber || "")));
  }
  function renderDepositSettings(data) {
    depositSettings = data && typeof data === "object" ? data : null;
    const number = String(depositSettings && depositSettings.bkashNumber || "").replace(/\s+/g, "");
    const ready = depositSettingsReady();
    setText("deposit-bkash-number", ready ? number : "Not configured");
    setText("deposit-settings-status", ready
      ? "Payment details are configured by the admin. Please verify the number before paying."
      : depositSettings && depositSettings.active === false
        ? "Deposits are temporarily disabled by the admin."
        : "The admin has not configured an active bKash Personal number yet.");
    setText("deposit-instructions", String(depositSettings && depositSettings.instructions || "Payment instructions will appear here after the admin configures them."));
    const copy = document.getElementById("deposit-copy-number");
    if (copy) copy.disabled = !ready;
    const submit = document.getElementById("deposit-submit");
    if (submit) submit.disabled = !ready || depositSubmitting || !walletUser || !walletProfileAvailable;
  }
  function loadDepositSettings() {
    if (depositSettingsUnsubscribe) depositSettingsUnsubscribe();
    depositSettingsUnsubscribe = null;
    if (!db) {
      renderDepositSettings(null);
      setText("deposit-settings-status", "Firebase connection is not ready. Please try again.");
      return;
    }
    depositSettingsUnsubscribe = db.collection("appSettings").doc("paymentSettings").onSnapshot(snapshot => {
      renderDepositSettings(snapshot.exists ? snapshot.data() : null);
    }, error => {
      console.error("Deposit payment settings could not be loaded:", error);
      renderDepositSettings(null);
      setText("deposit-settings-status", "Payment settings could not be loaded. Please contact support.");
    });
  }
  function renderDepositBalance() {
    setText("deposit-current-balance", walletProfileAvailable ? formatMoney(walletProfile && walletProfile.balance) : "—");
  }
  function openDepositPage() {
    closeNotificationsView();
    if (!walletUser || !db) {
      showToast("Please sign in before submitting a deposit request.");
      return;
    }
    const page = document.getElementById("deposit-page");
    if (!page) { showToast("Deposit interface could not be opened."); return; }
    const activeTab = document.querySelector(".bottom-nav [data-tab].is-active");
    const profileVisible = !!(document.getElementById("panel-profile") && !document.getElementById("panel-profile").hidden);
    depositReturnTab = profileVisible || activeTab?.dataset.tab === "profile" ? "profile" : (activeTab?.dataset.tab || "profile");
    document.body.classList.remove("tap-earning-active", "spin-wheel-active", "referral-page-active", "support-page-active", "wallet-page-active");
    ["wallet-page", "support-page", "referral-page", "spin-wheel-page", "tap-earning-page", "bot-shop-page"].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.hidden = true;
    });
    document.querySelectorAll("[data-panel]").forEach(panel => {
      panel.hidden = true;
      panel.classList.remove("is-active");
    });
    const home = document.querySelector(".home-reference-layout");
    if (home) home.hidden = true;
    page.hidden = false;
    document.body.classList.add("deposit-page-active");
    syncProfileNavigation("profile");
    renderDepositBalance();
    setText("deposit-message", "");
    document.title = "Deposit · Task Reward Hub";
    loadDepositSettings();
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  function closeDepositPage() {
    const page = document.getElementById("deposit-page");
    if (page) page.hidden = true;
    document.body.classList.remove("deposit-page-active");
    if (depositSettingsUnsubscribe) depositSettingsUnsubscribe();
    depositSettingsUnsubscribe = null;
    showTab(depositReturnTab || "profile");
  }
  document.getElementById("deposit-back")?.addEventListener("click", closeDepositPage);
  document.getElementById("deposit-copy-number")?.addEventListener("click", () => {
    if (!depositSettingsReady()) return;
    copyReferralValue(String(depositSettings.bkashNumber), "bKash number copied.");
  });
  document.querySelectorAll("[data-deposit-amount]").forEach(button => {
    button.addEventListener("click", () => {
      const amount = document.getElementById("deposit-amount");
      if (amount) amount.value = button.dataset.depositAmount;
      document.querySelectorAll("[data-deposit-amount]").forEach(option => option.classList.toggle("is-selected", option === button));
    });
  });
  document.getElementById("deposit-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (depositSubmitting) return;
    const amountInput = document.getElementById("deposit-amount");
    const senderInput = document.getElementById("deposit-sender-number");
    const trxInput = document.getElementById("deposit-trx-id");
    const message = document.getElementById("deposit-message");
    const submit = document.getElementById("deposit-submit");
    const amount = Number(amountInput && amountInput.value);
    const senderNumber = String(senderInput && senderInput.value || "").replace(/\s+/g, "");
    const trxId = String(trxInput && trxInput.value || "").trim().toUpperCase();
    if (!walletUser || !db || !walletProfileAvailable) {
      if (message) message.textContent = "আপনার Firebase profile লোড হয়নি। আবার চেষ্টা করুন।";
      return;
    }
    if (!depositSettingsReady()) {
      if (message) message.textContent = "Admin এখনো bKash payment settings চালু করেননি।";
      return;
    }
    if (!Number.isInteger(amount) || amount < 100 || amount > 50000) {
      if (message) message.textContent = "Deposit amount ৳100 থেকে ৳50,000-এর মধ্যে পূর্ণ সংখ্যা হতে হবে।";
      if (amountInput) amountInput.focus();
      return;
    }
    if (!/^01[3-9][0-9]{8}$/.test(senderNumber)) {
      if (message) message.textContent = "সঠিক ১১ সংখ্যার bKash Personal নম্বর লিখুন।";
      if (senderInput) senderInput.focus();
      return;
    }
    if (!/^[A-Z0-9]{5,100}$/.test(trxId)) {
      if (message) message.textContent = "Transaction ID-তে ৫–১০০টি ইংরেজি অক্ষর বা সংখ্যা থাকতে হবে।";
      if (trxInput) trxInput.focus();
      return;
    }
    depositSubmitting = true;
    if (submit) { submit.disabled = true; submit.textContent = "Submitting request…"; }
    if (message) message.textContent = "";
    try {
      const depositRef = db.collection("walletDeposits").doc();
      const usedTrxRef = db.collection("usedDepositTransactions").doc(trxId);
      const profileName = currentReferralProfile && (currentReferralProfile.fullName || currentReferralProfile.name || currentReferralProfile.displayName);
      const userName = String(profileName || walletUser.displayName || (walletUser.email ? walletUser.email.split("@")[0] : "Member")).slice(0, 100);
      const batch = db.batch();
      batch.set(depositRef, {
        uid: walletUser.uid,
        userName,
        email: String(walletUser.email || "").slice(0, 200),
        type: "bKash",
        amount,
        senderNumber,
        trxId,
        status: "pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      batch.set(usedTrxRef, {
        uid: walletUser.uid,
        depositId: depositRef.id,
        trxId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await batch.commit();
      if (message) message.textContent = "আপনার Deposit Request জমা হয়েছে। Admin যাচাই না করা পর্যন্ত ব্যালেন্স পরিবর্তন হবে না।";
      if (amountInput) amountInput.value = "";
      if (senderInput) senderInput.value = "";
      if (trxInput) trxInput.value = "";
      document.querySelectorAll("[data-deposit-amount]").forEach(option => option.classList.remove("is-selected"));
      showToast("Deposit request submitted for admin review.");
    } catch (error) {
      console.error("Deposit request submission failed:", error);
      if (message) message.textContent = error && error.code === "permission-denied"
        ? "Request জমা হয়নি। Transaction ID আগে ব্যবহার হয়েছে, অথবা Firebase Security Rules এখনো deploy করা হয়নি।"
        : "Deposit request জমা হয়নি। Internet connection ও Firebase configuration পরীক্ষা করে আবার চেষ্টা করুন।";
      showToast("Deposit request could not be submitted.");
    } finally {
      depositSubmitting = false;
      if (submit) { submit.textContent = "Submit Deposit Request →"; submit.disabled = !depositSettingsReady() || !walletUser || !walletProfileAvailable; }
    }
  });

  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target.closest("[data-withdrawal-open]") : null;
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    openWithdrawalDrawer();
  }, true);
  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target.closest("[data-money-history-open]") : null;
    if (!target) return;
    event.preventDefault(); event.stopPropagation(); openMoneyHistoryDrawer();
  }, true);
  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target.closest("[data-wallet-open]") : null;
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    openWalletPage();
  }, true);
  document.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target instanceof Element ? event.target.closest("[data-wallet-open][role='button']") : null;
    if (!target) return;
    event.preventDefault();
    openWalletPage();
  });
  document.getElementById("wallet-back")?.addEventListener("click", closeWalletPage);
  document.querySelectorAll("[data-wallet-theme]").forEach(button => {
    button.addEventListener("click", () => {
      const page = document.getElementById("wallet-page");
      if (!page) return;
      const theme = button.dataset.walletTheme === "oled" ? "oled" : "cyber";
      page.dataset.theme = theme;
      document.querySelectorAll("[data-wallet-theme]").forEach(option => {
        const active = option.dataset.walletTheme === theme;
        option.classList.toggle("is-active", active);
        option.setAttribute("aria-pressed", String(active));
      });
    });
  });
  document.querySelectorAll("[data-mfs-provider]").forEach(button => {
    button.addEventListener("click", () => {
      selectedMfsProvider = button.dataset.mfsProvider || "bKash";
      document.querySelectorAll("[data-mfs-provider]").forEach(option => {
        const active = option.dataset.mfsProvider === selectedMfsProvider;
        option.classList.toggle("is-selected", active);
        option.setAttribute("aria-pressed", String(active));
      });
    });
  });
  document.getElementById("wallet-bind-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const input = document.getElementById("wallet-mobile-number");
    const message = document.getElementById("wallet-form-message");
    const submit = document.getElementById("wallet-bind-submit");
    const mobileNumber = String(input?.value || "").replace(/\s+/g, "");
    const saved = walletRecords;
    if (!/^01[3-9]\d{8}$/.test(mobileNumber)) {
      if (message) message.textContent = "বাংলাদেশের সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন।";
      input?.focus();
      return;
    }
    if (!walletUser || !db) {
      if (message) message.textContent = "Firebase profile is unavailable. Wallet was not saved.";
      return;
    }
    if (saved.length >= 5) {
      if (message) message.textContent = "সর্বোচ্চ ৫টি Wallet যুক্ত করা যাবে।";
      return;
    }
    if (saved.some(item => item && String(item.number || "") === mobileNumber)) {
      if (message) message.textContent = "এই মোবাইল নম্বরটি ইতিমধ্যে একটি Wallet-এ যুক্ত আছে।";
      return;
    }
    if (submit) { submit.disabled = true; submit.textContent = "Saving securely…"; }
    if (message) message.textContent = "";
    try {
      await db.collection("wallets").add({
        uid: walletUser.uid,
        type: selectedMfsProvider,
        number: mobileNumber,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      if (input) input.value = "";
      if (message) message.textContent = "Wallet binding saved. This wallet is now locked.";
      showToast("E-Wallet successfully bound and locked.");
    } catch (error) {
      console.error("Wallet binding failed:", error);
      if (message) message.textContent = "Wallet save failed. Check Firestore permissions and try again. No wallet was added.";
      showToast("Wallet could not be saved. No changes were confirmed.");
    } finally {
      if (submit) { submit.disabled = false; submit.innerHTML = "🔒 Bind &amp; Lock E-Wallet"; }
    }
  });

  function renderWithdrawalWalletOptions() {
    const select = document.getElementById("withdrawal-wallet");
    if (!select) return;
    const previous = select.value;
    const valid = walletRecords.filter(item => item && ["bKash","Nagad","Rocket"].includes(item.type) && /^01[3-9]\d{8}$/.test(String(item.number || "")));
    if (!valid.length) {
      select.innerHTML = '<option value="">No verified wallet linked yet</option>';
      select.disabled = true;
      return;
    }
    select.disabled = false;
    select.innerHTML = '<option value="">Choose a verified wallet</option>' + valid.map(item => {
      const number = String(item.number);
      const label = item.type + " (Personal) - " + number;
      return '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(label) + '</option>';
    }).join("");
    if (valid.some(item => item.id === previous)) select.value = previous;
  }

  function openWithdrawalDrawer() {
    const overlay = document.getElementById("withdrawal-overlay");
    const drawer = document.getElementById("withdrawal-drawer");
    if (!overlay || !drawer) return;
    renderWithdrawalWalletOptions();
    const balance = walletProfileAvailable ? safeNumber(walletProfile && walletProfile.balance) : null;
    setText("withdrawal-balance-note", "Available: ৳" + walletMoney(balance) + " · Pending reserve: ৳" + walletMoney(walletProfile.withdrawReserved || 0));
    setText("withdrawal-message", "");
    const amount = document.getElementById("withdrawal-amount");
    if (amount) amount.value = "";
    overlay.hidden = false;
    drawer.hidden = false;
    document.body.classList.add("withdrawal-drawer-open");
    drawer.dataset.theme = document.getElementById("wallet-page")?.dataset.theme === "oled" ? "oled" : "cyber";
    window.setTimeout(() => amount?.focus({ preventScroll: true }), 180);
  }

  function closeWithdrawalDrawer() {
    const overlay = document.getElementById("withdrawal-overlay");
    const drawer = document.getElementById("withdrawal-drawer");
    if (overlay) overlay.hidden = true;
    if (drawer) drawer.hidden = true;
    document.body.classList.remove("withdrawal-drawer-open");
  }


  let moneyHistoryType = "withdrawals";
  let moneyHistoryStatus = "pending";
  let moneyHistoryRows = [];
  let ledgerRows = [];
  let activityController = null;
  let notificationsController = null;
  let notificationsState = {events:[],unread:0,ready:false,loading:true,readError:false,sourceErrors:[]};
  let notificationFilter = "all";
  let activityState = {rows:[],errors:[],loading:true,fromCache:false};
  function historyStatusKey(status) {
    const s=String(status||"").toLowerCase();
    if(["approved","paid","completed","success","successful","processed"].includes(s))return "paid";
    if(["rejected","declined","cancelled","canceled","failed"].includes(s))return "rejected";
    return "pending";
  }
  function historyAmount(row) {
    const v=row&&(row.amount!==undefined?row.amount:row.value!==undefined?row.value:row.reward!==undefined?row.reward:row.earnedReward);
    return safeNumber(v)||0;
  }
  function historyDate(row) {
    const raw=row&&(row.createdAt||row.created_at||row.timestamp||row.date||row.updatedAt);
    const d=raw&&typeof raw.toDate==="function"?raw.toDate():raw instanceof Date?raw:raw?new Date(raw):null;
    return d&&!Number.isNaN(d.getTime())?d.toLocaleString(undefined,{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):"তারিখ পাওয়া যায়নি";
  }
  function setHistoryTheme(drawer) { if(drawer)drawer.dataset.theme=document.getElementById("wallet-page")?.dataset.theme==="oled"?"oled":"cyber"; }
  function openMoneyHistoryDrawer() {
    const o=document.getElementById("money-history-overlay"),d=document.getElementById("money-history-drawer");
    if(!o||!d)return;setHistoryTheme(d);o.hidden=false;d.hidden=false;document.body.classList.add("history-drawer-open");
    moneyHistoryType="withdrawals";moneyHistoryStatus="pending";
    document.getElementById("money-history-title").textContent="💸 উইথড্র হিস্ট্রি";
    document.querySelectorAll("[data-history-type]").forEach(b=>{const on=b.dataset.historyType===moneyHistoryType;b.classList.toggle("is-active",on);b.setAttribute("aria-pressed",String(on));});
    document.querySelectorAll("[data-history-status]").forEach(b=>b.classList.toggle("is-active",b.dataset.historyStatus===moneyHistoryStatus));
    loadMoneyHistory();
  }
  function closeMoneyHistoryDrawer() {
    document.getElementById("money-history-overlay").hidden=true;document.getElementById("money-history-drawer").hidden=true;document.body.classList.remove("history-drawer-open");
  }
  function renderMoneyHistory() {
    ["paid","pending","rejected"].forEach(k=>setText("history-"+k+"-total","৳"+formatMoney(moneyHistoryRows.filter(r=>historyStatusKey(r.status)===k).reduce((n,r)=>n+historyAmount(r),0))));
    const rows=moneyHistoryRows.filter(r=>historyStatusKey(r.status)===moneyHistoryStatus),list=document.getElementById("money-history-list");if(!list)return;
    if(!rows.length){list.innerHTML='<div class="history-empty"><span>▱</span><strong>'+escapeHtml(moneyHistoryType==="withdrawals"?"কোনো উইথড্র রিকোয়েস্ট পাওয়া যায়নি":"কোনো টাকা জমার রেকর্ড পাওয়া যায়নি")+'</strong><p>আপনার লেনদেনের রেকর্ড এখানে দেখা যাবে।</p></div>';return;}
    list.innerHTML=rows.map(r=>'<article class="history-row"><span class="history-row-icon">'+(moneyHistoryType==="withdrawals"?"↗":"↙")+'</span><div class="history-row-main"><strong>'+escapeHtml(moneyHistoryType==="withdrawals"?"উত্তোলন":"টাকা জমা")+'</strong><small>'+escapeHtml(historyDate(r))+'</small><small>'+escapeHtml(String(r.type||r.method||r.provider||""))+(r.rejectionReason?'<br>কারণ: '+escapeHtml(r.rejectionReason):'')+(r.payoutReference?'<br>TRX: '+escapeHtml(r.payoutReference):'')+(r.reservationVersion===2&&r.status==='pending'?'<br>টাকা reserve আছে':'')+'</small></div><div class="history-row-side"><strong>৳'+formatMoney(historyAmount(r))+'</strong><small class="status-'+historyStatusKey(r.status)+'">'+escapeHtml(String(r.status||"pending"))+'</small></div></article>').join("");
  }
  async function loadMoneyHistory() {
    const list=document.getElementById("money-history-list");if(list)list.innerHTML='<div class="history-empty"><span>◌</span><strong>হিস্ট্রি লোড হচ্ছে…</strong></div>';
    if(!walletUser||!db){if(list)list.innerHTML='<div class="history-empty"><strong>লগইন তথ্য পাওয়া যায়নি।</strong></div>';return;}
    const col=moneyHistoryType==="withdrawals"?"withdrawals":"walletDeposits";
    try{const snap=await db.collection(col).where("uid","==",walletUser.uid).get();moneyHistoryRows=snap.docs.map(doc=>Object.assign({id:doc.id},doc.data())).sort((a,b)=>window.HubActivity.time(b.reviewedAt||b.createdAt)-window.HubActivity.time(a.reviewedAt||a.createdAt));renderMoneyHistory();}
    catch(error){console.error("History read failed",col,error);if(list)list.innerHTML='<div class="history-empty"><strong>হিস্ট্রি লোড করা যায়নি</strong><p>Firestore permission বা connection পরীক্ষা করতে হবে।</p></div>';}
  }
  document.querySelectorAll("[data-history-type]").forEach(b=>b.addEventListener("click",()=>{moneyHistoryType=b.dataset.historyType;document.querySelectorAll("[data-history-type]").forEach(x=>{const on=x===b;x.classList.toggle("is-active",on);x.setAttribute("aria-pressed",String(on));});document.getElementById("money-history-title").textContent=moneyHistoryType==="withdrawals"?"💸 উইথড্র হিস্ট্রি":"💰 টাকা জমার হিস্ট্রি";loadMoneyHistory();}));
  document.querySelectorAll("[data-history-status]").forEach(b=>b.addEventListener("click",()=>{moneyHistoryStatus=b.dataset.historyStatus;document.querySelectorAll("[data-history-status]").forEach(x=>x.classList.toggle("is-active",x===b));renderMoneyHistory();}));
  document.querySelectorAll("[data-history-close]").forEach(b=>b.addEventListener("click",closeMoneyHistoryDrawer));
  document.getElementById("money-history-overlay")?.addEventListener("click",closeMoneyHistoryDrawer);
  document.getElementById("history-new-withdrawal")?.addEventListener("click",()=>{closeMoneyHistoryDrawer();openWithdrawalDrawer();});
  function openFullLedgerDrawer(){const o=document.getElementById("ledger-overlay"),d=document.getElementById("ledger-drawer");if(!o||!d)return;setHistoryTheme(d);o.hidden=false;d.hidden=false;document.body.classList.add("history-drawer-open");loadFullLedger();}
  function closeFullLedgerDrawer(){document.getElementById("ledger-overlay").hidden=true;document.getElementById("ledger-drawer").hidden=true;document.body.classList.remove("history-drawer-open");}
  function activityDate(row) {
    return row.timestamp ? new Date(row.timestamp).toLocaleString('bn-BD', {timeZone:'Asia/Dhaka',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : 'সময় সংরক্ষিত নেই';
  }
  function activityStatus(row) {
    if (['rejected','declined','failed','cancelled'].includes(row.status)) return {key:'rejected',label:row.status};
    if (['pending','queued','paused'].includes(row.status)) return {key:'pending',label:row.status};
    if (row.status === 'running') return {key:'pending',label:'mining চলছে'};
    return {key:'paid',label:row.status};
  }
  function activityRowMarkup(row) {
    const status=activityStatus(row);
    return '<article class="history-row"><span class="history-row-icon" aria-hidden="true">'+escapeHtml(row.icon||'•')+'</span><div class="history-row-main"><strong>'+escapeHtml(row.title)+'</strong><small>'+escapeHtml(activityDate(row))+'</small><small>'+escapeHtml(row.detail)+'</small></div><div class="history-row-side"><strong>'+escapeHtml(window.HubActivity.amountText(row))+'</strong><small>'+escapeHtml(row.currency==='BOT'?'Bot':row.currency)+'</small><small class="status-'+status.key+'">'+escapeHtml(status.label)+'</small></div></article>';
  }
  function renderRecentActivity() {
    const list=document.getElementById('recent-activity-list');if(!list)return;
    const rows=ledgerRows.filter(r=>r.recent&&r.timestamp).slice(0,5);
    list.innerHTML=rows.length?rows.map(activityRowMarkup).join(''):'<p class="activity-empty">'+(activityState.loading?'লেনদেন লোড হচ্ছে…':activityState.errors.length?'কিছু activity লোড করা যায়নি। View Ledger থেকে Retry করুন।':'এখনো সাম্প্রতিক লেনদেনের রেকর্ড নেই।')+'</p>';
    setText('recent-activity-status',activityState.errors.length?'কিছু উৎসের তথ্য পাওয়া যায়নি':activityState.fromCache?'সংরক্ষিত তথ্য • connection হলে আপডেট হবে':activityState.loading?'লোড হচ্ছে…':'Firestore থেকে সরাসরি আপডেট');
  }
  function renderFullLedger(){
    const filter=document.querySelector('[data-ledger-filter].is-active')?.dataset.ledgerFilter||'all';
    const stateFilter=document.querySelector('[data-ledger-status].is-active')?.dataset.ledgerStatus||'all';
    const rows=ledgerRows.filter(r=>(filter==='all'||(filter==='money'?['withdrawals','deposits'].includes(r.kind):!['withdrawals','deposits'].includes(r.kind)))&&(stateFilter==='all'||activityStatus(r).key===stateFilter));
    const list=document.getElementById('ledger-list');if(!list)return;
    list.innerHTML=rows.length?rows.map(activityRowMarkup).join(''):'<div class="history-empty"><span>▤</span><strong>'+(activityState.loading?'লেনদেন লোড হচ্ছে…':activityState.errors.length?'সব লেনদেন লোড করা যায়নি':'এই filter-এ কোনো সংরক্ষিত লেনদেন নেই')+'</strong></div>';
    const sourceLabels={withdrawals:'Withdrawals',deposits:'Deposits',purchases:'Bot purchases',tasks:'Tasks',spins:'Spin',gifts:'Referral bots',codes:'Code rewards',profile:'Profile',mining:'Mining'};
    setText('ledger-source-status',activityState.errors.length?'লোড হয়নি: '+activityState.errors.map(k=>sourceLabels[k]||k).join(', ')+'. Retry করুন।':activityState.fromCache?'সংরক্ষিত তথ্য দেখাচ্ছে; connection হলে আপডেট হবে।':activityState.loading?'সব উৎসের তথ্য লোড হচ্ছে…':'উপলভ্য রেকর্ড আপডেট হয়েছে।');
  }
  function startAccountActivity(user) {
    if(activityController)activityController.stop();
    ledgerRows=[];activityState={rows:[],errors:[],loading:true,fromCache:false};renderRecentActivity();renderFullLedger();
    if(!window.HubActivity||!user||!db){activityState.loading=false;activityState.errors=['activity'];renderRecentActivity();renderFullLedger();return;}
    activityController=window.HubActivity.create(db,user.uid,state=>{activityState=state;ledgerRows=state.rows;notificationsController?.setActivity(state);renderRecentActivity();renderFullLedger();});
  }
  function loadFullLedger(){
    if(!activityController&&walletUser)startAccountActivity(walletUser);
    renderFullLedger();
  }
  function closeNotificationsView() {
    const page=document.getElementById('notifications-page');if(page)page.hidden=true;
    document.body.classList.remove('notifications-page-active');
  }
  function openNotificationsPage() {
    showTab('home');
    const page=document.getElementById('notifications-page');if(!page)return;
    document.querySelectorAll('[data-panel]').forEach(el=>{el.hidden=true;el.classList.remove('is-active');});
    const home=document.querySelector('.home-reference-layout');if(home)home.hidden=true;
    const tap=document.getElementById('tap-earning-page');if(tap)tap.hidden=true;
    page.hidden=false;document.body.classList.add('notifications-page-active');document.title='Notifications · Task Reward Hub';
    renderNotifications();
  }
  function renderNotifications() {
    const state=notificationsState,badge=document.getElementById('notification-unread-count'),button=document.querySelector('.notification-button');
    const uncertain=state.readError||state.sourceErrors.length>0;
    if(badge){badge.hidden=!uncertain&&(!state.ready||state.loading||state.unread===0);badge.textContent=uncertain?'!':state.unread>99?'99+':String(state.unread);}
    if(button)button.setAttribute('aria-label',uncertain?'Notifications: কিছু তথ্য লোড হয়নি':!state.ready||state.loading?'Notifications লোড হচ্ছে':'Notifications: '+state.unread+' unread');
    const list=document.getElementById('notifications-list');if(!list)return;
    const rows=state.events.filter(row=>notificationFilter!=='unread'||!row.read);
    list.innerHTML=rows.length?rows.map(row=>'<button type="button" class="nf-item '+(row.read?'is-read':'is-unread')+'" data-notification-read="'+escapeHtml(row.id)+'" '+(row.read||state.saving||!state.ready?'disabled':'')+'><span class="nf-icon" aria-hidden="true">'+escapeHtml(row.icon||'🔔')+'</span><span class="nf-copy"><strong>'+escapeHtml(row.title)+'</strong><span>'+escapeHtml(row.detail)+'</span><small>'+escapeHtml(activityDate(row))+'</small><small>'+escapeHtml(row.read?'পড়া হয়েছে':'Unread • পড়া হয়েছে চিহ্নিত করতে চাপুন')+'</small></span><span class="nf-amount">'+escapeHtml(window.HubActivity.amountText(row))+'</span></button>').join(''):'<p class="nf-empty">'+(!state.ready||state.loading?'Notification লোড হচ্ছে…':uncertain?'কিছু তথ্য লোড করা যায়নি। Refresh করুন।':notificationFilter==='unread'?'কোনো unread notification নেই।':'এখনো কোনো সংরক্ষিত account update নেই।')+'</p>';
    const all=document.getElementById('notifications-mark-all');if(all)all.disabled=!state.ready||state.loading||uncertain||state.saving||state.unread===0;
    setText('notifications-source-status',state.readError?'Read status পাওয়া যায়নি। নতুন Firestore rules publish করে Refresh করুন।':state.sourceErrors.length?'কিছু account update লোড হয়নি। সংখ্যা এখন সম্পূর্ণ নয়; Refresh করুন।':!state.ready||state.loading?'Notification ও read status লোড হচ্ছে…':state.fromCache?'সংরক্ষিত তথ্য দেখাচ্ছে; connection হলে আপডেট হবে।':state.unread+'টি unread • account updates সরাসরি আসবে');
  }
  function startNotifications(user) {
    notificationsController?.stop();notificationsController=null;
    notificationsState={events:[],unread:0,ready:false,loading:true,readError:false,sourceErrors:[]};renderNotifications();
    if(!window.HubNotifications){notificationsState.readError=true;renderNotifications();return;}
    notificationsController=window.HubNotifications.create(db,window.firebase.firestore.FieldValue,user.uid,state=>{notificationsState=state;renderNotifications();});
  }
  async function markNotifications(id) {
    if(!notificationsController)return;
    setText('notifications-action-status','সেভ হচ্ছে…');
    try{if(id)await notificationsController.markRead(id);else await notificationsController.markAll();setText('notifications-action-status','পড়া হয়েছে—Firebase-এ সেভ হয়েছে।');}
    catch(error){setText('notifications-action-status',error.code==='permission-denied'?'সেভ হয়নি। নতুন Firestore rules Publish করে আবার চেষ্টা করুন।':'সেভ হয়নি। Connection পরীক্ষা করে আবার চেষ্টা করুন।');}
  }
  document.querySelectorAll('[data-notifications-open]').forEach(button=>button.addEventListener('click',openNotificationsPage));
  document.getElementById('notifications-back')?.addEventListener('click',()=>showTab('home'));
  document.querySelectorAll('[data-notification-filter]').forEach(button=>button.addEventListener('click',()=>{notificationFilter=button.dataset.notificationFilter;document.querySelectorAll('[data-notification-filter]').forEach(el=>el.classList.toggle('is-active',el===button));renderNotifications();}));
  document.getElementById('notifications-list')?.addEventListener('click',event=>{const button=event.target.closest('[data-notification-read]');if(button&&!button.disabled)markNotifications(button.dataset.notificationRead);});
  document.getElementById('notifications-mark-all')?.addEventListener('click',()=>markNotifications());
  document.getElementById('notifications-refresh')?.addEventListener('click',()=>{setText('notifications-action-status','');notificationsController?.retry();if(walletUser){startAccountActivity(walletUser);activityController?.updateProfile(currentReferralProfile);activityController?.updateMining(currentMiningRecords);}});
  document.querySelectorAll('[data-ledger-open]').forEach(button=>button.addEventListener('click',openFullLedgerDrawer));
  document.querySelectorAll('[data-ledger-status]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-ledger-status]').forEach(el=>el.classList.toggle('is-active',el===button));renderFullLedger();}));
  document.querySelector('[data-ledger-refresh]')?.addEventListener('click',()=>{if(!walletUser)return;startAccountActivity(walletUser);activityController?.updateProfile(currentReferralProfile);activityController?.updateMining(currentMiningRecords);});
  document.querySelectorAll("[data-ledger-filter]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("[data-ledger-filter]").forEach(x=>x.classList.toggle("is-active",x===b));renderFullLedger();}));
  document.querySelectorAll("[data-ledger-close]").forEach(b=>b.addEventListener("click",closeFullLedgerDrawer));
  document.getElementById("ledger-overlay")?.addEventListener("click",closeFullLedgerDrawer);
  document.addEventListener("keydown",event=>{if(event.key!=="Escape")return;if(!document.getElementById("money-history-drawer")?.hidden)closeMoneyHistoryDrawer();if(!document.getElementById("ledger-drawer")?.hidden)closeFullLedgerDrawer();});

  document.getElementById("wallet-withdraw-button")?.addEventListener("click", openWithdrawalDrawer);
  document.getElementById("withdrawal-close")?.addEventListener("click", closeWithdrawalDrawer);
  document.getElementById("withdrawal-overlay")?.addEventListener("click", closeWithdrawalDrawer);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !document.getElementById("withdrawal-drawer")?.hidden) closeWithdrawalDrawer();
  });

  let withdrawalAttempt = null;
  document.getElementById("withdrawal-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (withdrawalSubmitting) return;
    const amountInput = document.getElementById("withdrawal-amount");
    const walletSelect = document.getElementById("withdrawal-wallet");
    const message = document.getElementById("withdrawal-message");
    const submit = document.getElementById("withdrawal-submit");
    const amount = Number(amountInput?.value);
    const balance = walletProfileAvailable ? safeNumber(walletProfile && walletProfile.balance) : null;
    const destination = walletRecords.find(item => item && item.id === walletSelect?.value);
    if (!walletUser || !db || !walletProfileAvailable) {
      if (message) message.textContent = "আপনার Firebase profile এখনো লোড হয়নি। আবার চেষ্টা করুন।";
      return;
    }
    if (!Number.isFinite(amount) || amount < 100 || amount > 5000 || !Number.isInteger(amount)) {
      if (message) message.textContent = "Withdraw amount ৳100 থেকে ৳5,000-এর মধ্যে পূর্ণ সংখ্যা হতে হবে।";
      amountInput?.focus();
      return;
    }
    if (balance === null || amount > balance) {
      if (message) message.textContent = "আপনার available balance এই withdrawal-এর জন্য যথেষ্ট নয়।";
      return;
    }
    if (!destination || !["bKash","Nagad","Rocket"].includes(destination.type) || !/^01[3-9]\d{8}$/.test(String(destination.number || ""))) {
      if (message) message.textContent = "আগে একটি verified E-Wallet bind করুন।";
      return;
    }
    withdrawalSubmitting = true;
    if (submit) { submit.disabled = true; submit.textContent = "Submitting request…"; }
    if (message) message.textContent = "";
    try {
      const pending = await db.collection("withdrawals").where("uid", "==", walletUser.uid).get();
      if (pending.docs.some(doc => doc.data().status === "pending")) {
        if (message) message.textContent = "আপনার একটি withdrawal request ইতিমধ্যে pending আছে। Admin review শেষ হলে আবার request করতে পারবেন।";
        return;
      }
      if (!window.HubWithdrawals) throw new Error("Withdrawal module লোড হয়নি। App refresh করুন।");
      const attemptKey = walletUser.uid + ':' + amount + ':' + destination.id;
      if (!withdrawalAttempt || withdrawalAttempt.key !== attemptKey) withdrawalAttempt = {key:attemptKey,id:db.collection('withdrawals').doc().id};
      await window.HubWithdrawals.request(db, firebase.firestore.FieldValue, walletUser, amount, destination.id, withdrawalAttempt.id);
      withdrawalAttempt = null;
      if (message) message.textContent = "Request জমা হয়েছে। ৳" + amount + " reserve হয়েছে। Reject হলে টাকা available balance-এ ফিরবে।";
      showToast("Withdrawal request submitted for admin review.");
      if (amountInput) amountInput.value = "";
    } catch (error) {
      console.error("Withdrawal request failed:", error);
      if (message) message.textContent = error.code === 'permission-denied' ? "Request অনুমোদিত হয়নি। Updated Firestore rules publish করা আছে কি না পরীক্ষা করুন।" : (error.message || "Connection পরীক্ষা করে আবার চেষ্টা করুন।");
      showToast("Withdrawal request could not be submitted.");
    } finally {
      withdrawalSubmitting = false;
      if (submit) { submit.disabled = false; submit.textContent = "🚀 Confirm Payout Request"; }
    }
  });


  let currentReferralUser=null,currentReferralProfile={},referralFilter="all",referralMembers=[];
  let homeReferralState = { rows:null, fromCache:false, error:false };
  function renderHomeReferralStats() {
    const rows = homeReferralState.rows;
    const ready = Array.isArray(rows) && !homeReferralState.error;
    const verified = ready ? rows.filter(row => row.status === 'verified').length : 0;
    const total = ready ? rows.length : 0;
    const note = homeReferralState.error ? 'লোড হয়নি' : 'লোড হচ্ছে…';
    const suffix = homeReferralState.fromCache ? ' · Cached' : '';
    setText('referrals-value', ready ? String(total) : '—');
    setText('tasks-value', ready ? String(verified) : '—');
    setText('home-pending-referrals', ready ? String(total - verified) : '—');
    setText('home-total-referrals-note', ready ? total + ' Users' + suffix : note);
    setText('home-verified-referrals-note', ready ? verified + ' Verified' + suffix : note);
    setText('home-pending-referrals-note', ready ? (total - verified) + ' Pending' + suffix : note);
  }
  window.addEventListener("hub-referrals-updated", event => {
    const state = event.detail;
    if (!currentReferralUser || state.uid !== currentReferralUser.uid) return;
    homeReferralState = state;
    renderHomeReferralStats();
    if (!state.error) { referralMembers=state.rows;renderReferralPage(); }
  });
  function referralCodeFor(user,profile){const s=profile&&(profile.collectorId||profile.collector_id||profile.referralCode||profile.referral_code);if(typeof s==="string"&&/^\d{8}$/.test(s.trim()))return s.trim();return "—";}
  function renderReferralPage(){if(!currentReferralUser)return;const code=referralCodeFor(currentReferralUser,currentReferralProfile);setText("referral-code-value",code);setText("referral-link-value","https://t.me/Taskrewardhub_bot/Taka?startapp=ref-"+encodeURIComponent(code));setText("referral-member-count",referralMembers.length);setText("referral-all-count",referralMembers.length);setText("referral-verified-count",referralMembers.filter(m=>m.status==="verified").length);setText("referral-quarantine-count",referralMembers.filter(m=>m.status==="quarantine").length);setText("referral-earned-value",formatMoney(safeNumber(currentReferralProfile.referralEarnings)||0));const q=String(document.getElementById("referral-search")?.value||"").trim().toLowerCase();const rows=referralMembers.filter(m=>(referralFilter==="all"||m.status===referralFilter)&&(!q||[m.name,m.id,m.code].join(" ").toLowerCase().includes(q)));const list=document.getElementById("referral-member-list"),empty=document.getElementById("referral-empty-state");if(list){list.hidden=!rows.length;list.innerHTML=rows.map(m=>'<article class="rf-row"><b>'+escapeHtml(initials(m.name))+'</b><span><strong>'+escapeHtml(m.name)+'</strong><small>'+escapeHtml(m.id||m.code||"Member")+'</small></span><em>'+escapeHtml(m.status==='quarantine'?'pending':m.status)+'</em></article>').join("");}if(empty)empty.hidden=rows.length>0;if(!rows.length){setText("referral-empty-title",q?"কোনো মিল পাওয়া যায়নি":"কোনো রেফারেল পাওয়া যায়নি");setText("referral-empty-copy",q?"অন্য নাম, ID বা কোড দিয়ে খুঁজুন।":"আপনার ইনভাইট লিংক বন্ধুদের সঙ্গে শেয়ার করুন। যাচাইকৃত রেফারেল তথ্য যুক্ত হলে সদস্যদের প্রোফাইল এখানে দেখা যাবে।");}}
  function openReferralPage(){closeNotificationsView();syncProfileNavigation("home");const p=document.getElementById("referral-page");if(!p){showToast("Referral interface could not be opened.");return;}document.body.classList.remove("tap-earning-active","spin-wheel-active");["spin-wheel-page","tap-earning-page","bot-shop-page"].forEach(id=>{const e=document.getElementById(id);if(e)e.hidden=true;});document.querySelectorAll("[data-panel]").forEach(e=>{e.hidden=true;e.classList.remove("is-active");});const home=document.querySelector(".home-reference-layout");if(home)home.hidden=true;p.hidden=false;document.body.classList.add("referral-page-active");document.title="Referred Members · Task Reward Hub";renderReferralPage();}
  function closeReferralPage(){const p=document.getElementById("referral-page");if(p)p.hidden=true;document.body.classList.remove("referral-page-active");showTab("home");}
  async function copyReferralValue(v,msg){try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(v);else{const t=document.createElement("textarea");t.value=v;t.style.position="fixed";t.style.opacity="0";document.body.appendChild(t);t.select();const ok=document.execCommand("copy");t.remove();if(!ok)throw Error("copy");}showToast(msg);}catch(e){showToast("কপি করা যায়নি। লিংকটি চেপে ধরে কপি করুন।");}}
  function openSpinWheel() {
    closeNotificationsView();
    syncProfileNavigation("home");
    const page = document.getElementById("spin-wheel-page");
    if (!page) { showToast("Lucky Spin interface could not be opened."); return; }
    const shop = document.getElementById("bot-shop-page");
    if (shop) shop.hidden = true;
    const tapPage = document.getElementById("tap-earning-page");
    if (tapPage) tapPage.hidden = true;
    document.querySelectorAll("[data-panel]").forEach(panel => { panel.hidden = true; panel.classList.remove("is-active"); });
    const homeLayout = document.querySelector(".home-reference-layout");
    if (homeLayout) homeLayout.hidden = true;
    page.hidden = false;
    document.body.classList.add("spin-wheel-active");
    document.title = "Lucky Spin · Task Reward Hub";
    updateSpinWalletDisplay();
    renderSpinHistory();
    updateSpinCount();
  }

  function closeSpinWheel() {
    const page = document.getElementById("spin-wheel-page");
    if (page) page.hidden = true;
    document.body.classList.remove("spin-wheel-active");
    showTab("home");
  }

  const spinRewards = window.HubSpin.rewards;
  let spinInProgress = false, spinRotation = 0, spinTickets = [], spinHistory = [];
  let spinTicketsReady = false, spinLoadError = '', spinDay = null;
  let spinTicketsUnsubscribe = null, spinHistoryUnsubscribe = null;

  function subscribeSpinRewards(user) {
    if (spinTicketsUnsubscribe) spinTicketsUnsubscribe();
    if (spinHistoryUnsubscribe) spinHistoryUnsubscribe();
    spinDay = window.HubSpin.dayKey();
    spinTicketsReady = false; spinLoadError = ''; spinTickets = []; spinHistory = [];
    updateSpinCount();
    const tickets = db.collection('users').doc(user.uid).collection('spinTickets');
    spinTicketsUnsubscribe = tickets.where('day', '==', spinDay).onSnapshot(snapshot => {
      spinTickets = snapshot.docs.map(doc => ({id:doc.id, ...doc.data()})).sort((a,b) => a.slot-b.slot);
      spinTicketsReady = true; spinLoadError = ''; updateSpinCount();
    }, error => {
      spinTicketsReady = false;
      spinLoadError = 'Spin লোড করা যায়নি। সংযোগ পরীক্ষা করুন অথবা support-এ যোগাযোগ করুন।';
      console.error('Spin ticket listener failed:', error.code); updateSpinCount();
    });
    spinHistoryUnsubscribe = tickets.orderBy('claimedAt', 'desc').limit(8).onSnapshot(snapshot => {
      spinHistory = snapshot.docs.map(doc => ({id:doc.id,...doc.data()})).filter(item => item.claimed === true);
      renderSpinHistory();
    }, error => {
      console.error('Spin history listener failed:', error.code);
      const list = document.getElementById('spin-history-list');
      if (list) list.textContent = 'স্পিন হিস্ট্রি লোড করা যায়নি।';
    });
  }

  function updateSpinCount() {
    const remaining = spinTickets.filter(ticket => ticket.claimed === false).length;
    const count = document.getElementById('spin-count'), button = document.getElementById('spin-now-button');
    if (count) count.textContent = spinTicketsReady ? String(remaining) : '—';
    if (button) {
      button.disabled = !spinTicketsReady || remaining === 0 || spinInProgress || !walletProfileAvailable;
      button.innerHTML = spinInProgress ? 'স্পিন চলছে…' : !spinTicketsReady ? 'SPINS LOADING…' : remaining > 0 ? '<span>▶</span> SPIN &amp; WIN NOW' : spinTickets.length >= 2 ? "✓ TODAY'S SPINS USED" : 'SPINS PREPARING…';
    }
    if (!spinInProgress) {
      const result = document.getElementById('spin-result-message');
      if (result && spinLoadError) result.textContent = spinLoadError;
      else if (result && spinTicketsReady && spinTickets.length === 0) result.textContent = 'আজকের ফ্রি Spin প্রস্তুত হচ্ছে। কিছুক্ষণ পর আবার দেখুন।';
      else if (result && result.textContent.includes('প্রস্তুত হচ্ছে')) result.textContent = 'স্পিন শুরু করতে উপরের বাটনে চাপ দিন।';
    }
  }

  function updateSpinWalletDisplay() {
    setText('spin-bdt-balance', walletProfileAvailable ? formatMoney(walletProfile.balance) : '—');
    setText('spin-usd-balance', walletProfileAvailable ? formatMoney(walletProfile.usdBalance === undefined ? 0 : walletProfile.usdBalance) : '—');
  }

  function renderSpinHistory() {
    const list = document.getElementById('spin-history-list');
    if (!list) return;
    if (!spinHistory.length) {
      list.innerHTML = '<p class="spin-history-empty">এখনো কোনো স্পিন খেলা হয়নি। উপরের বাটনে চাপ দিয়ে স্পিন শুরু করুন!</p>';
      return;
    }
    list.innerHTML = spinHistory.map(item => {
      const prize = spinRewards[item.rewardIndex];
      const time = item.claimedAt && item.claimedAt.toDate ? item.claimedAt.toDate().toLocaleString('bn-BD', {timeZone:'Asia/Dhaka', dateStyle:'short', timeStyle:'short'}) : 'জমা হয়েছে';
      return '<article class="spin-history-row"><span class="spin-history-gem">✦</span><span><strong>' + escapeHtml(prize ? prize.label : item.currency + ' ' + (item.amountMinor / 100).toFixed(2)) + ' · ' + (item.currency === 'USD' ? 'ডলার ওয়ালেটে জমা' : 'Main Balance-এ জমা') + '</strong><small>' + escapeHtml(time) + '</small></span><span class="spin-history-tag">CREDITED</span></article>';
    }).join('');
  }

  async function runSpinWheel() {
    if (spinInProgress || !walletUser || !db || !walletProfileAvailable) return;
    if (spinDay !== window.HubSpin.dayKey()) { subscribeSpinRewards(walletUser); return; }
    const ticket = spinTickets.find(item => item.claimed === false);
    if (!ticket) { updateSpinCount(); return; }
    const disc = document.getElementById('spin-wheel-disc'), result = document.getElementById('spin-result-message');
    if (!disc) return;
    spinInProgress = true; updateSpinCount();
    if (result) result.textContent = 'আপনার স্পিন যাচাই হচ্ছে…';
    try {
      const outcome = await window.HubSpin.claim(db, window.firebase.firestore.FieldValue, walletUser, ticket.id);
      const selected = outcome.rewardIndex, finalAngle = (360-selected*45)%360;
      // Align the selected label with the pointer on every consecutive spin.
      const delta = (finalAngle-(spinRotation%360)+360)%360;
      spinRotation += 360*5+delta;
      let finished = false;
      const finish = () => {
        if (finished) return; finished = true;
        disc.removeEventListener('transitionend', onTransition);
        spinInProgress = false;
        if (result) result.textContent = (outcome.alreadyClaimed ? 'এই Spin-এর পুরস্কার আগেই জমা হয়েছে: ' : 'অভিনন্দন! ') + spinRewards[selected].label + (outcome.currency === 'USD' ? ' — ডলার ওয়ালেটে জমা হয়েছে।' : ' — Main Balance-এ জমা হয়েছে।');
        updateSpinCount(); updateSpinWalletDisplay();
      };
      const onTransition = event => { if (event.target === disc && event.propertyName === 'transform') finish(); };
      disc.addEventListener('transitionend', onTransition);
      if (result) result.textContent = 'চাকা ঘুরছে… শুভকামনা!';
      disc.style.transform = 'rotate('+spinRotation+'deg)';
      window.setTimeout(finish, 5600);
    } catch (error) {
      spinInProgress = false; updateSpinCount();
      if (result) result.textContent = error.code === 'permission-denied' ? 'Spin জমা করা যায়নি। Support-এ যোগাযোগ করুন; আবার চাপ দিয়ে চেষ্টা করলেও একই পুরস্কার দুবার জমা হবে না।' : error.message || 'সংযোগ বিচ্ছিন্ন হয়েছে। আবার চেষ্টা করুন।';
    }
  }
  window.setInterval(() => {
    if (walletUser && db && spinDay !== window.HubSpin.dayKey() && !spinInProgress) subscribeSpinRewards(walletUser);
  }, 60000);

  document.querySelectorAll("[data-referral-card]").forEach(card=>{
    card.addEventListener("click",event=>{event.preventDefault();openReferralPage();});
    card.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openReferralPage();}});
  });
  document.querySelectorAll("[data-referral-open]").forEach(b=>b.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();openReferralPage();}));
  document.getElementById("referral-back")?.addEventListener("click",closeReferralPage);
  document.getElementById("referral-search")?.addEventListener("input",renderReferralPage);
  document.querySelectorAll("[data-referral-filter]").forEach(b=>b.addEventListener("click",()=>{referralFilter=b.dataset.referralFilter||"all";document.querySelectorAll("[data-referral-filter]").forEach(o=>o.classList.toggle("is-active",o.dataset.referralFilter===referralFilter));renderReferralPage();}));
  document.querySelectorAll("[data-referral-theme]").forEach(b=>b.addEventListener("click",()=>{const p=document.getElementById("referral-page");if(!p)return;p.dataset.theme=b.dataset.referralTheme==="oled"?"oled":"cyber";document.querySelectorAll("[data-referral-theme]").forEach(o=>o.classList.toggle("is-active",o.dataset.referralTheme===p.dataset.theme));}));
  document.getElementById("referral-copy-code")?.addEventListener("click",()=>copyReferralValue(document.getElementById("referral-code-value")?.textContent||"","Referral code copied."));
  function copyOwnReferralLink() {
    const code = referralCodeFor(currentReferralUser, currentReferralProfile);
    if (!currentReferralUser || !/^\d{8}$/.test(code)) {
      showToast("আপনার referral link এখনো প্রস্তুত হয়নি। একটু পরে চেষ্টা করুন।");
      return;
    }
    return copyReferralValue("https://t.me/Taskrewardhub_bot/Taka?startapp=ref-" + encodeURIComponent(code), "Referral link copied.");
  }
  ["home-copy-referral-link", "referral-copy-link", "referral-empty-copy-link"].forEach(id => {
    document.getElementById(id)?.addEventListener("click", copyOwnReferralLink);
  });
  document.getElementById("home-all-services")?.addEventListener("click", () => {
    const heading = document.getElementById("home-services-heading");
    if (!heading) return;
    const header = document.querySelector(".topbar");
    const offset = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
    heading.focus({ preventScroll:true });
    window.scrollTo({ top:Math.max(0, window.scrollY + heading.getBoundingClientRect().top - offset - 12),
      behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
  document.getElementById("spin-wheel-open")?.addEventListener("click", openSpinWheel);
  document.getElementById("spin-wheel-back")?.addEventListener("click", closeSpinWheel);
  document.getElementById("spin-now-button")?.addEventListener("click", runSpinWheel);
  document.getElementById("spin-sound-button")?.addEventListener("click", event => {
    const button = event.currentTarget;
    const enabled = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(enabled));
    button.textContent = enabled ? "🔔" : "🔊";
    showToast(enabled ? "Sound control enabled (sound integration pending)." : "Sound control muted.");
  });
  document.querySelectorAll("[data-spin-theme]").forEach(button => {
    button.addEventListener("click", () => {
      const page = document.getElementById("spin-wheel-page");
      if (!page) return;
      const theme = button.dataset.spinTheme === "oled" ? "oled" : "cyber";
      page.dataset.theme = theme;
      document.querySelectorAll("[data-spin-theme]").forEach(option => {
        const active = option.dataset.spinTheme === theme;
        option.classList.toggle("is-active", active);
        option.setAttribute("aria-pressed", String(active));
      });
    });
  });

  function openTapEarning() {
    closeNotificationsView();
    const page = document.getElementById("tap-earning-page");
    if (!page) {
      showToast("Tap Earning interface could not be opened.");
      return;
    }
    const shop = document.getElementById("bot-shop-page");
    if (shop) shop.hidden = true;
    document.querySelectorAll("[data-panel]").forEach(panel => { panel.hidden = true; panel.classList.remove("is-active"); });
    const homeLayout = document.querySelector(".home-reference-layout");
    if (homeLayout) homeLayout.hidden = true;
    page.hidden = false;
    document.body.classList.add("tap-earning-active");
    document.title = "Tap Earning · Task Reward Hub";
  }

  function syncProfileNavigation(tabName) {
    const navButton = document.getElementById("nav-bots-tab");
    const navLabel = document.getElementById("nav-bots-label");
    const navIcon = document.getElementById("nav-bots-icon");
    const profileActive = tabName === "profile";
    if (navLabel) navLabel.textContent = profileActive ? "Deposit" : "AI Bots";
    if (navIcon) navIcon.innerHTML = profileActive
      ? '<path d="M3 7h18v13H3z"/><path d="M3 7l2-4h14l2 4M12 10v7M9 13h6"/>'
      : '<rect x="4" y="7" width="16" height="13" rx="3"/><path d="M12 3v4M8 12h.01M16 12h.01M8 16h8"/>';
    if (navButton) {
      navButton.setAttribute("aria-label", profileActive ? "Deposit" : "AI Bots");
      navButton.title = profileActive ? "Open Deposit" : "AI Bots";
    }
  }
  document.querySelectorAll("[data-tab]").forEach(button => {
    button.addEventListener("click", () => {
      const currentProfile = document.getElementById("panel-profile") && !document.getElementById("panel-profile").hidden;
      const depositOpen = document.getElementById("deposit-page") && !document.getElementById("deposit-page").hidden;
      if (button.dataset.tab === "bots" && (currentProfile || depositOpen)) { openDepositPage(); return; }
      showTab(button.dataset.tab);
    });
  });
  document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => showTab(button.dataset.go));
  });
  document.querySelectorAll("[data-tap-open]").forEach(button => {
    button.addEventListener("click", openTapEarning);
  });
  document.getElementById("tap-earning-back")?.addEventListener("click", () => showTab("home"));
  document.querySelectorAll("[data-tap-theme]").forEach(button => {
    button.addEventListener("click", () => {
      const page = document.getElementById("tap-earning-page");
      if (!page) return;
      const theme = button.dataset.tapTheme === "oled" ? "oled" : "cyber";
      page.dataset.theme = theme;
      document.querySelectorAll("[data-tap-theme]").forEach(option => {
        const active = option.dataset.tapTheme === theme;
        option.classList.toggle("is-active", active);
        option.setAttribute("aria-pressed", String(active));
      });
    });
  });
  // Tap coins are a daily, non-cash counter used only to unlock rewarded ads.
  const TAP_DAILY_TARGET = 2000;
  let tapCoinWriteInProgress = false;
  let tapPendingCount = 0;
  let tapQueueRunning = false;
  let tapPointerIds = new Set();
  let tapFeedbackTimer = null;

  function bangladeshDateKey(date = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function getTapDailyProgress(profile = currentReferralProfile) {
    const today = bangladeshDateKey();
    const savedDate = profile && profile.tapCoinsDate;
    const rawCount = Number(profile && profile.tapCoinsCount);
    const count = savedDate === today && Number.isFinite(rawCount) ? Math.max(0, Math.min(TAP_DAILY_TARGET, Math.floor(rawCount))) : 0;
    return { today, count, target: TAP_DAILY_TARGET, unlocked: count >= TAP_DAILY_TARGET };
  }

  function renderTapDailyProgress(profile = currentReferralProfile) {
    const progress = getTapDailyProgress(profile);
    const visibleCount = Math.min(TAP_DAILY_TARGET, progress.count + tapPendingCount);
    setText("tap-coin-value", String(visibleCount));
    setText("tap-progress-label", visibleCount.toLocaleString("en-US") + " / " + TAP_DAILY_TARGET.toLocaleString("en-US"));
    const fill = document.getElementById("tap-progress-fill");
    if (fill) fill.style.width = (visibleCount / TAP_DAILY_TARGET * 100) + "%";

    const adButtons = [
      document.getElementById("tap-sponsored-card"),
      ...document.querySelectorAll('[data-tap-action="ads"]')
    ].filter(Boolean);
    adButtons.forEach(button => {
      button.disabled = !progress.unlocked || monetagLaunchInProgress;
      button.classList.toggle("tap-ad-locked", !progress.unlocked);
      button.setAttribute("aria-disabled", String(!progress.unlocked || monetagLaunchInProgress));
    });

    const sponsoredCopy = document.querySelector("#tap-sponsored-card .tap-sponsored-copy em");
    if (sponsoredCopy && !monetagLaunchInProgress) {
      sponsoredCopy.textContent = progress.unlocked
        ? "Daily goal complete · ads unlocked"
        : "Locked · tap " + (TAP_DAILY_TARGET - visibleCount).toLocaleString("en-US") + " more coins to unlock ads";
    }
    const sponsoredTag = document.querySelector("#tap-sponsored-card .tap-sponsored-tag");
    if (sponsoredTag) sponsoredTag.textContent = progress.unlocked ? "UNLOCKED" : "LOCKED";
    const note = document.querySelector(".tap-feature-note");
    if (note) note.textContent = progress.unlocked
      ? "Daily 2,000-coin goal complete. Rewarded ads are unlocked for today."
      : "Tap once to earn 1 coin. Complete 2,000 coins today to unlock ads. Coins have no cash value and reset daily.";
    const tapButton = document.getElementById("tap-main-button");
    if (tapButton) {
      tapButton.disabled = progress.count >= TAP_DAILY_TARGET;
      tapButton.setAttribute("aria-label", progress.count >= TAP_DAILY_TARGET ? "Daily tap goal complete" : "Tap to earn one coin");
      const small = tapButton.querySelector("small");
      if (small) small.textContent = progress.count >= TAP_DAILY_TARGET
        ? "DAILY GOAL COMPLETE"
        : (tapQueueRunning || tapPendingCount ? "SAVING " + tapPendingCount.toLocaleString("en-US") + " TAP(S)…" : "TOUCH TO EARN +1 COIN");
    }
  }

  function showTapFeedback(button, event) {
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const x = event && Number.isFinite(event.clientX) ? event.clientX - rect.left : rect.width / 2;
    const y = event && Number.isFinite(event.clientY) ? event.clientY - rect.top : rect.height / 2;
    button.style.setProperty("--tap-x", Math.max(0, Math.min(rect.width, x)) + "px");
    button.style.setProperty("--tap-y", Math.max(0, Math.min(rect.height, y)) + "px");
    button.classList.remove("is-tapped");
    void button.offsetWidth;
    button.classList.add("is-tapped");
    if (tapFeedbackTimer) window.clearTimeout(tapFeedbackTimer);
    tapFeedbackTimer = window.setTimeout(() => button.classList.remove("is-tapped"), 130);
  }

  function queueTapCoin() {
    const user = auth && auth.currentUser;
    if (!user || !db) {
      showToast("Please sign in before collecting tap coins.");
      return;
    }
    const progress = getTapDailyProgress();
    const remaining = Math.max(0, TAP_DAILY_TARGET - progress.count - tapPendingCount);
    if (remaining <= 0) {
      renderTapDailyProgress();
      return;
    }
    tapPendingCount += 1;
    renderTapDailyProgress();
    if (!tapQueueRunning) void flushTapCoinQueue(user.uid);
  }

  async function flushTapCoinQueue(uid) {
    if (tapQueueRunning) return;
    tapQueueRunning = true;
    tapCoinWriteInProgress = true;
    const userRef = db.collection("users").doc(uid);
    let savedThisRun = 0;
    try {
      while (tapPendingCount > 0) {
        if (!auth || !auth.currentUser || auth.currentUser.uid !== uid) {
          tapPendingCount = 0;
          break;
        }
        const result = await db.runTransaction(async transaction => {
          const snapshot = await transaction.get(userRef);
          if (!snapshot.exists) throw new Error("Your Firebase profile could not be found.");
          const profile = snapshot.data() || {};
          const today = bangladeshDateKey();
          const oldCount = profile.tapCoinsDate === today ? Number(profile.tapCoinsCount) || 0 : 0;
          const count = Math.max(0, Math.min(TAP_DAILY_TARGET, Math.floor(oldCount)));
          if (count >= TAP_DAILY_TARGET) return { count: TAP_DAILY_TARGET, alreadyComplete: true };
          const nextCount = count + 1;
          transaction.update(userRef, {
            tapCoinsDate: today,
            tapCoinsCount: nextCount,
            tapAdsUnlockedDate: nextCount >= TAP_DAILY_TARGET ? today : null,
            tapCoinsUpdatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
          });
          return { count: nextCount, alreadyComplete: false };
        });
        if (tapPendingCount > 0) tapPendingCount -= 1;
        if (result.alreadyComplete) {
          tapPendingCount = 0;
          break;
        }
        savedThisRun += 1;
        if (currentReferralProfile && auth.currentUser && auth.currentUser.uid === uid) {
          currentReferralProfile.tapCoinsDate = bangladeshDateKey();
          currentReferralProfile.tapCoinsCount = result.count;
          currentReferralProfile.tapAdsUnlockedDate = result.count >= TAP_DAILY_TARGET ? currentReferralProfile.tapCoinsDate : null;
        }
        renderTapDailyProgress();
      }
      if (savedThisRun > 0 && getTapDailyProgress().count >= TAP_DAILY_TARGET) {
        showToast("2,000 coins completed! Rewarded ads are now unlocked for today.");
      }
    } catch (error) {
      console.error("Tap coin save failed:", error);
      showToast("Some taps could not be saved. Please check your connection and tap again.");
    } finally {
      tapQueueRunning = false;
      tapCoinWriteInProgress = false;
      renderTapDailyProgress();
      if (tapPendingCount > 0 && auth && auth.currentUser && auth.currentUser.uid === uid) {
        window.setTimeout(() => { if (!tapQueueRunning) void flushTapCoinQueue(uid); }, 300);
      }
    }
  }

  const MONETAG_WORKER_URL = "https://task-reward-hub-monetag-rewards.kdcamir5.workers.dev";
  const MONETAG_ZONE_ID = "12051888";
  let monetagLaunchInProgress = false;

  async function launchRewardedAd(triggerButton) {
    if (monetagLaunchInProgress) return;
    if (!auth || !auth.currentUser) {
      showToast("Please sign in again before watching an ad.");
      return;
    }
    const dailyProgress = getTapDailyProgress();
    if (!dailyProgress.unlocked) {
      showToast("Ads are locked. Collect " + (TAP_DAILY_TARGET - dailyProgress.count).toLocaleString("en-US") + " more tap coins today to unlock them.");
      renderTapDailyProgress();
      return;
    }
    if (typeof window["show_" + MONETAG_ZONE_ID] !== "function") {
      showToast("The ad provider is still loading. Please try again in a moment.");
      return;
    }

    monetagLaunchInProgress = true;
    const originalText = triggerButton && triggerButton.textContent;
    if (triggerButton) {
      triggerButton.disabled = true;
      triggerButton.setAttribute("aria-busy", "true");
    }
    const sponsoredCopy = document.querySelector("#tap-sponsored-card .tap-sponsored-copy em");
    if (sponsoredCopy) sponsoredCopy.textContent = "Preparing secure rewarded ad…";
    renderTapDailyProgress();

    try {
      const idToken = await auth.currentUser.getIdToken();
      const sessionResponse = await fetch(MONETAG_WORKER_URL + "/ad-session", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + idToken,
          "Content-Type": "application/json"
        }
      });
      const sessionData = await sessionResponse.json().catch(() => ({}));
      if (!sessionResponse.ok || !sessionData.ymid) {
        throw new Error(sessionData.error || "Could not prepare an ad session. Please try again later.");
      }

      const showAd = window["show_" + MONETAG_ZONE_ID];
      const result = await showAd({
        ymid: sessionData.ymid,
        requestVar: "daily_reward"
      });

      if (result && result.reward_event_type === "valued") {
        showToast("Ad watched successfully! Please check your balance for the reward.");
        if (sponsoredCopy) sponsoredCopy.textContent = "Ad watched successfully";
      } else {
        showToast("This ad did not qualify for a reward. No balance was added by the app.");
        if (sponsoredCopy) sponsoredCopy.textContent = "Watch a qualifying rewarded ad";
      }
    } catch (error) {
      console.error("Monetag rewarded ad launch failed:", error);
      showToast(error && error.message ? String(error.message) : "Ad could not start. Please try again.");
      if (sponsoredCopy) sponsoredCopy.textContent = "Tap to watch a rewarded ad";
    } finally {
      monetagLaunchInProgress = false;
      if (triggerButton) {
        triggerButton.disabled = false;
        triggerButton.removeAttribute("aria-busy");
      }
      renderTapDailyProgress();
      if (triggerButton && originalText && triggerButton.id === "tap-main-button") {
        triggerButton.classList.remove("is-tapped");
      }
    }
  }

  const tapMainButton = document.getElementById("tap-main-button");
  if (tapMainButton) {
    tapMainButton.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (tapPointerIds.has(event.pointerId)) return;
      tapPointerIds.add(event.pointerId);
      showTapFeedback(tapMainButton, event);
      queueTapCoin();
      if (event.pointerType !== "mouse") event.preventDefault();
    }, { passive: false });
    const releaseTapPointer = event => tapPointerIds.delete(event.pointerId);
    tapMainButton.addEventListener("pointerup", releaseTapPointer);
    tapMainButton.addEventListener("pointercancel", releaseTapPointer);
    tapMainButton.addEventListener("lostpointercapture", releaseTapPointer);
    tapMainButton.addEventListener("click", event => {
      // Pointerdown handles mouse, pen and every individual touch; this only blocks
      // synthetic click activation from double-counting the same physical tap.
      event.preventDefault();
    });
  }
  document.getElementById("tap-sponsored-card")?.addEventListener("click", event => {
    launchRewardedAd(event.currentTarget);
  });
  document.querySelectorAll("[data-tap-action]").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.tapAction;
      if (action === "withdraw") { openWalletPage(); return; }
      if (action === "ads") { launchRewardedAd(button); return; }
      if (action === "invite") { openReferralPage(); return; }
      const messages = {
      };
      showToast(messages[action] || "This Tap Earning action is not connected yet.");
    });
  });

  bindFleetButtons();

  // Native modal supplies focus trapping and Escape dismissal without changing page layout.
  const hubMenu = document.getElementById('hub-menu');
  const hubMenuButton = document.querySelector('.home-menu-button');
  hubMenuButton?.addEventListener('click', () => {
    if (!hubMenu || hubMenu.open) return;
    hubMenu.showModal();
    hubMenuButton.setAttribute('aria-expanded', 'true');
  });
  hubMenu?.addEventListener('close', () => hubMenuButton?.setAttribute('aria-expanded', 'false'));
  document.getElementById('hub-menu-close')?.addEventListener('click', () => hubMenu.close());
  hubMenu?.addEventListener('click', event => {
    if (event.target === hubMenu) {
      const r = hubMenu.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) hubMenu.close();
    }
  });
  document.querySelectorAll('[data-menu-route]').forEach(button => {
    button.addEventListener('click', () => {
      const route = button.dataset.menuRoute;
      const actions = {wallet:openWalletPage,deposit:openDepositPage,withdraw:openWithdrawalDrawer,
        ledger:openFullLedgerDrawer,referrals:openReferralPage,shop:openBotShop,
        spin:openSpinWheel,tap:openTapEarning,alerts:openNotificationsPage,support:openSupportPage};
      hubMenu.close();
      // Clear prior inner pages before opening a destination from any tab.
      showTab(['home','rank','feed','profile'].includes(route) ? route : (route === 'shop' ? 'bots' : 'home'));
      if (actions[route]) actions[route]();
    });
  });


  const supportToggle = document.getElementById("support-toggle");
  let supportReturnTab = "home";
  function openSupportPage() {
    closeNotificationsView();
    syncProfileNavigation("home");
    document.body.classList.remove("deposit-page-active", "wallet-page-active");
    const walletPage = document.getElementById("wallet-page");
    if (walletPage) walletPage.hidden = true;
    const depositPage = document.getElementById("deposit-page");
    if (depositPage) depositPage.hidden = true;
    if (depositSettingsUnsubscribe) depositSettingsUnsubscribe();
    depositSettingsUnsubscribe = null;
    const page = document.getElementById("support-page");
    if (!page) { showToast("Support interface could not be opened."); return; }
    const activeTab = document.querySelector(".bottom-nav [data-tab].is-active");
    if (activeTab?.dataset.tab) supportReturnTab = activeTab.dataset.tab;
    document.body.classList.remove("tap-earning-active", "spin-wheel-active", "referral-page-active");
    ["referral-page", "spin-wheel-page", "tap-earning-page", "bot-shop-page"].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.hidden = true;
    });
    document.querySelectorAll("[data-panel]").forEach(panel => {
      panel.hidden = true;
      panel.classList.remove("is-active");
    });
    const home = document.querySelector(".home-reference-layout");
    if (home) home.hidden = true;
    page.hidden = false;
    document.body.classList.add("support-page-active");
    document.title = "Admin Support · Task Reward Hub";
    if (supportToggle) supportToggle.setAttribute("aria-expanded", "true");
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  function closeSupportPage() {
    const page = document.getElementById("support-page");
    if (page) page.hidden = true;
    document.body.classList.remove("support-page-active");
    if (supportToggle) supportToggle.setAttribute("aria-expanded", "false");
    showTab(supportReturnTab);
  }
  supportToggle?.addEventListener("click", event => {
    event.preventDefault();
    openSupportPage();
  });
  document.getElementById("home-support-shortcut")?.addEventListener("click", openSupportPage);
  document.getElementById("support-back")?.addEventListener("click", closeSupportPage);
  document.getElementById("support-close")?.addEventListener("click", closeSupportPage);
  let claimingRewardCode = false;
  document.getElementById('home-claim-form')?.addEventListener('submit', async event => {
    event.preventDefault();if(claimingRewardCode)return;
    const input=document.getElementById('home-claim-code'),message=document.getElementById('home-claim-message'),button=event.target.querySelector('[type="submit"]');
    if(!walletUser||!db||!window.HubRewardCodes){message.textContent='Account অথবা code module লোড হয়নি। App refresh করুন।';return;}
    claimingRewardCode=true;button.disabled=true;message.textContent='Code যাচাই হচ্ছে…';
    try{
      const result=await window.HubRewardCodes.claim(db,window.firebase.firestore.FieldValue,walletUser,input.value);
      const reward=result.rewardType==='bot'?window.HubRewardCodes.bots[result.botId].name+' unlock হয়েছে':(result.rewardType==='USD'?'$':'৳')+(result.amountMinor/100).toFixed(2)+' wallet-এ যোগ হয়েছে';
      message.textContent=result.already?'এই code আগেই claim করেছেন। নতুন করে reward যোগ হয়নি।':reward;showToast(result.already?'Code already claimed.':'Code reward সফল হয়েছে।');
      if(!result.already)input.value='';
    }catch(error){message.textContent=error.code==='permission-denied'?'Claim অনুমোদিত হয়নি। Code-এর মেয়াদ/usage limit ও নতুন Firebase rules পরীক্ষা করুন।':error.message;}
    finally{claimingRewardCode=false;button.disabled=false;}
  });
  document.querySelectorAll('[data-code-claim-open]').forEach(button=>button.addEventListener('click',()=>{showTab('home');document.getElementById('home-claim-form')?.scrollIntoView({block:'center',behavior:'smooth'});document.getElementById('home-claim-code')?.focus({preventScroll:true});}));

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
      activityController?.stop();
      notificationsController?.stop();
      window.HubFeed?.stop();
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
  let linkingTelegramLogin = false;
  document.getElementById('telegram-login-link')?.addEventListener('click', async () => {
    if(linkingTelegramLogin)return;const button=document.getElementById('telegram-login-link'),password=document.getElementById('telegram-link-password'),message=document.getElementById('telegram-login-link-message');
    if(!auth?.currentUser||!window.HubTelegramLogin){message.textContent='Account অথবা login module লোড হয়নি।';return;}
    const uid=auth.currentUser.uid;linkingTelegramLogin=true;button.disabled=true;message.textContent='Telegram ও account যাচাই হচ্ছে…';
    try{await window.HubTelegramLogin.link(auth,password.value);if(auth.currentUser?.uid!==uid)return;message.textContent='Telegram Login যুক্ত হয়েছে। আগের balance ও bot একই account-এ থাকবে।';document.getElementById('telegram-link-password-wrap').hidden=true;}
    catch(error){if(auth.currentUser?.uid!==uid)return;if(error.code==='RECENT_LOGIN_REQUIRED'){document.getElementById('telegram-link-password-wrap').hidden=false;password.focus();}message.textContent=error.code?.startsWith('auth/')?'Password যাচাই হয়নি। সঠিক password দিয়ে আবার চেষ্টা করুন।':error.message;}
    finally{password.value='';linkingTelegramLogin=false;button.disabled=false;}
  });
  let pendingProfilePhotoData = null;
  function setProfileFormMessage(id, message, type) {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("is-error", type === "error");
    node.classList.toggle("is-success", type === "success");
  }
  function setInputValueUnlessFocused(id, value) {
    const input = document.getElementById(id);
    if (input && document.activeElement !== input) input.value = value == null ? "" : String(value);
  }
  document.getElementById("profile-shortcut-dashboard")?.addEventListener("click", () => showTab("home"));
  document.getElementById("profile-shortcut-deposit")?.addEventListener("click", openDepositPage);
  document.getElementById("profile-shortcut-ledger")?.addEventListener("click", openFullLedgerDrawer);
  document.getElementById("profile-copy-referral")?.addEventListener("click", () => {
    if (!currentReferralUser) { showToast("Your referral code is not ready yet."); return; }
    copyReferralValue(referralCodeFor(currentReferralUser, currentReferralProfile), "Referral code copied.");
  });
  document.querySelectorAll("[data-password-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.passwordToggle);
      if (!input) return;
      const reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      button.setAttribute("aria-label", (reveal ? "Hide " : "Show ") + input.id.replace("profile-", "").replaceAll("-", " "));
      button.textContent = reveal ? "◎" : "◉";
    });
  });

  let pendingProfileAvatar = null;
  document.querySelectorAll("[data-profile-avatar]").forEach(option => {
    option.addEventListener("click", () => {
      pendingProfileAvatar = option.dataset.profileAvatar || null;
      pendingProfilePhotoData = null;
      document.querySelectorAll("[data-profile-avatar]").forEach(item => {
        item.classList.toggle("is-selected", item === option);
        item.setAttribute("aria-pressed", String(item === option));
      });
      const preview = document.getElementById("profile-avatar");
      const photo = document.getElementById("profile-photo");
      if (preview && pendingProfileAvatar) { preview.textContent = pendingProfileAvatar; preview.hidden = false; }
      if (photo) photo.hidden = true;
      const header = document.getElementById("user-avatar");
      if (header && pendingProfileAvatar) {
        const dot = header.querySelector(".online-dot");
        header.textContent = pendingProfileAvatar;
        if (dot) header.appendChild(dot);
      }
      const message = document.getElementById("profile-avatar-message");
      if (message) message.textContent = "Avatar selected. Tap Save Avatar to keep it on your account.";
    });
  });
  document.getElementById("profile-avatar-save")?.addEventListener("click", async () => {
    const user = auth && auth.currentUser;
    const button = document.getElementById("profile-avatar-save");
    const message = document.getElementById("profile-avatar-message");
    if (!user || !db) { if (message) message.textContent = "Please sign in again before saving your avatar."; return; }
    if (!pendingProfileAvatar) { if (message) message.textContent = "Choose an avatar first."; return; }
    if (button) { button.disabled = true; button.textContent = "Saving…"; }
    try {
      await db.collection("users").doc(user.uid).update({ profileAvatar: pendingProfileAvatar, profilePhotoData: "" });
      if (message) message.textContent = "Avatar saved successfully!";
      pendingProfileAvatar = null;
    } catch (error) {
      console.error("Profile avatar save failed:", error);
      if (message) message.textContent = "Avatar could not be saved. Please check Firebase Rules.";
      showToast("Avatar could not be saved. Please check Firebase Rules.");
    } finally {
      if (button) { button.disabled = false; button.textContent = "Save Avatar"; }
    }
  });

  document.getElementById("profile-photo-input")?.addEventListener("change", event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
      showToast("Please select an image file.");
      event.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast("Choose an image smaller than 10 MB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => showToast("Could not read this image. Please try another file.");
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => showToast("This image could not be opened.");
      image.onload = () => {
        const scale = Math.min(1, 320 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) { showToast("Image editing is not available in this browser."); return; }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL("image/jpeg", 0.68);
        if (data.length > 450000) { showToast("This image is too large after compression. Choose another image."); return; }
        pendingProfilePhotoData = data;
        pendingProfileAvatar = null;
        const photo = document.getElementById("profile-photo");
        if (photo) { photo.src = data; photo.hidden = false; }
        const initialsNode = document.getElementById("profile-avatar");
        if (initialsNode) initialsNode.hidden = true;
        setProfileFormMessage("profile-save-message", "Profile picture selected. Save your profile to keep it.", "");
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("profile-information-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const user = auth && auth.currentUser;
    if (!user || !db) { setProfileFormMessage("profile-save-message", "You must be signed in to update your profile.", "error"); return; }
    const name = String(document.getElementById("profile-full-name-input")?.value || "").trim();
    const phone = String(document.getElementById("profile-phone-input")?.value || "").trim();
    const telegram = String(document.getElementById("profile-telegram-input")?.value || "").trim();
    if (!name) { setProfileFormMessage("profile-save-message", "Full name is required.", "error"); return; }
    if (name.length > 80 || phone.length > 24 || telegram.length > 120) {
      setProfileFormMessage("profile-save-message", "Please check the length of your profile details.", "error"); return;
    }
    const button = document.getElementById("profile-save-button");
    if (button) { button.disabled = true; button.textContent = "Saving profile…"; }
    setProfileFormMessage("profile-save-message", "Saving your profile details…", "");
    const updates = { name: name, fullName: name, phoneNumber: phone, telegramUsername: telegram, profileUpdatedAt: window.firebase.firestore.FieldValue.serverTimestamp() };
    if (pendingProfilePhotoData) { updates.profilePhotoData = pendingProfilePhotoData; updates.profileAvatar = ""; }
    try {
      await db.collection("users").doc(user.uid).update(updates);
      if (user.displayName !== name) {
        try { await user.updateProfile({ displayName: name }); } catch (profileError) { console.warn("Firebase Auth display-name update was not available:", profileError); }
      }
      pendingProfilePhotoData = null;
      setProfileFormMessage("profile-save-message", "Profile changes saved successfully.", "success");
      showToast("Profile updated.");
    } catch (error) {
      console.error("Profile update failed:", error);
      const message = error && error.code === "permission-denied"
        ? "Profile could not be saved because Firestore rules denied this update. Your existing account data was not changed."
        : "Profile could not be saved. Check your connection and try again.";
      setProfileFormMessage("profile-save-message", message, "error");
    } finally {
      if (button) { button.disabled = false; button.textContent = "💾 Save Profile Changes"; }
    }
  });

  document.getElementById("profile-password-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const user = auth && auth.currentUser;
    const current = String(document.getElementById("profile-current-password")?.value || "");
    const next = String(document.getElementById("profile-new-password")?.value || "");
    const confirm = String(document.getElementById("profile-confirm-password")?.value || "");
    if (!user || !user.email) { setProfileFormMessage("profile-password-message", "A signed-in email/password account is required to change your password here.", "error"); return; }
    if (!current || !next || !confirm) { setProfileFormMessage("profile-password-message", "Please fill in all three password fields.", "error"); return; }
    if (next.length < 6) { setProfileFormMessage("profile-password-message", "New password must contain at least 6 characters.", "error"); return; }
    if (next !== confirm) { setProfileFormMessage("profile-password-message", "New password and confirmation do not match.", "error"); return; }
    if (current === next) { setProfileFormMessage("profile-password-message", "Choose a new password different from your current password.", "error"); return; }
    const button = document.getElementById("profile-password-button");
    if (button) { button.disabled = true; button.textContent = "Updating password…"; }
    setProfileFormMessage("profile-password-message", "Verifying your current password…", "");
    try {
      const credential = window.firebase.auth.EmailAuthProvider.credential(user.email, current);
      await user.reauthenticateWithCredential(credential);
      await user.updatePassword(next);
      document.getElementById("profile-password-form").reset();
      setProfileFormMessage("profile-password-message", "Password updated successfully.", "success");
      showToast("Password updated successfully.");
    } catch (error) {
      console.error("Password update failed:", error);
      let message = "Password could not be updated. Please try again.";
      if (error && (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential")) message = "Current password is incorrect.";
      else if (error && error.code === "auth/weak-password") message = "Choose a stronger password with at least 6 characters.";
      else if (error && error.code === "auth/requires-recent-login") message = "Please sign in again, then retry the password change.";
      else if (error && error.code === "auth/too-many-requests") message = "Too many attempts. Wait a little before trying again.";
      else if (error && error.code === "auth/operation-not-allowed") message = "Password change is not enabled for this sign-in method.";
      setProfileFormMessage("profile-password-message", message, "error");
    } finally {
      if (button) { button.disabled = false; button.textContent = "🔒 Update Password"; }
    }
  });


  document.getElementById("profile-back-home")?.addEventListener("click", () => showTab("home"));
  document.querySelectorAll("[data-profile-action]").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.profileAction;
      if (action === "wallet") { openWalletPage(); return; }
      if (action === "referrals") { openReferralPage(); return; }
      if (action === "support") { openSupportPage(); return; }
      if (action === "ledger") { openFullLedgerDrawer(); return; }
      showToast("This setting is not available yet.");
    });
  });
  document.getElementById("profile-telegram-open")?.addEventListener("click", () => {
    const raw = document.getElementById("profile-telegram-username")?.textContent.trim() || "";
    const username = raw.replace(/^https:\/\/(?:www\.)?(?:t\.me|telegram\.me)\//i, "").replace(/^@/, "").replace(/\/$/, "");
    if (username && /^[A-Za-z0-9_]{5,32}$/.test(username)) {
      window.open("https://t.me/" + encodeURIComponent(username), "_blank", "noopener,noreferrer");
    } else {
      showToast("Telegram username is not configured for this account.");
    }
  });
  document.getElementById("profile-vip-join")?.addEventListener("click", () => {
    showToast("Official VIP community link has not been configured yet.");
  });
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
  function renderLeaderboard() {
    const sorted = leaderboardRows.slice().sort((a,b) => (safeNumber(b.botCount)||0) - (safeNumber(a.botCount)||0) || String(a.displayName||"").localeCompare(String(b.displayName||"")));
    const currentUid = currentReferralUser && currentReferralUser.uid;
    const myIndex = sorted.findIndex(item => item.uid === currentUid);
    setText("rank-label", myIndex >= 0 ? "#" + (myIndex + 1) : "—");
    const podium = document.querySelector(".rank-podium");
    if (podium) {
      const podiumOrder = [{index:1,cls:"podium-silver",position:2},{index:0,cls:"podium-gold",position:1},{index:2,cls:"podium-bronze",position:3}];
      const top = podiumOrder.map(slot => {
        const item = sorted[slot.index];
        if (!item) return '<article class="podium-card '+slot.cls+'"><span class="podium-crown">♛</span><div class="podium-avatar">—</div><span class="podium-position">#'+slot.position+'</span><h3>Waiting for members</h3><span class="podium-bots">♟ 0 Bots</span></article>';
        const name = String(item.displayName || "Member");
        return '<article class="podium-card '+slot.cls+'"><span class="podium-crown">♛</span><div class="podium-avatar">'+escapeHtml(initials(name))+'</div><span class="podium-position">#'+slot.position+'</span><h3>'+escapeHtml(name)+(slot.position===1?' 👑':'')+'</h3><span class="podium-bots">♟ '+(safeNumber(item.botCount)||0)+' Bots</span></article>';
      }).join("");
      podium.innerHTML = top;
    }
    const list = document.getElementById("rank-list");
    if (list) {
      const shown = sorted.slice(0,50);
      if (currentUid && !shown.some(item => item.uid === currentUid) && myIndex >= 50) shown.push(sorted[myIndex]);
      list.innerHTML = shown.map(item => {
        const rank = sorted.findIndex(row => row.uid === item.uid) + 1;
        const name = String(item.displayName || "Member");
        const id = String(item.collectorId || item.uid || "");
        const cls = rank===1?"rank-gold":rank===2?"rank-silver":rank===3?"rank-bronze":"";
        return '<article class="rank-list-row" data-name="'+escapeHtml(name.toLowerCase())+'" data-id="'+escapeHtml(id.toLowerCase())+'"><span class="rank-number '+cls+'">#'+rank+'</span><span class="rank-row-avatar">'+escapeHtml(initials(name))+'</span><strong class="rank-member-name">'+escapeHtml(name)+(item.uid===currentUid?' <span>(You)</span>':'')+'</strong><span class="rank-metric">♟ <b>'+(safeNumber(item.botCount)||0)+' Bots</b></span></article>';
      }).join("") + '<p class="rank-empty-state" id="rank-empty" hidden>No matching members found.</p>';
    }
    const statusNotes = {loading:"Rank লোড হচ্ছে…",refreshing:"Firebase থেকে নতুন Rank আনা হচ্ছে…",cached:"সংরক্ষিত Rank দেখাচ্ছে। নতুন তথ্যের জন্য Refresh করুন।",error:"নতুন Rank লোড হয়নি। সংযোগ ও Firestore rules পরীক্ষা করে Refresh করুন।"};
    setText("rank-data-note", statusNotes[leaderboardStatus] || (sorted.length ? "Live leaderboard · "+sorted.length+" registered member"+(sorted.length===1?"":"s")+" · updates automatically" : "No leaderboard members yet. Each existing account needs to sign in once to publish its rank profile."));
    filterRankRows();
  }
  function startLeaderboardListener(refreshing = false) {
    if (leaderboardUnsubscribe) leaderboardUnsubscribe();
    const generation = ++leaderboardGeneration;
    if (!refreshing) {
      leaderboardRows = [];
      leaderboardRefreshBusy = false;
      if (rankRefresh) { rankRefresh.disabled = false; rankRefresh.removeAttribute('aria-busy'); }
    }
    leaderboardStatus = refreshing ? 'refreshing' : 'loading';
    renderLeaderboard();
    leaderboardUnsubscribe = db.collection("publicLeaderboard").onSnapshot({includeMetadataChanges:true}, snapshot => {
      if (generation !== leaderboardGeneration) return;
      leaderboardRows = snapshot.docs.map(doc => ({...(doc.data()||{}),uid:doc.id}));
      if (!leaderboardRefreshBusy) leaderboardStatus = snapshot.metadata.fromCache ? 'cached' : 'live';
      renderLeaderboard();
    }, error => {
      if (generation !== leaderboardGeneration) return;
      console.error("Live leaderboard listener failed:", error.code);
      leaderboardStatus = 'error';
      renderLeaderboard();
    });
  }
  async function refreshLeaderboard() {
    if (leaderboardRefreshBusy || !db || !auth?.currentUser) return;
    const uid = auth.currentUser.uid;
    leaderboardRefreshBusy = true;
    if (rankRefresh) { rankRefresh.disabled = true; rankRefresh.setAttribute('aria-busy','true'); }
    // Restart a failed listener as well as doing a server-only fetch.
    startLeaderboardListener(true);
    const generation = leaderboardGeneration;
    try {
      const snapshot = await db.collection('publicLeaderboard').get({source:'server'});
      if (generation !== leaderboardGeneration || auth.currentUser?.uid !== uid) return;
      leaderboardRows = snapshot.docs.map(doc => ({...(doc.data()||{}),uid:doc.id}));
      leaderboardStatus = 'live';
      renderLeaderboard();
      showToast('Rank Firebase থেকে আপডেট হয়েছে।');
    } catch (error) {
      if (generation !== leaderboardGeneration || auth.currentUser?.uid !== uid) return;
      leaderboardStatus = 'error';
      renderLeaderboard();
      showToast('Rank refresh হয়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।');
    } finally {
      if (generation === leaderboardGeneration) {
        leaderboardRefreshBusy = false;
        if (rankRefresh) { rankRefresh.disabled = false; rankRefresh.removeAttribute('aria-busy'); }
      }
    }
  }
  async function syncPublicLeaderboard(user, profile) {
    if (!user || !profile || !db) return;
    const collectorId = String(profile.collectorId || profile.collector_id || profile.referralCode || "");
    if (!/^\d{8}$/.test(collectorId)) return;
    const name = String(profile.name || profile.fullName || user.displayName || (user.email ? user.email.split("@")[0] : "Member")).trim().slice(0,80) || "Member";
    const bots = (Array.isArray(profile.unlockedBots) ? profile.unlockedBots.length : 0)+(safeNumber(profile.referralBotsCount)||0);
    try {
      await db.collection("publicLeaderboard").doc(user.uid).set({
        uid:user.uid,
        displayName:name,
        collectorId:collectorId,
        botCount:bots,
        updatedAt:window.firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
    } catch (error) {
      console.error("Public leaderboard profile sync failed:", error);
    }
  }
  async function backfillLeaderboardForAdmin(profile) {
    if (!profile || profile.role !== "admin" || !db) return;
    try {
      const snapshot = await db.collection("users").get();
      let batch = db.batch();
      let writes = 0;
      const commitBatch = async () => {
        if (writes) await batch.commit();
        batch = db.batch();
        writes = 0;
      };
      for (const userDoc of snapshot.docs) {
        const data = userDoc.data() || {};
        const collectorId = String(data.collectorId || "");
        if (!/^\d{8}$/.test(collectorId)) continue;
        const name = String(data.name || data.fullName || "Member").trim().slice(0,80) || "Member";
        const bots = (Array.isArray(data.unlockedBots) ? data.unlockedBots.length : 0)+(safeNumber(data.referralBotsCount)||0);
        batch.set(db.collection("publicLeaderboard").doc(userDoc.id), {
          uid:userDoc.id,
          displayName:name,
          collectorId:collectorId,
          botCount:bots,
          updatedAt:window.firebase.firestore.FieldValue.serverTimestamp()
        }, {merge:true});
        writes++;
        if (writes >= 400) await commitBatch();
      }
      await commitBatch();
    } catch (error) {
      console.error("Admin leaderboard backfill failed:", error);
    }
  }
  rankSearch?.addEventListener("input", filterRankRows);
  rankRefresh?.addEventListener("click", refreshLeaderboard);



  // Display levels follow the existing five package prices; no rewards are granted here.
  function membershipView(profile, records) {
    const packages = [
      {id:"pulse",name:"AI Pulse Bot v2"}, {id:"quantum",name:"Quantum Core Pro"},
      {id:"neural",name:"Neural Matrix Bot"}, {id:"cyber",name:"Cyber Forge Titan"},
      {id:"apex",name:"Apex Sentinel AI"}
    ];
    const owned = new Set(Array.isArray(profile.unlockedBots) ? profile.unlockedBots : []);
    records.forEach(record => { if (record.source === "referral" && record.awardId) owned.add(record.botId); });
    const level = packages.reduce((n,p,i) => owned.has(p.id) ? i+1 : n, 0);
    const active = packages.filter(p => records.some(r => r.botId === p.id && owned.has(p.id) && botStatus(r) === "running")).pop();
    return { verified:profile.referralStatus === "verified", level,
      name:level ? packages[level-1].name : "Starter Novice",
      active:active ? active.name : "কোনো active bot নেই" };
  }

  function renderMembership() {
    const view = membershipView(currentReferralProfile || {}, currentMiningRecords);
    const verification = view.verified ? "✓ Verified Member" : "○ Verification Pending";
    const level = "Level " + view.level + ": " + view.name;
    document.querySelectorAll(".verified-badge, .tap-member-badge").forEach(el => {
      el.textContent = verification;
      el.title = "Referral signup, প্রথম bot purchase ও Telegram channel verification সফল হলে Verified।";
      el.classList.toggle("is-verified", view.verified);
    });
    document.querySelectorAll(".level-badge, .is-level-badge, .rf-level b, .tap-member-copy small").forEach(el => { el.textContent = level; });
    document.querySelectorAll(".tier-value").forEach(el => { el.textContent = view.active; });
    document.querySelectorAll(".tap-member-level").forEach(el => { el.textContent = "LVL " + String(view.level).padStart(2,"0"); });
    document.querySelectorAll(".is-active-badge").forEach(el => { el.textContent = view.verified ? "✓ VERIFIED" : "○ PENDING"; });
  }

  function renderProfile(user, profile) {
    renderMembership();
    const name = firstName(user, profile);
    const balance = safeNumber(profile.balance);
    setText("withdrawal-balance-note", "Available: ৳" + walletMoney(balance) + " · Pending reserve: ৳" + walletMoney(profile.withdrawReserved || 0));
    const tasks = countTasks(profile.tasks);
    const referrals = safeNumber(profile.verifiedReferralCount) ?? countReferrals(profile.referrals);
    const bots = (countBots(profile.unlockedBots)||0)+(safeNumber(profile.referralBotsCount)||0);
    const displayName = [profile.name, profile.fullName, user.displayName].find(value => typeof value === "string" && value.trim()) || name;

    setText("header-user-name", String(displayName).toUpperCase());
    setText("tap-user-name", String(displayName).toUpperCase());
    setText("tap-user-initials", initials(displayName));
    setText("tap-bdt-balance", formatMoney(balance));
    walletProfile = profile || {};
    renderWalletPage();
    renderTapDailyProgress(profile);
    setText("tap-usd-balance", formatMoney(profile.usdBalance === undefined ? 0 : profile.usdBalance));
    setText("tap-referrals-value", referrals === null ? "0" : String(referrals));
    setText("feed-user-name", String(displayName).toUpperCase());
    setText("feed-user-avatar", initials(displayName));
    const collectorId = profile.collectorId || profile.collector_id || profile.referralCode || profile.referral_code || "—";
    setText("collector-id", String(collectorId));
    setText("welcome-title", "Welcome back.");
    setText("welcome-subtitle", "Good to see you, " + name + ". Your reward space is ready.");
    setText("balance-value", formatMoney(balance));
    renderHomeReferralStats();

    setText("bots-value", bots === null ? "—" : String(bots));
    setText("rank-tasks", tasks === null ? "—" : String(tasks));
    setText("rank-referrals", referrals === null ? "—" : String(referrals));
    currentUnlockedBotCount = bots;
    setText("bots-detail-count", bots === null ? "—" : String(bots));
    setText("bot-description", bots === null ? "Your profile does not yet contain a readable unlocked-bot count." : "You currently have " + bots + " unlocked " + (bots === 1 ? "bot" : "bots") + " recorded in your profile.");
    renderBotFleet();
    setText("profile-name", displayName);
    setText("profile-member-id", String(collectorId));
    const telegramName = profile.telegramUsername || profile.telegram_username || profile.telegram || "";
    setText("profile-telegram-username", telegramName ? (/^https:\/\//i.test(String(telegramName)) ? String(telegramName) : (String(telegramName).startsWith("@") ? String(telegramName) : "@" + String(telegramName))) : "Not set");
    setInputValueUnlessFocused("profile-full-name-input", displayName);
    setInputValueUnlessFocused("profile-email-input", user.email || "");
    setInputValueUnlessFocused("profile-phone-input", profile.phoneNumber || profile.phone_number || profile.phone || "");
    setInputValueUnlessFocused("profile-telegram-input", telegramName);
    setText("profile-referral-code", referralCodeFor(user, profile));
    setText('telegram-login-linked-id', profile.telegramUserId ? 'যাচাইকৃত Telegram ID: ' + profile.telegramUserId : 'আগের account-এ Telegram Login যুক্ত করতে নিচের button ব্যবহার করুন।');
    setText("profile-role-badge", profile.role === "admin" ? "🛡 ADMIN" : "🛡 USER");
    setText("profile-referral-reward", "১ verified referral = ১ free bot");
    const profilePhoto = document.getElementById("profile-photo");
    const savedAvatar = typeof profile.profileAvatar === "string" && profile.profileAvatar ? profile.profileAvatar : "";
    const defaultAvatars = ["👨🏻‍💻", "👩🏻‍💻", "👨🏽‍🚀", "👩🏽‍🚀", "🧑🏻‍🎤", "👩🏻‍🎨", "🧑🏾‍🚀", "🦸🏻‍♂️"];
    const avatarSeed = String(user.uid || displayName).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const activeAvatar = savedAvatar || defaultAvatars[avatarSeed % defaultAvatars.length];
    const photoUrl = profile.profilePhotoData || profile.photoURL || profile.photoUrl || profile.avatarUrl || user.photoURL;
    const hasPhoto = !savedAvatar && typeof photoUrl === "string" && (/^https:\/\//i.test(photoUrl) || /^data:image\/(png|jpeg|webp);base64,/i.test(photoUrl));
    if (profilePhoto) {
      if (hasPhoto) { profilePhoto.src = photoUrl; profilePhoto.hidden = false; }
      else { profilePhoto.removeAttribute("src"); profilePhoto.hidden = true; }
    }
    setText("profile-avatar", savedAvatar ? activeAvatar : (hasPhoto ? "" : activeAvatar));
    const avatarInitials = document.getElementById("profile-avatar");
    if (avatarInitials) {
      avatarInitials.hidden = hasPhoto;
      avatarInitials.textContent = hasPhoto ? "" : activeAvatar;
    }
    const headerAvatar = document.getElementById("user-avatar");
    if (headerAvatar) {
      const onlineDot = headerAvatar.querySelector(".online-dot");
      headerAvatar.textContent = hasPhoto ? "" : activeAvatar;
      if (hasPhoto) {
        const image = document.createElement("img");
        image.src = photoUrl;
        image.alt = "Profile picture";
        image.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block";
        headerAvatar.appendChild(image);
      }
      if (onlineDot) headerAvatar.appendChild(onlineDot);
      headerAvatar.style.fontSize = "23px";
    }
    document.querySelectorAll("[data-profile-avatar]").forEach(option => {
      option.classList.toggle("is-selected", option.dataset.profileAvatar === activeAvatar);
      option.setAttribute("aria-pressed", String(option.dataset.profileAvatar === activeAvatar));
    });
    setText("profile-email", user.email || "Email not available");
    setText("profile-role", String(profile.role || "member").toUpperCase());
    setText("profile-balance", "৳" + formatMoney(balance));
    setText("profile-tasks", tasks === null ? "—" : String(tasks));
    setText("profile-referrals", referrals === null ? "—" : String(referrals));

    const progress = [Boolean(user.email), Boolean(displayName), balance !== null].filter(Boolean).length / 3 * 100;
    const progressBar = document.getElementById("profile-progress");
    if (progressBar) progressBar.style.width = progress + "%";
    setText("profile-status", progress >= 100 ? "Profile loaded" : "Profile partially loaded");
    setText("dashboard-message", "Signed in securely as " + (user.email || "your account") + ". Profile values are read from your Firebase user document.");

    renderLeaderboard();
  }

  function loadUserProfile(user) {
    window.HubBotCheckout.init(db, user);
    window.HubFeed?.init(db,user);
    window.HubRecoveryUI?.init(db,auth);
    currentReferralUser=user;
    referralMembers=[];
    homeReferralState={rows:null,fromCache:false,error:false};
    renderHomeReferralStats();
    walletUser = user;
    startNotifications(user);
    startAccountActivity(user);
    window.HubReferrals.init(db,user);
    subscribeSpinRewards(user);
    if (profileUnsubscribe) profileUnsubscribe();
    if (miningUnsubscribe) miningUnsubscribe();
    if (leaderboardUnsubscribe) leaderboardUnsubscribe();
    startLeaderboardListener();

    setText("welcome-subtitle", "Loading your account…");
    setText("dashboard-message", "Loading your Firebase profile…");

    if (walletRecordsUnsubscribe) walletRecordsUnsubscribe();
    walletRecords = [];
    walletRecordsUnsubscribe = db.collection("wallets").where("uid", "==", user.uid).onSnapshot(snapshot => {
      walletRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderWalletPage();
      renderWithdrawalWalletOptions();
    }, error => {
      console.error("Linked wallet load failed:", error);
      walletRecords = [];
      renderWalletPage();
      renderWithdrawalWalletOptions();
    });
    const userRef = db.collection("users").doc(user.uid);
    walletDocRef = userRef;
    profileUnsubscribe = userRef.onSnapshot(snapshot => {
      if (!snapshot.exists) {
        const basic = { name:user.displayName || (user.email ? user.email.split("@")[0] : "Member"), role:"member", balance:0 };
        currentReferralProfile=basic;
        activityController?.updateProfile(null);
        activityController?.reportError('profile');
        walletProfile = basic;
        walletProfileAvailable = false;
        renderProfile(user, basic);
        renderWalletPage();
        renderReferralPage();
        setText("dashboard-message", "You are signed in, but your users profile document was not found. Existing account data was not changed.");
        setText("profile-status", "Profile document missing");
        setText("balance-value", "—");
        showToast("Signed in, but the user profile document was not found.");
        return;
      }
      currentReferralProfile=snapshot.data() || {};
      activityController?.updateProfile(currentReferralProfile);
      if (!/^\d{8}$/.test(String(currentReferralProfile.collectorId || currentReferralProfile.collector_id || ""))) {
        ensureCollectorId(user, currentReferralProfile).catch(error => {
          console.error("Task Reward Hub Collector ID assignment failed:", error);
          setText("dashboard-message", "Your profile loaded, but Collector ID could not be assigned. Firebase rules need to allow the Collector ID reservation.");
        });
      }
      walletProfile = currentReferralProfile;
      window.HubBotCheckout.updateProfile(walletProfile);
      window.HubReferrals.updateProfile(walletProfile);
      walletProfileAvailable = true;
      syncPublicLeaderboard(user, currentReferralProfile);
      backfillLeaderboardForAdmin(currentReferralProfile);
      renderProfile(user, currentReferralProfile);
      renderWalletPage();
      renderDepositBalance();
      updateSpinWalletDisplay();
      updateSpinCount();
      renderDepositSettings(depositSettings);
      renderReferralPage();
    }, error => {
      activityController?.reportError('profile');
      console.error("Task Reward Hub profile listener failed:", error);
      setText("dashboard-message", "Signed in, but Firebase could not read your profile. Check Firestore rules and your connection.");
      setText("profile-status", "Profile unavailable");
      showToast("Your account profile could not be refreshed.");
    });

    // Mining runs securely through GitHub Actions. This listener only displays
    // its saved earnedReward total; it never credits the wallet from the browser.
    miningUnsubscribe = userRef.collection("botMining").onSnapshot(snapshot => {
      currentMiningRecords = snapshot.docs.map(doc => Object.assign({ id:doc.id }, doc.data() || {}));
      activityController?.updateMining(currentMiningRecords);
      renderMembership();
      const total = currentMiningRecords.reduce((sum, record) => {
        const earned = safeNumber(record.earnedReward);
        return sum + (earned === null ? 0 : earned);
      }, 0);
      setText("bot-mining-value", formatMoney(Math.round((total + Number.EPSILON) * 100) / 100));
      renderBotFleet();
    }, error => {
      activityController?.reportError('mining');
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
        activityController?.stop();
        notificationsController?.stop();
        window.HubFeed?.stop();
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

