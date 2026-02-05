import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useEffect, useMemo, useState } from 'react';
import './index.scss';

import { formatTimeSmart } from '../../lib/format';
import { useRouteStringParam } from '../../lib/routeParams';
import { PageHeader, Spacer, Surface } from '../../ui/layout';

import { NOTIFICATIONS } from './data';

type NoticeTab = 'system' | 'cs';

const TABS: { id: NoticeTab; label: string }[] = [
  { id: 'system', label: '系统通知' },
  { id: 'cs', label: '客服通知' },
];

export default function NotificationsPage() {
  const tabParam = useRouteStringParam('tab');
  const [activeTab, setActiveTab] = useState<NoticeTab>('system');

  useEffect(() => {
    if (tabParam === 'system' || tabParam === 'cs') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const items = useMemo(() => {
    return NOTIFICATIONS.filter((item) => item.kind === activeTab);
  }, [activeTab]);

  return (
    <View className="container notifications-page">
      <PageHeader weapp back title="通知" />
      <Spacer />

      <View className="notifications-tabs">
        {TABS.map((tab) => (
          <View
            key={tab.id}
            className={`notifications-tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <Text>{tab.label}</Text>
            {activeTab === tab.id ? <View className="notifications-tab-underline" /> : null}
          </View>
        ))}
      </View>

      <View className="notifications-list">
        {items.map((item) => (
          <Surface
            key={item.id}
            className="notification-item"
            padding="none"
            onClick={() => {
              Taro.navigateTo({ url: `/pages/notifications/detail/index?id=${item.id}` });
            }}
          >
            <View className="notification-item-header">
              <View className={`notification-tag ${item.kind === 'system' ? 'is-system' : 'is-cs'}`}>
                <Text>{item.kind === 'system' ? '系统' : '客服'}</Text>
              </View>
              <Text className="notification-time">{formatTimeSmart(item.time)}</Text>
            </View>
            <View className="notification-body">
              <Text className="notification-title">{item.title}</Text>
              <Text className="notification-summary">{item.summary}</Text>
            </View>
            <Text className="notification-source">{item.source}</Text>
          </Surface>
        ))}
        {!items.length ? (
          <Surface className="notification-empty" padding="none">
            <Text className="notification-empty-title">暂无通知</Text>
            <Text className="notification-empty-desc">稍后有新消息会展示在这里。</Text>
          </Surface>
        ) : null}
      </View>
    </View>
  );
}
