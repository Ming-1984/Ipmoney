import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditLogsController } from '../src/modules/audit-logs/audit-logs.controller';

describe('AuditLogsController delegation suite', () => {
  let auditLogs: any;
  let controller: AuditLogsController;

  beforeEach(() => {
    auditLogs = {
      list: vi.fn(),
    };
    controller = new AuditLogsController(auditLogs);
  });

  it('delegates list query when auditLog.read permission exists', async () => {
    const req: any = { auth: { permissions: new Set(['auditLog.read']) } };
    const query = { page: '2', action: 'ORDER_CREATE' };
    auditLogs.list.mockResolvedValueOnce({ items: [] });

    await expect(controller.list(req, query)).resolves.toEqual({ items: [] });

    expect(auditLogs.list).toHaveBeenCalledWith(query);
  });

  it('allows wildcard permission for list', async () => {
    const req: any = { auth: { permissions: new Set(['*']) } };
    auditLogs.list.mockResolvedValueOnce({ items: [{ id: 'log-1' }] });

    await expect(controller.list(req, {})).resolves.toEqual({ items: [{ id: 'log-1' }] });

    expect(auditLogs.list).toHaveBeenCalledWith({});
  });

  it('rejects list when auditLog.read permission is absent', async () => {
    const req: any = { auth: { permissions: new Set(['listing.read']) } };

    await expect(controller.list(req, {})).rejects.toBeInstanceOf(ForbiddenException);

    expect(auditLogs.list).not.toHaveBeenCalled();
  });
});
