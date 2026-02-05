import { ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useMemo, useState } from 'react';

import { PageHeader } from '../../ui/layout';
import { Input } from '../../ui/nutui';
import { getIpcDataset, searchIpcClasses } from '../../lib/ipc';
import './index.scss';

export default function IpcPickerPage() {
  const data = getIpcDataset();
  const [activeSectionCode, setActiveSectionCode] = useState(data.sections[0]?.code || '');
  const [keyword, setKeyword] = useState('');

  const activeSection = useMemo(
    () => data.sections.find((s) => s.code === activeSectionCode) || data.sections[0],
    [activeSectionCode, data.sections],
  );

  const searchResults = useMemo(() => searchIpcClasses(keyword, data), [keyword, data]);
  const listItems = keyword.trim() ? searchResults : activeSection?.classes || [];

  const selectClass = (payload: { code: string; name: string }) => {
    const pages = Taro.getCurrentPages();
    const current = pages[pages.length - 1] as any;
    const channel = current?.getOpenerEventChannel?.();
    channel?.emit('ipcSelected', payload);
    Taro.navigateBack();
  };

  return (
    <View className="ipc-picker-page">
      <PageHeader back title="全部分类" brand={false} />

      <View className="ipc-picker-search">
        <Input className="ipc-picker-input" value={keyword} placeholder="搜索 IPC 分类号 / 关键词" onChange={setKeyword} clearable />
        <Text className="ipc-picker-version">{data.version}</Text>
      </View>

      <View className="ipc-picker-body">
        <ScrollView className="ipc-picker-sections" scrollY>
          {data.sections.map((section) => {
            const active = section.code === activeSectionCode;
            return (
              <View
                key={section.code}
                className={`ipc-section-item ${active ? 'is-active' : ''}`}
                onClick={() => {
                  setKeyword('');
                  setActiveSectionCode(section.code);
                }}
              >
                <Text className="ipc-section-code">{section.code}部</Text>
                <Text className="ipc-section-name">{section.name}</Text>
              </View>
            );
          })}
        </ScrollView>

        <ScrollView className="ipc-picker-list" scrollY>
          {listItems.length ? (
            listItems.map((item) => (
              <View key={`${item.code}-${item.name}`} className="ipc-class-item" onClick={() => selectClass(item)}>
                <View className="ipc-class-code">
                  <Text>{item.code}</Text>
                </View>
                <View className="ipc-class-info">
                  <Text className="ipc-class-title">
                    {item.code} {item.name}
                  </Text>
                  {'sectionCode' in item ? (
                    <Text className="ipc-class-subtitle">
                      {(item as any).sectionCode}部 {(item as any).sectionName}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <View className="ipc-empty">
              <Text className="ipc-empty-title">暂无分类数据</Text>
              <Text className="ipc-empty-subtitle">请导入 IPC 类级分类表（仅支持到“类”）。</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
