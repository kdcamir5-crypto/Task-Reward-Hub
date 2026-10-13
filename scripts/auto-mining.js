/**
 * Secure server-side auto-mining worker for Task Reward Hub.
 * Runs only in GitHub Actions with a Firebase service-account secret.
 * Never expose the service-account JSON in the website or logs.
 */
'use strict';

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const PROJECT_BOT_CONFIG = {
  pulse:   { name: 'AI Pulse Bot v2', target: 80 },
  quantum: { name: 'Quantum Core Pro', target: 160 },
  neural:  { name: 'Neural Matrix Bot', target: 320 },
  cyber:   { name: 'Cyber Forge Titan', target: 480 },
  apex:    { name: 'Apex Sentinel AI', target: 800 }
};
const MINING_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const BOT_IDS = Object.keys(PROJECT_BOT_CONFIG);

function initFirebase() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT GitHub Actions secret.');
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON.');
  }
  if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
    throw new Error('Service-account JSON is missing required fields.');
  }
  if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
}

function timestampMillis(value) {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

async function processBot(db, userRef, botId, nowMs) {
  const config = PROJECT_BOT_CONFIG[botId];
  const miningRef = userRef.collection('botMining').doc(botId);

  await db.runTransaction(async (tx) => {
    const [userSnap, miningSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(miningRef)
    ]);
    if (!userSnap.exists) return;

    const user = userSnap.data() || {};
    const unlocked = Array.isArray(user.unlockedBots) ? user.unlockedBots : [];
    if (!unlocked.includes(botId)) return;

    // Existing unlocked bots start earning from their first worker run after setup.
    if (!miningSnap.exists) {
      tx.create(miningRef, {
        botId,
        botName: config.name,
        targetReward: config.target,
        earnedReward: 0,
        status: 'running',
        startedAt: Timestamp.fromMillis(nowMs),
        lastProcessedAt: Timestamp.fromMillis(nowMs),
        durationDays: 30,
        createdAt: Timestamp.fromMillis(nowMs),
        updatedAt: Timestamp.fromMillis(nowMs)
      });
      return;
    }

    const mining = miningSnap.data() || {};
    if (mining.status !== 'running') return;

    const startedMs = timestampMillis(mining.startedAt);
    if (startedMs === null) {
      // Fail closed if a mining record is malformed; never credit based on client data.
      tx.update(miningRef, {
        status: 'error',
        errorCode: 'INVALID_START_TIME',
        updatedAt: Timestamp.fromMillis(nowMs)
      });
      return;
    }

    const earnedPaisa = Math.max(0, Math.round(Number(mining.earnedReward || 0) * 100));
    const targetPaisa = Math.round(config.target * 100);
    const elapsedMs = Math.max(0, nowMs - startedMs);
    const desiredPaisa = Math.min(targetPaisa, Math.floor(targetPaisa * elapsedMs / MINING_DURATION_MS));
    const nextEarnedPaisa = Math.max(earnedPaisa, desiredPaisa);
    const deltaPaisa = nextEarnedPaisa - earnedPaisa;
    const finished = nextEarnedPaisa >= targetPaisa || elapsedMs >= MINING_DURATION_MS;

    const updates = {
      earnedReward: nextEarnedPaisa / 100,
      status: finished ? 'completed' : 'running',
      lastProcessedAt: Timestamp.fromMillis(nowMs),
      updatedAt: Timestamp.fromMillis(nowMs)
    };
    if (finished) updates.completedAt = Timestamp.fromMillis(nowMs);

    if (deltaPaisa > 0) {
      const oldBalancePaisa = Math.round(Math.max(0, Number(user.balance || 0)) * 100);
      tx.update(userRef, {
        balance: (oldBalancePaisa + deltaPaisa) / 100,
        updatedAt: Timestamp.fromMillis(nowMs)
      });
    }
    tx.update(miningRef, updates);
  });
}

async function main() {
  const db = initFirebase();
  const nowMs = Date.now();
  const usersSnap = await db.collection('users').get();
  let botsChecked = 0;
  for (const userDoc of usersSnap.docs) {
    const user = userDoc.data() || {};
    const unlocked = Array.isArray(user.unlockedBots) ? user.unlockedBots : [];
    for (const botId of BOT_IDS) {
      if (!unlocked.includes(botId)) continue;
      await processBot(db, userDoc.ref, botId, nowMs);
      botsChecked++;
    }
  }
  console.log(`Auto-mining run complete. Users checked: ${usersSnap.size}; unlocked bots checked: ${botsChecked}.`);
}

main().catch((error) => {
  console.error('Auto-mining worker failed:', error.message || error);
  process.exitCode = 1;
});
