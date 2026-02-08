import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

type AuditStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ListingStatus = 'DRAFT' | 'ACTIVE' | 'OFF_SHELF' | 'SOLD';
type FeaturedLevel = 'NONE' | 'CITY' | 'PROVINCE';
type ContentSource = 'USER' | 'PLATFORM' | 'ADMIN';

import { AuditLogService } from '../../common/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { addAuditLog } from '../audit-store';

type ListingAdminDto = {
  id: string;
  source?: ContentSource;
  proofFileIds?: string[] | null;
  title: string;
  auditStatus: AuditStatus;
  status: ListingStatus;
  regionCode?: string | null;
  depositAmountFen: number;
  priceType: 'FIXED' | 'NEGOTIABLE';
  priceAmountFen?: number | null;
  tradeMode: 'ASSIGNMENT' | 'LICENSE';
  createdAt: string;
  updatedAt: string;
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
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogService) {}

  ensureAdmin(req: any) {
    if (!req?.auth?.isAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }

  }
  private normalizeContentSource(value: any): ContentSource | undefined {
    const source = String(value || '').trim().toUpperCase();
    if (source === 'USER' || source === 'ADMIN' || source === 'PLATFORM') return source as ContentSource;
    return undefined;
  }

  private normalizePatentSource(value: any): 'USER' | 'ADMIN' | 'PROVIDER' | undefined {
    const source = String(value || '').trim().toUpperCase();
    if (!source) return undefined;
    if (source === 'PLATFORM') return 'ADMIN';
    if (source === 'USER' || source === 'ADMIN' || source === 'PROVIDER') return source as 'USER' | 'ADMIN' | 'PROVIDER';
    return undefined;
  }

  private normalizeListingStatus(value: any): ListingStatus | undefined {
    const s = String(value || '').trim().toUpperCase();
    if (s === 'DRAFT' || s === 'ACTIVE' || s === 'OFF_SHELF' || s === 'SOLD') return s as ListingStatus;
    return undefined;
  }

  private normalizeAuditStatus(value: any): AuditStatus | undefined {
    const s = String(value || '').trim().toUpperCase();
    if (s === 'PENDING' || s === 'APPROVED' || s === 'REJECTED') return s as AuditStatus;
    return undefined;
  }

  private normalizeFileIds(input: unknown): string[] {
    return Array.from(
      new Set(
        this.normalizeStringArray(input)
          .map((v: any) => String(v || '').trim())
          .filter((v: any) => v.length > 0),
      ),
    );
  }

  private async assertOwnedFiles(userId: string, fileIds: string[], label: string) {
    if (!fileIds || fileIds.length === 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${label} is required` });
    }
    const files = await this.prisma.file.findMany({ where: { id: { in: fileIds } } });
    if (files.length !== fileIds.length) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${label} is invalid` });
    }
    const notOwned = files.filter((f: any) => String(f.ownerId || '') !== userId);
    if (notOwned.length > 0) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
  }

  private toAdminDto(it: any): ListingAdminDto {
    const toIso = (d?: Date | null) => (d ? d.toISOString() : undefined);
    return {
      id: it.id,
      source: it.source ?? 'USER',
      proofFileIds: it.proofFileIdsJson ?? null,
      title: it.title,
      auditStatus: it.auditStatus,
      status: it.status,
      regionCode: it.regionCode ?? undefined,
      depositAmountFen: it.depositAmount,
      priceType: it.priceType,
      priceAmountFen: it.priceAmount ?? undefined,
      tradeMode: it.tradeMode,
      createdAt: toIso(it.createdAt) || new Date().toISOString(),
      updatedAt: toIso(it.updatedAt) || new Date().toISOString(),
      sellerUserId: it.sellerUserId ?? undefined,
      featuredLevel: it.featuredLevel,
      featuredRegionCode: it.featuredRegionCode ?? undefined,
      featuredRank: it.featuredRank ?? undefined,
      featuredUntil: toIso(it.featuredUntil),
    };
  }

  private toHalfWidth(input: string): string {
    let out = '';
    for (const ch of input) {
      const code = ch.charCodeAt(0);
      if (code === 0x3000) {
        out += ' ';
        continue;
      }
      if (code >= 0xff01 && code <= 0xff5e) {
        out += String.fromCharCode(code - 0xfee0);
        continue;
      }
      out += ch;
    }
    return out;
  }

  private cleanPatentRaw(raw: string): string {
    let s = this.toHalfWidth(String(raw || '')).trim();
    s = s.toUpperCase();
    s = s.replace(/^(?:PATENT|APPLICATION|PUBLICATION|GRANT)(?:NO|NUMBER)?/g, '');
    s = s.replace(/^(?:NO|NUMBER)/g, '');
    s = s.replace(/[^A-Z0-9.]/g, '');
    return s;
  }
  private digitToPatentType(typeDigit: string): 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN' | null {
    if (typeDigit === '1') return 'INVENTION';
    if (typeDigit === '2') return 'UTILITY_MODEL';
    if (typeDigit === '3') return 'DESIGN';
    return null;
  }

  private kindToPatentType(kind: string): 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN' | null {
    const k = String(kind || '').toUpperCase();
    if (k.startsWith('U')) return 'UTILITY_MODEL';
    if (k.startsWith('S')) return 'DESIGN';
    if (k.startsWith('A') || k.startsWith('B')) return 'INVENTION';
    return null;
  }

  private toApplicationDisplay(normDigits: string): string {
    const d = String(normDigits || '').replace(/\D/g, '');
    if (d.length < 2) return d;
    return `${d.slice(0, -1)}.${d.slice(-1)}`;
  }

  private parsePatentNumber(raw: string): {
    applicationNoNorm: string;
    applicationNoDisplay?: string;
    publicationNoDisplay?: string;
    patentNoDisplay?: string;
    grantPublicationNoDisplay?: string;
    patentType?: 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN';
    primaryIdType: 'APPLICATION' | 'PUBLICATION';
    identifierCandidates: Array<{ idType: 'APPLICATION' | 'PATENT' | 'PUBLICATION'; idValueNorm: string; kindCode?: string }>;
  } {
    const cleaned = this.cleanPatentRaw(raw);
    if (!cleaned) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'patentNumberRaw is required' });
    }

    const identifierCandidates: Array<{ idType: 'APPLICATION' | 'PATENT' | 'PUBLICATION'; idValueNorm: string; kindCode?: string }> = [];
    const isPatentNo = cleaned.startsWith('ZL') || cleaned.startsWith('CNZL');
    const withoutPrefix = cleaned.replace(/^CN/, '').replace(/^ZL/, '');
    const digits = withoutPrefix.replace(/\./g, '');

    if (/^(19\d{2}|20\d{2})[123]\d{7}\d$/.test(digits) || /^\d{2}[123]\d{5}\d$/.test(digits)) {
      const typeDigit = digits.startsWith('19') || digits.startsWith('20') ? digits.slice(4, 5) : digits.slice(2, 3);
      const patentType = this.digitToPatentType(typeDigit) ?? undefined;
      const applicationNoNorm = digits;
      const applicationNoDisplay = this.toApplicationDisplay(digits);
      const patentNoDisplay = isPatentNo ? `ZL${applicationNoDisplay}` : undefined;
      identifierCandidates.push({ idType: 'APPLICATION', idValueNorm: applicationNoNorm });
      if (isPatentNo) {
        identifierCandidates.push({ idType: 'PATENT', idValueNorm: `ZL${applicationNoNorm}` });
      }
      return {
        applicationNoNorm,
        applicationNoDisplay,
        patentNoDisplay,
        patentType,
        primaryIdType: 'APPLICATION',
        identifierCandidates,
      };
    }

    const pubMatch = cleaned.match(/^(?:CN)?(\d{7,9})([A-Z]\d?)$/);
    if (pubMatch) {
      const number = pubMatch[1];
      const kindCode = pubMatch[2];
      const publicationNoNorm = `CN${number}${kindCode}`;
      const patentType = this.kindToPatentType(kindCode) ?? undefined;
      identifierCandidates.push({ idType: 'PUBLICATION', idValueNorm: publicationNoNorm, kindCode });
      return {
        applicationNoNorm: number,
        publicationNoDisplay: publicationNoNorm,
        grantPublicationNoDisplay: kindCode.startsWith('B') ? publicationNoNorm : undefined,
        patentType,
        primaryIdType: 'PUBLICATION',
        identifierCandidates,
      };
    }

    throw new BadRequestException({ code: 'BAD_REQUEST', message: 'invalid patent number format' });
  }
  private normalizeStringArray(input: unknown): string[] {
    if (Array.isArray(input)) {
      return input.map((v: any) => String(v || '').trim()).filter((v: any) => v.length > 0);
    }
    if (typeof input === 'string') {
      return input
        .split(',')
        .map((v: any) => String(v || '').trim())
        .filter((v: any) => v.length > 0);
    }
    return [];
  }
  private parseDateValue(value: unknown, fieldName: string, strict = false): Date | undefined {
    if (value === undefined || value === null || String(value).trim() === '') return undefined;
    const textValue = String(value).trim();
    const date = new Date(textValue);
    if (Number.isNaN(date.getTime())) {
      if (strict) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
      }
      return undefined;
    }
    return new Date(date.toISOString().slice(0, 10));
  }

  private normalizeLegalStatus(value: unknown): string | undefined {
    const v = String(value || '').trim().toUpperCase();
    if (!v) return undefined;
    const allowed = ['PENDING', 'GRANTED', 'EXPIRED', 'INVALIDATED', 'UNKNOWN'];
    return allowed.includes(v) ? v : undefined;
  }

  private getPatentTypeMeta(patentType?: string | null) {
    const key = String(patentType || '').toUpperCase();
    if (!key) return null;
    const meta: Record<string, { definition: string; termYears: number; source: string }> = {
      INVENTION: {
        definition: 'New technical solutions relating to a product, process, or its improvement.',
        termYears: 20,
        source: 'Patent Law of the PRC (Article 2/42)',
      },
      UTILITY_MODEL: {
        definition: "New technical solutions relating to a product's shape, structure, or their combination, suitable for practical use.",
        termYears: 10,
        source: 'Patent Law of the PRC (Article 2/42)',
      },
      DESIGN: {
        definition: "New designs of a product's shape, pattern, or their combination, or the combination with color, with aesthetic appeal and suitable for industrial application.",
        termYears: 15,
        source: 'Patent Law of the PRC (Article 2/42)',
      },
    };
    return meta[key] ?? null;
  }


  private async syncPatentParties(patentId: string, role: 'INVENTOR' | 'ASSIGNEE' | 'APPLICANT', names?: unknown) {
    if (names === undefined) return;
    const normalized = Array.from(new Set(this.normalizeStringArray(names)));
    await this.prisma.patentParty.deleteMany({ where: { patentId, role } });
    if (normalized.length === 0) return;
    await this.prisma.patentParty.createMany({
      data: normalized.map((name: any) => ({ patentId, role, name })),
    });
  }

  private async syncPatentClassifications(patentId: string, system: 'IPC' | 'LOC', codes?: unknown) {
    if (codes === undefined) return;
    const normalized = Array.from(
      new Set(
        this.normalizeStringArray(codes)
          .map((c: any) => c.toUpperCase())
          .filter((c: any) => c.length > 0),
      ),
    );
    await this.prisma.patentClassification.deleteMany({ where: { patentId, system } });
    if (normalized.length === 0) return;
    await this.prisma.patentClassification.createMany({
      data: normalized.map((code: string, idx: number) => ({ patentId, system, code, isMain: idx === 0 })),
    });
  }

  private async ensurePatent(body: any) {
    const patentNumberRaw = String(body?.patentNumberRaw || '').trim();
    if (!patentNumberRaw) return null;
    const parsed = this.parsePatentNumber(patentNumberRaw);
    const requestedPatentType = String(body?.patentType || '').toUpperCase();
    const patentType =
      parsed.patentType ??
      (['INVENTION', 'UTILITY_MODEL', 'DESIGN'].includes(requestedPatentType)
        ? (requestedPatentType as 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN')
        : undefined);
    if (!patentType) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'patentType is required' });
    }

    const legalStatus = this.normalizeLegalStatus(body?.legalStatus);
    const legalStatusRawInput = body?.legalStatusRaw ?? body?.legalStatus;
    const legalStatusRaw = legalStatusRawInput !== undefined && legalStatusRawInput !== null && String(legalStatusRawInput).trim() !== '' ? String(legalStatusRawInput) : undefined;
    const filingDate = this.parseDateValue(body?.filingDate, 'filingDate', true);
    const publicationDate = this.parseDateValue(body?.publicationDate, 'publicationDate', true);
    const grantDate = this.parseDateValue(body?.grantDate, 'grantDate', true);

    let transferCount: number | undefined;
    if (body?.transferCount !== undefined && body?.transferCount !== null && String(body?.transferCount).trim() !== '') {
      const num = Number(body?.transferCount);
      if (!Number.isFinite(num) || num < 0) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'transferCount is invalid' });
      }
      transferCount = Math.floor(num);
    }

    const sourcePrimary = this.normalizePatentSource(body?.sourcePrimary ?? body?.source);
    const applicationNoNorm = parsed.applicationNoNorm;
    let patent = await this.prisma.patent.findFirst({ where: { applicationNoNorm } });

    if (!patent && parsed.identifierCandidates.length > 0) {
      for (const candidate of parsed.identifierCandidates) {
        const identifier = await this.prisma.patentIdentifier.findUnique({
          where: { idType_idValueNorm: { idType: candidate.idType, idValueNorm: candidate.idValueNorm } },
        });
        if (identifier) {
          patent = await this.prisma.patent.findUnique({ where: { id: identifier.patentId } });
          break;
        }
      }
    }

    const applicationNoDisplay = parsed.primaryIdType === 'APPLICATION' ? parsed.applicationNoDisplay : undefined;

    if (!patent) {
      patent = await this.prisma.patent.create({
        data: {
          jurisdiction: 'CN',
          applicationNoNorm,
          applicationNoDisplay: applicationNoDisplay || null,
          publicationNoDisplay: parsed.publicationNoDisplay ?? null,
          patentNoDisplay: parsed.patentNoDisplay ?? null,
          grantPublicationNoDisplay: parsed.grantPublicationNoDisplay ?? null,
          patentType,
          title: body?.title || 'Patent',
          abstract: body?.summary || null,
          legalStatus: legalStatus ?? null,
          legalStatusRaw: legalStatusRaw ?? null,
          filingDate: filingDate ?? null,
          publicationDate: publicationDate ?? null,
          grantDate: grantDate ?? null,
          transferCount: transferCount ?? undefined,
          sourcePrimary: sourcePrimary ?? 'USER',
          sourceUpdatedAt: new Date(),
        },
      });
    } else {
      const patch: any = {};
      if (applicationNoDisplay && patent.applicationNoDisplay !== applicationNoDisplay) patch.applicationNoDisplay = applicationNoDisplay;
      if (parsed.publicationNoDisplay && patent.publicationNoDisplay !== parsed.publicationNoDisplay)
        patch.publicationNoDisplay = parsed.publicationNoDisplay;
      if (parsed.patentNoDisplay && patent.patentNoDisplay !== parsed.patentNoDisplay) patch.patentNoDisplay = parsed.patentNoDisplay;
      if (parsed.grantPublicationNoDisplay && patent.grantPublicationNoDisplay !== parsed.grantPublicationNoDisplay)
        patch.grantPublicationNoDisplay = parsed.grantPublicationNoDisplay;
      if (legalStatus && patent.legalStatus !== legalStatus) patch.legalStatus = legalStatus;
      if (legalStatusRaw && patent.legalStatusRaw !== legalStatusRaw) patch.legalStatusRaw = legalStatusRaw;
      if (filingDate) patch.filingDate = filingDate;
      if (publicationDate) patch.publicationDate = publicationDate;
      if (grantDate) patch.grantDate = grantDate;
      if (transferCount !== undefined) patch.transferCount = transferCount;
      if (sourcePrimary && patent.sourcePrimary !== sourcePrimary) patch.sourcePrimary = sourcePrimary;
      if (Object.keys(patch).length > 0) {
        patch.sourceUpdatedAt = new Date();
        patent = await this.prisma.patent.update({ where: { id: patent.id }, data: patch });
      }
    }

    if (parsed.identifierCandidates.length > 0) {
      await this.prisma.patentIdentifier.createMany({
        data: parsed.identifierCandidates.map((c: any) => ({
          patentId: patent!.id,
          idType: c.idType,
          idValueNorm: c.idValueNorm,
          kindCode: c.kindCode,
        })),
        skipDuplicates: true,
      });
    }

    return patent;
  }

  private async updatePatentCore(patentId: string, body: any) {
    if (!patentId || !body) return;
    const legalStatus = this.normalizeLegalStatus(body?.legalStatus);
    const legalStatusRawInput = body?.legalStatusRaw ?? body?.legalStatus;
    const legalStatusRaw = legalStatusRawInput !== undefined && legalStatusRawInput !== null && String(legalStatusRawInput).trim() !== '' ? String(legalStatusRawInput) : undefined;
    const filingDate = this.parseDateValue(body?.filingDate, 'filingDate', true);
    const publicationDate = this.parseDateValue(body?.publicationDate, 'publicationDate', true);
    const grantDate = this.parseDateValue(body?.grantDate, 'grantDate', true);

    let transferCount: number | undefined;
    if (body?.transferCount !== undefined && body?.transferCount !== null && String(body?.transferCount).trim() !== '') {
      const num = Number(body?.transferCount);
      if (!Number.isFinite(num) || num < 0) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'transferCount is invalid' });
      }
      transferCount = Math.floor(num);
    }
    const sourcePrimary = this.normalizePatentSource(body?.sourcePrimary ?? body?.source);

    const data: any = {};
    if (legalStatus) data.legalStatus = legalStatus;
    if (legalStatusRaw) data.legalStatusRaw = legalStatusRaw;
    if (filingDate) data.filingDate = filingDate;
    if (publicationDate) data.publicationDate = publicationDate;
    if (grantDate) data.grantDate = grantDate;
    if (transferCount !== undefined) data.transferCount = transferCount;
    if (sourcePrimary) data.sourcePrimary = sourcePrimary;
    if (Object.keys(data).length === 0) return;
    data.sourceUpdatedAt = new Date();
    await this.prisma.patent.update({ where: { id: patentId }, data });
  }

  private extractPatentMeta(patent: any) {
    const parties = patent?.parties ?? [];
    const classifications = patent?.classifications ?? [];
    const inventorNames = parties.filter((p: any) => p.role === 'INVENTOR').map((p: any) => p.name);
    const assigneeNames = parties.filter((p: any) => p.role === 'ASSIGNEE').map((p: any) => p.name);
    const applicantNames = parties.filter((p: any) => p.role === 'APPLICANT').map((p: any) => p.name);
    const ipcCodes = classifications.filter((c: any) => c.system === 'IPC').map((c: any) => c.code);
    const locCodes = classifications.filter((c: any) => c.system === 'LOC').map((c: any) => c.code);
    const toDate = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
    const legalStatus = patent?.legalStatus ? String(patent.legalStatus).toUpperCase() : null;
    const patentTypeMeta = this.getPatentTypeMeta(patent?.patentType);
    return {
      applicationNoDisplay: patent?.applicationNoDisplay ?? null,
      publicationNoDisplay: patent?.publicationNoDisplay ?? null,
      patentNoDisplay: patent?.patentNoDisplay ?? null,
      grantPublicationNoDisplay: patent?.grantPublicationNoDisplay ?? null,
      patentType: patent?.patentType ?? null,
      patentTypeDefinition: patentTypeMeta?.definition ?? null,
      patentTypeDefinitionSource: patentTypeMeta?.source ?? null,
      patentTermYears: patentTypeMeta?.termYears ?? null,
      transferCount: patent?.transferCount ?? 0,
      inventorNames: inventorNames.length ? inventorNames : null,
      assigneeNames: assigneeNames.length ? assigneeNames : null,
      applicantNames: applicantNames.length ? applicantNames : null,
      filingDate: toDate(patent?.filingDate),
      publicationDate: toDate(patent?.publicationDate),
      grantDate: toDate(patent?.grantDate),
      legalStatus,
      ipcCodes: ipcCodes.length ? ipcCodes : null,
      locCodes: locCodes.length ? locCodes : null,
    };
  }

  private toListingSummary(it: any) {
    const meta = this.extractPatentMeta(it.patent);
    return {
      id: it.id,
      source: it.source ?? 'USER',
      patentId: it.patentId,
      applicationNoDisplay: meta.applicationNoDisplay,
      publicationNoDisplay: meta.publicationNoDisplay,
      patentNoDisplay: meta.patentNoDisplay,
      grantPublicationNoDisplay: meta.grantPublicationNoDisplay,
      patentType: meta.patentType,
      patentTypeDefinition: meta.patentTypeDefinition,
      patentTypeDefinitionSource: meta.patentTypeDefinitionSource,
      patentTermYears: meta.patentTermYears,
      transferCount: meta.transferCount,
      recommendationScore: null,
      title: it.title,
      inventorNames: meta.inventorNames,
      assigneeNames: meta.assigneeNames,
      applicantNames: meta.applicantNames,
      filingDate: meta.filingDate,
      publicationDate: meta.publicationDate,
      grantDate: meta.grantDate,
      legalStatus: meta.legalStatus,
      tradeMode: it.tradeMode,
      licenseMode: it.licenseMode ?? null,
      priceType: it.priceType,
      priceAmountFen: it.priceAmount ?? null,
      depositAmountFen: it.depositAmount,
      regionCode: it.regionCode ?? null,
      industryTags: it.industryTagsJson ?? null,
      listingTopics: it.listingTopicsJson ?? null,
      clusterId: it.clusterId ?? null,
      ipcCodes: meta.ipcCodes,
      locCodes: meta.locCodes,
      featuredLevel: it.featuredLevel,
      featuredRegionCode: it.featuredRegionCode ?? null,
      auditStatus: it.auditStatus,
      status: it.status,
      coverUrl: null,
      createdAt: it.createdAt.toISOString(),
      updatedAt: it.updatedAt.toISOString(),
      stats: it.stats ?? null,
    };
  }
  async listAdmin(query: any): Promise<PagedListingAdmin> {
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 10)));
    const q = String(query?.q || '').trim();
    const regionCode = String(query?.regionCode || '').trim();
    const auditStatus = String(query?.auditStatus || '').trim().toUpperCase();
    const status = String(query?.status || '').trim().toUpperCase();
    const source = this.normalizeContentSource(query?.source);

    const where: any = {};
    if (q) {
      where.OR = [{ title: { contains: q, mode: 'insensitive' } }];
    }
    if (regionCode) where.regionCode = regionCode;
    if (auditStatus) where.auditStatus = auditStatus;
    if (status) where.status = status;
    if (source) where.source = source;

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
      items: items.map((it: any) => this.toAdminDto(it)),
      page: { page, pageSize, total },
    };
  }

  async getAdminById(listingId: string): Promise<ListingAdminDto> {
    const it = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!it) throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
    return this.toAdminDto(it);
  }


  async adminCreate(req: any, body: any) {
    this.ensureAdmin(req);
    const source = this.normalizeContentSource(body?.source) ?? 'ADMIN';
    const sellerUserId = String(body?.sellerUserId || req?.auth?.userId || '').trim();
    if (!sellerUserId) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'sellerUserId is required' });
    }
    const patent = await this.ensurePatent({ ...(body || {}), sourcePrimary: this.normalizePatentSource(body?.sourcePrimary ?? body?.source) });
    if (patent) {
      await Promise.all([
        this.syncPatentParties(patent.id, 'INVENTOR', body?.inventorNames),
        this.syncPatentParties(patent.id, 'ASSIGNEE', body?.assigneeNames),
        this.syncPatentParties(patent.id, 'APPLICANT', body?.applicantNames),
        this.syncPatentClassifications(patent.id, 'IPC', body?.ipcCodes),
        this.syncPatentClassifications(patent.id, 'LOC', body?.locCodes),
      ]);
    }
    const depositAmountFen = Number(body?.depositAmountFen || 0);
    const listingTopics = this.normalizeStringArray(body?.listingTopics ?? body?.listingTopic)
      .map((v: any) => String(v || '').trim().toUpperCase())
      .filter((v: any) => v.length > 0);
    const proofFileIds = this.normalizeFileIds(body?.proofFileIds);
    const auditStatus = this.normalizeAuditStatus(body?.auditStatus) ?? 'PENDING';
    const status = this.normalizeListingStatus(body?.status) ?? 'DRAFT';
    const listing = await this.prisma.listing.create({
      data: {
        sellerUserId,
        source,
        patentId: patent?.id ?? null,
        title: body?.title || patent?.title || 'Listing',
        summary: body?.summary || null,
        tradeMode: body?.tradeMode || 'ASSIGNMENT',
        licenseMode: body?.licenseMode || null,
        priceType: body?.priceType || 'NEGOTIABLE',
        priceAmount: body?.priceAmountFen ?? null,
        depositAmount: depositAmountFen,
        regionCode: body?.regionCode || null,
        industryTagsJson: body?.industryTags || null,
        listingTopicsJson: listingTopics.length > 0 ? listingTopics : null,
        proofFileIdsJson: proofFileIds.length > 0 ? proofFileIds : null,
        clusterId: body?.clusterId || null,
        auditStatus,
        status,
      },
    });
    return this.toAdminDto(listing);
  }

  async adminUpdate(req: any, listingId: string, body: any) {
    this.ensureAdmin(req);
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
    }
    let patentId = listing.patentId;
    if (body?.patentNumberRaw) {
      const patent = await this.ensurePatent({ ...(body || {}), sourcePrimary: this.normalizePatentSource(body?.sourcePrimary ?? body?.source) });
      if (patent) patentId = patent.id;
    }
    const hasListingTopics = body?.listingTopics !== undefined || body?.listingTopic !== undefined;
    const listingTopics = hasListingTopics
      ? this.normalizeStringArray(body?.listingTopics ?? body?.listingTopic)
          .map((v: any) => String(v || '').trim().toUpperCase())
          .filter((v: any) => v.length > 0)
      : undefined;
    const hasProofFileIds = body?.proofFileIds !== undefined;
    const proofFileIds = hasProofFileIds ? this.normalizeFileIds(body?.proofFileIds) : undefined;
    const hasClusterId = Object.prototype.hasOwnProperty.call(body || {}, 'clusterId');
    const source = this.normalizeContentSource(body?.source);
    const auditStatus = this.normalizeAuditStatus(body?.auditStatus);
    const status = this.normalizeListingStatus(body?.status);
    const sellerUserId = body?.sellerUserId ? String(body.sellerUserId) : listing.sellerUserId;
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        sellerUserId,
        source: source ?? listing.source,
        patentId: patentId ?? null,
        title: body?.title ?? listing.title,
        summary: body?.summary ?? listing.summary,
        tradeMode: body?.tradeMode ?? listing.tradeMode,
        licenseMode: body?.licenseMode ?? listing.licenseMode,
        priceType: body?.priceType ?? listing.priceType,
        priceAmount: body?.priceAmountFen ?? listing.priceAmount,
        depositAmount: body?.depositAmountFen ?? listing.depositAmount,
        regionCode: body?.regionCode ?? listing.regionCode,
        industryTagsJson: body?.industryTags ?? listing.industryTagsJson,
        listingTopicsJson: hasListingTopics ? (listingTopics && listingTopics.length > 0 ? listingTopics : null) : listing.listingTopicsJson,
        proofFileIdsJson: hasProofFileIds ? (proofFileIds && proofFileIds.length > 0 ? proofFileIds : null) : listing.proofFileIdsJson,
        clusterId: hasClusterId ? body?.clusterId : listing.clusterId,
        auditStatus: auditStatus ?? listing.auditStatus,
        status: status ?? listing.status,
      },
    });
    if (patentId) {
      await this.updatePatentCore(patentId, body);
      await Promise.all([
        this.syncPatentParties(patentId, 'INVENTOR', body?.inventorNames),
        this.syncPatentParties(patentId, 'ASSIGNEE', body?.assigneeNames),
        this.syncPatentParties(patentId, 'APPLICANT', body?.applicantNames),
        this.syncPatentClassifications(patentId, 'IPC', body?.ipcCodes),
        this.syncPatentClassifications(patentId, 'LOC', body?.locCodes),
      ]);
    }
    return this.toAdminDto(updated);
  }

  async adminPublish(req: any, listingId: string) {
    this.ensureAdmin(req);
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
    }
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: 'ACTIVE', auditStatus: 'APPROVED' },
    });
    return this.toAdminDto(updated);
  }

  async adminOffShelf(req: any, listingId: string) {
    this.ensureAdmin(req);
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
    }
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: 'OFF_SHELF' },
    });
    return this.toAdminDto(updated);
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
    addAuditLog('LISTING', listingId, 'APPROVE', reason, reviewerId || undefined);
    if (reviewerId) {
      await this.audit.log({
        actorUserId: reviewerId,
        action: 'LISTING_APPROVE',
        targetType: 'LISTING',
        targetId: listingId,
        afterJson: { auditStatus: 'APPROVED', reason },
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
    addAuditLog('LISTING', listingId, 'REJECT', reason, reviewerId || undefined);
    if (reviewerId) {
      await this.audit.log({
        actorUserId: reviewerId,
        action: 'LISTING_REJECT',
        targetType: 'LISTING',
        targetId: listingId,
        afterJson: { auditStatus: 'REJECTED', reason },
      });
    }
    return this.toAdminDto(it);
  }

  async updateFeatured(listingId: string, payload: any, operatorId?: string | null) {
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
    if (operatorId) {
      await this.audit.log({
        actorUserId: operatorId,
      action: 'LISTING_FEATURED_UPDATE',
      targetType: 'LISTING',
      targetId: listingId,
      afterJson: data,
      });
    }
    return this.toAdminDto(it);
  }

  async listMine(req: any, query: any) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const items = await this.prisma.listing.findMany({
      where: { sellerUserId: req.auth.userId },
      include: { patent: { include: { parties: true, classifications: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const total = await this.prisma.listing.count({ where: { sellerUserId: req.auth.userId } });
    return {
      items: items.map((it: any) => {
        const meta = this.extractPatentMeta(it.patent);
        return {
          id: it.id,
          source: it.source ?? 'USER',
          title: it.title,
          tradeMode: it.tradeMode,
          priceType: it.priceType,
          priceAmountFen: it.priceAmount ?? null,
          depositAmountFen: it.depositAmount,
          status: it.status,
          auditStatus: it.auditStatus,
          applicationNoDisplay: meta.applicationNoDisplay,
          publicationNoDisplay: meta.publicationNoDisplay,
          patentNoDisplay: meta.patentNoDisplay,
          grantPublicationNoDisplay: meta.grantPublicationNoDisplay,
          patentType: meta.patentType,
          patentTypeDefinition: meta.patentTypeDefinition,
          patentTypeDefinitionSource: meta.patentTypeDefinitionSource,
          patentTermYears: meta.patentTermYears,
          transferCount: meta.transferCount,
          inventorNames: meta.inventorNames,
          assigneeNames: meta.assigneeNames,
          applicantNames: meta.applicantNames,
          filingDate: meta.filingDate,
          publicationDate: meta.publicationDate,
          grantDate: meta.grantDate,
          legalStatus: meta.legalStatus,
          ipcCodes: meta.ipcCodes,
          locCodes: meta.locCodes,
          regionCode: it.regionCode ?? null,
          listingTopics: it.listingTopicsJson ?? null,
          proofFileIds: it.proofFileIdsJson ?? null,
          clusterId: it.clusterId ?? null,
          createdAt: it.createdAt.toISOString(),
          updatedAt: it.updatedAt.toISOString(),
        };
      }),
      page: { page, pageSize, total },
    };
  }

  async getMine(req: any, listingId: string) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
    const it = await this.prisma.listing.findUnique({ where: { id: listingId }, include: { patent: { include: { parties: true, classifications: true } } } });
    if (!it || it.sellerUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
    }
    const meta = this.extractPatentMeta(it.patent);
    return {
      id: it.id,
      source: it.source ?? 'USER',
      title: it.title,
      tradeMode: it.tradeMode,
      licenseMode: it.licenseMode,
      priceType: it.priceType,
      priceAmountFen: it.priceAmount ?? null,
      depositAmountFen: it.depositAmount,
      status: it.status,
      auditStatus: it.auditStatus,
      applicationNoDisplay: meta.applicationNoDisplay,
      publicationNoDisplay: meta.publicationNoDisplay,
      patentNoDisplay: meta.patentNoDisplay,
      grantPublicationNoDisplay: meta.grantPublicationNoDisplay,
      patentType: meta.patentType,
      patentTypeDefinition: meta.patentTypeDefinition,
      patentTypeDefinitionSource: meta.patentTypeDefinitionSource,
      patentTermYears: meta.patentTermYears,
      transferCount: meta.transferCount,
      inventorNames: meta.inventorNames,
      assigneeNames: meta.assigneeNames,
      applicantNames: meta.applicantNames,
      filingDate: meta.filingDate,
      publicationDate: meta.publicationDate,
      grantDate: meta.grantDate,
      legalStatus: meta.legalStatus,
      ipcCodes: meta.ipcCodes,
      locCodes: meta.locCodes,
      regionCode: it.regionCode ?? null,
      listingTopics: it.listingTopicsJson ?? null,
      clusterId: it.clusterId ?? null,
      proofFileIds: it.proofFileIdsJson ?? null,
      summary: it.summary ?? null,
      createdAt: it.createdAt.toISOString(),
      updatedAt: it.updatedAt.toISOString(),
    };
  }

  async createListing(req: any, body: any) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
    const patent = await this.ensurePatent(body);
    if (patent) {
      await Promise.all([
        this.syncPatentParties(patent.id, 'INVENTOR', body?.inventorNames),
        this.syncPatentParties(patent.id, 'ASSIGNEE', body?.assigneeNames),
        this.syncPatentParties(patent.id, 'APPLICANT', body?.applicantNames),
        this.syncPatentClassifications(patent.id, 'IPC', body?.ipcCodes),
        this.syncPatentClassifications(patent.id, 'LOC', body?.locCodes),
      ]);
    }
    const depositAmountFen = Number(body?.depositAmountFen || 0);
    const listingTopics = this.normalizeStringArray(body?.listingTopics ?? body?.listingTopic)
      .map((v: any) => String(v || '').trim().toUpperCase())
      .filter((v: any) => v.length > 0);
    const proofFileIds = this.normalizeFileIds(body?.proofFileIds);
    const listing = await this.prisma.listing.create({
      data: {
        sellerUserId: req.auth.userId,
        source: 'USER',
        patentId: patent?.id ?? null,
        title: body?.title || patent?.title || 'Listing',
        summary: body?.summary || null,
        tradeMode: body?.tradeMode || 'ASSIGNMENT',
        licenseMode: body?.licenseMode || null,
        priceType: body?.priceType || 'NEGOTIABLE',
        priceAmount: body?.priceAmountFen ?? null,
        depositAmount: depositAmountFen,
        regionCode: body?.regionCode || null,
        industryTagsJson: body?.industryTags || null,
        listingTopicsJson: listingTopics.length > 0 ? listingTopics : null,
        proofFileIdsJson: proofFileIds.length > 0 ? proofFileIds : null,
        clusterId: body?.clusterId || null,
      },
    });
    return this.toAdminDto(listing);
  }

  async updateListing(req: any, listingId: string, body: any) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.sellerUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
    }
    let patentId = listing.patentId;
    if (body?.patentNumberRaw) {
      const patent = await this.ensurePatent(body);
      if (patent) patentId = patent.id;
    }
    const hasListingTopics = body?.listingTopics !== undefined || body?.listingTopic !== undefined;
    const listingTopics = hasListingTopics
      ? this.normalizeStringArray(body?.listingTopics ?? body?.listingTopic)
          .map((v: any) => String(v || '').trim().toUpperCase())
          .filter((v: any) => v.length > 0)
      : undefined;
    const hasProofFileIds = body?.proofFileIds !== undefined;
    const proofFileIds = hasProofFileIds ? this.normalizeFileIds(body?.proofFileIds) : undefined;
    const hasClusterId = Object.prototype.hasOwnProperty.call(body || {}, 'clusterId');
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        patentId: patentId ?? null,
        title: body?.title ?? listing.title,
        summary: body?.summary ?? listing.summary,
        tradeMode: body?.tradeMode ?? listing.tradeMode,
        licenseMode: body?.licenseMode ?? listing.licenseMode,
        priceType: body?.priceType ?? listing.priceType,
        priceAmount: body?.priceAmountFen ?? listing.priceAmount,
        depositAmount: body?.depositAmountFen ?? listing.depositAmount,
        regionCode: body?.regionCode ?? listing.regionCode,
        industryTagsJson: body?.industryTags ?? listing.industryTagsJson,
        listingTopicsJson: hasListingTopics ? (listingTopics && listingTopics.length > 0 ? listingTopics : null) : listing.listingTopicsJson,
        proofFileIdsJson: hasProofFileIds ? (proofFileIds && proofFileIds.length > 0 ? proofFileIds : null) : listing.proofFileIdsJson,
        clusterId: hasClusterId ? body?.clusterId : listing.clusterId,
      },
    });
    if (patentId) {
      await this.updatePatentCore(patentId, body);
      await Promise.all([
        this.syncPatentParties(patentId, 'INVENTOR', body?.inventorNames),
        this.syncPatentParties(patentId, 'ASSIGNEE', body?.assigneeNames),
        this.syncPatentParties(patentId, 'APPLICANT', body?.applicantNames),
        this.syncPatentClassifications(patentId, 'IPC', body?.ipcCodes),
        this.syncPatentClassifications(patentId, 'LOC', body?.locCodes),
      ]);
    }
    return this.toAdminDto(updated);
  }

  async submitListing(req: any, listingId: string) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.sellerUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
    }
    const proofFileIds = this.normalizeFileIds((listing as any).proofFileIdsJson);
    await this.assertOwnedFiles(req.auth.userId, proofFileIds, 'proofFileIds');
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { auditStatus: 'PENDING', status: 'ACTIVE' },
    });
    return this.toAdminDto(updated);
  }

  async offShelf(req: any, listingId: string) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.sellerUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
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
    const qTypeRaw = String(query?.qType || 'AUTO').trim().toUpperCase();
    const qType = ['AUTO', 'NUMBER', 'KEYWORD', 'APPLICANT', 'INVENTOR'].includes(qTypeRaw) ? qTypeRaw : 'AUTO';
    const patentType = String(query?.patentType || '').trim().toUpperCase();
    const inventor = String(query?.inventor || '').trim();
    const applicant = String(query?.applicant || query?.applicantName || '').trim();
    const assignee = String(query?.assignee || query?.assigneeName || '').trim();
    const sellerUserId = String(query?.sellerUserId || '').trim();
    const tradeMode = String(query?.tradeMode || '').trim().toUpperCase();
    const licenseMode = String(query?.licenseMode || '').trim().toUpperCase();
    const priceType = String(query?.priceType || '').trim().toUpperCase();
    const regionCode = String(query?.regionCode || '').trim();
    const legalStatus = String(query?.legalStatus || '').trim().toUpperCase();
    const sortBy = String(query?.sortBy || 'NEWEST').trim().toUpperCase();
    const clusterId = String(query?.clusterId || '').trim();
    const listingTopics = this.normalizeStringArray(query?.listingTopics ?? query?.listingTopic)
      .map((v: any) => String(v || '').trim().toUpperCase())
      .filter((v: any) => v.length > 0);
    const ipcList = this.normalizeStringArray(query?.ipc)
      .map((v: any) => String(v || '').trim().toUpperCase())
      .filter((v: any) => v.length > 0);
    const locList = this.normalizeStringArray(query?.loc ?? query?.locarno)
      .map((v: any) => String(v || '').trim().toUpperCase())
      .filter((v: any) => v.length > 0);

    const parseNumber = (value: any) => {
      if (value === undefined || value === null || String(value).trim() === '') return undefined;
      const num = Number(value);
      return Number.isFinite(num) ? num : undefined;
    };

    const priceMin = parseNumber(query?.priceMin ?? query?.priceMinFen);
    const priceMax = parseNumber(query?.priceMax ?? query?.priceMaxFen);
    const depositMin = parseNumber(query?.depositMin ?? query?.depositMinFen);
    const depositMax = parseNumber(query?.depositMax ?? query?.depositMaxFen);
    const transferCountMin = parseNumber(query?.transferCountMin);
    const transferCountMax = parseNumber(query?.transferCountMax);

    const createdFrom = this.parseDateValue(query?.createdFrom, 'createdFrom', true);
    const createdTo = this.parseDateValue(query?.createdTo, 'createdTo', true);
    const filingDateFrom = this.parseDateValue(query?.filingDateFrom, 'filingDateFrom', true);
    const filingDateTo = this.parseDateValue(query?.filingDateTo, 'filingDateTo', true);
    const publicationDateFrom = this.parseDateValue(query?.publicationDateFrom, 'publicationDateFrom', true);
    const publicationDateTo = this.parseDateValue(query?.publicationDateTo, 'publicationDateTo', true);
    const grantDateFrom = this.parseDateValue(query?.grantDateFrom, 'grantDateFrom', true);
    const grantDateTo = this.parseDateValue(query?.grantDateTo, 'grantDateTo', true);

    const industryTags = this.normalizeStringArray(query?.industryTags);

    const where: any = { auditStatus: 'APPROVED', status: 'ACTIVE' };
    if (regionCode) where.regionCode = regionCode;
    if (tradeMode) where.tradeMode = tradeMode;
    if (licenseMode) where.licenseMode = licenseMode;
    if (priceType) where.priceType = priceType;
    if (sellerUserId) where.sellerUserId = sellerUserId;
    if (clusterId) where.clusterId = clusterId;
    if (listingTopics.length > 0) {
      where.listingTopicsJson = { array_contains: listingTopics };
    }
    if (industryTags.length > 0) {
      where.industryTagsJson = { array_contains: industryTags };
    }
    if (createdFrom || createdTo) {
      const range: any = {};
      if (createdFrom) range.gte = createdFrom;
      if (createdTo) range.lte = createdTo;
      where.createdAt = range;
    }

    const priceWhere: any = {};
    if (priceMin !== undefined) priceWhere.gte = priceMin;
    if (priceMax !== undefined) priceWhere.lte = priceMax;
    if (Object.keys(priceWhere).length > 0) where.priceAmount = priceWhere;

    const depositWhere: any = {};
    if (depositMin !== undefined) depositWhere.gte = depositMin;
    if (depositMax !== undefined) depositWhere.lte = depositMax;
    if (Object.keys(depositWhere).length > 0) where.depositAmount = depositWhere;

    const patentAnd: any[] = [];
    if (patentType) patentAnd.push({ patentType });
    if (legalStatus) patentAnd.push({ legalStatus });
    if (inventor) {
      patentAnd.push({
        parties: {
          some: { role: 'INVENTOR', name: { contains: inventor, mode: 'insensitive' } },
        },
      });
    }
    if (applicant) {
      patentAnd.push({
        parties: {
          some: { role: 'APPLICANT', name: { contains: applicant, mode: 'insensitive' } },
        },
      });
    }
    if (assignee) {
      patentAnd.push({
        parties: {
          some: { role: 'ASSIGNEE', name: { contains: assignee, mode: 'insensitive' } },
        },
      });
    }
    if (ipcList.length > 0) {
      patentAnd.push({
        OR: ipcList.map((code: any) => ({ classifications: { some: { system: 'IPC', code: { startsWith: code } } } })),
      });
    }
    if (locList.length > 0) {
      patentAnd.push({
        OR: locList.map((code: any) => ({ classifications: { some: { system: 'LOC', code: { startsWith: code } } } })),
      });
    }
    if (filingDateFrom || filingDateTo) {
      const range: any = {};
      if (filingDateFrom) range.gte = filingDateFrom;
      if (filingDateTo) range.lte = filingDateTo;
      patentAnd.push({ filingDate: range });
    }
    if (publicationDateFrom || publicationDateTo) {
      const range: any = {};
      if (publicationDateFrom) range.gte = publicationDateFrom;
      if (publicationDateTo) range.lte = publicationDateTo;
      patentAnd.push({ publicationDate: range });
    }
    if (grantDateFrom || grantDateTo) {
      const range: any = {};
      if (grantDateFrom) range.gte = grantDateFrom;
      if (grantDateTo) range.lte = grantDateTo;
      patentAnd.push({ grantDate: range });
    }
    if (transferCountMin !== undefined || transferCountMax !== undefined) {
      const range: any = {};
      if (transferCountMin !== undefined) range.gte = transferCountMin;
      if (transferCountMax !== undefined) range.lte = transferCountMax;
      patentAnd.push({ transferCount: range });
    }
    if (patentAnd.length > 0) {
      where.patent = { AND: patentAnd };
    }

    if (q) {
      const orFilters: any[] = [];
      if (qType == 'NUMBER') {
        try {
          const parsed = this.parsePatentNumber(q);
          orFilters.push({ patent: { applicationNoNorm: parsed.applicationNoNorm } });
          for (const c of parsed.identifierCandidates) {
            orFilters.push({ patent: { identifiers: { some: { idType: c.idType, idValueNorm: c.idValueNorm } } } });
          }
        } catch {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'invalid patent number format' });
        }
      } else if (qType == 'APPLICANT') {
        orFilters.push({ patent: { parties: { some: { role: 'APPLICANT', name: { contains: q, mode: 'insensitive' } } } } });
      } else if (qType == 'INVENTOR') {
        orFilters.push({ patent: { parties: { some: { role: 'INVENTOR', name: { contains: q, mode: 'insensitive' } } } } });
      } else if (qType == 'KEYWORD') {
        orFilters.push({ title: { contains: q, mode: 'insensitive' } });
        orFilters.push({ summary: { contains: q, mode: 'insensitive' } });
        orFilters.push({ patent: { title: { contains: q, mode: 'insensitive' } } });
        orFilters.push({ patent: { abstract: { contains: q, mode: 'insensitive' } } });
      } else {
        orFilters.push({ title: { contains: q, mode: 'insensitive' } });
        orFilters.push({ summary: { contains: q, mode: 'insensitive' } });
        orFilters.push({ patent: { title: { contains: q, mode: 'insensitive' } } });
        orFilters.push({ patent: { abstract: { contains: q, mode: 'insensitive' } } });
        orFilters.push({ patent: { parties: { some: { name: { contains: q, mode: 'insensitive' } } } } });
        try {
          const parsed = this.parsePatentNumber(q);
          orFilters.push({ patent: { applicationNoNorm: parsed.applicationNoNorm } });
          for (const c of parsed.identifierCandidates) {
            orFilters.push({ patent: { identifiers: { some: { idType: c.idType, idValueNorm: c.idValueNorm } } } });
          }
        } catch {
          // ignore parse errors for non-number keywords
        }
      }
      where.OR = orFilters;
    }

    const orderBy: any[] = [];
    if (sortBy == 'PRICE_ASC') {
      orderBy.push({ priceAmount: 'asc' });
    } else if (sortBy == 'PRICE_DESC') {
      orderBy.push({ priceAmount: 'desc' });
    } else if (sortBy == 'RECOMMENDED') {
      orderBy.push({ featuredLevel: 'desc' }, { featuredRank: 'asc' }, { createdAt: 'desc' });
    } else {
      orderBy.push({ createdAt: 'desc' });
    }

    const include = { patent: { include: { parties: true, classifications: true } }, stats: true };

    const [items, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        include,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      items: items.map((it: any) => this.toListingSummary(it)),
      page: { page, pageSize, total },
    };
  }
  async getPublicById(listingId: string) {
    const it = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { patent: { include: { parties: true, classifications: true } }, seller: true, stats: true },
    });
    if (!it) throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
    const meta = this.extractPatentMeta(it.patent);
    return {
      id: it.id,
      source: it.source ?? 'USER',
      patentId: it.patentId,
      applicationNoDisplay: meta.applicationNoDisplay,
      publicationNoDisplay: meta.publicationNoDisplay,
      patentNoDisplay: meta.patentNoDisplay,
      grantPublicationNoDisplay: meta.grantPublicationNoDisplay,
      patentType: meta.patentType,
      patentTypeDefinition: meta.patentTypeDefinition,
      patentTypeDefinitionSource: meta.patentTypeDefinitionSource,
      patentTermYears: meta.patentTermYears,
      transferCount: meta.transferCount,
      inventorNames: meta.inventorNames,
      assigneeNames: meta.assigneeNames,
      applicantNames: meta.applicantNames,
      filingDate: meta.filingDate,
      publicationDate: meta.publicationDate,
      grantDate: meta.grantDate,
      legalStatus: meta.legalStatus,
      ipcCodes: meta.ipcCodes,
      locCodes: meta.locCodes,
      title: it.title,
      summary: it.summary ?? null,
      tradeMode: it.tradeMode,
      licenseMode: it.licenseMode,
      priceType: it.priceType,
      priceAmountFen: it.priceAmount ?? null,
      depositAmountFen: it.depositAmount,
      regionCode: it.regionCode ?? null,
      industryTags: it.industryTagsJson ?? null,
      listingTopics: it.listingTopicsJson ?? null,
      clusterId: it.clusterId ?? null,
      featuredLevel: it.featuredLevel,
      featuredRegionCode: it.featuredRegionCode ?? null,
      recommendationScore: null,
      auditStatus: it.auditStatus,
      status: it.status,
      coverUrl: null,
      createdAt: it.createdAt.toISOString(),
      updatedAt: it.updatedAt.toISOString(),
      stats: it.stats ?? null,
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
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
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

