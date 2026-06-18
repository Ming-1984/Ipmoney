import { Button, Card, Descriptions, Divider, Drawer, Input, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPatch, apiPost, type FileObject } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { formatRegionCodeDisplay, normalizeUserFacingText } from '../lib/userFacingText';
import { verificationTypeLabel } from '../lib/labels';
import { ImageUrlUploadField } from '../ui/ImageUrlUploadField';
import { RequestErrorAlert, AuditHint } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

type VerificationType =
  | 'PERSON'
  | 'COMPANY'
  | 'ACADEMY'
  | 'GOVERNMENT'
  | 'ASSOCIATION'
  | 'TECH_MANAGER';
type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type UserVerification = {
  id: string;
  userId: string;
  type: VerificationType;
  status: VerificationStatus;
  displayName?: string;
  contactName?: string;
  contactPhoneMasked?: string;
  regionCode?: string;
  intro?: string;
  logoFileId?: string;
  logoUrl?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewComment?: string;
};

type PagedUserVerification = {
  items: UserVerification[];
  page: { page: number; pageSize: number; total: number };
};

type AuditMaterial = {
  id: string;
  name: string;
  url?: string;
  kind?: string;
  uploadedAt?: string;
};

type AuditLog = {
  id: string;
  action: string;
  reason?: string;
  operatorName?: string;
  operatorUserId?: string;
  createdAt?: string;
};

function statusTag(status: VerificationStatus) {
  if (status === 'APPROVED') return <Tag color="green">已通过</Tag>;
  if (status === 'REJECTED') return <Tag color="red">已驳回</Tag>;
  return <Tag color="orange">待审核</Tag>;
}

function displayFieldText(value: unknown, fallback = '未设置'): string {
  return normalizeUserFacingText(value) || fallback;
}

function reviewCommentText(record: UserVerification): string {
  const comment = normalizeUserFacingText(record.reviewComment);
  if (comment) return comment;
  if (record.status === 'PENDING') return '待审核';
  return '暂无备注';
}

function auditActionLabel(value: unknown): string {
  const action = normalizeUserFacingText(value);
  if (!action) return '审核记录待确认';
  if (action === 'APPROVED') return '已通过';
  if (action === 'REJECTED') return '已驳回';
  if (action === 'SUBMITTED') return '已提交';
  if (action === 'PROFILE_UPDATED') return '公开资料已更新';
  if (action === 'LOGO_UPDATED') return 'Logo 已更新';
  if (action === 'LOGO_CLEARED') return 'Logo 已清除';
  return action;
}

function materialKindLabel(value: unknown): string {
  const kind = normalizeUserFacingText(value);
  if (!kind) return '材料类型待确认';
  if (kind === 'ID_FRONT') return '身份证正面';
  if (kind === 'ID_BACK') return '身份证反面';
  if (kind === 'BUSINESS_LICENSE') return '营业执照';
  if (kind === 'QUALIFICATION') return '资质材料';
  if (kind === 'AUTHORIZATION') return '授权文件';
  if (kind === 'LOGO') return 'Logo';
  return kind;
}

export function VerificationsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedUserVerification | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detailOpen, setDetailOpen] = useState(false);
  const [active, setActive] = useState<UserVerification | null>(null);
  const [materials, setMaterials] = useState<AuditMaterial[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [logoSaving, setLogoSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editContactName, setEditContactName] = useState('');
  const [editRegionCode, setEditRegionCode] = useState('');
  const [editIntro, setEditIntro] = useState('');

  const load = useCallback(async (opts?: { page?: number; pageSize?: number }) => {
    const nextPage = opts?.page ?? page;
    const nextPageSize = opts?.pageSize ?? pageSize;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedUserVerification>('/admin/user-verifications', {
        page: nextPage,
        pageSize: nextPageSize,
      });
      setData(d);
    } catch (e: any) {
      setError(e);
      message.error(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => data?.items || [], [data?.items]);

  const updateActiveLogo = useCallback((verificationId: string, next: { id?: string; url?: string }) => {
    setActive((prev) =>
      prev && prev.id === verificationId
        ? {
            ...prev,
            logoFileId: next.id,
            logoUrl: next.url,
          }
        : prev,
    );
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((it) =>
              it.id === verificationId
                ? {
                    ...it,
                    logoFileId: next.id,
                    logoUrl: next.url,
                  }
                : it,
            ),
          }
        : prev,
    );
  }, []);

  const updateActiveProfile = useCallback(
    (verificationId: string, next: { displayName?: string; contactName?: string; regionCode?: string; intro?: string }) => {
      setActive((prev) =>
        prev && prev.id === verificationId
          ? {
              ...prev,
              displayName: next.displayName,
              contactName: next.contactName,
              regionCode: next.regionCode,
              intro: next.intro,
            }
          : prev,
      );
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((it) =>
                it.id === verificationId
                  ? {
                      ...it,
                      displayName: next.displayName,
                      contactName: next.contactName,
                      regionCode: next.regionCode,
                      intro: next.intro,
                    }
                  : it,
              ),
            }
          : prev,
      );
    },
    [],
  );

  const applyLogoPatch = useCallback(
    async (verificationId: string, logoFileId: string | null, file?: FileObject) => {
      setLogoSaving(true);
      try {
        await apiPatch<UserVerification>(`/admin/user-verifications/${verificationId}/logo`, {
          logoFileId,
        });
        updateActiveLogo(verificationId, {
          id: logoFileId || undefined,
          url: file?.url,
        });
        message.success(logoFileId ? 'Logo 已更新' : 'Logo 已清除');
      } catch (e: any) {
        message.error(e?.message || (logoFileId ? 'Logo 更新失败' : 'Logo 清除失败'));
      } finally {
        setLogoSaving(false);
      }
    },
    [updateActiveLogo],
  );

  const applyProfilePatch = useCallback(async () => {
    if (!active?.id) return;
    setProfileSaving(true);
    try {
      const updated = await apiPatch<UserVerification>(`/admin/user-verifications/${active.id}/profile`, {
        displayName: editDisplayName.trim() || null,
        contactName: editContactName.trim() || null,
        regionCode: editRegionCode.trim() || null,
        intro: editIntro.trim() || null,
      });
      updateActiveProfile(active.id, {
        displayName: updated.displayName || '',
        contactName: updated.contactName || '',
        regionCode: updated.regionCode || '',
        intro: updated.intro || '',
      });
      setEditDisplayName(normalizeUserFacingText(updated.displayName));
      setEditContactName(normalizeUserFacingText(updated.contactName));
      setEditRegionCode(normalizeUserFacingText(updated.regionCode));
      setEditIntro(normalizeUserFacingText(updated.intro));
      message.success('公开资料已更新');
    } catch (e: any) {
      message.error(e?.message || '公开资料更新失败');
    } finally {
      setProfileSaving(false);
    }
  }, [active?.id, editContactName, editDisplayName, editIntro, editRegionCode, updateActiveProfile]);

  return (
    <Card className="admin-verifications-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            认证审核
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            用于审核用户身份资料；通过后可在小程序端展示，并具备交易/咨询等权限。
          </Typography.Paragraph>
        </div>

        {error ? <RequestErrorAlert error={error} onRetry={load} /> : <AuditHint text="通过/驳回将影响小程序端展示，建议二次确认并记录原因。" />}

        <Table<UserVerification>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={{
            current: data?.page.page || page,
            pageSize: data?.page.pageSize || pageSize,
            total: data?.page.total || 0,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            onChange: (nextPage, nextPageSize) => {
              const normalizedPageSize = nextPageSize || pageSize;
              if (normalizedPageSize !== pageSize) {
                setPageSize(normalizedPageSize);
                setPage(1);
                return;
              }
              setPage(nextPage);
            },
          }}
          columns={[
            { title: '主体名称', dataIndex: 'displayName', render: (value) => displayFieldText(value) },
            { title: '类型', dataIndex: 'type', render: (v) => verificationTypeLabel(v) },
            { title: '状态', dataIndex: 'status', render: (_, r) => statusTag(r.status) },
            { title: '地区', dataIndex: 'regionCode', render: (value) => formatRegionCodeDisplay(value) },
            { title: '提交时间', dataIndex: 'submittedAt', render: (v) => formatTimeSmart(v) },
            {
              title: '操作',
              key: 'actions',
              render: (_, r) => {
                const disabled = r.status !== 'PENDING';
                return (
                  <Space>
                    <Button
                      onClick={async () => {
                        setActive(r);
                        setEditDisplayName(normalizeUserFacingText(r.displayName));
                        setEditContactName(normalizeUserFacingText(r.contactName));
                        setEditRegionCode(normalizeUserFacingText(r.regionCode));
                        setEditIntro(normalizeUserFacingText(r.intro));
                        setMaterials([]);
                        setAuditLogs([]);
                        setDetailOpen(true);
                        try {
                          const [m, logs] = await Promise.all([
                            apiGet<{ items: AuditMaterial[] }>(`/admin/user-verifications/${r.id}/materials`),
                            apiGet<{ items: AuditLog[] }>(`/admin/user-verifications/${r.id}/audit-logs`),
                          ]);
                          setMaterials(m.items || []);
                          setAuditLogs(logs.items || []);
                        } catch (e: any) {
                          message.error(e?.message || '加载材料/审核记录失败');
                        }
                      }}
                    >
                      详情
                    </Button>
                    <Button
                      type="primary"
                      disabled={disabled}
                      onClick={async () => {
                        const { ok, reason } = await confirmActionWithReason({
                          title: '确认通过该认证？',
                          content: '通过后，该主体可在小程序端展示；该操作应记录审计留痕。',
                          okText: '通过',
                          defaultReason: '通过',
                          reasonLabel: '审批备注（建议填写）',
                          reasonHint: '建议写明核验点：主体信息、联系人、材料完整性等。',
                        });
                        if (!ok) return;
                        try {
                          await apiPost<UserVerification>(`/admin/user-verifications/${r.id}/approve`, {
                            comment: reason || '通过',
                          });
                          message.success('已通过');
                          void load();
                        } catch (e: any) {
                          message.error(e?.message || '操作失败');
                        }
                      }}
                    >
                      通过
                    </Button>
                    <Button
                      danger
                      disabled={disabled}
                      onClick={async () => {
                        const { ok, reason } = await confirmActionWithReason({
                          title: '确认驳回该认证？',
                          content: '驳回后该主体无法交易/咨询；驳回原因会对提交者可见。',
                          okText: '驳回',
                          danger: true,
                          reasonLabel: '驳回原因',
                          reasonPlaceholder: '例如：主体证明材料不清晰；联系电话不一致；缺少盖章文件等。',
                          reasonRequired: true,
                        });
                        if (!ok) return;
                        try {
                          await apiPost<UserVerification>(`/admin/user-verifications/${r.id}/reject`, {
                            reason: reason || '材料不完整',
                          });
                          message.success('已驳回');
                          void load();
                        } catch (e: any) {
                          message.error(e?.message || '操作失败');
                        }
                      }}
                    >
                      驳回
                    </Button>
                  </Space>
                );
              },
            },
          ]}
        />

        <Button onClick={() => void load()}>刷新</Button>
      </Space>

      <Drawer
        title={normalizeUserFacingText(active?.displayName) ? `认证详情：${normalizeUserFacingText(active?.displayName)}` : '认证详情'}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={560}
        destroyOnClose
      >
        {active ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="认证编号">{active.id}</Descriptions.Item>
              <Descriptions.Item label="主体名称">{displayFieldText(active.displayName)}</Descriptions.Item>
              <Descriptions.Item label="类型">{verificationTypeLabel(active.type)}</Descriptions.Item>
              <Descriptions.Item label="状态">{statusTag(active.status)}</Descriptions.Item>
              <Descriptions.Item label="地区">{formatRegionCodeDisplay(active.regionCode)}</Descriptions.Item>
              <Descriptions.Item label="联系人">{displayFieldText(active.contactName)}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{displayFieldText(active.contactPhoneMasked)}</Descriptions.Item>
              <Descriptions.Item label="提交时间">{formatTimeSmart(active.submittedAt)}</Descriptions.Item>
              <Descriptions.Item label="审核时间">{active.reviewedAt ? formatTimeSmart(active.reviewedAt) : '待确认'}</Descriptions.Item>
              <Descriptions.Item label="审核备注">{reviewCommentText(active)}</Descriptions.Item>
            </Descriptions>

            <Divider />
            <Typography.Text strong>公开资料维护</Typography.Text>
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <div>
                <Typography.Text>主体名称</Typography.Text>
                <Input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} style={{ marginTop: 8 }} />
              </div>
              <div>
                <Typography.Text>联系人</Typography.Text>
                <Input value={editContactName} onChange={(e) => setEditContactName(e.target.value)} style={{ marginTop: 8 }} />
              </div>
              <div>
                <Typography.Text>所属地区</Typography.Text>
                <Input
                  value={editRegionCode}
                  onChange={(e) => setEditRegionCode(e.target.value)}
                  placeholder="可填写地区名称或地区代码"
                  style={{ marginTop: 8 }}
                />
              </div>
              <div>
                <Typography.Text>主体简介</Typography.Text>
                <Input.TextArea
                  value={editIntro}
                  onChange={(e) => setEditIntro(e.target.value)}
                  autoSize={{ minRows: 3, maxRows: 6 }}
                  style={{ marginTop: 8 }}
                />
              </div>
              <div>
                <Button type="primary" loading={profileSaving} onClick={() => void applyProfilePatch()}>
                  保存公开资料
                </Button>
              </div>
            </Space>

            {active.type !== 'PERSON' ? (
              <>
                <Divider />
                <Typography.Text strong>机构 Logo</Typography.Text>
                <ImageUrlUploadField
                  value={active.logoUrl || ''}
                  onChange={(next) => updateActiveLogo(active.id, { id: active.logoFileId, url: next })}
                  onUploaded={async (uploaded) => {
                    await applyLogoPatch(active.id, uploaded.id, uploaded);
                  }}
                  uploadPurpose="VERIFICATION_LOGO"
                  maxSizeMb={10}
                  uploadButtonText="上传并替换 Logo"
                  allowUrlInput={false}
                  previewObjectFit="contain"
                  disabled={logoSaving}
                />
                <Button
                  danger
                  loading={logoSaving}
                  onClick={async () => {
                    await applyLogoPatch(active.id, null);
                  }}
                >
                  清除 Logo
                </Button>
              </>
            ) : null}

            <Divider />
            <Typography.Text strong>材料/附件</Typography.Text>
            {materials.length ? (
              <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
                {materials.map((m) => (
                  <Card key={m.id} size="small">
                    <Space direction="vertical" size={4}>
                      <Typography.Text>{m.name}</Typography.Text>
                      <Typography.Text type="secondary">
                        {materialKindLabel(m.kind)} | {m.uploadedAt ? formatTimeSmart(m.uploadedAt) : '待确认'}
                      </Typography.Text>
                      {m.url ? (
                        <a href={m.url} target="_blank" rel="noreferrer">
                          查看附件
                        </a>
                      ) : null}
                    </Space>
                  </Card>
                ))}
              </Space>
            ) : (
              <Typography.Text type="secondary">暂无材料。</Typography.Text>
            )}

            <Divider />
            <Typography.Text strong>审核记录</Typography.Text>
            {auditLogs.length ? (
              <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
                {auditLogs.map((log) => (
                  <Card key={log.id} size="small">
                    <Space direction="vertical" size={4}>
                      <Typography.Text>{auditActionLabel(log.action)}</Typography.Text>
                      {normalizeUserFacingText(log.reason) ? <Typography.Text>{normalizeUserFacingText(log.reason)}</Typography.Text> : null}
                      <Typography.Text type="secondary">
                        {normalizeUserFacingText(log.operatorName) || '操作方待确认'} |{' '}
                        {log.createdAt ? formatTimeSmart(log.createdAt) : '待确认'}
                      </Typography.Text>
                    </Space>
                  </Card>
                ))}
              </Space>
            ) : (
              <Typography.Text type="secondary">暂无审核记录。</Typography.Text>
            )}
          </Space>
        ) : null}
      </Drawer>
    </Card>
  );
}
