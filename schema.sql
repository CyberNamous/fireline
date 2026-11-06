-- Initial schema. All currency is integer game dollars; all times Unix milliseconds.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS players (
 id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 40),
 balance INTEGER NOT NULL DEFAULT 12500 CHECK(balance >= 0),
 xp INTEGER NOT NULL DEFAULT 0 CHECK(xp >= 0),
 reputation INTEGER NOT NULL DEFAULT 50 CHECK(reputation BETWEEN 0 AND 100),
 version INTEGER NOT NULL DEFAULT 0, last_op TEXT,
 session_hash TEXT NOT NULL UNIQUE, session_expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
 username TEXT NOT NULL UNIQUE CHECK(length(username) BETWEEN 3 AND 20),
 password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
 pin_hash TEXT NOT NULL, pin_salt TEXT NOT NULL,
 password_failures INTEGER NOT NULL DEFAULT 0, password_locked_until INTEGER NOT NULL DEFAULT 0,
 pin_failures INTEGER NOT NULL DEFAULT 0, pin_locked_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS organizations (
 id TEXT PRIMARY KEY, player_id TEXT NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
 name TEXT NOT NULL, station_level INTEGER NOT NULL DEFAULT 1 CHECK(station_level BETWEEN 1 AND 4),
 lon REAL NOT NULL DEFAULT 121.035, lat REAL NOT NULL DEFAULT 14.59
);
CREATE TABLE IF NOT EXISTS vehicles (
 id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
 type TEXT NOT NULL CHECK(type IN ('engine','brush','rescue','tanker')),
 name TEXT NOT NULL, busy_until INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS vehicles_owner ON vehicles(player_id);
CREATE TABLE IF NOT EXISTS volunteers (
 id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
 name TEXT NOT NULL, role TEXT NOT NULL, skill INTEGER NOT NULL DEFAULT 1 CHECK(skill BETWEEN 1 AND 5),
 busy_until INTEGER NOT NULL DEFAULT 0, training_until INTEGER NOT NULL DEFAULT 0,
 attendance_count INTEGER NOT NULL DEFAULT 0, successful_count INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS volunteers_owner ON volunteers(player_id);
-- There is intentionally NO table for generated / unattended incidents.
CREATE TABLE IF NOT EXISTS participations (
 id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
 incident_id TEXT NOT NULL, incident_json TEXT NOT NULL,
 vehicle_id TEXT NOT NULL REFERENCES vehicles(id), crew_json TEXT NOT NULL,
 started_at INTEGER NOT NULL, due_at INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'responding' CHECK(status IN ('responding','completed')),
 outcome TEXT NOT NULL CHECK(outcome IN ('successful','contained')),
 cost INTEGER NOT NULL CHECK(cost >= 0), reward INTEGER NOT NULL CHECK(reward >= 0),
 xp_reward INTEGER NOT NULL CHECK(xp_reward >= 0), reputation_delta INTEGER NOT NULL,
 completed_at INTEGER, UNIQUE(player_id, incident_id)
);
CREATE INDEX IF NOT EXISTS participations_due ON participations(player_id,status,due_at);
CREATE TABLE IF NOT EXISTS attendance (
 participation_id TEXT NOT NULL REFERENCES participations(id) ON DELETE CASCADE,
 volunteer_id TEXT NOT NULL REFERENCES volunteers(id),
 PRIMARY KEY(participation_id,volunteer_id)
);
CREATE TABLE IF NOT EXISTS ledger (
 id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
 participation_id TEXT REFERENCES participations(id), kind TEXT NOT NULL,
 amount INTEGER NOT NULL, balance_after INTEGER NOT NULL CHECK(balance_after >= 0),
 description TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_owner ON ledger(player_id,created_at DESC);
CREATE TABLE IF NOT EXISTS operations (
 player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
 request_key TEXT NOT NULL, request_hash TEXT NOT NULL, operation TEXT NOT NULL,
 entity_id TEXT NOT NULL, created_at INTEGER NOT NULL,
 PRIMARY KEY(player_id,request_key)
);
