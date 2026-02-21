import { Switch, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import { apiDelete, apiGet, apiPatch, apiPost } from '../../../lib/api';
import { usePageAccess } from '../../../lib/guard';
import { AccessGate } from '../../../ui/PageState';
import { PageHeader, Spacer, Surface } from '../../../ui/layout';
import { Button, Input, confirm, toast } from '../../../ui/nutui';
import { ErrorCard, LoadingCard } from '../../../ui/StateCards';

type Address = {
  id: string;
  name: string;
  phone: string;
  regionCode?: string | null;
  addressLine: string;
  isDefault?: boolean;
};

export default function AddressEditPage() {
  const access = usePageAccess('login-required');
  const router = Taro.getCurrentInstance().router;
  const addressId = useMemo(() => String(router?.params?.id || '').trim(), [router?.params?.id]);
  const isEdit = Boolean(addressId);

  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const load = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    setError(null);
    try {
      const list = await apiGet<Address[]>('/me/addresses');
      const current = (list || []).find((item) => item.id === addressId);
      if (!current) {
        setError('地址不存在或已删除');
        return;
      }
      setName(current.name || '');
      setPhone(current.phone || '');
      setRegionCode(current.regionCode || '');
      setAddressLine(current.addressLine || '');
      setIsDefault(Boolean(current.isDefault));
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [addressId, isEdit]);

  useEffect(() => {
    if (access.state !== 'ok') return;
    void load();
  }, [access.state, load]);

  if (access.state !== 'ok') {
    return (
      <View className="container address-edit-page">
        <PageHeader weapp back title={isEdit ? '编辑地址' : '新增地址'} />
        <Spacer />
        <AccessGate access={access} />
      </View>
    );
  }

  const payload = useMemo(
    () => ({
      name: name.trim(),
      phone: phone.trim(),
      regionCode: regionCode.trim() || null,
      addressLine: addressLine.trim(),
      isDefault,
    }),
    [addressLine, isDefault, name, phone, regionCode],
  );

  const validate = useCallback(() => {
    if (!payload.name) {
      toast('请填写收货人');
      return false;
    }
    if (!payload.phone) {
      toast('请填写手机号');
      return false;
    }
    if (!payload.addressLine) {
      toast('请填写详细地址');
      return false;
    }
    return true;
  }, [payload]);

  const save = useCallback(async () => {
    if (!validate()) return;
    try {
      if (isEdit) {
        await apiPatch(`/me/addresses/${addressId}`, payload);
      } else {
        await apiPost('/me/addresses', payload);
      }
      toast('保存成功', { icon: 'success' });
      Taro.navigateBack();
    } catch (e: any) {
      toast(e?.message || '保存失败', { icon: 'fail' });
    }
  }, [addressId, isEdit, payload, validate]);

  const remove = useCallback(async () => {
    if (!isEdit) return;
    const ok = await confirm({
      title: '确认删除地址？',
      content: '删除后无法恢复',
      confirmText: '删除',
      cancelText: '取消',
    });
    if (!ok) return;
    try {
      await apiDelete(`/me/addresses/${addressId}`);
      toast('已删除', { icon: 'success' });
      Taro.navigateBack();
    } catch (e: any) {
      toast(e?.message || '删除失败', { icon: 'fail' });
    }
  }, [addressId, isEdit]);

  if (loading) {
    return (
      <View className="container address-edit-page">
        <PageHeader weapp back title="编辑地址" />
        <Spacer />
        <LoadingCard text="地址加载中" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="container address-edit-page">
        <PageHeader weapp back title="编辑地址" />
        <Spacer />
        <ErrorCard message={error} onRetry={load} />
      </View>
    );
  }

  return (
    <View className="container address-edit-page">
      <PageHeader weapp back title={isEdit ? '编辑地址' : '新增地址'} subtitle="用于合同寄送/收货" />
      <Spacer />

      <Surface className="address-form-card">
        <View className="form-field">
          <Text className="form-label">收货人</Text>
          <Input value={name} onChange={setName} placeholder="请填写收货人姓名" clearable />
        </View>
        <View className="form-field">
          <Text className="form-label">手机号</Text>
          <Input value={phone} onChange={setPhone} placeholder="请填写手机号" type="digit" clearable />
        </View>
        <View className="form-field">
          <Text className="form-label">地区编码（可选）</Text>
          <Input value={regionCode} onChange={setRegionCode} placeholder="例如：310000" clearable />
        </View>
        <View className="form-field">
          <Text className="form-label">详细地址</Text>
          <Input value={addressLine} onChange={setAddressLine} placeholder="街道/门牌号" clearable />
        </View>
        <View className="form-field form-switch">
          <Text className="form-label">设为默认</Text>
          <Switch checked={isDefault} onChange={(e) => setIsDefault(Boolean(e.detail.value))} />
        </View>
      </Surface>

      <View className="address-form-actions">
        <Button onClick={() => void save()}>保存</Button>
        {isEdit ? (
          <Button variant="danger" onClick={() => void remove()}>
            删除地址
          </Button>
        ) : null}
      </View>
    </View>
  );
}
