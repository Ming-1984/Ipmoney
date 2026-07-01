import type { components } from '@ipmoney/api-types';

import { displayUserName, normalizeDisplayText } from './displayText';

type ConversationSummary = components['schemas']['ConversationSummary'];

function defaultConversationLabel(contentType?: string | null): string {
  const normalized = String(contentType || '').trim().toUpperCase();
  if (normalized === 'LISTING') return '挂牌咨询';
  if (normalized === 'ACHIEVEMENT') return '成果咨询';
  if (normalized === 'TECH_MANAGER') return '技术经理人';
  if (normalized === 'SUPPORT') return '平台客服助手';
  if (normalized === 'DISPUTE') return '订单争议';
  if (normalized === 'MAINTENANCE') return '专利年费代缴';
  return '沟通会话';
}

export function resolveConversationEntityDisplayName(
  conversation?: Pick<ConversationSummary, 'contentType' | 'contentTitle' | 'counterpart'> | null,
): string {
  const contentType = String(conversation?.contentType || '').trim().toUpperCase();
  const counterpartName = displayUserName(conversation?.counterpart, '');
  const contentTitle = normalizeDisplayText(conversation?.contentTitle);

  if (contentType === 'SUPPORT') return '平台客服助手';
  if (contentType === 'DISPUTE') return contentTitle || '订单争议';
  if (contentType === 'MAINTENANCE') return contentTitle || '专利年费代缴';
  if (contentType === 'LISTING' || contentType === 'ACHIEVEMENT' || contentType === 'TECH_MANAGER') {
    return counterpartName || contentTitle || defaultConversationLabel(contentType);
  }
  return counterpartName || contentTitle || defaultConversationLabel(contentType);
}
