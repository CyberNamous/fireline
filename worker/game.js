import { one, all, stmt } from './database.js';
import { feed } from './events.js';
import { catalog } from './economy.js';
import { settle } from './dispatch.js';
import { login, recover, newCredentials, isUnique } from './auth.js';
import {
  GameError,
  hash,
  randomToken,
  id,
  now,
  sign,
  requireThat,
  cleanName,
  sessionCookie,
  cookieToken
} from './utils.js';
export async function authenticate(request, env) {
  const token = cookieToken(request);
  requireThat(token, 'Sign in to your department.', 401);
  const player = await one(
    env.DB,
    'SELECT * FROM players WHERE session_hash=? AND session_expires_at>?',
    await hash(token),
    now()
  );
  requireThat(
    player,
    'Your session has expired. Sign in with your username and password.',
    401
  );
  return { player, token };
}
async function startSession(env, playerId, sessionHash, expiry) {
  await stmt(
    env.DB,
    'UPDATE players SET session_hash=?,session_expires_at=?,version=version+1 WHERE id=?',
    sessionHash,
    expiry,
    playerId
  ).run();
  return one(env.DB, 'SELECT * FROM players WHERE id=?', playerId);
}
export async function createSession(request, env, data) {
  const action = data.action;
  requireThat(
    action === undefined || ['register', 'login', 'recover'].includes(action),
    'Unknown account action.'
  );
  if (cookieToken(request) && !action) {
    try {
      const { player, token } = await authenticate(request, env);
      return { player, token };
    } catch (error) {
      if (error.status !== 401) throw error;
    }
  }
  const token = randomToken(),
    sessionHash = await hash(token),
    expiry = now() + 15552000000;
  if (action === 'login' || action === 'recover') {
    const found = action === 'login' ? await login(env, data) : await recover(env, data);
    return { player: await startSession(env, found.id, sessionHash, expiry), token };
  }
  const name = cleanName(data.name, 'Chief Reyes'),
    department = cleanName(data.department, 'Pasig River Volunteer Fire Brigade'),
    creds = await newCredentials(env, data),
    playerId = id(),
    orgId = id(),
    t = now();
  requireThat(
    !(await one(env.DB, 'SELECT 1 AS x FROM players WHERE username=?', creds.username)),
    'That username is already taken.',
    409
  );
  const names = [
    'Juan dela Cruz',
    'Maria Santos',
    'Jose Ramos',
    'Angelica Bautista',
    'Mark Villanueva',
    'Rhea Mendoza'
  ];
  try {
    await env.DB.batch([
      stmt(
        env.DB,
        'INSERT INTO players(id,name,session_hash,session_expires_at,created_at,username,password_hash,password_salt,pin_hash,pin_salt) VALUES(?,?,?,?,?,?,?,?,?,?)',
        playerId,
        name,
        sessionHash,
        expiry,
        t,
        creds.username,
        creds.passwordHash,
        creds.passwordSalt,
        creds.pinHash,
        creds.pinSalt
      ),
      stmt(
        env.DB,
        'INSERT INTO organizations(id,player_id,name) VALUES(?,?,?)',
        orgId,
        playerId,
        department
      ),
      stmt(
        env.DB,
        "INSERT INTO vehicles(id,player_id,type,name,created_at) VALUES(?,?,'engine','ENGINE 01',?)",
        id(),
        playerId,
        t
      ),
      ...names.map((n, i) =>
        stmt(
          env.DB,
          'INSERT INTO volunteers(id,player_id,name,role,skill,created_at) VALUES(?,?,?,?,?,?)',
          id(),
          playerId,
          n,
          i === 0 ? 'Captain' : i === 1 ? 'Driver / operator' : 'Firefighter',
          i < 2 ? 3 : 2,
          t
        )
      ),
      stmt(
        env.DB,
        "INSERT INTO ledger(id,player_id,kind,amount,balance_after,description,created_at) VALUES(?,?,'founding_grant',12500,12500,'Founding community grant',?)",
        id(),
        playerId,
        t
      )
    ]);
  } catch (e) {
    if (isUnique(e)) throw new GameError('That username is already taken.', 409);
    throw e;
  }
  return { player: await one(env.DB, 'SELECT * FROM players WHERE id=?', playerId), token };
}
export async function state(env, playerId, token) {
  await settle(env, playerId);
  const player = await one(env.DB, 'SELECT * FROM players WHERE id=?', playerId);
  const organization = await one(env.DB, 'SELECT * FROM organizations WHERE player_id=?', playerId);
  const volunteers = await all(
    env.DB,
    'SELECT id,name,role,skill,busy_until,training_until,attendance_count,successful_count FROM volunteers WHERE player_id=? ORDER BY created_at,id',
    playerId
  );
  const vehicles = await all(
    env.DB,
    'SELECT id,type,name,busy_until FROM vehicles WHERE player_id=? ORDER BY created_at,id',
    playerId
  );
  const rows = await all(
    env.DB,
    'SELECT * FROM participations WHERE player_id=? ORDER BY started_at DESC LIMIT 100',
    playerId
  );
  const history = rows.map((p) => ({
    id: p.id,
    incident: JSON.parse(p.incident_json),
    vehicleId: p.vehicle_id,
    crew: JSON.parse(p.crew_json),
    startedAt: p.started_at,
    dueAt: p.due_at,
    status: p.status,
    cost: p.cost,
    ...(p.status === 'completed'
      ? { outcome: p.outcome, reward: p.reward, xp: p.xp_reward, completedAt: p.completed_at }
      : {})
  }));
  const ledger = await all(
    env.DB,
    'SELECT id,kind,amount,balance_after,description,created_at FROM ledger WHERE player_id=? ORDER BY created_at DESC,id DESC LIMIT 100',
    playerId
  );
  const stats = await one(
    env.DB,
    `SELECT COUNT(*) AS attended,COALESCE(SUM(status='completed'),0) AS completed,COALESCE(SUM(status='completed' AND outcome='successful'),0) AS successful FROM participations WHERE player_id=?`,
    playerId
  );
  const incidents = (await feed(env, playerId)).filter(
    (e) => !rows.some((p) => p.incident_id === e.id)
  );
  return {
    serverTime: now(),
    player: {
      id: player.id,
      name: player.name,
      balance: player.balance,
      xp: player.xp,
      reputation: player.reputation,
      username: player.username
    },
    organization,
    volunteers,
    vehicles,
    incidents,
    history,
    ledger,
    stats,
    catalog: catalog(player, organization),
    csrf: await sign(env.SESSION_SECRET, 'csrf:' + token)
  };
}
export { sessionCookie };
