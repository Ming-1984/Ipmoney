import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { AuditLogService } from '../../common/audit-log.service';
import { requirePermission } from '../../common/permissions';
import { PrismaService } from '../../common/prisma/prisma.service';

const CONTENT_TYPES = ['LISTING', 'DEMAND', 'ACHIEVEMENT', 'ARTWORK'] as const;
const CONTENT_SCOPES = ['LISTING', 'DEMAND', 'ACHIEVEMENT', 'ARTWORK', 'ALL'] as const;
const PARSE_STATUS = ['ACTIVE', 'REVIEW_REQUIRED', 'REPLACED'] as const;

@Injectable()
export class AiService {
  private seeded = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  private hasOwn(input: any, key: string) {
    return !!input && Object.prototype.hasOwnProperty.call(input, key);
  }

  private parsePositiveIntStrict(value: unknown, fieldName: string): number {
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private normalizeContentType(value: any) {
    const v = String(value || '').trim().toUpperCase();
    return CONTENT_TYPES.includes(v as any) ? (v as (typeof CONTENT_TYPES)[number]) : undefined;
  }

  private normalizeContentScope(value: any) {
    const v = String(value || '').trim().toUpperCase();
    return CONTENT_SCOPES.includes(v as any) ? (v as (typeof CONTENT_SCOPES)[number]) : undefined;
  }

  private normalizeParseStatus(value: any) {
    const v = String(value || '').trim().toUpperCase();
    return PARSE_STATUS.includes(v as any) ? (v as (typeof PARSE_STATUS)[number]) : undefined;
  }

  private parseContentTypeStrict(value: any, field: string) {
    const contentType = this.normalizeContentType(value);
    if (!contentType) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${field} is invalid` });
    }
    return contentType;
  }

  private parseContentScopeStrict(value: any, field: string) {
    const contentScope = this.normalizeContentScope(value);
    if (!contentScope) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${field} is invalid` });
    }
    return contentScope;
  }

  private parseParseStatusStrict(value: any, field: string) {
    const status = this.normalizeParseStatus(value);
    if (!status) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${field} is invalid` });
    }
    return status;
  }

  private normalizeKeywords(input: any): string[] {
    if (!Array.isArray(input)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of input) {
      const keyword = String(raw || '').trim();
      if (!keyword) continue;
      if (!seen.has(keyword)) {
        seen.add(keyword);
        out.push(keyword);
      }
    }
    return out;
  }

  private keywordize(text: string): string[] {
    const trimmed = text.trim();
    if (!trimmed) return [];
    const parts = trimmed
      .split(/[\s,;，。|/]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (parts.length) return Array.from(new Set(parts)).slice(0, 8);
    return [trimmed];
  }

  private toParseResultDto(row: any) {
    return {
      id: row.id,
      contentType: row.contentType,
      contentId: row.contentId,
      summaryPlain: row.summaryPlain ?? undefined,
      featuresPlain: row.featuresPlain ?? undefined,
      keywords: Array.isArray(row.keywordsJson) ? row.keywordsJson : [],
      confidence: row.confidence ?? 0,
      modelVersion: row.modelVersion ?? undefined,
      status: row.status ?? 'ACTIVE',
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? undefined,
    };
  }

  private toFeedbackDto(row: any) {
    return {
      id: row.id,
      parseResultId: row.parseResultId,
      actorUserId: row.actorUserId ?? undefined,
      actorType: row.actorType,
      score: row.score,
      reasonTags: Array.isArray(row.reasonTagsJson) ? row.reasonTagsJson : [],
      comment: row.comment ?? undefined,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  private async ensureSeeded() {
    if (this.seeded) return;
    const existing = await this.prisma.aiParseResult.count();
    if (existing > 0) {
      this.seeded = true;
      return;
    }

    const [listings, demands, achievements, artworks] = await Promise.all([
      this.prisma.listing.findMany({
        where: { status: 'ACTIVE' as any, auditStatus: 'APPROVED' as any },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.demand.findMany({
        where: { status: 'ACTIVE' as any, auditStatus: 'APPROVED' as any },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.achievement.findMany({
        where: { status: 'ACTIVE' as any, auditStatus: 'APPROVED' as any },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.artwork.findMany({
        where: { status: 'ACTIVE' as any, auditStatus: 'APPROVED' as any },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const now = new Date();
    const seedRows: any[] = [];

    listings.forEach((item: any) => {
      seedRows.push({
        id: randomUUID(),
        contentType: 'LISTING',
        contentId: item.id,
        summaryPlain: item.summary || item.title,
        featuresPlain: item.summary || null,
        keywordsJson: this.keywordize(item.title || ''),
        confidence: 0.52,
        modelVersion: 'seed-v1',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      });
    });

    demands.forEach((item: any) => {
      seedRows.push({
        id: randomUUID(),
        contentType: 'DEMAND',
        contentId: item.id,
        summaryPlain: item.summary || item.description || item.title,
        featuresPlain: item.description || null,
        keywordsJson: this.keywordize(item.title || ''),
        confidence: 0.5,
        modelVersion: 'seed-v1',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      });
    });

    achievements.forEach((item: any) => {
      seedRows.push({
        id: randomUUID(),
        contentType: 'ACHIEVEMENT',
        contentId: item.id,
        summaryPlain: item.summary || item.description || item.title,
        featuresPlain: item.description || null,
        keywordsJson: this.keywordize(item.title || ''),
        confidence: 0.5,
        modelVersion: 'seed-v1',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      });
    });

    artworks.forEach((item: any) => {
      seedRows.push({
        id: randomUUID(),
        contentType: 'ARTWORK',
        contentId: item.id,
        summaryPlain: item.description || item.title,
        featuresPlain: item.description || null,
        keywordsJson: this.keywordize(item.title || ''),
        confidence: 0.5,
        modelVersion: 'seed-v1',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      });
    });

    if (seedRows.length) {
      await this.prisma.aiParseResult.createMany({ data: seedRows, skipDuplicates: true });
    }

    this.seeded = true;
  }

  private async searchListings(text: string, limit: number) {
    const where: any = { status: 'ACTIVE', auditStatus: 'APPROVED' };
    if (text) {
      where.OR = [
        { title: { contains: text, mode: 'insensitive' } },
        { summary: { contains: text, mode: 'insensitive' } },
      ];
    }
    return await this.prisma.listing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, title: true },
    });
  }

  private async searchDemands(text: string, limit: number) {
    const where: any = { status: 'ACTIVE', auditStatus: 'APPROVED' };
    if (text) {
      where.OR = [
        { title: { contains: text, mode: 'insensitive' } },
        { summary: { contains: text, mode: 'insensitive' } },
        { description: { contains: text, mode: 'insensitive' } },
      ];
    }
    return await this.prisma.demand.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, title: true },
    });
  }

  private async searchAchievements(text: string, limit: number) {
    const where: any = { status: 'ACTIVE', auditStatus: 'APPROVED' };
    if (text) {
      where.OR = [
        { title: { contains: text, mode: 'insensitive' } },
        { summary: { contains: text, mode: 'insensitive' } },
        { description: { contains: text, mode: 'insensitive' } },
      ];
    }
    return await this.prisma.achievement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, title: true },
    });
  }

  private async searchArtworks(text: string, limit: number) {
    const where: any = { status: 'ACTIVE', auditStatus: 'APPROVED' };
    if (text) {
      where.OR = [
        { title: { contains: text, mode: 'insensitive' } },
        { description: { contains: text, mode: 'insensitive' } },
        { creatorName: { contains: text, mode: 'insensitive' } },
      ];
    }
    return await this.prisma.artwork.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, title: true },
    });
  }

  async createAgentQuery(payload: any) {
    const inputType = String(payload?.inputType || '').trim().toUpperCase();
    if (!inputType || (inputType !== 'TEXT' && inputType !== 'VOICE')) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'inputType is invalid' });
    }

    const hasContentScope = !!payload && Object.prototype.hasOwnProperty.call(payload, 'contentScope');
    const contentScope = hasContentScope ? this.parseContentScopeStrict(payload?.contentScope, 'contentScope') : 'ALL';
    const inputText = String(payload?.inputText || '').trim();
    const recognizedText = inputText || '';
    const normalizedText = recognizedText.trim();

    const keywords = this.keywordize(normalizedText);
    const hasContentType = !!payload && Object.prototype.hasOwnProperty.call(payload, 'contentType');
    const explicitContentType = hasContentType ? this.parseContentTypeStrict(payload?.contentType, 'contentType') : undefined;
    const parsedContentType = explicitContentType || (contentScope !== 'ALL' ? (contentScope as any) : 'LISTING');

    const filters: any = {};
    if (normalizedText) filters.q = normalizedText;
    if (payload?.regionCode) filters.regionCode = String(payload.regionCode).trim();
    if (Array.isArray(payload?.industryTags)) {
      filters.industryTags = payload.industryTags.map((item: any) => String(item).trim()).filter(Boolean);
    }

    const targetTypes = contentScope === 'ALL' ? CONTENT_TYPES : ([contentScope] as any);
    const matches: any[] = [];

    for (const type of targetTypes) {
      let rows: Array<{ id: string; title: string }> = [];
      if (type === 'LISTING') rows = await this.searchListings(normalizedText, 3);
      if (type === 'DEMAND') rows = await this.searchDemands(normalizedText, 3);
      if (type === 'ACHIEVEMENT') rows = await this.searchAchievements(normalizedText, 3);
      if (type === 'ARTWORK') rows = await this.searchArtworks(normalizedText, 3);

      rows.forEach((row, idx) => {
        matches.push({
          contentType: type,
          contentId: row.id,
          title: row.title,
          reason: normalizedText ? 'Keyword match' : 'Recent content',
          score: Math.max(0.5, 0.9 - idx * 0.1),
        });
      });
    }

    return {
      queryId: randomUUID(),
      recognizedText: recognizedText || undefined,
      normalizedText: normalizedText || undefined,
      contentScope,
      parsedQuery: {
        contentType: parsedContentType,
        keywords,
        filters,
      },
      matchSummary: matches.length ? `Matched ${matches.length} items` : 'No matches',
      topMatches: matches.slice(0, 10),
      confidence: normalizedText ? 0.6 : 0.4,
      createdAt: new Date().toISOString(),
    };
  }

  async createFeedback(req: any, parseResultId: string, payload: any) {
    this.ensureAuth(req);

    const score = Number(payload?.score || 0);
    if (!Number.isFinite(score) || score < 1 || score > 5) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'score must be between 1 and 5' });
    }

    const parseResult = await this.prisma.aiParseResult.findUnique({ where: { id: parseResultId } });
    if (!parseResult) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Parse result not found' });

    const reasonTags = this.normalizeKeywords(payload?.reasonTags);
    const comment = payload?.comment ? String(payload.comment).trim() : undefined;
    const actorType = req?.auth?.isAdmin ? 'ADMIN' : 'USER';

    const created = await this.prisma.aiParseFeedback.create({
      data: {
        parseResultId,
        actorUserId: req?.auth?.userId,
        actorType,
        score: Math.round(score),
        reasonTagsJson: reasonTags,
        comment: comment || null,
      },
    });

    return this.toFeedbackDto(created);
  }

  async adminListParseResults(req: any, query: any) {
    this.ensureAuth(req);
    requirePermission(req, 'ai.manage');
    await this.ensureSeeded();

    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
    const hasContentType = this.hasOwn(query, 'contentType');
    const hasStatus = this.hasOwn(query, 'status');
    const contentType = hasContentType ? this.parseContentTypeStrict(query?.contentType, 'contentType') : undefined;
    const status = hasStatus ? this.parseParseStatusStrict(query?.status, 'status') : undefined;

    const where: any = {};
    if (contentType) where.contentType = contentType;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.aiParseResult.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.aiParseResult.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toParseResultDto(item)),
      page: { page, pageSize, total },
    };
  }

  async adminGetParseResult(req: any, parseResultId: string) {
    this.ensureAuth(req);
    requirePermission(req, 'ai.manage');
    await this.ensureSeeded();

    const item = await this.prisma.aiParseResult.findUnique({ where: { id: parseResultId } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Parse result not found' });

    return this.toParseResultDto(item);
  }

  async adminUpdateParseResult(req: any, parseResultId: string, payload: any) {
    this.ensureAuth(req);
    requirePermission(req, 'ai.manage');
    await this.ensureSeeded();

    const existing = await this.prisma.aiParseResult.findUnique({ where: { id: parseResultId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Parse result not found' });

    const next: any = {};
    if (payload?.summaryPlain !== undefined) next.summaryPlain = String(payload.summaryPlain || '').trim() || null;
    if (payload?.featuresPlain !== undefined) next.featuresPlain = String(payload.featuresPlain || '').trim() || null;
    if (payload?.keywords !== undefined) next.keywordsJson = this.normalizeKeywords(payload.keywords);
    if (payload?.status !== undefined) {
      const status = this.normalizeParseStatus(payload.status);
      if (!status) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'status is invalid' });
      }
      next.status = status;
    }
    if (payload?.note !== undefined) next.note = String(payload.note || '').trim() || null;

    const updated = await this.prisma.aiParseResult.update({ where: { id: parseResultId }, data: next });

    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'AI_PARSE_UPDATE',
      targetType: 'AI_PARSE_RESULT',
      targetId: parseResultId,
      beforeJson: this.toParseResultDto(existing),
      afterJson: this.toParseResultDto(updated),
    });

    return this.toParseResultDto(updated);
  }
}
