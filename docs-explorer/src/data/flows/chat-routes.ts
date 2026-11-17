import type { Flow, FlowStep, SymbolRef } from '../schema.ts';

/**
 * Chat's routes followed end to end: from the component in the browser, through the Next.js
 * proxy, the gateway's checks and proxy, into chat and MongoDB, and back to the screen. The steps
 * every flow shares are built once below and given the parts that differ.
 */

const APPS = ['frontend', 'gateway', 'chat'];

const API: SymbolRef = 'frontend/src/store/api.ts#api';
const FORWARD: SymbolRef = 'frontend/src/server/gateway-proxy.ts#forwardToGateway';
const CHAT_LIST: SymbolRef = 'frontend/src/components/chats/chat-list.tsx#ChatList';
const CHAT_ROW: SymbolRef = 'frontend/src/components/chats/chat-row.tsx#ChatRow';
const LOAD_CHAT: SymbolRef = 'frontend/src/server/chats.ts#loadChatWithHistory';
const CHAT_VIEW: SymbolRef = 'frontend/src/app/(app)/c/[chatId]/page.tsx#ChatView';
const CREATE_SERVICE: SymbolRef = 'backend/shared/src/service.ts#createService';
const GATEWAY_APP: SymbolRef = 'backend/gateway/src/app.ts#createApp';
const PROXY: SymbolRef = 'backend/gateway/src/proxy.ts#proxyToService';
const CHAT_ROUTES: SymbolRef = 'backend/services/chat/src/chat-routes.ts#chatRouter';
const OWNED_OR_404: SymbolRef = 'backend/services/chat/src/chat-routes.ts#ownedOr404';
const FIND_OWNED: SymbolRef = 'backend/services/chat/src/models.ts#findOwnedConversation';

/** Where the tests follow these routes. */
const TESTS =
  'chat-routes.test.ts calls the real chat app with tokens signed for the test, and journey.test.ts runs the real auth and chat apps behind the real gateway.';

// ---------------------------------------------------------------------------------------------
// The Next.js server

function nextProxy(method: string, path: string): FlowStep {
  return {
    id: 'next-proxy',
    title: 'Next.js server: forward to the gateway',
    kind: 'function',
    status: 'verified',
    symbol: FORWARD,
    highlight: 'upstream = await fetch(target, {',
    what: `The app's /api/[...path] route hands ${method} /api${path} to forwardToGateway. It calls GATEWAY_URL with the same method, path and query, and passes on only Accept, Accept-Language, Content-Type, Cookie, Origin, User-Agent and X-Forwarded-For. It adds an X-Request-Id (RTK Query sends none, so it makes a UUID) and x-gilder-client: web, and passes the request's abort signal on.`,
    why: 'The browser never learns the gateway address, and the session cookie goes along with the call.',
    next: [
      { to: 'gw-middleware', kind: 'next' },
      { to: 'gateway-down', kind: 'error', label: 'the gateway cannot be reached' },
    ],
  };
}

function gatewayDown(then: string): FlowStep {
  return {
    id: 'gateway-down',
    title: 'Gateway down: 503 from the Next.js server',
    kind: 'error',
    status: 'verified',
    symbol: FORWARD,
    highlight: "return problem(503, 'service_unavailable', 'Service unavailable', requestId);",
    what: 'When the call to the gateway throws, forwardToGateway answers 503 problem+json itself, with code service_unavailable and the request ID.',
    why: 'The browser gets the same error shape as from the backend, with a reference to quote.',
    next: [{ to: then, kind: 'error', label: 'the error reaches the browser' }],
  };
}

function nextResponse(): FlowStep {
  return {
    id: 'next-response',
    title: 'Next.js server streams the answer to the browser',
    kind: 'response',
    status: 'verified',
    symbol: FORWARD,
    highlight:
      'return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });',
    what: "forwardToGateway copies the status, Cache-Control, Content-Type, Location, Retry-After and X-Request-Id, and returns the gateway's body as a stream.",
    why: 'The browser sees the same status and body that chat sent, and the request ID that every app logged.',
  };
}

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
    what: "The gateway runs createService's shared middleware: requestId keeps the X-Request-Id from the Next.js server (it is safe), pino-http starts the request's log line and helmet sets the security headers. The gateway passes parseJson: false, so no body is read here.",
    why: 'One request ID now ties together the Next.js server, the gateway and chat.',
  };
}

function ipLimit(): FlowStep {
  return {
    id: 'gw-ip-limit',
    title: 'Gateway: per-IP rate limit',
    kind: 'middleware',
    status: 'verified',
    symbol: 'backend/gateway/src/guards.ts#ipRateLimit',
    highlight: "return rateLimit(redis, { scope: 'ip', limit }, (req) => req.ip);",
    what: 'The first check in the /api router counts the request under rl:ip:<req.ip> in Redis. Up to 120 requests a minute from one address go on (RATE_LIMIT_PER_IP can change it).',
    why: 'It is the cheapest check and covers every request, signed in or not.',
    sideEffects: ['Increments rl:ip:<address> in Redis, with a 60-second expiry.'],
    next: [
      { to: 'gw-match', kind: 'next' },
      { to: 'ip-limited', kind: 'error', label: 'over 120 requests this minute' },
    ],
  };
}

function ipLimited(then: string): FlowStep {
  return {
    id: 'ip-limited',
    title: 'Over the limit: 429',
    kind: 'error',
    status: 'verified',
    symbol: 'backend/shared/src/rateLimit.ts#rateLimit',
    highlight: "res.setHeader('Retry-After', String(retryAfterSeconds));",
    what: "rateLimit sets Retry-After and throws AppError('rate_limited'), and the gateway answers 429 problem+json. Nothing reaches chat. The per-user limit (60 a minute) answers the same way.",
    why: 'A client that sends too much is slowed down before it costs any other work.',
    next: [{ to: then, kind: 'error', label: 'the error reaches the browser' }],
  };
}

function match(route: string, target: string): FlowStep {
  const hasId = target.includes('<id>');
  return {
    id: 'gw-match',
    title: 'Gateway: look the route up',
    kind: 'middleware',
    status: 'verified',
    symbol: GATEWAY_APP,
    highlight: 'const matched = matchRoute(req.method, req.path);',
    what: `matchRoute finds ${route} in PUBLIC_ROUTES: service chat, target ${target}, session 'required'.${hasId ? ' The :id part must match SAFE_PARAM (1 to 64 letters, digits, - or _) and is filled into the target. An ID with other characters matches nothing.' : ''} A method and path that are not in the table get the gateway's own 404 and never reach a service.`,
    why: "The route table is an allowlist, so chat's /internal routes cannot be called from outside.",
  };
}

function originForRead(): FlowStep {
  return {
    id: 'gw-origin',
    title: 'Gateway: origin check (a read passes)',
    kind: 'middleware',
    status: 'verified',
    symbol: 'backend/gateway/src/guards.ts#originCheck',
    highlight: 'if (SAFE_METHODS.has(req.method) || matched?.route.webhook) {',
    what: 'GET only reads, so originCheck lets it through without looking at the Origin header.',
    why: 'Only requests that change something need to prove they come from the app.',
  };
}

function originForChange(method: string, then: string): FlowStep[] {
  return [
    {
      id: 'gw-origin',
      title: 'Gateway: origin check',
      kind: 'middleware',
      status: 'verified',
      symbol: 'backend/gateway/src/guards.ts#originCheck',
      highlight: 'if (!origin || !allowedOrigins.includes(origin)) {',
      what: `${method} changes something, so the Origin header must be one of the FRONTEND_ORIGIN origins. The browser sets it on every ${method}, and the Next.js server passes it on.`,
      why: "It stops a page on another site from acting with the user's cookie (cross-site request forgery).",
      next: [
        { to: 'gw-session', kind: 'next' },
        { to: 'wrong-origin', kind: 'error', label: 'Origin missing or not allowed' },
      ],
    },
    {
      id: 'wrong-origin',
      title: 'Wrong origin: 403',
      kind: 'error',
      status: 'verified',
      symbol: 'backend/gateway/src/guards.ts#originCheck',
      highlight: "next(new AppError('forbidden', 'This request must come from the GilderAi app'));",
      what: "originCheck passes AppError('forbidden') on, and the gateway answers 403 problem+json. The session is not looked up and nothing reaches chat.",
      why: 'A request from another site is refused before it costs any more work.',
      next: [{ to: then, kind: 'error', label: 'the error reaches the browser' }],
    },
  ];
}

function sessionAndLimits(then: string): FlowStep[] {
  return [
    {
      id: 'gw-session',
      title: 'Gateway: look the session up',
      kind: 'datastore',
      status: 'verified',
      symbol: 'backend/gateway/src/guards.ts#sessionLookup',
      highlight: 'res.locals.userId = session.userId;',
      what: 'sessionIdFromCookies reads gilder_sid from the Cookie header, and resolveSession reads the session from Redis and renews it for 7 days. A valid session sets res.locals.userId and the log context user.',
      why: 'The gateway learns the user once; chat learns it from the token the gateway signs.',
      sideEffects: ["Renews the session's expiry in Redis to 7 days."],
    },
    {
      id: 'gw-user-limit',
      title: 'Gateway: per-user rate limit',
      kind: 'middleware',
      status: 'verified',
      symbol: 'backend/gateway/src/guards.ts#userRateLimit',
      highlight:
        "return rateLimit(redis, { scope: 'user', limit }, (_req, res) => res.locals.userId);",
      what: 'The session named a user, so the request is counted under rl:user:<user ID>. Up to 60 requests a minute from one user go on (RATE_LIMIT_PER_USER can change it); over that is a 429 with Retry-After.',
      why: 'One account cannot use more than its share, however many devices it uses.',
      sideEffects: ['Increments rl:user:<user ID> in Redis, with a 60-second expiry.'],
    },
    {
      id: 'gw-require-session',
      title: 'Gateway: a session is required',
      kind: 'middleware',
      status: 'verified',
      symbol: GATEWAY_APP,
      highlight: "if (route.session === 'required') {",
      what: "Every chat route's session rule is 'required', so requireSession runs. sessionLookup found a user, so it passes.",
      why: 'Chat never sees a request without a signed-in user.',
      next: [
        { to: 'gw-body', kind: 'next' },
        {
          to: 'no-session',
          kind: 'error',
          label: 'no cookie, or the session is unknown or expired',
        },
      ],
    },
    {
      id: 'no-session',
      title: 'No session: 401',
      kind: 'error',
      status: 'verified',
      symbol: 'backend/gateway/src/guards.ts#requireSession',
      highlight: "next(new AppError('unauthorized', 'Sign in first'));",
      what: "requireSession passes AppError('unauthorized', 'Sign in first') on, and the gateway answers 401 problem+json. Nothing reaches chat.",
      why: 'The gateway answers for a missing session itself.',
      next: [{ to: then, kind: 'error', label: 'the error reaches the browser' }],
    },
  ];
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
    why: 'The gateway never parses a body: chat parses the JSON itself, so it gets exactly what the browser sent.',
  };
}

function forwardToChat(target: string, then: string): FlowStep[] {
  return [
    {
      id: 'gw-sign-token',
      title: 'Gateway: sign an internal token for chat',
      kind: 'function',
      status: 'verified',
      symbol: PROXY,
      highlight: 'await signInternalToken(deps.privateKey, service, {',
      what: `proxyToService builds the URL from CHAT_SERVICE_URL and ${target}, copies Content-Type, Accept, Accept-Language and User-Agent, sets X-Request-Id and signs a token: audience chat, the request ID as rid and the user from the session as its subject. The Cookie header stays at the gateway; only auth gets it.`,
      why: 'Chat accepts a request only with a valid token addressed to it, and learns from the token which user the request is for.',
    },
    {
      id: 'gw-fetch',
      title: 'Gateway: call chat',
      kind: 'external',
      status: 'verified',
      symbol: PROXY,
      highlight: 'upstream = await fetch(url, {',
      what: `fetch sends the request to CHAT_SERVICE_URL${target}, with the same method and the raw body when there is one. It is stopped if chat has not started answering within 10 seconds, or if the client goes away first.`,
      why: 'A slow or stopped service cannot hold the request forever.',
      next: [
        { to: 'chat-middleware', kind: 'next' },
        {
          to: 'service-down',
          kind: 'error',
          label: 'chat unreachable, or no answer within 10 seconds',
        },
      ],
    },
    {
      id: 'service-down',
      title: 'Chat down or slow: 503',
      kind: 'error',
      status: 'verified',
      symbol: PROXY,
      highlight: "'service_unavailable',",
      what: "The proxy throws AppError('service_unavailable'): 'The chat service did not answer in time' or 'The chat service is not reachable'. The gateway logs it and answers 503 without the detail, as for every 5xx.",
      why: 'The browser learns the service is unavailable, and the reason stays in the logs.',
      next: [{ to: then, kind: 'error', label: 'the error reaches the browser' }],
    },
  ];
}

function gatewayResponse(what: string, highlight: string): FlowStep {
  return {
    id: 'gw-response',
    title: 'Gateway passes the answer back',
    kind: 'response',
    status: 'verified',
    symbol: PROXY,
    highlight,
    what,
    why: "Chat's status and body pass through unchanged, errors included.",
    next: [
      { to: 'next-response', kind: 'next' },
      { to: 'access-log', kind: 'async', label: 'after each response finishes' },
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Chat steps

function chatMiddleware(body: string): FlowStep[] {
  return [
    {
      id: 'chat-middleware',
      title: 'Chat: same request ID, shared middleware',
      kind: 'middleware',
      status: 'verified',
      symbol: 'backend/shared/src/requestId.ts#requestId',
      highlight: 'const id = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();',
      what: `In chat, createService's shared middleware runs again and reuses the gateway's request ID. ${body} The health router does not match.`,
      why: "One ID ties chat's log lines to the gateway's.",
    },
    {
      id: 'chat-token',
      title: 'Chat: check the internal token',
      kind: 'middleware',
      status: 'verified',
      symbol: 'backend/shared/src/internalToken.ts#requireInternalToken',
      highlight: 'res.locals.userId = claims.userId;',
      what: "requireInternalToken verifies the token with the gateway's public key: issuer gilder-gateway, audience chat, not expired. Its subject is the user, so it sets res.locals.userId and adds the user to chat's log context.",
      why: 'Only a request that came through the gateway gets past this point, and it carries its user.',
    },
  ];
}

function owned(then: string): FlowStep[] {
  return [
    {
      id: 'chat-owned',
      title: "Chat: load the user's own chat",
      kind: 'datastore',
      status: 'verified',
      symbol: OWNED_OR_404,
      highlight: 'const chat = await findOwnedConversation(res.locals.userId as string, id);',
      what: 'ownedOr404 calls findOwnedConversation with the user from the token: one findOne by ID, user ID and deletedAt: null (an ID that is not an ObjectId gives null without a query).',
      why: 'A user can only ever change their own chats.',
      next: [
        { to: 'chat-change', kind: 'next' },
        {
          to: 'chat-not-found',
          kind: 'error',
          label: "someone else's chat, a deleted one or a wrong ID",
        },
      ],
    },
    {
      id: 'chat-not-found',
      title: "Not the user's chat: 404",
      kind: 'error',
      status: 'verified',
      symbol: OWNED_OR_404,
      highlight: 'throw notFound();',
      what: "ownedOr404 throws AppError('not_found', 'No such chat'), and chat answers 404 problem+json. It is the same answer for a chat that belongs to someone else, was deleted or never existed; the flow Another user's chat → 404 follows it.",
      why: "The answer says nothing about other users' chats (SEC-04).",
      next: [{ to: then, kind: 'error', label: 'the error reaches the browser' }],
    },
  ];
}

function badInput(then: string, what: string): FlowStep {
  return {
    id: 'bad-input',
    title: 'Bad input: 400',
    kind: 'error',
    status: 'verified',
    symbol: 'backend/shared/src/validate.ts#validate',
    highlight:
      "next(new AppError('validation_failed', 'Some fields are invalid', { fieldErrors: errors }));",
    what,
    why: 'The handler can trust its input, and the caller learns about every bad field at once.',
    next: [{ to: then, kind: 'error', label: 'the error reaches the browser' }],
  };
}

function accessLog(): FlowStep {
  return {
    id: 'access-log',
    title: 'Chat and the gateway log the request',
    kind: 'function',
    status: 'verified',
    symbol: CREATE_SERVICE,
    highlight: "return res.statusCode >= 400 ? 'warn' : 'info';",
    what: "When each response finishes, pino-http writes 'request completed' in chat and in the gateway, with the same request ID: at info for a success, at warn for a 4xx.",
    why: 'One line per request in each app, with the same ID, shows the whole trip.',
    sideEffects: ["Writes one 'request completed' line in chat and one in the gateway."],
  };
}

// ---------------------------------------------------------------------------------------------
// The flows

const listChats: Flow = {
  id: 'list-chats',
  title: 'GET /chats',
  category: 'api',
  route: { method: 'GET', path: '/chats' },
  apps: APPS,
  summary: `The sidebar's chat list and the ⌘K search. RTK Query sends GET /api/chats (with ?cursor= for more, or ?query= to search) to the Next.js server, which forwards it to the gateway. The gateway checks the limits, the route and the session and forwards it to chat's GET /chats with a token that names the user. Without a query, chat reads every pinned chat and then a page of the others, newest first, with a cursor for the next page; with a query, it searches titles and message text at the same time. The answer goes back the same way, and the browser groups or lists the chats. ${TESTS}`,
  status: 'verified',
  steps: [
    {
      id: 'component',
      title: 'The sidebar asks for the chat list',
      kind: 'trigger',
      status: 'verified',
      symbol: CHAT_LIST,
      highlight: 'useListChatsInfiniteQuery();',
      what: 'ChatList, in the sidebar and in the small-screen panel, calls useListChatsInfiniteQuery when it mounts in the browser, and again for each Show more. SearchDialog asks with searchChats once at least 2 characters are typed (after a 250 ms pause), and shows the latest 8 chats from the same list when less is typed.',
      why: 'The list loads in the browser, so the shell around it can be prerendered.',
      input:
        'Nothing for the first page; the nextCursor of the last page for Show more; the typed text for search.',
    },
    {
      id: 'rtk-request',
      title: 'RTK Query builds the request',
      kind: 'function',
      status: 'verified',
      symbol: API,
      highlight: "pageParam ? `/chats?cursor=${encodeURIComponent(pageParam)}` : '/chats',",
      what: "listChats asks for /chats for the first page and /chats?cursor=<nextCursor> for later ones; searchChats asks for /chats?query=<text>. fetchBaseQuery adds the base URL /api and sends a GET with the browser's cookies (same origin). When another component already loaded the same list, its cached pages are used and nothing is sent.",
      why: 'One cache entry serves the sidebar, the small-screen panel and the search dialog.',
      input: 'GET /api/chats, /api/chats?cursor=... or /api/chats?query=...',
    },
    nextProxy('GET', '/chats'),
    gatewayDown('show-error'),
    gatewayMiddleware(),
    ipLimit(),
    ipLimited('show-error'),
    match('GET /api/chats', '/chats'),
    originForRead(),
    ...sessionAndLimits('show-error'),
    rawBody('express.raw would read a body as raw bytes; a GET has none, so nothing is sent on.'),
    ...forwardToChat('/chats', 'show-error'),
    ...chatMiddleware('A GET has no JSON body to parse.'),
    {
      id: 'chat-route',
      title: 'Chat: GET /chats checks the query',
      kind: 'handler',
      status: 'verified',
      symbol: CHAT_ROUTES,
      highlight: "router.get('/chats', validate({ query: listQuery }), async (req, res) => {",
      what: 'requireUser, mounted on /chats, passes because the token named a user. validate checks the query: query is trimmed text of at most 100 characters, cursor at most 200 characters, and limit a whole number from 1 to 50 (default 30; the frontend never sends one). An empty query counts as none.',
      why: 'The handler can trust its input, and a limit cannot be raised to read everything at once.',
      next: [
        { to: 'decode-cursor', kind: 'branch', label: 'no query: a page of the list' },
        { to: 'search', kind: 'branch', label: 'a query: search' },
        { to: 'bad-input', kind: 'error', label: 'a bad query, cursor or limit' },
      ],
    },
    badInput(
      'show-error',
      "validate passes AppError('validation_failed') with a field error such as query.limit, and chat answers 400 problem+json.",
    ),
    {
      id: 'decode-cursor',
      title: 'Chat: read the cursor',
      kind: 'function',
      status: 'verified',
      symbol: 'backend/services/chat/src/chat-routes.ts#decodeCursor',
      what: 'With no cursor, decodeCursor returns undefined: the first page. A cursor is base64url JSON { at, id }, the lastMessageAt and ID of the last chat on the page before; it is accepted only when at is a date and id a valid ObjectId.',
      why: "The cursor's values go straight into the query, so one the service did not make is refused.",
      next: [
        { to: 'pinned', kind: 'next' },
        { to: 'bad-cursor', kind: 'error', label: 'not a cursor chat made' },
      ],
    },
    {
      id: 'bad-cursor',
      title: 'Bad cursor: 400',
      kind: 'error',
      status: 'verified',
      symbol: 'backend/services/chat/src/chat-routes.ts#decodeCursor',
      highlight: "throw new AppError('bad_request', 'The cursor is not valid');",
      what: "decodeCursor throws AppError('bad_request', 'The cursor is not valid'), and chat answers 400 problem+json.",
      why: 'A made-up cursor cannot shape a database query.',
      next: [{ to: 'show-error', kind: 'error', label: 'the error reaches the browser' }],
    },
    {
      id: 'pinned',
      title: 'Chat: read the pinned chats (first page only)',
      kind: 'datastore',
      status: 'verified',
      symbol: CHAT_ROUTES,
      highlight: '.sort({ pinnedAt: -1 })',
      what: 'On the first page, one query reads every pinned chat of the user that is not deleted, latest pin first, up to 50. With a cursor this query is skipped, so pinned chats appear only once.',
      why: 'Pinned chats always sit at the top, however old their last message is.',
    },
    {
      id: 'unpinned',
      title: 'Chat: read one page of the other chats',
      kind: 'datastore',
      status: 'verified',
      symbol: CHAT_ROUTES,
      highlight: '.sort({ lastMessageAt: -1, _id: -1 })',
      what: 'A second query reads the unpinned chats of the user that are not deleted, newest lastMessageAt first and then by _id, one more than limit. With a cursor it keeps only chats after it: an older lastMessageAt, or the same one and a smaller _id. The { userId, pinnedAt, lastMessageAt } index serves both queries.',
      why: 'The _id tie-break makes the order total, so chats with the same time are never skipped or shown twice across pages (the test pages through chats with equal times). The extra chat shows whether there is another page.',
    },
    {
      id: 'list-response',
      title: 'Chat answers with the page and the next cursor',
      kind: 'response',
      status: 'verified',
      symbol: CHAT_ROUTES,
      highlight: 'items: [...pinned, ...page].map(toChat),',
      what: "The body is { items, nextCursor }: the pinned chats, then up to limit others, each through toChat. nextCursor is encodeCursor of the last chat's lastMessageAt and ID when there was one more, otherwise null.",
      why: 'The client only passes nextCursor back; it never builds a position itself.',
      output:
        '200 { "items": [{ "id", "title", "pinned", "lastMessageAt", "createdAt" }, ...], "nextCursor": "..." or null }',
      next: [{ to: 'gw-response', kind: 'next' }],
    },
    {
      id: 'search',
      title: 'Chat: search two ways at once',
      kind: 'function',
      status: 'verified',
      symbol: CHAT_ROUTES,
      highlight: 'const [byTitle, messageChatIds] = await Promise.all([',
      what: "Promise.all runs a title search and a message search at the same time. Both are MongoDB text searches: they match whole words in any case, with stemming, not parts of words. Both text indexes start with userId, so each search stays within the user's own data.",
      why: 'A chat should be found by its name or by something said in it.',
      next: [
        { to: 'search-titles', kind: 'parallel', label: 'titles' },
        { to: 'search-messages', kind: 'parallel', label: 'message text' },
      ],
      join: 'search-load',
    },
    {
      id: 'search-titles',
      title: 'Search chat titles',
      kind: 'datastore',
      status: 'verified',
      symbol: CHAT_ROUTES,
      highlight:
        'ConversationModel.find({ userId, deletedAt: null, $text: { $search: query } }).limit(',
      what: "A $text query on the conversations' title index finds up to 50 of the user's chats that are not deleted.",
      why: 'Most chats are found by their title.',
      next: [{ to: 'search-load', kind: 'next' }],
    },
    {
      id: 'search-messages',
      title: 'Search message text',
      kind: 'datastore',
      status: 'verified',
      symbol: CHAT_ROUTES,
      highlight: "MessageModel.distinct('conversationId', {",
      what: "A $text query on the messages' content index finds the user's messages that are not superseded and returns the distinct IDs of their chats.",
      why: 'A chat can be found by what was said in it.',
      next: [{ to: 'search-load', kind: 'next' }],
    },
    {
      id: 'search-load',
      title: 'Load the chats the messages belong to',
      kind: 'datastore',
      status: 'verified',
      symbol: CHAT_ROUTES,
      highlight: '_id: { $in: messageChatIds.slice(0, MAX_PAGE_SIZE) },',
      what: "Once both searches are done, one query loads up to 50 of the chats the messages belong to, only the user's own and not deleted. A deleted chat's messages therefore find nothing.",
      why: 'Messages stay after a soft delete, so the chat is checked again.',
    },
    {
      id: 'search-response',
      title: 'Chat answers with the matching chats',
      kind: 'response',
      status: 'verified',
      symbol: CHAT_ROUTES,
      highlight: 'res.json({ items: items.map(toChat), nextCursor: null });',
      what: 'The two lists are merged by ID without repeats, sorted by lastMessageAt (newest first; pinned chats are not put first), cut to limit, and sent through toChat with nextCursor null: search returns one page.',
      why: 'A short list of the best-known chats is enough for a search box.',
      output: '200 { "items": [...], "nextCursor": null }',
    },
    gatewayResponse(
      "proxyToService sets chat's status (200) and Content-Type on the gateway's response and pipes the body back chunk by chunk.",
      'stream.pipe(res);',
    ),
    nextResponse(),
    {
      id: 'rtk-cache',
      title: 'RTK Query stores the page',
      kind: 'function',
      status: 'verified',
      symbol: API,
      highlight: 'getNextPageParam: (lastPage) => lastPage.nextCursor,',
      what: 'listChats adds the page to its cached pages, and getNextPageParam reads nextCursor: null means there is nothing more. Both list queries provide the Chat LIST tag, so a create, rename, pin or delete fetches them again.',
      why: 'The pages stay cached, so every list on screen shows the same data.',
      next: [
        { to: 'show-list', kind: 'branch', label: 'the sidebar asked' },
        { to: 'show-results', kind: 'branch', label: 'search asked' },
      ],
    },
    {
      id: 'show-list',
      title: 'The sidebar groups and shows the chats',
      kind: 'response',
      status: 'verified',
      symbol: CHAT_LIST,
      highlight: '() => (data ? groupChats(data.pages.flatMap((page) => page.items)) : []),',
      what: "ChatList joins the pages and groupChats splits them into Pinned, Today, Previous 7 days and Older by the user's clock. Each chat is a ChatRow link to /c/<id>; Show more appears while there is a next page, and 'No chats yet' when there are none.",
      why: "Grouping depends on the user's time zone, so it is done in the browser, never in the prerendered shell.",
      next: [],
    },
    {
      id: 'show-results',
      title: 'Search shows the results',
      kind: 'response',
      status: 'verified',
      symbol: 'frontend/src/components/chats/search-dialog.tsx#SearchDialog',
      highlight: 'return search.data?.items ?? [];',
      what: "SearchDialog lists the results. Arrow keys move the active one and Enter opens /c/<id>; with none it says 'No chats match …'.",
      why: 'The keyboard stays in the search field the whole time.',
      next: [],
    },
    {
      id: 'show-error',
      title: 'The browser shows the failure',
      kind: 'error',
      status: 'verified',
      symbol: CHAT_LIST,
      highlight: '<p>Could not load your chats.</p>',
      what: "RTK Query marks the query as failed. The sidebar shows 'Could not load your chats.' with Try again, which fetches again; search shows 'Search failed. Try again.'",
      why: 'A failed list never looks like an empty one.',
      next: [],
    },
    accessLog(),
  ],
};

const updateChat: Flow = {
  id: 'update-chat',
  title: 'PATCH /chats/:id',
  category: 'api',
  route: { method: 'PATCH', path: '/chats/:id' },
  apps: APPS,
  summary: `Rename or pin a chat from its menu in the sidebar. RTK Query changes the cached list at once, then sends PATCH /api/chats/<id> with { title } or { pinned }. The Next.js server and the gateway forward it to chat (the gateway also checks the Origin), and chat changes the chat only if it belongs to the user. If the call fails, the change in the list is undone and a toast says why. ${TESTS}`,
  status: 'verified',
  steps: [
    {
      id: 'menu',
      title: 'The user renames or pins a chat',
      kind: 'trigger',
      status: 'verified',
      symbol: 'frontend/src/components/chats/chat-actions.tsx#useChatActions',
      highlight: 'await updateChat({ id: chat.id, pinned: !chat.pinned }).unwrap();',
      what: "In a chat's menu (or the chat header's pin button), 'Pin to top' or 'Unpin' calls updateChat with the opposite pinned value. Rename opens a dialog with the title selected; Save calls updateChat with the trimmed title, and an empty or unchanged title just closes the dialog.",
      why: 'Rename and pin live where the chat is listed.',
      input: '{ id, pinned } or { id, title }',
    },
    {
      id: 'optimistic',
      title: 'RTK Query changes the cached list at once',
      kind: 'function',
      status: 'verified',
      symbol: API,
      highlight: "api.util.updateQueryData('listChats', undefined, (draft) => {",
      what: 'Before the request is sent, onQueryStarted writes the new title or pinned value into the chat in every cached page of listChats. The sidebar re-renders straight away (a pinned chat moves to Pinned). The patch is kept, so it can be undone.',
      why: 'The change shows without waiting for the network.',
      sideEffects: ['Changes the cached chat list in the browser.'],
    },
    {
      id: 'rtk-request',
      title: 'RTK Query sends the PATCH',
      kind: 'function',
      status: 'verified',
      symbol: API,
      highlight: "query: ({ id, ...body }) => ({ url: `/chats/${id}`, method: 'PATCH', body }),",
      what: 'fetchBaseQuery sends PATCH /api/chats/<id> with the JSON body { title } or { pinned }. The browser adds the session cookie and the Origin header.',
      why: 'The ID goes in the path and only the change in the body.',
      input:
        'PATCH /api/chats/<id>, Content-Type: application/json, { "title": "..." } or { "pinned": true }',
    },
    nextProxy('PATCH', '/chats/<id>'),
    gatewayDown('undo'),
    gatewayMiddleware(),
    ipLimit(),
    ipLimited('undo'),
    match('PATCH /api/chats/:id', '/chats/<id>'),
    ...originForChange('PATCH', 'undo'),
    ...sessionAndLimits('undo'),
    rawBody(
      'express.raw reads the JSON body as raw bytes, up to 1 MB; a larger body gets 413 here.',
    ),
    ...forwardToChat('/chats/<id>', 'undo'),
    ...chatMiddleware('express.json parses the forwarded body, up to 64kb.'),
    {
      id: 'chat-route',
      title: 'Chat: PATCH /chats/:id checks the body',
      kind: 'handler',
      status: 'verified',
      symbol: CHAT_ROUTES,
      highlight:
        "router.patch('/chats/:id', validate({ params: idParams, body: updateBody }), async (req, res) => {",
      what: "requireUser passes because the token named a user. validate checks the ID (1 to 64 characters) and the body: title, trimmed, 1 to 120 characters, and pinned, true or false. The body is strict, so any other field is refused, and at least one of the two is needed ('Give a title or pinned').",
      why: 'Only the title and the pin can change here; a field such as deletedAt or userId cannot sneak in.',
      next: [
        { to: 'chat-owned', kind: 'next' },
        { to: 'bad-input', kind: 'error', label: 'empty change, empty title or another field' },
      ],
    },
    badInput(
      'undo',
      "validate passes AppError('validation_failed') with a field error per problem, and chat answers 400 problem+json.",
    ),
    ...owned('undo'),
    {
      id: 'chat-change',
      title: 'Chat: save the new title or pin',
      kind: 'datastore',
      status: 'verified',
      symbol: CHAT_ROUTES,
      highlight: 'chat.pinnedAt = pinned ? (chat.pinnedAt ?? new Date()) : null;',
      what: 'A title replaces the old one. pinned: true sets pinnedAt to now, or keeps the time when the chat was already pinned; pinned: false clears it. chat.save() writes the change to MongoDB.',
      why: 'Pinning twice does not move a chat within the pinned ones.',
      sideEffects: ['Updates the conversation in MongoDB.'],
    },
    {
      id: 'chat-response',
      title: 'Chat answers with the changed chat',
      kind: 'response',
      status: 'verified',
      symbol: CHAT_ROUTES,
      highlight: '    await chat.save();\n    res.json({ chat: toChat(chat) });',
      what: 'The body is { chat } from toChat.',
      why: 'The client gets the chat as the server now has it.',
      output: '200 { "chat": { "id", "title", "pinned", "lastMessageAt", "createdAt" } }',
    },
    gatewayResponse(
      "proxyToService sets chat's status and Content-Type and pipes the body back.",
      'stream.pipe(res);',
    ),
    nextResponse(),
    {
      id: 'refetch',
      title: 'RTK Query keeps the change and refreshes',
      kind: 'function',
      status: 'verified',
      symbol: API,
      highlight: "invalidatesTags: (_result, _error, { id }) => [LIST, { type: 'Chat', id }],",
      what: "queryFulfilled resolves, so the patch stays. invalidatesTags marks the list and this chat as stale, so they are fetched again: the sidebar gets the server's order, and an open chat page's header (ChatHeader, which follows getChat) and tab title show the new title or pin. After a pin, ChatRow moves keyboard focus to the row's menu button in its new group.",
      why: 'The server stays the source of truth, while the user already saw the change.',
      next: [],
    },
    {
      id: 'undo',
      title: 'The change is undone and a toast says why',
      kind: 'error',
      status: 'verified',
      symbol: API,
      highlight: 'patch.undo();',
      what: "queryFulfilled rejects, so onQueryStarted undoes the patch and the list shows the old title or pin again. ChatRow's unwrap() throws, and it shows a toast such as 'Could not pin the chat' with the service's message and request ID (errorMessage). chats.test.tsx checks this with a 404.",
      why: 'The list never shows a change the server refused.',
      next: [],
    },
    accessLog(),
  ],
};

const deleteChat: Flow = {
  id: 'delete-chat',
  title: 'DELETE /chats/:id',
  category: 'api',
  route: { method: 'DELETE', path: '/chats/:id' },
  apps: APPS,
  summary: `Delete a chat from its menu, after a confirmation. RTK Query takes the chat out of the cached list at once and sends DELETE /api/chats/<id>. The Next.js server and the gateway forward it to chat, which sets deletedAt on the user's own chat and answers 204. The chat and its messages stay in MongoDB but leave every list, search and read; the agent's file clean-up later removes the chat's files (see Clean up the files of deleted chats). If the deleted chat was open, the app goes to a new chat; if the call fails, the chat comes back. ${TESTS}`,
  status: 'verified',
  steps: [
    {
      id: 'confirm',
      title: 'The user deletes a chat',
      kind: 'trigger',
      status: 'verified',
      symbol: 'frontend/src/components/chats/chat-actions.tsx#useChatActions',
      highlight: 'await deleteChat(chat.id).unwrap();',
      what: "The user picks 'Delete chat' in a chat's menu (in the sidebar or the chat header) and confirms in the 'Delete chat?' dialog. useChatActions calls deleteChat with the chat's ID.",
      why: 'Asking first protects against a slip of the mouse.',
      input: 'The chat ID.',
    },
    {
      id: 'optimistic',
      title: 'RTK Query takes the chat out of the list at once',
      kind: 'function',
      status: 'verified',
      symbol: API,
      highlight: 'page.items = page.items.filter((item) => item.id !== id);',
      what: 'Before the request is sent, onQueryStarted removes the chat from every cached page of listChats. The patch is kept, so it can be undone.',
      why: 'The chat disappears without waiting for the network.',
      sideEffects: ['Changes the cached chat list in the browser.'],
    },
    {
      id: 'rtk-request',
      title: 'RTK Query sends the DELETE',
      kind: 'function',
      status: 'verified',
      symbol: API,
      highlight: "query: (id) => ({ url: `/chats/${id}`, method: 'DELETE' }),",
      what: 'fetchBaseQuery sends DELETE /api/chats/<id> with no body. The browser adds the session cookie and the Origin header.',
      why: 'The chat is named by its path alone.',
      input: 'DELETE /api/chats/<id>',
    },
    nextProxy('DELETE', '/chats/<id>'),
    gatewayDown('undo'),
    gatewayMiddleware(),
    ipLimit(),
    ipLimited('undo'),
    match('DELETE /api/chats/:id', '/chats/<id>'),
    ...originForChange('DELETE', 'undo'),
    ...sessionAndLimits('undo'),
    rawBody('express.raw would read a body as raw bytes; a DELETE here has none.'),
    ...forwardToChat('/chats/<id>', 'undo'),
    ...chatMiddleware('There is no body to parse.'),
    {
      id: 'chat-route',
      title: 'Chat: DELETE /chats/:id',
      kind: 'handler',
      status: 'verified',
      symbol: CHAT_ROUTES,
      highlight:
        "router.delete('/chats/:id', validate({ params: idParams }), async (req, res) => {",
      what: 'requireUser passes because the token named a user, and validate checks the ID: 1 to 64 characters, which every ID the gateway forwards already is.',
      why: 'Every route for one chat starts the same way.',
    },
    ...owned('undo'),
    {
      id: 'chat-change',
      title: 'Chat: mark the chat deleted',
      kind: 'datastore',
      status: 'verified',
      symbol: CHAT_ROUTES,
      highlight: 'chat.deletedAt = new Date();',
      what: 'It sets deletedAt to now and saves. Nothing is removed: the chat and its messages stay in MongoDB. Every chat query filters on deletedAt: null, so the chat leaves the list, search and every read at once; the test checks the document is still there.',
      why: 'A soft delete is one write, and the data stays for a later clean-up.',
      sideEffects: ["Sets the conversation's deletedAt in MongoDB."],
    },
    {
      id: 'chat-response',
      title: 'Chat answers 204',
      kind: 'response',
      status: 'verified',
      symbol: CHAT_ROUTES,
      highlight: 'res.status(204).end();',
      what: 'An empty 204 response.',
      why: 'There is nothing left to show.',
      output: '204 with no body',
    },
    gatewayResponse(
      'proxyToService sets the status 204. A 204 has no body, so it ends the response.',
      'if (!upstream.body) {',
    ),
    nextResponse(),
    {
      id: 'leave',
      title: 'The list refreshes, and an open chat is left',
      kind: 'function',
      status: 'verified',
      symbol: 'frontend/src/components/chats/chat-actions.tsx#useChatActions',
      highlight: "router.push('/');",
      what: 'queryFulfilled resolves, so the patch stays, and invalidatesTags fetches the list again. useChatActions (behind the sidebar row and the chat header) closes the dialog and, if the deleted chat was the one open, goes to / for a new chat.',
      why: 'The user is never left on a page for a chat that no longer exists.',
      next: [],
    },
    {
      id: 'undo',
      title: 'The chat comes back and a toast says why',
      kind: 'error',
      status: 'verified',
      symbol: API,
      highlight: '          patch.undo();\n        }\n      },\n      invalidatesTags: [LIST],',
      what: "queryFulfilled rejects, so onQueryStarted undoes the patch and the chat is back in the list. ChatRow shows the toast 'Could not delete the chat' with the service's message and request ID.",
      why: 'The list never hides a chat the server kept.',
      next: [],
    },
    accessLog(),
  ],
};

const openChat: Flow = {
  id: 'open-chat',
  title: 'Open a chat page',
  category: 'api',
  apps: APPS,
  summary:
    "Opening /c/<chat ID> renders the chat on the server. The login gate checks for the session cookie, the page shows a skeleton, and getChatWithHistory asks the gateway for the chat and its latest messages at the same time, with the browser's cookie. Each call goes through the gateway to chat like any other. The page then streams the title bar and the messages; a chat that is missing, deleted or someone else's gets the 'This chat isn't available' page. server/chats.test.ts covers the loading, journey.test.ts the routes.",
  status: 'verified',
  steps: [
    {
      id: 'browser',
      title: 'The browser opens a chat',
      kind: 'trigger',
      status: 'verified',
      what: 'The user opens /c/<chat ID>: from a ChatRow link in the list, a search result, or a typed or shared address.',
      why: 'Each chat has its own address, so it can be reloaded and bookmarked.',
      input: 'GET /c/<chat ID>, Cookie: gilder_sid=<session ID>',
    },
    {
      id: 'login-gate',
      title: 'Login gate: is there a session cookie?',
      kind: 'middleware',
      status: 'verified',
      symbol: 'frontend/src/proxy.ts#proxy',
      highlight: 'if (request.cookies.has(SESSION_COOKIE)) {',
      what: 'proxy.ts runs for /c/:path*. With a gilder_sid cookie the request goes on; it does not check the session itself.',
      why: 'A visitor who is plainly signed out goes to /login before anything renders.',
      next: [
        { to: 'page', kind: 'next' },
        { to: 'to-login', kind: 'branch', label: 'no session cookie' },
      ],
    },
    {
      id: 'to-login',
      title: 'No cookie: redirect to /login',
      kind: 'response',
      status: 'verified',
      symbol: 'frontend/src/proxy.ts#proxy',
      highlight: 'return NextResponse.redirect(login);',
      what: 'The gate answers with a redirect to /login, without a query string.',
      why: 'There is no chat to show without a session.',
      next: [],
    },
    {
      id: 'page',
      title: 'The page shows a skeleton first',
      kind: 'handler',
      status: 'verified',
      symbol: 'frontend/src/app/(app)/c/[chatId]/page.tsx#ChatPage',
      highlight: '<Suspense fallback={<ChatSkeleton />}>',
      what: 'Inside the (app) layout (the sidebar, whose chat list loads in the browser, and the account, which checks the session with getCurrentUser), ChatPage puts ChatView in a Suspense boundary with a skeleton of the title bar and messages.',
      why: 'The skeleton can be sent at once, while the server loads the chat.',
    },
    {
      id: 'load',
      title: 'Load the chat, once per request',
      kind: 'function',
      status: 'verified',
      symbol: LOAD_CHAT,
      highlight: 'if (!CHAT_ID.test(chatId)) {',
      what: "ChatView awaits the params and calls getChatWithHistory, which React's cache() runs once per request: generateMetadata calls it too, for the tab title, and shares the result. An ID that is not 24 lowercase hex characters gives null at once, without a call.",
      why: 'A chat ID is a MongoDB ObjectId, so anything else cannot be a chat.',
      next: [
        { to: 'fetch-both', kind: 'next' },
        { to: 'not-found', kind: 'branch', label: 'not a 24-character hex ID' },
      ],
    },
    {
      id: 'fetch-both',
      title: 'Ask for the chat and its messages at once',
      kind: 'function',
      status: 'verified',
      symbol: LOAD_CHAT,
      highlight: 'const [chatResponse, messagesResponse] = await Promise.all([',
      what: 'Promise.all starts two calls through gatewayGet at the same time.',
      why: 'The page waits for the slower call, not for both one after the other.',
      next: [
        { to: 'get-chat', kind: 'parallel', label: 'GET /api/chats/<id>' },
        { to: 'get-messages', kind: 'parallel', label: 'GET /api/chats/<id>/messages' },
      ],
      join: 'check-answers',
    },
    {
      id: 'get-chat',
      title: 'gatewayGet /api/chats/<id>',
      kind: 'function',
      status: 'verified',
      symbol: 'frontend/src/server/gateway-fetch.ts#gatewayGet',
      what: "gatewayGet returns null without a call when there is no gilder_sid cookie. Otherwise it fetches GATEWAY_URL/api/chats/<id> straight from the server, with the browser's cookies and x-gilder-client: web, and no cache.",
      why: 'Server components skip the /api proxy and call the gateway directly.',
      next: [{ to: 'gateway', kind: 'next' }],
    },
    {
      id: 'get-messages',
      title: 'gatewayGet /api/chats/<id>/messages',
      kind: 'function',
      status: 'verified',
      symbol: 'frontend/src/server/gateway-fetch.ts#gatewayGet',
      what: 'The same, for GATEWAY_URL/api/chats/<id>/messages, with no cursor: the newest page.',
      why: 'The history is rendered on the server, so it shows on first paint.',
      next: [{ to: 'gateway', kind: 'next' }],
    },
    {
      id: 'gateway',
      title: 'Gateway: the usual checks',
      kind: 'middleware',
      status: 'verified',
      symbol: GATEWAY_APP,
      highlight: 'const matched = matchRoute(req.method, req.path);',
      what: "Each call goes through the same checks as in GET /chats: the per-IP limit, the route (GET /api/chats/:id or /api/chats/:id/messages, session 'required'), the session in Redis (renewed), the per-user limit and requireSession. gatewayGet sends no Origin, which a GET does not need, no X-Forwarded-For, so the gateway sees the Next.js server as the client, and no request ID, so the gateway makes one per call. No session is a 401.",
      why: 'Server calls are checked exactly like browser calls.',
      sideEffects: ['Renews the session in Redis and counts the request for the rate limits.'],
    },
    {
      id: 'gw-forward',
      title: 'Gateway: forward to chat',
      kind: 'external',
      status: 'verified',
      symbol: PROXY,
      highlight: 'await signInternalToken(deps.privateKey, service, {',
      what: 'proxyToService signs a token for chat with the user as its subject and calls CHAT_SERVICE_URL/chats/<id> or /chats/<id>/messages.',
      why: 'Chat learns the user only from the token.',
    },
    {
      id: 'chat-owned',
      title: "Chat: load the user's own chat",
      kind: 'datastore',
      status: 'verified',
      symbol: OWNED_OR_404,
      highlight: 'const chat = await findOwnedConversation(res.locals.userId as string, id);',
      what: "After the internal-token check and requireUser, both routes call ownedOr404: the chat by ID, for this user, not deleted. Anything else is the 404 'No such chat'.",
      why: "The messages route checks the chat first, so it never reads the messages of a chat that is not the user's.",
    },
    {
      id: 'chat-answer',
      title: 'Chat answers: the chat, or the newest messages',
      kind: 'response',
      status: 'verified',
      symbol: CHAT_ROUTES,
      highlight: 'items: page.reverse().map(toMessage),',
      what: 'GET /chats/:id answers { chat }. GET /chats/:id/messages reads the newest 30 messages that are not superseded (createdAt and _id, newest first, one more than the page), turns the page around so it is oldest first and answers { items, nextCursor }, with a cursor for older messages when there are more.',
      why: 'The newest messages are the ones to show first, in reading order.',
      output: '200 { "chat": {...} } and 200 { "items": [...], "nextCursor": ... }',
      next: [{ to: 'check-answers', kind: 'next' }],
    },
    {
      id: 'check-answers',
      title: 'Check both answers',
      kind: 'function',
      status: 'verified',
      symbol: LOAD_CHAT,
      highlight: 'if (chatResponse.status === 404) {',
      what: 'Once both answers are in, getChatWithHistory looks at them in order: no cookie or a 401 for the chat sends the visitor to /login; a 404 for the chat gives null; any other failure throws; otherwise it reads both bodies.',
      why: "A missing, deleted and someone else's chat all give the same 404, so all three lead to the same page.",
      next: [
        { to: 'render', kind: 'next' },
        { to: 'not-found', kind: 'branch', label: 'the chat answered 404' },
        { to: 'session-ended', kind: 'error', label: 'no cookie, or a 401' },
        { to: 'load-failed', kind: 'error', label: 'any other failure' },
      ],
    },
    {
      id: 'session-ended',
      title: 'Session ended: redirect to /login',
      kind: 'response',
      status: 'verified',
      symbol: LOAD_CHAT,
      highlight: "redirect('/login');",
      what: "redirect('/login') stops the render and sends the visitor to the sign-in page.",
      why: 'A cookie can outlive its session.',
      next: [],
    },
    {
      id: 'load-failed',
      title: 'Another failure: the render fails',
      kind: 'error',
      status: 'verified',
      symbol: LOAD_CHAT,
      highlight: 'throw new Error(`the gateway answered ${response.status} for chat ${chatId}`);',
      what: 'Any other status, such as a 503 when chat is down, throws an error naming the status, and Next.js shows its error page.',
      why: 'A failure never looks like a missing chat.',
      next: [],
    },
    {
      id: 'not-found',
      title: "The chat isn't available",
      kind: 'response',
      status: 'verified',
      symbol: CHAT_VIEW,
      highlight: 'notFound();',
      what: "ChatView calls notFound(), and Next.js renders the segment's not-found page, ChatNotFound: 'This chat isn't available', with a link to start a new chat. generateMetadata titles the tab 'Chat not found'.",
      why: 'The page says the same thing for every reason, so it reveals nothing.',
      next: [],
    },
    {
      id: 'render',
      title: 'Render the title bar and the messages',
      kind: 'response',
      status: 'verified',
      symbol: CHAT_VIEW,
      highlight: 'chat={loaded.chat}',
      what: "ChatView renders ChatThread with the chat and the messages; ChatThread puts ChatHeader on top with the live message count. The HTML streams in place of the skeleton. ChatThread is a client component, but the server renders it to HTML too; in the browser it then takes over, with the composer. generateMetadata titles the tab with the chat's title.",
      why: 'The history is in the first HTML, with no loading spinner for it.',
      output: 'The chat page as HTML.',
    },
    {
      id: 'hydrate',
      title: 'In the browser, the title bar follows the cache',
      kind: 'function',
      status: 'verified',
      symbol: 'frontend/src/components/chats/chat-header.tsx#ChatHeader',
      highlight: 'const { data } = useGetChatQuery(initial.id);',
      what: "ChatHeader starts from the server's chat and asks RTK Query for GET /api/chats/<id> (getChat), which goes through the /api proxy. A later rename or pin from the sidebar marks that chat stale, it is fetched again, and the header and tab title follow.",
      why: 'The page keeps up with changes made elsewhere in the app.',
      next: [],
    },
  ],
};

const chatNotYours: Flow = {
  id: 'chat-not-yours',
  title: "Another user's chat → 404",
  category: 'errors',
  apps: APPS,
  summary:
    "Every route for one chat looks it up by its ID and the user in the internal token, and only if it is not deleted. A chat that belongs to someone else therefore gets exactly the same 404 'No such chat' as a deleted one, one that never existed or an ID that is not an ObjectId, so the answer reveals nothing about other users' chats. Nothing is read or changed. The chat page shows 'This chat isn't available'; a rename, pin or delete is undone with a toast. chat-routes.test.ts checks GET, PATCH, DELETE and the messages route with someone else's chat, a missing ID and 'not-an-id', and journey.test.ts again through the real gateway (SEC-04).",
  status: 'verified',
  steps: [
    {
      id: 'caller',
      title: "A signed-in user asks for a chat that isn't theirs",
      kind: 'trigger',
      status: 'verified',
      what: "GET, PATCH or DELETE /api/chats/<id>, or GET /api/chats/<id>/messages, with someone else's chat ID: for example by opening /c/<id> from a shared link. The same happens for the user's own chat after it was deleted in another tab.",
      why: 'Chat IDs show in addresses, so anyone can try one.',
      input: 'A chat ID and a valid session for another user.',
    },
    {
      id: 'gateway',
      title: 'The gateway lets it through',
      kind: 'middleware',
      status: 'verified',
      symbol: GATEWAY_APP,
      highlight: 'const matched = matchRoute(req.method, req.path);',
      what: "The route is in the table and the ID matches SAFE_PARAM (an ID with other characters gets the gateway's own 404 instead). The Origin is checked for PATCH and DELETE, and the session is valid, so every check passes: the gateway does not know who owns a chat.",
      why: "Ownership is chat's business; the gateway only proves who is asking.",
    },
    {
      id: 'gw-forward',
      title: 'Gateway: a token for the user who asks',
      kind: 'function',
      status: 'verified',
      symbol: PROXY,
      highlight: 'await signInternalToken(deps.privateKey, service, {',
      what: "proxyToService signs a token for chat whose subject is the signed-in user, not the chat's owner, and forwards the request to /chats/<id>.",
      why: 'Chat cannot be told to act as someone else: the user comes from the session.',
    },
    {
      id: 'chat-route',
      title: 'Chat: the route takes any ID',
      kind: 'handler',
      status: 'verified',
      symbol: CHAT_ROUTES,
      highlight: "router.use('/chats', requireUser());",
      what: "requireInternalToken sets res.locals.userId from the token and requireUser passes. validate accepts any ID of 1 to 64 characters, so even 'not-an-id' reaches the lookup.",
      why: 'Every wrong ID ends in the same place, so no shape of ID answers differently.',
    },
    {
      id: 'owned',
      title: 'Chat: ownedOr404',
      kind: 'function',
      status: 'verified',
      symbol: OWNED_OR_404,
      highlight: 'const chat = await findOwnedConversation(res.locals.userId as string, id);',
      what: 'GET, PATCH and DELETE /chats/:id and GET /chats/:id/messages all start with ownedOr404, with the user from the token.',
      why: 'One check for every route means none can forget it.',
    },
    {
      id: 'find',
      title: 'findOwnedConversation',
      kind: 'function',
      status: 'verified',
      symbol: FIND_OWNED,
      highlight: 'if (!mongoose.isValidObjectId(conversationId)) {',
      what: 'An ID that is not a valid ObjectId gives null at once. Any other ID is looked up.',
      why: 'A malformed ID cannot be a chat, and it ends the same way as the others.',
      next: [
        { to: 'query', kind: 'branch', label: 'a valid ObjectId' },
        { to: 'not-found', kind: 'branch', label: 'not an ObjectId: null' },
      ],
    },
    {
      id: 'query',
      title: 'One query with the owner in the filter',
      kind: 'datastore',
      status: 'verified',
      symbol: FIND_OWNED,
      highlight:
        'return ConversationModel.findOne({ _id: conversationId, userId, deletedAt: null });',
      what: "findOne filters by the ID, the asking user's ID and deletedAt: null. Someone else's chat, a deleted chat and an unknown ID all fail the same filter, and MongoDB returns null. (The user's own chat is found, which the other chat flows follow.)",
      why: 'The owner check is part of the query, not a separate check afterwards, so there is no way to read a chat and then forget to check it.',
    },
    {
      id: 'not-found',
      title: "ownedOr404: 'No such chat'",
      kind: 'error',
      status: 'verified',
      symbol: OWNED_OR_404,
      highlight: 'throw notFound();',
      what: "ownedOr404 throws AppError('not_found', 'No such chat') before the route does anything: a PATCH renames nothing, a DELETE deletes nothing, and no message is read.",
      why: 'Nothing about the chat is touched.',
    },
    {
      id: 'chat-404',
      title: 'Chat answers 404',
      kind: 'response',
      status: 'verified',
      symbol: 'backend/shared/src/errors.ts#errorHandler',
      highlight: ".type('application/problem+json')",
      what: "errorHandler answers 404 problem+json: { type: '/errors/not_found', title: 'Not found', status: 404, code: 'not_found', detail: 'No such chat', requestId }. The body is the same, word for word, whatever the reason.",
      why: 'So the answer cannot tell anyone whether a chat exists (SEC-04).',
      output: '404 { "code": "not_found", "detail": "No such chat", ... }',
    },
    {
      id: 'gw-pass',
      title: 'The gateway passes the 404 back',
      kind: 'response',
      status: 'verified',
      symbol: PROXY,
      highlight: 'stream.pipe(res);',
      what: 'proxyToService copies the status, the Content-Type and the body back unchanged.',
      why: "The service's own error reaches the caller as it is.",
      next: [
        { to: 'page-null', kind: 'branch', label: 'the chat page asked, on the server' },
        { to: 'toast', kind: 'branch', label: 'the browser asked: rename, pin or delete' },
        { to: 'access-log', kind: 'async', label: 'after the response finishes' },
      ],
    },
    {
      id: 'page-null',
      title: 'The chat page gets null',
      kind: 'function',
      status: 'verified',
      symbol: LOAD_CHAT,
      highlight: 'if (chatResponse.status === 404) {',
      what: 'getChatWithHistory sees the 404 for the chat and returns null, and ChatView calls notFound().',
      why: 'A chat that is not available is not an error of the app.',
    },
    {
      id: 'page-not-found',
      title: "'This chat isn't available'",
      kind: 'response',
      status: 'verified',
      symbol: 'frontend/src/app/(app)/c/[chatId]/not-found.tsx#ChatNotFound',
      what: "Next.js renders ChatNotFound: 'This chat isn't available. It may have been deleted, or the link is wrong.', with a button to start a new chat. The tab says 'Chat not found'.",
      why: 'The same words for every reason.',
      next: [],
    },
    {
      id: 'toast',
      title: 'In the browser: undo and a toast',
      kind: 'response',
      status: 'verified',
      symbol: 'frontend/src/components/chats/chat-actions.tsx#useChatActions',
      highlight: 'const { message, requestId } = errorMessage(error);',
      what: "RTK Query undoes the optimistic change, and useChatActions (behind the row's menu) shows a toast such as 'Could not pin the chat' with the detail 'No such chat' and the request ID. chats.test.tsx checks this for a pin.",
      why: 'The user sees why nothing changed.',
      next: [],
    },
    {
      id: 'access-log',
      title: 'Logged at warn',
      kind: 'function',
      status: 'verified',
      symbol: CREATE_SERVICE,
      highlight: "return res.statusCode >= 400 ? 'warn' : 'info';",
      what: "pino-http writes 'request completed' at warn in chat and in the gateway, with the same request ID.",
      why: 'Many 404s for one user can point to someone guessing IDs.',
      sideEffects: ['Writes one warn line in chat and one in the gateway.'],
    },
  ],
};

export const chatRouteFlows: Flow[] = [listChats, updateChat, deleteChat, openChat];

/** The error flow for chats, listed under Error Handling. */
export const chatErrorFlows: Flow[] = [chatNotYours];
