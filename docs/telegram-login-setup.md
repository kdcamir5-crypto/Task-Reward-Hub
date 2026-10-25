# Telegram Login setup

The frontend and dedicated Worker source are ready in this repository. **The new Worker still needs to be published and configured in Cloudflare.** GitHub Pages cannot run a private authentication backend. Do not replace the existing Monetag Worker.

## Publish the separate Worker

1. In the existing Cloudflare account, open **Workers & Pages** and create a Worker named **`task-reward-hub-telegram-auth`**.
2. Open its code editor. Replace the example code with the entire [`workers/telegram-auth.mjs`](../workers/telegram-auth.mjs) file and Deploy. It is one self-contained ES module with no imports or packages to bundle.
3. In this Worker's Settings → Variables and Secrets, add these as **Secret** values:

| Secret name | Value |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | BotFather token for **@Taskrewardhub_bot**, the bot that actually opens this Mini App. The token of a different bot will not verify this app's signed data. |
| `FIREBASE_SERVICE_ACCOUNT` | The complete existing Firebase service-account JSON for project **reward-hub-bd**, from the original downloaded JSON file. GitHub's saved secret cannot be read back. |

Never paste either value into chat, a public file, a GitHub commit or a screenshot. No new Firebase key needs to be created if the existing downloaded key is available. Do not delete or rotate working Monetag/referral credentials for this setup.

4. Apply the settings/redeploy, then open:
   `https://task-reward-hub-telegram-auth.kdcamir5.workers.dev/health`
   It should return `configured: true`. This confirms the expected settings are present, **not** a full end-to-end login test.
5. If Cloudflare gives this Worker a different URL, change only the public `endpoint` in [`js/telegram-auth-config.js`](../js/telegram-auth-config.js). It must be the HTTPS Worker origin with no path. The fixed allowed page origin is `https://kdcamir5-crypto.github.io`.

Optional CLI deployment uses `workers/wrangler.telegram-auth.jsonc`. Secret values must be added through Cloudflare secret prompts/settings, never command arguments or repository files.

## How account ownership works

- Telegram Login is for this bot's **Mini App**. Opening the ordinary website alone does not supply signed Telegram identity data; the button explains how to open the Mini App.
- An already verified Telegram identity from the existing referral-linking worker uses its original Firebase UID, provided its private mapping and profile back reference agree. Existing balances, bots, Collector ID and referral attribution remain under that same UID.
- For an unlinked Telegram user, first log in or sign up normally with email/username and password, then open **Profile → Telegram Login → Telegram Login যুক্ত করুন** inside the Mini App. This implementation intentionally does **not** auto-register a new Telegram-only account or guess matches from name/email/username.
- Linking requires both valid signed Telegram initData and the Firebase user's verified ID token. If the Firebase authentication is older than ten minutes, the card asks for the current password once. Firebase reauthentication preserves the UID/session; the password goes to Firebase, not to the Worker, and is cleared from the field.
- One Telegram identity can belong to only one Firebase account, and an existing account's Telegram identity cannot be silently changed. Links are atomic with the existing `telegramIdentities/{id}` and `users/{uid}.telegramUserId` fields. Existing referral verification remains compatible. Telegram linking alone does not grant channel verification, verified referrals or rewards.
- After linking, the Telegram button exchanges a five-minute custom sign-in token with Firebase. Firebase LOCAL persistence keeps the session across app restarts under the same browser/WebView storage until explicit sign-out or normal session invalidation. Tokens/passwords are not manually stored by the app.
- Signed initData is accepted for ten minutes with a small future-clock allowance. If it expires, close and reopen the Mini App in Telegram; there is no need to sign out of Firebase. No bot polling or webhook is changed by this Worker.

## Permissions and troubleshooting

- Use a service account that can read/write the existing identity/profile documents and read Firebase Auth users (`firebaseauth.users.get`). The existing Firebase service account may already have these permissions. It signs JWTs locally with its existing private key; no remote IAM signBlob permission is needed for this implementation.
- Missing/invalid configuration or Google service permissions fail closed. Email/password login continues to work. The Worker checks live Auth account existence/disabled state before issuing tokens and checks ID token signature, project, expiry and revocation time for linking.
- No Firestore rule changes, Firebase Storage, database reset, billing upgrade or new GitHub secret is needed. Secrets belong in the **new Cloudflare Worker**, not just GitHub Actions.
- `/health` is configuration-only. After it succeeds, verify with a real account: normal login → Profile link → explicit sign-out → Telegram Login → confirm the **same Collector ID, balance and bots**. This real-account test cannot be claimed complete until the Worker is deployed and a valid Telegram launch is used.

## Validation

`npm run test:telegram` covers HMAC/signature/freshness checks, Firebase JWT checks, safe token claims, origin/error handling, account linking proof, client persistence and no unsafe fallback (17 tests).

`npm run test:telegram:identities` runs 8 isolated Firestore REST integration tests for mapping/back references, financial-field preservation, duplicate links, conflicting/concurrent identities and missing profiles. It targets only `demo-trh-telegram`.

Primary protocol references: [Telegram Mini App validation](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app), [Firebase custom tokens](https://firebase.google.com/docs/auth/admin/create-custom-tokens), [Firebase ID token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Auth account lookup](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts/lookup), [Firestore transaction reads](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/batchGet).
