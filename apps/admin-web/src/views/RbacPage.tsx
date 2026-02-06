import { Button, Card, Descriptions, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPatch, apiPost, apiDelete } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

type Permission = {
  id: string;
  name: string;
  description?: string;
};

type Role = {
  id: string;
  name: string;
  description?: string;
  permissionIds: string[];
  updatedAt?: string;
};

type UserRole = {
  id: string;
  name: string;
  email?: string;
  roleIds: string[];
};

type PagedRoles = { items: Role[] };

type PagedUsers = { items: UserRole[] };

export function RbacPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<UserRole[]>([]);

  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [rolePerms, setRolePerms] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const roleRes = await apiGet<PagedRoles>('/admin/rbac/roles');
      const permRes = await apiGet<{ items: Permission[] }>('/admin/rbac/permissions');
      const userRes = await apiGet<PagedUsers>('/admin/rbac/users');
      setRoles(roleRes.items || []);
      setPermissions(permRes.items || []);
      setUsers(userRes.items || []);
    } catch (e: any) {
      setError(e);
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const permOptions = useMemo(
    () => permissions.map((p) => ({ value: p.id, label: `${p.name}${p.description ? `（${p.description}）` : ''}` })),
    [permissions],
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          账号与权限（RBAC）
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          配置后台角色与权限点，敏感操作需记录审计日志。
        </Typography.Paragraph>
      </Card>

      {error ? <RequestErrorAlert error={error} onRetry={load} /> : null}

      <Card loading={loading}>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          角色管理
        </Typography.Title>
        <Space wrap size={12} style={{ marginBottom: 12 }}>
          <Input
            value={roleName}
            style={{ width: 200 }}
            placeholder="角色名称"
            onChange={(e) => setRoleName(e.target.value)}
          />
          <Input
            value={roleDesc}
            style={{ width: 260 }}
            placeholder="角色说明（可选）"
            onChange={(e) => setRoleDesc(e.target.value)}
          />
          <Select
            mode="multiple"
            value={rolePerms}
            style={{ minWidth: 360 }}
            placeholder="权限点"
            options={permOptions}
            onChange={(v) => setRolePerms(v as string[])}
          />
          <Button
            type="primary"
            disabled={!roleName.trim()}
            onClick={async () => {
              const { ok, reason } = await confirmActionWithReason({
                title: '确认新增角色？',
                content: '新增角色将影响后台权限配置。',
                okText: '创建',
                reasonLabel: '原因/备注（建议填写）',
              });
              if (!ok) return;
              try {
                await apiPost<Role>('/admin/rbac/roles', {
                  name: roleName.trim(),
                  description: roleDesc.trim() || undefined,
                  permissionIds: rolePerms,
                  reason: reason || undefined,
                });
                setRoleName('');
                setRoleDesc('');
                setRolePerms([]);
                message.success('已创建');
                void load();
              } catch (e: any) {
                message.error(e?.message || '创建失败');
              }
            }}
          >
            新建角色
          </Button>
        </Space>

        <Table<Role>
          rowKey="id"
          dataSource={roles}
          pagination={false}
          columns={[
            { title: '角色名称', dataIndex: 'name' },
            { title: '说明', dataIndex: 'description', render: (v) => v || '-' },
            {
              title: '权限点',
              dataIndex: 'permissionIds',
              render: (ids: string[]) => (
                <Space wrap>
                  {ids?.slice(0, 6).map((id) => (
                    <Tag key={id}>{id}</Tag>
                  ))}
                </Space>
              ),
            },
            {
              title: '更新时间',
              dataIndex: 'updatedAt',
              render: (v) => (v ? formatTimeSmart(v) : '-'),
            },
            {
              title: '操作',
              key: 'actions',
              render: (_, r) => (
                <Space>
                  <Button
                    onClick={async () => {
                      const { ok, reason } = await confirmActionWithReason({
                        title: '确认删除角色？',
                        content: '删除角色将影响已分配用户。',
                        okText: '删除',
                        danger: true,
                        reasonLabel: '原因（必填）',
                        reasonRequired: true,
                      });
                      if (!ok) return;
                      try {
                        await apiDelete(`/admin/rbac/roles/${r.id}`, { idempotencyKey: `rbac-role-${r.id}` });
                        message.success('已删除');
                        void load();
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

      <Card loading={loading}>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          账号角色分配
        </Typography.Title>

        <Table<UserRole>
          rowKey="id"
          dataSource={users}
          pagination={false}
          columns={[
            { title: '账号', dataIndex: 'name' },
            { title: '邮箱', dataIndex: 'email', render: (v) => v || '-' },
            {
              title: '角色',
              dataIndex: 'roleIds',
              render: (ids: string[], row) => (
                <Select
                  mode="multiple"
                  style={{ minWidth: 260 }}
                  value={ids}
                  options={roles.map((r) => ({ value: r.id, label: r.name }))}
                  onChange={async (next) => {
                    const { ok, reason } = await confirmActionWithReason({
                      title: '确认变更角色？',
                      content: '变更后立即生效。',
                      okText: '确认',
                      reasonLabel: '备注（建议填写）',
                    });
                    if (!ok) return;
                    try {
                      await apiPatch(`/admin/rbac/users/${row.id}`, { roleIds: next, reason: reason || undefined });
                      message.success('已更新');
                      void load();
                    } catch (e: any) {
                      message.error(e?.message || '更新失败');
                    }
                  }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Card loading={loading}>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          权限点
        </Typography.Title>
        <Space wrap size={8}>
          {permissions.map((p) => (
            <Tag key={p.id}>{p.name}</Tag>
          ))}
        </Space>
      </Card>
    </Space>
  );
}
