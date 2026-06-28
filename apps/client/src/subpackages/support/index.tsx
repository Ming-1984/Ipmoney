import { Text, View } from '@tarojs/components';
import ArrowRight from '@nutui/icons-react-taro/dist/es/icons/ArrowRight';
import Link from '@nutui/icons-react-taro/dist/es/icons/Link';
import Message from '@nutui/icons-react-taro/dist/es/icons/Message';
import Phone2 from '@nutui/icons-react-taro/dist/es/icons/Phone2';
import Tips from '@nutui/icons-react-taro/dist/es/icons/Tips';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import React, { useCallback, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiPost } from '../../lib/api';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { Input, TextArea } from '../../ui/nutui';

type Conversation = components['schemas']['Conversation'];

const feedbackTextStyle = { fontSize: '25rpx', color: '#374151', lineHeight: '1.55' };
const feedbackPlaceholderStyle = 'font-size:25rpx;color:#d6dbe3;';

type ServiceItem = {
  key: 'faq' | 'chat' | 'phone' | 'rules';
  title: string;
  subtitle: string;
  action: string;
  tone: 'blue' | 'green' | 'orange' | 'purple';
  Icon: React.ComponentType<any>;
  onClick: () => unknown;
};

export default function SupportPage() {
  const [contact, setContact] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pageVisibleRef = useRef(true);
  const actionSeqRef = useRef(0);

  useDidShow(() => {
    pageVisibleRef.current = true;
  });

  useDidHide(() => {
    pageVisibleRef.current = false;
    actionSeqRef.current += 1;
    setSubmitting(false);
  });

  const openSupportConversation = useCallback(async () => {
    if (submitting) return;
    const seq = ++actionSeqRef.current;
    setSubmitting(true);
    try {
      const conversation = await apiPost<Conversation>(
        '/support/conversations',
        {},
        { idempotencyKey: `support-open-${Date.now()}` },
      );
      if (seq !== actionSeqRef.current || !pageVisibleRef.current) return;
      Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conversation.id}` });
    } catch (e: any) {
      if (seq !== actionSeqRef.current || !pageVisibleRef.current) return;
      Taro.showToast({ title: e?.message || '进入客服会话失败', icon: 'none' });
    } finally {
      if (seq === actionSeqRef.current && pageVisibleRef.current) {
        setSubmitting(false);
      }
    }
  }, [submitting]);

  const submitFeedback = useCallback(async () => {
    if (!content.trim()) {
      Taro.showToast({ title: '请填写反馈内容', icon: 'none' });
      return;
    }
    if (submitting) return;
    const seq = ++actionSeqRef.current;
    setSubmitting(true);
    try {
      const conversation = await apiPost<Conversation>(
        '/support/conversations',
        {},
        { idempotencyKey: `support-feedback-open-${Date.now()}` },
      );
      const feedbackText = contact.trim()
        ? `联系方式：${contact.trim()}\n反馈内容：${content.trim()}`
        : content.trim();
      await apiPost(
        `/conversations/${conversation.id}/messages`,
        { type: 'TEXT', text: feedbackText },
        { idempotencyKey: `support-feedback-send-${Date.now()}` },
      );
      if (seq !== actionSeqRef.current || !pageVisibleRef.current) return;
      setContent('');
      setContact('');
      Taro.showToast({ title: '已提交，正在进入会话', icon: 'success' });
      Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conversation.id}` });
    } catch (e: any) {
      if (seq !== actionSeqRef.current || !pageVisibleRef.current) return;
      Taro.showToast({ title: e?.message || '提交失败', icon: 'none' });
    } finally {
      if (seq === actionSeqRef.current && pageVisibleRef.current) {
        setSubmitting(false);
      }
    }
  }, [contact, content, submitting]);

  const serviceItems: ServiceItem[] = [
    {
      key: 'faq',
      title: '常见问题',
      subtitle: '浏览高频问题解答',
      action: '查看',
      tone: 'blue',
      Icon: Tips,
      onClick: () => Taro.navigateTo({ url: '/subpackages/support/faq/index' }),
    },
    {
      key: 'chat',
      title: '在线客服会话',
      subtitle: '实时在线，快速响应',
      action: '进入',
      tone: 'green',
      Icon: Message,
      onClick: openSupportConversation,
    },
    {
      key: 'phone',
      title: '电话客服',
      subtitle: '工作日 09:00-18:00',
      action: '热线',
      tone: 'orange',
      Icon: Phone2,
      onClick: () => Taro.navigateTo({ url: '/subpackages/support/contact/index' }),
    },
    {
      key: 'rules',
      title: '交易规则',
      subtitle: '了解平台交易规范',
      action: '查看',
      tone: 'purple',
      Icon: Link,
      onClick: () => Taro.navigateTo({ url: '/subpackages/trade-rules/index' }),
    },
  ];
  const feedbackDisabled = submitting || !content.trim();

  return (
    <View className="container settings-page support-page">
      <PageHeader weapp back title="客服中心" subtitle="常见问题与意见反馈" />

      <View className="support-hero">
        <Text className="support-hero-kicker">Help Center</Text>
        <Text className="support-hero-title">客服中心</Text>
        <Text className="support-hero-subtitle">有任何问题，我们随时为您服务</Text>
      </View>

      <View className="support-notice">
        <View className="support-notice-icon">
          <Tips size={16} color="#eb5c20" />
        </View>
        <View className="support-notice-body">
          <Text className="support-notice-title">服务提示</Text>
          <Text className="support-notice-text">
            客服工作时间：工作日 09:00-18:00。非工作时间可提交意见反馈，我们会尽快处理。
          </Text>
        </View>
      </View>

      <Spacer size={12} />

      <Surface className="support-card support-menu" padding="none">
        {serviceItems.map((item) => {
          const Icon = item.Icon;
          return (
            <View key={item.key} className="support-menu-row" onClick={() => void item.onClick()}>
              <View className={`support-menu-icon support-menu-icon-${item.tone}`}>
                <Icon size={20} />
              </View>
              <View className="support-menu-copy">
                <Text className="support-menu-title">{item.title}</Text>
                <Text className="support-menu-subtitle">{item.subtitle}</Text>
              </View>
              <View className="support-menu-action">
                <Text className={`support-menu-pill support-menu-pill-${item.tone}`}>
                  {item.key === 'chat' && submitting ? '连接中' : item.action}
                </Text>
                <ArrowRight size={14} color="#c8ccd3" />
              </View>
            </View>
          );
        })}
      </Surface>

      <Spacer size={12} />

      <Surface className="support-card support-feedback">
        <View className="feedback-heading">
          <View className="feedback-heading-accent" />
          <Text className="feedback-title">意见反馈</Text>
        </View>

        <View className="feedback-field feedback-field-inline">
          <View className="feedback-phone-icon" />
          <Input
            className="feedback-input"
            value={contact}
            onChange={setContact}
            placeholder="请输入联系方式（可选）"
            placeholderStyle={feedbackPlaceholderStyle}
            clearable
          />
        </View>

        <View className="feedback-field feedback-textarea-wrap">
          <TextArea
            className="feedback-textarea"
            value={content}
            onChange={setContent}
            placeholder="请描述你遇到的问题或建议"
            placeholderStyle={feedbackPlaceholderStyle}
            style={feedbackTextStyle}
            maxLength={500}
          />
          <View className="feedback-count">
            <Text>{content.length}/500</Text>
          </View>
        </View>

        <View
          className={`feedback-submit${feedbackDisabled ? ' feedback-submit-disabled' : ''}`}
          onClick={() => {
            if (feedbackDisabled) return;
            void submitFeedback();
          }}
        >
          <View className="feedback-submit-icon" />
          <Text className="feedback-submit-text">{submitting ? '提交中' : '提交反馈'}</Text>
        </View>
        <Text className="settings-tip-text">提交后会自动进入持续会话，后续可在消息页继续沟通。</Text>
      </Surface>
    </View>
  );
}
