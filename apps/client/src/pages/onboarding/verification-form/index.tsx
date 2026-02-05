import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { API_BASE_URL, STORAGE_KEYS } from '../../../constants';
import { getToken, getVerificationType, setOnboardingDone, setVerificationStatus } from '../../../lib/auth';
import { apiPost } from '../../../lib/api';
import { requireLogin } from '../../../lib/guard';
import { PageHeader, SectionHeader, Spacer, Surface, TipBanner } from '../../../ui/layout';
import { Button, Input, TextArea, confirm, toast } from '../../../ui/nutui';
import { ErrorCard } from '../../../ui/StateCards';

type FileObject = components['schemas']['FileObject'];

type VerificationType = components['schemas']['VerificationType'];

type UploadedFile = Pick<FileObject, 'id'> & Partial<Omit<FileObject, 'id'>>;

function isOrgType(type: VerificationType | null): boolean {
  return type === 'COMPANY' || type === 'ACADEMY' || type === 'GOVERNMENT' || type === 'ASSOCIATION';
}

function isTechManager(type: VerificationType | null): boolean {
  return type === 'TECH_MANAGER';
}

function isPerson(type: VerificationType | null): boolean {
  return type === 'PERSON';
}

function typeLabel(type: VerificationType | null): string {
  if (!type) return '-';
  if (type === 'COMPANY') return '企业';
  if (type === 'ACADEMY') return '科研院校';
  if (type === 'GOVERNMENT') return '政府';
  if (type === 'ASSOCIATION') return '行业协会/学会';
  if (type === 'TECH_MANAGER') return '技术经理人';
  if (type === 'PERSON') return '个人';
  return type;
}

function displayNameLabel(type: VerificationType | null): string {
  if (type === 'COMPANY') return '企业名称';
  if (type === 'ACADEMY') return '科研院校名称';
  if (type === 'GOVERNMENT') return '政府/机构名称';
  if (type === 'ASSOCIATION') return '协会/学会名称';
  if (type === 'TECH_MANAGER') return '展示名称';
  if (type === 'PERSON') return '姓名/昵称';
  return '主体名称';
}

function evidenceHint(type: VerificationType | null): string {
  if (type === 'COMPANY') return '营业执照、组织机构代码证或加盖公章的资质证明。';
  if (type === 'ACADEMY') return '院校/科研机构证明、加盖公章的文件或资质材料。';
  if (type === 'GOVERNMENT') return '机构证明、授权文件或加盖公章的材料。';
  if (type === 'ASSOCIATION') return '协会资质、登记证书或加盖公章的证明材料。';
  if (type === 'TECH_MANAGER') return '技术经理人证书、从业资格或相关证明材料。';
  return '身份证明或相关材料。';
}

const LIST_SPLIT_RE = /[,\uFF0C;\uFF1B\n]/g;

function splitList(input: string): string[] {
  return (input || '')
    .split(LIST_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function mergePlaceholderClass(extra?: string): string {
  return extra ? `verification-placeholder ${extra}` : 'verification-placeholder';
}

function mergePlaceholderStyle(extra?: string): string {
  const base = 'font-size:20rpx;color:#c0c4cc;';
  if (!extra) return base;
  return `${base}${extra}`;
}

function FormInput(props: React.ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      placeholderClass={mergePlaceholderClass(props.placeholderClass)}
      placeholderStyle={mergePlaceholderStyle(props.placeholderStyle)}
    />
  );
}

function FormTextArea(props: React.ComponentProps<typeof TextArea>) {
  return (
    <TextArea
      {...props}
      placeholderClass={mergePlaceholderClass(props.placeholderClass)}
      placeholderStyle={mergePlaceholderStyle(props.placeholderStyle)}
    />
  );
}

export default function VerificationFormPage() {
  const type = useMemo(() => getVerificationType() as VerificationType | null, []);

  const [displayName, setDisplayName] = useState('');
  const [creditCode, setCreditCode] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [regionName, setRegionName] = useState('');
  const [intro, setIntro] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [serviceTagsInput, setServiceTagsInput] = useState('');

  const [logoUploading, setLogoUploading] = useState(false);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [logoFile, setLogoFile] = useState<UploadedFile | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<UploadedFile[]>([]);

  const serviceTags = useMemo(() => splitList(serviceTagsInput), [serviceTagsInput]);

  const uploadLogo = useCallback(async () => {
    if (logoUploading) return;
    if (!requireLogin()) return;
    if (logoFile) {
      const ok = await confirm({ title: '更换LOGO', content: '已有LOGO，确定替换吗？', confirmText: '替换', cancelText: '取消' });
      if (!ok) return;
    }
    setLogoUploading(true);
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
      setLogoFile(json as UploadedFile);
      toast('LOGO已上传', { icon: 'success' });
    } catch (e: any) {
      if (e?.errMsg?.includes('cancel')) return;
      toast(e?.message || '上传失败');
    } finally {
      setLogoUploading(false);
    }
  }, [logoFile, logoUploading]);

  const removeLogo = useCallback(async () => {
    if (!logoFile) return;
    const ok = await confirm({ title: '移除LOGO', content: '确定移除已上传的LOGO？', confirmText: '移除', cancelText: '取消' });
    if (!ok) return;
    setLogoFile(null);
  }, [logoFile]);

  const uploadEvidence = useCallback(async () => {
    if (evidenceUploading) return;
    if (!requireLogin()) return;
    setEvidenceUploading(true);
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
      setEvidenceFiles((prev) => [...prev, json as UploadedFile]);
      toast('已上传', { icon: 'success' });
    } catch (e: any) {
      if (e?.errMsg?.includes('cancel')) return;
      toast(e?.message || '上传失败');
    } finally {
      setEvidenceUploading(false);
    }
  }, [evidenceUploading]);

  const removeEvidence = useCallback(async (f: UploadedFile) => {
    const ok = await confirm({ title: '移除材料', content: '确定移除该材料？', confirmText: '移除', cancelText: '取消' });
    if (!ok) return;
    setEvidenceFiles((prev) => prev.filter((x) => x.id !== f.id));
  }, []);

  const handleRegionPick = useCallback(() => {
    Taro.navigateTo({
      url: '/pages/region-picker/index',
      success: (res) => {
        res.eventChannel.on('regionSelected', (v: any) => {
          const code = String(v?.code || '').trim();
          const name = String(v?.name || '').trim();
          if (code) setRegionCode(code);
          if (name) setRegionName(name);
        });
      },
    });
  }, []);

  const submit = useCallback(async () => {
    if (!requireLogin()) return;

    if (!type) {
      toast('请先选择身份');
      return;
    }

    if (!displayName.trim()) {
      toast(`请填写${displayNameLabel(type)}`);
      return;
    }

    if (isOrgType(type)) {
      if (!creditCode.trim()) {
        toast('请填写统一社会信用代码');
        return;
      }
      if (!contactName.trim()) {
        toast('请填写联系人');
        return;
      }
      if (!contactPhone.trim()) {
        toast('请填写联系电话');
        return;
      }
      if (!evidenceFiles.length) {
        toast('请上传资质证明');
        return;
      }
    }

    if (isTechManager(type)) {
      if (!contactPhone.trim()) {
        toast('请填写联系电话');
        return;
      }
      if (!evidenceFiles.length) {
        toast('请上传证明材料');
        return;
      }
    }

    try {
      const payload: any = {
        type,
        displayName: displayName.trim(),
      };

      if (isPerson(type)) {
        if (idNumber.trim()) payload.idNumber = idNumber.trim();
      }

      if (isOrgType(type)) {
        payload.unifiedSocialCreditCode = creditCode.trim();
        payload.evidenceFileIds = evidenceFiles.map((it) => it.id);
        if (contactName.trim()) payload.contactName = contactName.trim();
        if (contactPhone.trim()) payload.contactPhone = contactPhone.trim();
        if (regionCode.trim()) payload.regionCode = regionCode.trim();
        if (intro.trim()) payload.intro = intro.trim();
        if (logoFile?.id) payload.logoFileId = logoFile.id;
      }

      if (isTechManager(type)) {
        payload.evidenceFileIds = evidenceFiles.map((it) => it.id);
        if (idNumber.trim()) payload.idNumber = idNumber.trim();
        if (contactPhone.trim()) payload.contactPhone = contactPhone.trim();
        if (regionCode.trim()) payload.regionCode = regionCode.trim();
        if (intro.trim()) payload.intro = intro.trim();
        if (serviceTags.length) payload.serviceTags = serviceTags;
      }

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
  }, [contactName, contactPhone, creditCode, displayName, evidenceFiles, idNumber, intro, logoFile, regionCode, serviceTags, type]);

  if (!type) {
    return (
      <View className="container">
        <ErrorCard title="请先选择身份" message="缺少认证类型" onRetry={() => Taro.navigateBack()} />
      </View>
    );
  }

  const regionLabel = regionName || regionCode;
  const introTip = isOrgType(type)
    ? '企业/科研院校通过后将展示在「机构展示」。请确保信息真实、完整、可追溯。'
    : isTechManager(type)
      ? '技术经理人通过后将展示在「技术经理人」列表，请确保信息真实、完整、可追溯。'
      : '个人信息仅用于审核与交易安全，不对外公开。';

  return (
    <View className="container verification-page">
      <PageHeader title="资料提交" subtitle={`当前身份：${typeLabel(type)}`} />
      <Spacer />

      <TipBanner tone="info" title="提交说明">
        {introTip}
      </TipBanner>

      <Spacer />

      <View className="verification-form">
        <Surface className="verification-card">
          <SectionHeader title="主体信息" subtitle="用于审核与主体展示" density="compact" />

          <View className="form-field">
            <Text className="form-label">{displayNameLabel(type)}</Text>
            <FormInput value={displayName} onChange={setDisplayName} placeholder="请与证件名称保持一致" clearable />
          </View>

          {isOrgType(type) ? (
            <View className="form-field">
              <Text className="form-label">统一社会信用代码</Text>
              <FormInput value={creditCode} onChange={setCreditCode} placeholder="18位统一社会信用代码" clearable />
              <Text className="form-hint">请填写证照上的完整代码。</Text>
            </View>
          ) : null}

          {isTechManager(type) || isPerson(type) ? (
            <View className="form-field">
              <Text className="form-label">证件号（可选）</Text>
              <FormInput value={idNumber} onChange={setIdNumber} placeholder="用于身份核验，可不填" clearable />
            </View>
          ) : null}
        </Surface>

        {isOrgType(type) || isTechManager(type) ? (
          <Surface className="verification-card">
            <SectionHeader title="联系人信息" subtitle="用于审核与平台沟通" density="compact" />

            {isOrgType(type) ? (
              <View className="form-field">
                <Text className="form-label">联系人</Text>
                <FormInput value={contactName} onChange={setContactName} placeholder="联系人姓名" clearable />
              </View>
            ) : null}

            <View className="form-field">
              <Text className="form-label">联系电话</Text>
              <FormInput value={contactPhone} onChange={setContactPhone} placeholder="用于审核与跟进" type="digit" clearable />
            </View>
          </Surface>
        ) : null}

        {isOrgType(type) || isTechManager(type) ? (
          <Surface className="verification-card">
            <View className="row-between">
              <SectionHeader title="展示信息" subtitle="审核通过后对外展示" density="compact" />
              {isOrgType(type) ? (
                <Text className={`tag ${logoFile ? 'tag-success' : 'tag-warning'}`}>{logoFile ? '已上传' : '可选'}</Text>
              ) : null}
            </View>

            {isOrgType(type) ? (
              <>
                <View className="form-field">
                  <Text className="form-label">机构LOGO（可选）</Text>
                  <View className="form-row">
                    <View className="form-col">
                      <Button variant="ghost" loading={logoUploading} disabled={logoUploading} onClick={uploadLogo}>
                        {logoUploading ? '上传中...' : '上传LOGO'}
                      </Button>
                    </View>
                    {logoFile ? (
                      <View className="form-col" style={{ maxWidth: '200rpx' }}>
                        <Button variant="danger" fill="outline" size="small" onClick={removeLogo}>
                          移除
                        </Button>
                      </View>
                    ) : null}
                  </View>
                  {logoFile?.url ? (
                    <View
                      className="verification-logo-preview"
                      onClick={() => {
                        if (!logoFile.url) return;
                        void Taro.previewImage({ urls: [String(logoFile.url)] });
                      }}
                    >
                      <Image className="verification-logo" src={String(logoFile.url)} mode="aspectFill" />
                      <Text className="form-hint">点击预览</Text>
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}

            <View className="form-field">
              <Text className="form-label">所在地区（可选）</Text>
              <View className="form-row">
                <View className="form-col">
                  <FormInput
                    value={regionLabel}
                    onChange={(v) => {
                      setRegionName(v);
                      setRegionCode(v);
                    }}
                    placeholder="请选择地区"
                    clearable
                  />
                </View>
                <View style={{ width: '180rpx' }}>
                  <Button variant="ghost" size="small" onClick={handleRegionPick}>
                    选择
                  </Button>
                </View>
              </View>
            </View>

            <View className="form-field">
              <Text className="form-label">简介（可选）</Text>
              <FormTextArea value={intro} onChange={setIntro} placeholder="一句话介绍，便于对外展示" maxLength={2000} />
            </View>

            {isTechManager(type) ? (
              <View className="form-field">
                <Text className="form-label">服务标签（可选）</Text>
                <FormTextArea
                  value={serviceTagsInput}
                  onChange={setServiceTagsInput}
                  placeholder="示例：专利转让、技术评估、项目对接（用逗号或换行分隔）"
                  maxLength={400}
                />
                <Text className="form-hint">当前已识别 {serviceTags.length} 个标签。</Text>
              </View>
            ) : null}
          </Surface>
        ) : null}

        {isOrgType(type) || isTechManager(type) ? (
          <Surface className="verification-card">
            <View className="row-between">
              <SectionHeader title="证明材料" subtitle={evidenceHint(type)} density="compact" />
              <Text className={`tag ${evidenceFiles.length ? 'tag-success' : 'tag-danger'}`}>
                {evidenceFiles.length ? `${evidenceFiles.length} 份` : '必传'}
              </Text>
            </View>

            <View className="form-field">
              <Button variant="ghost" loading={evidenceUploading} disabled={evidenceUploading} onClick={uploadEvidence}>
                {evidenceUploading ? '上传中...' : '上传材料'}
              </Button>
            </View>

            {evidenceFiles.length ? (
              <>
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
        ) : null}

        <TipBanner tone="info" title="提交后会发生什么？">
          提交后进入“审核中”，审核通过可发布与交易；审核未通过可按提示补充资料。
        </TipBanner>

        <Surface className="verification-card">
          <Button onClick={submit}>提交并进入审核中</Button>
        </Surface>
      </View>
    </View>
  );
}
