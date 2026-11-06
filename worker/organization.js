import { one, stmt, mutate, ledgerWrite } from './database.js';
import {
  VEHICLES,
  RECRUIT_COST,
  RESPONSE_RESERVE,
  capacities,
  stationUpgradeCost,
  trainingCost
} from './economy.js';
import { requireThat, cleanName, id, now, progression } from './utils.js';
const FIRST = [
  'Alex',
  'Jordan',
  'Morgan',
  'Taylor',
  'Casey',
  'Sam',
  'Riley',
  'Jamie',
  'Avery',
  'Drew',
  'Blake',
  'Cameron'
];
const LAST = [
  'Bennett',
  'Morales',
  'Chen',
  'Patel',
  'Brooks',
  'Sullivan',
  'Reed',
  'Hayes',
  'Rivera',
  'Kim',
  'Foster',
  'Ellis'
];
export async function organizationAction(env, player, request, data) {
  const org = await one(env.DB, 'SELECT * FROM organizations WHERE player_id=?', player.id);
  const t = now(),
    entityId = id(),
    level = progression(player.xp).level,
    cap = capacities(org.station_level);
  let amount = 0,
    description = '',
    writes = [],
    where = '',
    args = [],
    operation;
  if (data.action === 'recruit') {
    const n = await one(
      env.DB,
      'SELECT COUNT(*) AS n FROM volunteers WHERE player_id=?',
      player.id
    );
    const name =
      FIRST[n.n % FIRST.length] + ' ' + LAST[Math.floor(n.n / FIRST.length + n.n) % LAST.length];
    amount = RECRUIT_COST;
    description = `Volunteer recruitment · ${name}`;
    operation = 'recruit';
    where = '(SELECT COUNT(*) FROM volunteers WHERE player_id=?)<?';
    args = [player.id, cap.volunteers];
    requireThat(n.n < cap.volunteers, 'Upgrade the station to recruit more volunteers.');
    writes.push(({ gate, params }) =>
      stmt(
        env.DB,
        `INSERT INTO volunteers(id,player_id,name,role,skill,created_at) SELECT ?,?,?,?,1,? WHERE ${gate}`,
        entityId,
        player.id,
        name,
        'Firefighter',
        t,
        ...params
      )
    );
  } else if (data.action === 'purchase') {
    const spec = VEHICLES[data.type];
    requireThat(spec, 'Unknown vehicle type.');
    requireThat(level >= spec.minLevel, `This vehicle unlocks at level ${spec.minLevel}.`);
    const n = await one(env.DB, 'SELECT COUNT(*) AS n FROM vehicles WHERE player_id=?', player.id);
    requireThat(n.n < cap.vehicles, 'Upgrade the station to add another apparatus bay.');
    amount = spec.price;
    description = `Apparatus purchase · ${spec.name}`;
    operation = `purchase:${data.type}`;
    where = '(SELECT COUNT(*) FROM vehicles WHERE player_id=?)<?';
    args = [player.id, cap.vehicles];
    writes.push(({ gate, params }) =>
      stmt(
        env.DB,
        `INSERT INTO vehicles(id,player_id,type,name,created_at) SELECT ?,?,?,?,? WHERE ${gate}`,
        entityId,
        player.id,
        data.type,
        `${data.type.toUpperCase()} ${String(n.n + 1).padStart(2, '0')}`,
        t,
        ...params
      )
    );
  } else if (data.action === 'train') {
    const v = await one(
      env.DB,
      'SELECT * FROM volunteers WHERE id=? AND player_id=?',
      data.volunteerId || '',
      player.id
    );
    requireThat(v, 'Volunteer not found.', 404);
    requireThat(v.skill < 5, 'This volunteer is fully qualified.');
    requireThat(v.busy_until <= t, 'This volunteer is currently unavailable.', 409);
    amount = trainingCost(v.skill);
    description = `Training · ${v.name}`;
    operation = `train:${v.id}`;
    where =
      'EXISTS(SELECT 1 FROM volunteers WHERE id=? AND player_id=? AND busy_until<=? AND skill=?)';
    args = [v.id, player.id, t, v.skill];
    writes.push(({ gate, params }) =>
      stmt(
        env.DB,
        `UPDATE volunteers SET skill=skill+1,busy_until=?,training_until=? WHERE id=? AND ${gate}`,
        t + 60000,
        t + 60000,
        v.id,
        ...params
      )
    );
  } else if (data.action === 'upgrade') {
    requireThat(org.station_level < 4, 'Your station is fully upgraded.');
    requireThat(
      level >= org.station_level + 1,
      `Station expansion requires chief level ${org.station_level + 1}.`
    );
    amount = stationUpgradeCost(org.station_level);
    description = `Station expansion · tier ${org.station_level + 1}`;
    operation = 'upgrade';
    where = 'EXISTS(SELECT 1 FROM organizations WHERE player_id=? AND station_level=?)';
    args = [player.id, org.station_level];
    writes.push(({ gate, params }) =>
      stmt(
        env.DB,
        `UPDATE organizations SET station_level=station_level+1 WHERE player_id=? AND ${gate}`,
        player.id,
        ...params
      )
    );
  } else if (data.action === 'rename') {
    const name = cleanName(data.name);
    operation = `rename:${name}`;
    writes.push(({ gate, params }) =>
      stmt(
        env.DB,
        `UPDATE organizations SET name=? WHERE player_id=? AND ${gate}`,
        name,
        player.id,
        ...params
      )
    );
  } else requireThat(false, 'Unknown organization action.');
  requireThat(player.balance >= amount, 'Your department does not have enough funds.');
  if (amount)
    requireThat(
      player.balance - amount >= RESPONSE_RESERVE,
      `Keep a $${RESPONSE_RESERVE} response reserve when investing in the department.`
    );
  if (amount) writes.push(ledgerWrite(env.DB, player.id, null, data.action, -amount, description));
  return mutate(env.DB, player, request, operation, entityId, -amount, where, args, writes);
}
