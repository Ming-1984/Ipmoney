import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditStatus, FeaturedLevel, ListingStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

type ListingAdminDto = {
  id: string;
  title: string;
  auditStatus: AuditStatus;
  status: ListingStatus;
  regionCode?: string | null;
  depositAmountFen: number;
  priceType: 'FIXED' | 'NEGOTIABLE';
  priceAmountFen?: number | null;
  tradeMode: 'ASSIGNMENT' | 'LICENSE';
  createdAt: string;
  sellerUserId?: string | null;
  featuredLevel?: FeaturedLevel;
  featuredRegionCode?: string | null;
  featuredRank?: number | null;
  featuredUntil?: string | null;
};

type PagedListingAdmin = {
  items: ListingAdminDto[];
  page: { page: number; pageSize: number; total: number };
};

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  ensureAdmin(req: any) {
    if (!req?.auth?.isAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
  }

  private toAdminDto(it: any): ListingAdminDto {
    const toIso = (d?: Date | null) => (d ? d.toISOString() : undefined);
    return {
      id: it.id,
      title: it.title,
      auditStatus: it.auditStatus,
      status: it.status,
      regionCode: it.regionCode ?? undefined,
      depositAmountFen: it.depositAmount,
      priceType: it.priceType,
      priceAmountFen: it.priceAmount ?? undefined,
      tradeMode: it.tradeMode,
      createdAt: toIso(it.createdAt) || new Date().toISOString(),
      sellerUserId: it.sellerUserId ?? undefined,
      featuredLevel: it.featuredLevel,
      featuredRegionCode: it.featuredRegionCode ?? undefined,
      featuredRank: it.featuredRank ?? undefined,
      featuredUntil: toIso(it.featuredUntil),
    };
  }

  private normalizePatentNumber(raw: string): string {
    const cleaned = String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9.]/g, '');
    const withoutPrefix = cleaned.replace(/^CN/, '').replace(/^ZL/, '');
    return withoutPrefix.replace(/\./g, '');
  }

  private async ensurePatent(body: any) {
    const patentNumberRaw = String(body?.patentNumberRaw || '').trim();
    const patentType = body?.patentType || 'INVENTION';
    const applicationNoNorm = this.normalizePatentNumber(patentNumberRaw);
    if (!applicationNoNorm) return null;
    let patent = await this.prisma.patent.findFirst({ where: { applicationNoNorm } });
    if (!patent) {
      patent = await this.prisma.patent.create({
        data: {
          jurisdiction: 'CN',
          applicationNoNorm,
          applicationNoDisplay: applicationNoNorm.length > 1 ? `${applicationNoNorm.slice(0, -1)}.${applicationNoNorm.slice(-1)}` : applicationNoNorm,
          patentType,
          title: body?.title || '未命名专利',
          abstract: body?.summary || null,
          sourcePrimary: 'USER',
        },
      });
    }
    return patent;
  }

  async listAdmin(query: any): Promise<PagedListingAdmin> {
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 10)));
    const q = String(query?.q || '').trim();
    const regionCode = String(query?.regionCode || '').trim();
    const auditStatus = String(query?.auditStatus || '').trim().toUpperCase();
    const status = String(query?.status || '').trim().toUpperCase();

    const where: any = {};
    if (q) {
      where.OR = [{ title: { contains: q, mode: 'insensitive' } }];
    }
    if (regionCode) where.regionCode = regionCode;
    if (auditStatus) where.auditStatus = auditStatus;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      items: items.map((it) => this.toAdminDto(it)),
      page: { page, pageSize, total },
    };
  }

  async getAdminById(listingId: string): Promise<ListingAdminDto> {
    const it = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!it) throw new NotFoundException({ code: 'NOT_FOUND', message: '上架不存在' });
    return this.toAdminDto(it);
  }

  async approve(listingId: string, reviewerId: string | null, reason?: string) {
    const it = await this.prisma.listing.update({
      where: { id: listingId },
      data: { auditStatus: 'APPROVED' },
    });
    if (reviewerId) {
      await this.prisma.listingAuditLog.create({
        data: {
          listingId,
          reviewerId,
          action: 'APPROVE',
          reason: reason || undefined,
        },
      });
    }
    return this.toAdminDto(it);
  }

  async reject(listingId: string, reviewerId: string | null, reason?: string) {
    const it = await this.prisma.listing.update({
      where: { id: listingId },
      data: { auditStatus: 'REJECTED' },
    });
    if (reviewerId) {
      await this.prisma.listingAuditLog.create({
        data: {
          listingId,
          reviewerId,
          action: 'REJECT',
          reason: reason || undefined,
        },
      });
    }
    return this.toAdminDto(it);
  }

  async updateFeatured(listingId: string, payload: any) {
    const level = String(payload?.featuredLevel || 'NONE').toUpperCase();
    const featuredLevel = ['NONE', 'CITY', 'PROVINCE'].includes(level) ? (level as FeaturedLevel) : 'NONE';
    const data: any = { featuredLevel };
    if (featuredLevel !== 'NONE') {
      data.featuredRegionCode = payload?.featuredRegionCode || null;
      data.featuredRank = payload?.featuredRank ?? null;
      data.featuredUntil = payload?.featuredUntil ? new Date(String(payload.featuredUntil)) : null;
    } else {
      data.featuredRegionCode = null;
      data.featuredRank = null;
      data.featuredUntil = null;
    }

    const it = await this.prisma.listing.update({ where: { id: listingId }, data });
    return this.toAdminDto(it);
  }

  async listMine(req: any, query: any) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const items = await this.prisma.listing.findMany({
      where: { sellerUserId: req.auth.userId },
      include: { patent: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const total = await this.prisma.listing.count({ where: { sellerUserId: req.auth.userId } });
    return {
      items: items.map((it) => ({
        id: it.id,
        title: it.title,
        tradeMode: it.tradeMode,
        priceType: it.priceType,
        priceAmountFen: it.priceAmount ?? null,
        depositAmountFen: it.depositAmount,
        status: it.status,
        auditStatus: it.auditStatus,
        patentType: it.patent?.patentType,
        regionCode: it.regionCode ?? null,
        createdAt: it.createdAt.toISOString(),
        updatedAt: it.updatedAt.toISOString(),
      })),
      page: { page, pageSize, total },
    };
  }

  async getMine(req: any, listingId: string) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
    const it = await this.prisma.listing.findUnique({ where: { id: listingId }, include: { patent: true } });
    if (!it || it.sellerUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '挂牌不存在' });
    }
    return {
      id: it.id,
      title: it.title,
      tradeMode: it.tradeMode,
      licenseMode: it.licenseMode,
      priceType: it.priceType,
      priceAmountFen: it.priceAmount ?? null,
      depositAmountFen: it.depositAmount,
      status: it.status,
      auditStatus: it.auditStatus,
      patentType: it.patent?.patentType,
      regionCode: it.regionCode ?? null,
      summary: it.summary ?? null,
    };
  }

  async createListing(req: any, body: any) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
    const patent = await this.ensurePatent(body);
    if (!patent) throw new NotFoundException({ code: 'NOT_FOUND', message: '专利信息缺失' });
    const depositAmountFen = Number(body?.depositAmountFen || 0);
    const listing = await this.prisma.listing.create({
      data: {
        sellerUserId: req.auth.userId,
        patentId: patent.id,
        title: body?.title || patent.title || '未命名专利',
        summary: body?.summary || null,
        tradeMode: body?.tradeMode || 'ASSIGNMENT',
        licenseMode: body?.licenseMode || null,
        priceType: body?.priceType || 'NEGOTIABLE',
        priceAmount: body?.priceAmountFen ?? null,
        depositAmount: depositAmountFen,
        regionCode: body?.regionCode || null,
        industryTagsJson: body?.industryTags || null,
      },
    });
    return this.toAdminDto(listing);
  }

  async updateListing(req: any, listingId: string, body: any) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.sellerUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '挂牌不存在' });
    }
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        title: body?.title ?? listing.title,
        summary: body?.summary ?? listing.summary,
        tradeMode: body?.tradeMode ?? listing.tradeMode,
        licenseMode: body?.licenseMode ?? listing.licenseMode,
        priceType: body?.priceType ?? listing.priceType,
        priceAmount: body?.priceAmountFen ?? listing.priceAmount,
        depositAmount: body?.depositAmountFen ?? listing.depositAmount,
        regionCode: body?.regionCode ?? listing.regionCode,
        industryTagsJson: body?.industryTags ?? listing.industryTagsJson,
      },
    });
    return this.toAdminDto(updated);
  }

  async submitListing(req: any, listingId: string) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.sellerUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '挂牌不存在' });
    }
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { auditStatus: 'PENDING', status: 'ACTIVE' },
    });
    return this.toAdminDto(updated);
  }

  async offShelf(req: any, listingId: string) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.sellerUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '挂牌不存在' });
    }
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: 'OFF_SHELF' },
    });
    return this.toAdminDto(updated);
  }

  async searchPublic(query: any) {
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const q = String(query?.q || '').trim();
    const items = await this.prisma.listing.findMany({
      where: {
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      },
      include: { patent: true, stats: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const total = await this.prisma.listing.count({
      where: {
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      },
    });
    return {
      items: items.map((it) => ({
        id: it.id,
        title: it.title,
        coverUrl: null,
        patentType: it.patent?.patentType,
        tradeMode: it.tradeMode,
        priceType: it.priceType,
        priceAmountFen: it.priceAmount ?? null,
        depositAmountFen: it.depositAmount,
        regionCode: it.regionCode ?? null,
        industryTags: it.industryTagsJson ?? null,
        featuredLevel: it.featuredLevel,
        featuredRegionCode: it.featuredRegionCode ?? null,
        stats: it.stats ?? null,
      })),
      page: { page, pageSize, total },
    };
  }

  async getPublicById(listingId: string) {
    const it = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { patent: true, seller: true },
    });
    if (!it) throw new NotFoundException({ code: 'NOT_FOUND', message: '挂牌不存在' });
    return {
      id: it.id,
      title: it.title,
      summary: it.summary ?? null,
      tradeMode: it.tradeMode,
      licenseMode: it.licenseMode,
      priceType: it.priceType,
      priceAmountFen: it.priceAmount ?? null,
      depositAmountFen: it.depositAmount,
      regionCode: it.regionCode ?? null,
      industryTags: it.industryTagsJson ?? null,
      featuredLevel: it.featuredLevel,
      featuredRegionCode: it.featuredRegionCode ?? null,
      patentId: it.patentId,
      seller: it.seller
        ? {
            id: it.seller.id,
            nickname: it.seller.nickname,
            avatarUrl: it.seller.avatarUrl,
            verificationType: null,
          }
        : null,
    };
  }

  async createConsultation(req: any, listingId: string, payload: any) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
    const channel = String(payload?.channel || 'FORM').toUpperCase();
    await this.prisma.listingConsultEvent.create({
      data: {
        listingId,
        userId: req.auth.userId,
        channel: channel === 'PHONE' ? 'PHONE' : channel === 'WECHAT_CS' ? 'WECHAT_CS' : 'FORM',
      },
    });
    return { ok: true };
  }
}
