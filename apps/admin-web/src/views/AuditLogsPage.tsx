import {
  Button,
  Card,
  Collapse,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { displayAdminInfo, normalizeUserFacingText } from '../lib/userFacingText';
import { RequestErrorAlert } from '../ui/RequestState';

type AuditLog = {
  id: string;
  actorUserId: string;
  actorDisplayName?: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  createdAt: string;
};

type PagedAuditLog = {
  items: AuditLog[];
  page: { page: number; pageSize: number; total: number };
};

type RoleOption = {
  id: string;
  name: string;
};

type PermissionOption = {
  id: string;
  name: string;
};

type StaffOption = {
  id: string;
  name: string;
  email?: string;
};

type AuditReferenceData = {
  roleNameById: Record<string, string>;
  permissionNameById: Record<string, string>;
  userNameById: Record<string, string>;
  userContactById: Record<string, string>;
};

type AuditFieldChange = {
  key: string;
  label: string;
  before: string;
  after: string;
  mode: 'added' | 'removed' | 'changed';
};

type AuditDetailVersion = 'ops' | 'tech';

const ACTION_LABELS: Record<string, string> = {
  ACHIEVEMENT_APPROVE: '通过成果审核',
  ACHIEVEMENT_MATERIALS_APPROVE: '通过成果材料审核',
  ACHIEVEMENT_REJECT: '驳回成果审核',
  ACHIEVEMENT_SUBMIT: '提交成果审核',
  AI_PARSE_UPDATE: '更新 AI 解析结果',
  ALERT_ACK: '处理告警',
  APPROVE: '通过审核',
  CONFIG_ALERT_UPDATE: '更新告警配置',
  CONFIG_BANNER_UPDATE: '更新首页 Banner',
  CONFIG_CS_UPDATE: '更新客服配置',
  CONFIG_HOME_ANNOUNCEMENT_ITEM_CREATE: '新增首页公告',
  CONFIG_HOME_ANNOUNCEMENT_ITEM_DELETE: '删除首页公告',
  CONFIG_HOME_ANNOUNCEMENT_ITEM_OFFLINE: '下线首页公告',
  CONFIG_HOME_ANNOUNCEMENT_ITEM_PUBLISH: '发布首页公告',
  CONFIG_HOME_ANNOUNCEMENT_ITEM_UPDATE: '更新首页公告',
  CONFIG_HOME_ANNOUNCEMENT_TEMPLATE_CREATE: '新增首页公告模板',
  CONFIG_HOME_ANNOUNCEMENT_TEMPLATE_DELETE: '删除首页公告模板',
  CONFIG_HOME_ANNOUNCEMENT_TEMPLATE_UPDATE: '更新首页公告模板',
  CONFIG_HOME_LANDING_UPDATE: '更新首页落地配置',
  CONFIG_HOT_SEARCH_UPDATE: '更新热门搜索',
  CONFIG_RECOMMENDATION_UPDATE: '更新推荐配置',
  CONFIG_SENSITIVE_UPDATE: '更新敏感词配置',
  CONFIG_TAXONOMY_UPDATE: '更新类目配置',
  CONFIG_TRADE_RULES_UPDATE: '更新交易规则',
  FILE_DOWNLOAD: '下载文件',
  FILE_MODERATION_UPDATE: '更新文件审核结果',
  FILE_PREVIEW: '预览文件',
  FILE_TEMP_ACCESS_ISSUED: '签发临时访问权限',
  INVOICE_DELETE: '删除发票文件',
  INVOICE_ISSUE: '标记发票已开具',
  INVOICE_REQUEST: '提交开票申请',
  INVOICE_UPSERT: '上传或替换发票',
  IMPORT_BATCH_ROLLBACK_EXECUTE: '执行导入批次撤回',
  IMPORT_BATCH_ROLLBACK_PREVIEW: '完成导入批次撤回预检',
  LISTING_APPROVE: '通过挂牌审核',
  LISTING_FEATURED_UPDATE: '更新挂牌推荐位',
  LISTING_PROOF_FILES_APPROVE: '通过挂牌材料审核',
  LISTING_REJECT: '驳回挂牌审核',
  LISTING_SUBMIT: '提交挂牌审核',
  MAINTENANCE_ORDER_CANCEL: '取消年费订单',
  MAINTENANCE_ORDER_CLOSE: '关闭年费订单',
  MAINTENANCE_ORDER_CREATE: '创建年费订单',
  MAINTENANCE_ORDER_EXECUTION_SUBMIT: '提交年费执行结果',
  MAINTENANCE_ORDER_PAYMENT_CONFIRM: '确认年费支付',
  MAINTENANCE_ORDER_QUOTE: '更新年费报价',
  MAINTENANCE_ORDER_RECEIPT_UPLOAD: '上传年费回执',
  MAINTENANCE_ORDER_RECONCILE: '完成年费对账',
  MAINTENANCE_SCHEDULE_CREATE: '创建年费计划',
  MAINTENANCE_SCHEDULE_UPDATE: '更新年费计划',
  MAINTENANCE_TASK_CREATE: '创建年费任务',
  MAINTENANCE_TASK_UPDATE: '更新年费任务',
  ORDER_CONTRACT_UPLOAD: '上传合同文件',
  ORDER_CONTRACT_SIGNED_CONFIRM: '确认合同已签署',
  ORDER_CREATE: '创建订单',
  ORDER_REFUNDED: '订单已退款',
  ORDER_REFUNDING: '订单进入退款中',
  ORDER_TRANSFER_COMPLETED_CONFIRM: '确认交付已完成',
  PATENT_MAP_BATCH_UPDATE: '批量更新专利地图数据',
  RBAC_ROLE_CREATE: '新增后台角色',
  RBAC_ROLE_DELETE: '删除后台角色',
  RBAC_ROLE_UPDATE: '更新后台角色',
  RBAC_USER_CREATE: '新增后台账号',
  RBAC_USER_UPDATE: '调整后台账号角色',
  REFUND_APPROVE: '通过退款申请',
  REFUND_AUTO_APPROVE: '自动通过退款申请',
  REFUND_COMPLETED: '退款完成',
  REFUND_REJECT: '驳回退款申请',
  REFUND_REQUEST_CREATE: '创建退款申请',
  REJECT: '驳回审核',
  SETTLEMENT_PAYOUT_MANUAL_CONFIRM: '确认已手动打款',
  TECH_MANAGER_BATCH_BADGE_UPDATE: '批量更新技术经理人标签',
  TECH_MANAGER_BATCH_RATING_UPDATE: '批量更新技术经理人评分',
  TECH_MANAGER_UPDATE: '更新技术经理人资料',
  VERIFICATION_APPROVE: '通过实名认证',
  VERIFICATION_LOGO_UPDATE: '更新认证主体 Logo',
  VERIFICATION_PROFILE_UPDATE: '更新认证主体资料',
  VERIFICATION_REJECT: '驳回实名认证',
  VERIFICATION_SUBMIT: '提交实名认证',
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  ACHIEVEMENT: '成果',
  AI_PARSE_RESULT: 'AI 解析结果',
  ALERT_EVENT: '告警',
  BULK_IMPORT: '批量导入任务',
  COMMENT: '评论',
  CONVERSATION: '会话',
  FILE: '文件',
  IMPORT_BATCH: '导入批次',
  LISTING: '挂牌',
  ORDER: '订单',
  PATENT_MAINTENANCE_ORDER: '专利年费订单',
  PATENT_MAINTENANCE_SCHEDULE: '专利年费计划',
  PATENT_MAINTENANCE_TASK: '专利年费任务',
  RBAC_ROLE: '后台角色',
  RBAC_USER: '后台账号',
  REFUND_REQUEST: '退款申请',
  SETTLEMENT: '结算单',
  SYSTEM_CONFIG: '系统配置',
  TECH_MANAGER: '技术经理人',
  USER: '用户',
  USER_VERIFICATION: '实名认证',
};

const FIELD_LABELS: Record<string, string> = {
  auditStatus: '审核状态',
  action: '操作',
  afterJson: '变更后',
  applicationNoDisplay: '申请号展示值',
  applicationNoNorm: '申请号',
  applicantNames: '申请人',
  assigneeNames: '权利人',
  abstract: '摘要',
  autoRefund: '自动退款',
  avatarUrl: '头像',
  badgeCodes: '标签',
  batchKind: '导入类型',
  batchSource: '批次名称',
  beforeJson: '变更前',
  buyerUserId: '买方账号',
  clearRanking: '清除上榜',
  comment: '备注',
  consultationRouting: '咨询分配方式',
  contactName: '联系人',
  coverFileId: '封面图',
  deliveryPeriod: '交付周期',
  description: '说明',
  displayName: '展示名称',
  duplicatePolicy: '重复处理策略',
  entityType: '实体类型',
  expiresAt: '有效期至',
  featuredLevel: '推荐位',
  featuredRank: '推荐排名',
  featuredRegionCode: '推荐地区',
  featuredUntil: '推荐有效期',
  fileId: '文件',
  fileName: '文件名',
  grantDate: '授权日',
  grantPublicationNoDisplay: '授权公告号',
  id: '编号',
  industryTags: '行业标签',
  input: '导入内容',
  intro: '简介',
  inventorNames: '发明人',
  invoiceFileId: '发票文件',
  invoiceIssuedAt: '开票时间',
  invoiceNo: '发票号',
  ipcCodes: 'IPC 分类号',
  legalStatus: '法律状态',
  legalStatusRaw: '原始法律状态',
  licenseMode: '许可方式',
  listingId: '挂牌',
  listingTopics: '专题标签',
  locCodes: 'LOC 分类号',
  logoFileId: 'Logo',
  mode: '更新方式',
  module: '模块',
  name: '名称',
  paidAt: '支付时间',
  paymentId: '支付单',
  people: '人员数据',
  permissionIds: '权限',
  phone: '手机号',
  patentNoDisplay: '专利号展示值',
  patentType: '专利类型',
  priceType: '报价方式',
  priceAmountFen: '金额',
  publicationNoDisplay: '公开号展示值',
  publishedAt: '发布时间',
  ratingCount: '评分人数',
  ratingScore: '评分',
  reason: '原因',
  regionCode: '地区',
  rejectReason: '驳回原因',
  remark: '备注',
  roleIds: '角色',
  rollbackStatus: '撤回状态',
  rollbackStrategy: '撤回策略',
  scope: '访问范围',
  sellerUserId: '卖方账号',
  source: '来源',
  sourcePrimary: '专利来源',
  status: '状态',
  targetId: '对象编号',
  title: '标题',
  tradeNo: '交易流水号',
  tradeMode: '交易方式',
  updatedAt: '更新时间',
  userId: '用户',
};

const ENUM_VALUE_LABELS: Record<string, string> = {
  ACTIVE: '进行中',
  ALL: '全部账号',
  ADMIN: '后台录入',
  ADMIN_IMPORT: '后台导入',
  APPROVED: '已通过',
  ASSIGNMENT: '转让',
  AUTO: '自动处理',
  AVAILABLE: '已可用',
  BATCH: '批量更新',
  BLOCKED: '阻断/人工处理',
  CANCELLED: '已取消',
  CITY: '市级推荐',
  CLOSE: '关闭',
  CLOSED: '已关闭',
  COMPLETED: '已完成',
  COMPANY: '企业',
  CONFLICTED: '冲突',
  DEPOSIT_PAID: '订金已支付',
  DEPOSIT_PENDING: '待付订金',
  DESIGN: '外观设计',
  DRAFT: '草稿',
  EXCLUSIVE: '独占许可',
  EXPIRED: '已失效',
  FINAL_PAID_ESCROW: '尾款托管中',
  FIXED: '一口价',
  GRANTED: '已授权',
  HIGH: '高',
  INVENTION: '发明',
  INVALID: '校验失败',
  INVALIDATED: '已无效',
  IN_PROGRESS: '处理中',
  LICENSE: '许可',
  LOW: '低',
  MONTH_1_3: '1-3 个月',
  MONTH_3_6: '3-6 个月',
  MEDIUM: '中',
  MANUAL: '手动处理',
  NEGOTIABLE: '面议',
  NON_EXCLUSIVE: '普通许可',
  ONLINE_ORDER: '线上订单',
  OPEN: '待处理',
  OPEN_LICENSE: '开放许可',
  OVERWRITE: '覆盖更新',
  NONE: '无',
  OFFLINE: '已下线',
  OFFLINE_BANK: '线下银行转账',
  OFFLINE_OTHER: '线下其他',
  OFF_SHELF: '已下架',
  OTHER: '其他',
  OWNER: '权利人咨询',
  OVER_6_MONTHS: '6 个月以上',
  PARTIAL_FAILED: '部分失败',
  PARTIALLY_ROLLED_BACK: '部分撤回',
  PARTIALLY_SUCCEEDED: '部分完成',
  PENDING: '待处理',
  PERSON: '个人',
  PLATFORM: '平台客服',
  PROVINCE: '省级推荐',
  PROVIDER: '外部数据源',
  READY_TO_SETTLE: '待结算',
  REFUNDED: '已退款',
  REFUNDING: '退款中',
  REJECTED: '已驳回',
  REPLACE: '替换',
  ROLLBACKABLE: '可自动撤回',
  ROLLBACK_FAILED: '撤回失败',
  ROLLBACK_PRECHECKED: '已预检',
  ROLLBACK_RUNNING: '撤回中',
  ROLLED_BACK: '已撤回',
  RUNNING: '执行中',
  SOLE: '排他许可',
  SOLD: '已成交',
  STAFF: '仅员工账号',
  SUCCEEDED: '已完成',
  TECH_MANAGER: '技术经理人',
  TRANSFER: '转让',
  UNKNOWN: '状态待确认',
  UPSERT: '重复更新',
  USER: '用户',
  UTILITY_MODEL: '实用新型',
  VALID: '校验通过',
  WAIT_FINAL_PAYMENT: '待付尾款',
  WAIT_UPLOAD: '待上传',
  WAIT_CONFIRM: '待确认',
  WITHIN_1_MONTH: '1 个月内',
};

const HIDDEN_CHANGE_KEYS = new Set(['createdAt', 'id', 'ip', 'requestId', 'updatedAt', 'userAgent']);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeCode(value: string): string {
  return String(value || '').trim().toUpperCase();
}

function auditActionLabel(value: string): string {
  const code = normalizeCode(value);
  return ACTION_LABELS[code] || '操作待确认';
}

function auditTargetTypeLabel(value: string): string {
  const code = normalizeCode(value);
  return TARGET_TYPE_LABELS[code] || '对象待确认';
}

function auditFieldLabel(key: string): string {
  return FIELD_LABELS[key] || '字段待确认';
}

function isEnumFieldKey(key: string): boolean {
  const normalized = key.trim();
  const lower = normalized.toLowerCase();
  return (
    lower.endsWith('status') ||
    lower.endsWith('type') ||
    lower.endsWith('mode') ||
    lower.endsWith('policy') ||
    lower.endsWith('level') ||
    lower.endsWith('strategy') ||
    lower === 'action' ||
    lower === 'kind' ||
    lower === 'operation' ||
    lower === 'scope' ||
    lower === 'source' ||
    lower === 'sourceprimary'
  );
}

function actionTagColor(value: string): string {
  const code = normalizeCode(value);
  if (code === 'IMPORT_BATCH_ROLLBACK_PREVIEW') return 'blue';
  if (code === 'IMPORT_BATCH_ROLLBACK_EXECUTE') return 'orange';
  if (/(APPROVE|PUBLISH|CREATE|ISSUE|CONFIRM|SUBMIT|UPLOAD|PREVIEW|DOWNLOAD)$/.test(code)) return 'green';
  if (/(REJECT|DELETE|CANCEL|OFFLINE)$/.test(code)) return 'red';
  if (/(UPDATE|QUOTE|ACK|RECONCILE)$/.test(code)) return 'blue';
  if (/REFUND/.test(code)) return 'orange';
  return 'default';
}

function safeJson(value: unknown): string {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function operatorDisplayName(name?: string, userId?: string, references?: AuditReferenceData): string {
  return (
    normalizeUserFacingText(name) ||
    normalizeUserFacingText(references?.userNameById[userId || '']) ||
    normalizeUserFacingText(userId) ||
    '平台成员'
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isImportBatchAuditLog(log: AuditLog): boolean {
  return normalizeCode(log.targetType) === 'IMPORT_BATCH' || normalizeCode(log.action).startsWith('IMPORT_BATCH_');
}

function importBatchCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function importBatchPayload(log: AuditLog): Record<string, unknown> {
  return isPlainObject(log.afterJson) ? log.afterJson : {};
}

function importBatchSource(log: AuditLog): string {
  const after = importBatchPayload(log);
  const before = isPlainObject(log.beforeJson) ? log.beforeJson : {};
  return normalizeUserFacingText(after.batchSource) || normalizeUserFacingText(before.batchSource);
}

function importBatchScope(log: AuditLog): string {
  const groups = importBatchPayload(log).groups;
  if (!Array.isArray(groups)) return '';

  const labels: Record<string, string> = {
    ACHIEVEMENT: '成果',
    DEAL_RECORD: '成交记录',
    LISTING: '挂牌',
    PATENT: '专利主数据',
    TECH_MANAGER_BADGE: '经理人标签',
    TECH_MANAGER_PROFILE: '经理人资料',
    USER: '用户账号',
    USER_VERIFICATION: '认证资料',
  };

  return groups
    .filter(isPlainObject)
    .map((group) => {
      const entityType = normalizeCode(String(group.entityType || ''));
      const total = importBatchCount(group.total);
      if (!entityType || !total) return '';
      return `${labels[entityType] || entityType} ${total} 项`;
    })
    .filter(Boolean)
    .join('、');
}

function buildImportBatchPreview(log: AuditLog): string {
  const summary = importBatchPayload(log).summary;
  if (!isPlainObject(summary)) return '已完成撤回预检，请进入批次明细查看处理建议。';

  const total = importBatchCount(summary.totalCount);
  const rollbackable = importBatchCount(summary.rollbackableCount);
  const conflicted = importBatchCount(summary.conflictedCount);
  const manualOnly = importBatchCount(summary.manualOnlyCount);
  const blocked = Math.max(importBatchCount(summary.blockedCount) - manualOnly, 0);
  const rolledBack = importBatchCount(summary.rolledBackCount);
  const skipped = importBatchCount(summary.skippedCount);
  const failed = importBatchCount(summary.failedCount);
  const scope = importBatchScope(log);
  const result: string[] = [];

  if (rollbackable) result.push(`可自动撤回 ${rollbackable} 项`);
  if (conflicted) result.push(`需人工确认 ${conflicted} 项`);
  if (manualOnly) result.push(`需人工处理 ${manualOnly} 项`);
  if (blocked) result.push(`阻断 ${blocked} 项`);
  if (rolledBack) result.push(`已撤回 ${rolledBack} 项`);
  if (skipped) result.push(`跳过 ${skipped} 项`);
  if (failed) result.push(`失败 ${failed} 项`);

  const scopeText = scope ? `涉及 ${scope}` : total ? `共检查 ${total} 项` : '';
  return [scopeText, result.join('，')].filter(Boolean).join('；') || '已完成撤回预检，未发现可处理的变更。';
}

function buildImportBatchExecutePreview(log: AuditLog): string {
  const after = importBatchPayload(log);
  const rolledBack = importBatchCount(after.rolledBackCount);
  const conflicted = importBatchCount(after.conflictedCount);
  const blocked = importBatchCount(after.blockedCount);
  const failed = importBatchCount(after.failedCount);
  const reason = normalizeUserFacingText(after.reason);
  const manualOverride = isPlainObject(after.manualOverride) ? after.manualOverride : null;
  const manualOverrideCount = Array.isArray(manualOverride?.changeIds) ? manualOverride.changeIds.length : 0;
  const result: string[] = [];

  if (rolledBack) result.push(`已撤回 ${rolledBack} 项`);
  if (manualOverrideCount) result.push(`已按人工确认纳入 ${manualOverrideCount} 项`);
  if (conflicted) result.push(`仍有冲突 ${conflicted} 项`);
  if (blocked) result.push(`仍有阻断 ${blocked} 项`);
  if (failed) result.push(`失败 ${failed} 项`);
  if (reason) result.push(`撤回原因：${reason}`);

  return result.join('；') || '已执行批次撤回，请进入批次明细核对结果。';
}

function buildImportBatchFieldChanges(log: AuditLog): AuditFieldChange[] {
  const action = normalizeCode(log.action);
  const after = importBatchPayload(log);
  const before = isPlainObject(log.beforeJson) ? log.beforeJson : {};
  const changes: AuditFieldChange[] = [];
  const add = (key: string, label: string, afterValue: string, mode: AuditFieldChange['mode'] = 'added', beforeValue = '未设置') => {
    if (!afterValue) return;
    changes.push({ key, label, before: beforeValue, after: afterValue, mode });
  };

  if (action === 'IMPORT_BATCH_ROLLBACK_PREVIEW') {
    const summary = isPlainObject(after.summary) ? after.summary : {};
    const scope = importBatchScope(log);
    const total = importBatchCount(summary.totalCount);
    const rollbackable = importBatchCount(summary.rollbackableCount);
    const conflicted = importBatchCount(summary.conflictedCount);
    const manualOnly = importBatchCount(summary.manualOnlyCount);
    const blocked = Math.max(importBatchCount(summary.blockedCount) - manualOnly, 0);
    const rolledBack = importBatchCount(summary.rolledBackCount);
    const failed = importBatchCount(summary.failedCount);
    add('scope', '检查对象', scope || (total ? `共 ${total} 项` : '本批次变更'));
    if (rollbackable) add('rollbackableCount', '可自动撤回', `${rollbackable} 项`);
    if (conflicted) add('conflictedCount', '需人工确认', `${conflicted} 项`);
    if (manualOnly) add('manualOnlyCount', '需人工处理', `${manualOnly} 项`);
    if (blocked) add('blockedCount', '阻断', `${blocked} 项`);
    if (rolledBack) add('rolledBackCount', '已撤回', `${rolledBack} 项`);
    if (failed) add('failedCount', '失败', `${failed} 项`);
    return changes;
  }

  if (action === 'IMPORT_BATCH_ROLLBACK_EXECUTE') {
    const emptyReferences = { roleNameById: {}, permissionNameById: {}, userNameById: {}, userContactById: {} };
    const beforeStatus = before.status === undefined ? '' : formatAuditFieldValue('status', before.status, emptyReferences);
    const afterStatus = after.status === undefined ? '' : formatAuditFieldValue('status', after.status, emptyReferences);
    if (afterStatus) add('status', '批次状态', afterStatus, beforeStatus ? 'changed' : 'added', beforeStatus || '未设置');
    const rolledBack = importBatchCount(after.rolledBackCount);
    const conflicted = importBatchCount(after.conflictedCount);
    const blocked = importBatchCount(after.blockedCount);
    const failed = importBatchCount(after.failedCount);
    if (rolledBack) add('rolledBackCount', '已撤回', `${rolledBack} 项`);
    if (conflicted) add('conflictedCount', '冲突', `${conflicted} 项`);
    if (blocked) add('blockedCount', '阻断', `${blocked} 项`);
    if (failed) add('failedCount', '失败', `${failed} 项`);
    const reason = normalizeUserFacingText(after.reason);
    if (reason) add('reason', '撤回原因', reason);
    const manualOverride = isPlainObject(after.manualOverride) ? after.manualOverride : null;
    const manualOverrideCount = Array.isArray(manualOverride?.changeIds) ? manualOverride.changeIds.length : 0;
    if (manualOverrideCount) add('manualOverride', '人工确认纳入', `${manualOverrideCount} 项`);
    return changes;
  }

  return changes;
}

function stringifyForCompare(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyForCompare(item)).join(',')}]`;
  }
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${key}:${stringifyForCompare(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function shortId(value?: string): string {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (UUID_RE.test(text)) return `${text.slice(0, 8)}...`;
  if (text.length > 18) return `${text.slice(0, 18)}...`;
  return text;
}

function formatEnumLike(value: string): string | null {
  const code = normalizeCode(value);
  if (!code) return '';
  if (ENUM_VALUE_LABELS[code]) return ENUM_VALUE_LABELS[code];
  if (/^[A-Z0-9]+_[A-Z0-9_]+$/.test(code)) return '值待确认';
  return null;
}

function formatArraySummary(values: unknown[], key: string, references: AuditReferenceData): string {
  if (!values.length) return '空';
  if (key === 'roleIds') {
    return values
      .map((item) => normalizeUserFacingText(references.roleNameById[String(item || '')]) || '角色待确认')
      .join('、');
  }
  if (key === 'permissionIds') {
    return values
      .map((item) => normalizeUserFacingText(references.permissionNameById[String(item || '')]) || '权限待确认')
      .join('、');
  }
  if (key === 'badgeCodes' || key === 'industryTags') {
    return values.map((item) => String(item || '')).filter(Boolean).join('、');
  }
  const simpleValues = values.filter((item) => ['string', 'number', 'boolean'].includes(typeof item));
  if (simpleValues.length === values.length) {
    return simpleValues.map((item) => formatAuditFieldValue(key, item, references)).join('、');
  }
  return `共 ${values.length} 项`;
}

function formatObjectSummary(value: Record<string, unknown>, references: AuditReferenceData): string {
  const preferredKeys = ['name', 'title', 'displayName', 'phone', 'invoiceNo', 'status', 'reason'];
  const picked = preferredKeys
    .map((key) => {
      const item = value[key];
      if (item === undefined || item === null || item === '') return '';
      return `${auditFieldLabel(key)}：${formatAuditFieldValue(key, item, references)}`;
    })
    .filter(Boolean);
  if (picked.length) return picked.slice(0, 3).join('；');
  const keys = Object.keys(value);
  if (!keys.length) return '空对象';
  return `已更新 ${keys.length} 个字段`;
}

function formatAuditFieldValue(key: string, value: unknown, references: AuditReferenceData): string {
  if (value === undefined) return '未提供';
  if (value === null) return '空';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number') {
    if (key.endsWith('Fen')) return `¥${(value / 100).toFixed(2)}`;
    return String(value);
  }
  if (Array.isArray(value)) return formatArraySummary(value, key, references);
  if (isPlainObject(value)) return formatObjectSummary(value, references);
  const text = String(value).trim();
  if (!text) return '空';
  if (key === 'roleIds') {
    return normalizeUserFacingText(references.roleNameById[text]) || '角色待确认';
  }
  if (key === 'permissionIds') {
    return normalizeUserFacingText(references.permissionNameById[text]) || '权限待确认';
  }
  if (key === 'buyerUserId' || key === 'userId') {
    return normalizeUserFacingText(references.userNameById[text]) || shortId(text);
  }
  if (key === 'regionCode') return text;
  if (ISO_DATE_RE.test(text)) return formatTimeSmart(text);
  if (UUID_RE.test(text) && key.toLowerCase().includes('user')) {
    return normalizeUserFacingText(references.userNameById[text]) || shortId(text);
  }
  if (UUID_RE.test(text) && key.toLowerCase().includes('role')) {
    return normalizeUserFacingText(references.roleNameById[text]) || shortId(text);
  }
  if (UUID_RE.test(text)) return shortId(text);
  const enumText = formatEnumLike(text);
  if (enumText) return enumText;
  if (isEnumFieldKey(key)) return '值待确认';
  return text;
}

function buildFieldChanges(log: AuditLog, references: AuditReferenceData): AuditFieldChange[] {
  if (isImportBatchAuditLog(log)) return buildImportBatchFieldChanges(log);

  const before = isPlainObject(log.beforeJson) ? log.beforeJson : {};
  const after = isPlainObject(log.afterJson) ? log.afterJson : {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  return keys
    .filter((key) => !HIDDEN_CHANGE_KEYS.has(key))
    .filter((key) => stringifyForCompare(before[key]) !== stringifyForCompare(after[key]))
    .map((key) => {
      const beforeExists = Object.prototype.hasOwnProperty.call(before, key);
      const afterExists = Object.prototype.hasOwnProperty.call(after, key);
      const mode = beforeExists && afterExists ? 'changed' : beforeExists ? 'removed' : 'added';
      return {
        key,
        label: auditFieldLabel(key),
        before: beforeExists ? formatAuditFieldValue(key, before[key], references) : '未设置',
        after: afterExists ? formatAuditFieldValue(key, after[key], references) : '已移除',
        mode,
      };
    });
}

function pickTargetTitle(log: AuditLog, references: AuditReferenceData): string {
  const before = isPlainObject(log.beforeJson) ? log.beforeJson : {};
  const after = isPlainObject(log.afterJson) ? log.afterJson : {};
  const targetTypeLabel = auditTargetTypeLabel(log.targetType);

  if (isImportBatchAuditLog(log)) {
    const source = importBatchSource(log);
    return source ? `${targetTypeLabel} ${source}` : `${targetTypeLabel} #${shortId(log.targetId)}`;
  }

  if (normalizeCode(log.targetType) === 'RBAC_ROLE') {
    const roleName =
      normalizeUserFacingText(after.name) ||
      normalizeUserFacingText(before.name) ||
      normalizeUserFacingText(references.roleNameById[log.targetId]);
    return roleName ? `${targetTypeLabel} ${roleName}` : `${targetTypeLabel} ${shortId(log.targetId)}`;
  }

  if (normalizeCode(log.targetType) === 'RBAC_USER') {
    const userName =
      normalizeUserFacingText(references.userNameById[log.targetId]) ||
      normalizeUserFacingText(after.name) ||
      normalizeUserFacingText(before.name) ||
      normalizeUserFacingText(after.phone) ||
      normalizeUserFacingText(before.phone);
    return userName ? `${targetTypeLabel} ${userName}` : `${targetTypeLabel} ${shortId(log.targetId)}`;
  }

  const candidate =
    normalizeUserFacingText(after.title) ||
    normalizeUserFacingText(before.title) ||
    normalizeUserFacingText(after.name) ||
    normalizeUserFacingText(before.name) ||
    normalizeUserFacingText(after.displayName) ||
    normalizeUserFacingText(before.displayName) ||
    normalizeUserFacingText(after.module) ||
    normalizeUserFacingText(before.module) ||
    normalizeUserFacingText(after.invoiceNo) ||
    normalizeUserFacingText(before.invoiceNo);

  if (candidate) return `${targetTypeLabel} ${candidate}`;
  return `${targetTypeLabel} ${shortId(log.targetId)}`;
}

function buildChangePreview(log: AuditLog, references: AuditReferenceData): string {
  const action = normalizeCode(log.action);
  if (action === 'IMPORT_BATCH_ROLLBACK_PREVIEW') return buildImportBatchPreview(log);
  if (action === 'IMPORT_BATCH_ROLLBACK_EXECUTE') return buildImportBatchExecutePreview(log);

  const changes = buildFieldChanges(log, references);
  if (!changes.length) {
    return '这条记录没有附带可读的字段变更，需进入详情查看原始信息。';
  }
  return changes
    .slice(0, 2)
    .map((item) => {
      if (item.mode === 'added') return `${item.label}：${item.after}`;
      if (item.mode === 'removed') return `${item.label}：已移除`;
      return `${item.label}：${item.before} -> ${item.after}`;
    })
    .join('；');
}

function buildEventSummary(log: AuditLog, references: AuditReferenceData): string {
  const actionLabel = auditActionLabel(log.action);
  const targetLabel = pickTargetTitle(log, references);
  const preview = buildChangePreview(log, references);
  return `${actionLabel}，对象为 ${targetLabel}。${preview}`;
}

function detailMetaRows(log: AuditLog, references: AuditReferenceData) {
  return [
    { key: 'summary', label: '发生了什么', children: buildEventSummary(log, references) },
    { key: 'action', label: '操作类型', children: auditActionLabel(log.action) },
    { key: 'target', label: '操作对象', children: pickTargetTitle(log, references) },
    {
      key: 'actor',
      label: '操作人',
      children: operatorDisplayName(log.actorDisplayName, log.actorUserId, references),
    },
    { key: 'time', label: '发生时间', children: formatTimeSmart(log.createdAt) },
  ];
}

export function AuditLogsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedAuditLog | null>(null);
  const [references, setReferences] = useState<AuditReferenceData>({
    roleNameById: {},
    permissionNameById: {},
    userNameById: {},
    userContactById: {},
  });

  const [page, setPage] = useState(1);
  const [targetType, setTargetType] = useState<string | undefined>(undefined);
  const [targetId, setTargetId] = useState('');
  const [actorUserId, setActorUserId] = useState('');
  const [action, setAction] = useState<string | undefined>(undefined);

  const [detailOpen, setDetailOpen] = useState(false);
  const [active, setActive] = useState<AuditLog | null>(null);
  const [detailVersion, setDetailVersion] = useState<AuditDetailVersion>('ops');

  const loadReferences = useCallback(async () => {
    const [rolesResult, permissionsResult, usersResult] = await Promise.allSettled([
      apiGet<{ items?: RoleOption[] }>('/admin/rbac/roles'),
      apiGet<{ items?: PermissionOption[] }>('/admin/rbac/permissions'),
      apiGet<{ items?: StaffOption[] }>('/admin/rbac/users', { scope: 'ALL' }),
    ]);

    const next: AuditReferenceData = {
      roleNameById: {},
      permissionNameById: {},
      userNameById: {},
      userContactById: {},
    };

    if (rolesResult.status === 'fulfilled') {
      (rolesResult.value.items || []).forEach((item) => {
        next.roleNameById[item.id] = item.name;
      });
    }

    if (permissionsResult.status === 'fulfilled') {
      (permissionsResult.value.items || []).forEach((item) => {
        next.permissionNameById[item.id] = item.name;
      });
    }

    if (usersResult.status === 'fulfilled') {
      (usersResult.value.items || []).forEach((item) => {
        next.userNameById[item.id] = item.name;
        if (item.email) next.userContactById[item.id] = item.email;
      });
    }

    setReferences(next);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<PagedAuditLog>('/admin/audit-logs', {
        targetType: targetType || undefined,
        targetId: targetId.trim() || undefined,
        actorUserId: actorUserId.trim() || undefined,
        action: action || undefined,
        page,
        pageSize: 20,
      });
      setData(result);
    } catch (e: any) {
      setError(e);
      setData(null);
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [action, actorUserId, page, targetId, targetType]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadReferences();
  }, [loadReferences]);

  useEffect(() => {
    setPage(1);
  }, [action, actorUserId, targetId, targetType]);

  const rows = useMemo(() => data?.items || [], [data?.items]);

  const actionOptions = useMemo(() => {
    const values = new Map<string, string>();
    Object.entries(ACTION_LABELS).forEach(([value, label]) => values.set(value, label));
    rows.forEach((item) => {
      const value = normalizeCode(item.action);
      if (value && !values.has(value)) values.set(value, auditActionLabel(value));
    });
    return Array.from(values.entries())
      .sort((a, b) => a[1].localeCompare(b[1], 'zh-CN'))
      .map(([value, label]) => ({ value, label: `${label} (${value})` }));
  }, [rows]);

  const targetTypeOptions = useMemo(() => {
    const values = new Map<string, string>();
    Object.entries(TARGET_TYPE_LABELS).forEach(([value, label]) => values.set(value, label));
    rows.forEach((item) => {
      const value = normalizeCode(item.targetType);
      if (value && !values.has(value)) values.set(value, auditTargetTypeLabel(value));
    });
    return Array.from(values.entries())
      .sort((a, b) => a[1].localeCompare(b[1], 'zh-CN'))
      .map(([value, label]) => ({ value, label: `${label} (${value})` }));
  }, [rows]);

  const activeChanges = useMemo(() => (active ? buildFieldChanges(active, references) : []), [active, references]);

  return (
    <Card className="admin-audit-logs-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>
            审计日志
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 4 }}>
            默认聚焦关键操作信息，方便快速查看谁在什么时候，对哪个对象做了什么，以及涉及哪些重点变更。
          </Typography.Paragraph>
          <Typography.Text type="secondary">
            请求流水、IP、User-Agent 与原始 JSON 仍保留在详情中，便于需要时进一步核查。
          </Typography.Text>
        </div>

        {error ? <RequestErrorAlert error={error} onRetry={load} /> : null}

        <Space wrap size={12} align="start">
          <Select
            value={action}
            allowClear
            showSearch
            style={{ width: 320 }}
            placeholder="操作类型"
            options={actionOptions}
            optionFilterProp="label"
            onChange={(value) => setAction(value)}
          />
          <Select
            value={targetType}
            allowClear
            showSearch
            style={{ width: 280 }}
            placeholder="对象类型"
            options={targetTypeOptions}
            optionFilterProp="label"
            onChange={(value) => setTargetType(value)}
          />
          <Input
            value={targetId}
            style={{ width: 240 }}
            placeholder="对象编号 / 单号（精确匹配）"
            allowClear
            onChange={(e) => setTargetId(e.target.value)}
            onPressEnter={() => void load()}
          />
          <Input
            value={actorUserId}
            style={{ width: 220 }}
            placeholder="操作人编号（精确匹配）"
            allowClear
            onChange={(e) => setActorUserId(e.target.value)}
            onPressEnter={() => void load()}
          />
          <Button onClick={() => void load()}>查询</Button>
        </Space>

        <Table<AuditLog>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={{
            current: data?.page.page || page,
            pageSize: data?.page.pageSize || 20,
            total: data?.page.total || 0,
            onChange: (next) => setPage(next),
          }}
          columns={[
            {
              title: '时间',
              dataIndex: 'createdAt',
              width: 160,
              render: (value: string) => formatTimeSmart(value),
            },
            {
              title: '发生了什么',
              key: 'summary',
              render: (_, row) => (
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Space size={8} wrap>
                    <Tag color={actionTagColor(row.action)}>{auditActionLabel(row.action)}</Tag>
                    <Typography.Text>{pickTargetTitle(row, references)}</Typography.Text>
                  </Space>
                  <Typography.Text type="secondary">{buildChangePreview(row, references)}</Typography.Text>
                </Space>
              ),
            },
            {
              title: '操作人',
              width: 180,
              render: (_, row) => operatorDisplayName(row.actorDisplayName, row.actorUserId, references),
            },
            {
              title: '操作',
              key: 'actions',
              width: 90,
              render: (_, row) => (
                <Button
                  onClick={() => {
                    setActive(row);
                    setDetailVersion('ops');
                    setDetailOpen(true);
                  }}
                >
                  详情
                </Button>
              ),
            },
          ]}
        />
      </Space>

      <Drawer
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailVersion('ops');
        }}
        width={860}
        title={active ? `审计详情：${auditActionLabel(active.action)}` : '审计详情'}
        extra={
          active ? (
            <Segmented
              size="small"
              value={detailVersion}
              onChange={(value) => setDetailVersion(value as AuditDetailVersion)}
              options={[
                { label: '运营版本', value: 'ops' },
                { label: '技术版本', value: 'tech' },
              ]}
            />
          ) : null
        }
        destroyOnClose
      >
        {active ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {detailVersion === 'ops' ? (
              <>
                <Card size="small">
                  <Descriptions column={1} size="small" items={detailMetaRows(active, references)} />
                </Card>

                <Card
                  size="small"
                  title="关键变更"
                  extra={<Typography.Text type="secondary">{activeChanges.length ? `${activeChanges.length} 项` : '无'}</Typography.Text>}
                >
                  {activeChanges.length ? (
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      {activeChanges.map((item) => (
                        <div
                          key={item.key}
                          style={{
                            padding: '12px 14px',
                            borderRadius: 10,
                            background: 'rgba(255,255,255,0.9)',
                            border: '1px solid var(--ipm-border)',
                          }}
                        >
                          <Space direction="vertical" size={4} style={{ width: '100%' }}>
                            <Space size={8}>
                              <Typography.Text strong>{item.label}</Typography.Text>
                              <Tag color={item.mode === 'removed' ? 'red' : item.mode === 'added' ? 'green' : 'blue'}>
                                {item.mode === 'removed' ? '删除' : item.mode === 'added' ? '新增' : '修改'}
                              </Tag>
                            </Space>
                            {item.mode === 'changed' ? (
                              <>
                                <Typography.Text type="secondary">变更前：{item.before}</Typography.Text>
                                <Typography.Text>变更后：{item.after}</Typography.Text>
                              </>
                            ) : item.mode === 'added' ? (
                              <Typography.Text>设置为：{item.after}</Typography.Text>
                            ) : (
                              <Typography.Text>原值：{item.before}</Typography.Text>
                            )}
                          </Space>
                        </div>
                      ))}
                    </Space>
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这条日志没有拆出可读字段，通常是系统只记录了原始对象。" />
                  )}
                </Card>
              </>
            ) : (
              <>
                <Card size="small" title="技术信息">
                  <Descriptions
                    column={1}
                    size="small"
                    items={[
                      { key: 'action', label: '原始操作码', children: displayAdminInfo(active.action) },
                      { key: 'targetType', label: '原始对象类型', children: displayAdminInfo(active.targetType) },
                      { key: 'targetId', label: '对象编号', children: displayAdminInfo(active.targetId) },
                      { key: 'actorId', label: '操作人编号', children: displayAdminInfo(active.actorUserId) },
                      { key: 'requestId', label: '请求流水', children: displayAdminInfo(active.requestId) },
                      { key: 'ip', label: 'IP', children: displayAdminInfo(active.ip) },
                      { key: 'ua', label: 'User-Agent', children: displayAdminInfo(active.userAgent) },
                    ]}
                  />
                </Card>

                <Collapse
                  defaultActiveKey={['raw-before', 'raw-after']}
                  items={[
                    {
                      key: 'raw-before',
                      label: '原始变更前 JSON',
                      children: (
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {displayAdminInfo(safeJson(active.beforeJson), '未记录')}
                        </pre>
                      ),
                    },
                    {
                      key: 'raw-after',
                      label: '原始变更后 JSON',
                      children: (
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {displayAdminInfo(safeJson(active.afterJson), '未记录')}
                        </pre>
                      ),
                    },
                  ]}
                />
              </>
            )}
          </Space>
        ) : null}
      </Drawer>
    </Card>
  );
}
