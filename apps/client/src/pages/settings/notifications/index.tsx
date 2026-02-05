import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState } from 'react';
import './index.scss';

import { PageHeader, Spacer, Surface } from '../../../ui/layout';
import { Segmented, toast } from '../../../ui/nutui';

const TOGGLE_OPTIONS = [
  { label: '开启', value: 'on' },
  { label: '关闭', value: 'off' },
];

type ToggleValue = 'on' | 'off';

export default function NotificationSettingsPage() {
  const [orderNotify, setOrderNotify] = useState<ToggleValue>('on');
  const [auditNotify, setAuditNotify] = useState<ToggleValue>('on');
  const [replyNotify, setReplyNotify] = useState<ToggleValue>('on');

  return (
    <View className="container settings-page">
      <PageHeader weapp back title="通知设置" subtitle="订阅消息仅在允许后生效" />
      <Spacer />

      <Surface className="settings-card">
        <View className="settings-row">
          <View className="settings-meta">
            <Text className="settings-title">订单进度通知</Text>
            <Text className="settings-desc">订金、尾款、变更等节点提醒</Text>
          </View>
          <Segmented value={orderNotify} options={TOGGLE_OPTIONS} onChange={(v) => setOrderNotify(v as ToggleValue)} />
        </View>

        <View className="settings-divider" />

        <View className="settings-row">
          <View className="settings-meta">
            <Text className="settings-title">审核结果通知</Text>
            <Text className="settings-desc">认证、上架审核结果提醒</Text>
          </View>
          <Segmented value={auditNotify} options={TOGGLE_OPTIONS} onChange={(v) => setAuditNotify(v as ToggleValue)} />
        </View>

        <View className="settings-divider" />

        <View className="settings-row">
          <View className="settings-meta">
            <Text className="settings-title">留言回复通知</Text>
            <Text className="settings-desc">评论/留言收到回复提醒</Text>
          </View>
          <Segmented value={replyNotify} options={TOGGLE_OPTIONS} onChange={(v) => setReplyNotify(v as ToggleValue)} />
        </View>
      </Surface>

      <Spacer size={12} />
      <Surface className="settings-tip">
        <Text className="settings-tip-text">
          关闭仅影响站外通知，站内消息仍可查看。如需变更订阅权限，请在微信系统设置中调整。
        </Text>
        <Text className="settings-tip-link" onClick={() => toast('请在微信系统设置中管理订阅权限', { icon: 'success' })}>
          查看订阅说明
        </Text>
      </Surface>
    </View>
  );
}
