import { GameError, requireThat, hash, id, now } from './utils.js';
export const stmt = (db, sql, ...args) => db.prepare(sql).bind(...args);
export async function one(db, sql, ...args) {
  return stmt(db, sql, ...args).first();
}
export async function all(db, sql, ...args) {
  return (await stmt(db, sql, ...args).all()).results;
}
// A version compare-and-swap wins exactly once; every following write is gated by
// that fresh operation UUID. D1 batch is transactional (including the first write).
export async function mutate(
  db,
  player,
  request,
  operation,
  entityId,
  delta,
  extraWhere,
  extraArgs,
  writes
) {
  const key = request.headers.get('Idempotency-Key');
  requireThat(
    typeof key === 'string' && /^[a-zA-Z0-9_-]{16,80}$/.test(key),
    'A valid Idempotency-Key is required.'
  );
  const fingerprint = request.actionHash || (await hash(operation));
  const previous = await one(
    db,
    'SELECT * FROM operations WHERE player_id=? AND request_key=?',
    player.id,
    key
  );
  if (previous) {
    requireThat(
      previous.request_hash === fingerprint,
      'This request key was already used for a different action.',
      409
    );
    return { replayed: true, entityId: previous.entity_id };
  }
  const op = id(),
    t = now();
  const gate = 'EXISTS (SELECT 1 FROM players WHERE id=? AND last_op=?)';
  const statements = [
    stmt(
      db,
      `UPDATE players SET balance=balance+?, version=version+1,last_op=?
    WHERE id=? AND version=? AND balance+?>=0 AND NOT EXISTS
    (SELECT 1 FROM operations WHERE player_id=? AND request_key=?) ${extraWhere ? 'AND (' + extraWhere + ')' : ''}`,
      delta,
      op,
      player.id,
      player.version,
      delta,
      player.id,
      key,
      ...extraArgs
    )
  ];
  for (const write of writes) statements.push(write({ gate, params: [player.id, op], op, t }));
  statements.push(
    stmt(
      db,
      `INSERT INTO operations(player_id,request_key,request_hash,operation,entity_id,created_at)
    SELECT ?,?,?,?,?,? WHERE ${gate}`,
      player.id,
      key,
      fingerprint,
      operation.split(':')[0],
      entityId,
      t,
      player.id,
      op
    )
  );
  const results = await db.batch(statements);
  if (!results[0].meta.changes) {
    const retry = await one(
      db,
      'SELECT * FROM operations WHERE player_id=? AND request_key=?',
      player.id,
      key
    );
    if (retry && retry.request_hash === fingerprint)
      return { replayed: true, entityId: retry.entity_id };
    throw new GameError(
      'Your department changed or the action is no longer available. Refresh and try again.',
      409
    );
  }
  return { replayed: false, entityId };
}
export function ledgerWrite(db, playerId, entityId, kind, amount, description) {
  return ({ gate, params, op, t }) =>
    stmt(
      db,
      `INSERT INTO ledger(id,player_id,participation_id,kind,amount,balance_after,description,created_at)
    SELECT ?,?,?,?,?,balance,?,? FROM players WHERE id=? AND ${gate}`,
      op + '-ledger',
      playerId,
      entityId,
      kind,
      amount,
      description,
      t,
      playerId,
      ...params
    );
}
