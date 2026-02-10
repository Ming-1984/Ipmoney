import { Injectable } from '@nestjs/common';

import { PrismaService } from './prisma/prisma.service';

type AuditTargetType = 'LISTING' | 'DEMAND' | 'ACHIEVEMENT' | 'ARTWORK' | 'VERIFICATION';

type AuditMaterialDto = {
  id: string;
  name: string;
  url?: string;
  kind?: string;
  uploadedAt: string;
};

type AuditLogDto = {
  id: string;
  action: string;
  reason?: string;
  operatorId?: string;
  operatorName?: string | null;
  createdAt: string;
};

@Injectable()
export class ContentAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async listMaterials(targetType: AuditTargetType, targetId: string) {
    if (!targetId) return { items: [] as AuditMaterialDto[] };

    const items: AuditMaterialDto[] = [];
    const seen = new Set<string>();

    const pushFile = (file: any, fallbackName: string, kind?: string) => {
      if (!file?.id || seen.has(file.id)) return;
      seen.add(file.id);
      items.push({
        id: file.id,
        name: String(file.fileName || fallbackName),
        url: file.url ?? undefined,
        kind,
        uploadedAt: file.createdAt ? new Date(file.createdAt).toISOString() : new Date().toISOString(),
      });
    };

    if (targetType === 'LISTING') {
      const listing = await this.prisma.listing.findUnique({
        where: { id: targetId },
        select: { proofFileIdsJson: true },
      });
      const proofFileIds = this.normalizeFileIds((listing as any)?.proofFileIdsJson);
      if (proofFileIds.length) {
        const files = await this.prisma.file.findMany({ where: { id: { in: proofFileIds } } });
        const fileMap = new Map(files.map((file) => [file.id, file]));
        for (const id of proofFileIds) {
          const file = fileMap.get(id);
          if (file) pushFile(file, 'Ownership Evidence', 'OWNERSHIP');
        }
      }

      if (!items.length) {
        const media = await this.prisma.listingMedia.findMany({
          where: { listingId: targetId, type: 'FILE' },
          include: { file: true },
          orderBy: { sort: 'asc' },
        });
        for (const m of media) {
          if (m.file) pushFile(m.file, 'Attachment', String(m.type));
        }
      }

      return { items };
    }

    if (targetType === 'DEMAND') {
      const media = await this.prisma.demandMedia.findMany({
        where: { demandId: targetId },
        include: { file: true },
        orderBy: { sort: 'asc' },
      });
      for (const m of media) {
        if (m.file) pushFile(m.file, 'Attachment', String(m.type));
      }
      return { items };
    }

    if (targetType === 'ACHIEVEMENT') {
      const media = await this.prisma.achievementMedia.findMany({
        where: { achievementId: targetId },
        include: { file: true },
        orderBy: { sort: 'asc' },
      });
      for (const m of media) {
        if (m.file) pushFile(m.file, 'Attachment', String(m.type));
      }
      return { items };
    }

    if (targetType === 'ARTWORK') {
      const media = await this.prisma.artworkMedia.findMany({
        where: { artworkId: targetId },
        include: { file: true },
        orderBy: { sort: 'asc' },
      });
      for (const m of media) {
        if (m.file) pushFile(m.file, 'Attachment', String(m.type));
      }
      return { items };
    }

    if (targetType === 'VERIFICATION') {
      const verification = await this.prisma.userVerification.findUnique({
        where: { id: targetId },
        select: { evidenceFileIdsJson: true },
      });
      const evidenceFileIds = this.normalizeFileIds((verification as any)?.evidenceFileIdsJson);
      if (evidenceFileIds.length) {
        const files = await this.prisma.file.findMany({ where: { id: { in: evidenceFileIds } } });
        const fileMap = new Map(files.map((file) => [file.id, file]));
        for (const id of evidenceFileIds) {
          const file = fileMap.get(id);
          if (file) pushFile(file, 'Verification Evidence', 'OWNERSHIP');
        }
      }
      return { items };
    }

    return { items };
  }

  async listLogs(targetType: AuditTargetType, targetId: string) {
    if (!targetId) return { items: [] as AuditLogDto[] };
    const dbTargetType = targetType === 'VERIFICATION' ? 'USER_VERIFICATION' : targetType;
    const logs = await this.prisma.auditLog.findMany({
      where: { targetType: dbTargetType, targetId },
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: logs.map((log) => ({
        id: log.id,
        action: this.normalizeAction(log.action, targetType),
        reason: this.extractReason(log.afterJson, log.beforeJson),
        operatorId: log.actorUserId ?? undefined,
        operatorName: log.actor?.nickname ?? log.actor?.phone ?? null,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }

  private normalizeFileIds(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((id) => String(id).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : [];
    }
    return [];
  }

  private extractReason(afterJson: any, beforeJson: any) {
    const fromAfter = this.extractReasonValue(afterJson);
    if (fromAfter) return fromAfter;
    return this.extractReasonValue(beforeJson);
  }

  private extractReasonValue(payload: any) {
    if (!payload || typeof payload !== 'object') return undefined;
    const value = payload.reason ?? payload.comment ?? payload.note;
    if (typeof value === 'string' && value.trim()) return value;
    return undefined;
  }

  private normalizeAction(action: string, targetType: AuditTargetType) {
    const normalizedTarget = targetType === 'VERIFICATION' ? 'VERIFICATION' : targetType;
    const prefix = `${normalizedTarget}_`;
    if (action?.startsWith(prefix)) return action.slice(prefix.length);
    return action || '';
  }
}
