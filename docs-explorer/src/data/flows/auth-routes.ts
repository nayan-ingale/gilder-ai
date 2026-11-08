import type { Flow, FlowStep, SymbolRef } from '../schema.ts';

/**
 * Auth's routes followed end to end: from the client, through the gateway's checks and proxy,
 * into auth, its Redis and MongoDB, and back. The gateway steps are the same in every flow, so
 * they are built once below and given the parts that differ.
 */

const APPS = ['gateway', 'auth'];

const CREATE_SERVICE: SymbolRef = 'backend/shared/src/service.ts#createService';
const GATEWAY_APP: SymbolRef = 'backend/gateway/src/app.ts#createApp';
const PROXY: SymbolRef = 'backend/gateway/src/proxy.ts#proxyToService';
const SESSION_ROUTES: SymbolRef = 'backend/services/auth/src/session-routes.ts#sessionRouter';
const ME_ROUTES: SymbolRef = 'backend/services/auth/src/me-routes.ts#meRouter';

/** Who sends these requests today. */
const CALLERS =
  "The browser sends it to the frontend's own /api route, and the Next.js server forwards it to the gateway (forwardToGateway), adding the request ID and passing on the cookie and Origin. The gateway tests, above all journey.test.ts, which runs the real auth app behind the real gateway, also call the gateway directly.";

// ---------------------------------------------------------------------------------------------
// Gateway steps

function gatewayMiddleware(): FlowStep {
  return {
    id: 'gw-middleware',
    title: 'Gateway: request ID, request log, security headers',
    kind: 'middleware',
    status: 'verified',
    symbol: CREATE_SERVICE,
    highlight: 'app.use(requestId());',
    what: "The gateway runs createService's shared middleware like every app: requestId keeps a safe X-Request-Id from the caller or makes a new UUID, pino-http starts the request's log line, and helmet sets the security headers. The gateway passes parseJson: false, so the body is not read here. The health router does not match, and the gateway has no internal-token check, so the request reaches the /api router. Express's trust proxy is set to TRUST_PROXY_HOPS, so req.ip is the client's address from X-Forwarded-For.",
    why: 'Every app gets the same request IDs, logs and headers. Leaving the body unread lets the gateway forward it byte for byte.',
  };
}

function ipLimit(): FlowStep {
  return {
    id: 'gw-ip-limit',
    title: 'Gateway: per-IP rate limit',
    kind: 'middleware',
    status: 'verified',
    symbol: 'backend/gateway/src/guards.ts#ipRateLimit',
    highlight:
      "return rateLimit(redis, { scope: 'ip', limit: GATEWAY_RATE_LIMITS.perIp }, (req) => req.ip);",
    what: 'The first check in the /api router. rateLimit counts the request under rl:ip:<req.ip> with hitRateLimit: one MULTI increments the count, starts a 60-second window if none is running and reads the time left. Up to 120 requests a minute from one address go on.',
    why: 'It is the cheapest check and covers every request, signed in or not, including paths the gateway does not forward.',
    sideEffects: ['Increments rl:ip:<address> in Redis, with a 60-second expiry.'],
    next: [
      { to: 'gw-match', kind: 'next' },
      { to: 'ip-limited', kind: 'error', label: 'over 120 requests this minute' },
    ],
  };
}

function ipLimited(): FlowStep {
  return {
    id: 'ip-limited',
    title: 'Over the limit: 429',
    kind: 'error',
    status: 'verified',
    symbol: 'backend/shared/src/rateLimit.ts#rateLimit',
    highlight: "res.setHeader('Retry-After', String(retryAfterSeconds));",
    what: "rateLimit sets Retry-After to the seconds left in the window and throws AppError('rate_limited'), 'Too many requests. Try again in <n>s.'. Express 5 passes it to errorHandler, which answers 429 problem+json. Nothing reaches auth. If Redis itself fails, the error becomes a 500 instead: the request is refused, not let through.",
    why: 'A client that sends too much is slowed down before it costs any other work.',
    next: [],
  };
}

function match(route: string, target: string, session: 'none' | 'required'): FlowStep {
  return {
    id: 'gw-match',
    title: 'Gateway: look the route up',
    kind: 'middleware',
    status: 'verified',
    symbol: GATEWAY_APP,
    highlight: 'const matched = matchRoute(req.method, req.path);',
    what: `matchRoute finds ${route} in PUBLIC_ROUTES: service auth, target ${target}, session ${session === 'none' ? "'none' (open)" : "'required'"}. The result goes in res.locals.route. A method and path that are not in the table would leave the router with next('router') and get the gateway's own 404, so they never reach a service.`,
    why: "The route table is an allowlist: only the public routes listed there reach a service, so auth's internal routes cannot be called from outside.",
  };
}

function originForRead(): FlowStep {
  return {
    id: 'gw-origin',
    title: 'Gateway: origin check (a read passes)',
    kind: 'middleware',
    status: 'verified',
    symbol: 'backend/gateway/src/guards.ts#originCheck',
    highlight: 'if (SAFE_METHODS.has(req.method)) {',
    what: 'GET only reads, so originCheck lets it through without looking at the Origin header.',
    why: 'Only requests that change something need to prove they come from the app.',
  };
}

function originForChange(method: string): FlowStep {
  return {
    id: 'gw-origin',
    title: 'Gateway: origin check',
    kind: 'middleware',
    status: 'verified',
    symbol: 'backend/gateway/src/guards.ts#originCheck',
    highlight: 'if (!origin || !allowedOrigins.includes(origin)) {',
    what: `${method} changes something, so the Origin header must be exactly one of the FRONTEND_ORIGIN origins. Browsers set Origin themselves, and pages cannot change it.`,
    why: "It defends against cross-site request forgery: a form or script on another site cannot act with the user's cookie. The cookie's SameSite=Lax is the first line of defence; this is the second.",
    next: [
      { to: 'gw-session', kind: 'next' },
      { to: 'wrong-origin', kind: 'error', label: 'Origin missing or not allowed' },
    ],
  };
}

function wrongOrigin(): FlowStep {
  return {
    id: 'wrong-origin',
    title: 'Wrong origin: 403',
    kind: 'error',
    status: 'verified',
    symbol: 'backend/gateway/src/guards.ts#originCheck',
    highlight: "next(new AppError('forbidden', 'This request must come from the GilderAi app'));",
    what: "originCheck passes AppError('forbidden') on, and errorHandler answers 403 problem+json. The session is not looked up and nothing reaches auth; the gateway test 'refuses a change from another origin before doing anything else' checks this.",
    why: 'A request from another site is refused before it costs any more work.',
    next: [],
  };
}

function userLimit(): FlowStep {
  return {
    id: 'gw-user-limit',
    title: 'Gateway: per-user rate limit',
    kind: 'middleware',
    status: 'verified',
    symbol: 'backend/gateway/src/guards.ts#userRateLimit',
    highlight: '(_req, res) => res.locals.userId,',
    what: 'The session named a user, so rateLimit counts the request under rl:user:<user ID>. Up to 60 requests a minute from one user, across all their devices, go on; over that is a 429 with Retry-After, the same as for the per-IP limit.',
    why: 'One account cannot use more than its share, however many devices or addresses it uses.',
    sideEffects: ['Increments rl:user:<user ID> in Redis, with a 60-second expiry.'],
  };
}

function requireSession(): FlowStep {
  return {
    id: 'gw-require-session',
    title: 'Gateway: a session is required',
    kind: 'middleware',
    status: 'verified',
    symbol: GATEWAY_APP,
    highlight: "if (route.session === 'required') {",
    what: "The matched route's session rule is 'required', so requireSession runs. sessionLookup found a user, so it passes.",
    why: 'A request without a valid session is stopped at the gateway, before anything is forwarded.',
    next: [
      { to: 'gw-body', kind: 'next' },
      { to: 'no-session', kind: 'error', label: 'no cookie, or the session is unknown or expired' },
    ],
  };
}

function noSession(): FlowStep {
  return {
    id: 'no-session',
    title: 'No session: 401',
    kind: 'error',
    status: 'verified',
    symbol: 'backend/gateway/src/guards.ts#requireSession',
    highlight: "next(new AppError('unauthorized', 'Sign in first'));",
    what: "requireSession passes AppError('unauthorized', 'Sign in first') on, and errorHandler answers 401 problem+json. Nothing reaches auth. journey.test.ts checks this both without a cookie and with the cookie of a session that was logged out.",
    why: 'The gateway answers for a missing session itself, so auth never sees a request for a user without one.',
    next: [],
  };
}

function rawBody(what: string): FlowStep {
  return {
    id: 'gw-body',
    title: 'Gateway: read the body as raw bytes',
    kind: 'middleware',
    status: 'verified',
    symbol: GATEWAY_APP,
    highlight: 'api.use(express.raw({ type: () => true, limit: MAX_BODY }));',
    what,
    why: 'The gateway never parses a body: the service parses JSON itself, up to its own 64kb limit, so the bytes it gets are exactly what the client sent.',
  };
}

function signToken(what: string): FlowStep {
  return {
    id: 'gw-sign-token',
    title: 'Gateway: sign an internal token for auth',
    kind: 'function',
    status: 'verified',
    symbol: PROXY,
    highlight: 'await signInternalToken(deps.privateKey, service, {',
    what,
    why: 'Auth accepts a request only with a valid token addressed to it, so a call that skips the gateway gets 401. A fresh token per request lives 60 seconds, which limits the harm if one leaks.',
  };
}

function fetchFromAuth(target: string): FlowStep {
  return {
    id: 'gw-fetch',
    title: 'Gateway: call auth',
    kind: 'external',
    status: 'verified',
    symbol: PROXY,
    highlight: 'upstream = await fetch(url, {',
    what: `fetch sends the request to AUTH_SERVICE_URL${target}, plus the original query string, with the same method, the raw body when there is one and redirect: 'manual'. An AbortController stops the call if auth has not started answering within 10 seconds, or if the client disconnects first.`,
    why: 'A slow or stopped service cannot hold the request forever, and work stops when nobody is waiting for the answer.',
    next: [
      { to: 'auth-middleware', kind: 'next' },
      {
        to: 'service-down',
        kind: 'error',
        label: 'auth unreachable, or no answer within 10 seconds',
      },
    ],
  };
}

function serviceDown(): FlowStep {
  return {
    id: 'service-down',
    title: 'Auth down or slow: 503',
    kind: 'error',
    status: 'verified',
    symbol: PROXY,
    highlight: "'service_unavailable',",
    what: "When fetch fails and the client is still connected, the proxy throws AppError('service_unavailable'): 'The auth service did not answer in time' after the timeout, otherwise 'The auth service is not reachable'. errorHandler logs it as 'request failed' and answers 503; as for every 5xx, the body has no detail. proxy.test.ts covers both cases.",
    why: 'The client learns the service is unavailable, and the reason stays in the logs.',
    sideEffects: ["Writes a 'request failed' line at error level."],
    next: [],
  };
}

// ---------------------------------------------------------------------------------------------
// Auth steps

function authMiddleware(body: string): FlowStep {
  return {
    id: 'auth-middleware',
    title: 'Auth: same request ID, shared middleware',
    kind: 'middleware',
    status: 'verified',
    symbol: 'backend/shared/src/requestId.ts#requestId',
    highlight: 'const id = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();',
    what: `In auth, createService's shared middleware runs again. The gateway sent its request ID in X-Request-Id, and that ID always matches SAFE_REQUEST_ID, so auth reuses it: both apps' log lines for this request carry the same ID. ${body} The health router does not match.`,
    why: 'One ID ties the gateway log line to the auth log lines of the same request.',
  };
}

function authToken(what: string, highlight: string): FlowStep {
  return {
    id: 'auth-token',
    title: 'Auth: check the internal token',
    kind: 'middleware',
    status: 'verified',
    symbol: 'backend/shared/src/internalToken.ts#requireInternalToken',
    highlight,
    what,
    why: 'Only a request that came through the gateway gets past this point; the token says which user it is for, if any.',
  };
}

function accessLog(what: string): FlowStep {
  return {
    id: 'access-log',
    title: 'Both apps log the request',
    kind: 'function',
    status: 'verified',
    symbol: CREATE_SERVICE,
    highlight: "return res.statusCode >= 400 ? 'warn' : 'info';",
    what,
    why: 'One line per request in each app, with the same request ID, shows the whole trip.',
    sideEffects: ["Writes one 'request completed' line in auth and one in the gateway."],
  };
}

// ---------------------------------------------------------------------------------------------
// The flows

const devSignIn: Flow = {
  id: 'dev-sign-in',
  title: 'POST /sessions/dev',
  category: 'api',
  route: { method: 'POST', path: '/sessions/dev' },
  apps: APPS,
  summary:
    "POST /api/auth/dev-session signs in with just an email, for local development and tests. The gateway counts the request for the per-IP limit, finds the route in its table, checks the Origin, looks for a session (usually none), reads the raw body and forwards it to auth's POST /sessions/dev with a token that names no user. Auth checks the token and the body, finds or creates the user in MongoDB, asks billing for the sign-up credits (a billing outage never blocks the sign-in), stores a new session in Redis and sets the gilder_sid cookie; the gateway passes the answer and the Set-Cookie header back. The route exists only when auth runs with AUTH_DEV_LOGIN on. journey.test.ts follows it with the real auth app behind the real gateway.",
  status: 'verified',
  steps: [
    {
      id: 'client',
      title: 'A client asks to sign in with an email',
      kind: 'trigger',
      status: 'verified',
      what: `A client sends POST /api/auth/dev-session to the gateway (port 8000) with a JSON body { email, name? } and an Origin header from FRONTEND_ORIGIN. ${CALLERS}`,
      why: 'Local development and tests need a session without a Google account.',
      input:
        'POST /api/auth/dev-session, Origin, Content-Type: application/json, { "email": "...", "name": "..." }',
    },
    gatewayMiddleware(),
    ipLimit(),
    ipLimited(),
    match('POST /api/auth/dev-session', '/sessions/dev', 'none'),
    originForChange('POST'),
    wrongOrigin(),
    {
      id: 'gw-session',
      title: 'Gateway: look for a session',
      kind: 'middleware',
      status: 'verified',
      symbol: 'backend/gateway/src/guards.ts#sessionLookup',
      highlight: 'const session = sessionId ? await resolveSession(redis, sessionId) : undefined;',
      what: "A sign-in usually comes without a gilder_sid cookie, so there is no session and no user. If the client still sends a valid one, resolveSession finds it and renews it, and the request goes on for that user. With no user, userRateLimit does not count the request. The route's session rule is 'none', so requireSession does not run.",
      why: 'Sign-in has to work for a caller with no session; the routes that need one check afterwards.',
    },
    rawBody(
      'express.raw reads the JSON body as raw bytes, whatever its Content-Type, into req.body as a Buffer, up to 1 MB (MAX_BODY). A larger body gets 413 payload_too_large here, before anything is forwarded.',
    ),
    signToken(
      "proxyToService builds the URL from AUTH_SERVICE_URL and the target path /sessions/dev. It copies Content-Type, Accept, Accept-Language and User-Agent, sets X-Request-Id to the gateway's request ID, and signs a token with signInternalToken: audience auth, the request ID as rid, and no subject, because there is no session. The Cookie header goes along only because the service is auth, and only if the client sent one.",
    ),
    fetchFromAuth('/sessions/dev'),
    serviceDown(),
    authMiddleware('express.json parses the forwarded body, up to 64kb.'),
    authToken(
      "requireInternalToken reads the x-internal-token header. verifyInternalToken reads the token's issuer, gilder-gateway, to pick the gateway's public key, the only key auth trusts, then checks the signature, the issuer, the audience auth and the expiry. res.locals.caller becomes gateway. The token has no subject, so no user is set, and the request goes on to the routes.",
      'claims = await verifyInternalToken(token, trusted, audience);',
    ),
    {
      id: 'auth-validate',
      title: 'Auth: POST /sessions/dev checks the body',
      kind: 'handler',
      status: 'verified',
      symbol: SESSION_ROUTES,
      highlight:
        "router.post('/sessions/dev', validate({ body: devSignInBody }), async (req, res) => {",
      what: 'sessionRouter adds this route only when devLogin (AUTH_DEV_LOGIN) is on; without it, no route matches and auth answers 404, which the gateway passes back. validate checks the body: email must be a valid email of at most 254 characters, and name, when given, is trimmed and 1 to 100 characters.',
      why: 'The handler can trust its input, and the client learns about every bad field at once.',
      next: [
        { to: 'auth-user', kind: 'next' },
        { to: 'bad-body', kind: 'error', label: 'a bad email or name' },
      ],
    },
    {
      id: 'bad-body',
      title: 'Bad body: 400',
      kind: 'error',
      status: 'verified',
      symbol: 'backend/shared/src/validate.ts#validate',
      highlight:
        "next(new AppError('validation_failed', 'Some fields are invalid', { fieldErrors: errors }));",
      what: "validate passes AppError('validation_failed') with one field error per problem, such as body.email, and auth's errorHandler answers 400 problem+json. The gateway passes the status, the Content-Type and the body back unchanged.",
      why: "The service's own error reply reaches the client as it is.",
      next: [],
    },
    {
      id: 'auth-user',
      title: 'Auth: find or create the user',
      kind: 'datastore',
      status: 'verified',
      symbol: 'backend/services/auth/src/users.ts#findOrCreateDevUser',
      highlight: 'const existing = await UserModel.findOne({ email: normalized });',
      what: "findOrCreateDevUser trims and lowercases the email and looks for a user with it in MongoDB's users collection. If there is none, it creates one whose Firebase ID is 'dev:' plus the email. If another sign-in creates the same user at the same moment, the unique index makes this create fail, and it finds that user instead.",
      why: 'The same email always gives the same account, and a later Google sign-in with that email takes the account over.',
      sideEffects: ['May create a user in MongoDB.'],
    },
    {
      id: 'auth-grant',
      title: 'Auth: ask billing for the sign-up credits',
      kind: 'external',
      status: 'verified',
      symbol: SESSION_ROUTES,
      highlight: 'await deps.grantSignupCredits(user.id);',
      what: "startSession records the user in the request context, then calls billingSignupGrant: POST /internal/accounts on billing, signed with auth's own key for this user, with one retry allowed. Billing gives 100 credits the first time and nothing after, so auth asks on every sign-in. The flow POST /internal/accounts follows billing's side.",
      why: 'A new user starts with credits, and a user whose first grant failed gets it on the next sign-in.',
      next: [
        { to: 'auth-session', kind: 'next' },
        { to: 'grant-failed', kind: 'error', label: 'billing down, slow or failing' },
      ],
    },
    {
      id: 'grant-failed',
      title: 'No grant: log it and sign in anyway',
      kind: 'error',
      status: 'verified',
      symbol: SESSION_ROUTES,
      highlight: "'sign-up credits could not be granted; the next sign-in asks again',",
      what: 'If billing does not answer within 5 seconds (twice), answers 5xx or refuses, auth logs that warning with the error and goes on. session-routes.test.ts checks that the sign-in still succeeds and that the next one asks again.',
      why: 'A billing outage must never stop a user from signing in.',
      sideEffects: [
        "Logs 'sign-up credits could not be granted; the next sign-in asks again' at warn.",
      ],
      next: [{ to: 'auth-session', kind: 'next', label: 'sign-in goes on' }],
    },
    {
      id: 'auth-session',
      title: 'Auth: store a new session in Redis',
      kind: 'datastore',
      status: 'verified',
      symbol: SESSION_ROUTES,
      highlight: 'const sessionId = await createSession(deps.redis, user.id);',
      what: 'createSession makes a session ID from 32 random bytes (43 base64url characters) and stores { userId } under sess:<SHA-256 of the ID> with SET ... EX, so it ends after 7 days unless a lookup renews it. Redis never holds the ID itself.',
      why: 'Sessions live in Redis so the gateway can read them on every request.',
      sideEffects: ['Writes one key to Redis, with a 7-day expiry.'],
    },
    {
      id: 'auth-cookie',
      title: 'Auth: set the session cookie and log the sign-in',
      kind: 'function',
      status: 'verified',
      symbol: SESSION_ROUTES,
      highlight:
        'res.cookie(SESSION_COOKIE, sessionId, { ...cookieOptions, maxAge: COOKIE_MAX_AGE_MS });',
      what: "The response gets Set-Cookie gilder_sid=<ID>, HttpOnly, SameSite=Lax, Path=/, Max-Age 30 days, and Secure when NODE_ENV is production. Auth logs 'signed in' with the method dev and whether the user is new; the user was put in the request context before the grant, so that line carries the user ID.",
      why: 'Page scripts cannot read an HttpOnly cookie, and other sites do not send a SameSite=Lax one with their forms and scripts.',
      sideEffects: ["Logs 'signed in' at info."],
    },
    {
      id: 'auth-response',
      title: 'Auth answers 200 with the user',
      kind: 'response',
      status: 'verified',
      symbol: SESSION_ROUTES,
      highlight: 'res.json({ user: toProfile(user) });',
      what: 'The body is { user } from toProfile: id, email, name, avatarUrl and themePreference, with null for a name or avatar that is not set. The Firebase ID stays inside auth.',
      why: 'The client gets the signed-in user straight away, without a second request.',
      output:
        '200 { "user": { "id": "...", "email": "...", "name": ..., "avatarUrl": null, "themePreference": "system" } }',
    },
    {
      id: 'gw-response',
      title: 'Gateway passes the answer and the cookie back',
      kind: 'response',
      status: 'verified',
      symbol: PROXY,
      highlight: "res.setHeader('set-cookie', setCookies);",
      what: "proxyToService sets auth's status (200), copies Content-Type (and Cache-Control, Retry-After or Location when auth sent them), sets every Set-Cookie header auth sent, and pipes the body back chunk by chunk. The X-Request-Id on the response is the gateway's own, the same ID auth used. The client gets the user and the gilder_sid cookie for the gateway's address, and sends the cookie back on later /api calls.",
      why: 'The cookie has to reach the browser through the gateway, because the browser never talks to auth.',
      output: '200 with Set-Cookie: gilder_sid=...; HttpOnly; SameSite=Lax and the user JSON.',
      next: [{ to: 'access-log', kind: 'async', label: 'after each response finishes' }],
    },
    accessLog(
      "When each response finishes, pino-http writes 'request completed' at info, in auth and in the gateway, with the same request ID. The logger hides the Cookie and Set-Cookie headers, so the session ID never reaches the logs.",
    ),
  ],
};

const readProfile: Flow = {
  id: 'read-profile',
  title: 'GET /me',
  category: 'api',
  route: { method: 'GET', path: '/me' },
  apps: APPS,
  summary:
    "GET /api/me returns the signed-in user. The gateway counts the request per IP, finds the route, lets the read past the origin check, looks the session cookie up in Redis (which renews it), counts the request for the user, requires a session and forwards the request to auth's GET /me with a token that names the user. Auth checks the token, loads the user from MongoDB and answers with the profile, which the gateway streams back.",
  status: 'verified',
  steps: [
    {
      id: 'client',
      title: 'A client asks for the signed-in user',
      kind: 'trigger',
      status: 'verified',
      what: `A client sends GET /api/me to the gateway with the gilder_sid cookie from sign-in. A read needs no Origin header. ${CALLERS}`,
      why: 'The app needs to know who is signed in, and their theme.',
      input: 'GET /api/me, Cookie: gilder_sid=<session ID>',
    },
    gatewayMiddleware(),
    ipLimit(),
    ipLimited(),
    match('GET /api/me', '/me', 'required'),
    originForRead(),
    {
      id: 'gw-session',
      title: 'Gateway: look the session up',
      kind: 'datastore',
      status: 'verified',
      symbol: 'backend/gateway/src/guards.ts#sessionLookup',
      highlight: 'res.locals.userId = session.userId;',
      what: "sessionIdFromCookies reads gilder_sid from the Cookie header. resolveSession checks the ID's shape, then GETEX reads sess:<SHA-256 of the ID> and sets its expiry back to 7 days in one round trip, and parseSession accepts only { userId } with a non-empty string. For a valid session, sessionLookup sets res.locals.userId and adds the user to the log context, so the gateway's later log lines carry it. A missing, malformed, unknown or expired session leaves no user.",
      why: 'The gateway learns the user once, and an active session stays alive: it ends 7 days after it was last used.',
      sideEffects: ["Renews the session's expiry in Redis to 7 days."],
    },
    userLimit(),
    requireSession(),
    noSession(),
    rawBody(
      'express.raw would read a body as raw bytes up to 1 MB; a GET has none, so nothing is sent on as a body.',
    ),
    signToken(
      'proxyToService builds the URL from AUTH_SERVICE_URL and /me, copies the allowed headers, sets X-Request-Id, and signs a token with audience auth, the request ID as rid, and the user ID from the session as its subject (sub). The Cookie header goes to auth too, which does not need it here.',
    ),
    fetchFromAuth('/me'),
    serviceDown(),
    authMiddleware('A GET has no JSON body to parse.'),
    authToken(
      "requireInternalToken verifies the token. Its subject names the user, so it sets res.locals.userId and adds the user to auth's log context.",
      'res.locals.userId = claims.userId;',
    ),
    {
      id: 'auth-route',
      title: 'Auth: GET /me needs a user',
      kind: 'handler',
      status: 'verified',
      symbol: ME_ROUTES,
      highlight: "router.get('/me', requireUser(), async (_req, res) => {",
      what: "sessionRouter's routes do not match, so the request reaches meRouter's GET /me. requireUser passes, because the token named a user; the gateway already required a session, so through the gateway it always does.",
      why: 'Every /me route acts for the user in the token, so a user only ever sees their own account.',
    },
    {
      id: 'auth-load-user',
      title: 'Auth: load the user from MongoDB',
      kind: 'datastore',
      status: 'verified',
      symbol: 'backend/services/auth/src/me-routes.ts#currentUser',
      highlight: 'const user = await UserModel.findById(res.locals.userId);',
      what: 'currentUser looks the user up by ID in the users collection.',
      why: 'The session only stores the user ID; the profile lives in MongoDB.',
      next: [
        { to: 'auth-response', kind: 'next' },
        { to: 'account-gone', kind: 'error', label: 'no user with that ID' },
      ],
    },
    {
      id: 'account-gone',
      title: 'Account gone: 401',
      kind: 'error',
      status: 'verified',
      symbol: 'backend/services/auth/src/me-routes.ts#currentUser',
      highlight: "throw new AppError('unauthorized', 'This account no longer exists');",
      what: "A session can outlive its user, for example after the account was deleted. currentUser throws AppError('unauthorized', 'This account no longer exists'), auth answers 401, and the gateway passes it back unchanged. The session itself stays in Redis until it expires.",
      why: 'A 401 makes the client treat the user as signed out.',
      next: [],
    },
    {
      id: 'auth-response',
      title: 'Auth answers 200 with the profile',
      kind: 'response',
      status: 'verified',
      symbol: ME_ROUTES,
      highlight: 'res.json({ user: toProfile(await currentUser(res)) });',
      what: 'The body is { user } from toProfile: id, email, name, avatarUrl and themePreference.',
      why: 'toProfile decides what leaves auth, so a new field in the model is never sent by accident.',
      output:
        '200 { "user": { "id": "...", "email": "...", "name": ..., "avatarUrl": ..., "themePreference": "..." } }',
    },
    {
      id: 'gw-response',
      title: 'Gateway streams the answer back',
      kind: 'response',
      status: 'verified',
      symbol: PROXY,
      highlight: 'stream.pipe(res);',
      what: "proxyToService sets auth's status and Content-Type on the gateway's response and pipes the body back chunk by chunk. A stream error destroys the response.",
      why: 'Piping, instead of waiting for the whole body, lets a long answer reach the client as it is written.',
      output: '200 with the user JSON.',
      next: [{ to: 'access-log', kind: 'async', label: 'after each response finishes' }],
    },
    accessLog(
      "When each response finishes, pino-http writes 'request completed' at info, in auth and in the gateway, with the same request ID.",
    ),
  ],
};

const logout: Flow = {
  id: 'logout',
  title: 'DELETE /sessions/current',
  category: 'api',
  route: { method: 'DELETE', path: '/sessions/current' },
  apps: APPS,
  summary:
    "DELETE /api/auth/session ends the session the cookie names. The gateway checks the rate limits, the route, the Origin and the session, then forwards the request with the cookie and a token that names the user to auth's DELETE /sessions/current. Auth deletes the session from Redis, clears the cookie and answers 204; the gateway passes the Set-Cookie header back. The old cookie then gets the gateway's 401. journey.test.ts checks all of it (SEC-06).",
  status: 'verified',
  steps: [
    {
      id: 'client',
      title: 'A client asks to log out',
      kind: 'trigger',
      status: 'verified',
      what: `A client sends DELETE /api/auth/session to the gateway with the gilder_sid cookie and an Origin header from FRONTEND_ORIGIN. ${CALLERS}`,
      why: 'The user wants this device signed out; their other devices stay signed in.',
      input: 'DELETE /api/auth/session, Origin, Cookie: gilder_sid=<session ID>',
    },
    gatewayMiddleware(),
    ipLimit(),
    ipLimited(),
    match('DELETE /api/auth/session', '/sessions/current', 'required'),
    originForChange('DELETE'),
    wrongOrigin(),
    {
      id: 'gw-session',
      title: 'Gateway: look the session up',
      kind: 'datastore',
      status: 'verified',
      symbol: 'backend/gateway/src/guards.ts#sessionLookup',
      highlight: "const sessionId = sessionIdFromCookies(req.get('cookie'));",
      what: 'sessionLookup reads the session ID from the cookie and resolveSession reads the session from Redis, renewing it for 7 days just before auth deletes it. A valid session sets res.locals.userId and the log context user.',
      why: 'Logout needs a signed-in user, and the token must name them.',
      sideEffects: ["Renews the session's expiry in Redis."],
    },
    userLimit(),
    requireSession(),
    noSession(),
    rawBody(
      'express.raw would read a body as raw bytes up to 1 MB; a logout normally has none, so nothing is sent on as a body.',
    ),
    {
      id: 'gw-sign-token',
      title: 'Gateway: sign a token and pass the cookie to auth',
      kind: 'function',
      status: 'verified',
      symbol: PROXY,
      highlight: "if (service === 'auth' && cookie) {",
      what: 'proxyToService builds the URL from AUTH_SERVICE_URL and /sessions/current, copies the allowed headers, sets X-Request-Id and signs a token with audience auth, the request ID as rid and the user as its subject. Because the service is auth, the Cookie header goes along: auth needs it to know which session to end. No other service ever gets the cookie.',
      why: 'Only auth owns the session cookie; it sets and ends sessions.',
    },
    fetchFromAuth('/sessions/current'),
    serviceDown(),
    authMiddleware('A logout normally has no body to parse.'),
    authToken(
      'requireInternalToken verifies the token, and its subject sets res.locals.userId and the log context user.',
      'res.locals.userId = claims.userId;',
    ),
    {
      id: 'auth-route',
      title: 'Auth: DELETE /sessions/current needs a user',
      kind: 'handler',
      status: 'verified',
      symbol: SESSION_ROUTES,
      highlight: "router.delete('/sessions/current', requireUser(), async (req, res) => {",
      what: 'sessionRouter matches the route, and requireUser passes because the token named a user.',
      why: 'Only a signed-in user can end a session.',
    },
    {
      id: 'auth-delete',
      title: 'Auth: delete the session from Redis',
      kind: 'datastore',
      status: 'verified',
      symbol: SESSION_ROUTES,
      highlight: 'await deleteSession(deps.redis, sessionId);',
      what: 'sessionIdFromCookies reads the session ID from the cookie the gateway passed on. deleteSession ignores an ID of the wrong shape and otherwise deletes sess:<SHA-256 of the ID>. With no cookie, nothing is deleted; an unknown or already deleted session is not an error.',
      why: 'Only this session ends, so the user stays signed in on their other devices, and logging out twice does no harm.',
      sideEffects: ['Deletes the session key from Redis.'],
    },
    {
      id: 'auth-response',
      title: 'Auth clears the cookie and answers 204',
      kind: 'response',
      status: 'verified',
      symbol: SESSION_ROUTES,
      highlight: 'res.clearCookie(SESSION_COOKIE, cookieOptions);',
      what: "res.clearCookie sends Set-Cookie gilder_sid= with an expiry in the past and the same options as at sign-in, so the browser drops the cookie. Auth logs 'signed out' and answers 204 with no body.",
      why: 'The cookie and the session end together.',
      sideEffects: ["Logs 'signed out' at info."],
      output: '204 with Set-Cookie: gilder_sid=; ... Expires=<in the past>',
    },
    {
      id: 'gw-response',
      title: 'Gateway passes the 204 and the cleared cookie back',
      kind: 'response',
      status: 'verified',
      symbol: PROXY,
      highlight: 'if (!upstream.body) {',
      what: "proxyToService sets the status 204 and every Set-Cookie header auth sent. A 204 has no body (fetch gives such a response a null body), so it ends the response. journey.test.ts checks the 204, the cleared gilder_sid cookie, and that GET /api/me with the old cookie then gets the gateway's 401.",
      why: 'The browser must get the cleared cookie, and the old session ID is useless from then on (SEC-06).',
      output: '204 with Set-Cookie: gilder_sid=; ...',
      next: [{ to: 'access-log', kind: 'async', label: 'after each response finishes' }],
    },
    accessLog(
      "When each response finishes, pino-http writes 'request completed' at info, in auth and in the gateway, with the same request ID; auth also wrote 'signed out'.",
    ),
  ],
};

export const authRouteFlows: Flow[] = [devSignIn, readProfile, logout];
