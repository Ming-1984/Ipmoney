import { Input as NativeInput, Picker, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import { apiGet, apiPost } from '../../lib/api';
import { normalizeDisplayText } from '../../lib/displayText';
import { usePageAccess } from '../../lib/guard';
import { useRouteStringParam, useRouteUuidParam } from '../../lib/routeParams';
import { AccessGate } from '../../ui/PageState';
import { toast } from '../../ui/nutui';
import { ErrorCard, LoadingCard } from '../../ui/StateCards';

type PatentType = 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN';
type PatentMaintenanceOrder = { id: string };
type ListingContext = {
  id: string;
  title: string;
  applicationNoDisplay?: string | null;
  status?: string;
  auditStatus?: string;
};
type DirectRequestForm = {
  applicationNo: string;
  title: string;
  patentType: PatentType | '';
  yearNo: string;
  dueDate: string;
};

const MAINTENANCE_REQUEST_CREATED_EVENT = 'maintenance-request-created';

const PATENT_TYPE_OPTIONS: Array<{ value: PatentType; label: string }> = [
  { value: 'INVENTION', label: '发明' },
  { value: 'UTILITY_MODEL', label: '实用新型' },
  { value: 'DESIGN', label: '外观设计' },
];

function displayText(value: unknown, fallback = '待确认'): string {
  return normalizeDisplayText(value) || fallback;
}

function routeBackToRecords(orderId?: string) {
  Taro.eventCenter.trigger(MAINTENANCE_REQUEST_CREATED_EVENT, { orderId });

  const pages = Taro.getCurrentPages?.() ?? [];
  if (Array.isArray(pages) && pages.length > 1) {
    Taro.navigateBack();
    return;
  }

  const query = orderId ? `?tab=progress&orderId=${encodeURIComponent(orderId)}` : '?tab=progress';
  Taro.redirectTo({ url: `/subpackages/maintenance/index${query}` });
}

function futureDateKey(years: number): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateDisplay(value: string): string {
  return value ? value.replace(/-/g, '/') : 'yyyy/mm/日';
}

export default function MaintenanceApplyPage() {
  const routeListingId = useRouteUuidParam('listingId') || '';
  const routeTitle = useRouteStringParam('title') || '';
  const routeApplicationNo = useRouteStringParam('applicationNo') || '';
  const requestSeqRef = useRef(0);
  const access = usePageAccess('approved-required');

  const [listingContext, setListingContext] = useState<ListingContext | null>(() =>
    routeListingId
      ? {
          id: routeListingId,
          title: routeTitle || '专利信息待确认',
          applicationNoDisplay: routeApplicationNo || null,
        }
      : null,
  );
  const [listingLoading, setListingLoading] = useState(false);
  const [listingError, setListingError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [directRequestForm, setDirectRequestForm] = useState<DirectRequestForm>({
    applicationNo: routeApplicationNo || '',
    title: routeTitle || '',
    patentType: '',
    yearNo: '1',
    dueDate: '',
  });

  const datePickerEnd = useMemo(() => futureDateKey(30), []);

  useEffect(() => {
    if (!routeListingId) return;
    setListingContext((prev) => ({
      id: routeListingId,
      title: prev?.id === routeListingId ? prev.title : routeTitle || '专利信息待确认',
      applicationNoDisplay: prev?.id === routeListingId ? prev.applicationNoDisplay : routeApplicationNo || null,
      status: prev?.id === routeListingId ? prev.status : undefined,
      auditStatus: prev?.id === routeListingId ? prev.auditStatus : undefined,
    }));
    if (access.state !== 'ok') return;

    let cancelled = false;
    setListingLoading(true);
    setListingError('');
    void apiGet<ListingContext>(`/listings/${routeListingId}`)
      .then((listing) => {
        if (cancelled) return;
        setListingContext({
          id: listing.id,
          title: displayText(listing.title, routeTitle || '专利信息待确认'),
          applicationNoDisplay: listing.applicationNoDisplay || routeApplicationNo || null,
          status: listing.status,
          auditStatus: listing.auditStatus,
        });
      })
      .catch((e: any) => {
        if (cancelled) return;
        setListingError(e?.message || '加载专利信息失败');
      })
      .finally(() => {
        if (!cancelled) setListingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [access.state, routeApplicationNo, routeListingId, routeTitle]);

  const submitListingRequest = useCallback(async () => {
    if (!routeListingId || submitting) return;
    const requestSeq = ++requestSeqRef.current;
    setSubmitting(true);
    setSubmitError('');
    try {
      const order = await apiPost<PatentMaintenanceOrder>(
        '/me/patent-maintenance/listing-requests',
        { listingId: routeListingId },
        { idempotencyKey: `maintenance-listing-${routeListingId}-${Date.now()}` },
      );
      if (requestSeq !== requestSeqRef.current) return;
      toast('官方年费代缴申请已提交');
      routeBackToRecords(order.id);
    } catch (e: any) {
      if (requestSeq !== requestSeqRef.current) return;
      const message =
        e?.statusCode === 404
          ? '当前线上服务暂未开放从我的专利直接发起代缴，请先联系平台或稍后再试。'
          : e?.message || '申请代缴失败';
      setSubmitError(message);
      toast(message);
    } finally {
      if (requestSeq === requestSeqRef.current) setSubmitting(false);
    }
  }, [routeListingId, submitting]);

  const submitDirectRequest = useCallback(async () => {
    if (submitting) return;
    const applicationNo = directRequestForm.applicationNo.trim();
    const title = directRequestForm.title.trim();
    const patentType = directRequestForm.patentType;
    const yearNo = Number(directRequestForm.yearNo || '1');
    const dueDate = directRequestForm.dueDate.trim();
    if (!applicationNo) {
      toast('请填写专利号或申请号');
      return;
    }
    if (!title) {
      toast('请填写专利名称');
      return;
    }
    if (!patentType) {
      toast('请选择专利类型');
      return;
    }
    if (!Number.isSafeInteger(yearNo) || yearNo <= 0) {
      toast('缴费年度应为正整数');
      return;
    }

    const requestSeq = ++requestSeqRef.current;
    setSubmitting(true);
    setSubmitError('');
    try {
      const order = await apiPost<PatentMaintenanceOrder>(
        '/me/patent-maintenance/direct-requests',
        {
          applicationNo,
          title,
          patentType,
          yearNo,
          ...(dueDate ? { dueDate } : {}),
        },
        { idempotencyKey: `maintenance-direct-${applicationNo}-${Date.now()}` },
      );
      if (requestSeq !== requestSeqRef.current) return;
      toast('代缴申请已提交，客服会核验后联系你');
      routeBackToRecords(order.id);
    } catch (e: any) {
      if (requestSeq !== requestSeqRef.current) return;
      const message =
        e?.statusCode === 404
          ? '当前线上服务暂未开放添加专利发起代缴，请先联系平台或稍后再试。'
          : e?.message || '提交代缴申请失败';
      setSubmitError(message);
      toast(message);
    } finally {
      if (requestSeq === requestSeqRef.current) setSubmitting(false);
    }
  }, [directRequestForm, submitting]);

  const isListingMode = Boolean(routeListingId);
  const yearNo = Number(directRequestForm.yearNo || '1');
  const directRequestCanSubmit = Boolean(
    directRequestForm.applicationNo.trim() &&
      directRequestForm.title.trim() &&
      directRequestForm.patentType &&
      Number.isSafeInteger(yearNo) &&
      yearNo > 0,
  );

  return (
    <View className="maintenance-apply-page">
      {access.state !== 'ok' ? (
        <View className="maintenance-apply-body">
          <AccessGate access={access} />
        </View>
      ) : isListingMode ? (
        <>
          <View className="maintenance-apply-body">
            <View className="maintenance-apply-notice">
              <Text className="maintenance-notice-icon">i</Text>
              <Text className="maintenance-notice-text">提交后会生成代缴申请记录，客服核验应缴年度和费用后联系你确认付款方式。</Text>
            </View>

            {listingLoading && !listingContext ? (
              <LoadingCard text="加载专利信息中..." />
            ) : listingError ? (
              <ErrorCard message={listingError} onRetry={() => Taro.redirectTo({ url: Taro.getCurrentInstance().router?.path || '' })} />
            ) : (
              <View className="maintenance-apply-card">
                <Text className="maintenance-apply-kicker">从我的专利发起</Text>
                <Text className="maintenance-apply-title clamp-2">{displayText(listingContext?.title, routeTitle || '专利信息待确认')}</Text>
                <View className="maintenance-apply-row">
                  <Text className="maintenance-apply-label">申请号</Text>
                  <Text className="maintenance-apply-value">{displayText(listingContext?.applicationNoDisplay || routeApplicationNo)}</Text>
                </View>
                <View className="maintenance-apply-row">
                  <Text className="maintenance-apply-label">代缴内容</Text>
                  <Text className="maintenance-apply-value">官方年费提醒、缴费材料沟通、代办提交、回执与记录留存</Text>
                </View>
                {submitError ? <Text className="maintenance-apply-error">{submitError}</Text> : null}
              </View>
            )}
          </View>
          <View className="maintenance-bottom-bar">
            <View
              className="maintenance-bottom-btn maintenance-btn-back"
              onClick={() => Taro.navigateTo({ url: `/subpackages/publish/patent/index?listingId=${routeListingId}` })}
            >
              <Text>查看专利</Text>
            </View>
            <View
              className={`maintenance-bottom-btn maintenance-btn-submit ${submitting || listingLoading ? 'is-disabled' : ''}`}
              onClick={() => {
                if (submitting || listingLoading) return;
                void submitListingRequest();
              }}
            >
              <Text>{submitting ? '提交中' : '提交申请'}</Text>
            </View>
          </View>
        </>
      ) : (
        <>
          <View className="maintenance-apply-body">
            <View className="maintenance-apply-notice">
              <Text className="maintenance-notice-icon">i</Text>
              <Text className="maintenance-notice-text">仅用于年费代缴核验，不会发布到市场，也不会公开展示或售卖。</Text>
            </View>

            <View className="maintenance-apply-form">
              <View className="maintenance-form-field">
                <Text className="maintenance-form-label">
                  专利号 / 申请号 <Text className="maintenance-field-required">*</Text>
                </Text>
                <NativeInput
                  className={`maintenance-form-input ${directRequestForm.applicationNo.trim() ? 'has-value' : ''}`}
                  value={directRequestForm.applicationNo}
                  onInput={(event) => setDirectRequestForm((prev) => ({ ...prev, applicationNo: String(event.detail.value || '') }))}
                  placeholder="例如 202311340972.0"
                  placeholderClass="maintenance-form-placeholder"
                />
              </View>

              <View className="maintenance-form-field">
                <Text className="maintenance-form-label">
                  专利名称 <Text className="maintenance-field-required">*</Text>
                </Text>
                <NativeInput
                  className={`maintenance-form-input ${directRequestForm.title.trim() ? 'has-value' : ''}`}
                  value={directRequestForm.title}
                  onInput={(event) => setDirectRequestForm((prev) => ({ ...prev, title: String(event.detail.value || '') }))}
                  placeholder="例如：一种电池冷却系统"
                  placeholderClass="maintenance-form-placeholder"
                />
              </View>

              <View className="maintenance-form-field">
                <Text className="maintenance-form-label">专利类型</Text>
                <View className="maintenance-type-options">
                  {PATENT_TYPE_OPTIONS.map((option) => (
                    <View
                      key={option.value}
                      className={`maintenance-type-option ${directRequestForm.patentType === option.value ? 'is-active' : ''}`}
                      onClick={() => setDirectRequestForm((prev) => ({ ...prev, patentType: option.value }))}
                    >
                      <Text>{option.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View className="maintenance-form-grid">
                <View className="maintenance-form-field">
                  <Text className="maintenance-form-label">
                    缴费年度 <Text className="maintenance-field-required">*</Text>
                  </Text>
                  <NativeInput
                    className={`maintenance-form-input ${directRequestForm.yearNo.trim() ? 'has-value' : ''}`}
                    value={directRequestForm.yearNo}
                    type="number"
                    onInput={(event) => setDirectRequestForm((prev) => ({ ...prev, yearNo: String(event.detail.value || '') }))}
                    placeholder="例如 1"
                    placeholderClass="maintenance-form-placeholder"
                  />
                </View>

                <View className="maintenance-form-field">
                  <Text className="maintenance-form-label">
                    到期日 <Text className="maintenance-field-optional">可选</Text>
                  </Text>
                  <Picker
                    mode="date"
                    fields="day"
                    value={directRequestForm.dueDate || '2026-01-01'}
                    start="1985-01-01"
                    end={datePickerEnd}
                    onChange={(event) => setDirectRequestForm((prev) => ({ ...prev, dueDate: String(event.detail.value || '') }))}
                  >
                    <View className={`maintenance-date-input ${directRequestForm.dueDate ? 'has-value' : ''}`}>
                      <Text className="maintenance-date-text">{dateDisplay(directRequestForm.dueDate)}</Text>
                      <Text className="maintenance-date-icon">▦</Text>
                    </View>
                  </Picker>
                </View>
              </View>
            </View>

            <Text className="maintenance-apply-hint">提交后由客服核验应缴年度和费用，再联系您确认付款方式。</Text>
            {submitError ? <Text className="maintenance-apply-error">{submitError}</Text> : null}
          </View>
          <View className="maintenance-bottom-bar">
            <View className="maintenance-bottom-btn maintenance-btn-back" onClick={() => Taro.navigateBack()}>
              <Text>返回</Text>
            </View>
            <View
              className={`maintenance-bottom-btn maintenance-btn-submit ${!directRequestCanSubmit || submitting ? 'is-disabled' : ''}`}
              onClick={() => {
                if (submitting) return;
                void submitDirectRequest();
              }}
            >
              <Text>{submitting ? '提交中' : '提交申请'}</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}
