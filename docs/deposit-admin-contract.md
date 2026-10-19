# Task Reward Hub — Deposit/Admin Integration Contract

This document describes the Deposit data contract for the future Admin Panel. The current repository does not contain an Admin Panel page; this contract is intentionally defined now so a later panel can connect without changing the user-facing Deposit form.

## Firestore paths

### `appSettings/paymentSettings`

Admin-configurable payment instructions. Signed-in users can read this document; only users whose `users/{uid}.role` is `admin` can write it.

Fields:
- `bkashNumber`: string; valid Bangladesh personal MFS number (`01[3-9][0-9]{8}`) or empty to disable payment.
- `instructions`: string, maximum 600 characters.
- `active`: boolean. Must be true and the number valid before the Deposit form enables submission.
- `updatedAt`: Firestore server timestamp.
- `updatedBy`: admin UID.

The future Admin Panel should write the document at exactly `appSettings/paymentSettings` and use `firebase.firestore.FieldValue.serverTimestamp()` for `updatedAt`.

### `walletDeposits/{depositId}`

A user request contains:
- `uid`, `userName`, `email`
- `type`: currently only `bKash`
- `amount`: integer BDT, from ৳100 to ৳50,000
- `senderNumber`: user's bKash Personal number
- `trxId`: uppercase alphanumeric Transaction ID
- `status`: initially `pending`
- `createdAt`: server timestamp

Review fields:
- `reviewedBy`: admin UID
- `reviewedAt`: server timestamp
- `rejectionReason`: required, 3–300 characters, when status is `rejected`

Only a pending request may be reviewed. Allowed final statuses are `approved` and `rejected`.

### `usedDepositTransactions/{trxId}`

The user Deposit form creates this marker in the same Firestore batch as `walletDeposits/{depositId}`. The marker links the normalized Transaction ID to one request and is immutable. Do not delete or update markers during normal Admin Panel operations. This prevents new submissions from reusing a Transaction ID.

## Required Admin approval behavior

The Admin Panel must not credit the user balance merely because a request was submitted or because the Transaction ID exists. Verify the actual payment in bKash first.

When approving, use a Firestore transaction:
1. Read the pending `walletDeposits/{depositId}` document.
2. Read `users/{uid}` and confirm the user's current balance.
3. If the deposit is not `pending`, abort without crediting.
4. Update the user balance by the approved amount and set the deposit status to `approved` with `reviewedBy` and server `reviewedAt` in the same transaction.
5. Ensure concurrent/double clicks cannot credit twice; Firestore transactions retry on conflicting writes.

When rejecting, require a reason (3–300 characters) and update the request to `rejected` with `rejectionReason`, `reviewedBy`, and server `reviewedAt`. Do not change the user's balance.

## Ledger behavior

The existing Dashboard Ledger reads `walletDeposits` filtered by the signed-in user's UID. It displays amount, status, Transaction ID, and the rejection reason when rejected. Users must never be able to read other users' deposit requests or modify review fields.

## Deployment note

The repository's rules source is `firebase.rules`. Updating this file in GitHub does not by itself publish rules to the live Firebase project. Deploy/publish the updated rules in the Firebase Console or through an explicitly configured Firebase CLI deployment before testing submissions.
