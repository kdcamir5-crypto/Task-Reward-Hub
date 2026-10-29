[Uploading README.md…]()
# Task Reward Hub — Master Project Handover & Recovery Notes

> **Purpose:** This README is the permanent project handover/reference for future maintenance and any rebuild. Read it before changing code. Preserve working Firebase, account, wallet, task, referral, redeem-code, and mining behavior unless the owner explicitly approves a change.
>
> **Important:** This document records project knowledge and the deployed Firestore rules. It is not a database backup. It does not contain user records, Firebase service-account credentials, GitHub secret values, Worker secrets, or other private keys. Never commit those secrets here.

## 1. Project identity

- **Repository:** https://github.com/kdcamir5-crypto/Task-Reward-Hub
- **Live GitHub Pages app:** https://kdcamir5-crypto.github.io/Task-Reward-Hub/
- **Firebase project ID:** `reward-hub-bd`
- **Firebase plan:** Spark/free plan; avoid features requiring billing unless the owner explicitly agrees.
- **Frontend:** static HTML, CSS and JavaScript ES modules.
- **Authentication / database:** Firebase Authentication + Cloud Firestore.
- **Automated mining:** GitHub Actions + Firebase Admin SDK, using a GitHub Actions secret.
- **User preference:** beginner-friendly, one step at a time; read the existing file before changing it; prefer complete, ready-to-replace files over snippets; do not make unrelated changes or remove working features. Explain what changed and wait for the owner's test/approval before moving to the next step.

## 2. Rebuild / reset safety rules

1. **Do not delete or reset the live Firebase project, Firestore documents, Firebase Authentication users, GitHub Actions secrets, Cloudflare Worker/D1 resources, or repository history as part of a UI rebuild.**
2. A visual rebuild should replace frontend presentation incrementally while keeping data contracts, collection names, auth session behavior, task submission IDs, bot IDs, wallet approval logic, and mining records compatible.
3. Before any backend/schema migration, take a separate export/backup of Firestore data and record a rollback plan. README documentation alone cannot restore live data.
4. Keep `firestore.rules` as the source-controlled rules file. After any rules change, test it against the actual app flows; do not loosen rules just to silence a frontend error.
5. Do not place Firebase Admin service-account JSON, private keys, postback secrets, or GitHub/Cloudflare secret values in this repository. The browser Firebase config is public client configuration, not a service-account credential.
6. Preserve a working checkpoint/branch or Git tag before a large redesign. Rebuild in small, reviewable commits and validate each page and critical feature.

## 2A. Pre-rebuild backup and recovery plan

### Repository checkpoint

- A rollback branch was created before any full rebuild work: `backup/pre-rebuild-2026-10-18`.
- It points to the repository state at commit `2b40de1bf3531b65ab54c68f8de653873745b194`, including the source files and the expanded project README / Firestore rules snapshot.
- Do not delete this branch. Build the replacement app on a separate branch (for example, `rebuild/new-app`) and merge only after review and acceptance.
- The live GitHub Pages app should continue using `main` until the owner explicitly approves switching the deployed version.

### Important backup status

**Repository checkpoint: CREATED. Firestore live-data export: NOT YET CREATED. Firebase Authentication user export: NOT YET CREATED. Cloudflare Worker/D1 backup: NOT YET CREATED. GitHub Actions secret values are intentionally not copied.**

The GitHub connector used for this repository cannot, by itself, prove that live Firestore user data or Firebase Auth users have been exported. Do not call those systems backed up until their exports have been downloaded and checked separately.

### Required backups before switching production

1. **Firestore data:** In Firebase Console, open the correct project (`reward-hub-bd`) and confirm the project ID. Use an authorized Google Cloud/Firebase backup/export method to export the Firestore database to a private Cloud Storage bucket or another supported backup destination. Download/retain the export metadata and record the date. A Firestore managed export generally requires a billing-enabled Google Cloud project/bucket; do not enable billing or incur charges without the owner's explicit approval. If using a manual collection-by-collection export tool instead, verify all collections and subcollections, including each `users/{uid}/botMining/{botId}` subcollection.
2. **Firebase Authentication:** Use Firebase/Google Cloud's supported user export method to save the authentication user list securely. This does not export passwords in recoverable plaintext; account recovery may require password resets. Keep this export private.
3. **Firestore rules:** Preserve `firestore.rules` in GitHub and compare the deployed Firebase Console rules with this file. Save a dated copy if they differ. README's embedded rules are a reference copy; the standalone file is canonical for this repository.
4. **GitHub configuration:** Record workflow names, schedules, required secret *names*, repository settings, and deployment settings. Do not copy secret values into README. Secret values may need to be re-entered by the owner if recreating a repository or environment.
5. **Cloudflare / Monetag:** Separately export or copy the Worker source, D1 schema/data, bindings, routes, and required secret *names* from the Cloudflare account. Do not put private-key or postback-secret values into GitHub.
6. **Recovery validation:** Keep the exports private and test restoration in a separate non-production Firebase project before touching production. A backup file is not proven usable until its restore process is checked.
7. **Go-live gate:** Do not change the GitHub Pages production entry point, production Firebase configuration, Firestore schema/rules, or live data until the owner approves the tested replacement and confirms the backups are complete.

### Rebuild sequence

1. Keep `main` and `backup/pre-rebuild-2026-10-18` untouched as recovery references.
2. Create a separate rebuild branch.
3. Build the new front end and test navigation/responsiveness first, using a non-production test setup wherever possible.
4. Reconnect existing Firebase services only after confirming the data model and auth flows.
5. Test all critical user and admin workflows using test accounts and non-production data.
6. Compare behavior against the feature checklist in this README.
7. Ask the owner for acceptance. Deploy to production only after explicit approval.
8. If the new app fails, restore the previous published commit/branch and revert any separately approved backend changes. Do not restore old code over newer live user data without reviewing data compatibility.

## 3. Product design direction

- Mobile-first, phone-width app, consistent page frame and header/navigation proportions across all pages.
- Latest accepted visual direction: **Premium Deep Navy + Neon Blue**, polished and professional; dynamic subtle moving neon/star/light effects were requested across pages.
- User wants all pages to share consistent proportions with Home.
- User prefers small, clean cards and no placeholder/unprofessional copy.
- Keep the main user app separate from admin-only functionality; the admin page may exist in the repository but must not be mixed into the user-facing navigation unless explicitly requested.
- Keep navigation tab positions identical on every page. Current reported bug: when Home → Community (`pages/feed.html`), Home disappears/slides sideways, Profile shifts toward Community, and empty spaces appear. Several conflicting old navigation CSS overrides exist in `css/shared-shell.css`, `css/theme-home.css`, and `css/compact-ui.css`. This remains **unverified/unresolved**; inspect actual DOM/CSS before further changes. Do not claim it is fixed without testing.
- Recent CSS-only attempts have added multiple navigation override blocks at the end of `css/shared-shell.css`. Prefer consolidating/removing conflicting rules after inspecting all pages rather than appending more overrides blindly.
- Shared shell script: `js/shared-shell.js`; shared shell CSS: `css/shared-shell.css`.

## 4. Authentication and profile

- Firebase Authentication is used for the main app session.
- Shared auth/session helpers include `js/fb-auth.js`, `js/auth.js`, and `js/guard.js`; read these before touching login/logout/route protection.
- Owner's latest request: after admin signs in once, keep the session when leaving/reopening the app until the admin explicitly signs out. Check Firebase Auth persistence and ensure explicit Sign Out still ends the session. Never store plaintext passwords to implement persistence.
- User profile data lives under `users/{uid}`; observed/used fields include `role`, `balance`, `tasks`, `referrals`, `unlockedBots`, and profile fields such as `name`, `phone`, and `telegram`. Other timestamps/fields may be present.
- Profile picture/avatar upload and ready-made male/female avatars were requested; inspect `js/avatar-picker.js` and `js/profile.js` before modifying this area.

## 5. Firestore collections and data contracts

Collections/paths known from the current rules and app work:

- `users/{uid}`: user profile, role, wallet balance, task/referral counters, unlocked bot IDs.
- `users/{uid}/botMining/{botId}`: one mining record per user and bot.
- `tasks/{taskId}`: task definitions; admin-managed.
- `submissions/{uid_taskId}`: user task proof submission; deterministic ID is user UID + underscore + task ID.
- `wallets/{walletId}`: user's payout/payment wallet details (bKash, Nagad, Rocket).
- `withdrawals/{withdrawalId}`: pending payout requests; admin reviews and sets paid/rejected.
- `walletDeposits/{depositId}`: wallet top-up requests with sender number and transaction ID; admin approves/rejects.
- `botPurchaseRequests/{requestId}`: bot purchase requests using wallet, bKash, or Nagad; admin approves/rejects.
- `botRedeemCodes/{codeId}`: bot-specific redeem codes, expiry and one-time use metadata.
- The rules deny all unmatched documents by default.

### User profile / role

- Admin authorization in Firestore rules is based on `users/{uid}.role == 'admin'`.
- User-created profile is constrained to role `user`, initial balance 0, task counter 0 and referral counter 0.
- User self-service profile updates are limited to `name`, `phone`, and `telegram`.
- Redeem-code unlocking uses `unlockedBots`, `lastRedeemCode`, `updatedAt` plus a coordinated one-time update of the matching redeem-code document.
- Admin operations are permitted by the current rules; any admin client code still needs safe transaction/validation logic.

### Task submissions

- Submission fields permitted by rules: `uid`, `email`, `taskId`, `taskTitle`, `reward`, `proof`, `image`, `status`, `createdAt`.
- Initial status must be `pending`; task must be active and the reward must match the task document.
- Proof text max length 300; image field max length 450000; at least 3 characters of proof or 1000 characters of image data.
- Admin reviews submissions.

### Wallet / deposits / withdrawals

- Payment types for saved wallet and withdrawals: bKash, Nagad, Rocket.
- Bangladesh phone number format checked by rules: `^01[3-9][0-9]{8}$`.
- Withdrawal amount currently constrained to 100–5000; initial status pending. Admin review can set paid/rejected.
- Deposit requests currently support bKash/Nagad, amount 10–50000, transaction ID length 5–100, initial status pending.
- Bot purchase requests use wallet, bKash, or Nagad. External payment requests require sender number and transaction ID. Wallet purchase leaves these two fields empty.
- User-tested earlier: wallet withdrawal requests and admin approve/reject worked; approval should be idempotent and balance deduction/credit must be transaction-safe. Deposit approval should add funds only once; bot-purchase approval should unlock only the requested bot and wallet payment should deduct the correct price only once.

## 6. AI Bot Shop — package IDs, prices and mining behavior

Keep bot IDs exactly as listed; they are referenced by Firestore rules and the mining worker.

| Bot ID | Display name | Price | Target return | Bonus display | Referral commission display |
|---|---|---:|---:|---:|---:|
| `pulse` | AI Pulse Bot v2 | 50 | 80 | 0.10 | 2.5 |
| `quantum` | Quantum Core Pro | 100 | 160 | 0.20 | 5 |
| `neural` | Neural Matrix Bot | 200 | 320 | 0.40 | 10 |
| `cyber` | Cyber Forge Titan | 300 | 480 | 0.60 | 15 |
| `apex` | Apex Sentinel AI | 500 | 800 | 1.00 | 25 |

> Currency/display units should follow the existing app UI and code; confirm before changing units. The owner described the target returns as 160% of package price. Do not change these economics without explicit approval.

- A verified referral is intended to unlock one free mining bot (one verified referral = one free bot unlock). Preserve/verify the existing referral verification source and anti-duplicate behavior before rebuilding.
- Bot redeem code is bot-specific: each code unlocks only the matching bot; code expiry is 30 minutes (1,800,000 ms); a code is intended for one use.
- Owner requested five separate random redeem-code generators in the admin panel, one per bot, plus a Telegram message/support link.
- Bot shop UI preference: two bot cards per row on phone width around 390–420 px; 5 bots total; compact cards show bot name, mining rate, referral commission, bonus and price. Redeem box, admin message link and code input should live inside “Package details”. Replace large live-mining card content with a single blue “bot live mining dekhun” action and blinking green LIVE dot that opens the existing live mining view. Keep the live mining view working.
- Mining record example previously observed: bot ID `pulse`, `durationDays: 30`, `earnedReward: 0.03`, `targetReward: 80`, `status: running`.
- Owner confirmed the GitHub Actions auto-mining worker has triggered and credited rewards successfully in prior testing.

## 7. Automated mining (critical backend behavior)

Workflow: [Secure Auto Mining](.github/workflows/auto-mining.yml). Worker: [`scripts/auto-mining.js`](scripts/auto-mining.js).

- The workflow runs on matching code pushes, manual Run workflow, and a five-minute schedule (`3-59/5 * * * *`). GitHub may delay scheduled runs; this is settlement in intervals, not a continuously running server.
- Node.js 24 on Ubuntu 24.04 with checkout/setup-node v5 and Firebase Admin SDK 13.6.0. Uses the existing `FIREBASE_SERVICE_ACCOUNT` Actions secret for project `reward-hub-bd`; no credentials belong in source or logs.
- Only existing supported `unlockedBots` IDs are eligible: pulse, quantum, neural, cyber, apex. Package targets are 80/160/320/480/800 BDT over 30 days, as specified in section 6.
- A missing eligible record starts at the worker's current time with zero earned; missing history is never used to invent backpay. Existing valid records retain their original `startedAt`, duration and saved earnings.
- For a running record, compute elapsed accrual in integer paisa, rounded to two decimal places and capped at its configured target. Subtract already credited `earnedReward`. Atomically increment the actual user `balance` by only the positive difference and update the mining record in one Firestore transaction.
- Downtime is caught up from the preserved start time, up to the 30-day target. Repeated/concurrent runs cannot credit twice, and corrected clocks cannot reduce earnings. Completed/stopped/paused/pending/error records are not restarted or paid again.
- A record reaching its target is marked completed. Invalid start times become `error` with `INVALID_START_TIME` without wallet credit. Mismatched targets/durations, malformed progress/balances and unsupported legacy data are skipped and counted for review; balances/progress are never reset to silence an error. Legacy record IDs are retained; duplicate records for the same package are skipped for review instead of starting or paying a second miner.
- The existing UI listens to the committed profile and mining documents. BDT mining credits go into Main Balance; USD balances and other profile fields are preserved. No browser-generated income is credited.
- Workflow output `MINING_SUMMARY` includes aggregate profile/bot counts, records created/credited/completed, credited paisa and invalid/error counts. It never logs account IDs, private records or credentials.
- `npm run test:mining` runs 18 isolated Firestore emulator integration tests in project `demo-trh-mining`, including all packages, catch-up, retries, concurrent workers, completion, missing records and invalid data.
- No new Firestore rules are needed for this worker: Firebase Admin SDK performs the trusted transaction server-side. Keep the currently deployed client rules restricted.

Current workflow:

```yaml
name: Secure Auto Mining
on:
  workflow_dispatch:
  schedule:
    - cron: '3-59/5 * * * *'
  push:
    branches: [main]
    paths:
      - .github/workflows/auto-mining.yml
      - scripts/auto-mining.js
permissions:
  contents: read
concurrency:
  group: secure-auto-mining
  cancel-in-progress: false
jobs:
  mine:
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: '24'
      - name: Install Firebase Admin SDK
        run: npm install --prefix "$RUNNER_TEMP/mining-worker" --ignore-scripts --no-audit --no-fund firebase-admin@13.6.0
      - name: Process secure mining rewards
        env:
          FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          NODE_PATH: ${{ runner.temp }}/mining-worker/node_modules
        run: node scripts/auto-mining.js
```

## 8. Tasks and current static sample data

The current static task sample in `js/tasks-data.js` is:

```javascript
// tasks-data.js - টাস্কের তালিকা। পরে অ্যাডমিন প্যানেল থেকে Firebase-এ যাবে।
const TASKS = [
  { id: 't1', title: 'Telegram চ্যানেলে জয়েন করুন', desc: 'অফিসিয়াল চ্যানেলে জয়েন করে স্ক্রিনশট নিন।', reward: 2, proof: 'স্ক্রিনশটের লিংক বা ইউজারনেম লিখুন' },
  { id: 't2', title: 'একটা অ্যাপ রিভিউ লিখুন', desc: 'নির্দিষ্ট অ্যাপে ১০০ অক্ষরের সৎ রিভিউ দিন।', reward: 5, proof: 'রিভিউয়ের লিংক বা স্ক্রিনশট' },
  { id: 't3', title: 'ছোট সার্ভে পূরণ করুন', desc: '৫টা প্রশ্নের সার্ভে শেষ করুন।', reward: 3, proof: 'সার্ভের শেষে পাওয়া কনফার্মেশন কোড' }
];
```

Current task samples are:
- Telegram channel join proof — reward 2.
- App review — reward 5.
- Short survey — reward 3.

The code comment says these are a static list intended to move to Firebase/admin management later. Check `js/tasks.js`, `js/admin.js`, and `pages/tasks.html` before deciding which source is authoritative; do not silently remove existing task functionality.

## 9. Other features present in the repository

Feature/page files currently present:
- Home/dashboard: `pages/dashboard.html`, `js/dashboard.js`, `js/home-live.js`.
- Task list and proof submission: `pages/tasks.html`, `js/tasks.js`, `js/tasks-data.js`.
- Wallet/deposit/withdrawal: `pages/wallet.html`, `js/wallet.js`.
- Admin review and management: `pages/admin.html`, `js/admin.js`, `js/admin-ui.js`.
- AI Bot Shop: `pages/mining-robot.html`, `js/mining-progress.js`.
- Profile and avatars: `pages/profile.html`, `js/profile.js`, `js/avatar-picker.js`.
- Community/feed: `pages/feed.html`, `js/feed.js`.
- Leaderboard/rank: `pages/leaderboard.html`, `js/leaderboard.js`.
- Achievements: `pages/achievements.html`, `js/achievements.js`.
- Rewards/code redemption page: `pages/rewards.html`, `js/rewards.js`, `js/codes-data.js`.
- Lucky Spin: `pages/spin.html`, `js/spin.js`.
- Daily Streak: `pages/streak.html`, `js/streak.js`.
- Mystery Box: `pages/mystery-box.html`, `js/mystery-box.js`.
- Notifications: `pages/notifications.html`, `js/notifications.js`.
- Shared authentication/session: `js/fb-auth.js`, `js/auth.js`, `js/guard.js`, `js/storage.js`.
- Shared layout: `js/shared-shell.js`, `css/shared-shell.css`.
- Theme/UI styles: multiple page stylesheets under `css/`.
- Root entry: `index.html`.

**Important feature distinction:** the current Lucky Spin, Daily Streak and Mystery Box JavaScript explicitly describes their rewards as browser-local virtual XP only, not cash and not wallet balance. Do not present these as real-money rewards unless the owner explicitly approves a secure backend redesign.

## 10. Monetag reward integration / external worker notes

Prior project work also configured a Cloudflare Worker and D1 for Monetag postback/rewards:
- Worker name: `task-reward-hub-monetag-rewards`.
- D1 binding name: `REWARDS_DB`, bound to D1 database `task-reward-hub-rewards`.
- Production setting `ON` was reported as enabled.
- Worker health checks previously reported Firebase project, service account, postback secret and D1 as configured.
- Endpoints used: `/postback` for postback and `/ad-session` to create ad sessions.
- A previously observed issue: reward processing returned `Firebase service authorization failed`. Check Worker secret/binding names and service account IAM/project permissions if this reappears.
- Required Worker environment/secret names reported: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`; keep secret values outside GitHub README and public files.
- Do not assume this external Worker source is inside this repository; the exact Worker source/config must be backed up separately from Cloudflare if a complete infrastructure restore is required.

## 11. Firebase Security Rules — deployment source

The complete current rules are in [`firebase.rules`](firebase.rules). Publish that entire file in Firebase Console → Firestore Database → Rules. GitHub Pages deployments do not publish Firestore rules. The historical snapshot below predates the current purchase workflow; do not deploy it.

The authoritative deployable rules are in [`firebase.rules`](firebase.rules). Copy the entire current file into Firebase Console → Firestore Database → Rules and Publish. Do not deploy an older README snippet.


## 12. Current source tree

The following files were present in the repository when this README was prepared:

`.github/workflows/auto-mining.yml`, `README.md`, `css/achievements.css`, `css/admin.css`, `css/base.css`, `css/bot-shop.css`, `css/compact-ui.css`, `css/dashboard.css`, `css/feed.css`, `css/home.css`, `css/leaderboard.css`, `css/login.css`, `css/mystery-box.css`, `css/notifications.css`, `css/profile.css`, `css/rewards.css`, `css/shared-shell.css`, `css/spin.css`, `css/streak.css`, `css/tasks.css`, `css/theme-home.css`, `css/wallet.css`, `firestore.rules`, `index.html`, `js/achievements.js`, `js/admin-ui.js`, `js/admin.js`, `js/auth.js`, `js/avatar-picker.js`, `js/codes-data.js`, `js/dashboard.js`, `js/fb-auth.js`, `js/feed.js`, `js/firebase-config.js`, `js/guard.js`, `js/home-live.js`, `js/leaderboard.js`, `js/login.js`, `js/mining-progress.js`, `js/mystery-box.js`, `js/notifications.js`, `js/profile.js`, `js/rewards.js`, `js/shared-shell.js`, `js/spin.js`, `js/storage.js`, `js/streak.js`, `js/tasks-data.js`, `js/tasks.js`, `js/wallet.js`, `pages/achievements.html`, `pages/admin.html`, `pages/dashboard.html`, `pages/feed.html`, `pages/leaderboard.html`, `pages/mining-robot.html`, `pages/mystery-box.html`, `pages/notifications.html`, `pages/profile.html`, `pages/rewards.html`, `pages/spin.html`, `pages/streak.html`, `pages/tasks.html`, `pages/wallet.html`, `scripts/auto-mining.js`

## 13. Known risks / items to verify before a clean rebuild

- [ ] Fix and browser-test the shifting bottom navigation (especially Home → Community); inspect conflicting CSS and actual DOM rather than appending more override blocks.
- [ ] Confirm Firebase Auth persistence for admin/user and explicit logout behavior; never store plaintext passwords.
- [ ] Confirm current Home, Community, Profile, AI Bot Shop and Wallet page layout before restyling.
- [ ] Regression-test task submission and admin approval.
- [ ] Regression-test deposit approval and one-time balance credit.
- [ ] Regression-test withdrawal approval/rejection and one-time balance deduction.
- [ ] Regression-test wallet bot purchase (one-time deduction) and bKash/Nagad bot purchase (transaction ID review).
- [ ] Regression-test bot-specific redeem codes: correct bot only, 30-minute expiry, one-time use.
- [ ] Regression-test verified-referral free bot unlock.
- [ ] Regression-test auto-mining creation, incremental credits, completion, and repeat-run idempotency.
- [ ] Confirm Monetag postback authorization separately in Cloudflare Worker.
- [ ] Test all interactive pages on mobile viewport and desktop.
- [ ] Check console/network errors and ensure no broken page links after each commit.
- [ ] Keep virtual XP features clearly separate from wallet/cash balances.
- [ ] Export Firestore data separately before any schema reset/migration.

## 14. Change management rule for future work

Before changing a file:
1. Read the full current file and relevant dependencies.
2. State which files will change and which behavior must remain untouched.
3. Make one small change at a time and commit it.
4. Verify the changed file was committed and run the relevant UI/feature test.
5. Ask the owner to test the live page where browser testing is unavailable.
6. Update this README when a feature, schema, rule, secret name, workflow, known issue, or important design decision changes.

---

**Prepared from the current repository snapshot and previously recorded project decisions.** Some details describe previously tested behavior or owner requirements; they are not a guarantee that every current UI element has been independently browser-tested. Keep this file updated as implementation evolves.



## 2026-10-24 — Bot checkout and payment review

- Bot Shop uses the five package IDs/prices/returns in section 6: pulse 50/80, quantum 100/160, neural 200/320, cyber 300/480, apex 500/800. Other than Pulse's requested 14.8 MH/s display, unverified hashrates are not invented.
- “সক্রিয় করুন” opens a scoped checkout with actual Firestore wallet balance, package calculations, referral verification and Wallet/bKash payment choices. Existing shared header and navigation are retained.
- Wallet purchases atomically deduct the exact price, append the bot ID, create its zero-earned 30-day mining record and credit a verified referrer 5%. They never credit the buyer with the target return upfront.
- Direct bKash uses `appSettings/paymentSettings`, records the receiving number and reserves the TRX across both deposits and bot purchases. Requests stay pending until an admin verifies the actual payment and approves in Task-Reward-Hub-Admin → Bot Purchases. Approval unlocks the bot and credits a referrer once; it does not also credit the buyer wallet.
- Admin → Deposits can approve/reject ordinary deposits. An approval credits the wallet once; a rejection requires a reason.
- Order ID is `uid_botId`, matching the existing one-unlock-per-package array. Rejected orders can be resubmitted with a fresh unused TRX. Existing unlocked packages/mining records are never overwritten by checkout.
- Referrer UID/Collector ID is retained after a purchase and cannot be switched by the buyer. Existing `purchaseReferrerUid`, `referredByUid` or `referrerUid` records are respected. This signup version does not record a referrer; when no referral link is stored, checkout lets the buyer enter and verify a real public Collector ID. Missing referral data is never replaced with demo data. Only the minimal public leaderboard record is used for lookup.
- Dollar bonuses remain a USD display from the package reference. No BDT conversion or immediate dollar wallet credit is invented. Mining reward settlement still depends on the existing trusted mining worker; checkout does not mint mining returns in the browser.
- **Required deployment:** publish the current [`firebase.rules`](firebase.rules) to Firebase project `reward-hub-bd`. Old rules intentionally reject instant wallet purchases. No live Firestore data is migrated or deleted.
- Tests: `npm install` then `npm run test:purchases` (Node 20+, Java 17+). The suite uses an isolated `demo-trh-purchase` emulator project and covers 20 purchase/security cases; it never uses live account balances.


## 2026-10-24 — Real Lucky Spin rewards

- Lucky Spin no longer uses `localStorage` results or browser-selected prizes. Local preview history is not imported or credited.
- Two free spins per account per Bangladesh day. Original eight equal-probability segments are preserved: ৳10, $0.20, ৳300, ৳0.50, ৳50, $1, ৳20, $0.10. There is no spin fee or BDT/USD conversion.
- BDT prizes increase `users/{uid}.balance`; USD prizes increase the separate `usdBalance` field. Missing `usdBalance` means zero until the first real USD award. Spin, Wallet and the existing USD balance card display this same Firestore USD balance.
- `.github/workflows/prepare-spin-rewards.yml` runs `scripts/prepare-spin-rewards.cjs` using the existing repository secret `FIREBASE_SERVICE_ACCOUNT` for Firebase project `reward-hub-bd`. The secret must contain service-account JSON with Firestore access. Never put it in client code, README, workflow text or chat.
- The trusted worker uses Node crypto randomInt to prepare exactly two immutable outcomes per user per day, three days ahead, in `users/{uid}/spinTickets/{day}_{slot}`. It only creates missing tickets; it never changes a previously prepared/claimed outcome or credits wallet balances.
- Provisioning runs on worker-code pushes, manual workflow runs and a five-minute schedule. A new account's tickets appear after the next successful run; existing accounts normally already have today's tickets. GitHub scheduling is not an exact-time guarantee. When no ticket is prepared, the UI waits and does not award a client-generated substitute.
- The worker checks all existing accounts once per Bangladesh day. Other runs scan only accounts created since the previous run, with a one-minute overlap. `systemState/spinProvisioning` stores this cursor and is inaccessible to client writes. Counts-only logs never show credentials or individual prizes.
- Claiming a prepared ticket and crediting its exact BDT/USD award happen in one Firestore transaction. Rules prohibit client-created tickets, edits to prizes, expired/future claims, replay, cross-currency credits and arbitrary balance updates. The ticket receipt recovers safely after a lost response or simultaneous claims from two tabs.
- The same Firestore listeners update balances/history across devices. History shows only committed ticket receipts. Animation points to the backend-selected segment and completion is guarded against duplicate transition/timer callbacks.
- Deployment: publish the complete current `firebase.rules` in Firebase Console. Check GitHub Actions → Prepare secure spin rewards → prepare for successful provisioning. If the existing service-account secret is absent, configure it in repository Settings → Secrets and variables → Actions, then use Run workflow. No billing-dependent Cloud Function is required.
- Tests: `npm run test:spin` covers 13 integration cases in the isolated `demo-trh-spin` emulator project, including trusted-worker idempotency/new accounts. `npm run test:purchases` retains the 20 bot/deposit regression checks.



## 2026-10-25 — Automatic verified referrals and purchased-bot USD bonuses

Requirements implemented in this checkpoint:
- A referral starts only when a NEW account signs up through the referrer's link. The signup batch binds the actual public Collector ID/UID and creates `referrals/{inviteeUid}` as pending. Existing accounts are not silently reassigned or retroactively counted.
- Current verification (updated 2026-10-29) requires BOTH: attributed signup and a verified Telegram identity that is a member of **@freelancing_incom**. No manual admin referral approval is used. A referral link click or client-side join button is not proof.
- Each verified person awards ONE independently mining bot. Ordinals 1–20: Pulse (50); 21–40: Quantum (100); 41–60: Neural (200); 61–80: Cyber (300); 81–100: Apex (500). Ordinals 101–120 start again at Pulse; the cycle repeats every 100, not every 20 referrals.
- `referralAwards/{inviteeUid}` is the immutable one-time award ledger. Award creation, the verified counter, referral bot count and new mining instance are one Firestore transaction. Retry and concurrent workers cannot duplicate the award. These are zero-cost referral rewards, not purchase requests or wallet cash credits.
- Referral bots use distinct `users/{referrerUid}/botMining/referral_{inviteeUid}` records with source and ledger references. They do not consume the one-owned-package purchase slot in `unlockedBots`; twenty Pulse instances can mine independently. Mining validates each referral award ledger. Rank counts purchased bots plus server-maintained `referralBotsCount`.
- New purchases atomically add their package USD bonus to `usdBalance` once: 0.10/0.20/0.40/0.60/1.00 for the five packages. Direct bKash credits only on approval. The receipt stores `usdBonus` and `usdBonusCredited`. A pending request, rejection, retry or free referral award does not credit USD. Previously approved old purchases are not silently backfilled.
- Referral page shows real pending/verified members and the invitee's two verification conditions. Main header/navigation markup is retained. Home mining status reflects saved mining records; rank no longer resets itself to an obsolete placeholder.

### Telegram verification deployment

1. Use a dedicated verification bot from BotFather and add it as an administrator of **@freelancing_incom**.
2. Store that bot's token ONLY in repository Actions Secret **TELEGRAM_VERIFICATION_BOT_TOKEN**. Keep the existing **FIREBASE_SERVICE_ACCOUNT** secret for project `reward-hub-bd`. Never paste either secret into public files or chat.
3. Publish the full current `firebase.rules` from this repository in Firebase Console → Firestore Database → Rules. Refresh the user app and admin panel after publishing.
4. Run Actions → **Verify referrals and award bots**. The workflow also runs on worker-code pushes and at `1-59/5 * * * *`. GitHub schedules may be delayed. A missing Telegram secret reports SETUP_REQUIRED and awards nothing; external membership has not been live-tested until configured.
5. Users tap “Telegram account যাচাই করুন”, press Start in that verification bot, then return to the app. A private random expiring challenge links the Telegram account to the signed-in Firebase UID; user-entered usernames/IDs and unverified Telegram initData are never accepted as identity proof. One Telegram identity cannot verify multiple Firebase accounts.

The worker uses Telegram getMe/getWebhookInfo/getUpdates/getChatMember. It refuses a bot with an existing webhook, never deletes a webhook and sends no Telegram messages. Use a separate verification bot instead of interfering with an existing bot's webhook/poller. Telegram identities and poll state are private server data. Link challenges are private to their owner and expire in fifteen minutes. Client rules prohibit writing verification flags, identity ownership, award ledgers and referral bot counters.

Tests: `npm run test:referrals` covers 13 new emulator/security cases; the existing purchase suite additionally checks USD bonuses. Purchase/mining/spin suites remain regression checks. Both repositories mirror `bot-purchase-core.js` and must be updated together.

Outstanding from the broader demo audit: full in-app Support chat/calls, Community Feed publishing, Telegram authentication and profile-save rule mismatches still require their own implementation. Later checkpoints below implement notifications and reward-code claiming. This checkpoint does not claim those features are complete.

### Live membership displays
- Header, Home Active Tier, Tap, Referral and Profile badges now share the same live profile/mining data.
- Verified Member requires the trusted worker's `referralStatus: verified` (both referral verification conditions). Firebase login or owning a bot alone does not verify membership. Unverified accounts display Verification Pending.
- Display Level 0 = Starter Novice with no owned package; Levels 1–5 follow the highest owned package: Pulse, Quantum, Neural, Cyber, Apex. Referral-awarded mining instances are included; level is a display only and does not change rewards. Completed owned bots still count toward level.
- Active Tier uses the highest owned package with a running mining record; otherwise it shows no active bot. Bot ownership without a running record does not claim active mining.

### Tap Invite and reserved withdrawals (2026-10-25)
- Tap → Invite Friends now opens the existing Referral interface; the shared header and five-tab navigation are retained.
- New withdrawal requests (BDT 100–5,000, whole taka) atomically subtract the amount from available `users.balance`, add it to `withdrawReserved`, and set `activeWithdrawalId`. The destination must match the owner's saved wallet. Only one reserved request can be pending per account.
- Admin → Withdrawals now has real Details, Mark Paid and Reject actions. Paid requires confirmation of the actual external transfer and a payment reference. It releases the reserve without another debit. Reject requires a reason and refunds the reserve exactly once. This does not initiate an external MFS payment.
- Legacy requests have no reserve: rejection does not credit money; paid settlement deducts once from current available balance and fails if insufficient. No historical requests are silently changed.
- User/admin use the same `withdrawal-core.js`; Firestore rules independently require atomic reservation/settlement and prohibit client self-approval or forged refund. Invalid/double/concurrent operations are rejected. Receipt fields remain visible in history/admin.
- Deployment: publish the current `firebase.rules` after this update. New requests fail closed until those rules are published. No service-account or Telegram secret changes are needed.
- Integration check: `npm run test:withdrawals`. This checkpoint implements Invite and withdrawal settlement; Support, Feed, code claiming, full activity, notifications and Telegram login remain separate work.

### Live Recent Activity and Collection Ledger (2026-10-25)
- Home Recent Activity now displays the latest five available dated records. View Ledger opens the existing Collection History Ledger drawer instead of navigating to Feed. Profile's ledger opens the same drawer.
- `js/activity-core.js` reads only the signed-in user's deposit, withdrawal, purchase, task-submission, claimed spin-ticket and referral-award records with live Firestore listeners. Existing profile/mining listeners supply commission and mining totals without duplicate mining queries. Listeners stop on sign-out and are replaced when an account changes.
- Ledger includes completed/pending/rejected and money/reward filters, a Refresh / Retry action, numeric timestamp ordering in Bangladesh time, and visible cache/partial-source errors. A failed source is not silently presented as an empty complete history.
- BDT, USD and free-bot units are separate. Approved wallet purchases show wallet debits; direct bKash purchases are labelled external payments. USD bonuses require the saved credited receipt. Pending/rejected payments do not claim wallet income; reserved withdrawal rejection shows its refund, while legacy rejection does not.
- Existing mining documents are cumulative per bot, not a credit-by-credit journal: they are explicitly labelled total earned. The profile's referralEarnings is a cumulative 5% commission total with no invented transaction time and is excluded from Recent Activity. Referral free-bot awards are shown separately. Task submissions are labelled requests, not proof that cash was credited. No missing historical credit records or ad receipts are fabricated. This is an activity view, not a recalculation of the wallet balance.
- Read-only change: no new balance writes, rules or Firebase secrets. Uses existing owner-only read permissions. Header/navigation HTML is unchanged; styles are scoped to activity and ledger content.
- Validation: 14 activity projection/subscription tests; browser checks for routing, currency, escaping, filters, partial-source failures and 320/390/420px layouts. Run `npm run test:activity`.

### In-app Notifications / Alerts (2026-10-25)
- Header's fixed 3 is removed. Header and Home Alerts open a dedicated Notifications page while retaining the shared header and five-tab navigation. Unread count is derived from receipt events and saved per-account read state; it is not a demo value.
- Supported events: deposit approved/rejected, purchased bot approved/unlocked or rejected, withdrawal paid/rejected, referral free-bot awarded, claimed spin rewards, and completed mining. Running mining ticks and cumulative commission summaries do not spam alerts. Bot USD bonus is already part of its purchase receipt and does not duplicate the unlock notification.
- `notifications-core.js` projects the existing account activity stream, without extra financial listeners or balance writes. Stable event IDs include receipt key, decision and saved event timestamp, so retries do not duplicate the same event and a later rejection after resubmission is new.
- Clicking an unread item or Mark All saves only `{eventId, read:true, readAt:serverTimestamp}` under `users/{uid}/notificationReads/{eventId}`. Existing read state survives app restarts/devices. New real events remain unread. Mark All batches up to 400 writes, and never marks future events. An unconfirmed local read write does not reduce the count.
- Rules restrict read-state access and writes to the owning user, reject extra fields/false flags/forged timestamps, and grant no permissions to create notifications, change roles or modify money. Notification text is rendered safely as text. Source/read failures are visible; an unknown count shows ! instead of claiming zero. Retry restarts read-state and receipt subscriptions.
- Deployment: publish the current `firebase.rules` in Firebase Console. Until then, read/unread persistence is denied and the page will explain the failure. No new secrets, backend worker or billing configuration are needed. Existing real terminal receipts initially appear unread; users may mark all read.
- These are in-app notifications. They do not send Telegram messages or background operating-system push notifications.
- Validation: 12 notification projection/persistence tests, 7 emulator security tests, 14 activity tests, 16 withdrawal regression tests and 13 spin regression tests passed (62 total), plus mobile browser checks for routing, read/all-read actions, status changes, safe rendering, permissions, navigation/support and 320/390/420px widths. Scripts: `npm run test:notifications` and `npm run test:notifications:rules`.

### Secure Claim The Code + Admin Generator (2026-10-25)
- Admin → Redeem Codes now creates 1–5 real random `TRH-` codes per submission with cryptographic 80-bit randomness. Choose BDT, USD or one canonical bot package, expiry 1–30 minutes (default 30), and total claim limit 1–10,000 (default 1). Every account may claim each code once. Amounts support up to two decimal places. The admin can copy, disable or re-enable a code; reward, expiry and usage policy are immutable after issue. Expired codes cannot be revived by toggling active.
- User → Home → Claim The Code is live. Claim Code shortcut focuses the existing form instead of opening Feed. Wrong, expired, disabled, exhausted, already-claimed and already-owned-bot cases have explicit messages. No header/nav redesign.
- A single Firestore transaction creates `users/{uid}/codeClaims/{code}`, increments the code's usage counter and delivers exactly the configured reward. BDT goes to balance, USD to usdBalance. Bot claims fill an unowned canonical unlockedBots slot and create its standard 30-day, 160%-target mining record. Existing canonical ownership/mining prevents consumption. Referral free instances remain separate. Free bot codes do not grant purchase USD bonus, 5% referral commission or qualify as a paid first purchase.
- New codes live in `rewardCodes`; users may fetch a known code but may not list all codes. Only admins issue codes. Rules independently enforce reward matching, one receipt per user, active/expiry/usage checks, exact balance deltas and canonical mining economics. Counter/receipt/reward writes cannot be split or forged. Contended claims safely re-read the full transaction instead of replaying standalone credits. Claims never overwrite completed/running owned mining.
- Existing `botRedeemCodes` records and legacy rules are retained unchanged, shown read-only in admin; no old code is silently migrated or granted new value. Use newly generated `rewardCodes` for this interface.
- Code claim receipts appear live in Recent Activity, Ledger and Notifications with separate BDT/USD/Bot units. Existing mining worker processes code-unlocked bots without changes.
- Deployment: Publish the entire current `firebase.rules` in Firebase Console before using the updated admin/user flows. No new secret, backend, billing or manual database documents are required. Code issuance and claims fail closed before rules publication.
- Validation: 15 reward-code integration tests (including actual worker mining on a code bot), 20 purchase, 16 withdrawal, 13 spin, 7 notification security, 13 referral, and 28 activity/notification tests passed: 112 total. Browser checks cover admin generator/disable, user shortcut/claim/error recovery and 320/390/420px layouts. Run `npm run test:codes`.
- Remaining broad features: Support chat/calls, Community Feed publishing and secure Telegram login; profile-save rule mismatches also remain separate work.

### Text-only Community Feed (2026-10-25)
- Feed now publishes actual Firestore text posts. Image picker, preview and file input are removed from this feature. No media storage/billing setup is used. The shared header and bottom five-tab navigation are unchanged.
- Posts are immediately visible to signed-in members; there is no pending-approval step. Each post contains only uid, authorName, collectorId, text and server createdAt. Text is 1–2,000 characters, preserves line breaks and is safely escaped as text in user/admin UI; image URLs/HTML pasted as text never become embedded images.
- Public Feed listens to the latest 50 posts. My Posts runs an independent owner query, including older posts outside the public window; it sorts by saved time and reveals more in batches of 50. These queries need only standard single-field indexes, no new composite-index deployment.
- Refresh restarts the listener; cache/connection/permission states are visible. Listeners start only while Feed is open and stop on navigation or sign-out. Account changes clear the old draft/data. Repeating the same publish attempt does not create a second copy while its saved post exists.
- Users can delete their own posts. Admin → Community Feed loads actual posts, supports Refresh / Load older posts and Remove post. A moderator may remove others' posts but cannot silently rewrite the author or text. Removing a post does not modify wallet/account information.
- Firestore rules require signed-in access, real owner/profile author identity, server time, strict text-only schema and text limits. Posts cannot be edited after publication. Other users cannot delete them; admin role is checked by rules. Extra image/file/role/balance fields are rejected.
- Deployment: Publish the entire current `firebase.rules` before using Feed or admin Community Feed. No new secret, worker, payment, Firebase Storage or billing configuration is needed. Existing account balances/mining are untouched.
- Validation: 14 new community integration tests, 15 code, 20 purchase, 16 withdrawal, 13 spin, 7 notification security, 13 referral and 28 activity/notification tests passed (126 total). Mobile browser tests cover actual text publishing, safe HTML display, no image controls, My Posts, own deletion, refresh/error recovery, hidden-tab listener cleanup, admin moderation and 320/390/420px widths. Run `npm run test:community`.
- Current remaining broader work: full Support chat/calls and secure Telegram login; the previously identified profile-save mismatch is also separate work.

### Support simplified to real contact links (2026-10-25)
- Per owner request, Customer Support is now a polished contact page with only the existing WhatsApp (`https://wa.me/qr/JW6QP24HJU6MO1`) and Telegram (`https://t.me/Kdcariyan1`) links, plus navigation back/close controls.
- Removed demo chat preview, message composer/send, voice, image/file attachment controls, Call Helpline, fake busy response and related demo/theme event handlers. Removed unsupported online/24-hour/verified claims and the old Income Collection Pro copy. No messages are collected inside the app.
- Header, Home and Profile Support entries continue to open the same page. Wallet-to-Support transition now hides the wallet and clears its page flag; back/close restores the prior tab. Header and five-tab navigation HTML is unchanged. Styles are scoped to Support content.
- No Firebase rules, storage, new secrets, billing, balances or admin-panel changes. In-app support chat/media/calls are intentionally deferred, not shown as non-working controls.
- Validation: JavaScript syntax and mobile browser checks for contact URLs, no demo controls, Support entry points, wallet transition, back/close, shared header/navigation geometry and 320/390/420px widths. External links were preserved from the repository; no messages were sent.

### Secure Telegram Login source + linking (2026-10-25)
- Frontend Telegram Login is connected to the dedicated backend defined in `js/telegram-auth-config.js`. Worker source: [`workers/telegram-auth.mjs`](workers/telegram-auth.mjs). **Deployment is still required in Cloudflare; this repository commit alone does not make the backend live.** See the complete [setup guide](docs/telegram-login-setup.md).
- The Worker accepts only signed, fresh Telegram Mini App initData, verifies Firebase ID-token signatures/project/expiry and live account state for linking, and signs short-lived Firebase custom tokens for the existing bound UID. No username/email guessing, automatic new Telegram accounts, client-selected UID, reward/role grants, or unsafe identity fallback.
- Profile now has a Telegram Login linking card. Both identities must be proven. Linking an older session may require one password reauthentication, without signing out; passwords go only to Firebase and are not sent to the Worker. Existing verified Telegram mappings from the referral worker are compatible.
- Identity mapping/back-reference updates are transactional and preserve all balance, bot, role, referral and Collector ID fields. One Telegram account cannot hijack another Firebase account or silently replace an existing Telegram identity. A Telegram link does not satisfy attributed referral signup and channel membership requirements on its own.
- Email/username signup/login remains unchanged and can be used while Worker setup is pending. Firebase LOCAL persistence stays enabled; no forced logout is introduced. Ordinary-browser pages without signed Mini App data instruct users to launch the Telegram Mini App.
- New secrets are only on the **new** Cloudflare Worker: TELEGRAM_BOT_TOKEN (the Mini App bot) and FIREBASE_SERVICE_ACCOUNT (existing reward-hub-bd JSON). Existing Monetag Worker, GitHub secrets, bot polling/webhooks, Firebase rules and admin panel are unchanged.
- Validation: 13 backend crypto/API tests + 4 client/persistence tests + 8 real isolated Firestore REST transaction tests (25 total), plus mobile browser tests for the Profile linking/reauth flow, setup-error fallback and 320/390/420px layouts. Real Telegram/Firebase live login remains unverified until the Worker is published/configured and a real signed Mini App launch is used.


### Profile save correction — 2026-10-26

Profile edits now accept the existing form fields (name/fullName, phoneNumber, telegramUsername and server profileUpdatedAt), with length/type limits and no permission to edit financial fields, role or verified Telegram identity. Compressed JPEG profile data is capped at 450,000 characters. Choosing an avatar clears the uploaded photo; saving a new photo clears the avatar selection. The saved image appears in the shared header without changing its layout. Telegram profile links support t.me/telegram.me URLs as well as usernames.

Deployment: publish the **entire firebase.rules** file in Firebase Console → Firestore Database → Rules. GitHub Pages deploys the client only; a GitHub commit does not publish Firestore rules. Existing balances, bots, identity mappings and sessions are not migrated. Tests: `npm run test:profile` and `npm run test:profile:display`.


### Password Recovery (2026-10-26)

Profile now provides a Firebase-verified Recovery Email flow for existing username accounts, preserving their UID and username via a private immutable reservation. Contact email from signup is not recovery proof. Username fallback validates the current password with Firebase through the dedicated Telegram Auth Worker; email and Telegram login remain available. No recovery email or password is published in Firestore aliases.

**Deployment required:** publish the entire latest `firebase.rules`, then replace/deploy `workers/telegram-auth.mjs` in the existing Telegram Auth Worker, keeping its secrets. The Recovery form stays blocked until the Worker advertises recovery capability. [Full setup and test steps](docs/password-recovery-setup.md). No live accounts were migrated by this commit.


### Background Rank sync (2026-10-26)

The existing Secure Auto Mining workflow now runs `scripts/sync-leaderboard.cjs` on each scheduled/manual run, even if the reward-processing step fails (unless the workflow is cancelled). It reads each current user profile in a transaction and publishes only UID, display name, Collector ID, total owned package bots plus referral bot instances, and update time to `publicLeaderboard`. No browser sign-in is needed. Changed entries are updated; identical entries are not rewritten. Invalid profiles are counted and skipped rather than converted to zero; financial/profile fields are never written.

This is scheduled reconciliation, not instant server push: the existing five-minute schedule can be delayed by GitHub. The client still displays new data through its existing live listener. Existing FIREBASE_SERVICE_ACCOUNT is reused; no new secrets, Firebase rules or Cloudflare deployment is needed. The push triggers the first run. Check the Synchronize public bot rankings step for LEADERBOARD_SYNC_SUMMARY counts. Tests: `npm run test:leaderboard:sync` (local Firestore only).


### Rank profile photos (2026-10-26)

Podium and member rows show uploaded profile photos, then saved/default avatars. The current member sees their saved photo directly from their already-authorized private profile; other members use public 80×80 JPEG thumbnails capped at 12,000 characters. The scheduled Rank sync creates thumbnails from saved JPEG uploads with sharp, strips metadata, preserves current bot counts and clears old thumbnails when a saved avatar replaces a photo. It never fetches external image URLs. Corrupt or unsupported images use the default avatar.

Publish the entire current `firebase.rules` so clients remain able to update Rank entries with the new optional `rankAvatar`/`rankPhoto` fields preserved. Private user profiles remain owner/admin only. Public Rank still exposes no email, phone, wallet or verified Telegram identity. Images update for other members after a scheduled sync, subject to GitHub scheduling delays. Rank, header and navigation dimensions are unchanged. No Cloudflare change or new secret is needed. Tests: `npm run test:rank:avatar`, `npm run test:rank:avatar:rules`, `npm run test:leaderboard:sync`.


### Daily 200-tap ad unlock (2026-10-27)

Tap-to-Earn now requires 200 saved, non-cash taps per Bangladesh calendar day. On the 200th saved tap, `tapAdsUnlockedDate` is set for that day; further taps are capped and ads remain unlocked until the next Bangladesh day. A user who already had 200–2,000 taps today under the previous goal keeps that progress; before requesting an ad session, a transaction sets the same-day unlock marker if missing. No balance, USD balance, ad reward or payout is written by the tap code.

Firestore rules restrict updates to one tap per write and enforce the Bangladesh day against server time. The screen refreshes on day change and app resume; queued previous-day taps are not counted in a new day. Publish the entire `firebase.rules` to deploy the new limit, then reload the app. The existing Monetag Worker source is not in this repository and was not changed; health cannot establish whether its server-side session eligibility has a separate 2,000-tap restriction. A real test of reaching 200 and opening an ad remains necessary. Tests: `npm run test:tap200`, `npm run test:tap200:rules` (local Firestore emulator).


### Backup scheduler for Mining and Referral (2026-10-27)

`workers/workflow-scheduler.mjs` is a separate Cloudflare Cron Worker that can trigger the existing Mining and Referral GitHub Actions when no recent successful or active run exists. The original schedules remain enabled. Setup requires a new Worker, a repository-limited GitHub Actions token stored as a Cloudflare Secret, and a five-minute Cron Trigger; see [setup instructions](docs/workflow-scheduler-setup.md). Code alone does not deploy or activate the Worker. Existing financial scripts, Firebase rules and Telegram polling are unchanged. Scheduled events and jobs can still be delayed, and Firestore usage grows with accounts. `npm run test:workflow-scheduler` tests the scheduler without live dispatch.


## Daily Tasks — 2026-10-28

Home → Explore Services → Daily Tasks supports admin-published text-proof tasks. Tasks end at Bangladesh midnight; each user can submit once per task. Admin deletion preserves all proof and payment receipts. Approved v2 proofs credit main balance once through a transaction. Expired definitions are cleaned by the existing auto-mining job; server expiry is enforced independently of cleanup scheduling. Publish the updated `firebase.rules` before using this flow. See [daily-tasks.md](docs/daily-tasks.md) for deployment, tests and limitations.


## 2026-10-29 — Referral purchase requirement removed
- Two conditions only: a new account attributed to a real referrer at signup, and a linked Telegram identity verified as a current member of @freelancing_incom. A paid bot purchase is not required.
- The trusted verification worker no longer reads botPurchaseRequests to decide eligibility. Existing pending referrals are automatically reconsidered by the next successful run; existing awards are preserved and never granted twice.
- One verified referral still grants one active 30-day mining bot to its referrer. The 20-per-tier, 100-referral cycle is unchanged. No manual referral approval is needed.
- Paid purchase 5% commission and purchase USD bonuses remain separate. Old purchaseVerified fields are historical metadata and no longer affect eligibility. No Firebase rules or Cloudflare Worker deployment change is required.
