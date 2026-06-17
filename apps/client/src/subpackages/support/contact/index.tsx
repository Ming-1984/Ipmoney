import { Text, View } from '@tarojs/components';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPost } from '../../../lib/api';
import { getDetailCache, setDetailCache } from '../../../lib/detailCache';
import { PageHeader, Spacer, Surface, TipBanner } from '../../../ui/layout';
import { Cell, toast } from '../../../ui/nutui';

type CustomerServiceConfig = {
  phone: string;
  defaultReply?: string;
  assignStrategy?: 'AUTO' | 'MANUAL';
};

type Conversation = components['schemas']['Conversation'];

const FALLBACK_PHONE = '400-000-0000';
const CS_CONFIG_CACHE_SCOPE = 'public-config';
const CS_CONFIG_CACHE_KEY = 'customer-service';

export default function SupportContactPage() {
  const [phone, setPhone] = useState(FALLBACK_PHONE);
  const [openingChat, setOpeningChat] = useState(false);
  const pageVisibleRef = useRef(true);
  const openChatSeqRef = useRef(0);

  useDidShow(() => {
    pageVisibleRef.current = true;
  });

  useDidHide(() => {
    pageVisibleRef.current = false;
    openChatSeqRef.current += 1;
    setOpeningChat(false);
  });

  const load = useCallback(async () => {
    const cached = getDetailCache<CustomerServiceConfig>(CS_CONFIG_CACHE_SCOPE, CS_CONFIG_CACHE_KEY);
    if (cached?.phone && String(cached.phone).trim()) {
      setPhone(String(cached.phone).trim());
    }
    try {
      const d = await apiGet<CustomerServiceConfig>('/public/config/customer-service');
      if (d?.phone && String(d.phone).trim()) {
        const normalizedPhone = String(d.phone).trim();
        setPhone(normalizedPhone);
        setDetailCache(CS_CONFIG_CACHE_SCOPE, CS_CONFIG_CACHE_KEY, { ...d, phone: normalizedPhone });
      }
    } catch {
      // Keep cached/fallback phone when config service isn't ready.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openSupportConversation = useCallback(async () => {
    if (openingChat) return;
    const seq = ++openChatSeqRef.current;
    setOpeningChat(true);
    try {
      const conversation = await apiPost<Conversation>(
        '/support/conversations',
        {},
        { idempotencyKey: `support-contact-open-${Date.now()}` },
      );
      if (seq !== openChatSeqRef.current || !pageVisibleRef.current) return;
      Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conversation.id}` });
    } catch (e: any) {
      if (seq !== openChatSeqRef.current || !pageVisibleRef.current) return;
      toast(e?.message || '进入会话失败');
    } finally {
      if (seq === openChatSeqRef.current && pageVisibleRef.current) {
        setOpeningChat(false);
      }
    }
  }, [openingChat]);

  const makeCall = useCallback(async () => {
    try {
      await Taro.makePhoneCall({ phoneNumber: phone });
    } catch (e: any) {
      toast(e?.message || '无法发起拨号，请手动拨打。');
    }
  }, [phone]);

  const copyPhone = useCallback(async () => {
    try {
      await Taro.setClipboardData({ data: phone });
      toast('已复制号码', { icon: 'success' });
    } catch {
      toast('复制失败');
    }
  }, [phone]);

  return (
    <View className="container settings-page">
      <PageHeader weapp back title="联系客服" subtitle="在线咨询与售后支持" />
      <Spacer />

      <TipBanner tone="info" title="服务提示">
        优先使用在线客服会话，可持续跟进问题；紧急情况可拨打客服热线。
      </TipBanner>

      <Spacer size={12} />

      <Surface className="settings-card">
        <Cell title="在线客服会话" extra={openingChat ? '连接中' : '进入'} onClick={() => void openSupportConversation()} />
        <Cell title="客服热线" extra={phone} onClick={() => void makeCall()} />
        <Cell title="复制号码" extra="复制" onClick={() => void copyPhone()} />
        <Text className="cs-hint">如遇交易纠纷，建议进入订单详情发起“争议沟通”，便于平台关联订单处理。</Text>
      </Surface>
    </View>
  );
}
