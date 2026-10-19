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
      button.addEventListener("click", () => showToast("এই বটের ক্রয় ও পেমেন্ট যাচাই সংযোগ এখনো চালু করা হয়নি। কোনো টাকা কাটা হয়নি।"));
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
    setText("wallet-usd-equivalent", "≈ $— USD · Conversion unavailable");
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
    setText("withdrawal-balance-note", "Available balance: ৳" + walletMoney(balance));
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
    list.innerHTML=rows.map(r=>'<article class="history-row"><span class="history-row-icon">'+(moneyHistoryType==="withdrawals"?"↗":"↙")+'</span><div class="history-row-main"><strong>'+escapeHtml(moneyHistoryType==="withdrawals"?"উত্তোলন":"টাকা জমা")+'</strong><small>'+escapeHtml(historyDate(r))+'</small><small>'+escapeHtml(String(r.type||r.method||r.provider||""))+'</small></div><div class="history-row-side"><strong>৳'+formatMoney(historyAmount(r))+'</strong><small class="status-'+historyStatusKey(r.status)+'">'+escapeHtml(String(r.status||"pending"))+'</small></div></article>').join("");
  }
  async function loadMoneyHistory() {
    const list=document.getElementById("money-history-list");if(list)list.innerHTML='<div class="history-empty"><span>◌</span><strong>হিস্ট্রি লোড হচ্ছে…</strong></div>';
    if(!walletUser||!db){if(list)list.innerHTML='<div class="history-empty"><strong>লগইন তথ্য পাওয়া যায়নি।</strong></div>';return;}
    const col=moneyHistoryType==="withdrawals"?"withdrawals":"walletDeposits";
    try{const snap=await db.collection(col).where("uid","==",walletUser.uid).get();moneyHistoryRows=snap.docs.map(doc=>Object.assign({id:doc.id},doc.data())).sort((a,b)=>historyDate(b).localeCompare(historyDate(a)));renderMoneyHistory();}
    catch(error){console.error("History read failed",col,error);if(list)list.innerHTML='<div class="history-empty"><strong>হিস্ট্রি লোড করা যায়নি</strong><p>Firestore permission বা connection পরীক্ষা করতে হবে।</p></div>';}
  }
  document.querySelectorAll("[data-history-type]").forEach(b=>b.addEventListener("click",()=>{moneyHistoryType=b.dataset.historyType;document.querySelectorAll("[data-history-type]").forEach(x=>{const on=x===b;x.classList.toggle("is-active",on);x.setAttribute("aria-pressed",String(on));});document.getElementById("money-history-title").textContent=moneyHistoryType==="withdrawals"?"💸 উইথড্র হিস্ট্রি":"💰 টাকা জমার হিস্ট্রি";loadMoneyHistory();}));
  document.querySelectorAll("[data-history-status]").forEach(b=>b.addEventListener("click",()=>{moneyHistoryStatus=b.dataset.historyStatus;document.querySelectorAll("[data-history-status]").forEach(x=>x.classList.toggle("is-active",x===b));renderMoneyHistory();}));
  document.querySelectorAll("[data-history-close]").forEach(b=>b.addEventListener("click",closeMoneyHistoryDrawer));
  document.getElementById("money-history-overlay")?.addEventListener("click",closeMoneyHistoryDrawer);
  document.getElementById("history-new-withdrawal")?.addEventListener("click",()=>{closeMoneyHistoryDrawer();openWithdrawalDrawer();});
  function openFullLedgerDrawer(){const o=document.getElementById("ledger-overlay"),d=document.getElementById("ledger-drawer");if(!o||!d)return;setHistoryTheme(d);o.hidden=false;d.hidden=false;document.body.classList.add("history-drawer-open");loadFullLedger();}
  function closeFullLedgerDrawer(){document.getElementById("ledger-overlay").hidden=true;document.getElementById("ledger-drawer").hidden=true;document.body.classList.remove("history-drawer-open");}
  function renderFullLedger(){
    const f=document.querySelector("[data-ledger-filter].is-active")?.dataset.ledgerFilter||"all";
    const rows=ledgerRows.filter(r=>f==="all"||(f==="money"?["withdrawals","deposits"].includes(r.kind):!["withdrawals","deposits"].includes(r.kind)));
    const list=document.getElementById("ledger-list");
    if(!list)return;
    if(!rows.length){list.innerHTML='<div class="history-empty"><span>▤</span><strong>কোনো সংরক্ষিত লেনদেন পাওয়া যায়নি</strong><p>নতুন রেকর্ড তৈরি হলে এখানে দেখাবে।</p></div>';return;}
    list.innerHTML=rows.map(r=>{
      const details=[r.detail||r.type||r.botId||""];
      if(r.kind==="deposits"&&r.trxId)details.push("Transaction ID: "+r.trxId);
      if(r.kind==="deposits"&&r.status==="pending")details.push("Admin review pending");
      if(r.kind==="deposits"&&r.status==="rejected"&&r.rejectionReason)details.push("Reject reason: "+r.rejectionReason);
      const detailMarkup=details.filter(Boolean).map(detail=>'<small>'+escapeHtml(detail)+'</small>').join("");
      return '<article class="history-row"><span class="history-row-icon">'+escapeHtml(r.icon||"•")+'</span><div class="history-row-main"><strong>'+escapeHtml(r.title||r.kind)+'</strong><small>'+escapeHtml(historyDate(r))+'</small>'+detailMarkup+'</div><div class="history-row-side"><strong>'+(["withdrawals","purchases"].includes(r.kind)?"−":"+")+'৳'+formatMoney(historyAmount(r))+'</strong><small class="status-'+historyStatusKey(r.status)+'">'+escapeHtml(String(r.status||"recorded"))+'</small></div></article>';
    }).join("");
  }
  async function loadFullLedger(){
    const list=document.getElementById("ledger-list");if(list)list.innerHTML='<div class="history-empty"><span>◌</span><strong>সব রেকর্ড খোঁজা হচ্ছে…</strong></div>';
    if(!walletUser||!db){if(list)list.innerHTML='<div class="history-empty"><strong>লগইন তথ্য পাওয়া যায়নি।</strong></div>';return;}
    const specs=[
      {name:"withdrawals",kind:"withdrawals",icon:"↗",title:"উত্তোলন",query:()=>db.collection("withdrawals").where("uid","==",walletUser.uid).get()},
      {name:"walletDeposits",kind:"deposits",icon:"↙",title:"টাকা জমা",query:()=>db.collection("walletDeposits").where("uid","==",walletUser.uid).get()},
      {name:"botPurchaseRequests",kind:"purchases",icon:"🤖",title:"Bot Purchase",query:()=>db.collection("botPurchaseRequests").where("uid","==",walletUser.uid).get()},
      {name:"task submissions",kind:"rewards",icon:"🎯",title:"Task Submission",query:()=>db.collection("submissions").where("uid","==",walletUser.uid).get()},
      {name:"botMining",kind:"rewards",icon:"⛏️",title:"Bot Mining",query:()=>db.collection("users").doc(walletUser.uid).collection("botMining").get()}
    ];
    const sets=await Promise.all(specs.map(async s=>{try{const snap=await s.query();return snap.docs.map(doc=>Object.assign({id:doc.id,kind:s.kind,icon:s.icon,title:s.title},doc.data()));}catch(error){console.warn("Ledger source unavailable",s.name,error);return [];}}));
    ledgerRows=sets.flat().sort((a,b)=>historyDate(b).localeCompare(historyDate(a)));renderFullLedger();
  }
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
      await db.collection("withdrawals").add({
        uid: walletUser.uid,
        amount,
        type: destination.type,
        number: String(destination.number),
        status: "pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      if (message) message.textContent = "Withdrawal request জমা হয়েছে। Admin review-এর জন্য অপেক্ষা করুন।";
      showToast("Withdrawal request submitted for admin review.");
      if (amountInput) amountInput.value = "";
    } catch (error) {
      console.error("Withdrawal request failed:", error);
      if (message) message.textContent = "Request জমা হয়নি। Firestore rules বা connection পরীক্ষা করে আবার চেষ্টা করুন।";
      showToast("Withdrawal request could not be submitted.");
    } finally {
      withdrawalSubmitting = false;
      if (submit) { submit.disabled = false; submit.textContent = "🚀 Confirm Payout Request"; }
    }
  });


  let currentReferralUser=null,currentReferralProfile={},referralFilter="all",referralMembers=[];
  function referralCodeFor(user,profile){const s=profile&&(profile.collectorId||profile.collector_id||profile.referralCode||profile.referral_code);if(typeof s==="string"&&/^\d{8}$/.test(s.trim()))return s.trim();return "—";}
  function renderReferralPage(){if(!currentReferralUser)return;const code=referralCodeFor(currentReferralUser,currentReferralProfile);setText("referral-code-value",code);setText("referral-link-value","https://t.me/Taskrewardhub_bot/Taka?startapp=ref-"+encodeURIComponent(code));setText("referral-member-count",referralMembers.length);setText("referral-all-count",referralMembers.length);setText("referral-verified-count",referralMembers.filter(m=>m.status==="verified").length);setText("referral-quarantine-count",referralMembers.filter(m=>m.status==="quarantine").length);setText("referral-earned-value","0.00");const q=String(document.getElementById("referral-search")?.value||"").trim().toLowerCase();const rows=referralMembers.filter(m=>(referralFilter==="all"||m.status===referralFilter)&&(!q||[m.name,m.id,m.code].join(" ").toLowerCase().includes(q)));const list=document.getElementById("referral-member-list"),empty=document.getElementById("referral-empty-state");if(list){list.hidden=!rows.length;list.innerHTML=rows.map(m=>'<article class="rf-row"><b>'+escapeHtml(initials(m.name))+'</b><span><strong>'+escapeHtml(m.name)+'</strong><small>'+escapeHtml(m.id||m.code||"Member")+'</small></span><em>'+escapeHtml(m.status)+'</em></article>').join("");}if(empty)empty.hidden=rows.length>0;if(!rows.length){setText("referral-empty-title",q?"কোনো মিল পাওয়া যায়নি":"কোনো রেফারেল পাওয়া যায়নি");setText("referral-empty-copy",q?"অন্য নাম, ID বা কোড দিয়ে খুঁজুন।":"আপনার ইনভাইট লিংক বন্ধুদের সঙ্গে শেয়ার করুন। যাচাইকৃত রেফারেল তথ্য যুক্ত হলে সদস্যদের প্রোফাইল এখানে দেখা যাবে।");}}
  function openReferralPage(){syncProfileNavigation("home");const p=document.getElementById("referral-page");if(!p){showToast("Referral interface could not be opened.");return;}document.body.classList.remove("tap-earning-active","spin-wheel-active");["spin-wheel-page","tap-earning-page","bot-shop-page"].forEach(id=>{const e=document.getElementById(id);if(e)e.hidden=true;});document.querySelectorAll("[data-panel]").forEach(e=>{e.hidden=true;e.classList.remove("is-active");});const home=document.querySelector(".home-reference-layout");if(home)home.hidden=true;p.hidden=false;document.body.classList.add("referral-page-active");document.title="Referred Members · Task Reward Hub";renderReferralPage();}
  function closeReferralPage(){const p=document.getElementById("referral-page");if(p)p.hidden=true;document.body.classList.remove("referral-page-active");showTab("home");}
  async function copyReferralValue(v,msg){try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(v);else{const t=document.createElement("textarea");t.value=v;t.style.position="fixed";t.style.opacity="0";document.body.appendChild(t);t.select();const ok=document.execCommand("copy");t.remove();if(!ok)throw Error("copy");}showToast(msg);}catch(e){showToast("কপি করা যায়নি। লিংকটি চেপে ধরে কপি করুন।");}}
  function openSpinWheel() {
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

  const spinRewards = [
    { label: "৳১০", color: "#ff625f" },
    { label: "$0.20", color: "#ff9b37" },
    { label: "৳৩০০", color: "#15b98b" },
    { label: "৳0.50", color: "#3479ff" },
    { label: "৳৫০", color: "#cf4bd9" },
    { label: "$1", color: "#f3c72f" },
    { label: "৳২০", color: "#20b9d1" },
    { label: "$0.10", color: "#a05cf5" }
  ];
  const spinStorageKey = "trh_lucky_spin_v1";
  let spinInProgress = false;
  let spinRotation = 0;

  function readSpinState() {
    try {
      const raw = JSON.parse(localStorage.getItem(spinStorageKey) || "{}");
      const today = new Date().toLocaleDateString("en-CA");
      return raw.date === today ? { date: today, used: Number(raw.used) || 0, history: Array.isArray(raw.history) ? raw.history : [] } : { date: today, used: 0, history: [] };
    } catch (_) {
      return { date: new Date().toLocaleDateString("en-CA"), used: 0, history: [] };
    }
  }

  function saveSpinState(state) {
    try { localStorage.setItem(spinStorageKey, JSON.stringify(state)); } catch (_) {}
  }

  function updateSpinCount() {
    const state = readSpinState();
    const remaining = Math.max(0, 2 - state.used);
    const count = document.getElementById("spin-count");
    const button = document.getElementById("spin-now-button");
    if (count) count.textContent = String(remaining);
    if (button) {
      button.disabled = remaining <= 0 || spinInProgress;
      button.innerHTML = remaining <= 0 ? "✓ TODAY'S SPINS USED" : '<span>▶</span> SPIN &amp; WIN NOW';
    }
  }

  function updateSpinWalletDisplay() {
    const bdt = document.getElementById("spin-bdt-balance");
    const usd = document.getElementById("spin-usd-balance");
    const current = document.getElementById("balance-value");
    if (bdt && current) bdt.textContent = current.textContent.trim() === "—" ? "0.00" : current.textContent.trim();
    if (usd) usd.textContent = "0.00";
  }

  function renderSpinHistory() {
    const list = document.getElementById("spin-history-list");
    if (!list) return;
    const history = readSpinState().history;
    if (!history.length) {
      list.innerHTML = '<p class="spin-history-empty">এখনো কোনো স্পিন খেলা হয়নি। উপরের বাটনে চাপ দিয়ে স্পিন শুরু করুন!</p>';
      return;
    }
    list.innerHTML = history.slice(0, 8).map(item => '<article class="spin-history-row"><span class="spin-history-gem">✦</span><span><strong>' + escapeHtml(item.reward) + ' · Reward preview</strong><small>' + escapeHtml(item.time) + '</small></span><span class="spin-history-tag">PREVIEW</span></article>').join("");
  }

  function runSpinWheel() {
    if (spinInProgress) return;
    const state = readSpinState();
    if (state.used >= 2) { showToast("আজকের দুটি ফ্রি স্পিন শেষ। আগামীকাল আবার চেষ্টা করুন।"); updateSpinCount(); return; }
    const disc = document.getElementById("spin-wheel-disc");
    const button = document.getElementById("spin-now-button");
    const result = document.getElementById("spin-result-message");
    if (!disc || !button) return;
    spinInProgress = true;
    button.disabled = true;
    if (result) result.textContent = "চাকা ঘুরছে… শুভকামনা!";
    const selected = Math.floor(Math.random() * spinRewards.length);
    const segmentAngle = 360 / spinRewards.length;
    const target = 360 * 5 + (360 - (selected * segmentAngle + segmentAngle / 2));
    spinRotation += target;
    disc.style.transform = "rotate(" + spinRotation + "deg)";
    const finish = () => {
      const current = readSpinState();
      current.used = Math.min(2, current.used + 1);
      const now = new Date();
      current.history.unshift({ reward: spinRewards[selected].label, time: now.toLocaleString([], { dateStyle: "short", timeStyle: "short" }) });
      current.history = current.history.slice(0, 8);
      saveSpinState(current);
      spinInProgress = false;
      if (result) result.textContent = "আপনার স্পিন ফলাফল: " + spinRewards[selected].label + " — এটি প্রিভিউ, আসল ব্যালেন্সে যোগ হয়নি।";
      updateSpinCount();
      renderSpinHistory();
      updateSpinWalletDisplay();
    };
    disc.addEventListener("transitionend", finish, { once: true });
    window.setTimeout(() => { if (spinInProgress) finish(); }, 5600);
  }

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
  ["referral-copy-link","referral-empty-copy-link"].forEach(id=>document.getElementById(id)?.addEventListener("click",()=>copyReferralValue(document.getElementById("referral-link-value")?.textContent||"","Referral link copied.")));
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
  document.getElementById("tap-main-button")?.addEventListener("click", event => {
    const button = event.currentTarget;
    button.classList.add("is-tapped");
    window.setTimeout(() => button.classList.remove("is-tapped"), 180);
    showToast("Tap reward system is not connected yet. No coins or balance were changed.");
  });
  document.getElementById("tap-sponsored-card")?.addEventListener("click", () => {
    showToast("Sponsored video ads are not connected yet. No ad reward was claimed.");
  });
  document.querySelectorAll("[data-tap-action]").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.tapAction;
      if (action === "withdraw") { openWalletPage(); return; }
      const messages = {
        invite: "Referral sharing will be connected in the Tap Earning flow.",
        ads: "Ad provider integration is not connected yet. No reward was claimed."
      };
      showToast(messages[action] || "This Tap Earning action is not connected yet.");
    });
  });

  bindFleetButtons();

  const supportToggle = document.getElementById("support-toggle");
  let supportReturnTab = "home";
  function openSupportPage() {
    syncProfileNavigation("home");
    document.body.classList.remove("deposit-page-active");
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
    const busy = document.getElementById("support-busy-toast");
    if (busy) busy.hidden = true;
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
  document.querySelectorAll("[data-support-theme]").forEach(button => {
    button.addEventListener("click", () => {
      const page = document.getElementById("support-page");
      if (!page) return;
      const theme = button.dataset.supportTheme === "oled" ? "oled" : "cyber";
      page.dataset.theme = theme;
      document.querySelectorAll("[data-support-theme]").forEach(option => {
        const active = option.dataset.supportTheme === theme;
        option.classList.toggle("is-active", active);
        option.setAttribute("aria-pressed", String(active));
      });
    });
  });
  document.getElementById("support-call-button")?.addEventListener("click", () => {
    const banner = document.getElementById("support-busy-toast");
    if (banner) {
      banner.hidden = false;
      banner.classList.remove("is-visible");
      requestAnimationFrame(() => banner.classList.add("is-visible"));
    }
  });
  document.querySelectorAll("[data-support-demo]").forEach(button => {
    button.addEventListener("click", () => showToast("Demo only — মেসেজ, ফাইল বা ভয়েস পাঠানো হবে না। যোগাযোগের জন্য WhatsApp বা Telegram ব্যবহার করুন।"));
  });
  document.getElementById("home-claim-form")?.addEventListener("submit", event => {
    event.preventDefault();
    const message = document.getElementById("home-claim-message");
    if (message) message.textContent = "Code claiming is not connected in this dashboard build yet.";
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
    if (pendingProfilePhotoData) updates.profilePhotoData = pendingProfilePhotoData;
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
    const username = raw.replace(/^@/, "");
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
    setText("rank-data-note", sorted.length ? "Live leaderboard · "+sorted.length+" registered member"+(sorted.length===1?"":"s")+" · updates automatically" : "No leaderboard members yet. Each existing account needs to sign in once to publish its rank profile.");
    filterRankRows();
  }
  function startLeaderboardListener() {
    if (leaderboardUnsubscribe) leaderboardUnsubscribe();
    leaderboardUnsubscribe = db.collection("publicLeaderboard").onSnapshot(snapshot => {
      leaderboardRows = snapshot.docs.map(doc => ({uid:doc.id,...(doc.data()||{})}));
      renderLeaderboard();
    }, error => {
      console.error("Live leaderboard listener failed:", error);
      setText("rank-data-note", "Leaderboard could not load. Please check the published Firestore rules.");
    });
  }
  async function syncPublicLeaderboard(user, profile) {
    if (!user || !profile || !db) return;
    const collectorId = String(profile.collectorId || profile.collector_id || profile.referralCode || "");
    if (!/^\\d{8}$/.test(collectorId)) return;
    const name = String(profile.name || profile.fullName || user.displayName || (user.email ? user.email.split("@")[0] : "Member")).trim().slice(0,80) || "Member";
    const bots = Array.isArray(profile.unlockedBots) ? profile.unlockedBots.length : 0;
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
  rankSearch?.addEventListener("input", filterRankRows);
  rankRefresh?.addEventListener("click", () => {
    if (rankSearch) rankSearch.value = "";
    filterRankRows();
    showToast("Leaderboard updates automatically from Firebase.");
  });


  function renderProfile(user, profile) {
    const name = firstName(user, profile);
    const balance = safeNumber(profile.balance);
    const tasks = countTasks(profile.tasks);
    const referrals = countReferrals(profile.referrals);
    const bots = countBots(profile.unlockedBots);
    const displayName = [profile.name, profile.fullName, user.displayName].find(value => typeof value === "string" && value.trim()) || name;

    setText("header-user-name", String(displayName).toUpperCase());
    setText("tap-user-name", String(displayName).toUpperCase());
    setText("tap-user-initials", initials(displayName));
    setText("tap-bdt-balance", formatMoney(balance));
    walletProfile = profile || {};
    renderWalletPage();
    setText("tap-coin-value", "0");
    setText("tap-usd-balance", "0.00");
    setText("tap-referrals-value", referrals === null ? "0" : String(referrals));
    setText("feed-user-name", String(displayName).toUpperCase());
    setText("feed-user-avatar", initials(displayName));
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
    setText("profile-member-id", String(collectorId));
    const telegramName = profile.telegramUsername || profile.telegram_username || profile.telegram || "";
    setText("profile-telegram-username", telegramName ? (String(telegramName).startsWith("@") ? String(telegramName) : "@" + String(telegramName)) : "Not set");
    setInputValueUnlessFocused("profile-full-name-input", displayName);
    setInputValueUnlessFocused("profile-email-input", user.email || "");
    setInputValueUnlessFocused("profile-phone-input", profile.phoneNumber || profile.phone_number || profile.phone || "");
    setInputValueUnlessFocused("profile-telegram-input", telegramName);
    setText("profile-referral-code", referralCodeFor(user, profile));
    setText("profile-role-badge", profile.role === "admin" ? "🛡 ADMIN" : "🛡 USER");
    setText("profile-referral-reward", "+ ৳0.00 / ref");
    const profilePhoto = document.getElementById("profile-photo");
    if (profilePhoto) {
      const photoUrl = profile.profilePhotoData || profile.photoURL || profile.photoUrl || profile.avatarUrl || user.photoURL;
      if (typeof photoUrl === "string" && (/^https:\/\//i.test(photoUrl) || /^data:image\/(png|jpeg|webp);base64,/i.test(photoUrl))) {
        profilePhoto.src = photoUrl;
        profilePhoto.hidden = false;
      } else {
        profilePhoto.removeAttribute("src");
        profilePhoto.hidden = true;
      }
    }
    setText("profile-email", user.email || "Email not available");
    setText("profile-role", String(profile.role || "member").toUpperCase());
    setText("profile-avatar", initials(displayName));
    const avatarInitials = document.getElementById("profile-avatar");
    if (avatarInitials) avatarInitials.hidden = Boolean(profile.profilePhotoData || profile.photoURL || profile.photoUrl || profile.avatarUrl || user.photoURL);
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
    currentReferralUser=user;
    walletUser = user;
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
      if (!/^\d{8}$/.test(String(currentReferralProfile.collectorId || currentReferralProfile.collector_id || ""))) {
        ensureCollectorId(user, currentReferralProfile).catch(error => {
          console.error("Task Reward Hub Collector ID assignment failed:", error);
          setText("dashboard-message", "Your profile loaded, but Collector ID could not be assigned. Firebase rules need to allow the Collector ID reservation.");
        });
      }
      walletProfile = currentReferralProfile;
      walletProfileAvailable = true;
      syncPublicLeaderboard(user, currentReferralProfile);
      renderProfile(user, currentReferralProfile);
      renderWalletPage();
      renderDepositBalance();
      renderDepositSettings(depositSettings);
      renderReferralPage();
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