import type { components } from '@ipmoney/api-types';

type PatentType = components['schemas']['PatentType'];
type TradeMode = components['schemas']['TradeMode'];
type PriceType = components['schemas']['PriceType'];
type LicenseMode = components['schemas']['LicenseMode'];
type OrderStatus = components['schemas']['OrderStatus'];
type AuditStatus = components['schemas']['AuditStatus'];
type ContentStatus = components['schemas']['ContentStatus'];
type ListingStatus = components['schemas']['ListingStatus'];
type ArtworkStatus = components['schemas']['ArtworkStatus'];
type FeaturedLevel = components['schemas']['FeaturedLevel'];
type VerificationType = components['schemas']['VerificationType'];
type VerificationStatus = components['schemas']['VerificationStatus'];
type DeliveryPeriod = components['schemas']['DeliveryPeriod'];
type ArtworkCategory = components['schemas']['ArtworkCategory'];
type CalligraphyScript = components['schemas']['CalligraphyScript'];
type PaintingGenre = components['schemas']['PaintingGenre'];

export function patentTypeLabel(t?: PatentType | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!t) return empty;
  if (t === 'INVENTION') return '发明';
  if (t === 'UTILITY_MODEL') return '实用新型';
  if (t === 'DESIGN') return '外观设计';
  return String(t);
}

export function tradeModeLabel(t?: TradeMode | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!t) return empty;
  return t === 'ASSIGNMENT' ? '转让' : '许可';
}

export function priceTypeLabel(t?: PriceType | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!t) return empty;
  return t === 'NEGOTIABLE' ? '面议' : '一口价';
}

export function artworkCategoryLabel(t?: ArtworkCategory | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!t) return empty;
  if (t === 'CALLIGRAPHY') return '书法';
  if (t === 'PAINTING') return '绘画';
  return String(t);
}

export function calligraphyScriptLabel(t?: CalligraphyScript | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!t) return empty;
  if (t === 'KAISHU') return '楷书';
  if (t === 'XINGSHU') return '行书';
  if (t === 'CAOSHU') return '草书';
  if (t === 'LISHU') return '隶书';
  if (t === 'ZHUANSHU') return '篆书';
  return String(t);
}

export function paintingGenreLabel(t?: PaintingGenre | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!t) return empty;
  if (t === 'FIGURE') return '人物';
  if (t === 'LANDSCAPE') return '山水';
  if (t === 'BIRD_FLOWER') return '花鸟';
  if (t === 'OTHER') return '其他';
  return String(t);
}

export function licenseModeLabel(t?: LicenseMode | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!t) return empty;
  if (t === 'EXCLUSIVE') return '独占许可';
  if (t === 'SOLE') return '排他许可';
  if (t === 'NON_EXCLUSIVE') return '普通许可';
  return String(t);
}

export function orderStatusLabel(status: OrderStatus): string {
  if (status === 'DEPOSIT_PENDING') return '待付订金';
  if (status === 'DEPOSIT_PAID') return '订金已付';
  if (status === 'WAIT_FINAL_PAYMENT') return '待付尾款';
  if (status === 'FINAL_PAID_ESCROW') return '尾款托管中';
  if (status === 'READY_TO_SETTLE') return '待结算';
  if (status === 'COMPLETED') return '已完成';
  if (status === 'CANCELLED') return '已取消';
  if (status === 'REFUNDING') return '退款中';
  if (status === 'REFUNDED') return '已退款';
  return String(status);
}

export function orderStatusTagClass(status: OrderStatus): string {
  if (status === 'COMPLETED') return 'tag tag-success';
  if (status === 'CANCELLED' || status === 'REFUNDED') return 'tag tag-danger';
  if (status === 'REFUNDING' || status === 'DEPOSIT_PENDING' || status === 'WAIT_FINAL_PAYMENT') return 'tag tag-warning';
  return 'tag tag-gold';
}

export function auditStatusLabel(status: AuditStatus): string {
  if (status === 'APPROVED') return '已通过';
  if (status === 'REJECTED') return '已驳回';
  return '审核中';
}

export function auditStatusTagClass(status: AuditStatus): string {
  if (status === 'APPROVED') return 'tag tag-success';
  if (status === 'REJECTED') return 'tag tag-danger';
  return 'tag tag-warning';
}

export function contentStatusLabel(status: ContentStatus): string {
  if (status === 'DRAFT') return '草稿';
  if (status === 'ACTIVE') return '已上架';
  if (status === 'OFF_SHELF') return '已下架';
  return String(status);
}

export function listingStatusLabel(status: ListingStatus): string {
  if (status === 'DRAFT') return '草稿';
  if (status === 'ACTIVE') return '已上架';
  if (status === 'OFF_SHELF') return '已下架';
  if (status === 'SOLD') return '已成交';
  return String(status);
}

export function artworkStatusLabel(status?: ArtworkStatus | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!status) return empty;
  if (status === 'DRAFT') return '草稿';
  if (status === 'ACTIVE') return '已上架';
  if (status === 'OFF_SHELF') return '已下架';
  if (status === 'SOLD') return '已成交';
  return String(status);
}

export function featuredLevelLabel(level?: FeaturedLevel | null): string {
  if (!level || level === 'NONE') return '无';
  if (level === 'PROVINCE') return '省级特色';
  if (level === 'CITY') return '市级特色';
  return String(level);
}

export function verificationTypeLabel(type?: VerificationType | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!type) return empty;
  if (type === 'PERSON') return '个人';
  if (type === 'COMPANY') return '企业';
  if (type === 'ACADEMY') return '科研院校';
  if (type === 'GOVERNMENT') return '政府';
  if (type === 'ASSOCIATION') return '行业协会/学会';
  if (type === 'TECH_MANAGER') return '技术经理人';
  return String(type);
}

export function verificationStatusLabel(status?: VerificationStatus | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!status) return empty;
  if (status === 'APPROVED') return '已通过';
  if (status === 'REJECTED') return '已驳回';
  return '审核中';
}

export function deliveryPeriodLabel(period?: DeliveryPeriod | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!period) return empty;
  if (period === 'WITHIN_1_MONTH') return '≤1月';
  if (period === 'MONTH_1_3') return '1-3月';
  if (period === 'MONTH_3_6') return '3-6月';
  if (period === 'OVER_6_MONTHS') return '≥6月';
  if (period === 'OTHER') return '其他';
  return String(period);
}
