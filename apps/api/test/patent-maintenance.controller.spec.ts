import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatentMaintenanceController } from '../src/modules/patent-maintenance/patent-maintenance.controller';

const VALID_UUID = '14141414-1414-4141-8141-141414141414';

describe('PatentMaintenanceController delegation suite', () => {
  let maintenance: any;
  let controller: PatentMaintenanceController;

  beforeEach(() => {
    maintenance = {
      listSchedules: vi.fn(),
      createSchedule: vi.fn(),
      getSchedule: vi.fn(),
      updateSchedule: vi.fn(),
      listTasks: vi.fn(),
      createTask: vi.fn(),
      updateTask: vi.fn(),
    };
    controller = new PatentMaintenanceController(maintenance);
  });

  it('delegates schedule list/create/get/update with query/body fallback', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    maintenance.listSchedules.mockResolvedValueOnce({ items: [] });
    maintenance.createSchedule.mockResolvedValueOnce({ id: VALID_UUID });
    maintenance.getSchedule.mockResolvedValueOnce({ id: VALID_UUID });
    maintenance.updateSchedule.mockResolvedValueOnce({ ok: true });

    await expect(controller.listSchedules(req, undefined as any)).resolves.toEqual({ items: [] });
    await expect(controller.createSchedule(req, null as any)).resolves.toEqual({ id: VALID_UUID });
    await expect(controller.getSchedule(req, VALID_UUID)).resolves.toEqual({ id: VALID_UUID });
    await expect(controller.updateSchedule(req, VALID_UUID, undefined as any)).resolves.toEqual({ ok: true });

    expect(maintenance.listSchedules).toHaveBeenCalledWith(req, {});
    expect(maintenance.createSchedule).toHaveBeenCalledWith(req, {});
    expect(maintenance.getSchedule).toHaveBeenCalledWith(req, VALID_UUID);
    expect(maintenance.updateSchedule).toHaveBeenCalledWith(req, VALID_UUID, {});
  });

  it('delegates task list/create/update with query/body fallback', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    maintenance.listTasks.mockResolvedValueOnce({ items: [] });
    maintenance.createTask.mockResolvedValueOnce({ id: VALID_UUID });
    maintenance.updateTask.mockResolvedValueOnce({ ok: true });

    await expect(controller.listTasks(req, undefined as any)).resolves.toEqual({ items: [] });
    await expect(controller.createTask(req, undefined as any)).resolves.toEqual({ id: VALID_UUID });
    await expect(controller.updateTask(req, VALID_UUID, null as any)).resolves.toEqual({ ok: true });

    expect(maintenance.listTasks).toHaveBeenCalledWith(req, {});
    expect(maintenance.createTask).toHaveBeenCalledWith(req, {});
    expect(maintenance.updateTask).toHaveBeenCalledWith(req, VALID_UUID, {});
  });
});
