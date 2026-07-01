import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React from 'react';
import './index.scss';

export default function MyPatentsCompatPage() {
  useDidShow(() => {
    Taro.redirectTo({ url: '/subpackages/my-listings/index' });
  });

  return (
    <View className="my-patents-compat-page">
      <Text className="my-patents-compat-text">正在打开我的专利...</Text>
    </View>
  );
}
