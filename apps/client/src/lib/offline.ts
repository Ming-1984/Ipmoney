import Taro from '@tarojs/taro';

import offlineScenario from '../mock/offline-scenario.json';
import { STORAGE_KEYS } from '../constants';

type ScenarioEntry = { status?: number; body?: any };

export type OfflineResponse = { status: number; body?: any };
type CompiledEntry = { method: string; regex: RegExp; entry: ScenarioEntry };

const OFFLINE_VERIFICATION_KEY = 'ipmoney.offline.meVerification';
const OFFLINE_ORDERS_KEY = 'ipmoney.offline.orders';
const OFFLINE_CONTRACTS_KEY = 'ipmoney.offline.contracts';
const OFFLINE_USER_ID = 'c776f954-77a5-49d9-b778-77a1120d1be9';

function safeGetStorage<T>(key: string): T | null {
  try {
    return Taro.getStorageSync(key) as T;
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, value: any) {
  try {
    Taro.setStorageSync(key, value);
  } catch {
    // ignore
  }
}

function randomId(prefix: string): string {
  // Stable-enough id for offline demo/mock usage.
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function offlineUserId(): string {
  // Try to reuse the mock user id when possible.
  const token = safeGetStorage<string>(STORAGE_KEYS.token) || '';
  if (token && typeof token === 'string' && token.length > 12) return OFFLINE_USER_ID;
  return OFFLINE_USER_ID;
}

function getOfflineVerification(): any | null {
  return safeGetStorage<any>(OFFLINE_VERIFICATION_KEY);
}

function setOfflineVerification(v: any) {
  safeSetStorage(OFFLINE_VERIFICATION_KEY, v);
}

function getOfflineOrders(): any[] | null {
  const raw = safeGetStorage<any>(OFFLINE_ORDERS_KEY);
  return Array.isArray(raw) ? raw : null;
}

function setOfflineOrders(v: any[]) {
  safeSetStorage(OFFLINE_ORDERS_KEY, v);
}

function getOfflineContracts(): Record<string, any> {
  const raw = safeGetStorage<any>(OFFLINE_CONTRACTS_KEY);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, any>;
}

function setOfflineContracts(v: Record<string, any>) {
  safeSetStorage(OFFLINE_CONTRACTS_KEY, v);
}

function seedOrdersIfNeeded(): any[] {
  const existing = getOfflineOrders();
  if (existing?.length) return existing;

  const baseListEntry = (offlineScenario as any)['GET /orders'] as ScenarioEntry | undefined;
  const baseItems = Array.isArray((baseListEntry as any)?.body?.items) ? (baseListEntry as any).body.items : [];
  const base = baseItems[0] || {
    id: 'e9032d03-9b23-40ba-84a3-ac681f21c41b',
    listingId: '7a490e63-8173-41e7-b4f0-0d0bb5ce7d20',
    patentId: '965f9831-2c44-48e8-8b7a-cd7ab40ff7ec',
    buyerUserId: OFFLINE_USER_ID,
    sellerUserId: 'c5b6438a-f3a7-4590-a484-0f2a2991c613',
    status: 'DEPOSIT_PENDING',
    depositAmountFen: 200000,
    createdAt: '2026-01-11T00:00:00Z',
    updatedAt: '2026-01-11T00:00:00Z',
  };

  // Provide representative orders for each top-level tab group and both roles.
  const mk = (args: { idSuffix: string; status: string; asRole: 'BUYER' | 'SELLER'; title: string }) => {
    const userId = OFFLINE_USER_ID;
    const other = 'c5b6438a-f3a7-4590-a484-0f2a2991c613';
    const isSeller = args.asRole === 'SELLER';
    return {
      ...base,
      id: `order-${args.idSuffix}`,
      status: args.status,
      buyerUserId: isSeller ? other : userId,
      sellerUserId: isSeller ? userId : other,
      title: args.title,
      updatedAt: new Date().toISOString(),
    };
  };

  const seeded = [
    mk({ idSuffix: 'buyer-pay', status: 'DEPOSIT_PENDING', asRole: 'BUYER', title: '水质检测装置' }),
    mk({ idSuffix: 'buyer-progress', status: 'FINAL_PAID_ESCROW', asRole: 'BUYER', title: '高效过滤系统' }),
    mk({ idSuffix: 'buyer-refund', status: 'REFUNDING', asRole: 'BUYER', title: '智能控制方法' }),
    mk({ idSuffix: 'buyer-done', status: 'COMPLETED', asRole: 'BUYER', title: '节能供电装置' }),
    mk({ idSuffix: 'seller-progress', status: 'READY_TO_SETTLE', asRole: 'SELLER', title: '图像识别算法' }),
  ];

  setOfflineOrders(seeded);
  return seeded;
}

function statusInGroup(group: string): string[] {
  const g = String(group || '').toUpperCase();
  if (g === 'PAYMENT_PENDING') return ['DEPOSIT_PENDING', 'WAIT_FINAL_PAYMENT'];
  if (g === 'IN_PROGRESS') return ['DEPOSIT_PAID', 'FINAL_PAID_ESCROW', 'READY_TO_SETTLE'];
  if (g === 'REFUND') return ['REFUNDING', 'REFUNDED'];
  if (g === 'DONE') return ['COMPLETED', 'CANCELLED'];
  return [];
}

function groupFromTab(tab: string): string | null {
  const t = String(tab || '').toLowerCase();
  if (t === 'pay') return 'PAYMENT_PENDING';
  if (t === 'progress') return 'IN_PROGRESS';
  if (t === 'refund') return 'REFUND';
  if (t === 'done') return 'DONE';
  return null;
}

function handleDynamicMock(method: string, path: string, body?: any): OfflineResponse | null {
  const m = method.toUpperCase();

  if (m === 'GET' && path === '/me/verification') {
    const v = getOfflineVerification();
    if (!v) {
      return { status: 404, body: { code: 'NOT_FOUND', message: '未提交认证' } };
    }
    return { status: 200, body: v };
  }

  if (m === 'POST' && path === '/me/verification') {
    const type = String(body?.type || '').trim();
    const displayName = String(body?.displayName || '').trim();
    if (!type) return { status: 400, body: { code: 'BAD_REQUEST', message: 'type 不能为空' } };
    if (!displayName) return { status: 400, body: { code: 'BAD_REQUEST', message: 'displayName 不能为空' } };

    const existing = getOfflineVerification();
    if (existing?.status === 'PENDING') {
      return { status: 409, body: { code: 'CONFLICT', message: '已提交认证，等待审核中' } };
    }

    const now = new Date().toISOString();
    const approved = type === 'PERSON';
    const created = {
      id: randomId('ver'),
      userId: offlineUserId(),
      type,
      status: approved ? 'APPROVED' : 'PENDING',
      displayName,
      submittedAt: now,
      ...(approved ? { reviewedAt: now } : {}),
    };

    setOfflineVerification(created);
    return { status: 201, body: created };
  }

  if (m === 'GET' && path === '/orders') {
    const orders = seedOrdersIfNeeded();
    const params = (body && typeof body === 'object' ? body : {}) as Record<string, any>;
    const asRole = String(params.asRole || 'BUYER').toUpperCase();
    const status = String(params.status || '').trim().toUpperCase();
    const statusGroup = String(params.statusGroup || groupFromTab(String(params.tab || '')) || '').trim().toUpperCase();

    const uid = OFFLINE_USER_ID;
    let filtered = orders.slice();

    if (asRole === 'SELLER') filtered = filtered.filter((o) => String(o.sellerUserId) === uid);
    else filtered = filtered.filter((o) => String(o.buyerUserId) === uid);

    if (status) {
      filtered = filtered.filter((o) => String(o.status).toUpperCase() === status);
    } else if (statusGroup) {
      const allowed = new Set(statusInGroup(statusGroup));
      if (allowed.size) filtered = filtered.filter((o) => allowed.has(String(o.status).toUpperCase()));
    }

    return {
      status: 200,
      body: {
        items: filtered,
        page: { page: 1, pageSize: 20, total: filtered.length },
      },
    };
  }

  if (m === 'GET' && path.startsWith('/orders/')) {
    const parts = path.split('/').filter(Boolean);
    const orderId = parts[1] || '';
    if (!orderId || parts.length !== 2) return null;

    const orders = seedOrdersIfNeeded();
    const found = orders.find((o) => String(o.id) === orderId);
    if (!found) return { status: 404, body: { code: 'NOT_FOUND', message: '订单不存在' } };

    // Expand a minimal detail shape; extra fields are safe for the UI.
    return {
      status: 200,
      body: {
        ...found,
        title: found.title || '订单标的',
        patentType: 'UTILITY_MODEL',
        applicationNoDisplay: '202322721874.3',
        inventorNames: ['赵晓伟', '王鹤'],
      },
    };
  }

  if (m === 'GET' && path === '/contracts') {
    const params = (body && typeof body === 'object' ? body : {}) as Record<string, any>;
    const page = Math.max(1, Number(params.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(params.pageSize || 20)));
    const status = String(params.status || '').trim().toUpperCase();

    const uid = OFFLINE_USER_ID;
    const orders = seedOrdersIfNeeded();
    const state = getOfflineContracts();

    let items = orders
      .filter((o) => String(o.buyerUserId) === uid || String(o.sellerUserId) === uid)
      .map((o) => {
        const id = `contract-${o.id}`;
        const cached = state[id] || {};
        const canUpload = String(o.sellerUserId) === uid;
        return {
          id,
          orderId: o.id,
          listingTitle: o.title || '交易标的',
          counterpartName: null,
          status: cached.status || 'WAIT_UPLOAD',
          createdAt: o.createdAt || new Date().toISOString(),
          uploadedAt: cached.uploadedAt || null,
          signedAt: cached.signedAt || null,
          fileUrl: cached.fileUrl || null,
          watermarkOwner: cached.watermarkOwner || null,
          canUpload,
        };
      });

    if (status) items = items.filter((it) => String(it.status).toUpperCase() === status);

    const total = items.length;
    const slice = items.slice((page - 1) * pageSize, page * pageSize);
    return { status: 200, body: { items: slice, page: { page, pageSize, total } } };
  }

  if (m === 'POST' && path.startsWith('/contracts/') && path.endsWith('/upload')) {
    const parts = path.split('/').filter(Boolean);
    const contractId = parts[1] || '';
    if (!contractId || parts[2] !== 'upload') return null;

    const uid = OFFLINE_USER_ID;
    const orderId = String(contractId).replace(/^contract-/, '');
    const orders = seedOrdersIfNeeded();
    const order = orders.find((o) => String(o.id) === orderId);
    if (!order) return { status: 404, body: { code: 'NOT_FOUND', message: '订单不存在' } };
    if (String(order.sellerUserId) !== uid) {
      return { status: 403, body: { code: 'FORBIDDEN', message: '仅卖家可上传合同' } };
    }

    const now = new Date().toISOString();
    const contractFileId = body?.contractFileId ? String(body.contractFileId).trim() : '';
    const fileUrl = contractFileId ? `https://example.com/uploads/${encodeURIComponent(contractFileId)}.pdf` : 'https://example.com/contract.pdf';

    const state = getOfflineContracts();
    state[contractId] = {
      ...(state[contractId] || {}),
      status: 'WAIT_CONFIRM',
      uploadedAt: now,
      fileUrl,
      watermarkOwner: uid,
    };
    setOfflineContracts(state);

    return {
      status: 200,
      body: {
        id: contractId,
        orderId,
        status: 'WAIT_CONFIRM',
        uploadedAt: now,
        fileUrl,
        watermarkOwner: uid,
      },
    };
  }

  return null;
}

const compiled: CompiledEntry[] = Object.entries(offlineScenario as Record<string, ScenarioEntry>)
  .filter(([_, value]) => value && typeof value === 'object')
  .flatMap(([key, entry]) => {
    const [method, rawPath] = key.split(' ');
    if (!method || !rawPath) return [];

    const pattern = '^' + rawPath.replace(/:[^/]+/g, '[^/]+') + '$';
    return [
      {
        method: method.toUpperCase(),
        regex: new RegExp(pattern),
        entry,
      },
    ];
  });

export function getOfflineMock(method: string, path: string, body?: any): OfflineResponse | null {
  const dynamic = handleDynamicMock(method, path, body);
  if (dynamic) return JSON.parse(JSON.stringify(dynamic)) as OfflineResponse;

  const target = compiled.find((it) => it.method === method.toUpperCase() && it.regex.test(path));
  if (!target) return null;

  const status = typeof target.entry.status === 'number' ? target.entry.status : 200;
  const res: OfflineResponse = { status, body: target.entry.body };

  // return a deep copy to avoid accidental mutations
  return JSON.parse(JSON.stringify(res)) as OfflineResponse;
}
