import { Switch, Text, View } from '@tarojs/components';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import { apiDelete, apiGet, apiPatch, apiPost } from '../../../lib/api';
import { usePageAccess } from '../../../lib/guard';
import { openRegionPickerPage } from '../../../lib/regionPicker';
import { regionDisplayName } from '../../../lib/regions';
import { useRouteStringParam } from '../../../lib/routeParams';
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

const TEXT = {
  editTitle: '\u7f16\u8f91\u5730\u5740',
  createTitle: '\u65b0\u589e\u5730\u5740',
  subtitle: '\u7528\u4e8e\u5408\u540c\u5bc4\u9001\u548c\u6536\u8d27',
  missingAddress: '\u5730\u5740\u4e0d\u5b58\u5728\u6216\u5df2\u5220\u9664',
  loadFailed: '\u52a0\u8f7d\u5931\u8d25',
  nameRequired: '\u8bf7\u586b\u5199\u6536\u8d27\u4eba',
  phoneRequired: '\u8bf7\u586b\u5199\u624b\u673a\u53f7',
  lineRequired: '\u8bf7\u586b\u5199\u8be6\u7ec6\u5730\u5740',
  saveSuccess: '\u4fdd\u5b58\u6210\u529f',
  saveFailed: '\u4fdd\u5b58\u5931\u8d25',
  removeSuccess: '\u5df2\u5220\u9664',
  removeFailed: '\u5220\u9664\u5931\u8d25',
  removeConfirmTitle: '\u786e\u8ba4\u5220\u9664\u5730\u5740\uff1f',
  removeConfirmContent: '\u5220\u9664\u540e\u65e0\u6cd5\u6062\u590d\u3002',
  removeConfirmText: '\u5220\u9664',
  cancelText: '\u53d6\u6d88',
  loadingText: '\u5730\u5740\u52a0\u8f7d\u4e2d',
  nameLabel: '\u6536\u8d27\u4eba',
  phoneLabel: '\u624b\u673a\u53f7',
  regionLabel: '\u5730\u533a\uff08\u53ef\u9009\uff09',
  lineLabel: '\u8be6\u7ec6\u5730\u5740',
  defaultLabel: '\u8bbe\u4e3a\u9ed8\u8ba4',
  regionPlaceholder: '\u8bf7\u9009\u62e9\u5730\u533a',
  clearRegion: '\u6e05\u7a7a\u5730\u533a',
  linePlaceholder: '\u8857\u9053/\u95e8\u724c\u53f7',
  saveText: '\u4fdd\u5b58',
  removeText: '\u5220\u9664\u5730\u5740',
} as const;

function resetAddressForm(setters: {
  setName: (value: string) => void;
  setPhone: (value: string) => void;
  setRegionCode: (value: string) => void;
  setRegionName: (value: string) => void;
  setAddressLine: (value: string) => void;
  setIsDefault: (value: boolean) => void;
}) {
  setters.setName('');
  setters.setPhone('');
  setters.setRegionCode('');
  setters.setRegionName('');
  setters.setAddressLine('');
  setters.setIsDefault(false);
}

export default function AddressEditPage() {
  const access = usePageAccess('login-required');
  const addressId = useRouteStringParam('id') || '';
  const isEdit = Boolean(addressId);
  const pageVisibleRef = useRef(true);
  const loadSeqRef = useRef(0);
  const saveSeqRef = useRef(0);
  const removeSeqRef = useRef(0);
  const addressIdRef = useRef(addressId);

  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [regionName, setRegionName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  useDidShow(() => {
    pageVisibleRef.current = true;
  });

  useDidHide(() => {
    pageVisibleRef.current = false;
    loadSeqRef.current += 1;
    saveSeqRef.current += 1;
    removeSeqRef.current += 1;
  });

  useEffect(() => {
    addressIdRef.current = addressId;
    loadSeqRef.current += 1;
    saveSeqRef.current += 1;
    removeSeqRef.current += 1;
    setError(null);
    if (isEdit) {
      setLoading(true);
      return;
    }
    setLoading(false);
    resetAddressForm({
      setName,
      setPhone,
      setRegionCode,
      setRegionName,
      setAddressLine,
      setIsDefault,
    });
  }, [addressId, isEdit]);

  const load = useCallback(async () => {
    const currentAddressId = addressId;
    addressIdRef.current = currentAddressId;
    if (!isEdit || !currentAddressId) return;
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const list = await apiGet<Address[]>('/me/addresses');
      if (seq !== loadSeqRef.current || addressIdRef.current !== currentAddressId) return;
      const current = (list || []).find((item) => item.id === currentAddressId);
      if (!current) {
        setError(TEXT.missingAddress);
        return;
      }
      setName(current.name || '');
      setPhone(current.phone || '');
      setRegionCode(current.regionCode || '');
      setRegionName('');
      setAddressLine(current.addressLine || '');
      setIsDefault(Boolean(current.isDefault));
    } catch (e: any) {
      if (seq !== loadSeqRef.current || addressIdRef.current !== currentAddressId) return;
      setError(e?.message || TEXT.loadFailed);
    } finally {
      if (seq !== loadSeqRef.current || addressIdRef.current !== currentAddressId) return;
      setLoading(false);
    }
  }, [addressId, isEdit]);

  useEffect(() => {
    if (access.state !== 'ok') return;
    void load();
  }, [access.state, load]);

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
      toast(TEXT.nameRequired);
      return false;
    }
    if (!payload.phone) {
      toast(TEXT.phoneRequired);
      return false;
    }
    if (!payload.addressLine) {
      toast(TEXT.lineRequired);
      return false;
    }
    return true;
  }, [payload]);

  const regionLabel = useMemo(() => regionDisplayName(regionCode, regionName, ''), [regionCode, regionName]);

  const save = useCallback(async () => {
    if (!validate()) return;
    const currentAddressId = addressIdRef.current;
    const seq = ++saveSeqRef.current;
    try {
      if (isEdit) {
        await apiPatch(`/me/addresses/${addressId}`, payload);
      } else {
        await apiPost('/me/addresses', payload);
      }
      if (seq !== saveSeqRef.current || !pageVisibleRef.current || addressIdRef.current !== currentAddressId) return;
      toast(TEXT.saveSuccess, { icon: 'success' });
      Taro.navigateBack();
    } catch (e: any) {
      if (seq !== saveSeqRef.current || !pageVisibleRef.current || addressIdRef.current !== currentAddressId) return;
      toast(e?.message || TEXT.saveFailed, { icon: 'fail' });
    }
  }, [addressId, isEdit, payload, validate]);

  const remove = useCallback(async () => {
    if (!isEdit) return;
    const ok = await confirm({
      title: TEXT.removeConfirmTitle,
      content: TEXT.removeConfirmContent,
      confirmText: TEXT.removeConfirmText,
      cancelText: TEXT.cancelText,
    });
    if (!ok) return;
    const currentAddressId = addressIdRef.current;
    const seq = ++removeSeqRef.current;
    try {
      await apiDelete(`/me/addresses/${addressId}`);
      if (seq !== removeSeqRef.current || !pageVisibleRef.current || addressIdRef.current !== currentAddressId) return;
      toast(TEXT.removeSuccess, { icon: 'success' });
      Taro.navigateBack();
    } catch (e: any) {
      if (seq !== removeSeqRef.current || !pageVisibleRef.current || addressIdRef.current !== currentAddressId) return;
      toast(e?.message || TEXT.removeFailed, { icon: 'fail' });
    }
  }, [addressId, isEdit]);

  if (access.state !== 'ok') {
    return (
      <View className="container address-edit-page">
        <PageHeader weapp back title={isEdit ? TEXT.editTitle : TEXT.createTitle} />
        <Spacer />
        <AccessGate access={access} />
      </View>
    );
  }

  if (loading) {
    return (
      <View className="container address-edit-page">
        <PageHeader weapp back title={TEXT.editTitle} />
        <Spacer />
        <LoadingCard text={TEXT.loadingText} />
      </View>
    );
  }

  if (error) {
    return (
      <View className="container address-edit-page">
        <PageHeader weapp back title={TEXT.editTitle} />
        <Spacer />
        <ErrorCard message={error} onRetry={load} />
      </View>
    );
  }

  return (
    <View className="container address-edit-page">
      <PageHeader weapp back title={isEdit ? TEXT.editTitle : TEXT.createTitle} subtitle={TEXT.subtitle} />
      <Spacer />

      <Surface className="address-form-card">
        <View className="form-field">
          <Text className="form-label">{TEXT.nameLabel}</Text>
          <Input value={name} onChange={setName} placeholder={TEXT.nameLabel} clearable />
        </View>
        <View className="form-field">
          <Text className="form-label">{TEXT.phoneLabel}</Text>
          <Input value={phone} onChange={setPhone} placeholder={TEXT.phoneLabel} type="digit" clearable />
        </View>
        <View className="form-field">
          <Text className="form-label">{TEXT.regionLabel}</Text>
          <View
            className="address-region-select"
            onClick={() =>
              openRegionPickerPage(({ code, name: nextName }) => {
                setRegionCode(code);
                setRegionName(nextName);
              })
            }
          >
            <Text className={regionLabel ? 'address-region-value' : 'address-region-placeholder'}>
              {regionLabel || TEXT.regionPlaceholder}
            </Text>
            <Text className="address-region-arrow">›</Text>
          </View>
          {regionCode ? (
            <Text
              className="address-region-clear"
              onClick={() => {
                setRegionCode('');
                setRegionName('');
              }}
            >
              {TEXT.clearRegion}
            </Text>
          ) : null}
        </View>
        <View className="form-field">
          <Text className="form-label">{TEXT.lineLabel}</Text>
          <Input value={addressLine} onChange={setAddressLine} placeholder={TEXT.linePlaceholder} clearable />
        </View>
        <View className="form-field form-switch">
          <Text className="form-label">{TEXT.defaultLabel}</Text>
          <Switch checked={isDefault} onChange={(e) => setIsDefault(Boolean(e.detail.value))} />
        </View>
      </Surface>

      <View className="address-form-actions">
        <Button onClick={() => void save()}>{TEXT.saveText}</Button>
        {isEdit ? (
          <Button variant="danger" onClick={() => void remove()}>
            {TEXT.removeText}
          </Button>
        ) : null}
      </View>
    </View>
  );
}
