import { View, Text } from '@tarojs/components';
import React from 'react';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[client] render error', error, info);
  }

  render() {
    const error = this.state.error;
    if (!error) return this.props.children;

    return (
      <View className="container">
        <View className="card">
          <Text className="text-title">页面渲染异常</Text>
          <View style={{ height: '8rpx' }} />
          <Text className="text-subtitle">请刷新页面；若仍复现，把错误信息发我用于排查。</Text>
          <View style={{ height: '12rpx' }} />
          <View className="card" style={{ background: '#fff', borderRadius: '16rpx', padding: '16rpx' }}>
            <Text style={{ fontFamily: 'monospace', fontSize: '22rpx', color: '#991b1b' }}>
              {String(error?.message || error)}
            </Text>
          </View>
        </View>
      </View>
    );
  }
}
