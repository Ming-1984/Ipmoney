import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { OpsNotificationsService } from './ops-notifications.service';

function parseBool(value: string | undefined, fallback: boolean): boolean {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes';
}

@Injectable()
export class OpsNotificationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OpsNotificationWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly opsNotifications: OpsNotificationsService) {}

  onModuleInit() {
    if (!parseBool(process.env.OPS_NOTIFICATION_WORKER_ENABLED, true)) {
      this.logger.log('ops notification worker is disabled');
      return;
    }

    const intervalMs = Math.max(5_000, Number(process.env.OPS_NOTIFICATION_WORKER_INTERVAL_MS || 30_000));
    this.timer = setInterval(() => void this.tick(), intervalMs);
    this.timer.unref?.();
    void this.tick();
    this.logger.log(`ops notification worker started intervalMs=${intervalMs}`);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.opsNotifications.processDueJobs();
      if (!result.skipped && result.processed > 0) {
        this.logger.log(`ops notification jobs processed=${result.processed} sent=${result.sent} failed=${result.failed}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`ops notification worker tick failed: ${message}`);
    } finally {
      this.running = false;
    }
  }
}
