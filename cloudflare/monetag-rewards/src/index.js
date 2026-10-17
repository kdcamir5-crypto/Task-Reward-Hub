/**
 * Monetag Rewarded Interstitial postback + secure Firebase balance credit.
 * Deploy as a Cloudflare Worker with a bound D1 database and secrets.
 */
const MONETAG_ZONE_ID = "12051888";
const REWARD_TAKA = 3;
const DAILY_LIMIT = 50;
const REQUEST_VAR = "daily_reward";

let cachedOAuthToken = null;
let cachedOAuthExpiry = 0;
let cachedJwks = null;
let cachedJwksExpiry = 0;

function json(data, status = 200, origin = "*") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "Authorization, Content-Type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "vary": "Origin"
    }
  });
}
function getAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  const configured = (env.APP_ORIGINS || "").split(",").map(v => v.trim()).filter(Boolean);
  if (!origin) return "";
  return configured.includes(origin) ? origin : null;
}
function b64urlBytes(input) {
  const s = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = s + "=".repeat((4 - s.length % 4) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
function decodeJsonPart(part) {
  return JSON.parse(new TextDecoder().decode(b64urlBytes(part)));
}
function toBase64Url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function pemBytes(pem) {
  const normalized = pem.replace(/\\n/g, "\n");
  const body = normalized.replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  return b64urlBytes(body.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""));
}
function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyFirebaseIdToken(token, env) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid Firebase token.");
  const header = decodeJsonPart(parts[0]);
  const claims = decodeJsonPart(parts[1]);
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Invalid token header.");
  if (claims.aud !== env.FIREBASE_PROJECT_ID ||
      claims.iss !== "https://securetoken.google.com/" + env.FIREBASE_PROJECT_ID ||
      typeof claims.sub !== "string" || !claims.sub ||
      claims.iat > now + 60 || claims.exp <= now || claims.exp - claims.iat > 3600 + 60) {
    throw new Error("Firebase token claims are invalid.");
  }
  if (!cachedJwks || Date.now() > cachedJwksExpiry) {
    const res = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    if (!res.ok) throw new Error("Could not load Firebase signing keys.");
    cachedJwks = await res.json();
    cachedJwksExpiry = Date.now() + 30 * 60 * 1000;
  }
  const jwk = cachedJwks.keys.find(k => k.kid === header.kid);
  if (!jwk) {
    cachedJwks = null;
    throw new Error("Unknown Firebase signing key.");
  }
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const signed = new TextEncoder().encode(parts[0] + "." + parts[1]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlBytes(parts[2]), signed);
  if (!valid) throw new Error("Firebase token signature is invalid.");
  return { uid: claims.sub, authTime: claims.auth_time || 0 };
}

async function serviceOAuthToken(env) {
  if (cachedOAuthToken && Date.now() < cachedOAuthExpiry - 60000) return cachedOAuthToken;
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claim = toBase64Url(new TextEncoder().encode(JSON.stringify({
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  })));
  const unsigned = header + "." + claim;
  const key = await crypto.subtle.importKey("pkcs8", pemBytes(env.FIREBASE_PRIVATE_KEY), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = unsigned + "." + toBase64Url(new Uint8Array(signature));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) throw new Error("Firebase service authorization failed.");
  cachedOAuthToken = body.access_token;
  cachedOAuthExpiry = Date.now() + Number(body.expires_in || 3600) * 1000;
  return cachedOAuthToken;
}

async function firestoreRequest(env, path, init = {}) {
  const token = await serviceOAuthToken(env);
  const url = "https://firestore.googleapis.com/v1/projects/" + env.FIREBASE_PROJECT_ID + "/databases/(default)/documents" + path;
  return fetch(url, {
    ...init,
    headers: { authorization: "Bearer " + token, "content-type": "application/json", ...(init.headers || {}) }
  });
}
function firestoreNumber(value) {
  if (!value) return 0;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return Number(value.doubleValue);
  return 0;
}
async function firestoreCredit(env, uid, ymid, date) {
  const userPath = "/users/" + encodeURIComponent(uid);
  const ledgerPath = "/adRewards/" + encodeURIComponent(ymid);
  for (let attempt = 0; attempt < 4; attempt++) {
    const existing = await firestoreRequest(env, ledgerPath);
    if (existing.ok) return "already-credited";
    if (existing.status !== 404) throw new Error("Could not check reward ledger.");
    const userRes = await firestoreRequest(env, userPath);
    if (!userRes.ok) throw new Error(userRes.status === 404 ? "User profile not found." : "Could not load user balance.");
    const userDoc = await userRes.json();
    const oldBalance = firestoreNumber((userDoc.fields || {}).balance);
    const newBalance = Math.round((oldBalance + REWARD_TAKA) * 100) / 100;
    const now = new Date().toISOString();
    const ledgerName = "projects/" + env.FIREBASE_PROJECT_ID + "/databases/(default)/documents/adRewards/" + ymid;
    const writes = [
      {
        update: {
          name: userDoc.name,
          fields: {
            balance: { doubleValue: newBalance },
            updatedAt: { timestampValue: now }
          }
        },
        updateMask: { fieldPaths: ["balance", "updatedAt"] },
        currentDocument: { updateTime: userDoc.updateTime }
      },
      {
        update: {
          name: ledgerName,
          fields: {
            uid: { stringValue: uid },
            ymid: { stringValue: ymid },
            amount: { integerValue: String(REWARD_TAKA) },
            source: { stringValue: "monetag_rewarded_interstitial" },
            rewardDate: { stringValue: date },
            createdAt: { timestampValue: now }
          }
        },
        currentDocument: { exists: false }
      }
    ];
    const commit = await firestoreRequest(env, ":commit", {
      method: "POST",
      body: JSON.stringify({ writes })
    });
    if (commit.ok) return "credited";
    if (commit.status !== 409 && commit.status !== 400 && commit.status !== 412) {
      throw new Error("Firebase reward transaction failed.");
    }
  }
  const finalLedger = await firestoreRequest(env, ledgerPath);
  if (finalLedger.ok) return "already-credited";
  throw new Error("Reward transaction needs retry.");
}

async function issueAdSession(request, env, origin) {
  const auth = request.headers.get("Authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return json({ error: "Please sign in again." }, 401, origin);
  let identity;
  try { identity = await verifyFirebaseIdToken(match[1], env); }
  catch { return json({ error: "Sign-in verification failed. Please sign in again." }, 401, origin); }

  const ymid = "trh_" + toBase64Url(crypto.getRandomValues(new Uint8Array(24)));
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 48 * 60 * 60 * 1000;
  const inserted = await env.REWARDS_DB.prepare(
    "INSERT INTO ad_sessions (ymid, uid, issued_at, expires_at) VALUES (?, ?, ?, ?)"
  ).bind(ymid, identity.uid, issuedAt, expiresAt).run();
  if (!inserted.success) return json({ error: "Could not start ad session. Try again." }, 503, origin);
  return json({ ymid, remainingToday: DAILY_LIMIT, rewardTaka: REWARD_TAKA }, 200, origin);
}

async function handlePostback(request, env) {
  const url = new URL(request.url);
  if (!env.MONETAG_POSTBACK_SECRET || !constantTimeEqual(url.searchParams.get("secret") || "", env.MONETAG_POSTBACK_SECRET)) {
    return new Response("Forbidden", { status: 403 });
  }
  const p = url.searchParams;
  const ymid = p.get("ymid") || "";
  const eventType = p.get("event_type") || "";
  const rewardType = p.get("reward_event_type") || "";
  const zoneId = p.get("zone_id") || "";
  const requestVar = p.get("request_var") || "";
  if (!/^[A-Za-z0-9_.-]{8,100}$/.test(ymid) || zoneId !== MONETAG_ZONE_ID || requestVar !== REQUEST_VAR) {
    return new Response("Ignored", { status: 200 });
  }
  if (eventType !== "impression" || !["valued", "non_valued"].includes(rewardType)) {
    return new Response("Accepted without reward", { status: 200 });
  }

  const sessionRes = await env.REWARDS_DB.prepare(
    "SELECT uid, issued_at, expires_at FROM ad_sessions WHERE ymid = ?"
  ).bind(ymid).first();
  if (!sessionRes) return new Response("Unknown ad session", { status: 200 });
  const now = Date.now();
  if (Number(sessionRes.expires_at) < now || now - Number(sessionRes.issued_at) > 48 * 60 * 60 * 1000) {
    return new Response("Expired ad session", { status: 200 });
  }

  const date = new Date(now).toISOString().slice(0, 10);
  const uid = sessionRes.uid;
  await env.REWARDS_DB.prepare(
    "INSERT INTO daily_rewards (ymid, uid, reward_date, status, created_at) " +
    "SELECT ?, ?, ?, 'pending', ? WHERE (SELECT COUNT(*) FROM daily_rewards WHERE uid = ? AND reward_date = ?) < ? " +
    "ON CONFLICT(ymid) DO NOTHING"
  ).bind(ymid, uid, date, now, uid, date, DAILY_LIMIT).run();

  const reservation = await env.REWARDS_DB.prepare(
    "SELECT uid, reward_date, status FROM daily_rewards WHERE ymid = ?"
  ).bind(ymid).first();
  if (!reservation) return new Response("Daily limit reached", { status: 200 });
  if (reservation.uid !== uid) return new Response("Session mismatch", { status: 200 });
  if (reservation.status === "credited") return new Response("Already rewarded", { status: 200 });

  try {
    await firestoreCredit(env, uid, ymid, reservation.reward_date);
    await env.REWARDS_DB.prepare(
      "UPDATE daily_rewards SET status = 'credited', credited_at = ? WHERE ymid = ?"
    ).bind(Date.now(), ymid).run();
    return new Response("Reward processed", { status: 200 });
  } catch (error) {
    console.error("Reward processing failed:", error.message || error);
    return new Response("Temporary reward processing error", { status: 503 });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Public, non-sensitive diagnostic endpoint for deployment checks.
    // It never returns secret values or Firebase credentials.
    if (url.pathname === "/health" && request.method === "GET") {
      let d1Configured = false;
      try {
        const result = await env.REWARDS_DB.prepare("SELECT 1 AS ok").first();
        d1Configured = result?.ok === 1;
      } catch (error) {
        console.error("Health check D1 probe failed:", error?.message || error);
      }
      const checks = {
        firebaseProjectConfigured: Boolean(env.FIREBASE_PROJECT_ID),
        serviceAccountConfigured: Boolean(env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY),
        postbackSecretConfigured: Boolean(env.MONETAG_POSTBACK_SECRET),
        d1Configured
      };
      const ok = Object.values(checks).every(Boolean);
      return json({ ok, service: "monetag-rewards", checks }, ok ? 200 : 503);
    }

    if (url.pathname === "/postback") return handlePostback(request, env);
    const origin = getAllowedOrigin(request, env);
    if (request.method === "OPTIONS") {
      if (origin === null) return new Response("Origin not allowed", { status: 403 });
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": origin || "*",
        "access-control-allow-headers": "Authorization, Content-Type",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-max-age": "86400",
        "vary": "Origin"
      }});
    }
    if (url.pathname === "/ad-session" && request.method === "POST") {
      if (origin === null) return json({ error: "Origin not allowed." }, 403, "");
      return issueAdSession(request, env, origin || "*");
    }
    return json({ error: "Not found." }, 404, origin || "*");
  }
};
