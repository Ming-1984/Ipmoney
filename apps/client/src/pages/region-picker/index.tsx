import { Picker, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';

import { STORAGE_KEYS } from '../../constants';
import { cacheRegionNames } from '../../lib/regions';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { Button, Segmented, toast } from '../../ui/nutui';

type PickerLevel = 'province' | 'city' | 'region';
type RegionLevel = 'PROVINCE' | 'CITY' | 'DISTRICT';

const LEVEL_OPTIONS: Array<{ label: string; value: PickerLevel }> = [
  { label: '省', value: 'province' },
  { label: '市', value: 'city' },
  { label: '区', value: 'region' },
];

function toRegionLevel(level: PickerLevel): RegionLevel {
  if (level === 'province') return 'PROVINCE';
  if (level === 'city') return 'CITY';
  return 'DISTRICT';
}

export default function RegionPickerPage() {
  const [pickerLevel, setPickerLevel] = useState<PickerLevel>('region');
  const [pathNames, setPathNames] = useState<string[]>([]);
  const [pathCodes, setPathCodes] = useState<string[]>([]);

  const selectedPathLabel = useMemo(() => {
    const names = pathNames.map((name) => String(name || '').trim()).filter(Boolean);
    return names.length ? names.join(' / ') : '未选择';
  }, [pathNames]);

  const selectedCode = useMemo(() => {
    const codes = pathCodes.map((code) => String(code || '').trim()).filter(Boolean);
    return codes[codes.length - 1] || '';
  }, [pathCodes]);

  const selectedName = useMemo(() => {
    const names = pathNames.map((name) => String(name || '').trim()).filter(Boolean);
    return names[names.length - 1] || '';
  }, [pathNames]);

  const handleChange = useCallback((e: any) => {
    const names = Array.isArray(e?.detail?.value) ? e.detail.value : [];
    const codes = Array.isArray(e?.detail?.code) ? e.detail.code : [];
    setPathNames(names);
    setPathCodes(codes);
  }, []);

  const handleLevelChange = useCallback((level: PickerLevel) => {
    setPickerLevel(level);
    setPathNames([]);
    setPathCodes([]);
  }, []);

  const confirmPick = useCallback(() => {
    if (!selectedCode) {
      toast('请选择地区');
      return;
    }
    const normalizedNames = pathNames.map((name) => String(name || '').trim()).filter(Boolean);
    const normalizedCodes = pathCodes.map((code) => String(code || '').trim()).filter(Boolean);
    const payload = {
      code: selectedCode,
      name: selectedName || selectedCode,
      level: toRegionLevel(pickerLevel),
      pathCodes: normalizedCodes,
      pathNames: normalizedNames,
    };
    try {
      Taro.setStorageSync(STORAGE_KEYS.regionPickerResult, payload);
    } catch {
      // ignore
    }
    const cacheNodes = normalizedCodes
      .map((code, idx) => ({ code, name: normalizedNames[idx] || '' }))
      .filter((node) => node.code && node.name);
    cacheRegionNames(cacheNodes);
    const channel = Taro.getCurrentInstance()?.page?.getOpenerEventChannel?.();
    channel?.emit?.('regionSelected', payload);
    Taro.navigateBack();
  }, [pathCodes, pathNames, pickerLevel, selectedCode, selectedName]);

  return (
    <View className="container">
      <PageHeader title="选择地区" subtitle="使用系统区域库进行省/市/区分级选择" />
      <Spacer />

      <Surface>
        <Text className="text-strong">选择层级</Text>
        <View style={{ height: '10rpx' }} />
        <Segmented value={pickerLevel} options={LEVEL_OPTIONS} onChange={(v) => handleLevelChange(v as PickerLevel)} />
      </Surface>

      <View style={{ height: '12rpx' }} />

      <Picker mode="region" level={pickerLevel} value={pathNames} onChange={handleChange}>
        <Surface>
          <Text className="muted">当前选择：{selectedPathLabel}</Text>
          <View style={{ height: '6rpx' }} />
          <Text className="muted">点击此处选择地区</Text>
        </Surface>
      </Picker>

      <View style={{ height: '16rpx' }} />

      <Surface>
        <Button onClick={confirmPick} disabled={!selectedCode}>
          确认选择
        </Button>
      </Surface>
    </View>
  );
}
