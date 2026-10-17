# Monetag Automatic Rewards (Cloudflare Workers)

This backend is designed for Task Reward Hub's Telegram Mini App.

## Reward policy
- Monetag main zone: 12051888
- Reward: ৳3 for each Monetag-confirmed valued impression
- Daily cap: 50 valued impressions per Firebase user (UTC day)
- No admin approval
- Firestore reward ledger is written in the same Firestore commit as the balance update, preventing duplicate balance credits.

## Files
- src/index.js: Firebase ID-token verification, one-time ad session issuance, Monetag postback validation and Firestore balance credit.
- schema.sql: D1 tables for ad sessions and daily caps.
- wrangler.toml: Worker configuration template.

## Deploy setup (do not skip)
1. In Cloudflare, create a D1 database named task-reward-hub-rewards.
2. Run the SQL in schema.sql in that D1 database.
3. Replace REPLACE_WITH_D1_DATABASE_ID in wrangler.toml with the database ID.
4. Deploy this directory as a Worker. Do not deploy until the secrets below are configured.
5. Add Worker secrets (never commit them):
   - MONETAG_POSTBACK_SECRET: generate a long random secret (at least 32 random bytes).
   - FIREBASE_CLIENT_EMAIL: service-account client email.
   - FIREBASE_PRIVATE_KEY: service-account private key, including PEM header/footer. Escaped newlines are supported.
6. Set FIREBASE_PROJECT_ID=reward-hub-bd and APP_ORIGINS to the exact web app origin. If using a custom domain, add it as a comma-separated origin. Keep this list specific.
7. The Firebase service account must be from project reward-hub-bd and have Firestore read/write permissions. Never place the service-account JSON/private key in GitHub Pages or browser code.
8. Configure Monetag Postback URL for main zone 12051888:
   https://YOUR-WORKER.workers.dev/postback?secret=YOUR_SECRET&ymid={ymid}&event_type={event_type}&reward_event_type={reward_event_type}&zone_id={zone_id}&request_var={request_var}
   Save it in the Monetag dashboard only. Keep the same secret as the Worker secret.
9. The frontend must request POST /ad-session with the signed-in Firebase user's ID token, then call show_12051888({ymid: session.ymid, requestVar: 'daily_reward'}). The browser callback is for UI only; the backend postback is the source of truth.
10. Test inside Telegram with a real Monetag event. Verify one ৳3 credit, duplicate postback no extra credit, non-valued event no credit, and the 50/day cap.

## Important
- The cap uses UTC calendar days. It is enforced server-side, not by browser storage.
- The daily cap is counted when a valued postback is reserved. If Firebase is temporarily unavailable, Monetag retries and the same reservation is safely retried.
- The adRewards/{ymid} Firestore document is a server-created idempotency ledger. Keep client Firestore rules denying client writes to this collection.
- Do not weaken the existing users/{uid} balance rules.
- This code has not been deployed to Cloudflare from GitHub. Configure the Cloudflare account, D1 binding, and secrets before using the ad feature.
