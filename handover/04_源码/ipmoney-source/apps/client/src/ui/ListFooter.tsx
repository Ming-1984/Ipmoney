import { View, Text } from '@tarojs/components';
import React from 'react';

import { Button } from './nutui';

export function ListFooter(props: {
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  noMoreText?: string;
  showNoMore?: boolean;
}) {
  const showNoMore = props.showNoMore ?? true;

  return (
    <View className="list-footer">
      {props.hasMore ? (
        <Button variant="ghost" size="small" block={false} loading={props.loadingMore} onClick={props.onLoadMore}>
          加载更多
        </Button>
      ) : showNoMore ? (
        <Text className="list-footer-text">{props.noMoreText ?? '已到底'}</Text>
      ) : null}
    </View>
  );
}
