import { progression, distanceKm, sign } from './utils.js';
export const VEHICLES = {
  engine: {
    name: 'Type 1 engine',
    price: 7000,
    minLevel: 1,
    crew: 3,
    speed: 54,
    cost: 85,
    description: 'Versatile first-out apparatus for fire, rescue, and medical calls.'
  },
  brush: {
    name: 'Wildland unit',
    price: 4500,
    minLevel: 2,
    crew: 2,
    speed: 62,
    cost: 55,
    description: 'A nimble two-person response for wildland incidents and alarms.'
  },
  rescue: {
    name: 'Heavy rescue',
    price: 9000,
    minLevel: 3,
    crew: 3,
    speed: 58,
    cost: 100,
    description: 'Specialist capability for medical, collision, and hazardous spills.'
  },
  tanker: {
    name: 'Water tender',
    price: 11000,
    minLevel: 4,
    crew: 3,
    speed: 45,
    cost: 120,
    description: 'Water support for structure fires and rural alarm response.'
  }
};
export const RECRUIT_COST = 650;
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
  const travelMs = Math.round(((km / spec.speed) * 3600000) / 12); // simulation is 12x travel speed
  const duration = event.duration + travelMs;
  const cost = spec.cost + event.severity * 25 + Math.ceil(km * 4);
  const chance = Math.min(
    0.98,
    0.74 +
      average * 0.045 -
      (event.severity - 1) * 0.045 +
      (vehicle.type === 'brush' && event.key === 'brush' ? 0.09 : 0)
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
    responseReserve: RESPONSE_RESERVE,
    stationUpgradeCost: stationUpgradeCost(organization.station_level),
    capacities: capacities(organization.station_level),
    progression: progression(player.xp)
  };
}
