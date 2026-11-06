import { sign, equal, requireThat, now } from './utils.js';
export const BUCKET_MS = 120000;
export const INCIDENT_TYPES = [
  {
    key: 'medical',
    name: 'Medical assist',
    category: 'Medical',
    severity: 1,
    minLevel: 1,
    crew: 2,
    types: ['ambulance', 'rescue', 'engine'],
    baseReward: 420,
    xp: 75,
    duration: 55000,
    description: 'Assist local EMS with patient access and safe transfer.'
  },
  {
    key: 'collision',
    name: 'Motor vehicle collision',
    category: 'Rescue',
    severity: 2,
    minLevel: 1,
    crew: 3,
    types: ['rescue', 'engine', 'ambulance'],
    baseReward: 620,
    xp: 100,
    duration: 75000,
    description: 'Secure the scene, stabilize the vehicle, and support extraction.'
  },
  {
    key: 'alarm',
    name: 'Automatic fire alarm',
    category: 'Alarm',
    severity: 1,
    minLevel: 1,
    crew: 2,
    types: ['engine', 'brush', 'rescue', 'tanker'],
    water: true,
    baseReward: 350,
    xp: 65,
    duration: 45000,
    description: 'Investigate an activated alarm and make the premises safe.'
  },
  {
    key: 'brush',
    name: 'Vegetation fire',
    category: 'Wildland',
    severity: 2,
    minLevel: 2,
    crew: 2,
    types: ['brush', 'engine', 'tanker'],
    water: true,
    baseReward: 800,
    xp: 130,
    duration: 85000,
    description: 'Establish a firebreak and protect the nearby properties.'
  },
  {
    key: 'structure',
    name: 'Residential structure fire',
    category: 'Structure',
    severity: 3,
    minLevel: 2,
    crew: 3,
    types: ['engine', 'tanker', 'aerial'],
    water: true,
    baseReward: 1150,
    xp: 170,
    duration: 110000,
    description: 'Conduct a primary search, contain the fire, and protect exposures.'
  },
  {
    key: 'hazmat',
    name: 'Hazardous material spill',
    category: 'Hazmat',
    severity: 3,
    minLevel: 4,
    crew: 3,
    types: ['rescue', 'engine'],
    baseReward: 1500,
    xp: 210,
    duration: 130000,
    description: 'Isolate the spill, establish a safe perimeter, and contain runoff.'
  },
  {
    key: 'trauma',
    name: 'Trauma response',
    category: 'Medical',
    severity: 2,
    minLevel: 2,
    crew: 2,
    types: ['ambulance', 'rescue'],
    baseReward: 780,
    xp: 120,
    duration: 70000,
    description: 'Reach a critically injured patient and stabilize them for the hospital.'
  },
  {
    key: 'highrise',
    name: 'High-rise fire',
    category: 'Structure',
    severity: 3,
    minLevel: 5,
    crew: 4,
    types: ['aerial', 'engine', 'tanker'],
    water: true,
    baseReward: 2100,
    xp: 280,
    duration: 150000,
    description: 'Attack from above, evacuate the upper floors, and protect the stairwells.'
  }
];
export const SITES = [
  { name: 'EDSA · Cubao, Quezon City', lon: 121.0527, lat: 14.6204 },
  { name: 'Commonwealth Avenue · Quezon City', lon: 121.06, lat: 14.67 },
  { name: 'Katipunan Avenue · Quezon City', lon: 121.077, lat: 14.637 },
  { name: 'Kamuning · Quezon City', lon: 121.036, lat: 14.63 },
  { name: 'Novaliches · Quezon City', lon: 121.037, lat: 14.717 },
  { name: 'Monumento · Caloocan', lon: 120.984, lat: 14.654 },
  { name: 'Valenzuela · MacArthur Highway', lon: 120.983, lat: 14.7 },
  { name: 'Malabon Poblacion', lon: 120.957, lat: 14.6625 },
  { name: 'Divisoria · Manila', lon: 120.9715, lat: 14.602 },
  { name: 'Tondo · Manila', lon: 120.968, lat: 14.62 },
  { name: 'Sampaloc · Manila', lon: 120.995, lat: 14.614 },
  { name: 'Ermita · Manila', lon: 120.985, lat: 14.583 },
  { name: 'Greenhills · San Juan', lon: 121.046, lat: 14.602 },
  { name: 'Shaw Boulevard · Mandaluyong', lon: 121.043, lat: 14.581 },
  { name: 'Ortigas Center · Pasig', lon: 121.06, lat: 14.586 },
  { name: 'Kapitolyo · Pasig', lon: 121.064, lat: 14.572 },
  { name: 'Riverbanks · Marikina', lon: 121.097, lat: 14.631 },
  { name: 'Ayala Avenue · Makati', lon: 121.0245, lat: 14.5547 },
  { name: 'Guadalupe · Makati', lon: 121.0457, lat: 14.5672 },
  { name: 'Bonifacio Global City · Taguig', lon: 121.045, lat: 14.551 },
  { name: 'Taft Avenue · Pasay', lon: 120.997, lat: 14.538 },
  { name: 'Baclaran · Parañaque', lon: 120.999, lat: 14.527 },
  { name: 'BF Homes · Parañaque', lon: 121.02, lat: 14.46 },
  { name: 'Zapote Road · Las Piñas', lon: 120.993, lat: 14.45 }
];
export async function eventFor(env, playerId, bucket, slot) {
  const digest = await sign(env.SESSION_SECRET, `event-v1:${playerId}:${bucket}:${slot}`);
  const pick = (start, max) => parseInt(digest.slice(start, start + 8), 16) % max;
  // Slot zero is always an entry-level incident, so every new feed is playable.
  const type = INCIDENT_TYPES[pick(0, slot === 0 ? 3 : INCIDENT_TYPES.length)],
    site = SITES[pick(8, SITES.length)];
  return {
    ...type,
    id: `${bucket}.${slot}.${digest.slice(0, 32)}`,
    location: site.name,
    lon: site.lon + (pick(16, 100) - 50) * 0.00003,
    lat: site.lat + (pick(24, 100) - 50) * 0.00003,
    issuedAt: bucket * BUCKET_MS,
    expiresAt: (bucket + 3) * BUCKET_MS,
    reference: `FC-${String(bucket % 10000).padStart(4, '0')}${slot}`
  };
}
export async function feed(env, playerId, time = now()) {
  const bucket = Math.floor(time / BUCKET_MS),
    events = [];
  for (let b = bucket; b >= bucket - 2; b--)
    for (let s = 0; s < 3; s++) events.push(await eventFor(env, playerId, b, s));
  return events;
}
export async function validateEvent(env, playerId, token, time = now()) {
  requireThat(
    typeof token === 'string' && /^\d{5,12}\.[0-2]\.[a-f0-9]{32}$/.test(token),
    'Invalid incident.'
  );
  const [b, s] = token.split('.').map(Number),
    current = Math.floor(time / BUCKET_MS);
  requireThat(
    b <= current && b >= current - 2,
    'This incident has cleared. Select a current call.',
    409
  );
  const event = await eventFor(env, playerId, b, s);
  requireThat(equal(event.id, token), 'This incident does not belong to your dispatch feed.', 403);
  return event;
}
