import type { components } from '@ipmoney/api-types';

type PatentType = components['schemas']['PatentType'];
type TradeMode = components['schemas']['TradeMode'];
type PriceType = components['schemas']['PriceType'];
type LicenseMode = components['schemas']['LicenseMode'];
type AuditStatus = components['schemas']['AuditStatus'];
type ContentStatus = components['schemas']['ContentStatus'];
type ListingStatus = components['schemas']['ListingStatus'];
type CalligraphyScript = components['schemas']['CalligraphyScript'];
type PaintingGenre = components['schemas']['PaintingGenre'];
type OrderStatus = components['schemas']['OrderStatus'];
type FeaturedLevel = components['schemas']['FeaturedLevel'];
type VerificationType = components['schemas']['VerificationType'];
type VerificationStatus = components['schemas']['VerificationStatus'];
type DeliveryPeriod = components['schemas']['DeliveryPeriod'];

export function patentTypeLabel(t?: PatentType | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!t) return empty;
  if (t === 'INVENTION') return '鍙戞槑';
  if (t === 'UTILITY_MODEL') return '瀹炵敤鏂板瀷';
  if (t === 'DESIGN') return '澶栬璁捐';
  return String(t);
}

export function tradeModeLabel(t?: TradeMode | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!t) return empty;
  return t === 'ASSIGNMENT' ? '杞' : '璁稿彲';
}

export function priceTypeLabel(t?: PriceType | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!t) return empty;
  return t === 'NEGOTIABLE' ? '闈㈣' : '涓€鍙ｄ环';
}

export function licenseModeLabel(t?: LicenseMode | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!t) return empty;
  if (t === 'EXCLUSIVE') return '鐙崰璁稿彲';
  if (t === 'SOLE') return '鎺掍粬璁稿彲';
  if (t === 'NON_EXCLUSIVE') return '鏅€氳鍙?;
  return String(t);
}

export function auditStatusLabel(status?: AuditStatus | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!status) return empty;
  if (status === 'APPROVED') return '宸查€氳繃';
  if (status === 'REJECTED') return '宸查┏鍥?;
  return '寰呭鏍?;
}

export function contentStatusLabel(status?: ContentStatus | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!status) return empty;
  if (status === 'ACTIVE') return '宸蹭笂鏋?;
  if (status === 'OFF_SHELF') return '宸蹭笅鏋?;
  return '鑽夌';
}

export function listingStatusLabel(status?: ListingStatus | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!status) return empty;
  if (status === 'ACTIVE') return '宸蹭笂鏋?;
  if (status === 'OFF_SHELF') return '宸蹭笅鏋?;
  if (status === 'SOLD') return '宸叉垚浜?;
  return '鑽夌';
}



export function calligraphyScriptLabel(t?: CalligraphyScript | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!t) return empty;
  if (t === 'KAISHU') return '妤蜂功';
  if (t === 'XINGSHU') return '琛屼功';
  if (t === 'CAOSHU') return '鑽変功';
  if (t === 'LISHU') return '闅朵功';
  if (t === 'ZHUANSHU') return '绡嗕功';
  return String(t);
}

export function paintingGenreLabel(t?: PaintingGenre | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!t) return empty;
  if (t === 'FIGURE') return '浜虹墿';
  if (t === 'LANDSCAPE') return '灞辨按';
  if (t === 'BIRD_FLOWER') return '鑺遍笩';
  if (t === 'OTHER') return '鍏朵粬';
  return String(t);
}

export function orderStatusLabel(status?: OrderStatus | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!status) return empty;
  if (status === 'DEPOSIT_PENDING') return '寰呬粯璁㈤噾';
  if (status === 'DEPOSIT_PAID') return '璁㈤噾宸蹭粯';
  if (status === 'WAIT_FINAL_PAYMENT') return '寰呬粯灏炬';
  if (status === 'FINAL_PAID_ESCROW') return '灏炬鎵樼涓?;
  if (status === 'READY_TO_SETTLE') return '寰呯粨绠?;
  if (status === 'COMPLETED') return '宸插畬鎴?;
  if (status === 'CANCELLED') return '宸插彇娑?;
  if (status === 'REFUNDING') return '閫€娆句腑';
  if (status === 'REFUNDED') return '宸查€€娆?;
  return String(status);
}

export function featuredLevelLabel(level?: FeaturedLevel | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '鏃?;
  if (!level || level === 'NONE') return empty;
  if (level === 'PROVINCE') return '鐪佺骇鐗硅壊';
  if (level === 'CITY') return '甯傜骇鐗硅壊';
  return String(level);
}

export function verificationTypeLabel(type?: VerificationType | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!type) return empty;
  if (type === 'PERSON') return '涓汉';
  if (type === 'COMPANY') return '浼佷笟';
  if (type === 'ACADEMY') return '绉戠爺闄㈡牎';
  if (type === 'GOVERNMENT') return '鏀垮簻';
  if (type === 'ASSOCIATION') return '琛屼笟鍗忎細/瀛︿細';
  if (type === 'TECH_MANAGER') return '鎶€鏈粡鐞嗕汉';
  return String(type);
}

export function verificationStatusLabel(status?: VerificationStatus | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!status) return empty;
  if (status === 'APPROVED') return '宸查€氳繃';
  if (status === 'REJECTED') return '宸查┏鍥?;
  return '寰呭鏍?;
}

export function deliveryPeriodLabel(period?: DeliveryPeriod | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!period) return empty;
  if (period === 'WITHIN_1_MONTH') return '鈮?鏈?;
  if (period === 'MONTH_1_3') return '1-3鏈?;
  if (period === 'MONTH_3_6') return '3-6鏈?;
  if (period === 'OVER_6_MONTHS') return '鈮?鏈?;
  if (period === 'OTHER') return '鍏朵粬';
  return String(period);
}

