import { Alert, Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { displayAdminInfo, normalizeUserFacingText } from '../lib/userFacingText';
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
type UserScope = 'STAFF' | 'ALL';

const PHONE_RE = /^[0-9]{6,20}$/;

export function RbacPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<UserRole[]>([]);
  const [rolesTablePage, setRolesTablePage] = useState(1);
  const [rolesTablePageSize, setRolesTablePageSize] = useState(20);

  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRoleIds, setNewUserRoleIds] = useState<string[]>([]);

  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [rolePerms, setRolePerms] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editForm] = Form.useForm();

  const [userScope, setUserScope] = useState<UserScope>('STAFF');
  const [userKeyword, setUserKeyword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const roleRes = await apiGet<PagedRoles>('/admin/rbac/roles');
      const permRes = await apiGet<{ items: Permission[] }>('/admin/rbac/permissions');
      const userRes = await apiGet<PagedUsers>('/admin/rbac/users', {
        scope: userScope,
        q: userKeyword.trim() || undefined,
      });
      setRoles(roleRes.items || []);
      setPermissions(permRes.items || []);
      setUsers(userRes.items || []);
    } catch (e: any) {
      setError(e);
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [userKeyword, userScope]);

  useEffect(() => {
    void load();
  }, [load]);

  const roleOptions = useMemo(() => roles.map((r) => ({ value: r.id, label: r.name })), [roles]);
  const permOptions = useMemo(
    () => permissions.map((p) => ({ value: p.id, label: `${p.name}${p.description ? `（${p.description}）` : ''}` })),
    [permissions],
  );

  const handleCreateStaff = useCallback(async () => {
    const name = newUserName.trim();
    const phone = newUserPhone.trim();
    if (!name) {
      message.error('请输入员工姓名');
      return;
    }
    if (!PHONE_RE.test(phone)) {
      message.error('手机号格式不合法');
      return;
    }
    if (!newUserRoleIds.length) {
      message.error('请至少选择一个角色');
      return;
    }

    const { ok, reason } = await confirmActionWithReason({
      title: '确认开通员工账号？',
      content: '将创建新员工账号并立即生效角色权限。',
      okText: '开通',
      reasonLabel: '开通说明（建议填写）',
    });
    if (!ok) return;

    try {
      await apiPost('/admin/rbac/users', {
        name,
        phone,
        roleIds: newUserRoleIds,
        reason: reason || undefined,
      });
      message.success('员工账号已开通');
      setNewUserName('');
      setNewUserPhone('');
      setNewUserRoleIds([]);
      void load();
    } catch (e: any) {
      message.error(e?.message || '开通失败');
    }
  }, [load, newUserName, newUserPhone, newUserRoleIds]);

  return (
    <Space className="admin-rbac-page" direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          账号与权限（RBAC）
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          配置后台角色与权限点，敏感操作需记录审计日志。
        </Typography.Paragraph>
      </Card>

      <Alert
        type="info"
        showIcon
        message="员工注册最佳实践"
        description="员工不自助注册；由 RBAC 管理员统一开通账号并分配最小权限，员工再通过“手机号验证码登录”进入后台。"
      />

      {error ? <RequestErrorAlert error={error} onRetry={load} /> : null}

      <Card loading={loading}>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          角色管理
        </Typography.Title>
        <Space wrap size={12} style={{ marginBottom: 12 }}>
          <Input value={roleName} style={{ width: 220 }} placeholder="角色名称" onChange={(e) => setRoleName(e.target.value)} />
          <Input
            value={roleDesc}
            style={{ width: 280 }}
            placeholder="角色说明（可选）"
            onChange={(e) => setRoleDesc(e.target.value)}
          />
          <Select
            mode="multiple"
            value={rolePerms}
            style={{ minWidth: 420 }}
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
          pagination={{
            current: rolesTablePage,
            pageSize: rolesTablePageSize,
            total: roles.length,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            onChange: (nextPage, nextPageSize) => {
              setRolesTablePage(nextPage);
              if (nextPageSize && nextPageSize !== rolesTablePageSize) {
                setRolesTablePageSize(nextPageSize);
                setRolesTablePage(1);
              }
            },
          }}
          columns={[
            { title: '角色名称', dataIndex: 'name' },
            { title: '说明', dataIndex: 'description', render: (v) => displayAdminInfo(v) },
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
                    onClick={() => {
                      setEditingRole(r);
                      editForm.setFieldsValue({
                        name: r.name,
                        description: r.description || '',
                        permissionIds: r.permissionIds || [],
                      });
                      setEditOpen(true);
                    }}
                  >
                    编辑
                  </Button>
                  <Button
                    onClick={async () => {
                      const { ok } = await confirmActionWithReason({
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

        <Modal
          open={editOpen}
          title="编辑角色"
          destroyOnClose
          onCancel={() => {
            setEditOpen(false);
            setEditingRole(null);
          }}
          onOk={async () => {
            try {
              const v = await editForm.validateFields();
              if (!editingRole) return;
              const { ok } = await confirmActionWithReason({
                title: '确认更新角色？',
                content: '该操作会影响权限配置与人员分配。',
                okText: '更新',
                reasonLabel: '原因/备注（建议填写）',
              });
              if (!ok) return;
              await apiPatch(`/admin/rbac/roles/${editingRole.id}`, {
                name: v.name?.trim(),
                description: v.description?.trim() || undefined,
                permissionIds: v.permissionIds || [],
              });
              message.success('已更新');
              setEditOpen(false);
              setEditingRole(null);
              void load();
            } catch (e: any) {
              if (e?.errorFields) return;
              message.error(e?.message || '更新失败');
            }
          }}
        >
          <Form form={editForm} layout="vertical">
            <Form.Item label="角色名称" name="name" rules={[{ required: true, message: '请输入角色名称' }]}>
              <Input />
            </Form.Item>
            <Form.Item label="角色说明" name="description">
              <Input />
            </Form.Item>
            <Form.Item label="权限点" name="permissionIds">
              <Select mode="multiple" options={permOptions} placeholder="选择权限点" />
            </Form.Item>
          </Form>
        </Modal>
      </Card>

      <Card loading={loading}>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          员工账号开通
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          开通后员工可通过“手机号验证码”登录后台。建议仅赋予最小必要权限，后续再按岗位调整。
        </Typography.Paragraph>
        <Space wrap size={12} style={{ marginBottom: 12 }}>
          <Input
            value={newUserName}
            style={{ width: 180 }}
            placeholder="员工姓名"
            onChange={(e) => setNewUserName(e.target.value)}
          />
          <Input
            value={newUserPhone}
            style={{ width: 220 }}
            placeholder="手机号（登录账号）"
            onChange={(e) => setNewUserPhone(e.target.value)}
          />
          <Select
            mode="multiple"
            value={newUserRoleIds}
            style={{ minWidth: 320 }}
            placeholder="初始角色"
            options={roleOptions}
            onChange={(v) => setNewUserRoleIds(v as string[])}
          />
          <Button type="primary" disabled={!newUserName.trim() || !newUserPhone.trim() || !newUserRoleIds.length} onClick={() => void handleCreateStaff()}>
            开通账号
          </Button>
        </Space>
      </Card>

      <Card loading={loading}>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          账号角色分配
        </Typography.Title>
        <Space wrap size={12} style={{ marginBottom: 12 }}>
          <Select<UserScope>
            value={userScope}
            style={{ width: 160 }}
            options={[
              { value: 'STAFF', label: '仅员工账号' },
              { value: 'ALL', label: '全部账号' },
            ]}
            onChange={setUserScope}
          />
          <Input.Search
            value={userKeyword}
            style={{ width: 300 }}
            allowClear
            placeholder="搜索用户ID / 姓名 / 手机号"
            onChange={(e) => setUserKeyword(e.target.value)}
            onSearch={() => void load()}
          />
          <Button onClick={() => void load()}>刷新</Button>
        </Space>

        <Table<UserRole>
          rowKey="id"
          dataSource={users}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          columns={[
            {
              title: '用户ID',
              dataIndex: 'id',
              width: 280,
              render: (v: string) => <Typography.Text copyable>{v}</Typography.Text>,
            },
            { title: '账号', dataIndex: 'name' },
            { title: '手机号', dataIndex: 'email', render: (v) => displayAdminInfo(v) },
            {
              title: '角色',
              dataIndex: 'roleIds',
              render: (ids: string[], row) => (
                <Select
                  mode="multiple"
                  style={{ minWidth: 300 }}
                  value={ids}
                  options={roleOptions}
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
