import { View, Text, Image } from '@tarojs/components';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { API_BASE_URL } from '../../../constants';
import { getToken, getVerificationType, setOnboardingDone, setVerificationStatus } from '../../../lib/auth';
import { apiPost } from '../../../lib/api';
import { requireLogin } from '../../../lib/guard';
import { openRegionPickerPage } from '../../../lib/regionPicker';
import { regionDisplayName } from '../../../lib/regions';
import { chooseImageFiles, uploadFileToApi } from '../../../lib/upload';
import { PageHeader, SectionHeader, Spacer, Surface, TipBanner } from '../../../ui/layout';
import { Button, Input, TextArea, confirm, toast } from '../../../ui/nutui';
import { ErrorCard } from '../../../ui/StateCards';

type FileObject = components['schemas']['FileObject'];
type VerificationType = components['schemas']['VerificationType'];
type UploadedFile = Pick<FileObject, 'id'> & Partial<Omit<FileObject, 'id'>>;

const LIST_SPLIT_RE = /[,\uff0c;\uff1b\n]/g;

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
  if (!type) return '待选择';
  if (type === 'COMPANY') return '企业';
  if (type === 'ACADEMY') return '科研院校';
  if (type === 'GOVERNMENT') return '政府机构';
  if (type === 'ASSOCIATION') return '协会/学会';
  if (type === 'TECH_MANAGER') return '技术经理人';
  if (type === 'PERSON') return '个人';
  return '身份待确认';
}

function displayNameLabel(type: VerificationType | null): string {
  if (type === 'COMPANY') return '企业名称';
  if (type === 'ACADEMY') return '院校/机构名称';
  if (type === 'GOVERNMENT') return '机构名称';
  if (type === 'ASSOCIATION') return '协会/学会名称';
  if (type === 'TECH_MANAGER') return '展示名称';
  if (type === 'PERSON') return '姓名/称呼';
  return '主体名称';
}

function evidenceHint(type: VerificationType | null): string {
  if (type === 'COMPANY') return '上传营业执照、统一社会信用代码证明或盖章资质文件。';
  if (type === 'ACADEMY') return '上传院校/科研机构证明、盖章文件或相关资质材料。';
  if (type === 'GOVERNMENT') return '上传机构证明、授权文件或盖章材料。';
  if (type === 'ASSOCIATION') return '上传协会资质、登记证书或盖章证明材料。';
  if (type === 'TECH_MANAGER') return '上传技术经理人证书、从业资质或相关证明材料。';
  return '上传身份证明或相关材料。';
}

function splitList(input: string): string[] {
  return (input || '')
    .split(LIST_SPLIT_RE)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function mergePlaceholderClass(extra?: string): string {
  return extra ? `verification-placeholder ${extra}` : 'verification-placeholder';
}

function mergePlaceholderStyle(extra?: string): string {
  const base = 'font-size:20rpx;color:#c0c4cc;';
  return extra ? `${base}${extra}` : base;
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
  const pageVisibleRef = useRef(true);
  const logoUploadSeqRef = useRef(0);
  const evidenceUploadSeqRef = useRef(0);
  const submitSeqRef = useRef(0);

  const [displayName, setDisplayName] = useState('');
  const [creditCode, setCreditCode] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [regionName, setRegionName] = useState('');
  const [intro, setIntro] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [serviceTagsInput, setServiceTagsInput] = useState('');
  const [position, setPosition] = useState('');
  const [organization, setOrganization] = useState('');
  const [serviceDirectionsInput, setServiceDirectionsInput] = useState('');
  const [workHighlights, setWorkHighlights] = useState('');
  const [experienceLabel, setExperienceLabel] = useState('');
  const [levelLabel, setLevelLabel] = useState('');

  const [logoUploading, setLogoUploading] = useState(false);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [logoFile, setLogoFile] = useState<UploadedFile | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<UploadedFile[]>([]);

  const serviceTags = useMemo(() => splitList(serviceTagsInput), [serviceTagsInput]);
  const serviceDirections = useMemo(() => splitList(serviceDirectionsInput), [serviceDirectionsInput]);

  useDidShow(() => {
    pageVisibleRef.current = true;
  });

  useDidHide(() => {
    pageVisibleRef.current = false;
    logoUploadSeqRef.current += 1;
    evidenceUploadSeqRef.current += 1;
    submitSeqRef.current += 1;
    setLogoUploading(false);
    setEvidenceUploading(false);
  });

  const uploadLogo = useCallback(async () => {
    if (logoUploading) return;
    if (!requireLogin()) return;
    if (logoFile) {
      const ok = await confirm({
        title: '替换 LOGO',
        content: '已上传 LOGO，确认替换吗？',
        confirmText: '替换',
        cancelText: '取消',
      });
      if (!ok) return;
    }

    const seq = ++logoUploadSeqRef.current;
    setLogoUploading(true);
    try {
      const chosen = await chooseImageFiles({ count: 1 });
      const filePath = chosen[0]?.path;
      if (!filePath) return;

      const token = getToken();
      const { data: json } = await uploadFileToApi<Partial<FileObject>>({
        url: `${API_BASE_URL}/files`,
        filePath,
        name: 'file',
        header: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        retry: 1,
      });
      if (!json.id) throw new Error('上传失败');
      if (seq !== logoUploadSeqRef.current || !pageVisibleRef.current) return;
      setLogoFile(json as UploadedFile);
      toast('LOGO 已上传', { icon: 'success' });
    } catch (e: any) {
      if (seq !== logoUploadSeqRef.current || !pageVisibleRef.current) return;
      if (e?.errMsg?.includes('cancel')) return;
      toast(e?.message || '上传失败');
    } finally {
      if (seq === logoUploadSeqRef.current && pageVisibleRef.current) {
        setLogoUploading(false);
      }
    }
  }, [logoFile, logoUploading]);

  const removeLogo = useCallback(async () => {
    if (!logoFile) return;
    const ok = await confirm({
      title: '移除 LOGO',
      content: '确认移除已上传的 LOGO 吗？',
      confirmText: '移除',
      cancelText: '取消',
    });
    if (!ok) return;
    setLogoFile(null);
  }, [logoFile]);

  const uploadEvidence = useCallback(async () => {
    if (evidenceUploading) return;
    if (!requireLogin()) return;
    const seq = ++evidenceUploadSeqRef.current;
    setEvidenceUploading(true);
    try {
      const chosen = await chooseImageFiles({ count: 1 });
      const filePath = chosen[0]?.path;
      if (!filePath) return;

      const token = getToken();
      const { data: json } = await uploadFileToApi<Partial<FileObject>>({
        url: `${API_BASE_URL}/files`,
        filePath,
        name: 'file',
        header: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        retry: 1,
      });
      if (!json.id) throw new Error('上传失败');
      if (seq !== evidenceUploadSeqRef.current || !pageVisibleRef.current) return;
      setEvidenceFiles((prev) => [...prev, json as UploadedFile]);
      toast('材料已上传', { icon: 'success' });
    } catch (e: any) {
      if (seq !== evidenceUploadSeqRef.current || !pageVisibleRef.current) return;
      if (e?.errMsg?.includes('cancel')) return;
      toast(e?.message || '上传失败');
    } finally {
      if (seq === evidenceUploadSeqRef.current && pageVisibleRef.current) {
        setEvidenceUploading(false);
      }
    }
  }, [evidenceUploading]);

  const removeEvidence = useCallback(async (file: UploadedFile) => {
    const ok = await confirm({
      title: '移除材料',
      content: '确认移除这份材料吗？',
      confirmText: '移除',
      cancelText: '取消',
    });
    if (!ok) return;
    setEvidenceFiles((prev) => prev.filter((item) => item.id !== file.id));
  }, []);

  const submit = useCallback(async () => {
    if (!requireLogin()) return;
    const seq = ++submitSeqRef.current;

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
      const payload: Record<string, unknown> = {
        type,
        displayName: displayName.trim(),
      };

      if (isPerson(type) && idNumber.trim()) payload.idNumber = idNumber.trim();

      if (isOrgType(type)) {
        payload.unifiedSocialCreditCode = creditCode.trim();
        payload.evidenceFileIds = evidenceFiles.map((item) => item.id);
        if (contactName.trim()) payload.contactName = contactName.trim();
        if (contactPhone.trim()) payload.contactPhone = contactPhone.trim();
        if (regionCode.trim()) payload.regionCode = regionCode.trim();
        if (intro.trim()) payload.intro = intro.trim();
        if (logoFile?.id) payload.logoFileId = logoFile.id;
      }

      if (isTechManager(type)) {
        payload.evidenceFileIds = evidenceFiles.map((item) => item.id);
        if (idNumber.trim()) payload.idNumber = idNumber.trim();
        if (contactPhone.trim()) payload.contactPhone = contactPhone.trim();
        if (regionCode.trim()) payload.regionCode = regionCode.trim();
        if (intro.trim()) payload.intro = intro.trim();
        if (serviceTags.length) payload.serviceTags = serviceTags;
        if (position.trim()) payload.position = position.trim();
        if (organization.trim()) payload.organization = organization.trim();
        if (serviceDirections.length) payload.serviceDirections = serviceDirections;
        if (workHighlights.trim()) payload.workHighlights = workHighlights.trim();
        if (experienceLabel.trim()) payload.experienceLabel = experienceLabel.trim();
        if (levelLabel.trim()) payload.levelLabel = levelLabel.trim();
      }

      const res = await apiPost<any>('/me/verification', payload, { idempotencyKey: `ver-${type}` });
      if (seq !== submitSeqRef.current || !pageVisibleRef.current) return;
      if (res?.status) setVerificationStatus(res.status);
      setOnboardingDone(true);
      toast('已提交，等待审核', { icon: 'success' });
      setTimeout(() => {
        if (seq !== submitSeqRef.current || !pageVisibleRef.current) return;
        Taro.switchTab({ url: '/pages/me/index' });
      }, 200);
    } catch (e: any) {
      if (seq !== submitSeqRef.current || !pageVisibleRef.current) return;
      toast(e?.message || '提交失败');
    }
  }, [
    contactName,
    contactPhone,
    creditCode,
    displayName,
    evidenceFiles,
    experienceLabel,
    idNumber,
    intro,
    levelLabel,
    logoFile,
    organization,
    position,
    regionCode,
    serviceDirections,
    serviceTags,
    type,
    workHighlights,
  ]);

  if (!type) {
    return (
      <View className="container">
        <ErrorCard title="请先选择身份" message="缺少认证类型" onRetry={() => Taro.navigateBack()} />
      </View>
    );
  }

  const regionLabel = regionDisplayName(regionCode, regionName, '');
  const introTip = isOrgType(type)
    ? '企业、院校、机构审核通过后会在对应主体页面对外展示，请确保信息真实、完整、可校验。'
    : isTechManager(type)
      ? '技术经理人审核通过后会展示在相关服务列表，请确保信息真实、完整、可校验。'
      : '个人信息仅用于审核与交易安全，不会公开展示。';

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
            <FormInput value={displayName} onChange={setDisplayName} placeholder="请与证件或主体名称保持一致" clearable />
          </View>

          {isOrgType(type) ? (
            <View className="form-field">
              <Text className="form-label">统一社会信用代码</Text>
              <FormInput value={creditCode} onChange={setCreditCode} placeholder="请输入 18 位统一社会信用代码" clearable />
              <Text className="form-hint">请填写证照上的完整代码。</Text>
            </View>
          ) : null}

          {isTechManager(type) || isPerson(type) ? (
            <View className="form-field">
              <Text className="form-label">证件号码（可选）</Text>
              <FormInput value={idNumber} onChange={setIdNumber} placeholder="用于身份校验，可不填写" clearable />
            </View>
          ) : null}
        </Surface>

        {isOrgType(type) || isTechManager(type) ? (
          <Surface className="verification-card">
            <SectionHeader title="联系人信息" subtitle="用于审核与平台沟通" density="compact" />

            {isOrgType(type) ? (
              <View className="form-field">
                <Text className="form-label">联系人</Text>
                <FormInput value={contactName} onChange={setContactName} placeholder="请输入联系人姓名" clearable />
              </View>
            ) : null}

            <View className="form-field">
              <Text className="form-label">联系电话</Text>
              <FormInput value={contactPhone} onChange={setContactPhone} placeholder="用于审核和联系" type="digit" clearable />
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
              <View className="form-field">
                <Text className="form-label">机构 LOGO（可选）</Text>
                <View className="form-row">
                  <View className="form-col">
                    <Button variant="ghost" loading={logoUploading} disabled={logoUploading} onClick={uploadLogo}>
                      {logoUploading ? '上传中...' : '上传 LOGO'}
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
                    <Text className="form-hint">点击可预览</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View className="form-field">
              <Text className="form-label">所在地区（可选）</Text>
              <View
                className="verification-region-select"
                onClick={() =>
                  openRegionPickerPage(({ code, name }) => {
                    setRegionCode(code);
                    setRegionName(name);
                  })
                }
              >
                <Text className={regionLabel ? 'verification-region-value' : 'verification-region-placeholder'}>
                  {regionLabel || '请选择地区'}
                </Text>
                <Text className="verification-region-arrow">{'>'}</Text>
              </View>
            </View>

            <View className="form-field">
              <Text className="form-label">简介（可选）</Text>
              <FormTextArea value={intro} onChange={setIntro} placeholder="简要介绍主体背景、方向或能力" maxLength={2000} />
            </View>

            {isTechManager(type) ? (
              <>
                <View className="form-field">
                  <Text className="form-label">职位/头衔（可选）</Text>
                  <FormInput value={position} onChange={setPosition} placeholder="例如：技术转移负责人、知识产权顾问" clearable />
                </View>

                <View className="form-field">
                  <Text className="form-label">所属机构（可选）</Text>
                  <FormInput value={organization} onChange={setOrganization} placeholder="请输入所在机构或团队名称" clearable />
                </View>

                <View className="form-field">
                  <Text className="form-label">服务方向（可选）</Text>
                  <FormTextArea
                    value={serviceDirectionsInput}
                    onChange={setServiceDirectionsInput}
                    placeholder="例如：专利运营、知识产权交易、成果转化，可用逗号或换行分隔"
                    maxLength={400}
                  />
                  <Text className="form-hint">当前识别到 {serviceDirections.length} 个方向。</Text>
                </View>

                <View className="form-field">
                  <Text className="form-label">工作亮点（可选）</Text>
                  <FormTextArea
                    value={workHighlights}
                    onChange={setWorkHighlights}
                    placeholder="可填写服务经历、代表项目、擅长场景等"
                    maxLength={2000}
                  />
                </View>

                <View className="form-field">
                  <Text className="form-label">从业信息（可选）</Text>
                  <FormInput value={experienceLabel} onChange={setExperienceLabel} placeholder="例如：10年成果转化服务经验" clearable />
                </View>

                <View className="form-field">
                  <Text className="form-label">展示等级（可选）</Text>
                  <FormInput value={levelLabel} onChange={setLevelLabel} placeholder="例如：资深顾问、高级经理人" clearable />
                </View>

                <View className="form-field">
                  <Text className="form-label">服务标签（可选）</Text>
                  <FormTextArea
                    value={serviceTagsInput}
                    onChange={setServiceTagsInput}
                    placeholder="例如：专利布局、成果转化、项目对接，可用逗号或换行分隔"
                    maxLength={400}
                  />
                  <Text className="form-hint">当前识别到 {serviceTags.length} 个标签。</Text>
                </View>
              </>
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
                {evidenceFiles.map((file, index) => (
                  <View
                    key={file.id}
                    className="list-item"
                    onClick={() => {
                      if (!file.url) return;
                      if (String(file.mimeType || '').startsWith('image/')) {
                        void Taro.previewImage({ urls: [String(file.url)] });
                        return;
                      }
                      void Taro.setClipboardData({ data: String(file.url) });
                      toast('链接已复制', { icon: 'success' });
                    }}
                  >
                    <View className="min-w-0" style={{ flex: 1 }}>
                      <Text className="text-strong">{`材料 ${index + 1}`}</Text>
                      <View style={{ height: '4rpx' }} />
                      <Text className="text-caption clamp-1">
                        {file.mimeType ? String(file.mimeType) : '文件'}
                        {typeof file.sizeBytes === 'number' ? ` / ${(file.sizeBytes / 1024).toFixed(0)}KB` : ''}
                      </Text>
                    </View>
                    <View style={{ width: '168rpx' }}>
                      <Button
                        variant="danger"
                        fill="outline"
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation();
                          void removeEvidence(file);
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
          提交后会进入“审核中”，审核通过后可进行发布与交易；若未通过，可按提示补充资料后再次提交。
        </TipBanner>

        <Surface className="verification-card">
          <Button onClick={submit}>提交并进入审核中</Button>
        </Surface>
      </View>
    </View>
  );
}
