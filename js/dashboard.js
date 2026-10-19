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
    document.body.classList.remove("tap-earning-active", "spin-wheel-active", "referral-page-active");
    const referralPage = document.getElementById("referral-page");
    if (referralPage) referralPage.hidden = true;
    const spinPage = document.getElementById("spin-wheel-page");
    if (spinPage) spinPage.hidden = true;
    const valid = ["home", "rank", "bots", "feed", "profile"];
    const tab = valid.includes(tabName) ? tabName : "home";
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


  let currentReferralUser=null,currentReferralProfile={},referralFilter="all",referralMembers=[];
  function referralCodeFor(user,profile){const s=profile&&(profile.referralCode||profile.referral_code||profile.collectorId||profile.collector_id);if(typeof s==="string"&&/^[A-Za-z0-9_-]{4,40}$/.test(s.trim()))return s.trim().toUpperCase();return "REF"+String(user&&user.uid||"MEMBER").replace(/[^a-zA-Z0-9]/g,"").toUpperCase().slice(0,12);}
  function renderReferralPage(){if(!currentReferralUser)return;const code=referralCodeFor(currentReferralUser,currentReferralProfile);setText("referral-code-value",code);setText("referral-link-value","https://t.me/Taskrewardhub_bot/Taka?startapp=ref-"+encodeURIComponent(code));setText("referral-member-count",referralMembers.length);setText("referral-all-count",referralMembers.length);setText("referral-verified-count",referralMembers.filter(m=>m.status==="verified").length);setText("referral-quarantine-count",referralMembers.filter(m=>m.status==="quarantine").length);setText("referral-earned-value","0.00");const q=String(document.getElementById("referral-search")?.value||"").trim().toLowerCase();const rows=referralMembers.filter(m=>(referralFilter==="all"||m.status===referralFilter)&&(!q||[m.name,m.id,m.code].join(" ").toLowerCase().includes(q)));const list=document.getElementById("referral-member-list"),empty=document.getElementById("referral-empty-state");if(list){list.hidden=!rows.length;list.innerHTML=rows.map(m=>'<article class="rf-row"><b>'+escapeHtml(initials(m.name))+'</b><span><strong>'+escapeHtml(m.name)+'</strong><small>'+escapeHtml(m.id||m.code||"Member")+'</small></span><em>'+escapeHtml(m.status)+'</em></article>').join("");}if(empty)empty.hidden=rows.length>0;if(!rows.length){setText("referral-empty-title",q?"কোনো মিল পাওয়া যায়নি":"কোনো রেফারেল পাওয়া যায়নি");setText("referral-empty-copy",q?"অন্য নাম, ID বা কোড দিয়ে খুঁজুন।":"আপনার ইনভাইট লিংক বন্ধুদের সঙ্গে শেয়ার করুন। যাচাইকৃত রেফারেল তথ্য যুক্ত হলে সদস্যদের প্রোফাইল এখানে দেখা যাবে।");}}
  function openReferralPage(){const p=document.getElementById("referral-page");if(!p){showToast("Referral interface could not be opened.");return;}document.body.classList.remove("tap-earning-active","spin-wheel-active");["spin-wheel-page","tap-earning-page","bot-shop-page"].forEach(id=>{const e=document.getElementById(id);if(e)e.hidden=true;});document.querySelectorAll("[data-panel]").forEach(e=>{e.hidden=true;e.classList.remove("is-active");});const home=document.querySelector(".home-reference-layout");if(home)home.hidden=true;p.hidden=false;document.body.classList.add("referral-page-active");document.title="Referred Members · Task Reward Hub";renderReferralPage();}
  function closeReferralPage(){const p=document.getElementById("referral-page");if(p)p.hidden=true;document.body.classList.remove("referral-page-active");showTab("home");}
  async function copyReferralValue(v,msg){try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(v);else{const t=document.createElement("textarea");t.value=v;t.style.position="fixed";t.style.opacity="0";document.body.appendChild(t);t.select();const ok=document.execCommand("copy");t.remove();if(!ok)throw Error("copy");}showToast(msg);}catch(e){showToast("কপি করা যায়নি। লিংকটি চেপে ধরে কপি করুন।");}}
  function openSpinWheel() {
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

  document.querySelectorAll("[data-tab]").forEach(button => {
    button.addEventListener("click", () => showTab(button.dataset.tab));
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
      const messages = {
        invite: "Referral sharing will be connected in the Tap Earning flow.",
        ads: "Ad provider integration is not connected yet. No reward was claimed.",
        withdraw: "Your existing wallet and withdrawal flow has not been changed."
      };
      showToast(messages[action] || "This Tap Earning action is not connected yet.");
    });
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

  document.getElementById("profile-back-home")?.addEventListener("click", () => showTab("home"));
  document.querySelectorAll("[data-profile-action]").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.profileAction;
      if (action === "referrals") {
        openReferralPage();
        return;
      }
      if (action === "support") {
        const supportToggle = document.getElementById("support-toggle");
        const supportPopover = document.getElementById("support-popover");
        if (supportToggle && supportPopover) {
          supportPopover.hidden = false;
          supportToggle.setAttribute("aria-expanded", "true");
          supportToggle.focus();
        } else {
          showToast("Customer support link is not configured in this dashboard.");
        }
        return;
      }
      const messages = {
        account:"Account details and password settings are not available in this dashboard yet.",
        wallet:"Wallet and withdrawal are not connected to this Profile menu yet.",
        ledger:"Collection history ledger is not connected to this Profile menu yet."
      };
      showToast(messages[action] || "This setting is not available yet.");
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
    setText("tap-user-name", String(displayName).toUpperCase());
    setText("tap-user-initials", initials(displayName));
    setText("tap-bdt-balance", formatMoney(balance));
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
    const telegramName = profile.telegramUsername || profile.telegram_username || profile.telegram || "@KDCARIYAN";
    setText("profile-telegram-username", String(telegramName).startsWith("@") ? String(telegramName) : "@" + String(telegramName));
    const profilePhoto = document.getElementById("profile-photo");
    if (profilePhoto) {
      const photoUrl = profile.photoURL || profile.photoUrl || profile.photoURL || profile.avatarUrl || user.photoURL;
      if (typeof photoUrl === "string" && /^https:\/\//i.test(photoUrl)) {
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
    if (profileUnsubscribe) profileUnsubscribe();
    if (miningUnsubscribe) miningUnsubscribe();

    setText("welcome-subtitle", "Loading your account…");
    setText("dashboard-message", "Loading your Firebase profile…");

    const userRef = db.collection("users").doc(user.uid);
    profileUnsubscribe = userRef.onSnapshot(snapshot => {
      if (!snapshot.exists) {
        const basic = { name:user.displayName || (user.email ? user.email.split("@")[0] : "Member"), role:"member", balance:0 };
        currentReferralProfile=basic;
        renderProfile(user, basic);
        renderReferralPage();
        setText("dashboard-message", "You are signed in, but your users profile document was not found. Existing account data was not changed.");
        setText("profile-status", "Profile document missing");
        setText("balance-value", "—");
        showToast("Signed in, but the user profile document was not found.");
        return;
      }
      currentReferralProfile=snapshot.data() || {};
      renderProfile(user, currentReferralProfile);
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