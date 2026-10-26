# Password recovery — deployment and user flow

1. Publish the entire current `firebase.rules` in Firebase Console → Firestore → Rules. Existing registrations remain compatible.
2. Replace the entire code of the **existing** `task-reward-hub-telegram-auth` Cloudflare Worker with `workers/telegram-auth.mjs` and deploy. Keep its two existing secrets. Do not modify the Monetag Worker. No new key or paid Firebase plan is needed.
3. `/health` must show `configured:true`, `version:2`, `passwordRecovery:true`. Health proves configuration, not delivery or sign-in. Before the backend is ready, the recovery form refuses to change the email.
4. In the same existing account, Profile → Recovery Email: enter a real email. Older sessions require current-password confirmation; users who forgot it may use their already-linked Telegram Login to freshly authenticate. Send verification and confirm Firebase's link in Inbox/Spam. UID, wallets, bots and referral identity do not change. Firebase may require a new sign-in following this security-sensitive email change. This does not change normal LOCAL session persistence.
5. After verification, use that real email on Forgot Password. The email stored at signup in Firestore is **contact information only** until explicitly linked with Firebase Auth. Users without either password or previously linked Telegram access need support; arbitrary contact emails are never trusted as recovery proof.
6. Test a real account: verification delivery, same UID/balance/bots, email login, username login, password reset delivery, and a fresh login with the reset password. No production account, password, email or data was changed during automated tests.

## Username preservation

Before sending a verification email, the signed-in user creates an immutable, private `usernameClaims/{username}` with their original UID. Rules require their actual Auth email to be the matching original username alias and their existing immutable usernameLower to agree. The claim contains no email. A different new UID cannot register that reserved username after email migration.

Original username login remains a direct Firebase login first. If those credentials fail, the `/password-login` Worker privately resolves the immutable alias, checks the profile and live Auth account, and submits the password to Firebase's `signInWithPassword` API using the current Auth email. Only an exact matching successful UID with ID token and no pending MFA may obtain a five-minute custom token for that same UID. The browser exchanges it with LOCAL persistence. No role claims, recovery email, password, provider tokens or account list are returned. No tokens/passwords are logged or stored. The Worker handles the password transiently in memory for forwarding to Firebase. Firebase's password checks and rate limits apply.

The reset form accepts real recovery email addresses only and keeps a generic response to avoid account enumeration. No reset token is exposed to the app. The default Firebase-hosted email action handler completes verification/reset. Existing password signup stays unchanged; recovery email setup is optional but recommended from Profile.

Tests: `npm run test:recovery`, `npm run test:recovery:rules`, `npm run test:recovery:native` (local Auth emulator only). Telegram cryptographic tests also remain applicable.
