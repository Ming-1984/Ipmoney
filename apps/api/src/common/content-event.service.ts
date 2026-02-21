import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

import { PrismaService } from './prisma/prisma.service';
import { ConfigService } from '../modules/config/config.service';

type ContentType = 'LISTING' | 'DEMAND' | 'ACHIEVEMENT' | 'ARTWORK';
type EventType = 'VIEW' | 'FAVORITE' | 'CONSULT';

type ActorInfo = {
  actorKey: string;
  actorUserId?: string | null;
  deviceId?: string | null;
};

@Injectable()
export class ContentEventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private normalizeDeviceId(value: unknown): string | null {
    const raw = typeof value === 'string' ? value : Array.isArray(value) ? value[0] : '';
    const deviceId = String(raw || '').trim();
    return deviceId.length > 0 ? deviceId : null;
  }

  private pickClientIp(req: any): string | null {
    const xff = req?.headers?.['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) {
      return xff.split(',')[0].trim();
    }
    if (Array.isArray(xff) && xff.length > 0) {
      return String(xff[0] || '').trim() || null;
    }
    const realIp = req?.headers?.['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
    const ip = req?.ip || req?.connection?.remoteAddress || req?.socket?.remoteAddress;
    return typeof ip === 'string' && ip.trim() ? ip.trim() : null;
  }

  private hash(input: string): string {
    return createHash('sha256').update(input).digest('hex').slice(0, 32);
  }

  private resolveActor(req: any): ActorInfo | null {
    const actorUserId = req?.auth?.userId ? String(req.auth.userId) : null;
    const deviceId = this.normalizeDeviceId(req?.headers?.['x-device-id']);

    if (actorUserId) {
      return { actorKey: `U:${actorUserId}`, actorUserId, deviceId };
    }

    if (deviceId) {
      return { actorKey: `D:${deviceId}`, actorUserId: null, deviceId };
    }

    const ip = this.pickClientIp(req);
    const ua = String(req?.headers?.['user-agent'] || '').trim();
    if (!ip && !ua) return null;

    const base = `${ip || 'unknown'}|${ua || 'unknown'}`;
    return { actorKey: `I:${this.hash(base)}`, actorUserId: null, deviceId: null };
  }

  private async shouldRecordEvent(
    contentType: ContentType,
    contentId: string,
    eventType: EventType,
    actorKey: string,
  ) {
    const config = await this.config.getRecommendation();
    const windowHours = Math.max(1, Number(config?.dedupeWindowHours || 24));
    const cutoff = new Date(Date.now() - windowHours * 3600 * 1000);

    const existing = await this.prisma.contentEvent.findFirst({
      where: {
        contentType,
        contentId,
        eventType,
        actorKey,
        createdAt: { gte: cutoff },
      },
      select: { id: true },
    });

    return !existing;
  }

  private buildStatsIncrement(delta: { viewCount?: number; favoriteCount?: number; consultCount?: number; commentCount?: number }) {
    const data: Record<string, any> = {};
    if (delta.viewCount) data.viewCount = { increment: delta.viewCount };
    if (delta.favoriteCount) data.favoriteCount = { increment: delta.favoriteCount };
    if (delta.consultCount) data.consultCount = { increment: delta.consultCount };
    if (delta.commentCount) data.commentCount = { increment: delta.commentCount };
    return data;
  }

  private async incrementStats(
    contentType: ContentType,
    contentId: string,
    delta: { viewCount?: number; favoriteCount?: number; consultCount?: number },
  ) {
    const data = this.buildStatsIncrement(delta);
    if (Object.keys(data).length === 0) return;

    if (contentType === 'LISTING') {
      await this.prisma.listingStats.upsert({
        where: { listingId: contentId },
        create: {
          listingId: contentId,
          viewCount: delta.viewCount ?? 0,
          favoriteCount: delta.favoriteCount ?? 0,
          consultCount: delta.consultCount ?? 0,
        },
        update: data,
      });
      return;
    }

    if (contentType === 'DEMAND') {
      await this.prisma.demandStats.upsert({
        where: { demandId: contentId },
        create: {
          demandId: contentId,
          viewCount: delta.viewCount ?? 0,
          favoriteCount: delta.favoriteCount ?? 0,
          consultCount: delta.consultCount ?? 0,
          commentCount: 0,
        },
        update: data,
      });
      return;
    }

    if (contentType === 'ACHIEVEMENT') {
      await this.prisma.achievementStats.upsert({
        where: { achievementId: contentId },
        create: {
          achievementId: contentId,
          viewCount: delta.viewCount ?? 0,
          favoriteCount: delta.favoriteCount ?? 0,
          consultCount: delta.consultCount ?? 0,
          commentCount: 0,
        },
        update: data,
      });
      return;
    }

    await this.prisma.artworkStats.upsert({
      where: { artworkId: contentId },
      create: {
        artworkId: contentId,
        viewCount: delta.viewCount ?? 0,
        favoriteCount: delta.favoriteCount ?? 0,
        consultCount: delta.consultCount ?? 0,
        commentCount: 0,
      },
      update: data,
    });
  }

  async adjustFavoriteCount(contentType: ContentType, contentId: string, delta: number) {
    if (!Number.isFinite(delta) || delta === 0) return;

    if (delta > 0) {
      await this.incrementStats(contentType, contentId, { favoriteCount: delta });
      return;
    }

    if (contentType === 'LISTING') {
      const current = await this.prisma.listingStats.findUnique({ where: { listingId: contentId } });
      if (!current) return;
      const next = Math.max(0, (current.favoriteCount ?? 0) + delta);
      if (next === current.favoriteCount) return;
      await this.prisma.listingStats.update({ where: { listingId: contentId }, data: { favoriteCount: next } });
      return;
    }

    if (contentType === 'DEMAND') {
      const current = await this.prisma.demandStats.findUnique({ where: { demandId: contentId } });
      if (!current) return;
      const next = Math.max(0, (current.favoriteCount ?? 0) + delta);
      if (next === current.favoriteCount) return;
      await this.prisma.demandStats.update({ where: { demandId: contentId }, data: { favoriteCount: next } });
      return;
    }

    if (contentType === 'ACHIEVEMENT') {
      const current = await this.prisma.achievementStats.findUnique({ where: { achievementId: contentId } });
      if (!current) return;
      const next = Math.max(0, (current.favoriteCount ?? 0) + delta);
      if (next === current.favoriteCount) return;
      await this.prisma.achievementStats.update({ where: { achievementId: contentId }, data: { favoriteCount: next } });
      return;
    }

    const current = await this.prisma.artworkStats.findUnique({ where: { artworkId: contentId } });
    if (!current) return;
    const next = Math.max(0, (current.favoriteCount ?? 0) + delta);
    if (next === current.favoriteCount) return;
    await this.prisma.artworkStats.update({ where: { artworkId: contentId }, data: { favoriteCount: next } });
  }

  async recordView(req: any, contentType: ContentType, contentId: string) {
    const actor = this.resolveActor(req);
    if (!actor) return false;

    const shouldRecord = await this.shouldRecordEvent(contentType, contentId, 'VIEW', actor.actorKey);
    if (!shouldRecord) return false;

    await this.prisma.contentEvent.create({
      data: {
        contentType,
        contentId,
        eventType: 'VIEW',
        actorKey: actor.actorKey,
        actorUserId: actor.actorUserId ?? undefined,
        deviceId: actor.deviceId ?? undefined,
      },
    });

    await this.incrementStats(contentType, contentId, { viewCount: 1 });
    return true;
  }

  async recordFavorite(req: any, contentType: ContentType, contentId: string) {
    const actor = this.resolveActor(req);
    if (!actor) return false;

    const shouldRecord = await this.shouldRecordEvent(contentType, contentId, 'FAVORITE', actor.actorKey);
    if (!shouldRecord) return false;

    await this.prisma.contentEvent.create({
      data: {
        contentType,
        contentId,
        eventType: 'FAVORITE',
        actorKey: actor.actorKey,
        actorUserId: actor.actorUserId ?? undefined,
        deviceId: actor.deviceId ?? undefined,
      },
    });

    return true;
  }

  async recordConsult(req: any, contentType: ContentType, contentId: string) {
    const actor = this.resolveActor(req);
    if (!actor) return false;

    const shouldRecord = await this.shouldRecordEvent(contentType, contentId, 'CONSULT', actor.actorKey);
    if (!shouldRecord) return false;

    await this.prisma.contentEvent.create({
      data: {
        contentType,
        contentId,
        eventType: 'CONSULT',
        actorKey: actor.actorKey,
        actorUserId: actor.actorUserId ?? undefined,
        deviceId: actor.deviceId ?? undefined,
      },
    });

    await this.incrementStats(contentType, contentId, { consultCount: 1 });
    return true;
  }
}
