import { all, one, stmt, mutate, ledgerWrite } from './database.js';
import { validateEvent } from './events.js';
import { VEHICLES, responseResult } from './economy.js';
import { requireThat, id, now, progression } from './utils.js';
export async function dispatch(env, player, request, data) {
  const event = await validateEvent(env, player.id, data.incidentId);
  requireThat(
    progression(player.xp).level >= event.minLevel,
    `This call requires chief level ${event.minLevel}.`
  );
  requireThat(typeof data.vehicleId === 'string', 'Choose a vehicle.');
  requireThat(
    Array.isArray(data.crewIds) &&
      data.crewIds.length >= event.crew &&
      data.crewIds.length <= 3 &&
      data.crewIds.every((x) => typeof x === 'string') &&
      new Set(data.crewIds).size === data.crewIds.length,
    'Choose the required number of distinct volunteers.'
  );
  const vehicle = await one(
    env.DB,
    'SELECT * FROM vehicles WHERE id=? AND player_id=?',
    data.vehicleId,
    player.id
  );
  requireThat(vehicle, 'Vehicle not found.', 404);
  requireThat(
    event.types.includes(VEHICLES[vehicle.type]?.kind),
    'This vehicle is not suitable for this incident.'
  );
  requireThat(
    data.crewIds.length <= (VEHICLES[vehicle.type]?.crew ?? 0),
    'Too many crew for this vehicle.'
  );
  const crew = await all(
    env.DB,
    `SELECT * FROM volunteers WHERE player_id=? AND id IN (${data.crewIds.map(() => '?').join(',')})`,
    player.id,
    ...data.crewIds
  );
  requireThat(
    crew.length === data.crewIds.length,
    'A selected volunteer is not in your department.'
  );
  const t = now();
  requireThat(
    vehicle.busy_until <= t && crew.every((v) => v.busy_until <= t),
    'A selected unit or volunteer is unavailable.',
    409
  );
  const org = await one(env.DB, 'SELECT * FROM organizations WHERE player_id=?', player.id);
  const result = await responseResult(env, player, event, vehicle, crew, org),
    pId = id(),
    due = t + result.duration;
  requireThat(player.balance >= result.cost, 'Not enough funds for this response.');
  const placeholders = data.crewIds.map(() => '?').join(',');
  return mutate(
    env.DB,
    player,
    request,
    `dispatch:${event.id}:${vehicle.id}:${[...data.crewIds].sort().join(',')}`,
    pId,
    -result.cost,
    `EXISTS(SELECT 1 FROM vehicles WHERE id=? AND player_id=? AND busy_until<=?)
     AND (SELECT COUNT(*) FROM volunteers WHERE player_id=? AND id IN (${placeholders}) AND busy_until<=?)=?
     AND NOT EXISTS(SELECT 1 FROM participations WHERE player_id=? AND incident_id=?)`,
    [
      vehicle.id,
      player.id,
      t,
      player.id,
      ...data.crewIds,
      t,
      data.crewIds.length,
      player.id,
      event.id
    ],
    [
      ({ gate, params }) =>
        stmt(
          env.DB,
          `INSERT INTO participations(id,player_id,incident_id,incident_json,vehicle_id,crew_json,started_at,due_at,outcome,cost,reward,xp_reward,reputation_delta)
        SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${gate}`,
          pId,
          player.id,
          event.id,
          JSON.stringify(event),
          vehicle.id,
          JSON.stringify(crew.map((v) => ({ id: v.id, name: v.name }))),
          t,
          due,
          result.outcome,
          result.cost,
          result.reward,
          result.xpReward,
          result.reputationDelta,
          ...params
        ),
      ({ gate, params }) =>
        stmt(
          env.DB,
          `UPDATE vehicles SET busy_until=? WHERE id=? AND ${gate}`,
          due,
          vehicle.id,
          ...params
        ),
      ...crew.flatMap((v) => [
        ({ gate, params }) =>
          stmt(
            env.DB,
            `UPDATE volunteers SET busy_until=?,attendance_count=attendance_count+1 WHERE id=? AND ${gate}`,
            due,
            v.id,
            ...params
          ),
        ({ gate, params }) =>
          stmt(
            env.DB,
            `INSERT INTO attendance(participation_id,volunteer_id) SELECT ?,? WHERE ${gate}`,
            pId,
            v.id,
            ...params
          )
      ]),
      ledgerWrite(env.DB, player.id, pId, 'response', -result.cost, `Response · ${event.name}`)
    ]
  );
}
// Called lazily by authenticated requests. Nothing is charged while the player is away.
// The transaction guard makes reward settlement safe under concurrent polling.
export async function settle(env, playerId, time = now()) {
  const pending = await all(
    env.DB,
    "SELECT * FROM participations WHERE player_id=? AND status='responding' AND due_at<=? ORDER BY due_at LIMIT 20",
    playerId,
    time
  );
  for (const p of pending) {
    const op = id(),
      gate = 'EXISTS (SELECT 1 FROM players WHERE id=? AND last_op=?)',
      args = [playerId, op];
    await env.DB.batch([
      stmt(
        env.DB,
        `UPDATE players SET balance=balance+?,xp=xp+?,reputation=MIN(100,MAX(0,reputation+?)),version=version+1,last_op=?
        WHERE id=? AND EXISTS(SELECT 1 FROM participations WHERE id=? AND status='responding' AND due_at<=?)`,
        p.reward,
        p.xp_reward,
        p.reputation_delta,
        op,
        playerId,
        p.id,
        time
      ),
      stmt(
        env.DB,
        `UPDATE participations SET status='completed',completed_at=? WHERE id=? AND ${gate}`,
        p.due_at,
        p.id,
        ...args
      ),
      stmt(
        env.DB,
        `UPDATE volunteers SET successful_count=successful_count+? WHERE id IN (SELECT volunteer_id FROM attendance WHERE participation_id=?) AND ${gate}`,
        p.outcome === 'successful' ? 1 : 0,
        p.id,
        ...args
      ),
      stmt(
        env.DB,
        `INSERT INTO ledger(id,player_id,participation_id,kind,amount,balance_after,description,created_at)
        SELECT ?,?,?, 'award',?,balance,?,? FROM players WHERE id=? AND ${gate}`,
        op + '-award',
        playerId,
        p.id,
        p.reward,
        `${p.outcome === 'successful' ? 'Successful response' : 'Incident contained'} · service grant`,
        p.due_at,
        playerId,
        ...args
      )
    ]);
  }
}
