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

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function isAdmin() {
      return signedIn()
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /users/{uid} {
      allow read: if signedIn() && (request.auth.uid == uid || isAdmin());
      allow create: if signedIn() && request.auth.uid == uid
        && request.resource.data.role == 'user'
        && request.resource.data.balance == 0
        && request.resource.data.tasks == 0
        && request.resource.data.referrals == 0;
      allow update: if signedIn() && request.auth.uid == uid
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name', 'phone', 'telegram']);
      allow update: if signedIn() && request.auth.uid == uid
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['unlockedBots', 'lastRedeemCode', 'updatedAt'])
        && request.resource.data.unlockedBots is list
        && request.resource.data.unlockedBots.size() == (('unlockedBots' in resource.data.keys()) ? resource.data.unlockedBots.size() + 1 : 1)
        && request.resource.data.unlockedBots.hasAll(('unlockedBots' in resource.data.keys()) ? resource.data.unlockedBots : [])
        && request.resource.data.lastRedeemCode is string
        && request.resource.data.updatedAt == request.time
        && getAfter(/databases/$(database)/documents/botRedeemCodes/$(request.resource.data.lastRedeemCode)).data.used == true
        && getAfter(/databases/$(database)/documents/botRedeemCodes/$(request.resource.data.lastRedeemCode)).data.usedBy == request.auth.uid
        && getAfter(/databases/$(database)/documents/botRedeemCodes/$(request.resource.data.lastRedeemCode)).data.usedAt == request.time
        && getAfter(/databases/$(database)/documents/botRedeemCodes/$(request.resource.data.lastRedeemCode)).data.botId in request.resource.data.unlockedBots
        && get(/databases/$(database)/documents/botRedeemCodes/$(request.resource.data.lastRedeemCode)).data.used == false
        && get(/databases/$(database)/documents/botRedeemCodes/$(request.resource.data.lastRedeemCode)).data.expiresAtMs > request.time.toMillis();
      allow update: if isAdmin();
      match /botMining/{botId} {
        allow read: if signedIn() && (request.auth.uid == uid || isAdmin());
        allow write: if false;
      }
    }

    match /tasks/{tid} {
      allow read: if signedIn();
      allow write: if isAdmin();
    }

    match /submissions/{sid} {
      allow read: if signedIn() && (resource.data.uid == request.auth.uid || isAdmin());
      allow create: if signedIn()
        && request.resource.data.uid == request.auth.uid
        && sid == request.auth.uid + '_' + request.resource.data.taskId
        && request.resource.data.status == 'pending'
        && request.resource.data.keys().hasOnly(['uid', 'email', 'taskId', 'taskTitle', 'reward', 'proof', 'image', 'status', 'createdAt'])
        && request.resource.data.proof is string && request.resource.data.proof.size() <= 300
        && request.resource.data.image is string && request.resource.data.image.size() <= 450000
        && (request.resource.data.proof.size() >= 3 || request.resource.data.image.size() >= 1000)
        && get(/databases/$(database)/documents/tasks/$(request.resource.data.taskId)).data.active == true
        && request.resource.data.reward == get(/databases/$(database)/documents/tasks/$(request.resource.data.taskId)).data.reward;
      allow update: if isAdmin();
    }

    match /wallets/{walletId} {
      allow read: if signedIn() && (resource.data.uid == request.auth.uid || isAdmin());
      allow create: if signedIn()
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.keys().hasOnly(['uid', 'type', 'number', 'createdAt'])
        && request.resource.data.type in ['bKash', 'Nagad', 'Rocket']
        && request.resource.data.number is string
        && request.resource.data.number.matches('^01[3-9][0-9]{8}$')
        && request.resource.data.createdAt == request.time;
      allow update, delete: if isAdmin();
    }

    match /withdrawals/{withdrawalId} {
      allow read: if signedIn() && (resource.data.uid == request.auth.uid || isAdmin());
      allow create: if signedIn()
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.status == 'pending'
        && request.resource.data.amount is number
        && request.resource.data.amount >= 100 && request.resource.data.amount <= 5000
        && request.resource.data.type in ['bKash', 'Nagad', 'Rocket']
        && request.resource.data.number is string
        && request.resource.data.number.matches('^01[3-9][0-9]{8}$')
        && request.resource.data.keys().hasOnly(['uid', 'amount', 'type', 'number', 'status', 'createdAt'])
        && request.resource.data.createdAt == request.time;
      allow update: if isAdmin()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'reviewedBy', 'reviewedAt'])
        && request.resource.data.status in ['paid', 'rejected']
        && request.resource.data.reviewedBy == request.auth.uid
        && request.resource.data.reviewedAt == request.time;
      allow delete: if false;
    }

    // Wallet deposit requests: user creates and reads only own requests; admin reviews.
    match /walletDeposits/{depositId} {
      allow read: if signedIn() && (resource.data.uid == request.auth.uid || isAdmin());
      allow create: if signedIn()
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.keys().hasOnly(['uid', 'userName', 'email', 'type', 'amount', 'senderNumber', 'trxId', 'status', 'createdAt'])
        && request.resource.data.type in ['bKash', 'Nagad']
        && request.resource.data.amount is int
        && request.resource.data.amount >= 10 && request.resource.data.amount <= 50000
        && request.resource.data.senderNumber is string
        && request.resource.data.senderNumber.matches('^01[3-9][0-9]{8}$')
        && request.resource.data.trxId is string
        && request.resource.data.trxId.size() >= 5 && request.resource.data.trxId.size() <= 100
        && request.resource.data.status == 'pending'
        && request.resource.data.createdAt == request.time;
      allow update: if isAdmin()
        && resource.data.status == 'pending'
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'reviewedBy', 'reviewedAt'])
        && request.resource.data.status in ['approved', 'rejected']
        && request.resource.data.reviewedBy == request.auth.uid
        && request.resource.data.reviewedAt == request.time;
      allow delete: if false;
    }

    // Bot purchases: requests remain pending until admin approves/rejects.
    match /botPurchaseRequests/{requestId} {
      allow read: if signedIn() && (resource.data.uid == request.auth.uid || isAdmin());
      allow create: if signedIn()
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.keys().hasOnly(['uid', 'userName', 'email', 'botId', 'botName', 'amount', 'paymentMethod', 'senderNumber', 'trxId', 'status', 'createdAt'])
        && request.resource.data.botId in ['pulse', 'quantum', 'neural', 'cyber', 'apex']
        && request.resource.data.amount is int
        && request.resource.data.amount == (
          request.resource.data.botId == 'pulse' ? 50 :
          request.resource.data.botId == 'quantum' ? 100 :
          request.resource.data.botId == 'neural' ? 200 :
          request.resource.data.botId == 'cyber' ? 300 : 500
        )
        && request.resource.data.paymentMethod in ['wallet', 'bKash', 'Nagad']
        && (request.resource.data.paymentMethod == 'wallet'
          ? request.resource.data.senderNumber == '' && request.resource.data.trxId == ''
          : request.resource.data.senderNumber is string
            && request.resource.data.senderNumber.matches('^01[3-9][0-9]{8}$')
            && request.resource.data.trxId is string
            && request.resource.data.trxId.size() >= 5
            && request.resource.data.trxId.size() <= 100)
        && request.resource.data.status == 'pending'
        && request.resource.data.createdAt == request.time;
      allow update: if isAdmin()
        && resource.data.status == 'pending'
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'reviewedBy', 'reviewedAt'])
        && request.resource.data.status in ['approved', 'rejected']
        && request.resource.data.reviewedBy == request.auth.uid
        && request.resource.data.reviewedAt == request.time;
      allow delete: if false;
    }

    match /botRedeemCodes/{codeId} {
      allow read: if isAdmin() || (signedIn() && resource.data.used == false && resource.data.expiresAtMs > request.time.toMillis());
      allow create: if isAdmin()
        && request.resource.data.keys().hasOnly(['code', 'botId', 'botName', 'createdBy', 'createdAt', 'expiresAtMs', 'used', 'usedBy', 'usedAt'])
        && request.resource.data.code == codeId
        && request.resource.data.botId in ['pulse', 'quantum', 'neural', 'cyber', 'apex']
        && request.resource.data.createdBy == request.auth.uid
        && request.resource.data.createdAt == request.time
        && request.resource.data.expiresAtMs > request.time.toMillis()
        && request.resource.data.expiresAtMs <= request.time.toMillis() + 1800000
        && request.resource.data.used == false && request.resource.data.usedBy == null && request.resource.data.usedAt == null;
      allow update: if isAdmin() || (signedIn()
        && resource.data.used == false
        && resource.data.expiresAtMs > request.time.toMillis()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['used', 'usedBy', 'usedAt'])
        && request.resource.data.used == true
        && request.resource.data.usedBy == request.auth.uid
        && request.resource.data.usedAt == request.time
        && getAfter(/databases/$(database)/documents/users/$(request.auth.uid)).data.lastRedeemCode == codeId
        && getAfter(/databases/$(database)/documents/users/$(request.auth.uid)).data.unlockedBots.hasAny([resource.data.botId]));
      allow delete: if isAdmin();
    }

    match /{document=**} { allow read, write: if false; }
  }
}
```

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
