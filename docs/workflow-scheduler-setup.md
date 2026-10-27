# Workflow scheduler setup

## Why
GitHub's own schedule can be delayed or dropped. Recent production runs were successful but separated by hours. This dedicated Cloudflare Cron Worker checks the three existing GitHub Actions workflows every five minutes and dispatches only a workflow that lacks a recent success or active run. It does not implement financial calculations or connect to Firebase/Telegram itself. The original GitHub schedules remain in place as fallback. GitHub Actions' jobs still need to start and finish, so exact five-minute delivery is not guaranteed.

## One-time setup
1. Create a **separate** Worker named `task-reward-hub-workflow-scheduler` in Cloudflare Workers & Pages. Leave the existing Monetag and Telegram Auth Workers unchanged.
2. Edit this Worker and replace its entire code with `workers/workflow-scheduler.mjs`. Deploy.
3. In GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens, create a token for **only** `kdcamir5-crypto/Task-Reward-Hub`. Repository permissions: **Actions: Read and write**; GitHub supplies Metadata read as needed. Set a suitable expiration. Copy it immediately; do not paste it into chat, a GitHub file or public variables.
4. In the new Cloudflare Worker → Settings → Variables and Secrets, add the token as a **Secret** named `GITHUB_ACTIONS_TOKEN`. Deploy/save. There is no Firebase service-account or Telegram bot token in this Worker.
5. Worker → Settings → Triggers → Cron Triggers: add `*/5 * * * *` (UTC). It may take up to 15 minutes to propagate. Existing GitHub schedules remain enabled.
6. Check `https://task-reward-hub-workflow-scheduler.kdcamir5.workers.dev/health`. `configured:true` only proves a secret value is present, not that GitHub accepts it or that a cron exists. In Actions verify runs appear as **workflow_dispatch** for Secure Auto Mining, Verify referrals and award bots, and Prepare secure spin rewards. Inspect all three run results and Cloudflare Cron Events. If recent runs already exist, the Worker intentionally waits; a failed GitHub request must surface as a failed Cron Event. No arbitrary HTTP endpoint can dispatch a workflow.
7. Test with an authorized test account: verify real mining balance and a valid referral award once, then observe several scheduled cycles. Never manually replay a financial write.

## Operation and limits
- Recent successful main-branch runs (5 minutes) or active main-branch runs (12 minutes) are skipped to reduce duplicate work. Stale, failed, cancelled, other-branch and pull-request runs do not block dispatch. Existing GitHub workflow concurrency plus transactional reward code remains the safeguard if schedules overlap.
- The token can dispatch/manage Actions in the selected repository and must be treated as a secret. On token expiration or revocation, create a replacement and update only this Worker Secret. Logs contain workflow name, a status and HTTP code; they never log token, response body, Firebase data or user data.
- Cloudflare free accounts have a limited number of Cron Triggers. GitHub-hosted standard runners are free for public repositories, but increased recurring runs cause additional Firestore reads/writes; monitor Firebase Spark quotas as user count grows. GitHub queues, Cloudflare incidents, token expiry or API rate limits can still cause delays.
- Health is read-only and available without authentication; it contains no user data, token or dispatch capability. No new Firebase rules, admin permissions, Monetag settings or secrets are required for the existing workers.
- Tests: `npm run test:workflow-scheduler`. Tests use simulated GitHub responses and never dispatch live workflows or modify account data.
