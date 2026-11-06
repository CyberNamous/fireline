export class GameError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function requireThat(ok, message, status = 400) {
  if (!ok) throw new GameError(message, status);
}
export const now = () => Date.now();
export const id = () => crypto.randomUUID();
export function randomToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
const encode = new TextEncoder();
export async function hash(text) {
  return hex(await crypto.subtle.digest('SHA-256', encode.encode(text)));
}
export function hex(bytes) {
  return [...new Uint8Array(bytes)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export async function sign(secret, text) {
  const key = await crypto.subtle.importKey(
    'raw',
    encode.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return hex(await crypto.subtle.sign('HMAC', key, encode.encode(text)));
}
export function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let n = 0;
  for (let i = 0; i < a.length; i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return n === 0;
}
export function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers
    }
  });
}
export async function body(request) {
  requireThat(
    request.headers.get('Content-Type')?.split(';')[0].trim() === 'application/json',
    'Use application/json.',
    415
  );
  const length = Number(request.headers.get('Content-Length') || 0);
  requireThat(length <= 8192, 'Request is too large.', 413);
  const text = await request.text();
  requireThat(encode.encode(text).length <= 8192, 'Request is too large.', 413);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new GameError('Invalid JSON.');
  }
  requireThat(data && typeof data === 'object' && !Array.isArray(data), 'Expected a JSON object.');
  return data;
}
export function cleanName(value, fallback) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : fallback;
  requireThat(
    typeof name === 'string' &&
      name.length >= 2 &&
      name.length <= 40 &&
      !/[<>\x00-\x1f]/.test(name),
    'Use a name of 2–40 characters, without markup.'
  );
  return name;
}
export function distanceKm(a, b) {
  const rad = (x) => (x * Math.PI) / 180,
    dLat = rad(b.lat - a.lat),
    dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function cookieToken(request) {
  return /(?:^|;\s*)fireline_session=([a-f0-9]{64})(?:;|$)/.exec(
    request.headers.get('Cookie') || ''
  )?.[1];
}
export function sessionCookie(token, request, clear = false) {
  return `fireline_session=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 15552000}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export const LEVELS = [0, 200, 650, 1400, 2600, 4500, 7000, 10000, 14000, 19000];
export function progression(xp) {
  let level = 1;
  while (level < LEVELS.length && xp >= LEVELS[level]) level++;
  return {
    level,
    title: [
      'Probationary chief',
      'Crew leader',
      'Station chief',
      'District chief',
      'Battalion chief',
      'Deputy chief',
      'Fire chief',
      'Regional chief',
      'Area commander',
      'Commissioner'
    ][level - 1],
    floor: LEVELS[level - 1],
    next: LEVELS[level] ?? null
  };
}
