import { json, body, requireThat, GameError, equal, sign, sessionCookie, hash } from './utils.js';
import { authenticate, createSession, state } from './game.js';
import { dispatch, settle } from './dispatch.js';
import { organizationAction } from './organization.js';
import { one } from './database.js';
import { accountAction } from './auth.js';
const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};
function secure(response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(SECURITY)) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (!url.pathname.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(request.method))
          return secure(json({ error: 'Method not allowed.' }, 405, { Allow: 'GET, HEAD' }));
        return secure(await env.ASSETS.fetch(request));
      }
      if (url.pathname === '/api/health' && request.method === 'GET')
        return secure(json({ ok: true, version: '1.0.0' }));
      requireThat(
        typeof env.SESSION_SECRET === 'string' &&
          env.SESSION_SECRET.length >= 32 &&
          !env.SESSION_SECRET.startsWith('replace-'),
        'Server configuration incomplete. Set SESSION_SECRET.',
        503
      );
      requireThat(['GET', 'POST'].includes(request.method), 'Method not allowed.', 405);
      if (request.method === 'POST') {
        requireThat(
          request.headers.get('Origin') === url.origin,
          'Cross-origin requests are not accepted.',
          403
        );
        requireThat(
          request.headers.get('Sec-Fetch-Site') !== 'cross-site',
          'Cross-site request rejected.',
          403
        );
      }
      if (url.pathname === '/api/session' && request.method === 'POST') {
        if (env.AUTH_LIMITER) {
          const key = await hash(request.headers.get('CF-Connecting-IP') || 'local-development');
          requireThat(
            (await env.AUTH_LIMITER.limit({ key })).success,
            'Too many account requests. Try again in a minute.',
            429
          );
        }
        const session = await createSession(request, env, await body(request));
        return secure(
          json(
            await state(env, session.player.id, session.token),
            200,
            { 'Set-Cookie': sessionCookie(session.token, request) }
          )
        );
      }
      const auth = await authenticate(request, env);
      if (request.method === 'GET' && url.pathname === '/api/state')
        return secure(json(await state(env, auth.player.id, auth.token)));
      requireThat(request.method === 'POST', 'Route not found.', 404);
      requireThat(
        equal(
          request.headers.get('X-CSRF-Token'),
          await sign(env.SESSION_SECRET, 'csrf:' + auth.token)
        ),
        'Security token invalid. Refresh the page.',
        403
      );
      if (url.pathname === '/api/logout') {
        await body(request);
        await env.DB.prepare(
          'UPDATE players SET session_expires_at=0,version=version+1 WHERE id=? AND session_hash=?'
        )
          .bind(auth.player.id, auth.player.session_hash)
          .run();
        return secure(json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', request, true) }));
      }
      if (url.pathname === '/api/account') {
        if (env.AUTH_LIMITER)
          requireThat(
            (await env.AUTH_LIMITER.limit({ key: 'acct:' + auth.player.id })).success,
            'Too many attempts. Try again in a minute.',
            429
          );
        const result = await accountAction(env, auth.player, await body(request));
        return secure(json({ ...(await state(env, auth.player.id, auth.token)), actionResult: result }));
      }
      requireThat(
        ['/api/dispatch', '/api/organization'].includes(url.pathname),
        'Route not found.',
        404
      );
      if (env.ACTION_LIMITER)
        requireThat(
          (await env.ACTION_LIMITER.limit({ key: auth.player.id })).success,
          'Command rate limit reached. Try again in a minute.',
          429
        );
      const data = await body(request);
      const key = request.headers.get('Idempotency-Key');
      requireThat(
        typeof key === 'string' && /^[a-zA-Z0-9_-]{16,80}$/.test(key),
        'A valid Idempotency-Key is required.'
      );
      // Check committed requests before availability/expiry checks. A lost-response
      // retry must succeed even though its vehicle is now busy or the call expired.
      request.actionHash = await hash(JSON.stringify({ path: url.pathname, data }));
      const previous = await one(
        env.DB,
        'SELECT * FROM operations WHERE player_id=? AND request_key=?',
        auth.player.id,
        key
      );
      if (previous) {
        requireThat(
          previous.request_hash === request.actionHash,
          'This request key was already used for a different action.',
          409
        );
        return secure(
          json({
            ...(await state(env, auth.player.id, auth.token)),
            actionResult: { replayed: true, entityId: previous.entity_id }
          })
        );
      }
      // Settle before reading the mutation version, so due units/funds can be reused.
      await settle(env, auth.player.id);
      const player = await one(env.DB, 'SELECT * FROM players WHERE id=?', auth.player.id);
      let result;
      if (url.pathname === '/api/dispatch') result = await dispatch(env, player, request, data);
      else if (url.pathname === '/api/organization')
        result = await organizationAction(env, player, request, data);
      else throw new GameError('Route not found.', 404);
      return secure(json({ ...(await state(env, player.id, auth.token)), actionResult: result }));
    } catch (error) {
      if (!(error instanceof GameError)) console.error('Fireline request failed', error);
      return secure(
        json(
          {
            error:
              error instanceof GameError
                ? error.message
                : 'An internal error occurred. No partial transaction was committed.'
          },
          error.status || 500
        )
      );
    }
  }
};
