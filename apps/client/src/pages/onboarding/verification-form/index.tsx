import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';

import { API_BASE_URL, STORAGE_KEYS } from '../../../constants';
import { getToken, getVerificationType, setOnboardingDone, setVerificationStatus } from '../../../lib/auth';
import { apiPost } from '../../../lib/api';
import { requireLogin } from '../../../lib/guard';
import { PageHeader, Spacer } from '../../../ui/layout';
import { Button, Input, TextArea } from '../../../ui/nutui';
import { ErrorCard } from '../../../ui/StateCards';

function isOrgType(type: string | null): boolean {
  return type === 'COMPANY' || type === 'ACADEMY' || type === 'GOVERNMENT' || type === 'ASSOCIATION';
}

function typeLabel(type: string | null): string {
  if (!type) return '-';
  if (type === 'COMPANY') return '企业';
  if (type === 'ACADEMY') return '科研院校';
  if (type === 'GOVERNMENT') return '政府';
  if (type === 'ASSOCIATION') return '行业协会/学会';
  if (type === 'TECH_MANAGER') return '技术经理人';
  return type;
}

export default function VerificationFormPage() {
  const type = useMemo(() => getVerificationType(), []);

  const [displayName, setDisplayName] = useState('');
  const [creditCode, setCreditCode] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [intro, setIntro] = useState('');

  const [uploading, setUploading] = useState(false);
  const [evidenceFileIds, setEvidenceFileIds] = useState<string[]>([]);

  const uploadEvidence = useCallback(async () => {
    if (uploading) return;
    if (!requireLogin()) return;
    setUploading(true);
    try {
      const chosen = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] });
      const filePath = chosen?.tempFilePaths?.[0];
      if (!filePath) return;

      const scenario = Taro.getStorageSync(STORAGE_KEYS.mockScenario) || 'happy';
      const token = getToken();
      const uploadRes = await Taro.uploadFile({
        url: `${API_BASE_URL}/files`,
        filePath,
        name: 'file',
        header: {
          'X-Mock-Scenario': scenario,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const json = JSON.parse(String(uploadRes.data || '{}')) as { id?: string };
      if (!json.id) throw new Error('上传失败');
      setEvidenceFileIds((prev) => [...prev, json.id as string]);
      Taro.showToast({ title: '已上传', icon: 'success' });
    } catch (e: any) {
      if (e?.errMsg?.includes('cancel')) return;
      Taro.showToast({ title: e?.message || '上传失败', icon: 'none' });
    } finally {
      setUploading(false);
    }
  }, [uploading]);

  const removeEvidence = useCallback((id: string) => {
    setEvidenceFileIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const submit = useCallback(async () => {
    if (!requireLogin()) return;

    if (!type) {
      Taro.showToast({ title: '请先选择身份', icon: 'none' });
      return;
    }

    if (!displayName.trim()) {
      Taro.showToast({ title: '请填写名称', icon: 'none' });
      return;
    }

    if (!contactPhone.trim()) {
      Taro.showToast({ title: '请填写联系电话', icon: 'none' });
      return;
    }

    if (!evidenceFileIds.length) {
      Taro.showToast({ title: '请上传证明材料', icon: 'none' });
      return;
    }

    try {
      const payload: any = {
        type,
        displayName: displayName.trim(),
        evidenceFileIds,
        ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),
        ...(regionCode.trim() ? { regionCode: regionCode.trim() } : {}),
        ...(intro.trim() ? { intro: intro.trim() } : {}),
        ...(isOrgType(type) && creditCode.trim() ? { unifiedSocialCreditCode: creditCode.trim() } : {}),
        ...(isOrgType(type) && contactName.trim() ? { contactName: contactName.trim() } : {}),
      };
      const res = await apiPost<any>('/me/verification', payload, { idempotencyKey: `ver-${type}` });
      setVerificationStatus(res?.status || 'PENDING');
      setOnboardingDone(true);
      Taro.showToast({ title: '已提交，等待审核', icon: 'success' });
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/me/index' });
      }, 200);
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '提交失败', icon: 'none' });
    }
  }, [contactName, contactPhone, creditCode, displayName, evidenceFileIds, intro, regionCode, type]);

  if (!type) {
    return (
      <View className="container">
        <ErrorCard title="请先选择身份" message="缺少认证类型" onRetry={() => Taro.navigateBack()} />
      </View>
    );
  }

  return (
    <View className="container">
      <PageHeader title="资料提交" subtitle={`当前身份：${typeLabel(type)}`} />
      <Spacer />

      <View className="card">
        <Text className="text-card-title">基础信息</Text>
        <View style={{ height: '12rpx' }} />

        <Text className="muted">主体/展示名称</Text>
        <View style={{ height: '8rpx' }} />
        <Input value={displayName} onChange={setDisplayName} placeholder="请输入名称" clearable />

        {isOrgType(type) ? (
          <>
            <View style={{ height: '12rpx' }} />
            <Text className="muted">统一社会信用代码（可选）</Text>
            <View style={{ height: '8rpx' }} />
            <Input value={creditCode} onChange={setCreditCode} placeholder="如有可填写" clearable />

            <View style={{ height: '12rpx' }} />
            <Text className="muted">联系人（可选）</Text>
            <View style={{ height: '8rpx' }} />
            <Input value={contactName} onChange={setContactName} placeholder="联系人姓名" clearable />
          </>
        ) : null}

        <View style={{ height: '12rpx' }} />
        <Text className="muted">联系电话</Text>
        <View style={{ height: '8rpx' }} />
        <Input value={contactPhone} onChange={setContactPhone} placeholder="用于审核与跟进" type="digit" clearable />

        <View style={{ height: '12rpx' }} />
        <Text className="muted">所在地区（可选）</Text>
        <View style={{ height: '8rpx' }} />
        <View className="row" style={{ gap: '12rpx', alignItems: 'center' }}>
          <View className="flex-1">
            <Input value={regionCode} onChange={setRegionCode} placeholder="省/市/区（可后续完善）" clearable />
          </View>
          <View style={{ width: '180rpx' }}>
            <Button
              variant="ghost"
              size="small"
              onClick={() => {
                Taro.navigateTo({
                  url: '/pages/region-picker/index',
                  success: (res) => {
                    res.eventChannel.on('regionSelected', (v: any) => {
                      if (v?.code) setRegionCode(String(v.code));
                    });
                  },
                });
              }}
            >
              选择
            </Button>
          </View>
        </View>

        <View style={{ height: '12rpx' }} />
        <Text className="muted">简介（可选）</Text>
        <View style={{ height: '8rpx' }} />
        <TextArea value={intro} onChange={setIntro} placeholder="一句话介绍，便于对外展示（审核通过后）" maxLength={2000} />
      </View>

      <Spacer />

      <View className="card">
        <View className="row-between">
          <Text className="text-card-title">证明材料</Text>
          <Text className="tag tag-gold">{evidenceFileIds.length ? `${evidenceFileIds.length} 个` : '必传'}</Text>
        </View>
        <View style={{ height: '8rpx' }} />
        <Text className="muted">营业执照/单位证明/资格证等（示例：图片上传）。</Text>
        <View style={{ height: '12rpx' }} />

        <Button variant="ghost" loading={uploading} disabled={uploading} onClick={uploadEvidence}>
          {uploading ? '上传中…' : '上传材料'}
        </Button>

        {evidenceFileIds.length ? (
          <>
            <View style={{ height: '12rpx' }} />
            {evidenceFileIds.map((id) => (
              <View key={id} className="list-item">
                <Text className="muted ellipsis" style={{ flex: 1 }}>
                  {id}
                </Text>
                <View style={{ width: '168rpx' }}>
                  <Button
                    variant="danger"
                    fill="outline"
                    size="small"
                    onClick={() => {
                      removeEvidence(id);
                    }}
                  >
                    移除
                  </Button>
                </View>
              </View>
            ))}
          </>
        ) : null}
      </View>

      <Spacer />

      <View className="card">
        <Text className="muted">提交后进入“审核中”，平台会在后台完成审核并通知结果。</Text>
      </View>

      <Spacer />

      <View className="card">
        <Button onClick={submit}>提交并进入审核中</Button>
      </View>
    </View>
  );
}
