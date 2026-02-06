import { randomUUID } from 'crypto';

type ContentStatus = 'DRAFT' | 'ACTIVE' | 'OFF_SHELF';
type AuditStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type BaseContent = {
  id: string;
  ownerId: string;
  title: string;
  summary?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  regionCode?: string | null;
  status: ContentStatus;
  auditStatus: AuditStatus;
  createdAt: string;
  updatedAt: string;
};

export type DemandContent = BaseContent & {
  budgetType?: string | null;
  budgetMinFen?: number | null;
  budgetMaxFen?: number | null;
  deliveryPeriod?: string | null;
  cooperationModes?: string[] | null;
  industryTags?: string[] | null;
  keywords?: string[] | null;
  contactName?: string | null;
  contactTitle?: string | null;
  contactPhoneMasked?: string | null;
  media?: Array<{ type: string; url?: string | null; sort?: number; fileId?: string | null }>;
};

export type AchievementContent = BaseContent & {
  maturity?: string | null;
  cooperationModes?: string[] | null;
  industryTags?: string[] | null;
  keywords?: string[] | null;
  media?: Array<{ type: string; url?: string | null; sort?: number; fileId?: string | null }>;
};

export type ArtworkContent = BaseContent & {
  creatorName?: string | null;
  category?: string | null;
  calligraphyScript?: string | null;
  paintingGenre?: string | null;
  creationDate?: string | null;
  creationYear?: string | null;
  certificateNo?: string | null;
  material?: string | null;
  size?: string | null;
  priceType?: string | null;
  priceAmountFen?: number | null;
  depositAmountFen?: number | null;
  certificateFileIds?: string[] | null;
  media?: Array<{ type: string; url?: string | null; sort?: number; fileId?: string | null }>;
};

const DEMANDS = new Map<string, DemandContent>();
const ACHIEVEMENTS = new Map<string, AchievementContent>();
const ARTWORKS = new Map<string, ArtworkContent>();

function nowIso() {
  return new Date().toISOString();
}

function baseFromInput(ownerId: string, data: any): BaseContent {
  const now = nowIso();
  return {
    id: randomUUID(),
    ownerId,
    title: String(data?.title || data?.name || '未命名'),
    summary: data?.summary ?? null,
    description: data?.description ?? data?.detail ?? null,
    coverUrl: data?.coverUrl ?? null,
    regionCode: data?.regionCode ?? null,
    status: 'DRAFT',
    auditStatus: 'PENDING',
    createdAt: now,
    updatedAt: now,
  };
}

export function listDemands() {
  return [...DEMANDS.values()];
}
export function listAchievements() {
  return [...ACHIEVEMENTS.values()];
}
export function listArtworks() {
  return [...ARTWORKS.values()];
}

export function createDemand(ownerId: string, data: any): DemandContent {
  const base = baseFromInput(ownerId, data);
  const item: DemandContent = {
    ...base,
    budgetType: data?.budgetType ?? null,
    budgetMinFen: data?.budgetMinFen ?? null,
    budgetMaxFen: data?.budgetMaxFen ?? null,
    deliveryPeriod: data?.deliveryPeriod ?? null,
    cooperationModes: data?.cooperationModes ?? null,
    industryTags: data?.industryTags ?? null,
    keywords: data?.keywords ?? null,
    contactName: data?.contactName ?? null,
    contactTitle: data?.contactTitle ?? null,
    contactPhoneMasked: data?.contactPhoneMasked ?? null,
    media: data?.media ?? null,
  };
  DEMANDS.set(item.id, item);
  return item;
}

export function updateDemand(id: string, data: any): DemandContent | null {
  const item = DEMANDS.get(id);
  if (!item) return null;
  Object.assign(item, data);
  item.updatedAt = nowIso();
  DEMANDS.set(id, item);
  return item;
}

export function createAchievement(ownerId: string, data: any): AchievementContent {
  const base = baseFromInput(ownerId, data);
  const item: AchievementContent = {
    ...base,
    maturity: data?.maturity ?? null,
    cooperationModes: data?.cooperationModes ?? null,
    industryTags: data?.industryTags ?? null,
    keywords: data?.keywords ?? null,
    media: data?.media ?? null,
  };
  ACHIEVEMENTS.set(item.id, item);
  return item;
}

export function updateAchievement(id: string, data: any): AchievementContent | null {
  const item = ACHIEVEMENTS.get(id);
  if (!item) return null;
  Object.assign(item, data);
  item.updatedAt = nowIso();
  ACHIEVEMENTS.set(id, item);
  return item;
}

export function createArtwork(ownerId: string, data: any): ArtworkContent {
  const base = baseFromInput(ownerId, data);
  const item: ArtworkContent = {
    ...base,
    creatorName: data?.creatorName ?? null,
    category: data?.category ?? null,
    calligraphyScript: data?.calligraphyScript ?? null,
    paintingGenre: data?.paintingGenre ?? null,
    creationDate: data?.creationDate ?? null,
    creationYear: data?.creationYear ?? null,
    certificateNo: data?.certificateNo ?? null,
    material: data?.material ?? null,
    size: data?.size ?? null,
    priceType: data?.priceType ?? null,
    priceAmountFen: data?.priceAmountFen ?? null,
    depositAmountFen: data?.depositAmountFen ?? null,
    certificateFileIds: data?.certificateFileIds ?? null,
    media: data?.media ?? null,
  };
  ARTWORKS.set(item.id, item);
  return item;
}

export function updateArtwork(id: string, data: any): ArtworkContent | null {
  const item = ARTWORKS.get(id);
  if (!item) return null;
  Object.assign(item, data);
  item.updatedAt = nowIso();
  ARTWORKS.set(id, item);
  return item;
}

export function getDemand(id: string) {
  return DEMANDS.get(id) || null;
}
export function getAchievement(id: string) {
  return ACHIEVEMENTS.get(id) || null;
}
export function getArtwork(id: string) {
  return ARTWORKS.get(id) || null;
}

export function seedIfEmpty() {
  if (DEMANDS.size === 0) {
    createDemand('seed', { title: '节能设备技术需求', budgetType: 'NEGOTIABLE', regionCode: '440300' });
  }
  if (ACHIEVEMENTS.size === 0) {
    createAchievement('seed', { title: '高效电池材料成果', maturity: 'PROTOTYPE', regionCode: '110000' });
  }
  if (ARTWORKS.size === 0) {
    createArtwork('seed', { title: '山水画作品', creatorName: '匿名', priceType: 'NEGOTIABLE', depositAmountFen: 200000 });
  }
}
