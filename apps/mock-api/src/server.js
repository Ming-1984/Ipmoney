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
  const raw = readFileSync(filePath, 'utf8');
  const normalized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(normalized);
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
  demandById: new Map(),
  achievementById: new Map(),
  conversationSummaryById: new Map(),
  conversationPatchById: new Map(),
  messagesByConversationId: new Map(),
  filesById: new Map(),
  commentsById: new Map(),
  commentThreadsByContentKey: new Map(),
  favoriteListingIds: new Set(),
  favoriteDemandIds: new Set(),
  favoriteAchievementIds: new Set(),
  listingStatsDeltaById: new Map(),
  demandStatsDeltaById: new Map(),
  achievementStatsDeltaById: new Map(),
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
    // Extra fields for mock filtering (not required by ListingSummary schema).
    ipcCodes: approvedListing.ipcCodes || [],
    locCodes: approvedListing.locCodes || [],
    legalStatus: approvedListing.legalStatus,
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

function toDemandSummary(demand) {
  if (!demand || typeof demand !== 'object') return null;
  const id = demand.id;
  if (!id) return null;

  return {
    id,
    title: demand.title,
    summary: demand.summary,
    budgetType: demand.budgetType,
    budgetMinFen: demand.budgetMinFen,
    budgetMaxFen: demand.budgetMaxFen,
    cooperationModes: demand.cooperationModes || [],
    regionCode: demand.regionCode,
    industryTags: demand.industryTags || [],
    keywords: demand.keywords || [],
    deliveryPeriod: demand.deliveryPeriod,
    publisher: demand.publisher,
    stats: demand.stats || { viewCount: 0, favoriteCount: 0, consultCount: 0 },
    auditStatus: demand.auditStatus,
    status: demand.status,
    coverUrl: demand.coverUrl,
    createdAt: demand.createdAt,
  };
}

function toAchievementSummary(achievement) {
  if (!achievement || typeof achievement !== 'object') return null;
  const id = achievement.id;
  if (!id) return null;

  return {
    id,
    title: achievement.title,
    summary: achievement.summary,
    maturity: achievement.maturity,
    cooperationModes: achievement.cooperationModes || [],
    regionCode: achievement.regionCode,
    industryTags: achievement.industryTags || [],
    keywords: achievement.keywords || [],
    publisher: achievement.publisher,
    stats: achievement.stats || { viewCount: 0, favoriteCount: 0, consultCount: 0 },
    auditStatus: achievement.auditStatus,
    status: achievement.status,
    coverUrl: achievement.coverUrl,
    createdAt: achievement.createdAt,
  };
}

function applyStatsDelta(stats, id, deltaById) {
  if (!id) return stats;
  const delta = deltaById?.get ? deltaById.get(id) : null;
  if (!delta) return stats;
  const base = stats || { viewCount: 0, favoriteCount: 0, consultCount: 0, commentCount: 0 };
  return {
    viewCount: Math.max(0, Number(base.viewCount || 0) + Number(delta.viewCountDelta || 0)),
    favoriteCount: Math.max(0, Number(base.favoriteCount || 0) + Number(delta.favoriteCountDelta || 0)),
    consultCount: Math.max(0, Number(base.consultCount || 0) + Number(delta.consultCountDelta || 0)),
    commentCount: Math.max(0, Number(base.commentCount || 0) + Number(delta.commentCountDelta || 0)),
  };
}

function applyListingStatsDelta(stats, listingId) {
  return applyStatsDelta(stats, listingId, dynamicState.listingStatsDeltaById);
}

function applyDemandStatsDelta(stats, demandId) {
  return applyStatsDelta(stats, demandId, dynamicState.demandStatsDeltaById);
}

function applyAchievementStatsDelta(stats, achievementId) {
  return applyStatsDelta(stats, achievementId, dynamicState.achievementStatsDeltaById);
}

function patchListingSummary(summary) {
  if (!summary || typeof summary !== 'object' || !summary.id) return summary;
  if (!dynamicState.listingStatsDeltaById.size) return summary;
  const nextStats = applyListingStatsDelta(summary.stats, summary.id);
  return { ...summary, stats: nextStats };
}

function patchDemandSummary(summary) {
  if (!summary || typeof summary !== 'object' || !summary.id) return summary;
  if (!dynamicState.demandStatsDeltaById.size) return summary;
  const nextStats = applyDemandStatsDelta(summary.stats, summary.id);
  return { ...summary, stats: nextStats };
}

function patchAchievementSummary(summary) {
  if (!summary || typeof summary !== 'object' || !summary.id) return summary;
  if (!dynamicState.achievementStatsDeltaById.size) return summary;
  const nextStats = applyAchievementStatsDelta(summary.stats, summary.id);
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

function findDemandSummaryById(demandId) {
  if (!demandId) return null;

  const local = dynamicState.demandById.get(demandId);
  if (local) {
    const s = toDemandSummary(local);
    return s ? patchDemandSummary(s) : null;
  }

  const sources = [
    { pathname: '/search/demands', key: 'items' },
    { pathname: '/me/favorites/demands', key: 'items' },
  ];

  for (const src of sources) {
    const base = pickFixtureResponse({ method: 'GET', pathname: src.pathname, scenario: 'happy' });
    const baseItems = Array.isArray(base?.body?.[src.key]) ? base.body[src.key] : Array.isArray(base?.body?.items) ? base.body.items : [];
    const found = baseItems.find((it) => it && typeof it === 'object' && it.id === demandId);
    if (found) return patchDemandSummary(found);
  }

  return patchDemandSummary({
    id: demandId,
    title: '（演示）未知需求',
    publisher: { userId: seedUserIdFromFixtures(), displayName: '演示用户', verificationType: 'PERSON', verificationStatus: 'APPROVED' },
    auditStatus: 'APPROVED',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    stats: { viewCount: 0, favoriteCount: 0, consultCount: 0 },
    keywords: [],
  });
}

function findAchievementSummaryById(achievementId) {
  if (!achievementId) return null;

  const local = dynamicState.achievementById.get(achievementId);
  if (local) {
    const s = toAchievementSummary(local);
    return s ? patchAchievementSummary(s) : null;
  }

  const sources = [
    { pathname: '/search/achievements', key: 'items' },
    { pathname: '/me/favorites/achievements', key: 'items' },
  ];

  for (const src of sources) {
    const base = pickFixtureResponse({ method: 'GET', pathname: src.pathname, scenario: 'happy' });
    const baseItems = Array.isArray(base?.body?.[src.key]) ? base.body[src.key] : Array.isArray(base?.body?.items) ? base.body.items : [];
    const found = baseItems.find((it) => it && typeof it === 'object' && it.id === achievementId);
    if (found) return patchAchievementSummary(found);
  }

  return patchAchievementSummary({
    id: achievementId,
    title: '（演示）未知成果',
    publisher: { userId: seedUserIdFromFixtures(), displayName: '演示用户', verificationType: 'PERSON', verificationStatus: 'APPROVED' },
    auditStatus: 'APPROVED',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    stats: { viewCount: 0, favoriteCount: 0, consultCount: 0 },
    keywords: [],
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

function getPublisherSummaryForCurrentUser() {
  const userId = seedUserIdFromFixtures();
  const v = dynamicState.myVerification;
  const me = pickFixtureResponse({ method: 'GET', pathname: '/me', scenario: 'happy' });

  const publisher = {
    userId,
    displayName: v?.displayName || me?.body?.nickname || '演示用户',
    verificationType: v?.type || 'PERSON',
    verificationStatus: v?.status || 'APPROVED',
    regionCode: v?.regionCode,
    logoUrl: v?.logoUrl,
    intro: v?.intro,
    stats: v?.stats,
    verifiedAt: v?.reviewedAt || v?.submittedAt,
  };

  return Object.fromEntries(Object.entries(publisher).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

function enrichContentMedia(items) {
  if (!Array.isArray(items)) return [];
  const out = [];
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    if (!it.fileId) continue;
    const file = dynamicState.filesById.get(it.fileId);
    const base = { fileId: it.fileId, type: it.type || 'FILE', sort: Number(it.sort || 0) };
    if (file) {
      out.push({
        ...base,
        url: file.url,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        fileName: file.fileName || file.url?.split('/').pop() || undefined,
      });
      continue;
    }
    out.push({
      ...base,
      ...(it.url ? { url: it.url } : {}),
      ...(it.mimeType ? { mimeType: it.mimeType } : {}),
      ...(it.sizeBytes !== undefined && it.sizeBytes !== null ? { sizeBytes: it.sizeBytes } : {}),
      ...(it.fileName ? { fileName: it.fileName } : {}),
    });
  }
  out.sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
  return out;
}

function getUserBriefForCurrentUser() {
  const userId = seedUserIdFromFixtures();
  const v = dynamicState.myVerification;
  const me = pickFixtureResponse({ method: 'GET', pathname: '/me', scenario: 'happy' });
  return {
    id: userId,
    nickname: me?.body?.nickname || v?.displayName || '演示用户',
    avatarUrl: me?.body?.avatarUrl || '',
    role: me?.body?.role || 'buyer',
    verificationStatus: v?.status || 'APPROVED',
    verificationType: v?.type || 'PERSON',
  };
}

function commentContentKey(contentType, contentId) {
  return `${contentType}:${contentId}`;
}

function commentListFixturePath(contentType) {
  if (contentType === 'LISTING') return '/public/listings/:listingId/comments';
  if (contentType === 'DEMAND') return '/public/demands/:demandId/comments';
  if (contentType === 'ACHIEVEMENT') return '/public/achievements/:achievementId/comments';
  return null;
}

function normalizeComment({ raw, id, contentType, contentId, parentCommentId }) {
  const user =
    raw?.user && typeof raw.user === 'object'
      ? raw.user
      : { id: seedUserIdFromFixtures(), nickname: '演示用户', avatarUrl: '', role: 'buyer' };

  return {
    id,
    contentType,
    contentId,
    parentCommentId: parentCommentId ?? null,
    status: raw?.status || 'VISIBLE',
    user,
    text: raw?.text || '',
    createdAt: raw?.createdAt || new Date().toISOString(),
    updatedAt: raw?.updatedAt || null,
  };
}

function ensureCommentThreadsSeeded(contentType, contentId) {
  const key = commentContentKey(contentType, contentId);
  if (dynamicState.commentThreadsByContentKey.has(key)) return;

  const fixturePath = commentListFixturePath(contentType);
  const base = fixturePath ? pickFixtureResponse({ method: 'GET', pathname: fixturePath, scenario: 'happy' }) : null;
  const baseThreads = Array.isArray(base?.body?.items) ? base.body.items : [];
  const threads = [];

  for (const t of baseThreads) {
    const rawRoot = t?.root;
    if (!rawRoot || typeof rawRoot !== 'object') continue;
    const rawReplies = Array.isArray(t?.replies) ? t.replies : [];

    const idMap = new Map();
    const rootId = randomUUID();
    if (rawRoot.id) idMap.set(String(rawRoot.id), rootId);

    const replyIds = [];
    for (const rawReply of rawReplies) {
      if (!rawReply || typeof rawReply !== 'object') continue;
      const replyId = randomUUID();
      if (rawReply.id) idMap.set(String(rawReply.id), replyId);
      replyIds.push(replyId);
    }

    const root = normalizeComment({ raw: rawRoot, id: rootId, contentType, contentId, parentCommentId: null });
    dynamicState.commentsById.set(rootId, root);

    const normalizedReplyIds = [];
    for (const rawReply of rawReplies) {
      if (!rawReply || typeof rawReply !== 'object') continue;
      const replyId = rawReply.id ? idMap.get(String(rawReply.id)) : null;
      if (!replyId) continue;

      const parent = rawReply.parentCommentId ? idMap.get(String(rawReply.parentCommentId)) || rootId : rootId;
      const reply = normalizeComment({
        raw: rawReply,
        id: replyId,
        contentType,
        contentId,
        parentCommentId: parent,
      });
      dynamicState.commentsById.set(replyId, reply);
      normalizedReplyIds.push(replyId);
    }

    threads.push({ rootId, replyIds: normalizedReplyIds });
  }

  dynamicState.commentThreadsByContentKey.set(key, threads);
}

function findRootCommentId(commentId) {
  let current = dynamicState.commentsById.get(commentId);
  if (!current) return null;
  for (let i = 0; i < 20; i += 1) {
    if (!current?.parentCommentId) return current.id;
    const next = dynamicState.commentsById.get(current.parentCommentId);
    if (!next) return current.id;
    current = next;
  }
  return current?.id || null;
}

function formatPublicComment(c) {
  if (!c || typeof c !== 'object') return null;
  if (c.status === 'DELETED') return { ...c, text: '该留言已删除' };
  if (c.status === 'HIDDEN') return { ...c, text: '该留言已隐藏' };
  return c;
}

function buildPagedCommentThreads({ contentType, contentId, page, pageSize }) {
  ensureCommentThreadsSeeded(contentType, contentId);
  const key = commentContentKey(contentType, contentId);
  const all = dynamicState.commentThreadsByContentKey.get(key) || [];
  const start = Math.max(0, (page - 1) * pageSize);
  const sliced = all.slice(start, start + pageSize);

  const items = [];
  for (const t of sliced) {
    const root = dynamicState.commentsById.get(t.rootId);
    if (!root) continue;
    const replies = Array.isArray(t.replyIds) ? t.replyIds.map((id) => dynamicState.commentsById.get(id)).filter(Boolean) : [];
    items.push({
      root: formatPublicComment(root),
      replies: replies.map((r) => formatPublicComment(r)).filter(Boolean),
    });
  }

  return { items, page: { page, pageSize, total: all.length } };
}

function bumpCommentCountDelta(contentType, contentId, delta) {
  const map =
    contentType === 'LISTING'
      ? dynamicState.listingStatsDeltaById
      : contentType === 'DEMAND'
        ? dynamicState.demandStatsDeltaById
        : contentType === 'ACHIEVEMENT'
          ? dynamicState.achievementStatsDeltaById
          : null;
  if (!map) return;

  const existing = map.get(contentId) || { viewCountDelta: 0, favoriteCountDelta: 0, consultCountDelta: 0, commentCountDelta: 0 };
  map.set(contentId, { ...existing, commentCountDelta: Number(existing.commentCountDelta || 0) + Number(delta || 0) });
}

function createCommentForContent({ contentType, contentId, requestBody }) {
  const text = String(requestBody?.text || '').trim();
  if (!text) return { status: 400, body: { code: 'BAD_REQUEST', message: 'text is required' } };
  if (text.length > 1000) return { status: 400, body: { code: 'BAD_REQUEST', message: 'text too long' } };

  ensureCommentThreadsSeeded(contentType, contentId);
  const key = commentContentKey(contentType, contentId);
  const threads = dynamicState.commentThreadsByContentKey.get(key) || [];

  const parentCommentId = requestBody?.parentCommentId ? String(requestBody.parentCommentId) : null;
  let rootId = null;
  if (parentCommentId) {
    const parent = dynamicState.commentsById.get(parentCommentId);
    if (!parent) return { status: 404, body: { code: 'NOT_FOUND', message: 'parent comment not found' } };
    if (parent.contentType !== contentType || parent.contentId !== contentId) {
      return { status: 400, body: { code: 'BAD_REQUEST', message: 'parent comment mismatch' } };
    }
    rootId = findRootCommentId(parentCommentId) || parentCommentId;
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  const comment = {
    id,
    contentType,
    contentId,
    parentCommentId: parentCommentId || null,
    status: 'VISIBLE',
    user: getUserBriefForCurrentUser(),
    text,
    createdAt: now,
    updatedAt: null,
  };

  dynamicState.commentsById.set(id, comment);

  if (!parentCommentId) {
    threads.unshift({ rootId: id, replyIds: [] });
  } else {
    const t = threads.find((it) => it?.rootId === rootId);
    if (t) {
      t.replyIds.push(id);
    } else {
      threads.unshift({ rootId, replyIds: [id] });
    }
  }

  dynamicState.commentThreadsByContentKey.set(key, threads);
  bumpCommentCountDelta(contentType, contentId, 1);

  return { status: 201, body: comment };
}

function updateCommentForCurrentUser({ commentId, requestBody }) {
  const text = String(requestBody?.text || '').trim();
  if (!text) return { status: 400, body: { code: 'BAD_REQUEST', message: 'text is required' } };
  if (text.length > 1000) return { status: 400, body: { code: 'BAD_REQUEST', message: 'text too long' } };

  const existing = dynamicState.commentsById.get(commentId);
  if (!existing) return { status: 404, body: { code: 'NOT_FOUND', message: 'comment not found' } };

  const meId = seedUserIdFromFixtures();
  if (existing?.user?.id !== meId) return { status: 403, body: { code: 'FORBIDDEN', message: 'not allowed' } };
  if (existing.status !== 'VISIBLE') return { status: 409, body: { code: 'CONFLICT', message: 'comment not editable' } };

  const updated = { ...existing, text, updatedAt: new Date().toISOString() };
  dynamicState.commentsById.set(commentId, updated);
  return { status: 200, body: updated };
}

function deleteCommentForCurrentUser({ commentId }) {
  const existing = dynamicState.commentsById.get(commentId);
  if (!existing) return { status: 404, body: { code: 'NOT_FOUND', message: 'comment not found' } };

  const meId = seedUserIdFromFixtures();
  if (existing?.user?.id !== meId) return { status: 403, body: { code: 'FORBIDDEN', message: 'not allowed' } };

  if (existing.status === 'DELETED') return { status: 204 };

  const updated = { ...existing, status: 'DELETED', updatedAt: new Date().toISOString() };
  dynamicState.commentsById.set(commentId, updated);
  return { status: 204 };
}

function getDefaultContentId(contentType) {
  const pathname =
    contentType === 'LISTING'
      ? '/public/listings/:listingId'
      : contentType === 'DEMAND'
        ? '/public/demands/:demandId'
        : contentType === 'ACHIEVEMENT'
          ? '/public/achievements/:achievementId'
          : null;
  if (!pathname) return null;
  const base = pickFixtureResponse({ method: 'GET', pathname, scenario: 'happy' });
  return base?.body?.id || null;
}

function ensureDefaultCommentsSeeded() {
  if (dynamicState.commentThreadsByContentKey.size > 0) return;
  const listingId = getDefaultContentId('LISTING');
  const demandId = getDefaultContentId('DEMAND');
  const achievementId = getDefaultContentId('ACHIEVEMENT');
  if (listingId) ensureCommentThreadsSeeded('LISTING', listingId);
  if (demandId) ensureCommentThreadsSeeded('DEMAND', demandId);
  if (achievementId) ensureCommentThreadsSeeded('ACHIEVEMENT', achievementId);
}

function adminListComments({ url }) {
  ensureDefaultCommentsSeeded();
  const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
  const contentType = String(url.searchParams.get('contentType') || '').trim();
  const contentId = String(url.searchParams.get('contentId') || '').trim();
  const status = String(url.searchParams.get('status') || '').trim();
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get('pageSize') || 20)));

  let items = [...dynamicState.commentsById.values()].filter((c) => c && typeof c === 'object');
  if (contentType) items = items.filter((c) => c.contentType === contentType);
  if (contentId) items = items.filter((c) => c.contentId === contentId);
  if (status) items = items.filter((c) => c.status === status);
  if (q) {
    items = items.filter((c) => {
      const text = String(c.text || '').toLowerCase();
      const nickname = String(c.user?.nickname || '').toLowerCase();
      return text.includes(q) || nickname.includes(q);
    });
  }

  items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  const start = Math.max(0, (page - 1) * pageSize);
  const paged = items.slice(start, start + pageSize);
  return { status: 200, body: { items: paged, page: { page, pageSize, total: items.length } } };
}

function adminUpdateComment({ commentId, requestBody }) {
  ensureDefaultCommentsSeeded();

  const nextStatus = String(requestBody?.status || '').trim();
  if (!['VISIBLE', 'HIDDEN', 'DELETED'].includes(nextStatus)) {
    return { status: 400, body: { code: 'BAD_REQUEST', message: 'invalid status' } };
  }

  const existing = dynamicState.commentsById.get(commentId);
  if (!existing) return { status: 404, body: { code: 'NOT_FOUND', message: 'comment not found' } };

  const updated = { ...existing, status: nextStatus, updatedAt: new Date().toISOString() };
  dynamicState.commentsById.set(commentId, updated);
  return { status: 200, body: updated };
}

function maybeSendDynamic(req, res, { method, url, scenario, requestBody }) {
  if (scenario !== 'happy') return false;
  const pathname = url.pathname;

  if (method.toUpperCase() === 'POST' && pathname === '/files') {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const mimeType = 'application/octet-stream';
    const file = {
      id,
      url: `https://example.com/files/${id}`,
      mimeType,
      sizeBytes: 0,
      createdAt,
      fileName: 'upload',
    };
    dynamicState.filesById.set(id, file);
    sendFixture(res, { status: 201, body: file });
    return true;
  }

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

  if (method.toUpperCase() === 'POST' && pathname === '/demands') {
    const now = new Date().toISOString();
    const id = randomUUID();
    const publisher = getPublisherSummaryForCurrentUser();
    const coverFileId = requestBody?.coverFileId ?? null;
    const coverUrl = coverFileId ? dynamicState.filesById.get(coverFileId)?.url || `https://example.com/files/${coverFileId}` : '';

    const demand = {
      id,
      title: requestBody?.title || '未命名需求',
      summary: requestBody?.summary || '',
      description: requestBody?.description || '',
      keywords: Array.isArray(requestBody?.keywords) ? requestBody.keywords : [],
      deliveryPeriod: requestBody?.deliveryPeriod,
      budgetType: requestBody?.budgetType || 'NEGOTIABLE',
      budgetMinFen: requestBody?.budgetMinFen ?? null,
      budgetMaxFen: requestBody?.budgetMaxFen ?? null,
      cooperationModes: Array.isArray(requestBody?.cooperationModes) ? requestBody.cooperationModes : [],
      contactName: requestBody?.contactName,
      contactTitle: requestBody?.contactTitle,
      contactPhoneMasked: requestBody?.contactPhoneMasked,
      regionCode: requestBody?.regionCode || '',
      industryTags: Array.isArray(requestBody?.industryTags) ? requestBody.industryTags : [],
      publisherUserId: publisher.userId,
      publisher,
      stats: { viewCount: 0, favoriteCount: 0, consultCount: 0 },
      auditStatus: 'PENDING',
      status: 'DRAFT',
      coverFileId,
      coverUrl,
      media: enrichContentMedia(requestBody?.media || []),
      createdAt: now,
      updatedAt: now,
    };

    dynamicState.demandById.set(id, demand);
    sendFixture(res, { status: 201, body: demand });
    return true;
  }

  if (method.toUpperCase() === 'GET' && pathname === '/demands') {
    const userId = seedUserIdFromFixtures();
    const statusFilter = url.searchParams.get('status');
    const auditFilter = url.searchParams.get('auditStatus');
    const page = Number(url.searchParams.get('page') || 1);
    const pageSize = Number(url.searchParams.get('pageSize') || 20);

    const all = [...dynamicState.demandById.values()].filter((d) => {
      if (d?.publisherUserId && d.publisherUserId !== userId) return false;
      if (statusFilter && d?.status !== statusFilter) return false;
      if (auditFilter && d?.auditStatus !== auditFilter) return false;
      return true;
    });

    all.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));

    const start = Math.max(0, (page - 1) * pageSize);
    const paged = all.slice(start, start + pageSize);
    sendFixture(res, { status: 200, body: { items: paged, page: { page, pageSize, total: all.length } } });
    return true;
  }

  const demandMatch = pathname.match(/^\/demands\/([^/]+)$/);
  if (demandMatch && method.toUpperCase() === 'GET') {
    const demandId = demandMatch[1];
    const d = dynamicState.demandById.get(demandId);
    if (d) {
      sendFixture(res, { status: 200, body: d });
      return true;
    }
  }

  if (demandMatch && method.toUpperCase() === 'PATCH') {
    const demandId = demandMatch[1];
    const existing = dynamicState.demandById.get(demandId);
    const base = existing || {
      id: demandId,
      title: '未命名需求',
      summary: '',
      description: '',
      keywords: [],
      deliveryPeriod: undefined,
      budgetType: 'NEGOTIABLE',
      budgetMinFen: null,
      budgetMaxFen: null,
      cooperationModes: [],
      contactName: undefined,
      contactTitle: undefined,
      contactPhoneMasked: undefined,
      regionCode: '',
      industryTags: [],
      publisherUserId: seedUserIdFromFixtures(),
      publisher: getPublisherSummaryForCurrentUser(),
      stats: { viewCount: 0, favoriteCount: 0, consultCount: 0 },
      auditStatus: 'PENDING',
      status: 'DRAFT',
      coverFileId: null,
      coverUrl: '',
      media: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const coverFileId = Object.prototype.hasOwnProperty.call(requestBody || {}, 'coverFileId') ? requestBody.coverFileId : base.coverFileId;
    const coverUrl = coverFileId ? dynamicState.filesById.get(coverFileId)?.url || `https://example.com/files/${coverFileId}` : base.coverUrl || '';

    const updated = {
      ...base,
      ...(requestBody || {}),
      coverFileId: coverFileId ?? null,
      coverUrl,
      media: Array.isArray(requestBody?.media) ? enrichContentMedia(requestBody.media) : base.media,
      updatedAt: new Date().toISOString(),
    };
    dynamicState.demandById.set(demandId, updated);
    sendFixture(res, { status: 200, body: updated });
    return true;
  }

  const demandSubmitMatch = pathname.match(/^\/demands\/([^/]+)\/submit$/);
  if (method.toUpperCase() === 'POST' && demandSubmitMatch) {
    const demandId = demandSubmitMatch[1];
    const d = dynamicState.demandById.get(demandId);
    if (!d) return false;
    const updated = { ...d, auditStatus: 'PENDING', status: d.status || 'DRAFT', updatedAt: new Date().toISOString() };
    dynamicState.demandById.set(demandId, updated);
    sendFixture(res, { status: 200, body: updated });
    return true;
  }

  const demandOffShelfMatch = pathname.match(/^\/demands\/([^/]+)\/off-shelf$/);
  if (method.toUpperCase() === 'POST' && demandOffShelfMatch) {
    const demandId = demandOffShelfMatch[1];
    const d = dynamicState.demandById.get(demandId);
    if (!d) return false;
    const updated = { ...d, auditStatus: 'APPROVED', status: 'OFF_SHELF', updatedAt: new Date().toISOString() };
    dynamicState.demandById.set(demandId, updated);
    sendFixture(res, { status: 200, body: updated });
    return true;
  }

  if (method.toUpperCase() === 'POST' && pathname === '/achievements') {
    const now = new Date().toISOString();
    const id = randomUUID();
    const publisher = getPublisherSummaryForCurrentUser();
    const coverFileId = requestBody?.coverFileId ?? null;
    const coverUrl = coverFileId ? dynamicState.filesById.get(coverFileId)?.url || `https://example.com/files/${coverFileId}` : '';

    const achievement = {
      id,
      title: requestBody?.title || '未命名成果',
      summary: requestBody?.summary || '',
      description: requestBody?.description || '',
      keywords: Array.isArray(requestBody?.keywords) ? requestBody.keywords : [],
      maturity: requestBody?.maturity || 'OTHER',
      cooperationModes: Array.isArray(requestBody?.cooperationModes) ? requestBody.cooperationModes : [],
      regionCode: requestBody?.regionCode || '',
      industryTags: Array.isArray(requestBody?.industryTags) ? requestBody.industryTags : [],
      publisherUserId: publisher.userId,
      publisher,
      stats: { viewCount: 0, favoriteCount: 0, consultCount: 0 },
      auditStatus: 'PENDING',
      status: 'DRAFT',
      coverFileId,
      coverUrl,
      media: enrichContentMedia(requestBody?.media || []),
      createdAt: now,
      updatedAt: now,
    };

    dynamicState.achievementById.set(id, achievement);
    sendFixture(res, { status: 201, body: achievement });
    return true;
  }

  if (method.toUpperCase() === 'GET' && pathname === '/achievements') {
    const userId = seedUserIdFromFixtures();
    const statusFilter = url.searchParams.get('status');
    const auditFilter = url.searchParams.get('auditStatus');
    const page = Number(url.searchParams.get('page') || 1);
    const pageSize = Number(url.searchParams.get('pageSize') || 20);

    const all = [...dynamicState.achievementById.values()].filter((a) => {
      if (a?.publisherUserId && a.publisherUserId !== userId) return false;
      if (statusFilter && a?.status !== statusFilter) return false;
      if (auditFilter && a?.auditStatus !== auditFilter) return false;
      return true;
    });

    all.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));

    const start = Math.max(0, (page - 1) * pageSize);
    const paged = all.slice(start, start + pageSize);
    sendFixture(res, { status: 200, body: { items: paged, page: { page, pageSize, total: all.length } } });
    return true;
  }

  const achievementMatch = pathname.match(/^\/achievements\/([^/]+)$/);
  if (achievementMatch && method.toUpperCase() === 'GET') {
    const achievementId = achievementMatch[1];
    const a = dynamicState.achievementById.get(achievementId);
    if (a) {
      sendFixture(res, { status: 200, body: a });
      return true;
    }
  }

  if (achievementMatch && method.toUpperCase() === 'PATCH') {
    const achievementId = achievementMatch[1];
    const existing = dynamicState.achievementById.get(achievementId);
    const base = existing || {
      id: achievementId,
      title: '未命名成果',
      summary: '',
      description: '',
      keywords: [],
      maturity: 'OTHER',
      cooperationModes: [],
      regionCode: '',
      industryTags: [],
      publisherUserId: seedUserIdFromFixtures(),
      publisher: getPublisherSummaryForCurrentUser(),
      stats: { viewCount: 0, favoriteCount: 0, consultCount: 0 },
      auditStatus: 'PENDING',
      status: 'DRAFT',
      coverFileId: null,
      coverUrl: '',
      media: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const coverFileId = Object.prototype.hasOwnProperty.call(requestBody || {}, 'coverFileId') ? requestBody.coverFileId : base.coverFileId;
    const coverUrl = coverFileId ? dynamicState.filesById.get(coverFileId)?.url || `https://example.com/files/${coverFileId}` : base.coverUrl || '';

    const updated = {
      ...base,
      ...(requestBody || {}),
      coverFileId: coverFileId ?? null,
      coverUrl,
      media: Array.isArray(requestBody?.media) ? enrichContentMedia(requestBody.media) : base.media,
      updatedAt: new Date().toISOString(),
    };
    dynamicState.achievementById.set(achievementId, updated);
    sendFixture(res, { status: 200, body: updated });
    return true;
  }

  const achievementSubmitMatch = pathname.match(/^\/achievements\/([^/]+)\/submit$/);
  if (method.toUpperCase() === 'POST' && achievementSubmitMatch) {
    const achievementId = achievementSubmitMatch[1];
    const a = dynamicState.achievementById.get(achievementId);
    if (!a) return false;
    const updated = { ...a, auditStatus: 'PENDING', status: a.status || 'DRAFT', updatedAt: new Date().toISOString() };
    dynamicState.achievementById.set(achievementId, updated);
    sendFixture(res, { status: 200, body: updated });
    return true;
  }

  const achievementOffShelfMatch = pathname.match(/^\/achievements\/([^/]+)\/off-shelf$/);
  if (method.toUpperCase() === 'POST' && achievementOffShelfMatch) {
    const achievementId = achievementOffShelfMatch[1];
    const a = dynamicState.achievementById.get(achievementId);
    if (!a) return false;
    const updated = { ...a, auditStatus: 'APPROVED', status: 'OFF_SHELF', updatedAt: new Date().toISOString() };
    dynamicState.achievementById.set(achievementId, updated);
    sendFixture(res, { status: 200, body: updated });
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

  if (method.toUpperCase() === 'GET' && pathname === '/me/favorites/demands') {
    const page = Number(url.searchParams.get('page') || 1);
    const pageSize = Number(url.searchParams.get('pageSize') || 10);
    const ids = [...dynamicState.favoriteDemandIds];
    const all = ids
      .map((id) => findDemandSummaryById(id))
      .filter(Boolean);

    const start = Math.max(0, (page - 1) * pageSize);
    const paged = all.slice(start, start + pageSize);
    sendFixture(res, { status: 200, body: { items: paged, page: { page, pageSize, total: all.length } } });
    return true;
  }

  if (method.toUpperCase() === 'GET' && pathname === '/me/favorites/achievements') {
    const page = Number(url.searchParams.get('page') || 1);
    const pageSize = Number(url.searchParams.get('pageSize') || 10);
    const ids = [...dynamicState.favoriteAchievementIds];
    const all = ids
      .map((id) => findAchievementSummaryById(id))
      .filter(Boolean);

    const start = Math.max(0, (page - 1) * pageSize);
    const paged = all.slice(start, start + pageSize);
    sendFixture(res, { status: 200, body: { items: paged, page: { page, pageSize, total: all.length } } });
    return true;
  }

  if (method.toUpperCase() === 'GET' && pathname === '/public/organizations') {
    const base = pickFixtureResponse({ method: 'GET', pathname: '/public/organizations', scenario: 'happy' });
    if (!base || base.status >= 400 || !base.body) return false;

    const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
    const regionCode = String(url.searchParams.get('regionCode') || '').trim();
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
      if (regionCode && String(it.regionCode || '') !== regionCode) continue;
      if (
        q &&
        !String(it.displayName || '').toLowerCase().includes(q) &&
        !String(it.intro || '').toLowerCase().includes(q)
      )
        continue;
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

  const publicDemandMatch = pathname.match(/^\/public\/demands\/([^/]+)$/);
  if (method.toUpperCase() === 'GET' && publicDemandMatch) {
    const demandId = publicDemandMatch[1];
    const local = dynamicState.demandById.get(demandId);
    if (local) {
      if (local.auditStatus !== 'APPROVED' || local.status !== 'ACTIVE') {
        sendFixture(res, { status: 404, body: { code: 'NOT_FOUND', message: 'Content not visible' } });
        return true;
      }
      const next = { ...local, media: enrichContentMedia(local.media) };
      next.stats = applyDemandStatsDelta(next.stats, demandId);
      sendFixture(res, { status: 200, body: next });
      return true;
    }

    const base = pickFixtureResponse({ method: 'GET', pathname, scenario: 'happy' });
    if (!base || base.status >= 400 || !base.body) return false;
    const next = { ...base.body, id: demandId };
    next.stats = applyDemandStatsDelta(next.stats, demandId);
    if (Array.isArray(next.media)) next.media = enrichContentMedia(next.media);
    sendFixture(res, { status: 200, body: next });
    return true;
  }

  const publicAchievementMatch = pathname.match(/^\/public\/achievements\/([^/]+)$/);
  if (method.toUpperCase() === 'GET' && publicAchievementMatch) {
    const achievementId = publicAchievementMatch[1];
    const local = dynamicState.achievementById.get(achievementId);
    if (local) {
      if (local.auditStatus !== 'APPROVED' || local.status !== 'ACTIVE') {
        sendFixture(res, { status: 404, body: { code: 'NOT_FOUND', message: 'Content not visible' } });
        return true;
      }
      const next = { ...local, media: enrichContentMedia(local.media) };
      next.stats = applyAchievementStatsDelta(next.stats, achievementId);
      sendFixture(res, { status: 200, body: next });
      return true;
    }

    const base = pickFixtureResponse({ method: 'GET', pathname, scenario: 'happy' });
    if (!base || base.status >= 400 || !base.body) return false;
    const next = { ...base.body, id: achievementId };
    next.stats = applyAchievementStatsDelta(next.stats, achievementId);
    if (Array.isArray(next.media)) next.media = enrichContentMedia(next.media);
    sendFixture(res, { status: 200, body: next });
    return true;
  }

  const publicListingCommentsMatch = pathname.match(/^\/public\/listings\/([^/]+)\/comments$/);
  if (method.toUpperCase() === 'GET' && publicListingCommentsMatch) {
    const listingId = publicListingCommentsMatch[1];
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get('pageSize') || 20)));
    sendFixture(res, { status: 200, body: buildPagedCommentThreads({ contentType: 'LISTING', contentId: listingId, page, pageSize }) });
    return true;
  }

  const publicDemandCommentsMatch = pathname.match(/^\/public\/demands\/([^/]+)\/comments$/);
  if (method.toUpperCase() === 'GET' && publicDemandCommentsMatch) {
    const demandId = publicDemandCommentsMatch[1];
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get('pageSize') || 20)));
    sendFixture(res, { status: 200, body: buildPagedCommentThreads({ contentType: 'DEMAND', contentId: demandId, page, pageSize }) });
    return true;
  }

  const publicAchievementCommentsMatch = pathname.match(/^\/public\/achievements\/([^/]+)\/comments$/);
  if (method.toUpperCase() === 'GET' && publicAchievementCommentsMatch) {
    const achievementId = publicAchievementCommentsMatch[1];
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get('pageSize') || 20)));
    sendFixture(res, { status: 200, body: buildPagedCommentThreads({ contentType: 'ACHIEVEMENT', contentId: achievementId, page, pageSize }) });
    return true;
  }

  const listingCommentCreateMatch = pathname.match(/^\/listings\/([^/]+)\/comments$/);
  if (method.toUpperCase() === 'POST' && listingCommentCreateMatch) {
    const listingId = listingCommentCreateMatch[1];
    const result = createCommentForContent({ contentType: 'LISTING', contentId: listingId, requestBody });
    sendFixture(res, { status: result.status, body: result.body });
    return true;
  }

  const demandCommentCreateMatch = pathname.match(/^\/demands\/([^/]+)\/comments$/);
  if (method.toUpperCase() === 'POST' && demandCommentCreateMatch) {
    const demandId = demandCommentCreateMatch[1];
    const result = createCommentForContent({ contentType: 'DEMAND', contentId: demandId, requestBody });
    sendFixture(res, { status: result.status, body: result.body });
    return true;
  }

  const achievementCommentCreateMatch = pathname.match(/^\/achievements\/([^/]+)\/comments$/);
  if (method.toUpperCase() === 'POST' && achievementCommentCreateMatch) {
    const achievementId = achievementCommentCreateMatch[1];
    const result = createCommentForContent({ contentType: 'ACHIEVEMENT', contentId: achievementId, requestBody });
    sendFixture(res, { status: result.status, body: result.body });
    return true;
  }

  const commentUpdateMatch = pathname.match(/^\/comments\/([^/]+)$/);
  if (method.toUpperCase() === 'PATCH' && commentUpdateMatch) {
    const commentId = commentUpdateMatch[1];
    const result = updateCommentForCurrentUser({ commentId, requestBody });
    sendFixture(res, { status: result.status, body: result.body });
    return true;
  }

  if (method.toUpperCase() === 'DELETE' && commentUpdateMatch) {
    const commentId = commentUpdateMatch[1];
    const result = deleteCommentForCurrentUser({ commentId });
    sendFixture(res, { status: result.status, body: result.body });
    return true;
  }

  if (method.toUpperCase() === 'GET' && pathname === '/admin/comments') {
    const result = adminListComments({ url });
    sendFixture(res, { status: result.status, body: result.body });
    return true;
  }

  const adminCommentUpdateMatch = pathname.match(/^\/admin\/comments\/([^/]+)$/);
  if (method.toUpperCase() === 'PATCH' && adminCommentUpdateMatch) {
    const commentId = adminCommentUpdateMatch[1];
    const result = adminUpdateComment({ commentId, requestBody });
    sendFixture(res, { status: result.status, body: result.body });
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
      dynamicState.conversationSummaryById.size > 0 ||
      dynamicState.conversationPatchById.size > 0 ||
      dynamicState.messagesByConversationId.size > 0;
    if (!hasConversationState) return false;

    const base = pickFixtureResponse({ method: 'GET', pathname: '/me/conversations', scenario: 'happy' });
    if (!base || base.status >= 400) return false;

    const baseItems = Array.isArray(base.body?.items) ? base.body.items : [];

    const seen = new Set();
    const items = [];

    for (const c of [...dynamicState.conversationSummaryById.values(), ...baseItems]) {
      if (!c || !c.id) continue;
      if (seen.has(c.id)) continue;
      seen.add(c.id);

      let next = { ...c };

      const patch = dynamicState.conversationPatchById.get(c.id);
      if (patch) next = { ...next, ...patch };

      const extraMessages = dynamicState.messagesByConversationId.get(c.id);
      if (extraMessages && extraMessages.length) {
        const last = extraMessages[extraMessages.length - 1];
        next = {
          ...next,
          lastMessagePreview: last?.text || last?.fileUrl || next.lastMessagePreview,
          lastMessageAt: last?.createdAt || next.lastMessageAt,
          unreadCount: 0,
        };
      }

      items.push(next);
    }

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

  if (method.toUpperCase() === 'GET' && pathname === '/search/listings') {
    const base = pickFixtureResponse({ method: 'GET', pathname: '/search/listings', scenario: 'happy' });
    if (!base || base.status >= 400) return false;

    const readNum = (name) => {
      const raw = url.searchParams.get(name);
      if (!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };

    const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
    const patentType = String(url.searchParams.get('patentType') || '').trim();
    const tradeMode = String(url.searchParams.get('tradeMode') || '').trim();
    const priceType = String(url.searchParams.get('priceType') || '').trim();
    const regionCode = String(url.searchParams.get('regionCode') || '').trim();
    const ipc = String(url.searchParams.get('ipc') || '').trim().toLowerCase().replace(/\s+/g, '');
    const loc = String(url.searchParams.get('loc') || '').trim().toLowerCase().replace(/\s+/g, '');
    const legalStatus = String(url.searchParams.get('legalStatus') || '').trim();
    const industryTags = url.searchParams.getAll('industryTags').filter(Boolean);

    const sortBy = String(url.searchParams.get('sortBy') || 'RECOMMENDED').trim();
    const priceMinFen = readNum('priceMinFen');
    const priceMaxFen = readNum('priceMaxFen');
    const depositMinFen = readNum('depositMinFen');
    const depositMaxFen = readNum('depositMaxFen');

    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get('pageSize') || 10)));
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
      all.push(patchListingSummary(it));
    }

    const filtered = all.filter((it) => {
      if (!it || !it.id) return false;
      if (q) {
        const hay = `${it.title || ''} ${it.applicationNoDisplay || ''} ${(it.inventorNames || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (patentType && String(it.patentType || '') !== patentType) return false;
      if (tradeMode && String(it.tradeMode || '') !== tradeMode) return false;
      if (priceType && String(it.priceType || '') !== priceType) return false;
      if (regionCode && String(it.regionCode || '') !== regionCode) return false;

      if (priceMinFen !== null || priceMaxFen !== null) {
        const price = it.priceAmountFen;
        if (price === undefined || price === null) return false;
        if (priceMinFen !== null && Number(price) < priceMinFen) return false;
        if (priceMaxFen !== null && Number(price) > priceMaxFen) return false;
      }

      if (depositMinFen !== null || depositMaxFen !== null) {
        const deposit = it.depositAmountFen;
        if (deposit === undefined || deposit === null) return false;
        if (depositMinFen !== null && Number(deposit) < depositMinFen) return false;
        if (depositMaxFen !== null && Number(deposit) > depositMaxFen) return false;
      }

      if (industryTags.length) {
        const tags = Array.isArray(it.industryTags) ? it.industryTags : [];
        if (!tags.length) return false;
        let ok = false;
        for (const t of industryTags) {
          if (tags.includes(t)) {
            ok = true;
            break;
          }
        }
        if (!ok) return false;
      }

      if (ipc) {
        const codes = Array.isArray(it.ipcCodes) ? it.ipcCodes : [];
        const ok = codes.some((c) => String(c || '').replace(/\s+/g, '').toLowerCase().startsWith(ipc));
        if (!ok) return false;
      }

      if (loc) {
        const codes = Array.isArray(it.locCodes) ? it.locCodes : [];
        const ok = codes.some((c) => String(c || '').replace(/\s+/g, '').toLowerCase().startsWith(loc));
        if (!ok) return false;
      }

      if (legalStatus && String(it.legalStatus || '') !== legalStatus) return false;

      return true;
    });

    const asTime = (t) => {
      const ms = Date.parse(String(t || ''));
      return Number.isFinite(ms) ? ms : 0;
    };
    const popularScore = (it) => {
      const s = it.stats || {};
      return Number(s.viewCount || 0) + Number(s.favoriteCount || 0) * 10 + Number(s.consultCount || 0) * 20;
    };
    const byCreatedDesc = (a, b) => asTime(b.createdAt) - asTime(a.createdAt);

    filtered.sort((a, b) => {
      if (sortBy === 'NEWEST') return byCreatedDesc(a, b);
      if (sortBy === 'POPULAR') return popularScore(b) - popularScore(a) || byCreatedDesc(a, b);
      if (sortBy === 'PRICE_ASC') {
        const ap = a.priceAmountFen;
        const bp = b.priceAmountFen;
        if (ap === undefined || ap === null) return 1;
        if (bp === undefined || bp === null) return -1;
        return Number(ap) - Number(bp) || byCreatedDesc(a, b);
      }
      if (sortBy === 'PRICE_DESC') {
        const ap = a.priceAmountFen;
        const bp = b.priceAmountFen;
        if (ap === undefined || ap === null) return 1;
        if (bp === undefined || bp === null) return -1;
        return Number(bp) - Number(ap) || byCreatedDesc(a, b);
      }
      if (sortBy === 'INVENTOR_RANK') {
        return Number(b.inventorRankScore || 0) - Number(a.inventorRankScore || 0) || popularScore(b) - popularScore(a) || byCreatedDesc(a, b);
      }
      // RECOMMENDED (default)
      return Number(b.recommendationScore || 0) - Number(a.recommendationScore || 0) || popularScore(b) - popularScore(a) || byCreatedDesc(a, b);
    });

    const start = Math.max(0, (page - 1) * pageSize);
    const paged = filtered.slice(start, start + pageSize);

    sendFixture(res, {
      status: 200,
      body: {
        items: paged,
        page: { page, pageSize, total: filtered.length },
      },
    });
    return true;
  }

  if (method.toUpperCase() === 'GET' && pathname === '/search/demands') {
    const base = pickFixtureResponse({ method: 'GET', pathname: '/search/demands', scenario: 'happy' });
    if (!base || base.status >= 400) return false;

    const readNum = (name) => {
      const raw = url.searchParams.get(name);
      if (!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };

    const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
    const regionCode = String(url.searchParams.get('regionCode') || '').trim();
    const budgetType = String(url.searchParams.get('budgetType') || '').trim();
    const cooperationModes = url.searchParams.getAll('cooperationModes').filter(Boolean);
    const industryTags = url.searchParams.getAll('industryTags').filter(Boolean);
    const sortBy = String(url.searchParams.get('sortBy') || 'RECOMMENDED').trim();
    const budgetMinFen = readNum('budgetMinFen');
    const budgetMaxFen = readNum('budgetMaxFen');

    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get('pageSize') || 10)));

    const baseItems = Array.isArray(base.body?.items) ? base.body.items : [];
    const extras = [];
    for (const demand of dynamicState.demandById.values()) {
      if (!demand || typeof demand !== 'object') continue;
      if (demand.auditStatus !== 'APPROVED' || demand.status !== 'ACTIVE') continue;
      const summary = toDemandSummary(demand);
      if (summary) extras.push(summary);
    }

    const seen = new Set();
    const all = [];
    for (const it of [...extras, ...baseItems]) {
      if (!it || !it.id) continue;
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      all.push(patchDemandSummary(it));
    }

    const filtered = all.filter((it) => {
      if (!it || !it.id) return false;
      if (q) {
        const hay = `${it.title || ''} ${it.summary || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (regionCode && String(it.regionCode || '') !== regionCode) return false;
      if (budgetType && String(it.budgetType || '') !== budgetType) return false;

      if (cooperationModes.length) {
        const modes = Array.isArray(it.cooperationModes) ? it.cooperationModes : [];
        if (!modes.length) return false;
        let ok = false;
        for (const m of cooperationModes) {
          if (modes.includes(m)) {
            ok = true;
            break;
          }
        }
        if (!ok) return false;
      }

      if (industryTags.length) {
        const tags = Array.isArray(it.industryTags) ? it.industryTags : [];
        if (!tags.length) return false;
        let ok = false;
        for (const t of industryTags) {
          if (tags.includes(t)) {
            ok = true;
            break;
          }
        }
        if (!ok) return false;
      }

      if (budgetMinFen !== null || budgetMaxFen !== null) {
        const min = it.budgetMinFen !== undefined && it.budgetMinFen !== null ? Number(it.budgetMinFen) : null;
        const max = it.budgetMaxFen !== undefined && it.budgetMaxFen !== null ? Number(it.budgetMaxFen) : null;
        if (min === null && max === null) return false;
        if (budgetMinFen !== null && max !== null && max < budgetMinFen) return false;
        if (budgetMaxFen !== null && min !== null && min > budgetMaxFen) return false;
      }

      return true;
    });

    const asTime = (t) => {
      const ms = Date.parse(String(t || ''));
      return Number.isFinite(ms) ? ms : 0;
    };
    const popularScore = (it) => {
      const s = it.stats || {};
      return Number(s.viewCount || 0) + Number(s.favoriteCount || 0) * 10 + Number(s.consultCount || 0) * 20;
    };
    const byCreatedDesc = (a, b) => asTime(b.createdAt) - asTime(a.createdAt);

    filtered.sort((a, b) => {
      if (sortBy === 'NEWEST') return byCreatedDesc(a, b);
      if (sortBy === 'POPULAR') return popularScore(b) - popularScore(a) || byCreatedDesc(a, b);
      // RECOMMENDED (default)
      return popularScore(b) - popularScore(a) || byCreatedDesc(a, b);
    });

    const start = Math.max(0, (page - 1) * pageSize);
    const paged = filtered.slice(start, start + pageSize);

    sendFixture(res, {
      status: 200,
      body: {
        items: paged,
        page: { page, pageSize, total: filtered.length },
      },
    });
    return true;
  }

  if (method.toUpperCase() === 'GET' && pathname === '/search/achievements') {
    const base = pickFixtureResponse({ method: 'GET', pathname: '/search/achievements', scenario: 'happy' });
    if (!base || base.status >= 400) return false;

    const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
    const regionCode = String(url.searchParams.get('regionCode') || '').trim();
    const maturity = String(url.searchParams.get('maturity') || '').trim();
    const cooperationModes = url.searchParams.getAll('cooperationModes').filter(Boolean);
    const industryTags = url.searchParams.getAll('industryTags').filter(Boolean);
    const sortBy = String(url.searchParams.get('sortBy') || 'RECOMMENDED').trim();

    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get('pageSize') || 10)));

    const baseItems = Array.isArray(base.body?.items) ? base.body.items : [];
    const extras = [];
    for (const achievement of dynamicState.achievementById.values()) {
      if (!achievement || typeof achievement !== 'object') continue;
      if (achievement.auditStatus !== 'APPROVED' || achievement.status !== 'ACTIVE') continue;
      const summary = toAchievementSummary(achievement);
      if (summary) extras.push(summary);
    }

    const seen = new Set();
    const all = [];
    for (const it of [...extras, ...baseItems]) {
      if (!it || !it.id) continue;
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      all.push(patchAchievementSummary(it));
    }

    const filtered = all.filter((it) => {
      if (!it || !it.id) return false;
      if (q) {
        const hay = `${it.title || ''} ${it.summary || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (regionCode && String(it.regionCode || '') !== regionCode) return false;
      if (maturity && String(it.maturity || '') !== maturity) return false;

      if (cooperationModes.length) {
        const modes = Array.isArray(it.cooperationModes) ? it.cooperationModes : [];
        if (!modes.length) return false;
        let ok = false;
        for (const m of cooperationModes) {
          if (modes.includes(m)) {
            ok = true;
            break;
          }
        }
        if (!ok) return false;
      }

      if (industryTags.length) {
        const tags = Array.isArray(it.industryTags) ? it.industryTags : [];
        if (!tags.length) return false;
        let ok = false;
        for (const t of industryTags) {
          if (tags.includes(t)) {
            ok = true;
            break;
          }
        }
        if (!ok) return false;
      }

      return true;
    });

    const asTime = (t) => {
      const ms = Date.parse(String(t || ''));
      return Number.isFinite(ms) ? ms : 0;
    };
    const popularScore = (it) => {
      const s = it.stats || {};
      return Number(s.viewCount || 0) + Number(s.favoriteCount || 0) * 10 + Number(s.consultCount || 0) * 20;
    };
    const byCreatedDesc = (a, b) => asTime(b.createdAt) - asTime(a.createdAt);

    filtered.sort((a, b) => {
      if (sortBy === 'NEWEST') return byCreatedDesc(a, b);
      if (sortBy === 'POPULAR') return popularScore(b) - popularScore(a) || byCreatedDesc(a, b);
      return popularScore(b) - popularScore(a) || byCreatedDesc(a, b);
    });

    const start = Math.max(0, (page - 1) * pageSize);
    const paged = filtered.slice(start, start + pageSize);

    sendFixture(res, {
      status: 200,
      body: {
        items: paged,
        page: { page, pageSize, total: filtered.length },
      },
    });
    return true;
  }

  if (method.toUpperCase() === 'GET' && pathname === '/search/inventors') {
    const base = pickFixtureResponse({ method: 'GET', pathname: '/search/inventors', scenario: 'happy' });
    if (!base || base.status >= 400) return false;

    const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
    const regionCode = String(url.searchParams.get('regionCode') || '').trim();
    const patentType = String(url.searchParams.get('patentType') || '').trim();
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get('pageSize') || 10)));

    const regionBuckets = ['110000', '310000', '440000', '320000', '330000'];
    const patentBuckets = ['INVENTION', 'UTILITY_MODEL', 'DESIGN'];
    const hashStr = (s) => {
      let h = 0;
      const str = String(s || '');
      for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
      return h;
    };
    const derivedRegion = (name) => regionBuckets[hashStr(name) % regionBuckets.length];
    const derivedPatentType = (name) => patentBuckets[hashStr(name) % patentBuckets.length];

    const baseItems = Array.isArray(base.body?.items) ? base.body.items : [];
    const all = baseItems.filter((it) => it && typeof it === 'object' && it.inventorName);

    const filtered = all.filter((it) => {
      const name = String(it.inventorName || '');
      if (q && !name.toLowerCase().includes(q)) return false;
      if (regionCode && derivedRegion(name) !== regionCode) return false;
      if (patentType && derivedPatentType(name) !== patentType) return false;
      return true;
    });

    const start = Math.max(0, (page - 1) * pageSize);
    const paged = filtered.slice(start, start + pageSize);

    sendFixture(res, {
      status: 200,
      body: {
        items: paged,
        page: { page, pageSize, total: filtered.length },
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

  if (method.toUpperCase() === 'GET' && pathname === '/admin/listings') {
    const base = pickFixtureResponse({ method: 'GET', pathname: '/admin/listings', scenario: 'happy' });
    if (!base || base.status >= 400) return false;

    const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
    const regionCode = String(url.searchParams.get('regionCode') || '').trim();
    const statusFilter = String(url.searchParams.get('status') || '').trim();
    const auditFilter = String(url.searchParams.get('auditStatus') || '').trim();
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get('pageSize') || 20)));

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

    const filtered = all.filter((it) => {
      if (!it || !it.id) return false;
      if (auditFilter && String(it.auditStatus || '') !== auditFilter) return false;
      if (statusFilter && String(it.status || '') !== statusFilter) return false;
      if (regionCode && String(it.regionCode || '') !== regionCode) return false;
      if (q) {
        const hay = `${it.title || ''} ${it.applicationNoDisplay || ''} ${(it.inventorNames || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    const start = Math.max(0, (page - 1) * pageSize);
    const paged = filtered.slice(start, start + pageSize);

    sendFixture(res, {
      status: 200,
      body: {
        items: paged,
        page: { page, pageSize, total: filtered.length },
      },
    });
    return true;
  }

  if (method.toUpperCase() === 'GET' && pathname === '/admin/demands') {
    const base = pickFixtureResponse({ method: 'GET', pathname: '/admin/demands', scenario });
    if (!base || base.status >= 400) return false;

    const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
    const regionCode = String(url.searchParams.get('regionCode') || '').trim();
    const statusFilter = url.searchParams.get('status');
    const auditFilter = url.searchParams.get('auditStatus');
    const page = Math.max(1, Number(url.searchParams.get('page') || 1) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get('pageSize') || 20) || 20));

    const baseItems = Array.isArray(base.body?.items) ? base.body.items : [];
    const extras = [...dynamicState.demandById.values()];

    const seen = new Set();
    const all = [];
    for (const it of [...extras, ...baseItems]) {
      if (!it || !it.id) continue;
      if (seen.has(it.id)) continue;
      if (statusFilter && it.status !== statusFilter) continue;
      if (auditFilter && it.auditStatus !== auditFilter) continue;
      if (regionCode && String(it.regionCode || '') !== regionCode) continue;
      if (q) {
        const hay = `${it.title || ''} ${it.summary || ''}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      seen.add(it.id);
      all.push(it);
    }

    all.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));

    const start = Math.max(0, (page - 1) * pageSize);
    const paged = all.slice(start, start + pageSize);

    sendFixture(res, {
      status: 200,
      body: {
        items: paged,
        page: { page, pageSize, total: all.length },
      },
    });
    return true;
  }

  const adminDemandApproveMatch = pathname.match(/^\/admin\/demands\/([^/]+)\/approve$/);
  if (method.toUpperCase() === 'POST' && adminDemandApproveMatch) {
    const demandId = adminDemandApproveMatch[1];
    const now = new Date().toISOString();
    const existing = dynamicState.demandById.get(demandId);
    const summary = existing ? null : findDemandSummaryById(demandId);
    const publisher = existing?.publisher || summary?.publisher || getPublisherSummaryForCurrentUser();

    const base = existing || {
      id: demandId,
      title: summary?.title || '未命名需求',
      summary: summary?.summary || '',
      description: '',
      keywords: summary?.keywords || [],
      deliveryPeriod: summary?.deliveryPeriod,
      budgetType: summary?.budgetType || 'NEGOTIABLE',
      budgetMinFen: summary?.budgetMinFen ?? null,
      budgetMaxFen: summary?.budgetMaxFen ?? null,
      cooperationModes: summary?.cooperationModes || [],
      contactName: summary?.contactName,
      contactTitle: summary?.contactTitle,
      contactPhoneMasked: summary?.contactPhoneMasked,
      regionCode: summary?.regionCode || '',
      industryTags: summary?.industryTags || [],
      publisherUserId: publisher.userId,
      publisher,
      stats: summary?.stats || { viewCount: 0, favoriteCount: 0, consultCount: 0 },
      auditStatus: 'PENDING',
      status: 'DRAFT',
      coverFileId: null,
      coverUrl: summary?.coverUrl || '',
      media: [],
      createdAt: summary?.createdAt || now,
      updatedAt: now,
    };

    const updated = { ...base, auditStatus: 'APPROVED', status: 'ACTIVE', updatedAt: now };
    dynamicState.demandById.set(demandId, updated);
    sendFixture(res, { status: 200, body: updated });
    return true;
  }

  const adminDemandRejectMatch = pathname.match(/^\/admin\/demands\/([^/]+)\/reject$/);
  if (method.toUpperCase() === 'POST' && adminDemandRejectMatch) {
    const demandId = adminDemandRejectMatch[1];
    const now = new Date().toISOString();
    const existing = dynamicState.demandById.get(demandId);
    const summary = existing ? null : findDemandSummaryById(demandId);
    const publisher = existing?.publisher || summary?.publisher || getPublisherSummaryForCurrentUser();

    const base = existing || {
      id: demandId,
      title: summary?.title || '未命名需求',
      summary: summary?.summary || '',
      description: '',
      keywords: summary?.keywords || [],
      deliveryPeriod: summary?.deliveryPeriod,
      budgetType: summary?.budgetType || 'NEGOTIABLE',
      budgetMinFen: summary?.budgetMinFen ?? null,
      budgetMaxFen: summary?.budgetMaxFen ?? null,
      cooperationModes: summary?.cooperationModes || [],
      contactName: summary?.contactName,
      contactTitle: summary?.contactTitle,
      contactPhoneMasked: summary?.contactPhoneMasked,
      regionCode: summary?.regionCode || '',
      industryTags: summary?.industryTags || [],
      publisherUserId: publisher.userId,
      publisher,
      stats: summary?.stats || { viewCount: 0, favoriteCount: 0, consultCount: 0 },
      auditStatus: 'PENDING',
      status: 'DRAFT',
      coverFileId: null,
      coverUrl: summary?.coverUrl || '',
      media: [],
      createdAt: summary?.createdAt || now,
      updatedAt: now,
    };

    const updated = { ...base, auditStatus: 'REJECTED', status: 'DRAFT', updatedAt: now };
    dynamicState.demandById.set(demandId, updated);
    sendFixture(res, { status: 200, body: updated });
    return true;
  }

  if (method.toUpperCase() === 'GET' && pathname === '/admin/achievements' && dynamicState.achievementById.size) {
    const base = pickFixtureResponse({ method: 'GET', pathname: '/admin/achievements', scenario: 'happy' });
    if (!base || base.status >= 400) return false;

    const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
    const regionCode = String(url.searchParams.get('regionCode') || '').trim();
    const statusFilter = url.searchParams.get('status');
    const auditFilter = url.searchParams.get('auditStatus');
    const page = Number(url.searchParams.get('page') || 1);
    const pageSize = Number(url.searchParams.get('pageSize') || 20);

    const baseItems = Array.isArray(base.body?.items) ? base.body.items : [];
    const extras = [...dynamicState.achievementById.values()];

    const seen = new Set();
    const all = [];
    for (const it of [...extras, ...baseItems]) {
      if (!it || !it.id) continue;
      if (seen.has(it.id)) continue;
      if (statusFilter && it.status !== statusFilter) continue;
      if (auditFilter && it.auditStatus !== auditFilter) continue;
      if (regionCode && String(it.regionCode || '') !== regionCode) continue;
      if (q) {
        const hay = `${it.title || ''} ${it.summary || ''}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      seen.add(it.id);
      all.push(it);
    }

    all.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));

    const start = Math.max(0, (page - 1) * pageSize);
    const paged = all.slice(start, start + pageSize);

    sendFixture(res, {
      status: 200,
      body: {
        items: paged,
        page: { page, pageSize, total: all.length },
      },
    });
    return true;
  }

  const adminAchievementApproveMatch = pathname.match(/^\/admin\/achievements\/([^/]+)\/approve$/);
  if (method.toUpperCase() === 'POST' && adminAchievementApproveMatch) {
    const achievementId = adminAchievementApproveMatch[1];
    const now = new Date().toISOString();
    const existing = dynamicState.achievementById.get(achievementId);
    const summary = existing ? null : findAchievementSummaryById(achievementId);
    const publisher = existing?.publisher || summary?.publisher || getPublisherSummaryForCurrentUser();

    const base = existing || {
      id: achievementId,
      title: summary?.title || '未命名成果',
      summary: summary?.summary || '',
      description: '',
      keywords: summary?.keywords || [],
      maturity: summary?.maturity || 'OTHER',
      cooperationModes: summary?.cooperationModes || [],
      regionCode: summary?.regionCode || '',
      industryTags: summary?.industryTags || [],
      publisherUserId: publisher.userId,
      publisher,
      stats: summary?.stats || { viewCount: 0, favoriteCount: 0, consultCount: 0 },
      auditStatus: 'PENDING',
      status: 'DRAFT',
      coverFileId: null,
      coverUrl: summary?.coverUrl || '',
      media: [],
      createdAt: summary?.createdAt || now,
      updatedAt: now,
    };

    const updated = { ...base, auditStatus: 'APPROVED', status: 'ACTIVE', updatedAt: now };
    dynamicState.achievementById.set(achievementId, updated);
    sendFixture(res, { status: 200, body: updated });
    return true;
  }

  const adminAchievementRejectMatch = pathname.match(/^\/admin\/achievements\/([^/]+)\/reject$/);
  if (method.toUpperCase() === 'POST' && adminAchievementRejectMatch) {
    const achievementId = adminAchievementRejectMatch[1];
    const now = new Date().toISOString();
    const existing = dynamicState.achievementById.get(achievementId);
    const summary = existing ? null : findAchievementSummaryById(achievementId);
    const publisher = existing?.publisher || summary?.publisher || getPublisherSummaryForCurrentUser();

    const base = existing || {
      id: achievementId,
      title: summary?.title || '未命名成果',
      summary: summary?.summary || '',
      description: '',
      keywords: summary?.keywords || [],
      maturity: summary?.maturity || 'OTHER',
      cooperationModes: summary?.cooperationModes || [],
      regionCode: summary?.regionCode || '',
      industryTags: summary?.industryTags || [],
      publisherUserId: publisher.userId,
      publisher,
      stats: summary?.stats || { viewCount: 0, favoriteCount: 0, consultCount: 0 },
      auditStatus: 'PENDING',
      status: 'DRAFT',
      coverFileId: null,
      coverUrl: summary?.coverUrl || '',
      media: [],
      createdAt: summary?.createdAt || now,
      updatedAt: now,
    };

    const updated = { ...base, auditStatus: 'REJECTED', status: 'DRAFT', updatedAt: now };
    dynamicState.achievementById.set(achievementId, updated);
    sendFixture(res, { status: 200, body: updated });
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

  const listingConvMatch = pathname.match(/^\/listings\/([^/]+)\/conversations$/);
  if (method.toUpperCase() === 'POST' && listingConvMatch) {
    const listingId = listingConvMatch[1];
    const conv = fixture?.body;
    if (conv && typeof conv === 'object' && conv.id) {
      const meId = seedUserIdFromFixtures();
      const buyerUserId = conv.buyerUserId;
      const sellerUserId = conv.sellerUserId;
      const counterpartId = buyerUserId && buyerUserId !== meId ? buyerUserId : sellerUserId;
      dynamicState.conversationSummaryById.set(conv.id, {
        id: conv.id,
        contentType: conv.contentType || 'LISTING',
        contentId: conv.contentId || conv.listingId || listingId,
        contentTitle: conv.contentTitle || conv.listingTitle || '专利咨询',
        listingId: conv.listingId || listingId,
        listingTitle: conv.listingTitle,
        lastMessageAt: conv.lastMessageAt || new Date().toISOString(),
        unreadCount: 0,
        counterpart: {
          id: counterpartId || sellerUserId || buyerUserId || seedUserIdFromFixtures(),
          nickname: '对方',
          avatarUrl: '',
        },
      });
    }
    return;
  }

  const demandFavoritesMatch = pathname.match(/^\/demands\/([^/]+)\/favorites$/);
  if (demandFavoritesMatch) {
    const demandId = demandFavoritesMatch[1];
    const existing = dynamicState.demandStatsDeltaById.get(demandId) || {
      viewCountDelta: 0,
      favoriteCountDelta: 0,
      consultCountDelta: 0,
    };

    if (method.toUpperCase() === 'POST') {
      dynamicState.favoriteDemandIds.add(demandId);
      dynamicState.demandStatsDeltaById.set(demandId, { ...existing, favoriteCountDelta: existing.favoriteCountDelta + 1 });
      return;
    }
    if (method.toUpperCase() === 'DELETE') {
      dynamicState.favoriteDemandIds.delete(demandId);
      dynamicState.demandStatsDeltaById.set(demandId, { ...existing, favoriteCountDelta: existing.favoriteCountDelta - 1 });
      return;
    }
  }

  const achievementFavoritesMatch = pathname.match(/^\/achievements\/([^/]+)\/favorites$/);
  if (achievementFavoritesMatch) {
    const achievementId = achievementFavoritesMatch[1];
    const existing = dynamicState.achievementStatsDeltaById.get(achievementId) || {
      viewCountDelta: 0,
      favoriteCountDelta: 0,
      consultCountDelta: 0,
    };

    if (method.toUpperCase() === 'POST') {
      dynamicState.favoriteAchievementIds.add(achievementId);
      dynamicState.achievementStatsDeltaById.set(achievementId, { ...existing, favoriteCountDelta: existing.favoriteCountDelta + 1 });
      return;
    }
    if (method.toUpperCase() === 'DELETE') {
      dynamicState.favoriteAchievementIds.delete(achievementId);
      dynamicState.achievementStatsDeltaById.set(achievementId, { ...existing, favoriteCountDelta: existing.favoriteCountDelta - 1 });
      return;
    }
  }

  const demandConvMatch = pathname.match(/^\/demands\/([^/]+)\/conversations$/);
  if (method.toUpperCase() === 'POST' && demandConvMatch) {
    const demandId = demandConvMatch[1];
    const existing = dynamicState.demandStatsDeltaById.get(demandId) || {
      viewCountDelta: 0,
      favoriteCountDelta: 0,
      consultCountDelta: 0,
    };
    dynamicState.demandStatsDeltaById.set(demandId, { ...existing, consultCountDelta: existing.consultCountDelta + 1 });

    const conv = fixture?.body;
    if (conv && typeof conv === 'object' && conv.id) {
      const summary = findDemandSummaryById(conv.contentId || demandId);
      const publisher = summary?.publisher;
      dynamicState.conversationSummaryById.set(conv.id, {
        id: conv.id,
        contentType: conv.contentType || 'DEMAND',
        contentId: conv.contentId || demandId,
        contentTitle: conv.contentTitle || summary?.title || '需求咨询',
        lastMessageAt: conv.lastMessageAt || new Date().toISOString(),
        unreadCount: 0,
        counterpart: {
          id: publisher?.userId || conv.sellerUserId || seedUserIdFromFixtures(),
          nickname: publisher?.displayName || '对方',
          avatarUrl: publisher?.logoUrl || '',
        },
      });
    }
    return;
  }

  const achievementConvMatch = pathname.match(/^\/achievements\/([^/]+)\/conversations$/);
  if (method.toUpperCase() === 'POST' && achievementConvMatch) {
    const achievementId = achievementConvMatch[1];
    const existing = dynamicState.achievementStatsDeltaById.get(achievementId) || {
      viewCountDelta: 0,
      favoriteCountDelta: 0,
      consultCountDelta: 0,
    };
    dynamicState.achievementStatsDeltaById.set(achievementId, { ...existing, consultCountDelta: existing.consultCountDelta + 1 });

    const conv = fixture?.body;
    if (conv && typeof conv === 'object' && conv.id) {
      const summary = findAchievementSummaryById(conv.contentId || achievementId);
      const publisher = summary?.publisher;
      dynamicState.conversationSummaryById.set(conv.id, {
        id: conv.id,
        contentType: conv.contentType || 'ACHIEVEMENT',
        contentId: conv.contentId || achievementId,
        contentTitle: conv.contentTitle || summary?.title || '成果咨询',
        lastMessageAt: conv.lastMessageAt || new Date().toISOString(),
        unreadCount: 0,
        counterpart: {
          id: publisher?.userId || conv.sellerUserId || seedUserIdFromFixtures(),
          nickname: publisher?.displayName || '对方',
          avatarUrl: publisher?.logoUrl || '',
        },
      });
    }
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

    if (maybeSendDynamic(req, res, { method: req.method || 'GET', url, scenario, requestBody })) return;

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
