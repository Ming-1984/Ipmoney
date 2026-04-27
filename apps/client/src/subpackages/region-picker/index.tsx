import { Picker, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { STORAGE_KEYS } from '../../constants';
import { apiGet } from '../../lib/api';
import { cacheRegionNames } from '../../lib/regions';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { Button, Segmented, toast } from '../../ui/nutui';

type PickerLevel = 'province' | 'city' | 'region';
type RegionLevel = 'PROVINCE' | 'CITY' | 'DISTRICT';
type RegionNode = components['schemas']['RegionNode'];

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
  const [loading, setLoading] = useState(false);
  const [provinces, setProvinces] = useState<RegionNode[]>([]);
  const [cities, setCities] = useState<RegionNode[]>([]);
  const [districts, setDistricts] = useState<RegionNode[]>([]);
  const [provinceCode, setProvinceCode] = useState('');
  const [cityCode, setCityCode] = useState('');
  const [districtCode, setDistrictCode] = useState('');

  const provinceIndex = useMemo(() => provinces.findIndex((item) => item.code === provinceCode), [provinceCode, provinces]);
  const cityIndex = useMemo(() => cities.findIndex((item) => item.code === cityCode), [cities, cityCode]);
  const districtIndex = useMemo(() => districts.findIndex((item) => item.code === districtCode), [districtCode, districts]);

  const selectedProvince = useMemo(() => provinces.find((item) => item.code === provinceCode) || null, [provinceCode, provinces]);
  const selectedCity = useMemo(() => cities.find((item) => item.code === cityCode) || null, [cities, cityCode]);
  const selectedDistrict = useMemo(() => districts.find((item) => item.code === districtCode) || null, [districtCode, districts]);

  const selectedPathNames = useMemo(() => {
    const out: string[] = [];
    if (selectedProvince?.name) out.push(selectedProvince.name);
    if (selectedCity?.name) out.push(selectedCity.name);
    if (selectedDistrict?.name) out.push(selectedDistrict.name);
    return out;
  }, [selectedCity, selectedDistrict, selectedProvince]);

  const selectedPathCodes = useMemo(() => {
    const out: string[] = [];
    if (selectedProvince?.code) out.push(selectedProvince.code);
    if (selectedCity?.code) out.push(selectedCity.code);
    if (selectedDistrict?.code) out.push(selectedDistrict.code);
    return out;
  }, [selectedCity, selectedDistrict, selectedProvince]);

  const selectedPathByLevel = useMemo(() => {
    if (pickerLevel === 'province') {
      return {
        pathCodes: selectedProvince?.code ? [selectedProvince.code] : [],
        pathNames: selectedProvince?.name ? [selectedProvince.name] : [],
      };
    }
    if (pickerLevel === 'city') {
      const pathCodes = [selectedProvince?.code, selectedCity?.code].filter(Boolean) as string[];
      const pathNames = [selectedProvince?.name, selectedCity?.name].filter(Boolean) as string[];
      return { pathCodes, pathNames };
    }
    if (selectedDistrict?.code) {
      return { pathCodes: selectedPathCodes, pathNames: selectedPathNames };
    }
    const pathCodes = [selectedProvince?.code, selectedCity?.code].filter(Boolean) as string[];
    const pathNames = [selectedProvince?.name, selectedCity?.name].filter(Boolean) as string[];
    return { pathCodes, pathNames };
  }, [
    pickerLevel,
    selectedCity?.code,
    selectedCity?.name,
    selectedDistrict?.code,
    selectedPathCodes,
    selectedPathNames,
    selectedProvince?.code,
    selectedProvince?.name,
  ]);

  const selectedPathLabel = useMemo(() => {
    return selectedPathNames.length ? selectedPathNames.join(' / ') : '未选择';
  }, [selectedPathNames]);

  const selectedCode = useMemo(() => {
    if (pickerLevel === 'province') return selectedProvince?.code || '';
    if (pickerLevel === 'city') return selectedCity?.code || '';
    return selectedDistrict?.code || selectedCity?.code || '';
  }, [pickerLevel, selectedCity?.code, selectedDistrict?.code, selectedProvince?.code]);

  const selectedName = useMemo(() => {
    if (pickerLevel === 'province') return selectedProvince?.name || '';
    if (pickerLevel === 'city') return selectedCity?.name || '';
    return selectedDistrict?.name || selectedCity?.name || '';
  }, [pickerLevel, selectedCity?.name, selectedDistrict?.name, selectedProvince?.name]);

  const fetchRegions = useCallback(async (level: RegionLevel, parentCode?: string) => {
    const list = await apiGet<RegionNode[]>('/regions', {
      level,
      ...(parentCode ? { parentCode } : {}),
    });
    const regions = Array.isArray(list) ? list : [];
    cacheRegionNames(regions);
    return regions;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const provinceList = await fetchRegions('PROVINCE');
        if (cancelled) return;
        setProvinces(provinceList);
        const firstProvince = provinceList[0]?.code || '';
        setProvinceCode(firstProvince);
      } catch (e: any) {
        if (!cancelled) toast(e?.message || '地区数据加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchRegions]);

  useEffect(() => {
    let cancelled = false;
    if (!provinceCode) {
      setCities([]);
      setCityCode('');
      setDistricts([]);
      setDistrictCode('');
      return;
    }
    (async () => {
      try {
        const cityList = await fetchRegions('CITY', provinceCode);
        if (cancelled) return;
        setCities(cityList);
        const firstCity = cityList[0]?.code || '';
        setCityCode((prev) => (prev && cityList.some((item) => item.code === prev) ? prev : firstCity));
      } catch (e: any) {
        if (!cancelled) toast(e?.message || '城市数据加载失败');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchRegions, provinceCode]);

  useEffect(() => {
    let cancelled = false;
    if (!cityCode) {
      setDistricts([]);
      setDistrictCode('');
      return;
    }
    (async () => {
      try {
        const districtList = await fetchRegions('DISTRICT', cityCode);
        if (cancelled) return;
        setDistricts(districtList);
        const firstDistrict = districtList[0]?.code || '';
        setDistrictCode((prev) => (prev && districtList.some((item) => item.code === prev) ? prev : firstDistrict));
      } catch (e: any) {
        if (!cancelled) toast(e?.message || '区县数据加载失败');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cityCode, fetchRegions]);

  const handleLevelChange = useCallback((level: PickerLevel) => {
    setPickerLevel(level);
  }, []);

  const handleProvinceChange = useCallback(
    (event: any) => {
      const next = Number(event?.detail?.value);
      if (!Number.isFinite(next)) return;
      const selected = provinces[next];
      if (!selected?.code) return;
      setProvinceCode(selected.code);
    },
    [provinces],
  );

  const handleCityChange = useCallback(
    (event: any) => {
      const next = Number(event?.detail?.value);
      if (!Number.isFinite(next)) return;
      const selected = cities[next];
      if (!selected?.code) return;
      setCityCode(selected.code);
    },
    [cities],
  );

  const handleDistrictChange = useCallback(
    (event: any) => {
      const next = Number(event?.detail?.value);
      if (!Number.isFinite(next)) return;
      const selected = districts[next];
      if (!selected?.code) return;
      setDistrictCode(selected.code);
    },
    [districts],
  );

  const confirmPick = useCallback(() => {
    if (!selectedCode) {
      toast('请选择地区');
      return;
    }
    const payload = {
      code: selectedCode,
      name: selectedName || selectedCode,
      level: toRegionLevel(pickerLevel),
      pathCodes: selectedPathByLevel.pathCodes,
      pathNames: selectedPathByLevel.pathNames,
    };
    try {
      Taro.setStorageSync(STORAGE_KEYS.regionPickerResult, payload);
    } catch {
      // ignore storage errors
    }
    const cacheNodes = selectedPathByLevel.pathCodes
      .map((code, idx) => ({ code, name: selectedPathByLevel.pathNames[idx] || '' }))
      .filter((node) => node.code && node.name);
    cacheRegionNames(cacheNodes);
    const channel = Taro.getCurrentInstance()?.page?.getOpenerEventChannel?.();
    channel?.emit?.('regionSelected', payload);
    Taro.navigateBack();
  }, [pickerLevel, selectedCode, selectedName, selectedPathByLevel.pathCodes, selectedPathByLevel.pathNames]);

  return (
    <View className="container region-picker-page">
      <PageHeader title="选择地区" subtitle="使用系统行政区划进行省/市/区分级选择" />
      <Spacer />

      <Surface className="region-picker-card">
        <Text className="text-strong">选择层级</Text>
        <View style={{ height: '10rpx' }} />
        <Segmented value={pickerLevel} options={LEVEL_OPTIONS} onChange={(v) => handleLevelChange(v as PickerLevel)} />
      </Surface>

      <View style={{ height: '12rpx' }} />

      <Surface className="region-picker-card">
        <Text className="muted region-picker-current">当前选择：{selectedPathLabel}</Text>
        <View style={{ height: '8rpx' }} />
        <Text className="muted region-picker-tip">请依次选择省、市、区县</Text>
      </Surface>

      <View style={{ height: '12rpx' }} />

      <Picker
        mode="selector"
        range={provinces}
        rangeKey="name"
        value={provinceIndex >= 0 ? provinceIndex : 0}
        onChange={handleProvinceChange}
      >
        <Surface className="region-picker-card">
          <Text className="text-strong">省份</Text>
          <View style={{ height: '6rpx' }} />
          <Text className="muted">{selectedProvince?.name || (loading ? '加载中...' : '请选择省份')}</Text>
        </Surface>
      </Picker>

      <View style={{ height: '10rpx' }} />

      <Picker
        mode="selector"
        range={cities}
        rangeKey="name"
        value={cityIndex >= 0 ? cityIndex : 0}
        onChange={handleCityChange}
      >
        <Surface className="region-picker-card">
          <Text className="text-strong">城市</Text>
          <View style={{ height: '6rpx' }} />
          <Text className="muted">{selectedCity?.name || '请选择城市'}</Text>
        </Surface>
      </Picker>

      <View style={{ height: '10rpx' }} />

      <Picker
        mode="selector"
        range={districts}
        rangeKey="name"
        value={districtIndex >= 0 ? districtIndex : 0}
        onChange={handleDistrictChange}
      >
        <Surface className="region-picker-card">
          <Text className="text-strong">区县</Text>
          <View style={{ height: '6rpx' }} />
          <Text className="muted">{selectedDistrict?.name || '可选区县（无则按城市）'}</Text>
        </Surface>
      </Picker>

      <View style={{ height: '16rpx' }} />

      <Surface className="region-picker-actions">
        <Button className="region-picker-confirm" onClick={confirmPick} disabled={!selectedCode}>
          确认选择
        </Button>
      </Surface>
    </View>
  );
}
