import { stmt, one } from './database.js';
import { GameError, requireThat, hex, sign, equal, now, randomToken } from './utils.js';

// Cloudflare Workers caps PBKDF2 at 100,000 iterations.
const ITERATIONS = 100000;
const enc = new TextEncoder();
const POLICY = {
  password: {
    hash: 'password_hash',
    salt: 'password_salt',
    fails: 'password_failures',
    lock: 'password_locked_until',
    max: 5,
    ms: 15 * 60000,
    label: 'password'
  },
  pin: {
    hash: 'pin_hash',
    salt: 'pin_salt',
    fails: 'pin_failures',
    lock: 'pin_locked_until',
    max: 5,
    ms: 60 * 60000,
    label: 'recovery PIN'
  }
};
const WEAK_PINS = new Set([
  '012345', '123456', '234567', '345678', '456789', '543210', '654321', '765432',
  '876543', '987654', '123123', '121212', '112233', '101010', '123321'
]);
const DUMMY_SALT = '00112233445566778899aabbccddeeff';
const bytes = (h) => Uint8Array.from(h.match(/../g), (x) => parseInt(x, 16));
const isUnique = (e) => /UNIQUE/i.test(String(e?.message || e) + String(e?.cause?.message || ''));

export function cleanUsername(value) {
  const name = typeof value === 'string' ? value.trim().toLowerCase() : '';
  requireThat(
    /^[a-z0-9_]{3,20}$/.test(name),
    'Username must be 3–20 letters, numbers or underscores.'
  );
  return name;
}
export function cleanPassword(value, username) {
  requireThat(
    typeof value === 'string' && value.length >= 8 && value.length <= 128,
    'Password must be 8–128 characters.'
  );
  requireThat(value.toLowerCase() !== username, 'Password cannot be your username.');
  return value;
}
export function cleanPin(value) {
  requireThat(typeof value === 'string' && /^\d{6}$/.test(value), 'Recovery PIN must be 6 digits.');
  requireThat(!/^(\d)\1{5}$/.test(value) && !WEAK_PINS.has(value), 'Choose a less guessable PIN.');
  return value;
}
// The server secret is mixed in first (HMAC), so a leaked database alone cannot be used to
// brute-force a 6-digit PIN offline. Rotating SESSION_SECRET therefore invalidates logins.
async function derive(env, kind, username, secret, salt) {
  const material = await sign(env.SESSION_SECRET, `${kind}:${username}:${secret}`);
  const key = await crypto.subtle.importKey('raw', enc.encode(material), 'PBKDF2', false, [
    'deriveBits'
  ]);
  return hex(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: bytes(salt), iterations: ITERATIONS },
      key,
      256
    )
  );
}
async function makeSecret(env, kind, username, secret) {
  const salt = randomToken().slice(0, 32);
  return { salt, hash: await derive(env, kind, username, secret, salt) };
}
export async function newCredentials(env, data) {
  const username = cleanUsername(data.username),
    password = cleanPassword(data.password, username),
    pin = cleanPin(data.pin);
  const p = await makeSecret(env, 'password', username, password),
    q = await makeSecret(env, 'pin', username, pin);
  return {
    username,
    passwordHash: p.hash,
    passwordSalt: p.salt,
    pinHash: q.hash,
    pinSalt: q.salt
  };
}
// Verifies a secret with per-account lockout. Unknown usernames cost the same work.
async function attempt(env, kind, player, username, secret) {
  const c = POLICY[kind],
    t = now();
  requireThat(typeof secret === 'string' && secret.length <= 128, `Enter your ${c.label}.`);
  if (player && player[c.lock] > t)
    throw new GameError(
      `Too many attempts. Try again in ${Math.ceil((player[c.lock] - t) / 60000)} minute(s).`,
      429
    );
  const known = player && player[c.hash];
  const candidate = await derive(env, kind, username, secret, known ? player[c.salt] : DUMMY_SALT);
  if (!known || !equal(candidate, player[c.hash])) {
    if (player)
      await stmt(
        env.DB,
        `UPDATE players SET ${c.fails}=CASE WHEN ${c.fails}+1>=? THEN 0 ELSE ${c.fails}+1 END,
         ${c.lock}=CASE WHEN ${c.fails}+1>=? THEN ? ELSE ${c.lock} END WHERE id=?`,
        c.max,
        c.max,
        t + c.ms,
        player.id
      ).run();
    throw new GameError(`Username or ${c.label} incorrect.`, 401);
  }
  if (player[c.fails])
    await stmt(env.DB, `UPDATE players SET ${c.fails}=0 WHERE id=?`, player.id).run();
}
const byUsername = (env, username) =>
  one(env.DB, 'SELECT * FROM players WHERE username=?', username);
const lower = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

export async function login(env, data) {
  const username = lower(data.username),
    player = await byUsername(env, username);
  await attempt(env, 'password', player, username, data.password);
  return player;
}
// Forgot password: the PIN proves ownership and the new password replaces the old one.
export async function recover(env, data) {
  const username = lower(data.username),
    player = await byUsername(env, username);
  requireThat(typeof data.pin === 'string' && /^\d{6}$/.test(data.pin), 'Enter your 6-digit PIN.');
  const password = cleanPassword(data.password, username);
  await attempt(env, 'pin', player, username, data.pin);
  const p = await makeSecret(env, 'password', username, password);
  await stmt(
    env.DB,
    'UPDATE players SET password_hash=?,password_salt=?,password_failures=0,password_locked_until=0 WHERE id=?',
    p.hash,
    p.salt,
    player.id
  ).run();
  return player;
}
export async function accountAction(env, player, data) {
  if (data.action === 'change-password') {
    await attempt(env, 'password', player, player.username, data.currentPassword);
    const p = await makeSecret(
      env,
      'password',
      player.username,
      cleanPassword(data.password, player.username)
    );
    await stmt(
      env.DB,
      'UPDATE players SET password_hash=?,password_salt=? WHERE id=?',
      p.hash,
      p.salt,
      player.id
    ).run();
    return { ok: true };
  }
  if (data.action === 'change-pin') {
    await attempt(env, 'password', player, player.username, data.currentPassword);
    const q = await makeSecret(env, 'pin', player.username, cleanPin(data.pin));
    await stmt(
      env.DB,
      'UPDATE players SET pin_hash=?,pin_salt=?,pin_failures=0,pin_locked_until=0 WHERE id=?',
      q.hash,
      q.salt,
      player.id
    ).run();
    return { ok: true };
  }
  throw new GameError('Unknown account action.');
}
export { isUnique };
