import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { API_BASE_URL, STORAGE_KEYS } from '../../../constants';
import { getToken, getVerificationType, setOnboardingDone, setVerificationStatus } from '../../../lib/auth';
import { apiPost } from '../../../lib/api';
import { requireLogin } from '../../../lib/guard';
import { PageHeader, SectionHeader, Spacer, Surface, TipBanner } from '../../../ui/layout';
import { Button, Input, TextArea, confirm, toast } from '../../../ui/nutui';
import { ErrorCard } from '../../../ui/StateCards';

type FileObject = components['schemas']['FileObject'];

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
  const [evidenceFiles, setEvidenceFiles] = useState<FileObject[]>([]);

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

      const json = JSON.parse(String(uploadRes.data || '{}')) as Partial<FileObject>;
      if (!json.id) throw new Error('上传失败');
      setEvidenceFiles((prev) => [...prev, json as FileObject]);
      toast('已上传', { icon: 'success' });
    } catch (e: any) {
      if (e?.errMsg?.includes('cancel')) return;
      toast(e?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  }, [uploading]);

  const removeEvidence = useCallback(async (f: FileObject) => {
    const ok = await confirm({ title: '移除材料', content: '确定移除该材料？', confirmText: '移除', cancelText: '取消' });
    if (!ok) return;
    setEvidenceFiles((prev) => prev.filter((x) => x.id !== f.id));
  }, []);

  const submit = useCallback(async () => {
    if (!requireLogin()) return;

    if (!type) {
      toast('请先选择身份');
      return;
    }

    if (!displayName.trim()) {
      toast('请填写名称');
      return;
    }

    if (!contactPhone.trim()) {
      toast('请填写联系电话');
      return;
    }

    if (!evidenceFiles.length) {
      toast('请上传证明材料');
      return;
    }

    try {
      const payload: any = {
        type,
        displayName: displayName.trim(),
        evidenceFileIds: evidenceFiles.map((it) => it.id),
        ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),
        ...(regionCode.trim() ? { regionCode: regionCode.trim() } : {}),
        ...(intro.trim() ? { intro: intro.trim() } : {}),
        ...(isOrgType(type) && creditCode.trim() ? { unifiedSocialCreditCode: creditCode.trim() } : {}),
        ...(isOrgType(type) && contactName.trim() ? { contactName: contactName.trim() } : {}),
      };
      const res = await apiPost<any>('/me/verification', payload, { idempotencyKey: `ver-${type}` });
      setVerificationStatus(res?.status || 'PENDING');
      setOnboardingDone(true);
      toast('已提交，等待审核', { icon: 'success' });
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/me/index' });
      }, 200);
    } catch (e: any) {
      toast(e?.message || '提交失败');
    }
  }, [contactName, contactPhone, creditCode, displayName, evidenceFiles, intro, regionCode, type]);

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

      <Surface>
        <SectionHeader title="基础信息" subtitle="用于审核与后续展示（审核通过后）。" density="compact" />
        <Spacer size={10} />

        <Text className="muted">主体/展示名称</Text>
        <Spacer size={6} />
        <Input value={displayName} onChange={setDisplayName} placeholder="请输入名称" clearable />

        {isOrgType(type) ? (
          <>
            <Spacer size={10} />
            <Text className="muted">统一社会信用代码（可选）</Text>
            <Spacer size={6} />
            <Input value={creditCode} onChange={setCreditCode} placeholder="如有可填写" clearable />

            <Spacer size={10} />
            <Text className="muted">联系人（可选）</Text>
            <Spacer size={6} />
            <Input value={contactName} onChange={setContactName} placeholder="联系人姓名" clearable />
          </>
        ) : null}

        <Spacer size={10} />
        <Text className="muted">联系电话</Text>
        <Spacer size={6} />
        <Input value={contactPhone} onChange={setContactPhone} placeholder="用于审核与跟进" type="digit" clearable />

        <Spacer size={10} />
        <Text className="muted">所在地区（可选）</Text>
        <Spacer size={6} />
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

        <Spacer size={10} />
        <Text className="muted">简介（可选）</Text>
        <Spacer size={6} />
        <TextArea value={intro} onChange={setIntro} placeholder="一句话介绍，便于对外展示（审核通过后）" maxLength={2000} />
      </Surface>

      <Spacer />

      <Surface>
        <View className="row-between">
          <SectionHeader title="证明材料" subtitle="营业执照/单位证明/资格证等（示例：图片上传）。" density="compact" />
          <Text className={`tag ${evidenceFiles.length ? 'tag-success' : 'tag-danger'}`}>
            {evidenceFiles.length ? `${evidenceFiles.length} 份` : '必传'}
          </Text>
        </View>

        <Spacer size={10} />

        <Button variant="ghost" loading={uploading} disabled={uploading} onClick={uploadEvidence}>
          {uploading ? '上传中…' : '上传材料'}
        </Button>

        {evidenceFiles.length ? (
          <>
            <Spacer size={10} />
            {evidenceFiles.map((f, idx) => (
              <View
                key={f.id}
                className="list-item"
                onClick={() => {
                  if (!f.url) return;
                  if (String(f.mimeType || '').startsWith('image/')) {
                    void Taro.previewImage({ urls: [String(f.url)] });
                    return;
                  }
                  void Taro.setClipboardData({ data: String(f.url) });
                  toast('链接已复制', { icon: 'success' });
                }}
              >
                <View className="min-w-0" style={{ flex: 1 }}>
                  <Text className="text-strong">{`材料 ${idx + 1}`}</Text>
                  <View style={{ height: '4rpx' }} />
                  <Text className="text-caption clamp-1">
                    {f.mimeType ? String(f.mimeType) : '文件'} {typeof f.sizeBytes === 'number' ? `· ${(f.sizeBytes / 1024).toFixed(0)}KB` : ''}
                  </Text>
                </View>
                <View style={{ width: '168rpx' }}>
                  <Button
                    variant="danger"
                    fill="outline"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeEvidence(f);
                    }}
                  >
                    移除
                  </Button>
                </View>
              </View>
            ))}
          </>
        ) : null}
      </Surface>

      <Spacer />

      <TipBanner tone="info" title="提交后会发生什么？">
        提交后进入“审核中”，平台会在后台完成审核并通知结果。审核未通过不可交易。
      </TipBanner>

      <Spacer />

      <Surface>
        <Button onClick={submit}>提交并进入审核中</Button>
      </Surface>
    </View>
  );
}
