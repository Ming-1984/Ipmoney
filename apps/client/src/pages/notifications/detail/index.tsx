import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useMemo } from 'react';
import './index.scss';

import { formatTimeSmart } from '../../../lib/format';
import { useRouteStringParam } from '../../../lib/routeParams';
import { PageHeader, Spacer, Surface } from '../../../ui/layout';
import { Button } from '../../../ui/nutui';

import { getNotificationById } from '../data';

export default function NotificationDetailPage() {
  const id = useRouteStringParam('id');
  const item = useMemo(() => getNotificationById(id), [id]);

  return (
    <View className="container notification-detail-page">
      <PageHeader weapp back title="通知详情" subtitle="系统与客服消息" />
      <Spacer />

      {item ? (
        <>
          <Surface className="notification-detail-card" padding="none">
            <View className="notification-detail-header">
              <View className={`notification-detail-tag ${item.kind === 'system' ? 'is-system' : 'is-cs'}`}>
                <Text>{item.kind === 'system' ? '系统通知' : '客服通知'}</Text>
              </View>
              <Text className="notification-detail-time">{formatTimeSmart(item.time)}</Text>
            </View>
            <Text className="notification-detail-title">{item.title}</Text>
            <Text className="notification-detail-source">来源：{item.source}</Text>
            <View className="notification-detail-content">
              {item.content.map((line, idx) => (
                <Text key={`${item.id}-${idx}`} className="notification-detail-paragraph">
                  {line}
                </Text>
              ))}
            </View>
          </Surface>

          {item.related ? (
            <Surface
              className="notification-detail-related"
              padding="none"
              onClick={() => {
                Taro.navigateTo({ url: item.related?.url || '/pages/home/index' });
              }}
            >
              <View className="notification-related-left">
                <Text className="notification-related-title">{item.related.label}</Text>
                <Text className="notification-related-desc">点击进入对应页面查看详情</Text>
              </View>
              <Text className="notification-related-link">查看</Text>
            </Surface>
          ) : null}
        </>
      ) : (
        <Surface className="notification-detail-empty" padding="none">
          <Text className="notification-detail-empty-title">未找到对应通知</Text>
          <Text className="notification-detail-empty-desc">通知可能已被清理或不存在。</Text>
          <Button
            className="notification-detail-empty-btn"
            type="primary"
            onClick={() => Taro.navigateBack()}
          >
            返回
          </Button>
        </Surface>
      )}
    </View>
  );
}
