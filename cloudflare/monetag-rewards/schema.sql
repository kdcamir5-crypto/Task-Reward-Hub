CREATE TABLE IF NOT EXISTS ad_sessions (
  ymid TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ad_sessions_uid ON ad_sessions(uid);

CREATE TABLE IF NOT EXISTS daily_rewards (
  ymid TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  reward_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'credited')),
  created_at INTEGER NOT NULL,
  credited_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_daily_rewards_user_day ON daily_rewards(uid, reward_date);
