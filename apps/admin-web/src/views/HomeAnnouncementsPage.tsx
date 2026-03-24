import { Button, Card, Form, Input, InputNumber, Select, Space, Switch, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { confirmAction } from '../ui/confirm';

type HomeAnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'OFFLINE';

type HomeAnnouncementTemplate = {
  id: string;
  name: string;
  title: string;
  content: string;
  tag: string | null;
  linkUrl: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type HomeAnnouncementItem = {
  id: string;
  templateId: string | null;
  title: string;
  content: string;
  tag: string | null;
  linkUrl: string | null;
  pinned: boolean;
  order: number;
  status: HomeAnnouncementStatus;
  startAt: string | null;
  endAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type HomeAnnouncementConfig = {
  schemaVersion: number;
  templates: HomeAnnouncementTemplate[];
  items: HomeAnnouncementItem[];
};

type TemplateFormValues = {
  name: string;
  title: string;
  content: string;
  tag?: string;
  linkUrl?: string;
  enabled: boolean;
};

type AnnouncementFormValues = {
  templateId?: string;
  title: string;
  content: string;
  tag?: string;
  linkUrl?: string;
  pinned: boolean;
  order: number;
  startAt?: string;
  endAt?: string;
};

function statusTag(status: HomeAnnouncementStatus) {
  if (status === 'PUBLISHED') return <Tag color="green">PUBLISHED</Tag>;
  if (status === 'OFFLINE') return <Tag>OFFLINE</Tag>;
  return <Tag color="blue">DRAFT</Tag>;
}

function isValidDateTimeOrEmpty(value: unknown) {
  const normalized = String(value || '').trim();
  if (!normalized) return true;
  return !Number.isNaN(new Date(normalized).getTime());
}

function isValidMiniProgramPageUrlOrEmpty(value: unknown) {
  const normalized = String(value || '').trim();
  if (!normalized) return true;
  return normalized.startsWith('/pages/') || normalized.startsWith('/subpackages/');
}

export function HomeAnnouncementsPage() {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [config, setConfig] = useState<HomeAnnouncementConfig | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [templateForm] = Form.useForm<TemplateFormValues>();
  const [itemForm] = Form.useForm<AnnouncementFormValues>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<HomeAnnouncementConfig>('/admin/config/home-announcements');
      setConfig(data);
    } catch (e: any) {
      message.error(e?.message || '加载首页公告配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const templateOptions = useMemo(
    () =>
      (config?.templates || []).map((it) => ({
        value: it.id,
        label: `${it.name}${it.enabled ? '' : ' (disabled)'}`,
        disabled: !it.enabled,
      })),
    [config?.templates],
  );

  const sortedItems = useMemo(() => {
    return [...(config?.items || [])].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.order !== b.order) return a.order - b.order;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [config?.items]);

  const resetTemplateForm = useCallback(() => {
    setEditingTemplateId(null);
    templateForm.setFieldsValue({
      name: '',
      title: '',
      content: '',
      tag: '',
      linkUrl: '',
      enabled: true,
    });
  }, [templateForm]);

  const resetItemForm = useCallback(() => {
    setEditingItemId(null);
    itemForm.setFieldsValue({
      templateId: undefined,
      title: '',
      content: '',
      tag: '',
      linkUrl: '',
      pinned: false,
      order: 100,
      startAt: '',
      endAt: '',
    });
  }, [itemForm]);

  useEffect(() => {
    resetTemplateForm();
    resetItemForm();
  }, [resetItemForm, resetTemplateForm]);

  return (
    <Space className="admin-home-announcements-page" direction="vertical" size={16} style={{ width: '100%' }}>
      <Card loading={loading}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            首页公告管理
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            支持模板复用、草稿编辑、发布/下线。首页仅展示状态为 PUBLISHED 且生效时间窗口内的公告。
          </Typography.Paragraph>
          <Space>
            <Button onClick={() => void load()} loading={loading}>刷新配置</Button>
            <Typography.Text type="secondary">schemaVersion: {config?.schemaVersion ?? '-'}</Typography.Text>
          </Space>
        </Space>
      </Card>

      <Card loading={loading} title="公告模板">
        <Form
          form={templateForm}
          layout="vertical"
          initialValues={{ enabled: true }}
          onFinish={async (values) => {
            setSubmitting(true);
            try {
              const payload = {
                name: String(values.name || '').trim(),
                title: String(values.title || '').trim(),
                content: String(values.content || '').trim(),
                tag: String(values.tag || '').trim() || null,
                linkUrl: String(values.linkUrl || '').trim() || null,
                enabled: values.enabled !== false,
              };
              if (editingTemplateId) {
                await apiPut(`/admin/config/home-announcements/templates/${editingTemplateId}`, payload);
                message.success('模板已更新');
              } else {
                await apiPost('/admin/config/home-announcements/templates', payload);
                message.success('模板已创建');
              }
              resetTemplateForm();
              await load();
            } catch (e: any) {
              message.error(e?.message || '模板保存失败');
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <Space wrap size={16} align="start">
            <Form.Item label="模板名称" name="name" rules={[{ required: true, message: '请输入模板名称' }]} style={{ width: 240 }}>
              <Input maxLength={80} />
            </Form.Item>
            <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]} style={{ width: 320 }}>
              <Input maxLength={120} />
            </Form.Item>
            <Form.Item label="标签" name="tag" style={{ width: 180 }}>
              <Input maxLength={32} placeholder="可选" />
            </Form.Item>
            <Form.Item
              label="跳转链接"
              name="linkUrl"
              style={{ width: 320 }}
              rules={[
                {
                  validator: async (_, value) => {
                    if (!isValidMiniProgramPageUrlOrEmpty(value)) {
                      throw new Error('仅支持小程序内页面，例如 /subpackages/search/index');
                    }
                  },
                },
              ]}
            >
              <Input maxLength={1000} placeholder="可选，例如 /subpackages/search/index" />
            </Form.Item>
            <Form.Item label="启用" name="enabled" valuePropName="checked" style={{ width: 120 }}>
              <Switch />
            </Form.Item>
          </Space>
          <Form.Item label="模板内容" name="content" rules={[{ required: true, message: '请输入模板内容' }]}>
            <Input.TextArea rows={4} maxLength={2000} showCount />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {editingTemplateId ? '更新模板' : '创建模板'}
            </Button>
            <Button onClick={resetTemplateForm} disabled={submitting}>重置</Button>
          </Space>
        </Form>

        <Table<HomeAnnouncementTemplate>
          style={{ marginTop: 16 }}
          rowKey="id"
          size="small"
          dataSource={config?.templates || []}
          pagination={false}
          columns={[
            { title: '名称', dataIndex: 'name', width: 180 },
            { title: '标题', dataIndex: 'title', width: 260 },
            { title: '标签', dataIndex: 'tag', width: 120, render: (v) => v || '-' },
            { title: '启用', dataIndex: 'enabled', width: 100, render: (v: boolean) => (v ? <Tag color="green">ON</Tag> : <Tag>OFF</Tag>) },
            { title: '更新时间', dataIndex: 'updatedAt', width: 160, render: (v: string) => formatTimeSmart(v) },
            {
              title: '操作',
              width: 320,
              render: (_, row) => (
                <Space>
                  <Button
                    size="small"
                    onClick={() => {
                      setEditingTemplateId(row.id);
                      templateForm.setFieldsValue({
                        name: row.name,
                        title: row.title,
                        content: row.content,
                        tag: row.tag || '',
                        linkUrl: row.linkUrl || '',
                        enabled: row.enabled,
                      });
                    }}
                  >
                    编辑
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      itemForm.setFieldsValue({
                        templateId: row.id,
                        title: row.title,
                        content: row.content,
                        tag: row.tag || '',
                        linkUrl: row.linkUrl || '',
                      });
                      message.success('已将模板内容填入公告表单');
                    }}
                  >
                    用于公告
                  </Button>
                  <Button
                    size="small"
                    danger
                    onClick={async () => {
                      const ok = await confirmAction({
                        title: '确认删除模板？',
                        content: '已绑定公告的模板不能删除。',
                        danger: true,
                        okText: '删除',
                      });
                      if (!ok) return;
                      try {
                        await apiDelete(`/admin/config/home-announcements/templates/${row.id}`);
                        message.success('模板已删除');
                        if (editingTemplateId === row.id) resetTemplateForm();
                        await load();
                      } catch (e: any) {
                        message.error(e?.message || '删除模板失败');
                      }
                    }}
                  >
                    删除
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Card loading={loading} title="首页公告">
        <Form
          form={itemForm}
          layout="vertical"
          initialValues={{ pinned: false, order: 100 }}
          onValuesChange={(_, values: AnnouncementFormValues) => {
            const templateId = String(values.templateId || '').trim();
            if (!templateId) return;
            const template = (config?.templates || []).find((it) => it.id === templateId);
            if (!template) return;
            const currentTitle = String(values.title || '').trim();
            const currentContent = String(values.content || '').trim();
            if (!currentTitle) {
              itemForm.setFieldValue('title', template.title);
            }
            if (!currentContent) {
              itemForm.setFieldValue('content', template.content);
            }
            if (!values.tag) {
              itemForm.setFieldValue('tag', template.tag || '');
            }
            if (!values.linkUrl) {
              itemForm.setFieldValue('linkUrl', template.linkUrl || '');
            }
          }}
          onFinish={async (values) => {
            setSubmitting(true);
            try {
              const payload = {
                templateId: String(values.templateId || '').trim() || null,
                title: String(values.title || '').trim(),
                content: String(values.content || '').trim(),
                tag: String(values.tag || '').trim() || null,
                linkUrl: String(values.linkUrl || '').trim() || null,
                pinned: values.pinned === true,
                order: Number(values.order || 100),
                startAt: String(values.startAt || '').trim() || null,
                endAt: String(values.endAt || '').trim() || null,
              };
              if (editingItemId) {
                await apiPut(`/admin/config/home-announcements/items/${editingItemId}`, payload);
                message.success('公告已更新');
              } else {
                await apiPost('/admin/config/home-announcements/items', payload);
                message.success('公告草稿已创建');
              }
              resetItemForm();
              await load();
            } catch (e: any) {
              message.error(e?.message || '公告保存失败');
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <Space wrap size={16} align="start">
            <Form.Item label="模板" name="templateId" style={{ width: 220 }}>
              <Select allowClear options={templateOptions} placeholder="可选" />
            </Form.Item>
            <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入公告标题' }]} style={{ width: 320 }}>
              <Input maxLength={120} />
            </Form.Item>
            <Form.Item label="标签" name="tag" style={{ width: 180 }}>
              <Input maxLength={32} placeholder="可选" />
            </Form.Item>
            <Form.Item
              label="跳转链接"
              name="linkUrl"
              style={{ width: 320 }}
              rules={[
                {
                  validator: async (_, value) => {
                    if (!isValidMiniProgramPageUrlOrEmpty(value)) {
                      throw new Error('仅支持小程序内页面，例如 /subpackages/search/index');
                    }
                  },
                },
              ]}
            >
              <Input maxLength={1000} placeholder="可选，例如 /subpackages/search/index" />
            </Form.Item>
            <Form.Item label="置顶" name="pinned" valuePropName="checked" style={{ width: 100 }}>
              <Switch />
            </Form.Item>
            <Form.Item label="排序(小优先)" name="order" style={{ width: 140 }}>
              <InputNumber min={0} max={100000} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Space wrap size={16} align="start">
            <Form.Item
              label="生效开始(ISO8601)"
              name="startAt"
              style={{ width: 280 }}
              rules={[
                {
                  validator: async (_, value) => {
                    if (!isValidDateTimeOrEmpty(value)) {
                      throw new Error('时间格式不合法');
                    }
                  },
                },
              ]}
            >
              <Input placeholder="例如 2026-03-24T00:00:00Z" />
            </Form.Item>
            <Form.Item
              label="生效结束(ISO8601)"
              name="endAt"
              style={{ width: 280 }}
              dependencies={['startAt']}
              rules={[
                {
                  validator: async (_, value) => {
                    if (!isValidDateTimeOrEmpty(value)) {
                      throw new Error('时间格式不合法');
                    }
                    const startAt = String(itemForm.getFieldValue('startAt') || '').trim();
                    const endAt = String(value || '').trim();
                    if (startAt && endAt && new Date(endAt).getTime() < new Date(startAt).getTime()) {
                      throw new Error('结束时间不能早于开始时间');
                    }
                  },
                },
              ]}
            >
              <Input placeholder="例如 2026-03-31T23:59:59Z" />
            </Form.Item>
          </Space>
          <Form.Item label="公告内容" name="content" rules={[{ required: true, message: '请输入公告内容' }]}>
            <Input.TextArea rows={4} maxLength={2000} showCount />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {editingItemId ? '更新公告' : '创建草稿'}
            </Button>
            <Button onClick={resetItemForm} disabled={submitting}>重置</Button>
          </Space>
        </Form>

        <Table<HomeAnnouncementItem>
          style={{ marginTop: 16 }}
          rowKey="id"
          size="small"
          dataSource={sortedItems}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: '状态', dataIndex: 'status', width: 120, render: (v: HomeAnnouncementStatus) => statusTag(v) },
            { title: '标题', dataIndex: 'title', width: 260 },
            { title: '标签', dataIndex: 'tag', width: 100, render: (v) => v || '-' },
            { title: '置顶', dataIndex: 'pinned', width: 80, render: (v: boolean) => (v ? '是' : '否') },
            { title: '排序', dataIndex: 'order', width: 80 },
            { title: '发布时间', dataIndex: 'publishedAt', width: 160, render: (v: string | null) => (v ? formatTimeSmart(v) : '-') },
            { title: '更新时间', dataIndex: 'updatedAt', width: 160, render: (v: string) => formatTimeSmart(v) },
            {
              title: '操作',
              width: 420,
              render: (_, row) => (
                <Space>
                  <Button
                    size="small"
                    onClick={() => {
                      setEditingItemId(row.id);
                      itemForm.setFieldsValue({
                        templateId: row.templateId || undefined,
                        title: row.title,
                        content: row.content,
                        tag: row.tag || '',
                        linkUrl: row.linkUrl || '',
                        pinned: row.pinned,
                        order: row.order,
                        startAt: row.startAt || '',
                        endAt: row.endAt || '',
                      });
                    }}
                  >
                    编辑
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    disabled={row.status === 'PUBLISHED'}
                    onClick={async () => {
                      const ok = await confirmAction({
                        title: '确认发布公告？',
                        content: '发布后将进入首页公告位。',
                        okText: '发布',
                      });
                      if (!ok) return;
                      try {
                        await apiPost(`/admin/config/home-announcements/items/${row.id}/publish`);
                        message.success('公告已发布');
                        await load();
                      } catch (e: any) {
                        message.error(e?.message || '发布失败');
                      }
                    }}
                  >
                    发布
                  </Button>
                  <Button
                    size="small"
                    disabled={row.status !== 'PUBLISHED'}
                    onClick={async () => {
                      const ok = await confirmAction({
                        title: '确认下线公告？',
                        content: '下线后首页不再展示该公告。',
                        okText: '下线',
                      });
                      if (!ok) return;
                      try {
                        await apiPost(`/admin/config/home-announcements/items/${row.id}/offline`);
                        message.success('公告已下线');
                        await load();
                      } catch (e: any) {
                        message.error(e?.message || '下线失败');
                      }
                    }}
                  >
                    下线
                  </Button>
                  <Button
                    size="small"
                    danger
                    onClick={async () => {
                      const ok = await confirmAction({
                        title: '确认删除公告？',
                        content: '删除后不可恢复。',
                        danger: true,
                        okText: '删除',
                      });
                      if (!ok) return;
                      try {
                        await apiDelete(`/admin/config/home-announcements/items/${row.id}`);
                        message.success('公告已删除');
                        if (editingItemId === row.id) resetItemForm();
                        await load();
                      } catch (e: any) {
                        message.error(e?.message || '删除失败');
                      }
                    }}
                  >
                    删除
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
