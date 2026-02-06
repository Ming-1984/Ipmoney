import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { API_BASE_URL, STORAGE_KEYS } from '../../../constants';
import { getToken } from '../../../lib/auth';
import { apiGet, apiPatch, apiPost } from '../../../lib/api';
import { ensureApproved, requireLogin } from '../../../lib/guard';
import { auditStatusLabel, listingStatusLabel, patentTypeLabel } from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { IndustryTagsPicker } from '../../../ui/filters';
import { PageHeader, PopupSheet, StickyBar, Surface } from '../../../ui/layout';
import { Button, Cell, Input, Popup, TextArea, confirm, toast } from '../../../ui/nutui';

type PatentType = components['schemas']['PatentType'];
type TradeMode = components['schemas']['TradeMode'];
type LicenseMode = components['schemas']['LicenseMode'];
type PriceType = components['schemas']['PriceType'];
type AuditStatus = components['schemas']['AuditStatus'];
type ListingStatus = components['schemas']['ListingStatus'];

type Patent = components['schemas']['Patent'];
type Listing = components['schemas']['Listing'];
type ListingCreateRequest = components['schemas']['ListingCreateRequest'];
type ListingUpdateRequest = components['schemas']['ListingUpdateRequest'];
type FileObject = components['schemas']['FileObject'];
type UploadedFile = Pick<FileObject, 'id'> & Partial<Omit<FileObject, 'id'>>;

type PickerKey = 'patentType' | 'tradeMode' | 'licenseMode' | 'priceType';
type PickerOption = { value: string; label: string };
type PickerConfig = { title: string; value: string; options: PickerOption[] };

const PATENT_TYPE_OPTIONS: Array<{ value: PatentType; label: string }> = [
  { value: 'INVENTION', label: '发明' },
  { value: 'UTILITY_MODEL', label: '实用新型' },
  { value: 'DESIGN', label: '外观设计' },
];

const TRADE_MODE_OPTIONS: Array<{ value: TradeMode; label: string }> = [
  { value: 'ASSIGNMENT', label: '转让' },
  { value: 'LICENSE', label: '许可' },
];

const LICENSE_MODE_OPTIONS: Array<{ value: LicenseMode; label: string }> = [
  { value: 'EXCLUSIVE', label: '独占许可' },
  { value: 'SOLE', label: '排他许可' },
  { value: 'NON_EXCLUSIVE', label: '普通许可' },
];

const PRICE_TYPE_OPTIONS: Array<{ value: PriceType; label: string }> = [
  { value: 'FIXED', label: '一口价' },
  { value: 'NEGOTIABLE', label: '面议' },
];

function tradeModeLabel(value: TradeMode): string {
  if (value === 'ASSIGNMENT') return '转让';
  if (value === 'LICENSE') return '许可';
  return String(value);
}

function licenseModeLabel(value: LicenseMode): string {
  if (value === 'EXCLUSIVE') return '独占许可';
  if (value === 'SOLE') return '排他许可';
  if (value === 'NON_EXCLUSIVE') return '普通许可';
  return String(value);
}

function priceTypeLabel(value: PriceType): string {
  if (value === 'FIXED') return '一口价';
  if (value === 'NEGOTIABLE') return '面议';
  return String(value);
}

function splitList(input: string): string[] {
  return (input || '')
    .split(/[,，;；\n]/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
}

const EXTRA_SUMMARY_MARKER = '【补充信息】';

function buildExtraSummary(input: {
  deliverables: string;
  expectedCycle: string;
  negotiableSpace: string;
  pledgeStatus: string;
}): string {
  const parts: string[] = [];
  if (input.deliverables.trim()) parts.push(`可交付资料：${input.deliverables.trim()}`);
  if (input.expectedCycle.trim()) parts.push(`预计周期：${input.expectedCycle.trim()}`);
  if (input.negotiableSpace.trim()) parts.push(`可谈空间：${input.negotiableSpace.trim()}`);
  if (input.pledgeStatus.trim()) parts.push(`质押/许可现状：${input.pledgeStatus.trim()}`);
  if (!parts.length) return '';
  return `${EXTRA_SUMMARY_MARKER}\n${parts.join('\n')}`.trim();
}

function mergeSummary(
  base: string,
  input: {
    deliverables: string;
    expectedCycle: string;
    negotiableSpace: string;
    pledgeStatus: string;
  },
): string {
  const baseText = (base || '').trim();
  const extra = buildExtraSummary(input);
  if (!extra) return baseText;
  if (!baseText) return extra;
  return `${baseText}\n\n${extra}`.trim();
}

function extractExtraSummary(raw: string): {
  base: string;
  deliverables: string;
  expectedCycle: string;
  negotiableSpace: string;
  pledgeStatus: string;
} {
  const text = String(raw || '');
  const idx = text.indexOf(EXTRA_SUMMARY_MARKER);
  if (idx === -1) {
    return { base: text, deliverables: '', expectedCycle: '', negotiableSpace: '', pledgeStatus: '' };
  }
  const base = text.slice(0, idx).trimEnd();
  const extraBlock = text.slice(idx + EXTRA_SUMMARY_MARKER.length).trim();
  const extras = { deliverables: '', expectedCycle: '', negotiableSpace: '', pledgeStatus: '' };
  extraBlock
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [keyRaw, ...rest] = line.split(/[:：]/);
      const value = rest.join(':').trim();
      const key = keyRaw.trim();
      if (key.includes('可交付资料')) extras.deliverables = value;
      if (key.includes('预计周期')) extras.expectedCycle = value;
      if (key.includes('可谈空间')) extras.negotiableSpace = value;
      if (key.includes('质押')) extras.pledgeStatus = value;
    });
  return { base, ...extras };
}

function parseMoneyFen(input: string): number | null {
  const s = (input || '').trim().replace(/,/g, '');
  if (!s) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [a, bRaw] = s.split('.', 2);
  const b = (bRaw || '').padEnd(2, '0').slice(0, 2);
  const yuan = Number(a);
  const fen = Number(b);
  if (!Number.isFinite(yuan) || !Number.isFinite(fen)) return null;
  return yuan * 100 + fen;
}

function mergePlaceholderClass(extra?: string): string {
  return extra ? `publish-placeholder ${extra}` : 'publish-placeholder';
}

function mergePlaceholderStyle(extra?: string): string {
  const base = 'font-size:20rpx;color:#c0c4cc;';
  if (!extra) return base;
  return `${base}${extra}`;
}

function PublishInput(props: React.ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      placeholderClass={mergePlaceholderClass(props.placeholderClass)}
      placeholderStyle={mergePlaceholderStyle(props.placeholderStyle)}
    />
  );
}

function PublishTextArea(props: React.ComponentProps<typeof TextArea>) {
  return (
    <TextArea
      {...props}
      placeholderClass={mergePlaceholderClass(props.placeholderClass)}
      placeholderStyle={mergePlaceholderStyle(props.placeholderStyle)}
    />
  );
}

export default function PublishPatentPage() {
  const router = useRouter();
  const initialListingId = useMemo(() => String(router?.params?.listingId || ''), [router?.params?.listingId]);

  const [listingId, setListingId] = useState<string | null>(null);
  const [auditStatus, setAuditStatus] = useState<AuditStatus | null>(null);
  const [listingStatus, setListingStatus] = useState<ListingStatus | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [patentNumberRaw, setPatentNumberRaw] = useState('');

  const [patentType, setPatentType] = useState<PatentType | ''>('');
  const [title, setTitle] = useState('');
  const [inventorNamesInput, setInventorNamesInput] = useState('');
  const [assigneeNamesInput, setAssigneeNamesInput] = useState('');
  const [applicantNamesInput, setApplicantNamesInput] = useState('');
  const [summary, setSummary] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [expectedCycle, setExpectedCycle] = useState('');
  const [negotiableSpace, setNegotiableSpace] = useState('');
  const [pledgeStatus, setPledgeStatus] = useState('');

  const [tradeMode, setTradeMode] = useState<TradeMode | ''>('');
  const [licenseMode, setLicenseMode] = useState<LicenseMode | ''>('');
  const [priceType, setPriceType] = useState<PriceType | ''>('');
  const [priceYuan, setPriceYuan] = useState('');
  const [depositYuan, setDepositYuan] = useState('');

  const [regionCode, setRegionCode] = useState('');
  const [industryTags, setIndustryTags] = useState<string[]>([]);
  const [ipcCodesInput, setIpcCodesInput] = useState('');
  const [locCodesInput, setLocCodesInput] = useState('');

  const [uploading, setUploading] = useState(false);
  const [proofFiles, setProofFiles] = useState<UploadedFile[]>([]);

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<PickerKey | null>(null);

  const inventorNames = useMemo(() => splitList(inventorNamesInput), [inventorNamesInput]);
  const assigneeNames = useMemo(() => splitList(assigneeNamesInput), [assigneeNamesInput]);
  const applicantNames = useMemo(() => splitList(applicantNamesInput), [applicantNamesInput]);
  const ipcCodes = useMemo(() => splitList(ipcCodesInput), [ipcCodesInput]);
  const locCodes = useMemo(() => splitList(locCodesInput), [locCodesInput]);

  const uploadProof = useCallback(async () => {
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
        formData: { purpose: 'PATENT_PROOF' },
        header: {
          'X-Mock-Scenario': scenario,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const json = JSON.parse(String(uploadRes.data || '{}')) as Partial<FileObject>;
      if (!json.id) throw new Error('上传失败');
      setProofFiles((prev) => [...prev, json as UploadedFile]);
      toast('已上传', { icon: 'success' });
    } catch (e: any) {
      if (e?.errMsg?.includes('cancel')) return;
      toast(e?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  }, [uploading]);

  const removeProof = useCallback(async (f: UploadedFile) => {
    const ok = await confirm({ title: '移除材料', content: '确定移除该材料？', confirmText: '移除', cancelText: '取消' });
    if (!ok) return;
    setProofFiles((prev) => prev.filter((x) => x.id !== f.id));
  }, []);

  useEffect(() => {
    if (!initialListingId) return;
    if (listingId) return;

    (async () => {
      if (!ensureApproved()) return;
      try {
        const d = await apiGet<Listing>(`/listings/${initialListingId}`);
        setListingId(d.id);
        setAuditStatus(d.auditStatus);
        setListingStatus(d.status);
        setSubmitted(d.auditStatus === 'PENDING' || d.auditStatus === 'APPROVED' || d.auditStatus === 'REJECTED');

        setPatentNumberRaw(d.applicationNoDisplay || '');
        setPatentType((d.patentType || '') as PatentType | '');
        setTitle(d.title || '');
        setInventorNamesInput((d.inventorNames || []).join(', '));
        {
          const parsed = extractExtraSummary(d.summary || '');
          setSummary(parsed.base || '');
          setDeliverables(parsed.deliverables || '');
          setExpectedCycle(parsed.expectedCycle || '');
          setNegotiableSpace(parsed.negotiableSpace || '');
          setPledgeStatus(parsed.pledgeStatus || '');
        }

        setTradeMode((d.tradeMode || '') as TradeMode | '');
        setLicenseMode((d.licenseMode || '') as LicenseMode | '');
        setPriceType((d.priceType || '') as PriceType | '');
        setPriceYuan(d.priceAmountFen !== undefined && d.priceAmountFen !== null ? fenToYuan(d.priceAmountFen, { empty: '' }) : '');
        setDepositYuan(d.depositAmountFen !== undefined && d.depositAmountFen !== null ? fenToYuan(d.depositAmountFen, { empty: '' }) : '');

        setRegionCode(d.regionCode || '');
        setIndustryTags(Array.isArray(d.industryTags) ? d.industryTags : []);
        setIpcCodesInput((d.ipcCodes || []).join(', '));
        setLocCodesInput((d.locCodes || []).join(', '));
        setProofFiles(((d.proofFileIds || []) as unknown as string[]).map((id) => ({ id: String(id) })));

        if (d.patentId) {
          try {
            const p = await apiGet<Patent>(`/patents/${d.patentId}`);
            setAssigneeNamesInput((p.assigneeNames || []).join(', '));
            setApplicantNamesInput((p.applicantNames || []).join(', '));
          } catch (_) {
            // ignore: optional enrichment
          }
        }
      } catch (e: any) {
        toast(e?.message || '加载草稿失败');
      }
    })();
  }, [ensureApproved, initialListingId, listingId]);

  const validateAndBuildCreate = useCallback(
    (mode: 'save' | 'submit'): ListingCreateRequest | null => {
      const raw = patentNumberRaw.trim();
      if (!raw) {
        toast('请输入专利号/申请号');
        return null;
      }
      if (!patentType) {
        toast('请选择专利类型');
        return null;
      }
      if (!tradeMode) {
        toast('请选择交易方式');
        return null;
      }
      if (tradeMode === 'LICENSE' && !licenseMode) {
        toast('请选择许可方式');
        return null;
      }
      if (!priceType) {
        toast('请选择价格类型');
        return null;
      }

      const priceAmountFen = priceType === 'FIXED' ? parseMoneyFen(priceYuan) : null;
      if (priceType === 'FIXED' && priceAmountFen === null) {
        toast('请填写一口价（元）');
        return null;
      }

      const depositAmountFen = parseMoneyFen(depositYuan);
      if (depositYuan.trim() && depositAmountFen === null) {
        toast('订金金额格式不正确');
        return null;
      }

      if (mode === 'submit' && !proofFiles.length) {
        toast('请上传权属材料/证明');
        return null;
      }

      const summaryValue = mergeSummary(summary, {
        deliverables,
        expectedCycle,
        negotiableSpace,
        pledgeStatus,
      });

      const req: ListingCreateRequest = {
        patentNumberRaw: raw,
        patentType,
        tradeMode,
        priceType,
        ...(tradeMode === 'LICENSE' ? { licenseMode: licenseMode as LicenseMode } : {}),
        ...(priceType === 'FIXED' ? { priceAmountFen: priceAmountFen as number } : {}),
        ...(depositAmountFen !== null ? { depositAmountFen } : {}),
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(summaryValue ? { summary: summaryValue } : {}),
        ...(inventorNames.length ? { inventorNames } : {}),
        ...(assigneeNames.length ? { assigneeNames } : {}),
        ...(applicantNames.length ? { applicantNames } : {}),
        ...(regionCode.trim() ? { regionCode: regionCode.trim() } : {}),
        ...(industryTags.length ? { industryTags } : {}),
        ...(ipcCodes.length ? { ipcCodes } : {}),
        ...(locCodes.length ? { locCodes } : {}),
        ...(proofFiles.length ? { proofFileIds: proofFiles.map((f) => f.id) } : {}),
      };
      return req;
    },
    [
      applicantNames,
      assigneeNames,
      deliverables,
      depositYuan,
      expectedCycle,
      inventorNames,
      industryTags,
      ipcCodes,
      licenseMode,
      locCodes,
      negotiableSpace,
      patentNumberRaw,
      patentType,
      pledgeStatus,
      priceType,
      priceYuan,
      proofFiles,
      regionCode,
      summary,
      title,
      tradeMode,
    ],
  );

  const buildUpdate = useCallback(
    (mode: 'save' | 'submit'): ListingUpdateRequest | null => {
      if (!listingId) return null;
      if (!tradeMode) {
        toast('请选择交易方式');
        return null;
      }
      if (tradeMode === 'LICENSE' && !licenseMode) {
        toast('请选择许可方式');
        return null;
      }
      if (!priceType) {
        toast('请选择价格类型');
        return null;
      }

      const priceAmountFen = priceType === 'FIXED' ? parseMoneyFen(priceYuan) : null;
      if (priceType === 'FIXED' && priceAmountFen === null) {
        toast('请填写一口价（元）');
        return null;
      }

      const depositAmountFen = parseMoneyFen(depositYuan);
      if (depositYuan.trim() && depositAmountFen === null) {
        toast('订金金额格式不正确');
        return null;
      }

      if (mode === 'submit' && !proofFiles.length) {
        toast('请上传权属材料/证明');
        return null;
      }

      const summaryValue = mergeSummary(summary, {
        deliverables,
        expectedCycle,
        negotiableSpace,
        pledgeStatus,
      });

      const req: ListingUpdateRequest = {
        tradeMode,
        priceType,
        ...(tradeMode === 'LICENSE' ? { licenseMode: licenseMode as LicenseMode } : {}),
        ...(priceType === 'FIXED' ? { priceAmountFen: priceAmountFen as number } : {}),
        ...(depositAmountFen !== null ? { depositAmountFen } : {}),
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(summaryValue ? { summary: summaryValue } : {}),
        ...(inventorNames.length ? { inventorNames } : {}),
        ...(assigneeNames.length ? { assigneeNames } : {}),
        ...(applicantNames.length ? { applicantNames } : {}),
        ...(regionCode.trim() ? { regionCode: regionCode.trim() } : {}),
        ...(industryTags.length ? { industryTags } : {}),
        ...(ipcCodes.length ? { ipcCodes } : {}),
        ...(locCodes.length ? { locCodes } : {}),
        ...(proofFiles.length ? { proofFileIds: proofFiles.map((f) => f.id) } : {}),
      };
      return req;
    },
    [
      applicantNames,
      assigneeNames,
      deliverables,
      depositYuan,
      expectedCycle,
      inventorNames,
      industryTags,
      ipcCodes,
      licenseMode,
      listingId,
      locCodes,
      negotiableSpace,
      pledgeStatus,
      priceType,
      priceYuan,
      proofFiles,
      regionCode,
      summary,
      title,
      tradeMode,
    ],
  );

  const saveDraft = useCallback(async () => {
    if (saving || submitting) return;
    if (!ensureApproved()) return;
    setSaving(true);
    try {
      let res: Listing;
      if (!listingId) {
        const req = validateAndBuildCreate('save');
        if (!req) return;
        res = await apiPost<Listing>('/listings', req, { idempotencyKey: `demo-listing-create-${req.patentNumberRaw}` });
        setListingId(res.id);
      } else {
        const req = buildUpdate('save');
        if (!req) return;
        res = await apiPatch<Listing>(`/listings/${listingId}`, req, { idempotencyKey: `demo-listing-patch-${listingId}` });
      }
      setAuditStatus(res.auditStatus);
      setListingStatus(res.status);
      setSubmitted(false);
      toast('草稿已保存', { icon: 'success' });
    } catch (e: any) {
      toast(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [buildUpdate, listingId, saving, submitting, validateAndBuildCreate]);

  const submitForAudit = useCallback(async () => {
    if (saving || submitting) return;
    if (!ensureApproved()) return;

    const ok = await confirm({
      title: '提交审核',
      content: '提交后将进入“审核中”，审核通过后对外展示；合同线下签署，尾款走平台支付。',
      confirmText: '提交',
      cancelText: '再检查一下',
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      let id = listingId;
      if (!id) {
        const req = validateAndBuildCreate('submit');
        if (!req) return;
        const created = await apiPost<Listing>('/listings', req, { idempotencyKey: `demo-listing-create-${req.patentNumberRaw}` });
        id = created.id;
        setListingId(created.id);
        setAuditStatus(created.auditStatus);
        setListingStatus(created.status);
      } else {
        const req = buildUpdate('submit');
        if (!req) return;
        const updated = await apiPatch<Listing>(`/listings/${id}`, req, { idempotencyKey: `demo-listing-patch-${id}` });
        setAuditStatus(updated.auditStatus);
        setListingStatus(updated.status);
      }

      const res = await apiPost<Listing>(`/listings/${id}/submit`, {}, { idempotencyKey: `demo-listing-submit-${id}` });
      setAuditStatus(res.auditStatus);
      setListingStatus(res.status);
      setSubmitted(true);
      toast('已提交审核', { icon: 'success' });
    } catch (e: any) {
      toast(e?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  }, [buildUpdate, listingId, saving, submitting, validateAndBuildCreate]);

  const pickerConfig = useMemo<PickerConfig | null>(() => {
    if (!pickerOpen) return null;
    if (pickerOpen === 'patentType') {
      return {
        title: '专利类型',
        value: patentType || '',
        options: PATENT_TYPE_OPTIONS as PickerOption[],
      };
    }
    if (pickerOpen === 'tradeMode') {
      return {
        title: '交易方式',
        value: tradeMode || '',
        options: TRADE_MODE_OPTIONS as PickerOption[],
      };
    }
    if (pickerOpen === 'licenseMode') {
      return {
        title: '许可方式',
        value: licenseMode || '',
        options: LICENSE_MODE_OPTIONS as PickerOption[],
      };
    }
    if (pickerOpen === 'priceType') {
      return {
        title: '价格类型',
        value: priceType || '',
        options: PRICE_TYPE_OPTIONS as PickerOption[],
      };
    }
    return null;
  }, [licenseMode, patentType, pickerOpen, priceType, tradeMode]);

  const onPickOption = useCallback(
    (value: string) => {
      if (!pickerOpen) return;
      if (pickerOpen === 'patentType') {
        setPatentType(value as PatentType);
      } else if (pickerOpen === 'tradeMode') {
        setTradeMode(value as TradeMode);
        if (value !== 'LICENSE') setLicenseMode('');
      } else if (pickerOpen === 'licenseMode') {
        setLicenseMode(value as LicenseMode);
      } else if (pickerOpen === 'priceType') {
        setPriceType(value as PriceType);
        if (value !== 'FIXED') setPriceYuan('');
      }
      setPickerOpen(null);
    },
    [pickerOpen],
  );

  return (
    <View className="container has-sticky publish-patent-page">
      <PageHeader title="发布专利" brand={false} />
      <View className="publish-form">
        {submitted ? (
          <Surface className="publish-card publish-status-card" padding="none">
            <Text className="publish-section-title">已提交审核</Text>
            <Text className="form-hint">资料已提交，审核通过后将自动上架，请留意消息通知。</Text>
            <Text className="form-hint">上架 ID：{listingId || '-'}</Text>
          </Surface>
        ) : null}

        <Surface className="publish-card" padding="none">
          <Text className="publish-section-title">专利信息</Text>

          <View className="form-field">
            <Text className="form-label">专利号/申请号/公开号 *</Text>
            <PublishInput
              className="publish-input"
              value={patentNumberRaw}
              onChange={setPatentNumberRaw}
              placeholder="例如 202311340972.0 / CN2023xxxxxx.x"
              clearable
              disabled={Boolean(listingId)}
            />
            {listingId ? <Text className="form-hint">专利号已锁定，如需修改请新建发布。</Text> : null}
          </View>

          <View className="form-field">
            <Text className="form-label">专利标题</Text>
            <PublishInput
              className="publish-input"
              value={title}
              onChange={setTitle}
              placeholder="例如：锂离子电池冷却系统"
              clearable
            />
          </View>

          <View className="form-row form-row-split">
            <View className="form-col">
              <Text className="form-label">专利类型 *</Text>
              <View className="form-select" onClick={() => setPickerOpen('patentType')}>
                <Text
                  className={patentType ? 'form-select-value' : 'form-select-placeholder'}
                  style={patentType ? undefined : { fontSize: '20rpx', color: '#9ca3af' }}
                >
                  {patentType ? patentTypeLabel(patentType) : '请选择'}
                </Text>
                <Text className="form-select-arrow">▾</Text>
              </View>
            </View>
            <View className="form-col">
              <Text className="form-label">交易方式 *</Text>
              <View className="form-select" onClick={() => setPickerOpen('tradeMode')}>
                <Text
                  className={tradeMode ? 'form-select-value' : 'form-select-placeholder'}
                  style={tradeMode ? undefined : { fontSize: '20rpx', color: '#9ca3af' }}
                >
                  {tradeMode ? tradeModeLabel(tradeMode as TradeMode) : '请选择'}
                </Text>
                <Text className="form-select-arrow">▾</Text>
              </View>
            </View>
          </View>

          {tradeMode === 'LICENSE' ? (
            <View className="form-field">
              <Text className="form-label">许可方式 *</Text>
              <View className="form-select" onClick={() => setPickerOpen('licenseMode')}>
                <Text
                  className={licenseMode ? 'form-select-value' : 'form-select-placeholder'}
                  style={licenseMode ? undefined : { fontSize: '20rpx', color: '#9ca3af' }}
                >
                  {licenseMode ? licenseModeLabel(licenseMode as LicenseMode) : '请选择'}
                </Text>
                <Text className="form-select-arrow">▾</Text>
              </View>
            </View>
          ) : null}

          <View className="form-field">
            <Text className="form-label">发明人</Text>
            <PublishInput
              className="publish-input"
              value={inventorNamesInput}
              onChange={setInventorNamesInput}
              placeholder="多个用逗号分隔"
              clearable
            />
          </View>

          <View className="form-field">
            <Text className="form-label">权利人/专利权人</Text>
            <PublishInput
              className="publish-input"
              value={assigneeNamesInput}
              onChange={setAssigneeNamesInput}
              placeholder="多个用逗号分隔"
              clearable
            />
          </View>

          <View className="form-field">
            <Text className="form-label">申请人</Text>
            <PublishInput
              className="publish-input"
              value={applicantNamesInput}
              onChange={setApplicantNamesInput}
              placeholder="多个用逗号分隔"
              clearable
            />
          </View>

          <View className="form-field">
            <Text className="form-label">摘要/卖点</Text>
            <PublishTextArea
              className="publish-textarea"
              value={summary}
              onChange={setSummary}
              placeholder="填写摘要/技术亮点/应用场景"
              maxLength={2000}
            />
          </View>

          <View className="form-field">
            <Text className="form-label">可交付资料清单</Text>
            <PublishTextArea
              className="publish-textarea"
              value={deliverables}
              onChange={setDeliverables}
              placeholder="例如：专利证书、权属证明、技术交底书等"
              maxLength={1000}
            />
          </View>

          <View className="form-field">
            <Text className="form-label">预计周期</Text>
            <PublishInput
              className="publish-input"
              value={expectedCycle}
              onChange={setExpectedCycle}
              placeholder="例如：1-2个月 / 45天"
              clearable
            />
          </View>

          <View className="form-field">
            <Text className="form-label">可谈空间</Text>
            <PublishInput
              className="publish-input"
              value={negotiableSpace}
              onChange={setNegotiableSpace}
              placeholder="例如：价格可议 / 可协商交易条款"
              clearable
            />
          </View>

          <View className="form-field">
            <Text className="form-label">质押/许可现状声明</Text>
            <PublishTextArea
              className="publish-textarea"
              value={pledgeStatus}
              onChange={setPledgeStatus}
              placeholder="例如：未质押；无在许可；或说明已有许可情况"
              maxLength={500}
            />
          </View>

          <View className="form-row form-row-split">
            <View className="form-col">
              <Text className="form-label">IPC 分类号</Text>
              <PublishInput
                className="publish-input"
                value={ipcCodesInput}
                onChange={setIpcCodesInput}
                placeholder="例如 H01M 10/60"
                clearable
              />
            </View>
            <View className="form-col">
              <Text className="form-label">LOC 分类号</Text>
              <PublishInput
                className="publish-input"
                value={locCodesInput}
                onChange={setLocCodesInput}
                placeholder="例如 12-08"
                clearable
              />
            </View>
          </View>

          <View className="form-field">
            <Text className="form-label">所在地区</Text>
            <View className="form-row">
              <View className="form-flex">
                <PublishInput
                  className="publish-input"
                  value={regionCode}
                  onChange={setRegionCode}
                  placeholder="省/市/区"
                  clearable
                />
              </View>
              <Button
                className="form-inline-btn"
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

          <View className="form-field">
            <Text className="form-label">行业标签</Text>
            <IndustryTagsPicker value={industryTags} max={8} onChange={setIndustryTags} />
          </View>

          <Text className="publish-section-subtitle">权属证明材料 *</Text>
          <Text className="form-hint">上传专利证书/权属证明/授权链路等材料，至少 1 份</Text>

          <View className="upload-box" onClick={uploadProof}>
            <Text className="upload-title">{uploading ? '上传中' : '上传权属材料'}</Text>
            <Text className="upload-subtitle">图片/附件</Text>
          </View>

          {proofFiles.length ? (
            <View className="upload-list">
              {proofFiles.map((f, idx) => (
                <View
                  key={f.id}
                  className="upload-item"
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
                  <View className="upload-item-info">
                    <Text className="upload-item-title">材料 {idx + 1}</Text>
                    <Text className="upload-item-desc">
                      {f.url ? '可预览/复制' : '已上传'}
                      {f.mimeType ? ` · ${String(f.mimeType)}` : ''}
                      {typeof f.sizeBytes === 'number' ? ` · ${(f.sizeBytes / 1024).toFixed(0)}KB` : ''}
                    </Text>
                  </View>
                  <Button
                    className="upload-item-remove"
                    variant="danger"
                    fill="outline"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeProof(f);
                    }}
                  >
                    删除
                  </Button>
                </View>
              ))}
            </View>
          ) : null}
        </Surface>

        <Surface className="publish-card" padding="none">
          <Text className="publish-section-title">价格设置</Text>

          <View className="form-field">
            <Text className="form-label">价格类型 *</Text>
            <View className="form-select" onClick={() => setPickerOpen('priceType')}>
              <Text
                className={priceType ? 'form-select-value' : 'form-select-placeholder'}
                style={priceType ? undefined : { fontSize: '20rpx', color: '#9ca3af' }}
              >
                {priceType ? priceTypeLabel(priceType as PriceType) : '请选择'}
              </Text>
              <Text className="form-select-arrow">▾</Text>
            </View>
          </View>

          {priceType === 'FIXED' ? (
            <View className="form-field">
              <Text className="form-label">标价（元）*</Text>
              <PublishInput
                className="publish-input"
                value={priceYuan}
                onChange={setPriceYuan}
                placeholder="例如 288000"
                type="digit"
                clearable
              />
            </View>
          ) : null}

          <View className="form-field">
            <Text className="form-label">订金（元）</Text>
            <PublishInput
              className="publish-input"
              value={depositYuan}
              onChange={setDepositYuan}
              placeholder="例如 2000"
              type="digit"
              clearable
            />
            <Text className="form-hint">订金用于锁定买家意向</Text>
          </View>
        </Surface>

        <Surface className="publish-card publish-status-card" padding="none">
          <Text className="form-hint">
            当前状态：
            {listingId
              ? `${listingStatus ? listingStatusLabel(listingStatus) : '草稿'} / ${
                  auditStatus ? auditStatusLabel(auditStatus) : '待审核'
                }`
              : '未保存'}
          </Text>
        </Surface>
      </View>

      <StickyBar>
        {submitted ? (
          <>
            <View style={{ flex: 1 }}>
              <Button
                className="publish-action-btn publish-action-ghost"
                variant="ghost"
                onClick={() => Taro.switchTab({ url: '/pages/home/index' })}
              >
                返回首页
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button className="publish-action-btn publish-action-primary" onClick={() => Taro.switchTab({ url: '/pages/me/index' })}>
                个人中心
              </Button>
            </View>
          </>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <Button
                className="publish-action-btn publish-action-ghost"
                variant="ghost"
                loading={saving}
                disabled={saving || submitting}
                onClick={() => void saveDraft()}
              >
                保存草稿
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button
                className="publish-action-btn publish-action-primary"
                loading={submitting}
                disabled={saving || submitting}
                onClick={() => void submitForAudit()}
              >
                提交审核
              </Button>
            </View>
          </>
        )}
      </StickyBar>

      {pickerConfig ? (
        <Popup
          visible={Boolean(pickerConfig)}
          position="bottom"
          round
          closeable
          title={pickerConfig.title}
          onClose={() => setPickerOpen(null)}
          onOverlayClick={() => setPickerOpen(null)}
        >
          <PopupSheet scrollable={false} bodyClassName="publish-picker-sheet">
            <View className="publish-picker-options">
              {pickerConfig.options.map((option) => (
                <Cell
                  key={String(option.value)}
                  title={option.label}
                  className={pickerConfig.value === option.value ? 'publish-picker-active' : ''}
                  onClick={() => onPickOption(String(option.value))}
                />
              ))}
            </View>
          </PopupSheet>
        </Popup>
      ) : null}
    </View>
  );
}
