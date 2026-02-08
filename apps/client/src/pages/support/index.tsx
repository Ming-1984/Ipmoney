import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useState } from 'react';
import './index.scss';

import { PageHeader, Spacer, Surface, TipBanner } from '../../ui/layout';
import { Cell, Button, Input, TextArea } from '../../ui/nutui';

export default function SupportPage() {
  const [contact, setContact] = useState('');
  const [content, setContent] = useState('');

  const submitFeedback = useCallback(() => {
    if (!content.trim()) {
      Taro.showToast({ title: '请填写反馈内容', icon: 'none' });
      return;
    }
    Taro.showToast({ title: '已提交反馈', icon: 'success' });
    setContent('');
    setContact('');
  }, [content]);

  return (
    <View className="container settings-page">
      <PageHeader weapp back title="帮助与反馈" subtitle="常见问题与意见反馈" />
      <Spacer />

      <TipBanner tone="info" title="服务提示">
        客服工作时间：工作日 09:00-18:00，非工作时间可提交意见反馈，我们将尽快处理。
      </TipBanner>

      <Spacer size={12} />

      <Surface className="settings-card">
        <Cell title="常见问题" extra="查看" onClick={() => Taro.navigateTo({ url: '/pages/support/faq/index' })} />
        <Cell title="联系客服" extra="电话" onClick={() => Taro.navigateTo({ url: '/pages/support/contact/index' })} />
        <Cell title="交易规则" extra="查看" onClick={() => Taro.navigateTo({ url: '/pages/trade-rules/index' })} />
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
          placeholder="请描述你的问题或建议"
          maxLength={500}
        />
        <Button variant="primary" onClick={submitFeedback}>
          提交反馈
        </Button>
        <Text className="settings-tip-text">
          请尽量描述问题环境与操作步骤，以便我们更快定位。
        </Text>
      </Surface>
    </View>
  );
}
