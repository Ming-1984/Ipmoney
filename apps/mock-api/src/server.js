const http = require('node:http');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.MOCK_API_PORT || process.env.PORT || 4010);
const PRISM_PORT = Number(process.env.MOCK_API_PRISM_PORT || process.env.PRISM_PORT || 4011);
const UPSTREAM_API_BASE_URL = process.env.UPSTREAM_API_BASE_URL || '';
const UPSTREAM_PATH_PREFIXES = (process.env.UPSTREAM_PATH_PREFIXES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const UPSTREAM_FALLBACK_STATUSES = (process.env.UPSTREAM_FALLBACK_STATUSES || '404,501')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n));

const OPENAPI_PATH = path.resolve(__dirname, '../../../docs/api/openapi.yaml');
const FIXTURES_DIR = path.resolve(__dirname, '../../../packages/fixtures/scenarios');

const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function listRoutesFromScenario(scenario) {
  const scenarioDir = path.join(FIXTURES_DIR, scenario);
  const indexPath = path.join(scenarioDir, 'index.json');
  const json = readJsonIfExists(indexPath);
  if (!json) return [];
  return Object.entries(json).map(([key, value]) => ({ key, value }));
}

function matchRoute(method, pathname, routeKey) {
  const [routeMethod, routePathPattern] = routeKey.split(' ', 2);
  if (!routeMethod || !routePathPattern) return false;
  if (routeMethod.toUpperCase() !== method.toUpperCase()) return false;

  const actual = pathname.split('/').filter(Boolean);
  const pattern = routePathPattern.split('/').filter(Boolean);
  if (actual.length !== pattern.length) return false;

  for (let i = 0; i < pattern.length; i += 1) {
    const p = pattern[i];
    const a = actual[i];
    if (p.startsWith(':')) continue;
    if (p !== a) return false;
  }
  return true;
}

function countParamSegments(routeKey) {
  const [, routePathPattern] = routeKey.split(' ', 2);
  if (!routePathPattern) return Number.POSITIVE_INFINITY;
  return routePathPattern
    .split('/')
    .filter(Boolean)
    .filter((seg) => seg.startsWith(':')).length;
}

function pickFixtureResponse({ method, pathname, scenario }) {
  const primary = listRoutesFromScenario(scenario);
  const fallback = scenario === 'happy' ? [] : listRoutesFromScenario('happy');

  const pickMostSpecific = (routes) => {
    const matches = routes.filter((r) => matchRoute(method, pathname, r.key));
    if (!matches.length) return null;
    matches.sort((a, b) => countParamSegments(a.key) - countParamSegments(b.key));
    return matches[0].value;
  };

  const primaryPicked = pickMostSpecific(primary);
  if (primaryPicked) return primaryPicked;
  return pickMostSpecific(fallback);
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Mock-Scenario, X-Mock-Source, Idempotency-Key, Wechatpay-Timestamp, Wechatpay-Nonce, Wechatpay-Signature, Wechatpay-Serial, Wechatpay-Signature-Type',
  );
}

function startPrism() {
  const args = [
    'exec',
    'prism',
    'mock',
    OPENAPI_PATH,
    '--port',
    String(PRISM_PORT),
    '--host',
    HOST,
    '--cors',
  ];

  // On Windows, `spawn()` can't execute `.cmd` directly; it must go through `cmd.exe`.
  const command = process.platform === 'win32' ? 'cmd.exe' : PNPM_CMD;
  const commandArgs = process.platform === 'win32' ? ['/d', '/s', '/c', PNPM_CMD, ...args] : args;

  const child = spawn(command, commandArgs, {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    windowsHide: true,
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[mock-api] prism exited with code ${code}`);
    }
  });

  return child;
}

async function proxyToPrism(req, res, bodyBuffer) {
  return proxyToBaseUrl(req, res, bodyBuffer, `http://${HOST}:${PRISM_PORT}`, { allowFallback: false });
}

function safeJsonParse(buffer) {
  if (!buffer || !buffer.length) return null;
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch (_) {
    return null;
  }
}

function sendFixture(res, fixture) {
  const status = fixture.status ?? 200;
  const headers = fixture.headers ?? {};
  const body = fixture.body ?? null;

  res.statusCode = status;
  for (const [k, v] of Object.entries(headers)) {
    res.setHeader(k, v);
  }

  if (body === null || body === undefined) {
    res.end();
    return;
  }

  if (Buffer.isBuffer(body)) {
    res.end(body);
    return;
  }

  if (typeof body === 'string') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(body);
    return;
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function joinBaseUrl(baseUrl, requestUrl) {
  const base = new URL(baseUrl);
  const reqUrl = new URL(requestUrl, 'http://local');
  const basePath = base.pathname === '/' ? '' : base.pathname.replace(/\/$/, '');
  const joined = new URL(base.origin);
  joined.pathname = `${basePath}${reqUrl.pathname}`;
  joined.search = reqUrl.search;
  return joined.toString();
}

function pathnameMatchesPrefix(pathname, prefix) {
  const p = prefix.startsWith('/') ? prefix : `/${prefix}`;
  if (pathname === p) return true;
  return pathname.startsWith(`${p}/`);
}

async function proxyToBaseUrl(req, res, bodyBuffer, baseUrl, { allowFallback }) {
  const targetUrl = joinBaseUrl(baseUrl, req.url);

  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    const key = k.toLowerCase();
    if (key === 'host') continue;
    if (key === 'x-mock-scenario') continue;
    if (key === 'x-mock-source') continue;
    headers[k] = v;
  }

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: bodyBuffer && bodyBuffer.length > 0 ? bodyBuffer : undefined,
    });
  } catch (err) {
    if (allowFallback) return null;
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        code: 'BAD_GATEWAY',
        message: 'Mock upstream not ready',
        details: { targetUrl },
      }),
    );
    return null;
  }

  if (allowFallback && UPSTREAM_FALLBACK_STATUSES.includes(upstream.status)) {
    return null;
  }

  res.statusCode = upstream.status;
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return;
    res.setHeader(key, value);
  });

  const ab = await upstream.arrayBuffer();
  res.end(Buffer.from(ab));
  return upstream.status;
}

const prismProcess = startPrism();

const dynamicState = {
  orderStatusOverride: new Map(),
  approvedListingById: new Map(),
  conversationPatchById: new Map(),
  messagesByConversationId: new Map(),
  favoriteListingIds: new Set(),
  listingStatsDeltaById: new Map(),
  myVerification: null,
  userVerificationsById: new Map(),
  mePatch: {},
};

function toListingSummary(approvedListing) {
  if (!approvedListing || typeof approvedListing !== 'object') return null;
  const id = approvedListing.id;
  if (!id) return null;

  return {
    id,
    patentId: approvedListing.patentId,
    applicationNoDisplay: approvedListing.applicationNoDisplay,
    patentType: approvedListing.patentType,
    title: approvedListing.title,
    inventorNames: approvedListing.inventorNames || [],
    tradeMode: approvedListing.tradeMode,
    licenseMode: approvedListing.licenseMode,
    priceType: approvedListing.priceType,
    priceAmountFen: approvedListing.priceAmountFen,
    depositAmountFen: approvedListing.depositAmountFen ?? 0,
    regionCode: approvedListing.regionCode,
    industryTags: approvedListing.industryTags || [],
    featuredLevel: approvedListing.featuredLevel || 'NONE',
    featuredRegionCode: approvedListing.featuredRegionCode,
    featuredRank: approvedListing.featuredRank,
    stats: approvedListing.stats || { viewCount: 0, favoriteCount: 0, consultCount: 0 },
    recommendationScore: approvedListing.recommendationScore ?? 0.66,
    auditStatus: approvedListing.auditStatus,
    status: approvedListing.status,
    coverUrl: approvedListing.coverUrl,
    createdAt: approvedListing.createdAt,
  };
}

function applyListingStatsDelta(stats, listingId) {
  if (!listingId) return stats;
  const delta = dynamicState.listingStatsDeltaById.get(listingId);
  if (!delta) return stats;
  const base = stats || { viewCount: 0, favoriteCount: 0, consultCount: 0 };
  return {
    viewCount: Math.max(0, Number(base.viewCount || 0) + Number(delta.viewCountDelta || 0)),
    favoriteCount: Math.max(0, Number(base.favoriteCount || 0) + Number(delta.favoriteCountDelta || 0)),
    consultCount: Math.max(0, Number(base.consultCount || 0) + Number(delta.consultCountDelta || 0)),
  };
}

function patchListingSummary(summary) {
  if (!summary || typeof summary !== 'object' || !summary.id) return summary;
  if (!dynamicState.listingStatsDeltaById.size) return summary;
  const nextStats = applyListingStatsDelta(summary.stats, summary.id);
  return { ...summary, stats: nextStats };
}

function seedUserIdFromFixtures() {
  const me = pickFixtureResponse({ method: 'GET', pathname: '/me', scenario: 'happy' });
  return me?.body?.id || '99999999-9999-9999-9999-999999999999';
}

function findListingSummaryById(listingId) {
  if (!listingId) return null;
  const approved = dynamicState.approvedListingById.get(listingId);
  if (approved) {
    const s = toListingSummary(approved);
    return s ? patchListingSummary(s) : null;
  }

  const sources = [
    { pathname: '/search/listings', key: 'items' },
    { pathname: '/me/recommendations/listings', key: 'items' },
    { pathname: '/me/favorites', key: 'items' },
  ];

  for (const src of sources) {
    const base = pickFixtureResponse({ method: 'GET', pathname: src.pathname, scenario: 'happy' });
    const baseItems = Array.isArray(base?.body?.[src.key]) ? base.body[src.key] : Array.isArray(base?.body?.items) ? base.body.items : [];
    const found = baseItems.find((it) => it && typeof it === 'object' && it.id === listingId);
    if (found) return patchListingSummary(found);
  }

  return patchListingSummary({
    id: listingId,
    title: '（演示）未知上架',
    tradeMode: 'ASSIGNMENT',
    priceType: 'NEGOTIABLE',
    depositAmountFen: 100000,
    auditStatus: 'APPROVED',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    stats: { viewCount: 0, favoriteCount: 0, consultCount: 0 },
  });
}

function toOrganizationSummaryFromVerification(v) {
  if (!v || typeof v !== 'object') return null;
  if (!v.userId || !v.displayName) return null;
  if (v.status !== 'APPROVED') return null;
  if (v.type !== 'COMPANY' && v.type !== 'ACADEMY') return null;
  return {
    userId: v.userId,
    displayName: v.displayName,
    verificationType: v.type,
    verificationStatus: v.status,
    regionCode: v.regionCode,
    logoUrl: v.logoUrl,
    intro: v.intro,
    stats: v.stats || { listingCount: 0, patentCount: 0 },
    verifiedAt: v.reviewedAt || v.submittedAt || new Date().toISOString(),
  };
}

function maybeSendDynamic(req, res, { method, url, scenario }) {
  if (scenario !== 'happy') return false;
  const pathname = url.pathname;

  if (method.toUpperCase() === 'GET' && pathname === '/me') {
    const base = pickFixtureResponse({ method: 'GET', pathname: '/me', scenario: 'happy' });
    if (!base || base.status >= 400 || !base.body) return false;
    sendFixture(res, { status: 200, body: { ...base.body, ...dynamicState.mePatch } });
    return true;
  }

  if (method.toUpperCase() === 'GET' && pathname === '/me/verification') {
    if (!dynamicState.myVerification) return false;
    sendFixture(res, { status: 200, body: dynamicState.myVerification });
    return true;
  }

  if (method.toUpperCase() === 'GET' && pathname === '/me/favorites') {
    const page = Number(url.searchParams.get('page') || 1);
    const pageSize = Number(url.searchParams.get('pageSize') || 10);
    const ids = [...dynamicState.favoriteListingIds];
    const all = ids
      .map((id) => findListingSummaryById(id))
      .filter(Boolean);

    const start = Math.max(0, (page - 1) * pageSize);
    const paged = all.slice(start, start + pageSize);
    sendFixture(res, { status: 200, body: { items: paged, page: { page, pageSize, total: all.length } } });
    return true;
  }

  if (method.toUpperCase() === 'GET' && pathname === '/public/organizations') {
    const base = pickFixtureResponse({ method: 'GET', pathname: '/public/organizations', scenario: 'happy' });
    if (!base || base.status >= 400 || !base.body) return false;

    const qTypes = url.searchParams.getAll('types').filter(Boolean);
    const allowTypes = qTypes.length ? new Set(qTypes) : new Set(['COMPANY', 'ACADEMY']);

    const baseItems = Array.isArray(base.body?.items) ? base.body.items : [];
    const extras = [];
    for (const v of dynamicState.userVerificationsById.values()) {
      const org = toOrganizationSummaryFromVerification(v);
      if (!org) continue;
      if (!allowTypes.has(org.verificationType)) continue;
      extras.push(org);
    }

    const seen = new Set();
    const merged = [];
    for (const it of [...extras, ...baseItems]) {
      const key = it?.userId;
      if (!key) continue;
      if (seen.has(key)) continue;
      if (!allowTypes.has(it.verificationType)) continue;
      seen.add(key);
      merged.push(it);
    }

    const page = Number(url.searchParams.get('page') || 1);
    const pageSize = Number(url.searchParams.get('pageSize') || 10);
    const start = Math.max(0, (page - 1) * pageSize);
    const paged = merged.slice(start, start + pageSize);

    sendFixture(res, { status: 200, body: { items: paged, page: { page, pageSize, total: merged.length } } });
    return true;
  }

  const orgMatch = pathname.match(/^\/public\/organizations\/([^/]+)$/);
  if (method.toUpperCase() === 'GET' && orgMatch) {
    const orgUserId = orgMatch[1];
    for (const v of dynamicState.userVerificationsById.values()) {
      const org = toOrganizationSummaryFromVerification(v);
      if (org && org.userId === orgUserId) {
        sendFixture(res, { status: 200, body: org });
        return true;
      }
    }
  }

  const publicListingMatch = pathname.match(/^\/public\/listings\/([^/]+)$/);
  if (method.toUpperCase() === 'GET' && publicListingMatch) {
    const listingId = publicListingMatch[1];
    const base = pickFixtureResponse({ method: 'GET', pathname, scenario: 'happy' });
    if (!base || base.status >= 400 || !base.body) return false;
    const next = { ...base.body };
    next.stats = applyListingStatsDelta(next.stats, listingId);
    sendFixture(res, { status: 200, body: next });
    return true;
  }

  if (method.toUpperCase() === 'GET' && pathname === '/me/recommendations/listings' && dynamicState.listingStatsDeltaById.size) {
    const base = pickFixtureResponse({ method: 'GET', pathname: '/me/recommendations/listings', scenario: 'happy' });
    if (!base || base.status >= 400 || !base.body) return false;
    const baseItems = Array.isArray(base.body?.items) ? base.body.items : [];
    const items = baseItems.map((it) => patchListingSummary(it));
    sendFixture(res, { status: 200, body: { ...base.body, items } });
    return true;
  }

  if (method.toUpperCase() === 'GET' && pathname === '/me/conversations') {
    const hasConversationState =
      dynamicState.conversationPatchById.size > 0 || dynamicState.messagesByConversationId.size > 0;
    if (!hasConversationState) return false;

    const base = pickFixtureResponse({ method: 'GET', pathname: '/me/conversations', scenario: 'happy' });
    if (!base || base.status >= 400) return false;

    const baseItems = Array.isArray(base.body?.items) ? base.body.items : [];
    const items = baseItems.map((c) => {
      if (!c || !c.id) return c;

      const patch = dynamicState.conversationPatchById.get(c.id);
      if (patch) {
        return {
          ...c,
          ...patch,
        };
      }

      const extraMessages = dynamicState.messagesByConversationId.get(c.id);
      if (extraMessages && extraMessages.length) {
        const last = extraMessages[extraMessages.length - 1];
        return {
          ...c,
          lastMessagePreview: last?.text || last?.fileUrl || c.lastMessagePreview,
          lastMessageAt: last?.createdAt || c.lastMessageAt,
          unreadCount: 0,
        };
      }

      return c;
    });

    sendFixture(res, {
      status: 200,
      body: {
        items,
        page: base.body?.page || { page: 1, pageSize: 20, total: items.length },
      },
    });
    return true;
  }

  const convMsgMatch = pathname.match(/^\/conversations\/([^/]+)\/messages$/);
  if (method.toUpperCase() === 'GET' && convMsgMatch) {
    const conversationId = convMsgMatch[1];
    const extra = dynamicState.messagesByConversationId.get(conversationId);
    if (!extra || !extra.length) return false;

    const base = pickFixtureResponse({ method: 'GET', pathname, scenario: 'happy' });
    if (!base || base.status >= 400) return false;

    const baseItems = Array.isArray(base.body?.items) ? base.body.items : [];
    const seen = new Set();
    const items = [];

    for (const m of [...baseItems, ...extra]) {
      if (!m || !m.id) continue;
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      items.push(m);
    }

    sendFixture(res, {
      status: 200,
      body: {
        items,
        nextCursor: null,
      },
    });
    return true;
  }

  if (method.toUpperCase() === 'GET' && pathname === '/search/listings' && dynamicState.approvedListingById.size) {
    const base = pickFixtureResponse({ method: 'GET', pathname: '/search/listings', scenario: 'happy' });
    if (!base || base.status >= 400) return false;

    const page = Number(url.searchParams.get('page') || 1);
    const pageSize = Number(url.searchParams.get('pageSize') || 10);
    const baseItems = Array.isArray(base.body?.items) ? base.body.items : [];
    const extras = [];
    for (const listing of dynamicState.approvedListingById.values()) {
      const summary = toListingSummary(listing);
      if (summary) extras.push(summary);
    }

    const seen = new Set();
    const all = [];
    for (const it of [...extras, ...baseItems]) {
      if (!it || !it.id) continue;
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      all.push(it);
    }

    const start = Math.max(0, (page - 1) * pageSize);
    const paged = all.slice(start, start + pageSize).map((it) => patchListingSummary(it));

    sendFixture(res, {
      status: 200,
      body: {
        items: paged,
        page: { page, pageSize, total: all.length },
      },
    });
    return true;
  }

  if (method.toUpperCase() === 'GET' && pathname === '/admin/user-verifications' && dynamicState.userVerificationsById.size) {
    const base = pickFixtureResponse({ method: 'GET', pathname: '/admin/user-verifications', scenario: 'happy' });
    if (!base || base.status >= 400 || !base.body) return false;

    const baseItems = Array.isArray(base.body?.items) ? base.body.items : [];
    const extras = [];
    for (const v of dynamicState.userVerificationsById.values()) extras.push(v);

    const seen = new Set();
    const all = [];
    for (const it of [...extras, ...baseItems]) {
      if (!it || !it.id) continue;
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      all.push(it);
    }

    sendFixture(res, {
      status: 200,
      body: {
        items: all,
        page: base.body?.page || { page: 1, pageSize: all.length, total: all.length },
      },
    });
    return true;
  }

  if (method.toUpperCase() === 'GET' && pathname === '/admin/listings' && dynamicState.approvedListingById.size) {
    const base = pickFixtureResponse({ method: 'GET', pathname: '/admin/listings', scenario: 'happy' });
    if (!base || base.status >= 400) return false;

    const baseItems = Array.isArray(base.body?.items) ? base.body.items : [];
    const extras = [];
    for (const listing of dynamicState.approvedListingById.values()) {
      extras.push(listing);
    }

    const seen = new Set();
    const all = [];
    for (const it of [...extras, ...baseItems]) {
      if (!it || !it.id) continue;
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      all.push(it);
    }

    sendFixture(res, {
      status: 200,
      body: {
        items: all,
        page: { page: 1, pageSize: all.length, total: all.length },
      },
    });
    return true;
  }

  const orderMatch = pathname.match(/^\/orders\/([^/]+)$/);
  if (method.toUpperCase() === 'GET' && orderMatch) {
    const orderId = orderMatch[1];
    const override = dynamicState.orderStatusOverride.get(orderId);
    if (!override) return false;

    const base = pickFixtureResponse({ method: 'GET', pathname: '/orders/:orderId', scenario: 'happy' });
    if (!base || base.status >= 400 || !base.body) return false;

    sendFixture(res, {
      status: 200,
      body: { ...base.body, id: orderId, status: override, updatedAt: new Date().toISOString() },
    });
    return true;
  }

  return false;
}

function maybeUpdateDynamicState({ method, pathname, scenario, requestBody, fixture }) {
  if (scenario !== 'happy') return;
  const status = fixture?.status ?? 200;
  if (status < 200 || status >= 300) return;

  const favoritesMatch = pathname.match(/^\/listings\/([^/]+)\/favorites$/);
  if (favoritesMatch) {
    const listingId = favoritesMatch[1];
    const existing = dynamicState.listingStatsDeltaById.get(listingId) || {
      viewCountDelta: 0,
      favoriteCountDelta: 0,
      consultCountDelta: 0,
    };

    if (method.toUpperCase() === 'POST') {
      dynamicState.favoriteListingIds.add(listingId);
      dynamicState.listingStatsDeltaById.set(listingId, { ...existing, favoriteCountDelta: existing.favoriteCountDelta + 1 });
      return;
    }
    if (method.toUpperCase() === 'DELETE') {
      dynamicState.favoriteListingIds.delete(listingId);
      dynamicState.listingStatsDeltaById.set(listingId, { ...existing, favoriteCountDelta: existing.favoriteCountDelta - 1 });
      return;
    }
  }

  const consultMatch = pathname.match(/^\/listings\/([^/]+)\/consultations$/);
  if (method.toUpperCase() === 'POST' && consultMatch) {
    const listingId = consultMatch[1];
    const existing = dynamicState.listingStatsDeltaById.get(listingId) || {
      viewCountDelta: 0,
      favoriteCountDelta: 0,
      consultCountDelta: 0,
    };
    dynamicState.listingStatsDeltaById.set(listingId, { ...existing, consultCountDelta: existing.consultCountDelta + 1 });
    return;
  }

  if (method.toUpperCase() === 'PATCH' && pathname === '/me') {
    dynamicState.mePatch = { ...dynamicState.mePatch, ...(requestBody || {}) };
    if (fixture && fixture.body && typeof fixture.body === 'object') {
      fixture.body = { ...fixture.body, ...dynamicState.mePatch };
    }
    return;
  }

  if (method.toUpperCase() === 'POST' && pathname === '/me/verification') {
    const userId = seedUserIdFromFixtures();
    const type = requestBody?.type || 'PERSON';
    const now = new Date().toISOString();
    const approved = type === 'PERSON';
    const v = {
      id: dynamicState.myVerification?.id || randomUUID(),
      userId,
      type,
      status: approved ? 'APPROVED' : 'PENDING',
      displayName: requestBody?.displayName || '演示用户',
      regionCode: requestBody?.regionCode,
      intro: requestBody?.intro,
      logoFileId: requestBody?.logoFileId,
      logoUrl: requestBody?.logoUrl,
      evidenceFileIds: Array.isArray(requestBody?.evidenceFileIds) ? requestBody.evidenceFileIds : [],
      submittedAt: now,
      ...(approved ? { reviewedAt: now, reviewComment: '个人秒通过（演示）' } : {}),
    };

    dynamicState.myVerification = v;
    dynamicState.userVerificationsById.set(v.id, v);
    dynamicState.mePatch = { ...dynamicState.mePatch, verificationType: v.type, verificationStatus: v.status };

    if (fixture) {
      fixture.status = 201;
      fixture.body = v;
    }
    return;
  }

  const adminApproveVerificationMatch = pathname.match(/^\/admin\/user-verifications\/([^/]+)\/approve$/);
  if (method.toUpperCase() === 'POST' && adminApproveVerificationMatch) {
    const id = adminApproveVerificationMatch[1];
    const existing = dynamicState.userVerificationsById.get(id);
    if (existing) {
      const now = new Date().toISOString();
      const updated = { ...existing, status: 'APPROVED', reviewedAt: now, reviewComment: requestBody?.comment || '通过（演示）' };
      dynamicState.userVerificationsById.set(id, updated);
      if (dynamicState.myVerification?.id === id) {
        dynamicState.myVerification = updated;
        dynamicState.mePatch = { ...dynamicState.mePatch, verificationType: updated.type, verificationStatus: updated.status };
      }
      if (fixture) fixture.body = updated;
    }
    return;
  }

  const adminRejectVerificationMatch = pathname.match(/^\/admin\/user-verifications\/([^/]+)\/reject$/);
  if (method.toUpperCase() === 'POST' && adminRejectVerificationMatch) {
    const id = adminRejectVerificationMatch[1];
    const existing = dynamicState.userVerificationsById.get(id);
    if (existing) {
      const now = new Date().toISOString();
      const updated = { ...existing, status: 'REJECTED', reviewedAt: now, reviewComment: requestBody?.reason || '驳回（演示）' };
      dynamicState.userVerificationsById.set(id, updated);
      if (dynamicState.myVerification?.id === id) {
        dynamicState.myVerification = updated;
        dynamicState.mePatch = { ...dynamicState.mePatch, verificationType: updated.type, verificationStatus: updated.status };
      }
      if (fixture) fixture.body = updated;
    }
    return;
  }

  const convReadMatch = pathname.match(/^\/conversations\/([^/]+)\/read$/);
  if (method.toUpperCase() === 'POST' && convReadMatch) {
    dynamicState.conversationPatchById.set(convReadMatch[1], { unreadCount: 0 });
    return;
  }

  const convSendMatch = pathname.match(/^\/conversations\/([^/]+)\/messages$/);
  if (method.toUpperCase() === 'POST' && convSendMatch) {
    const conversationId = convSendMatch[1];
    const message = fixture?.body;
    if (message && typeof message === 'object' && message.id) {
      const list = dynamicState.messagesByConversationId.get(conversationId) || [];
      list.push(message);
      dynamicState.messagesByConversationId.set(conversationId, list);
      dynamicState.conversationPatchById.set(conversationId, {
        lastMessagePreview: message.text || message.fileUrl || '（消息）',
        lastMessageAt: message.createdAt || new Date().toISOString(),
        unreadCount: 0,
      });
    }
    return;
  }

  const payMatch = pathname.match(/^\/orders\/([^/]+)\/payment-intents$/);
  if (method.toUpperCase() === 'POST' && payMatch) {
    const orderId = payMatch[1];
    const payType = requestBody?.payType;
    if (payType === 'DEPOSIT') {
      dynamicState.orderStatusOverride.set(orderId, 'DEPOSIT_PAID');
    } else if (payType === 'FINAL') {
      dynamicState.orderStatusOverride.set(orderId, 'FINAL_PAID_ESCROW');
    }
    return;
  }

  const approveMatch = pathname.match(/^\/admin\/listings\/([^/]+)\/approve$/);
  if (method.toUpperCase() === 'POST' && approveMatch) {
    const listing = fixture?.body;
    const listingId = listing?.id || approveMatch[1];
    if (listingId) {
      dynamicState.approvedListingById.set(listingId, { ...listing, id: listingId, auditStatus: 'APPROVED' });
    }
    return;
  }

  const rejectMatch = pathname.match(/^\/admin\/listings\/([^/]+)\/reject$/);
  if (method.toUpperCase() === 'POST' && rejectMatch) {
    dynamicState.approvedListingById.delete(rejectMatch[1]);
  }
}

const server = http.createServer((req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const scenario =
    (req.headers['x-mock-scenario'] ? String(req.headers['x-mock-scenario']) : null) ||
    url.searchParams.get('__scenario') ||
    'happy';
  const sourceOverride =
    (req.headers['x-mock-source'] ? String(req.headers['x-mock-source']) : null) ||
    url.searchParams.get('__source') ||
    'auto';

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', async () => {
    const bodyBuffer = chunks.length ? Buffer.concat(chunks) : null;
    const requestBody = safeJsonParse(bodyBuffer);

    const upstreamEnabled = Boolean(UPSTREAM_API_BASE_URL) && UPSTREAM_PATH_PREFIXES.length > 0;
    const upstreamMatched = UPSTREAM_PATH_PREFIXES.some((p) => pathnameMatchesPrefix(url.pathname, p));
    const tryUpstream =
      upstreamEnabled && (sourceOverride === 'upstream' || (sourceOverride === 'auto' && upstreamMatched));

    if (tryUpstream) {
      const status = await proxyToBaseUrl(req, res, bodyBuffer, UPSTREAM_API_BASE_URL, {
        allowFallback: sourceOverride !== 'upstream',
      });
      if (status !== null) return;
    }

    if (maybeSendDynamic(req, res, { method: req.method || 'GET', url, scenario })) return;

    const fixture = pickFixtureResponse({ method: req.method || 'GET', pathname: url.pathname, scenario });
    if (fixture) {
      maybeUpdateDynamicState({
        method: req.method || 'GET',
        pathname: url.pathname,
        scenario,
        requestBody,
        fixture,
      });
      sendFixture(res, fixture);
      return;
    }

    await proxyToPrism(req, res, bodyBuffer);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[mock-api] listening on http://${HOST}:${PORT} (scenario fixtures + prism fallback)`);
  console.log(`[mock-api] prism upstream on http://${HOST}:${PRISM_PORT}`);
});

function shutdown() {
  try {
    server.close();
  } catch (_) {}
  try {
    prismProcess.kill();
  } catch (_) {}
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
