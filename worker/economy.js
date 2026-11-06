import { progression, distanceKm, sign } from './utils.js';
export const VEHICLES = {
  minipumper: {
    name: 'Mini pumper',
    kind: 'engine',
    callsign: 'MINI',
    price: 3500,
    minLevel: 1,
    crew: 2,
    speed: 66,
    cost: 50,
    liters: 1000,
    fit: { alarm: 0.04 },
    description: 'Compact 1,000 L first responder that squeezes through narrow streets and alleys.'
  },
  engine: {
    name: 'Type 1 engine',
    kind: 'engine',
    callsign: 'ENGINE',
    price: 7000,
    minLevel: 1,
    crew: 3,
    speed: 54,
    cost: 85,
    liters: 3000,
    description: 'Versatile 3,000 L first-out pumper for fire, rescue, and medical calls.'
  },
  engine_hv: {
    name: 'Heavy pumper',
    kind: 'engine',
    callsign: 'HEAVY',
    price: 10500,
    minLevel: 3,
    crew: 4,
    speed: 50,
    cost: 115,
    liters: 5000,
    fit: { structure: 0.03 },
    description: 'Big 5,000 L pumper with a four-person crew cab and strong structure-fire output.'
  },
  brush: {
    name: 'Wildland unit',
    kind: 'brush',
    callsign: 'BRUSH',
    price: 4500,
    minLevel: 2,
    crew: 2,
    speed: 62,
    cost: 55,
    liters: 800,
    fit: { brush: 0.09 },
    description: 'A nimble 800 L response for grass and vegetation fires and alarms.'
  },
  brush_hv: {
    name: 'Heavy wildland unit',
    kind: 'brush',
    callsign: 'BRUSH HV',
    price: 6800,
    minLevel: 3,
    crew: 3,
    speed: 56,
    cost: 75,
    liters: 2000,
    fit: { brush: 0.11 },
    description: 'Crew-cab 2,000 L brush truck with more water and more hands for larger vegetation fires.'
  },
  rescue_lt: {
    name: 'Light rescue',
    kind: 'rescue',
    callsign: 'RESCUE LT',
    price: 5200,
    minLevel: 2,
    crew: 2,
    speed: 64,
    cost: 65,
    liters: 200,
    fit: { collision: 0.04 },
    description: 'Quick two-person rescue rig with basic extrication and hazard tools.'
  },
  rescue: {
    name: 'Heavy rescue',
    kind: 'rescue',
    callsign: 'RESCUE',
    price: 9000,
    minLevel: 3,
    crew: 3,
    speed: 58,
    cost: 100,
    liters: 500,
    fit: { collision: 0.06, hazmat: 0.06 },
    description: 'Specialist capability for medical, collision, and hazardous spills.'
  },
  tanker_lt: {
    name: 'Light water tender',
    kind: 'tanker',
    callsign: 'TENDER LT',
    price: 7800,
    minLevel: 3,
    crew: 2,
    speed: 50,
    cost: 95,
    liters: 4000,
    description: '4,000 L water supply for areas without hydrants.'
  },
  tanker: {
    name: 'Water tender',
    kind: 'tanker',
    callsign: 'TENDER',
    price: 11000,
    minLevel: 4,
    crew: 3,
    speed: 45,
    cost: 120,
    liters: 6000,
    description: '6,000 L of water support for structure fires and alarm response.'
  },
  tanker_xl: {
    name: 'Water tender XL',
    kind: 'tanker',
    callsign: 'TENDER XL',
    price: 16500,
    minLevel: 6,
    crew: 3,
    speed: 42,
    cost: 150,
    liters: 12000,
    description: 'Massive 12,000 L shuttle tender that keeps long fires fed.'
  },
  ambulance_b: {
    name: 'Basic life support ambulance',
    kind: 'ambulance',
    callsign: 'AMB',
    price: 3200,
    minLevel: 1,
    crew: 2,
    speed: 70,
    cost: 40,
    liters: 0,
    fit: { medical: 0.06, trauma: 0.05, collision: 0.03 },
    description: 'Fast patient transport and first aid for medical calls.'
  },
  ambulance_a: {
    name: 'Advanced life support ambulance',
    kind: 'ambulance',
    callsign: 'ALS',
    price: 6800,
    minLevel: 3,
    crew: 3,
    speed: 66,
    cost: 70,
    liters: 0,
    fit: { medical: 0.1, trauma: 0.12, collision: 0.04 },
    description: 'Paramedic-crewed ambulance with advanced care equipment for critical patients.'
  },
  aerial_ladder: {
    name: 'Aerial ladder · 30 m',
    kind: 'aerial',
    callsign: 'LADDER',
    price: 17000,
    minLevel: 5,
    crew: 3,
    speed: 42,
    cost: 150,
    liters: 1000,
    fit: { structure: 0.07, highrise: 0.1 },
    description: '30 m ladder for rooftop access, rescues from height, and elevated streams.'
  },
  aerial_platform: {
    name: 'Aerial platform · 45 m',
    kind: 'aerial',
    callsign: 'PLATFORM',
    price: 26000,
    minLevel: 7,
    crew: 4,
    speed: 38,
    cost: 190,
    liters: 2000,
    fit: { structure: 0.09, highrise: 0.14 },
    description: '45 m articulating platform for high-rise attack and rescue.'
  }
};
export const RECRUIT_COST = 650;
// Crew roles chosen at recruitment. The stored role is the label, so the starting roster matches too.
export const ROLES = {
  firefighter: {
    label: 'Firefighter',
    cost: RECRUIT_COST,
    description: 'Reliable frontline crew. No special bonus, and the cheapest to recruit.'
  },
  driver: {
    label: 'Driver / operator',
    cost: 750,
    description: 'Gets the apparatus there faster: 10% shorter travel time when on the crew.'
  },
  paramedic: {
    label: 'Paramedic',
    cost: 900,
    description: '+5% success on medical and trauma calls (up to +8% per response).'
  },
  rescue: {
    label: 'Rescue technician',
    cost: 850,
    description: '+4% success on collisions and hazardous spills (up to +8% per response).'
  }
};
export const ROLE_EFFECTS = {
  driverTravel: 0.9,
  bonus: {
    Paramedic: { keys: ['medical', 'trauma'], each: 0.05, cap: 0.08 },
    'Rescue technician': { keys: ['collision', 'hazmat'], each: 0.04, cap: 0.08 }
  }
};
export function crewEffects(eventKey, crew) {
  let bonus = 0;
  for (const [role, b] of Object.entries(ROLE_EFFECTS.bonus))
    if (b.keys.includes(eventKey))
      bonus += Math.min(b.cap, crew.filter((v) => v.role === role).length * b.each);
  return {
    bonus,
    travel: crew.some((v) => v.role === ROLES.driver.label) ? ROLE_EFFECTS.driverTravel : 1
  };
}
// Capital spending cannot strand a new department without response funds.
export const RESPONSE_RESERVE = 400;
export const stationUpgradeCost = (level) => 4000 * level;
export const trainingCost = (skill) => 350 * skill;
export function capacities(stationLevel) {
  return { vehicles: stationLevel + 1, volunteers: 6 + stationLevel * 2 };
}
export function responseEstimate(event, vehicle, crew, organization) {
  const spec = VEHICLES[vehicle.type],
    km = distanceKm(organization, event);
  const average = crew.reduce((sum, v) => sum + v.skill, 0) / crew.length;
  const effects = crewEffects(event.key, crew);
  const travelMs = Math.round((((km / spec.speed) * 3600000) / 12) * effects.travel); // simulation is 12x travel speed
  const duration = event.duration + travelMs;
  const cost = spec.cost + event.severity * 25 + Math.ceil(km * 4);
  const chance = Math.min(
    0.98,
    0.74 +
      average * 0.045 -
      (event.severity - 1) * 0.045 +
      (spec.fit?.[event.key] ?? 0) +
      (event.water ? Math.min(0.12, spec.liters / 100000) : 0) +
      effects.bonus
  );
  return { distance: Math.round(km * 10) / 10, duration, cost, chance: Math.round(chance * 100) };
}
export async function responseResult(env, player, event, vehicle, crew, organization) {
  const estimate = responseEstimate(event, vehicle, crew, organization);
  const digest = await sign(env.SESSION_SECRET, `outcome:${player.id}:${event.id}`);
  const success = parseInt(digest.slice(0, 8), 16) / 0x100000000 < estimate.chance / 100;
  return {
    ...estimate,
    outcome: success ? 'successful' : 'contained',
    reward: Math.round(event.baseReward * (success ? 1 : 0.6)),
    xpReward: Math.round(event.xp * (success ? 1 : 0.7)),
    reputationDelta: success ? 1 : -1
  };
}
export function catalog(player, organization) {
  return {
    vehicles: VEHICLES,
    recruitCost: RECRUIT_COST,
    roles: ROLES,
    roleEffects: ROLE_EFFECTS,
    responseReserve: RESPONSE_RESERVE,
    stationUpgradeCost: stationUpgradeCost(organization.station_level),
    capacities: capacities(organization.station_level),
    progression: progression(player.xp)
  };
}
