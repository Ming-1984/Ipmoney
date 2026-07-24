import type { components } from '@ipmoney/api-types';

type PatentType = components['schemas']['PatentType'];
type TradeMode = components['schemas']['TradeMode'];
type PriceType = components['schemas']['PriceType'];
type LicenseMode = components['schemas']['LicenseMode'];
type AuditStatus = components['schemas']['AuditStatus'];
type ListingStatus = components['schemas']['ListingStatus'];
type OrderStatus = components['schemas']['OrderStatus'];
type FeaturedLevel = components['schemas']['FeaturedLevel'];
type VerificationType = components['schemas']['VerificationType'];
type VerificationStatus = components['schemas']['VerificationStatus'];
type ContentStatus = 'DRAFT' | 'ACTIVE' | 'OFF_SHELF';
type ArtworkStatus = 'DRAFT' | 'ACTIVE' | 'OFF_SHELF' | 'SOLD';
type ArtworkCategory = 'CALLIGRAPHY' | 'PAINTING';
type CalligraphyScript = 'KAISHU' | 'XINGSHU' | 'CAOSHU' | 'LISHU' | 'ZHUANSHU';
type PaintingGenre = 'FIGURE' | 'LANDSCAPE' | 'BIRD_FLOWER' | 'OTHER';
type DeliveryPeriod = 'WITHIN_1_MONTH' | 'MONTH_1_3' | 'MONTH_3_6' | 'OVER_6_MONTHS' | 'OTHER';

export function patentTypeLabel(t?: PatentType | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!t) return empty;
  if (t === 'INVENTION') return '发明';
  if (t === 'UTILITY_MODEL') return '实用新型';
  if (t === 'DESIGN') return '外观设计';
  return '类型待确认';
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

export function licenseModeLabel(t?: LicenseMode | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!t) return empty;
  if (t === 'EXCLUSIVE') return '独占许可';
  if (t === 'SOLE') return '排他许可';
  if (t === 'NON_EXCLUSIVE') return '普通许可';
  if (t === 'OPEN_LICENSE') return '开放许可';
  return '许可方式待确认';
}

export function auditStatusLabel(status?: AuditStatus | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!status) return empty;
  if (status === 'APPROVED') return '已通过';
  if (status === 'REJECTED') return '已驳回';
  return '待审核';
}

export function contentStatusLabel(status?: ContentStatus | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!status) return empty;
  if (status === 'ACTIVE') return '已上架';
  if (status === 'OFF_SHELF') return '已下架';
  return '草稿';
}

export function listingStatusLabel(status?: ListingStatus | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!status) return empty;
  if (status === 'ACTIVE') return '已上架';
  if (status === 'OFF_SHELF') return '已下架';
  if (status === 'SOLD') return '已成交';
  return '草稿';
}

export function artworkStatusLabel(status?: ArtworkStatus | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!status) return empty;
  if (status === 'ACTIVE') return '已上架';
  if (status === 'OFF_SHELF') return '已下架';
  if (status === 'SOLD') return '已成交';
  return '草稿';
}

export function artworkCategoryLabel(t?: ArtworkCategory | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!t) return empty;
  if (t === 'CALLIGRAPHY') return '书法';
  if (t === 'PAINTING') return '绘画';
  return '类别待确认';
}

export function calligraphyScriptLabel(t?: CalligraphyScript | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!t) return empty;
  if (t === 'KAISHU') return '楷书';
  if (t === 'XINGSHU') return '行书';
  if (t === 'CAOSHU') return '草书';
  if (t === 'LISHU') return '隶书';
  if (t === 'ZHUANSHU') return '篆书';
  return '书体待确认';
}

export function paintingGenreLabel(t?: PaintingGenre | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!t) return empty;
  if (t === 'FIGURE') return '人物';
  if (t === 'LANDSCAPE') return '山水';
  if (t === 'BIRD_FLOWER') return '花鸟';
  if (t === 'OTHER') return '其他';
  return '题材待确认';
}

export function orderStatusLabel(status?: OrderStatus | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!status) return empty;
  if (status === 'DEPOSIT_PENDING') return '待付订金';
  if (status === 'DEPOSIT_PAID') return '订金已付';
  if (status === 'WAIT_FINAL_PAYMENT') return '待付尾款';
  if (status === 'FINAL_PAID_ESCROW') return '尾款托管中';
  if (status === 'READY_TO_SETTLE') return '待结算';
  if (status === 'COMPLETED') return '已完成';
  if (status === 'CANCELLED') return '已取消';
  if (status === 'REFUNDING') return '退款中';
  if (status === 'REFUNDED') return '已退款';
  return '状态待确认';
}

export function featuredLevelLabel(level?: FeaturedLevel | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '无';
  if (!level || level === 'NONE') return empty;
  if (level === 'PROVINCE') return '省级特色';
  if (level === 'CITY') return '市级特色';
  return '特色待确认';
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
  return '认证类型待确认';
}

export function verificationStatusLabel(status?: VerificationStatus | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!status) return empty;
  if (status === 'APPROVED') return '已通过';
  if (status === 'REJECTED') return '已驳回';
  return '待审核';
}

export function deliveryPeriodLabel(period?: DeliveryPeriod | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!period) return empty;
  if (period === 'WITHIN_1_MONTH') return '1个月内';
  if (period === 'MONTH_1_3') return '1-3个月';
  if (period === 'MONTH_3_6') return '3-6个月';
  if (period === 'OVER_6_MONTHS') return '6个月以上';
  if (period === 'OTHER') return '其他';
  return '周期待确认';
}
