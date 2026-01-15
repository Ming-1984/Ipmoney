import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { API_BASE_URL, STORAGE_KEYS } from '../../../constants';
import { getToken } from '../../../lib/auth';
import { apiGet, apiPatch, apiPost } from '../../../lib/api';
import { ensureApproved, requireLogin } from '../../../lib/guard';
import { auditStatusLabel, listingStatusLabel, patentTypeLabel } from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { IndustryTagsPicker } from '../../../ui/filters';
import { PageHeader, Spacer, StickyBar } from '../../../ui/layout';
import { Button, Input, TextArea, confirm, toast } from '../../../ui/nutui';

type PatentType = components['schemas']['PatentType'];
type TradeMode = components['schemas']['TradeMode'];
type LicenseMode = components['schemas']['LicenseMode'];
type PriceType = components['schemas']['PriceType'];
type AuditStatus = components['schemas']['AuditStatus'];
type ListingStatus = components['schemas']['ListingStatus'];

type PatentNormalizeResponse = components['schemas']['PatentNormalizeResponse'];
type Patent = components['schemas']['Patent'];
type Listing = components['schemas']['Listing'];
type ListingCreateRequest = components['schemas']['ListingCreateRequest'];
type ListingUpdateRequest = components['schemas']['ListingUpdateRequest'];
type FileObject = components['schemas']['FileObject'];
type UploadedFile = Pick<FileObject, 'id'> & Partial<Omit<FileObject, 'id'>>;

function splitList(input: string): string[] {
  return (input || '')
    .split(/[,，;；\n]/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
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

export default function PublishPatentPage() {
  const router = useRouter();
  const initialListingId = useMemo(() => String(router?.params?.listingId || ''), [router?.params?.listingId]);

  const [listingId, setListingId] = useState<string | null>(null);
  const [auditStatus, setAuditStatus] = useState<AuditStatus | null>(null);
  const [listingStatus, setListingStatus] = useState<ListingStatus | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [patentNumberRaw, setPatentNumberRaw] = useState('');
  const [normalizeResult, setNormalizeResult] = useState<PatentNormalizeResponse | null>(null);
  const [normalizing, setNormalizing] = useState(false);

  const [patentType, setPatentType] = useState<PatentType | ''>('');
  const [title, setTitle] = useState('');
  const [inventorNamesInput, setInventorNamesInput] = useState('');
  const [assigneeNamesInput, setAssigneeNamesInput] = useState('');
  const [applicantNamesInput, setApplicantNamesInput] = useState('');
  const [summary, setSummary] = useState('');

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

  const inventorNames = useMemo(() => splitList(inventorNamesInput), [inventorNamesInput]);
  const assigneeNames = useMemo(() => splitList(assigneeNamesInput), [assigneeNamesInput]);
  const applicantNames = useMemo(() => splitList(applicantNamesInput), [applicantNamesInput]);
  const ipcCodes = useMemo(() => splitList(ipcCodesInput), [ipcCodesInput]);
  const locCodes = useMemo(() => splitList(locCodesInput), [locCodesInput]);

  const normalize = useCallback(async () => {
    if (normalizing) return;
    const raw = patentNumberRaw.trim();
    if (!raw) {
      toast('请输入专利号/申请号');
      return;
    }

    setNormalizing(true);
    try {
      const r = await apiPost<PatentNormalizeResponse>('/patents/normalize', { raw });
      setNormalizeResult(r);
      if (r.patentType && !patentType) setPatentType(r.patentType);
      toast('解析成功', { icon: 'success' });
    } catch (e: any) {
      setNormalizeResult(null);
      toast(e?.message || '解析失败');
    } finally {
      setNormalizing(false);
    }
  }, [normalizing, patentNumberRaw, patentType]);

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
        setSummary(d.summary || '');

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

      const req: ListingCreateRequest = {
        patentNumberRaw: raw,
        patentType,
        tradeMode,
        priceType,
        ...(tradeMode === 'LICENSE' ? { licenseMode: licenseMode as LicenseMode } : {}),
        ...(priceType === 'FIXED' ? { priceAmountFen: priceAmountFen as number } : {}),
        ...(depositAmountFen !== null ? { depositAmountFen } : {}),
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(summary.trim() ? { summary: summary.trim() } : {}),
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
      depositYuan,
      inventorNames,
      industryTags,
      ipcCodes,
      licenseMode,
      locCodes,
      patentNumberRaw,
      patentType,
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

      const req: ListingUpdateRequest = {
        tradeMode,
        priceType,
        ...(tradeMode === 'LICENSE' ? { licenseMode: licenseMode as LicenseMode } : {}),
        ...(priceType === 'FIXED' ? { priceAmountFen: priceAmountFen as number } : {}),
        ...(depositAmountFen !== null ? { depositAmountFen } : {}),
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(summary.trim() ? { summary: summary.trim() } : {}),
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
      depositYuan,
      inventorNames,
      industryTags,
      ipcCodes,
      licenseMode,
      listingId,
      locCodes,
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

  return (
    <View className="container has-sticky">
      <PageHeader title="发布：专利交易" />
      <Spacer />

      {submitted ? (
        <>
          <View className="card card-state">
            <Text className="text-title">已提交审核</Text>
            <View style={{ height: '8rpx' }} />
            <Text className="muted">
              审核通过后将展示在检索/最新专利；合同线下签署后再回到平台支付尾款，变更完成后再放款给卖家。
            </Text>
            <View style={{ height: '10rpx' }} />
            <Text className="muted">草稿 ID：{listingId || '-'}</Text>
          </View>
          <Spacer />
        </>
      ) : null}

      <View className="card">
        <View className="row-between">
          <Text className="text-section">1) 专利信息</Text>
          {normalizeResult?.patentType ? (
            <Text className="tag tag-gold">已识别：{patentTypeLabel(normalizeResult.patentType)}</Text>
          ) : null}
        </View>
        <View style={{ height: '12rpx' }} />

        <Text className="muted">专利号 / 申请号（必填）</Text>
        <View style={{ height: '8rpx' }} />
        <Input
          value={patentNumberRaw}
          onChange={setPatentNumberRaw}
          placeholder="例：202311340972.0 / CN2023xxxxxx.x"
          clearable
          disabled={Boolean(listingId)}
        />
        {listingId ? (
          <>
            <View style={{ height: '8rpx' }} />
            <Text className="muted">已生成草稿后专利号不可修改；如需修改请返回重新发布。</Text>
          </>
        ) : null}

        <View style={{ height: '12rpx' }} />
        <Button variant="ghost" loading={normalizing} disabled={normalizing} onClick={() => void normalize()}>
          {normalizing ? '解析中…' : '解析与规范化'}
        </Button>

        {normalizeResult ? (
          <>
            <View style={{ height: '12rpx' }} />
            <View className="card" style={{ background: '#fff', borderRadius: '16rpx', padding: '16rpx' }}>
              <Text className="muted">输入类型：{normalizeResult.inputType}</Text>
              <View style={{ height: '4rpx' }} />
              <Text className="muted">申请号：{normalizeResult.applicationNoDisplay || '-'}</Text>
              <View style={{ height: '4rpx' }} />
              <Text className="muted">公开(公告)号：{normalizeResult.publicationNoDisplay || '-'}</Text>
              <View style={{ height: '4rpx' }} />
              <Text className="muted">专利号：{normalizeResult.patentNoDisplay || '-'}</Text>
            </View>
          </>
        ) : null}

        <View style={{ height: '12rpx' }} />
        <Text className="muted">专利类型（必填）</Text>
        <View style={{ height: '10rpx' }} />
        <View className="chip-row">
          {([
            ['INVENTION', '发明'],
            ['UTILITY_MODEL', '实用新型'],
            ['DESIGN', '外观设计'],
          ] as const).map(([value, label]) => (
            <View key={`pt-${value}`} style={{ marginRight: '12rpx', marginBottom: '12rpx' }}>
              <View className={`chip ${patentType === value ? 'chip-active' : ''}`} onClick={() => setPatentType(value)}>
                <Text>{label}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: '12rpx' }} />
        <Text className="muted">标题（可选）</Text>
        <View style={{ height: '8rpx' }} />
        <Input value={title} onChange={setTitle} placeholder="建议填写，提升展示与转化" clearable />

        <View style={{ height: '12rpx' }} />
        <Text className="muted">发明人（建议填写，用于发明人榜；多个用逗号分隔）</Text>
        <View style={{ height: '8rpx' }} />
        <Input value={inventorNamesInput} onChange={setInventorNamesInput} placeholder="例：张三, 李四" clearable />

        <View style={{ height: '12rpx' }} />
        <Text className="muted">专利权人/权利人（建议填写，多个用逗号分隔）</Text>
        <View style={{ height: '8rpx' }} />
        <Input value={assigneeNamesInput} onChange={setAssigneeNamesInput} placeholder="例：某某科技有限公司" clearable />

        <View style={{ height: '12rpx' }} />
        <Text className="muted">申请人（可选，多个用逗号分隔）</Text>
        <View style={{ height: '8rpx' }} />
        <Input value={applicantNamesInput} onChange={setApplicantNamesInput} placeholder="例：某某大学" clearable />

        <View style={{ height: '12rpx' }} />
        <Text className="muted">摘要/亮点（可选）</Text>
        <View style={{ height: '8rpx' }} />
        <TextArea value={summary} onChange={setSummary} placeholder="一句话说明价值点/应用场景/优势" maxLength={2000} />
      </View>

      <Spacer />

      <View className="card">
        <Text className="text-section">2) 交易与价格</Text>
        <View style={{ height: '12rpx' }} />

        <Text className="muted">交易方式（必填）</Text>
        <View style={{ height: '10rpx' }} />
        <View className="chip-row">
          {([
            ['ASSIGNMENT', '转让'],
            ['LICENSE', '许可'],
          ] as const).map(([value, label]) => (
            <View key={`tm-${value}`} style={{ marginRight: '12rpx', marginBottom: '12rpx' }}>
              <View
                className={`chip ${tradeMode === value ? 'chip-active' : ''}`}
                onClick={() => {
                  setTradeMode(value);
                  if (value !== 'LICENSE') setLicenseMode('');
                }}
              >
                <Text>{label}</Text>
              </View>
            </View>
          ))}
        </View>

        {tradeMode === 'LICENSE' ? (
          <>
            <View style={{ height: '6rpx' }} />
            <Text className="muted">许可方式（必填）</Text>
            <View style={{ height: '10rpx' }} />
            <View className="chip-row">
              {([
                ['EXCLUSIVE', '独占'],
                ['SOLE', '排他'],
                ['NON_EXCLUSIVE', '普通'],
              ] as const).map(([value, label]) => (
                <View key={`lm-${value}`} style={{ marginRight: '12rpx', marginBottom: '12rpx' }}>
                  <View className={`chip ${licenseMode === value ? 'chip-active' : ''}`} onClick={() => setLicenseMode(value)}>
                    <Text>{label}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View style={{ height: '12rpx' }} />
        <Text className="muted">价格类型（必填）</Text>
        <View style={{ height: '10rpx' }} />
        <View className="chip-row">
          {([
            ['NEGOTIABLE', '面议'],
            ['FIXED', '一口价'],
          ] as const).map(([value, label]) => (
            <View key={`pr-${value}`} style={{ marginRight: '12rpx', marginBottom: '12rpx' }}>
              <View
                className={`chip ${priceType === value ? 'chip-active' : ''}`}
                onClick={() => {
                  setPriceType(value);
                  if (value !== 'FIXED') setPriceYuan('');
                }}
              >
                <Text>{label}</Text>
              </View>
            </View>
          ))}
        </View>

        {priceType === 'FIXED' ? (
          <>
            <View style={{ height: '12rpx' }} />
            <Text className="muted">一口价（元，必填）</Text>
            <View style={{ height: '8rpx' }} />
            <Input value={priceYuan} onChange={setPriceYuan} placeholder="例：288000" type="digit" clearable />
          </>
        ) : null}

        <View style={{ height: '12rpx' }} />
        <Text className="muted">订金（元，可选；不填则按平台策略计算）</Text>
        <View style={{ height: '8rpx' }} />
        <Input value={depositYuan} onChange={setDepositYuan} placeholder="例：2000" type="digit" clearable />

        <View style={{ height: '12rpx' }} />
        <Text className="muted">佣金：卖家承担；尾款在平台内支付。</Text>
      </View>

      <Spacer />

      <View className="card">
        <Text className="text-section">3) 地域与标签（可选）</Text>
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
        <Text className="muted">产业标签（多选；数据源：公共产业标签库）</Text>
        <View style={{ height: '8rpx' }} />
        <IndustryTagsPicker value={industryTags} max={8} onChange={setIndustryTags} />

        <View style={{ height: '12rpx' }} />
        <Text className="muted">IPC 分类号（可选，多个用逗号分隔）</Text>
        <View style={{ height: '8rpx' }} />
        <Input value={ipcCodesInput} onChange={setIpcCodesInput} placeholder="例：H01M 10/60" clearable />

        <View style={{ height: '12rpx' }} />
        <Text className="muted">LOC 外观分类号（可选，多个用逗号分隔）</Text>
        <View style={{ height: '8rpx' }} />
        <Input value={locCodesInput} onChange={setLocCodesInput} placeholder="例：12-08" clearable />
      </View>

      <Spacer />

      <View className="card">
        <View className="row-between">
          <Text className="text-section">4) 权属材料（提交审核必填）</Text>
          <Text className={`tag ${proofFiles.length ? 'tag-success' : 'tag-danger'}`}>
            {proofFiles.length ? `${proofFiles.length} 份` : '待上传'}
          </Text>
        </View>
        <View style={{ height: '8rpx' }} />
        <Text className="muted">示例：证书/主体证明/转让链路/质押或许可现状声明等。</Text>
        <View style={{ height: '12rpx' }} />

        <Button variant="ghost" loading={uploading} disabled={uploading} onClick={uploadProof}>
          {uploading ? '上传中…' : '上传材料'}
        </Button>

        {proofFiles.length ? (
          <>
            <View style={{ height: '12rpx' }} />
            {proofFiles.map((f, idx) => (
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
                  <Text className="muted">{`材料 ${idx + 1}`}</Text>
                  <View style={{ height: '4rpx' }} />
                  <Text className="text-caption clamp-1">
                    {f.url ? '点击预览/复制链接' : '已上传'} {f.mimeType ? `· ${String(f.mimeType)}` : ''}{' '}
                    {typeof f.sizeBytes === 'number' ? `· ${(f.sizeBytes / 1024).toFixed(0)}KB` : ''}
                  </Text>
                </View>
                <View style={{ width: '168rpx' }}>
                  <Button
                    variant="danger"
                    fill="outline"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeProof(f);
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
        <Text className="muted">
          当前状态：
          {listingId
            ? `${listingStatus ? listingStatusLabel(listingStatus) : '草稿'} / ${auditStatus ? auditStatusLabel(auditStatus) : '未提交审核'}`
            : '未创建草稿'}
        </Text>
      </View>

      <StickyBar>
        {submitted ? (
          <>
            <View style={{ flex: 1 }}>
              <Button variant="ghost" onClick={() => Taro.switchTab({ url: '/pages/home/index' })}>
                返回首页
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button onClick={() => Taro.switchTab({ url: '/pages/me/index' })}>去个人中心</Button>
            </View>
          </>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <Button variant="ghost" loading={saving} disabled={saving || submitting} onClick={() => void saveDraft()}>
                保存草稿
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button loading={submitting} disabled={saving || submitting} onClick={() => void submitForAudit()}>
                提交审核
              </Button>
            </View>
          </>
        )}
      </StickyBar>
    </View>
  );
}
