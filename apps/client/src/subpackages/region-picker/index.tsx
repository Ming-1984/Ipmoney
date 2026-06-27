import { Picker, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import './index.scss';

import { STORAGE_KEYS } from '../../constants';
import {
  cacheRegionNames,
  formatRegionPathNames,
  parseRegionPickerSelection,
  regionDisplayName,
  type RegionPickerSelection,
} from '../../lib/regions';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { Button, toast } from '../../ui/nutui';

function readInitialSelection(): RegionPickerSelection | null {
  try {
    return parseRegionPickerSelection({
      detail: Taro.getStorageSync(STORAGE_KEYS.regionPickerResult),
    });
  } catch {
    return null;
  }
}

export default function RegionPickerPage() {
  const [selectedRegion, setSelectedRegion] = useState<RegionPickerSelection | null>(() => readInitialSelection());

  const selectedPathLabel = useMemo(() => {
    if (selectedRegion?.pathNames?.length) {
      return formatRegionPathNames(selectedRegion.pathNames);
    }
    return regionDisplayName(selectedRegion?.code, selectedRegion?.name, '\u672a\u9009\u62e9');
  }, [selectedRegion]);

  const handleRegionChange = useCallback((event: any) => {
    const parsed = parseRegionPickerSelection(event);
    if (!parsed) {
      toast('\u5730\u533a\u8bfb\u53d6\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5');
      return;
    }
    cacheRegionNames(
      parsed.pathCodes.map((code, index) => ({
        code,
        name: parsed.pathNames[index] || '',
      })),
    );
    setSelectedRegion(parsed);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRegion(null);
  }, []);

  const confirmPick = useCallback(() => {
    if (!selectedRegion?.code) {
      toast('\u8bf7\u9009\u62e9\u5730\u533a');
      return;
    }
    const payload = {
      code: selectedRegion.code,
      name: selectedRegion.name || selectedRegion.code,
      level: selectedRegion.level,
      pathCodes: selectedRegion.pathCodes,
      pathNames: selectedRegion.pathNames,
    };
    try {
      Taro.setStorageSync(STORAGE_KEYS.regionPickerResult, payload);
    } catch {
      // ignore storage errors
    }
    cacheRegionNames(
      payload.pathCodes.map((code, index) => ({
        code,
        name: payload.pathNames[index] || '',
      })),
    );
    const channel = Taro.getCurrentInstance()?.page?.getOpenerEventChannel?.();
    channel?.emit?.('regionSelected', payload);
    Taro.navigateBack();
  }, [selectedRegion]);

  return (
    <View className="container region-picker-page">
      <PageHeader title={'\u9009\u62e9\u5730\u533a'} />
      <Spacer />

      <Surface className="region-picker-card">
        <Text className="text-strong">{'\u5730\u533a'}</Text>
        <View style={{ height: '10rpx' }} />
        <Picker mode="region" onChange={handleRegionChange}>
          <View className="region-picker-field">
            <View className="region-picker-field-main">
              <Text className={selectedRegion?.code ? 'region-picker-value' : 'region-picker-placeholder'}>
                {selectedRegion?.code ? selectedPathLabel : '\u8bf7\u9009\u62e9\u5730\u533a'}
              </Text>
              <Text className="region-picker-arrow">{'>'}</Text>
            </View>
            <Text className="muted region-picker-tip">
              {'\u6309\u7167\u6807\u51c6\u884c\u653f\u533a\u5212\u8fdb\u884c\u9009\u62e9'}
            </Text>
          </View>
        </Picker>
        {selectedRegion?.code ? (
          <Text className="region-picker-clear" onClick={clearSelection}>
            {'\u6e05\u7a7a\u5f53\u524d\u9009\u62e9'}
          </Text>
        ) : null}
      </Surface>

      <View style={{ height: '12rpx' }} />

      <Surface className="region-picker-card">
        <Text className="muted region-picker-current">
          {'\u5f53\u524d\u9009\u62e9\uff1a'}
          {selectedPathLabel}
        </Text>
      </Surface>

      <View style={{ height: '16rpx' }} />

      <Surface className="region-picker-actions">
        <Button className="region-picker-confirm" onClick={confirmPick} disabled={!selectedRegion?.code}>
          {'\u786e\u8ba4\u9009\u62e9'}
        </Button>
      </Surface>
    </View>
  );
}
