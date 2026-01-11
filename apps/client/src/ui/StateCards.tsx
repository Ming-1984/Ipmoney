import { View, Text } from '@tarojs/components';
import React from 'react';

export function LoadingCard(props: { text?: string }) {
  return (
    <View className="card">
      <Text className="muted">{props.text || '加载中…'}</Text>
    </View>
  );
}

export function ErrorCard(props: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <View className="card">
      <Text style={{ fontWeight: 700 }}>{props.title || '加载失败'}</Text>
      <View style={{ height: '8rpx' }} />
      <Text className="muted">{props.message || '请稍后重试'}</Text>
      {props.onRetry ? (
        <>
          <View style={{ height: '12rpx' }} />
          <View className="btn-primary" onClick={props.onRetry}>
            <Text>重试</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

export function EmptyCard(props: {
  title?: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
}) {
  return (
    <View className="card">
      <Text style={{ fontWeight: 700 }}>{props.title || '暂无数据'}</Text>
      {props.message ? (
        <>
          <View style={{ height: '8rpx' }} />
          <Text className="muted">{props.message}</Text>
        </>
      ) : null}
      {props.actionText && props.onAction ? (
        <>
          <View style={{ height: '12rpx' }} />
          <View className="btn-primary" onClick={props.onAction}>
            <Text>{props.actionText}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}
