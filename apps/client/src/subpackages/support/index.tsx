import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiPost } from '../../lib/api';
import { PageHeader, Spacer, Surface, TipBanner } from '../../ui/layout';
import { Button, Cell, Input, TextArea } from '../../ui/nutui';

type Conversation = components['schemas']['Conversation'];

export default function SupportPage() {
  const [contact, setContact] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const openSupportConversation = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const conversation = await apiPost<Conversation>(
        '/support/conversations',
        {},
        { idempotencyKey: `support-open-${Date.now()}` },
      );
      Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conversation.id}` });
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '进入客服会话失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [submitting]);

  const submitFeedback = useCallback(async () => {
    if (!content.trim()) {
      Taro.showToast({ title: '请填写反馈内容', icon: 'none' });
      return;
    }
    if (submitting) return;
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
      setContent('');
      setContact('');
      Taro.showToast({ title: '已提交，正在进入会话', icon: 'success' });
      Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conversation.id}` });
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '提交失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [contact, content, submitting]);

  return (
    <View className="container settings-page">
      <PageHeader weapp back title="帮助与反馈" subtitle="常见问题与意见反馈" />
      <Spacer />

      <TipBanner tone="info" title="服务提示">
        客服工作时间：工作日 09:00-18:00。非工作时间可提交意见反馈，我们会尽快处理。
      </TipBanner>

      <Spacer size={12} />

      <Surface className="settings-card">
        <Cell title="常见问题" extra="查看" onClick={() => Taro.navigateTo({ url: '/subpackages/support/faq/index' })} />
        <Cell title="在线客服会话" extra="进入" onClick={() => void openSupportConversation()} />
        <Cell title="电话客服" extra="热线" onClick={() => Taro.navigateTo({ url: '/subpackages/support/contact/index' })} />
        <Cell title="交易规则" extra="查看" onClick={() => Taro.navigateTo({ url: '/subpackages/trade-rules/index' })} />
      </Surface>

      <Spacer size={12} />

      <Surface className="settings-card">
        <View className="feedback-title">意见反馈</View>
        <Input
          className="feedback-input"
          value={contact}
          onChange={setContact}
          placeholder="请输入联系方式（可选）"
          clearable
        />
        <TextArea
          className="feedback-textarea"
          value={content}
          onChange={setContent}
          placeholder="请描述你遇到的问题或建议"
          maxLength={500}
        />
        <Button variant="primary" loading={submitting} disabled={submitting} onClick={() => void submitFeedback()}>
          提交反馈
        </Button>
        <Text className="settings-tip-text">提交后会自动进入持续会话，后续可在消息页继续沟通。</Text>
      </Surface>
    </View>
  );
}
