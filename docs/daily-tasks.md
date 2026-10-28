# Daily Tasks

Home → Explore Services → Daily Tasks opens a page inside the existing header and five-tab shell. Admins publish a title, written instructions, HTTPS work link, and a BDT reward through the separate admin panel. No image/file upload is used for proof.

## Daily lifecycle

- Each newly published task has an immutable random ID, `schemaVersion: 2`, integer `rewardMinor`, and an `expiresAtMs` fixed to the next Bangladesh midnight (UTC+06:00). Firestore validates the expiry using request time.
- A user submits one written proof per task ID to `submissions/{uid}_{taskId}`. It is immediately excluded from that user's available-task list; other users can still submit. Rejected tasks also remain submitted and cannot be repeated.
- Every task expires at midnight, including a task published shortly before midnight. It does not reset into another copy. The admin creates new tasks for the next day.
- Client timers and foreground refresh remove expired tasks from both interfaces. Firestore rejects expired submissions even if the client clock is wrong.
- The existing secure auto-mining job also runs `cleanup-daily-tasks.cjs`, deleting up to 200 expired v2 task definitions per invocation. GitHub/Cloudflare delays can postpone physical cleanup; expiry enforcement does not depend on cleanup. Existing legacy definitions and all submissions are retained.
- Admin Delete immediately deletes that task definition. It never deletes proof or reward receipts. Pending proofs can be reviewed after deletion or expiry.

## Approval and accounting

`HubDailyTaskCore.review()` uses a transaction to reread the pending proof, update its decision, and (on approval) add the snapshotted reward to main balance and increment the user's task count exactly once. Concurrent reviews conflict/retry; settled submissions cannot return to pending. A rejection requires a reason and pays nothing. Firestore validates the paired balance change for approved v2 receipts. Existing broader admin account privileges remain unchanged.

Ledger and notifications identify only approved v2 receipts with `rewardCredited: true` as task credits; old legacy submissions are not reclassified as paid. Maintenance of deposits/purchases/withdrawals does not pause task proofs or already-earned rewards.

## Deployment and verification

Publish the complete updated `firebase.rules` in the reward-hub-bd Firestore console after the emulator workflow passes. User app files are hosted by GitHub Pages, admin files by the connected Cloudflare Pages repository. The existing scheduler and its secrets do not need replacement; cleanup runs inside the already-scheduled mining job.

Run `node --test tests/daily-tasks.test.cjs tests/daily-tasks-ui.test.cjs` and the `Verify daily tasks` GitHub Actions workflow. Test accounts are isolated in an emulator, never production. Validate task publishing, per-user hiding, admin deletion, approval and rejection with authorized test accounts after publishing rules. Screenshots/full visual acceptance and production money changes are separate from mocked interface tests.
