import { randomUUID } from 'crypto';

type AuditTargetType = 'LISTING' | 'DEMAND' | 'ACHIEVEMENT' | 'ARTWORK' | 'VERIFICATION';

type AuditMaterial = {
  id: string;
  name: string;
  url?: string;
  kind?: string;
  uploadedAt: string;
};

type AuditLog = {
  id: string;
  action: string;
  reason?: string;
  operatorId?: string;
  operatorName?: string;
  createdAt: string;
};

const MATERIALS = new Map<string, AuditMaterial[]>();
const LOGS = new Map<string, AuditLog[]>();

function key(type: AuditTargetType, id: string) {
  return `${type}:${id}`;
}

function nowIso() {
  return new Date().toISOString();
}

function seedMaterials(type: AuditTargetType, id: string) {
  const items: AuditMaterial[] = [
    {
      id: randomUUID(),
      name: type === 'ARTWORK' ? '权属证明文件' : '权属/授权材料',
      kind: 'OWNERSHIP',
      url: 'https://example.com/material.pdf',
      uploadedAt: nowIso(),
    },
  ];
  MATERIALS.set(key(type, id), items);
  return items;
}

function seedLogs(type: AuditTargetType, id: string) {
  const items: AuditLog[] = [
    {
      id: randomUUID(),
      action: 'SUBMIT',
      reason: '提交审核',
      operatorName: '系统',
      createdAt: nowIso(),
    },
  ];
  LOGS.set(key(type, id), items);
  return items;
}

export function getAuditMaterials(type: AuditTargetType, id: string) {
  const k = key(type, id);
  const items = MATERIALS.get(k);
  return items && items.length ? items : seedMaterials(type, id);
}

export function getAuditLogs(type: AuditTargetType, id: string) {
  const k = key(type, id);
  const items = LOGS.get(k);
  return items && items.length ? items : seedLogs(type, id);
}

export function addAuditLog(
  type: AuditTargetType,
  id: string,
  action: string,
  reason?: string,
  operatorId?: string,
  operatorName?: string,
) {
  const k = key(type, id);
  const list = LOGS.get(k) || seedLogs(type, id);
  const item: AuditLog = {
    id: randomUUID(),
    action,
    reason,
    operatorId,
    operatorName: operatorName || '管理员',
    createdAt: nowIso(),
  };
  list.unshift(item);
  LOGS.set(k, list);
  return item;
}
