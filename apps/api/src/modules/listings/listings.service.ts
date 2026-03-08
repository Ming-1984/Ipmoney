import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type AuditStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ListingStatus = 'DRAFT' | 'ACTIVE' | 'OFF_SHELF' | 'SOLD';
type FeaturedLevel = 'NONE' | 'CITY' | 'PROVINCE';
type ContentSource = 'USER' | 'PLATFORM' | 'ADMIN';
type PledgeStatus = 'NONE' | 'PLEDGED' | 'UNKNOWN';
type ExistingLicenseStatus = 'NONE' | 'EXCLUSIVE' | 'SOLE' | 'NON_EXCLUSIVE' | 'UNKNOWN';

import { AuditLogService } from '../../common/audit-log.service';
import { ContentEventService } from '../../common/content-event.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { mapStats } from '../content-utils';
import { ConfigService, type RecommendationConfig } from '../config/config.service';

type ListingAdminDto = {
  id: string;
  source?: ContentSource;
  proofFileIds?: string[];
  deliverables?: string[];
  expectedCompletionDays?: number | null;
  negotiableRangeFen?: number | null;
  negotiableRangePercent?: number | null;
  negotiableNote?: string | null;
  pledgeStatus?: PledgeStatus | null;
  existingLicenseStatus?: ExistingLicenseStatus | null;
  encumbranceNote?: string | null;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly notifications: NotificationsService,
    private readonly events: ContentEventService,
    private readonly config: ConfigService,
  ) {}

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

  private hasOwn(body: any, key: string) {
    return Object.prototype.hasOwnProperty.call(body || {}, key);
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

  private parseContentSourceStrict(value: unknown, fieldName: string): ContentSource {
    const normalized = this.normalizeContentSource(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private normalizeTradeMode(value: unknown): 'ASSIGNMENT' | 'LICENSE' | undefined {
    const mode = String(value || '').trim().toUpperCase();
    if (mode === 'ASSIGNMENT' || mode === 'LICENSE') return mode as 'ASSIGNMENT' | 'LICENSE';
    return undefined;
  }

  private normalizeLicenseMode(value: unknown): 'EXCLUSIVE' | 'SOLE' | 'NON_EXCLUSIVE' | undefined {
    const mode = String(value || '').trim().toUpperCase();
    if (!mode) return undefined;
    if (mode === 'EXCLUSIVE' || mode === 'SOLE' || mode === 'NON_EXCLUSIVE') {
      return mode as 'EXCLUSIVE' | 'SOLE' | 'NON_EXCLUSIVE';
    }
    return undefined;
  }

  private parseTradeModeStrict(value: unknown, fieldName: string): 'ASSIGNMENT' | 'LICENSE' {
    const normalized = this.normalizeTradeMode(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private parseNullableLicenseModeStrict(value: unknown, fieldName: string): 'EXCLUSIVE' | 'SOLE' | 'NON_EXCLUSIVE' | null {
    if (value === null) return null;
    if (typeof value === 'string' && value.trim() === '') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const normalized = this.normalizeLicenseMode(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private normalizeConsultChannel(value: unknown): 'FORM' | 'PHONE' | 'WECHAT_CS' | undefined {
    const channel = String(value || '').trim().toUpperCase();
    if (!channel) return undefined;
    if (channel === 'FORM' || channel === 'PHONE' || channel === 'WECHAT_CS') {
      return channel as 'FORM' | 'PHONE' | 'WECHAT_CS';
    }
    return undefined;
  }

  private parseConsultChannelStrict(value: unknown, fieldName: string): 'FORM' | 'PHONE' | 'WECHAT_CS' {
    const normalized = this.normalizeConsultChannel(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
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

  private parseListingStatusStrict(value: unknown, fieldName: string): ListingStatus {
    const normalized = this.normalizeListingStatus(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private normalizeAuditStatus(value: any): AuditStatus | undefined {
    const s = String(value || '').trim().toUpperCase();
    if (s === 'PENDING' || s === 'APPROVED' || s === 'REJECTED') return s as AuditStatus;
    return undefined;
  }

  private parseAuditStatusStrict(value: unknown, fieldName: string): AuditStatus {
    const normalized = this.normalizeAuditStatus(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private parsePriceTypeStrict(value: unknown, fieldName: string): 'FIXED' | 'NEGOTIABLE' {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'FIXED' || normalized === 'NEGOTIABLE') return normalized as 'FIXED' | 'NEGOTIABLE';
    throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
  }

  private normalizePatentType(value: unknown): 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN' | undefined {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'INVENTION' || normalized === 'UTILITY_MODEL' || normalized === 'DESIGN') {
      return normalized as 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN';
    }
    return undefined;
  }

  private parsePatentTypeStrict(value: unknown, fieldName: string): 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN' {
    const normalized = this.normalizePatentType(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private parseLicenseModeStrict(value: unknown, fieldName: string): 'EXCLUSIVE' | 'SOLE' | 'NON_EXCLUSIVE' {
    const normalized = this.normalizeLicenseMode(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private parseSearchQTypeStrict(value: unknown, fieldName: string): 'AUTO' | 'NUMBER' | 'KEYWORD' | 'APPLICANT' | 'INVENTOR' {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'AUTO' || normalized === 'NUMBER' || normalized === 'KEYWORD' || normalized === 'APPLICANT' || normalized === 'INVENTOR') {
      return normalized as 'AUTO' | 'NUMBER' | 'KEYWORD' | 'APPLICANT' | 'INVENTOR';
    }
    throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
  }

  private parseListingSortByStrict(value: unknown, fieldName: string): 'RECOMMENDED' | 'NEWEST' | 'PRICE_ASC' | 'PRICE_DESC' {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'RECOMMENDED' || normalized === 'NEWEST' || normalized === 'PRICE_ASC' || normalized === 'PRICE_DESC') {
      return normalized as 'RECOMMENDED' | 'NEWEST' | 'PRICE_ASC' | 'PRICE_DESC';
    }
    throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
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

  private normalizePledgeStatus(value: unknown): PledgeStatus | undefined {
    const v = String(value || '').trim().toUpperCase();
    if (!v) return undefined;
    if (v === 'NONE' || v === 'PLEDGED' || v === 'UNKNOWN') return v as PledgeStatus;
    return undefined;
  }

  private parseNullablePledgeStatusStrict(value: unknown, fieldName: string): PledgeStatus | null {
    if (value === null) return null;
    if (typeof value === 'string' && value.trim() === '') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const normalized = this.normalizePledgeStatus(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private normalizeExistingLicenseStatus(value: unknown): ExistingLicenseStatus | undefined {
    const v = String(value || '').trim().toUpperCase();
    if (!v) return undefined;
    if (v === 'NONE' || v === 'EXCLUSIVE' || v === 'SOLE' || v === 'NON_EXCLUSIVE' || v === 'UNKNOWN') {
      return v as ExistingLicenseStatus;
    }
    return undefined;
  }

  private parseNullableExistingLicenseStatusStrict(value: unknown, fieldName: string): ExistingLicenseStatus | null {
    if (value === null) return null;
    if (typeof value === 'string' && value.trim() === '') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const normalized = this.normalizeExistingLicenseStatus(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private parseNullableRegionCodeStrict(value: unknown, fieldName: string): string | null {
    if (value === null) return null;
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseRegionCodeFilterStrict(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseNonEmptyFilterStrict(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseOptionalInt(value: unknown, fieldName: string, min?: number): number | undefined {
    if (value === undefined || value === null) return undefined;
    if (String(value).trim() === '') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const num = Number(value);
    if (!Number.isFinite(num) || !Number.isInteger(num) || (min !== undefined && num < min)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return num;
  }

  private parseOptionalFloat(value: unknown, fieldName: string, min?: number, max?: number): number | undefined {
    if (value === undefined || value === null) return undefined;
    if (String(value).trim() === '') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const num = Number(value);
    if (!Number.isFinite(num) || (min !== undefined && num < min) || (max !== undefined && num > max)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return num;
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
      proofFileIds: this.normalizeStringArray(it.proofFileIdsJson),
      deliverables: this.normalizeStringArray(it.deliverablesJson),
      expectedCompletionDays: it.expectedCompletionDays ?? null,
      negotiableRangeFen: it.negotiableRangeFen ?? null,
      negotiableRangePercent: it.negotiableRangePercent ?? null,
      negotiableNote: it.negotiableNote ?? null,
      pledgeStatus: it.pledgeStatus ?? null,
      existingLicenseStatus: it.existingLicenseStatus ?? null,
      encumbranceNote: it.encumbranceNote ?? null,
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
    if (value === undefined || value === null) return undefined;
    if (String(value).trim() === '') {
      if (strict) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
      }
      return undefined;
    }
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

  private async searchListingIdsByFts(keyword: string, limit = 2000): Promise<string[]> {
    const q = String(keyword || '').trim();
    if (!q) return [];
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT DISTINCT l.id
        FROM listings l
        LEFT JOIN patents p ON p.id = l.patent_id
        LEFT JOIN (
          SELECT patent_id, string_agg(name, ' ') AS party_names
          FROM patent_parties
          GROUP BY patent_id
        ) pp ON pp.patent_id = p.id
        WHERE l.audit_status = 'APPROVED'
          AND l.status = 'ACTIVE'
          AND to_tsvector(
            'simple',
            coalesce(l.title, '') || ' ' || coalesce(l.summary, '') || ' ' ||
            coalesce(p.title, '') || ' ' || coalesce(p.abstract, '') || ' ' ||
            coalesce(pp.party_names, '')
          ) @@ plainto_tsquery('simple', ${q})
        LIMIT ${limit}
      `,
    );
    return rows.map((row) => row.id);
  }

  private normalizeLegalStatus(value: unknown): string | undefined {
    const v = String(value || '').trim().toUpperCase();
    if (!v) return undefined;
    const allowed = ['PENDING', 'GRANTED', 'EXPIRED', 'INVALIDATED', 'UNKNOWN'];
    return allowed.includes(v) ? v : undefined;
  }

  private parseLegalStatusStrict(value: unknown, fieldName: string): 'PENDING' | 'GRANTED' | 'EXPIRED' | 'INVALIDATED' | 'UNKNOWN' {
    const normalized = this.normalizeLegalStatus(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized as 'PENDING' | 'GRANTED' | 'EXPIRED' | 'INVALIDATED' | 'UNKNOWN';
  }

  private parseNullableLegalStatusStrict(
    value: unknown,
    fieldName: string,
  ): 'PENDING' | 'GRANTED' | 'EXPIRED' | 'INVALIDATED' | 'UNKNOWN' | null {
    if (value === null) return null;
    if (typeof value === 'string' && value.trim() === '') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return this.parseLegalStatusStrict(value, fieldName);
  }

  private parseSourcePrimaryStrict(value: unknown, fieldName: string): 'USER' | 'ADMIN' | 'PROVIDER' {
    const normalized = this.normalizePatentSource(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
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

  private withPatentSourceFallback(body: any) {
    const payload = { ...(body || {}) };
    if (!this.hasOwn(payload, 'sourcePrimary') && this.hasOwn(body, 'source')) {
      payload.sourcePrimary = body?.source;
    }
    return payload;
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

    const hasLegalStatus = this.hasOwn(body, 'legalStatus');
    const legalStatus = hasLegalStatus ? this.parseNullableLegalStatusStrict(body?.legalStatus, 'legalStatus') : undefined;
    const legalStatusRawInput = body?.legalStatusRaw ?? body?.legalStatus;
    const legalStatusRaw = legalStatusRawInput !== undefined && legalStatusRawInput !== null && String(legalStatusRawInput).trim() !== '' ? String(legalStatusRawInput) : undefined;
    const hasFilingDate = this.hasOwn(body, 'filingDate');
    const filingDate = hasFilingDate ? this.parseDateValue(body?.filingDate, 'filingDate', true) : undefined;
    const hasPublicationDate = this.hasOwn(body, 'publicationDate');
    const publicationDate = hasPublicationDate ? this.parseDateValue(body?.publicationDate, 'publicationDate', true) : undefined;
    const hasGrantDate = this.hasOwn(body, 'grantDate');
    const grantDate = hasGrantDate ? this.parseDateValue(body?.grantDate, 'grantDate', true) : undefined;

    let transferCount: number | undefined;
    const hasTransferCount = this.hasOwn(body, 'transferCount');
    if (hasTransferCount) {
      const rawTransferCount = body?.transferCount;
      if (rawTransferCount === null || String(rawTransferCount).trim() === '') {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'transferCount is invalid' });
      }
      const num = Number(rawTransferCount);
      if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'transferCount is invalid' });
      }
      transferCount = num;
    }

    const hasSourcePrimary = this.hasOwn(body, 'sourcePrimary');
    const sourcePrimary = hasSourcePrimary ? this.parseSourcePrimaryStrict(body?.sourcePrimary, 'sourcePrimary') : undefined;
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
      if (hasLegalStatus && patent.legalStatus !== legalStatus) patch.legalStatus = legalStatus;
      if (legalStatusRaw && patent.legalStatusRaw !== legalStatusRaw) patch.legalStatusRaw = legalStatusRaw;
      const toDateKey = (value?: Date | null) => (value ? value.toISOString().slice(0, 10) : null);
      if (hasFilingDate && toDateKey(patent.filingDate) !== toDateKey(filingDate ?? null)) {
        patch.filingDate = filingDate ?? null;
      }
      if (hasPublicationDate && toDateKey(patent.publicationDate) !== toDateKey(publicationDate ?? null)) {
        patch.publicationDate = publicationDate ?? null;
      }
      if (hasGrantDate && toDateKey(patent.grantDate) !== toDateKey(grantDate ?? null)) {
        patch.grantDate = grantDate ?? null;
      }
      if (transferCount !== undefined) patch.transferCount = transferCount;
      if (hasSourcePrimary && patent.sourcePrimary !== sourcePrimary) patch.sourcePrimary = sourcePrimary;
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
    const hasLegalStatus = this.hasOwn(body, 'legalStatus');
    const legalStatus = hasLegalStatus ? this.parseNullableLegalStatusStrict(body?.legalStatus, 'legalStatus') : undefined;
    const legalStatusRawInput = body?.legalStatusRaw ?? body?.legalStatus;
    const legalStatusRaw = legalStatusRawInput !== undefined && legalStatusRawInput !== null && String(legalStatusRawInput).trim() !== '' ? String(legalStatusRawInput) : undefined;
    const hasFilingDate = this.hasOwn(body, 'filingDate');
    const filingDate = hasFilingDate ? this.parseDateValue(body?.filingDate, 'filingDate', true) : undefined;
    const hasPublicationDate = this.hasOwn(body, 'publicationDate');
    const publicationDate = hasPublicationDate ? this.parseDateValue(body?.publicationDate, 'publicationDate', true) : undefined;
    const hasGrantDate = this.hasOwn(body, 'grantDate');
    const grantDate = hasGrantDate ? this.parseDateValue(body?.grantDate, 'grantDate', true) : undefined;

    let transferCount: number | undefined;
    const hasTransferCount = this.hasOwn(body, 'transferCount');
    if (hasTransferCount) {
      const rawTransferCount = body?.transferCount;
      if (rawTransferCount === null || String(rawTransferCount).trim() === '') {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'transferCount is invalid' });
      }
      const num = Number(rawTransferCount);
      if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'transferCount is invalid' });
      }
      transferCount = num;
    }
    const hasSourcePrimary = this.hasOwn(body, 'sourcePrimary');
    const sourcePrimary = hasSourcePrimary ? this.parseSourcePrimaryStrict(body?.sourcePrimary, 'sourcePrimary') : undefined;

    const data: any = {};
    if (hasLegalStatus) data.legalStatus = legalStatus;
    if (legalStatusRaw) data.legalStatusRaw = legalStatusRaw;
    if (hasFilingDate) data.filingDate = filingDate ?? null;
    if (hasPublicationDate) data.publicationDate = publicationDate ?? null;
    if (hasGrantDate) data.grantDate = grantDate ?? null;
    if (transferCount !== undefined) data.transferCount = transferCount;
    if (hasSourcePrimary) data.sourcePrimary = sourcePrimary;
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
      inventorNames,
      assigneeNames,
      applicantNames,
      filingDate: toDate(patent?.filingDate),
      publicationDate: toDate(patent?.publicationDate),
      grantDate: toDate(patent?.grantDate),
      legalStatus,
      ipcCodes,
      locCodes,
    };
  }

  private toListingSummary(it: any, recommendationScore?: number | null) {
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
      recommendationScore: recommendationScore ?? null,
      title: it.title,
      deliverables: this.normalizeStringArray(it.deliverablesJson),
      expectedCompletionDays: it.expectedCompletionDays ?? null,
      negotiableRangeFen: it.negotiableRangeFen ?? null,
      negotiableRangePercent: it.negotiableRangePercent ?? null,
      negotiableNote: it.negotiableNote ?? null,
      pledgeStatus: it.pledgeStatus ?? null,
      existingLicenseStatus: it.existingLicenseStatus ?? null,
      encumbranceNote: it.encumbranceNote ?? null,
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
      industryTags: this.normalizeStringArray(it.industryTagsJson),
      listingTopics: this.normalizeStringArray(it.listingTopicsJson),
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
      stats: mapStats(it.stats),
    };
  }

  private normalizeWeight(value: unknown, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  private isFeaturedActive(item: any, nowMs: number) {
    const level = String(item?.featuredLevel || 'NONE').toUpperCase();
    if (level === 'NONE') return false;
    const until = item?.featuredUntil instanceof Date ? item.featuredUntil.getTime() : undefined;
    if (until !== undefined && until <= nowMs) return false;
    return true;
  }

  private computeRecommendationScore(
    item: any,
    config: RecommendationConfig,
    context: { regionCode?: string | null },
    nowMs: number,
  ) {
    const weights = config?.weights || {
      time: 1,
      view: 1,
      favorite: 1,
      consult: 1,
      region: 0,
      user: 0,
    };
    const timeWeight = this.normalizeWeight(weights.time, 0);
    const viewWeight = this.normalizeWeight(weights.view, 0);
    const favoriteWeight = this.normalizeWeight(weights.favorite, 0);
    const consultWeight = this.normalizeWeight(weights.consult, 0);
    const regionWeight = this.normalizeWeight(weights.region, 0);
    const userWeight = this.normalizeWeight(weights.user, 0);

    const halfLifeHours = Math.max(1, this.normalizeWeight(config?.timeDecayHalfLifeHours, 72));
    const createdAt = item?.createdAt instanceof Date ? item.createdAt.getTime() : nowMs;
    const ageHours = Math.max(0, (nowMs - createdAt) / (1000 * 3600));
    const decay = Math.pow(0.5, ageHours / halfLifeHours);

    const stats = item?.stats ?? {};
    const viewCount = Math.max(0, this.normalizeWeight(stats.viewCount, 0));
    const favoriteCount = Math.max(0, this.normalizeWeight(stats.favoriteCount, 0));
    const consultCount = Math.max(0, this.normalizeWeight(stats.consultCount, 0));

    const regionCode = context.regionCode ? String(context.regionCode) : '';
    const regionMatch =
      regionCode && (item?.regionCode === regionCode || item?.featuredRegionCode === regionCode) ? 1 : 0;

    const featuredActive = this.isFeaturedActive(item, nowMs);
    const featuredLevel = String(item?.featuredLevel || 'NONE').toUpperCase();
    const featuredRegionMatch =
      !regionCode || item?.featuredRegionCode === regionCode || item?.regionCode === regionCode;
    let featuredBoost = 0;
    if (featuredActive && featuredRegionMatch) {
      if (featuredLevel === 'PROVINCE') {
        featuredBoost = this.normalizeWeight(config?.featuredBoost?.province, 0);
      } else if (featuredLevel === 'CITY') {
        featuredBoost = this.normalizeWeight(config?.featuredBoost?.city, 0);
      }
    }

    const tagSimilarity = 0;

    return (
      timeWeight * decay +
      viewWeight * Math.log1p(viewCount) +
      favoriteWeight * Math.log1p(favoriteCount) +
      consultWeight * Math.log1p(consultCount) +
      regionWeight * regionMatch +
      userWeight * tagSimilarity +
      featuredBoost
    );
  }
  async listAdmin(query: any): Promise<PagedListingAdmin> {
    const hasPage = this.hasOwn(query, 'page');
    const hasPageSize = this.hasOwn(query, 'pageSize');
    const page = hasPage ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = hasPageSize ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 10;
    const pageSize = Math.min(50, pageSizeInput);
    const q = String(query?.q || '').trim();
    const hasRegionCode = this.hasOwn(query, 'regionCode');
    const regionCode = hasRegionCode ? this.parseRegionCodeFilterStrict(query?.regionCode, 'regionCode') : '';
    const hasAuditStatus = this.hasOwn(query, 'auditStatus');
    const hasStatus = this.hasOwn(query, 'status');
    const hasSource = this.hasOwn(query, 'source');
    const auditStatus = hasAuditStatus ? this.parseAuditStatusStrict(query?.auditStatus, 'auditStatus') : undefined;
    const status = hasStatus ? this.parseListingStatusStrict(query?.status, 'status') : undefined;
    const source = hasSource ? this.parseContentSourceStrict(query?.source, 'source') : undefined;

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
    const hasSource = this.hasOwn(body, 'source');
    const hasTradeMode = this.hasOwn(body, 'tradeMode');
    const hasLicenseMode = this.hasOwn(body, 'licenseMode');
    const hasPriceType = this.hasOwn(body, 'priceType');
    const hasPriceAmountFen = this.hasOwn(body, 'priceAmountFen');
    const hasDepositAmountFen = this.hasOwn(body, 'depositAmountFen');
    const hasPledgeStatus = this.hasOwn(body, 'pledgeStatus');
    const hasExistingLicenseStatus = this.hasOwn(body, 'existingLicenseStatus');
    const hasRegionCode = this.hasOwn(body, 'regionCode');
    const hasClusterId = this.hasOwn(body, 'clusterId');
    const hasAuditStatus = this.hasOwn(body, 'auditStatus');
    const hasStatus = this.hasOwn(body, 'status');

    const source = hasSource ? this.parseContentSourceStrict(body?.source, 'source') : 'ADMIN';
    const tradeMode = hasTradeMode ? this.parseTradeModeStrict(body?.tradeMode, 'tradeMode') : 'ASSIGNMENT';
    const licenseMode = hasLicenseMode ? this.parseNullableLicenseModeStrict(body?.licenseMode, 'licenseMode') : null;
    const priceType = hasPriceType ? this.parsePriceTypeStrict(body?.priceType, 'priceType') : 'NEGOTIABLE';
    const priceAmountFen = hasPriceAmountFen ? this.parseOptionalInt(body?.priceAmountFen, 'priceAmountFen', 0) : undefined;
    const depositAmountFen = hasDepositAmountFen ? (this.parseOptionalInt(body?.depositAmountFen, 'depositAmountFen', 0) ?? 0) : 0;
    const pledgeStatus = hasPledgeStatus ? this.parseNullablePledgeStatusStrict(body?.pledgeStatus, 'pledgeStatus') : null;
    const existingLicenseStatus = hasExistingLicenseStatus
      ? this.parseNullableExistingLicenseStatusStrict(body?.existingLicenseStatus, 'existingLicenseStatus')
      : null;
    const regionCode = hasRegionCode ? this.parseNullableRegionCodeStrict(body?.regionCode, 'regionCode') : undefined;
    const clusterId = hasClusterId ? this.parseNullableRegionCodeStrict(body?.clusterId, 'clusterId') : undefined;
    const auditStatus = hasAuditStatus ? this.parseAuditStatusStrict(body?.auditStatus, 'auditStatus') : 'PENDING';
    const status = hasStatus ? this.parseListingStatusStrict(body?.status, 'status') : 'DRAFT';

    const sellerUserId = String(body?.sellerUserId || req?.auth?.userId || '').trim();
    if (!sellerUserId) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'sellerUserId is required' });
    }
    const patent = await this.ensurePatent(this.withPatentSourceFallback(body));
    if (patent) {
      await Promise.all([
        this.syncPatentParties(patent.id, 'INVENTOR', body?.inventorNames),
        this.syncPatentParties(patent.id, 'ASSIGNEE', body?.assigneeNames),
        this.syncPatentParties(patent.id, 'APPLICANT', body?.applicantNames),
        this.syncPatentClassifications(patent.id, 'IPC', body?.ipcCodes),
        this.syncPatentClassifications(patent.id, 'LOC', body?.locCodes),
      ]);
    }
    const listingTopics = this.normalizeStringArray(body?.listingTopics ?? body?.listingTopic)
      .map((v: any) => String(v || '').trim().toUpperCase())
      .filter((v: any) => v.length > 0);
    const proofFileIds = this.normalizeFileIds(body?.proofFileIds);
    const deliverables = this.normalizeStringArray(body?.deliverables);
    const expectedCompletionDays = this.parseOptionalInt(body?.expectedCompletionDays, 'expectedCompletionDays', 1);
    const negotiableRangeFen = this.parseOptionalInt(body?.negotiableRangeFen, 'negotiableRangeFen', 0);
    const negotiableRangePercent = this.parseOptionalFloat(body?.negotiableRangePercent, 'negotiableRangePercent', 0, 100);
    if (negotiableRangeFen !== undefined && negotiableRangePercent !== undefined) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'negotiableRange is invalid' });
    }
    const negotiableNote = body?.negotiableNote ? String(body?.negotiableNote) : null;
    const encumbranceNote = body?.encumbranceNote ? String(body?.encumbranceNote) : null;
    const listing = await this.prisma.listing.create({
      data: {
        sellerUserId,
        source,
        patentId: patent?.id ?? null,
        title: body?.title || patent?.title || 'Listing',
        summary: body?.summary || null,
        tradeMode,
        licenseMode,
        priceType,
        priceAmount: hasPriceAmountFen ? (priceAmountFen ?? null) : null,
        depositAmount: depositAmountFen,
        deliverablesJson: deliverables.length > 0 ? deliverables : Prisma.DbNull,
        expectedCompletionDays: expectedCompletionDays ?? null,
        negotiableRangeFen: negotiableRangeFen ?? null,
        negotiableRangePercent: negotiableRangePercent ?? null,
        negotiableNote,
        pledgeStatus,
        existingLicenseStatus,
        encumbranceNote,
        regionCode: hasRegionCode ? regionCode : null,
        industryTagsJson: body?.industryTags ?? Prisma.DbNull,
        listingTopicsJson: listingTopics.length > 0 ? listingTopics : Prisma.DbNull,
        proofFileIdsJson: proofFileIds.length > 0 ? proofFileIds : Prisma.DbNull,
        clusterId: hasClusterId ? clusterId : null,
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
    const patentBody = this.withPatentSourceFallback(body);
    if (body?.patentNumberRaw) {
      const patent = await this.ensurePatent(patentBody);
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
    const hasDeliverables = Object.prototype.hasOwnProperty.call(body || {}, 'deliverables');
    const deliverables = hasDeliverables ? this.normalizeStringArray(body?.deliverables) : undefined;
    const hasExpectedCompletionDays = Object.prototype.hasOwnProperty.call(body || {}, 'expectedCompletionDays');
    const expectedCompletionDays = hasExpectedCompletionDays ? this.parseOptionalInt(body?.expectedCompletionDays, 'expectedCompletionDays', 1) : undefined;
    const hasNegotiableRangeFen = Object.prototype.hasOwnProperty.call(body || {}, 'negotiableRangeFen');
    const hasNegotiableRangePercent = Object.prototype.hasOwnProperty.call(body || {}, 'negotiableRangePercent');
    const negotiableRangeFen = hasNegotiableRangeFen ? this.parseOptionalInt(body?.negotiableRangeFen, 'negotiableRangeFen', 0) : undefined;
    const negotiableRangePercent = hasNegotiableRangePercent ? this.parseOptionalFloat(body?.negotiableRangePercent, 'negotiableRangePercent', 0, 100) : undefined;
    if (negotiableRangeFen !== undefined && negotiableRangePercent !== undefined) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'negotiableRange is invalid' });
    }
    const hasNegotiableNote = Object.prototype.hasOwnProperty.call(body || {}, 'negotiableNote');
    const negotiableNote = hasNegotiableNote ? (body?.negotiableNote ? String(body?.negotiableNote) : null) : undefined;
    const hasPledgeStatus = Object.prototype.hasOwnProperty.call(body || {}, 'pledgeStatus');
    const pledgeStatus = hasPledgeStatus ? this.parseNullablePledgeStatusStrict(body?.pledgeStatus, 'pledgeStatus') : undefined;
    const hasExistingLicenseStatus = Object.prototype.hasOwnProperty.call(body || {}, 'existingLicenseStatus');
    const existingLicenseStatus = hasExistingLicenseStatus
      ? this.parseNullableExistingLicenseStatusStrict(body?.existingLicenseStatus, 'existingLicenseStatus')
      : undefined;
    const hasEncumbranceNote = Object.prototype.hasOwnProperty.call(body || {}, 'encumbranceNote');
    const encumbranceNote = hasEncumbranceNote ? (body?.encumbranceNote ? String(body?.encumbranceNote) : null) : undefined;
    const hasClusterId = Object.prototype.hasOwnProperty.call(body || {}, 'clusterId');
    const clusterId = hasClusterId ? this.parseNullableRegionCodeStrict(body?.clusterId, 'clusterId') : undefined;
    const hasRegionCode = this.hasOwn(body, 'regionCode');
    const regionCode = hasRegionCode ? this.parseNullableRegionCodeStrict(body?.regionCode, 'regionCode') : undefined;
    const hasSource = this.hasOwn(body, 'source');
    const source = hasSource ? this.parseContentSourceStrict(body?.source, 'source') : undefined;
    const hasTradeMode = this.hasOwn(body, 'tradeMode');
    const tradeMode = hasTradeMode ? this.parseTradeModeStrict(body?.tradeMode, 'tradeMode') : undefined;
    const hasLicenseMode = this.hasOwn(body, 'licenseMode');
    const licenseMode = hasLicenseMode ? this.parseNullableLicenseModeStrict(body?.licenseMode, 'licenseMode') : undefined;
    const hasPriceType = this.hasOwn(body, 'priceType');
    const priceType = hasPriceType ? this.parsePriceTypeStrict(body?.priceType, 'priceType') : undefined;
    const hasPriceAmountFen = this.hasOwn(body, 'priceAmountFen');
    const priceAmountFen = hasPriceAmountFen ? this.parseOptionalInt(body?.priceAmountFen, 'priceAmountFen', 0) : undefined;
    const hasDepositAmountFen = this.hasOwn(body, 'depositAmountFen');
    const depositAmountFen = hasDepositAmountFen ? this.parseOptionalInt(body?.depositAmountFen, 'depositAmountFen', 0) : undefined;
    const hasAuditStatus = this.hasOwn(body, 'auditStatus');
    const auditStatus = hasAuditStatus ? this.parseAuditStatusStrict(body?.auditStatus, 'auditStatus') : undefined;
    const hasStatus = this.hasOwn(body, 'status');
    const status = hasStatus ? this.parseListingStatusStrict(body?.status, 'status') : undefined;
    const hasSellerUserId = this.hasOwn(body, 'sellerUserId');
    const sellerUserId = hasSellerUserId ? this.parseNonEmptyFilterStrict(body?.sellerUserId, 'sellerUserId') : listing.sellerUserId;
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        sellerUserId,
        source: hasSource ? source : listing.source,
        patentId: patentId ?? null,
        title: body?.title ?? listing.title,
        summary: body?.summary ?? listing.summary,
        tradeMode: hasTradeMode ? tradeMode : listing.tradeMode,
        licenseMode: hasLicenseMode ? licenseMode : listing.licenseMode,
        priceType: hasPriceType ? priceType : listing.priceType,
        priceAmount: hasPriceAmountFen ? (priceAmountFen ?? listing.priceAmount) : listing.priceAmount,
        depositAmount: hasDepositAmountFen ? (depositAmountFen ?? listing.depositAmount) : listing.depositAmount,
        deliverablesJson: hasDeliverables ? (deliverables && deliverables.length > 0 ? deliverables : Prisma.DbNull) : undefined,
        expectedCompletionDays: hasExpectedCompletionDays ? (expectedCompletionDays ?? null) : listing.expectedCompletionDays,
        negotiableRangeFen: hasNegotiableRangeFen ? (negotiableRangeFen ?? null) : listing.negotiableRangeFen,
        negotiableRangePercent: hasNegotiableRangePercent ? (negotiableRangePercent ?? null) : listing.negotiableRangePercent,
        negotiableNote: hasNegotiableNote ? negotiableNote : listing.negotiableNote,
        pledgeStatus: hasPledgeStatus ? pledgeStatus ?? null : listing.pledgeStatus,
        existingLicenseStatus: hasExistingLicenseStatus ? existingLicenseStatus ?? null : listing.existingLicenseStatus,
        encumbranceNote: hasEncumbranceNote ? encumbranceNote : listing.encumbranceNote,
        regionCode: hasRegionCode ? regionCode : listing.regionCode,
        industryTagsJson: body?.industryTags !== undefined ? body?.industryTags ?? Prisma.DbNull : undefined,
        listingTopicsJson: hasListingTopics ? (listingTopics && listingTopics.length > 0 ? listingTopics : Prisma.DbNull) : undefined,
        proofFileIdsJson: hasProofFileIds ? (proofFileIds && proofFileIds.length > 0 ? proofFileIds : Prisma.DbNull) : undefined,
        clusterId: hasClusterId ? clusterId : listing.clusterId,
        auditStatus: hasAuditStatus ? auditStatus : listing.auditStatus,
        status: hasStatus ? status : listing.status,
      },
    });
    if (patentId) {
      await this.updatePatentCore(patentId, patentBody);
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
    let it: any;
    try {
      it = await this.prisma.listing.update({
        where: { id: listingId },
        data: { auditStatus: 'APPROVED' },
      });
    } catch (error: any) {
      if (error?.code === 'P2025') {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
      }
      throw error;
    }
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
    if (reviewerId) {
      await this.audit.log({
        actorUserId: reviewerId,
        action: 'LISTING_APPROVE',
        targetType: 'LISTING',
        targetId: listingId,
        afterJson: { auditStatus: 'APPROVED', reason },
      });
    }
    await this.notifications.create({
      userId: it.sellerUserId,
      title: '上架审核通过',
      summary: `《${it.title || '专利'}》已通过审核，可在平台展示。`,
      source: '平台审核',
    });
    return this.toAdminDto(it);
  }

  async reject(listingId: string, reviewerId: string | null, reason?: string) {
    let it: any;
    try {
      it = await this.prisma.listing.update({
        where: { id: listingId },
        data: { auditStatus: 'REJECTED' },
      });
    } catch (error: any) {
      if (error?.code === 'P2025') {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
      }
      throw error;
    }
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
    if (reviewerId) {
      await this.audit.log({
        actorUserId: reviewerId,
        action: 'LISTING_REJECT',
        targetType: 'LISTING',
        targetId: listingId,
        afterJson: { auditStatus: 'REJECTED', reason },
      });
    }
    await this.notifications.create({
      userId: it.sellerUserId,
      title: '上架审核驳回',
      summary: `《${it.title || '专利'}》审核未通过${reason ? `，原因：${reason}` : '，请修改后重新提交'}。`,
      source: '平台审核',
    });
    return this.toAdminDto(it);
  }

  async updateFeatured(listingId: string, payload: any, operatorId?: string | null) {
    if (payload?.featuredLevel === undefined || payload?.featuredLevel === null) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'featuredLevel is required' });
    }
    const level = String(payload?.featuredLevel).trim().toUpperCase();
    if (!['NONE', 'CITY', 'PROVINCE'].includes(level)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'featuredLevel must be NONE/CITY/PROVINCE' });
    }
    const featuredLevel = level as FeaturedLevel;
    const data: any = { featuredLevel };
    if (featuredLevel !== 'NONE') {
      const featuredRegionCode = String(payload?.featuredRegionCode || '').trim();
      if (!/^[0-9]{6}$/.test(featuredRegionCode)) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'featuredRegionCode must be 6 digits when featuredLevel != NONE' });
      }
      data.featuredRegionCode = featuredRegionCode;

      if (payload?.featuredRank !== undefined && payload?.featuredRank !== null) {
        const rawFeaturedRank = payload.featuredRank;
        if (String(rawFeaturedRank).trim() === '') {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'featuredRank must be an integer >= 0' });
        }
        const featuredRank = typeof rawFeaturedRank === 'number' ? rawFeaturedRank : Number(rawFeaturedRank);
        if (!Number.isFinite(featuredRank) || !Number.isInteger(featuredRank) || featuredRank < 0) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'featuredRank must be an integer >= 0' });
        }
        data.featuredRank = featuredRank;
      } else {
        data.featuredRank = null;
      }

      if (payload?.featuredUntil !== undefined && payload?.featuredUntil !== null) {
        const rawFeaturedUntil = payload.featuredUntil;
        if (typeof rawFeaturedUntil === 'string' && rawFeaturedUntil.trim().length === 0) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'featuredUntil must be a valid datetime' });
        }
        const featuredUntil = new Date(String(rawFeaturedUntil));
        if (Number.isNaN(featuredUntil.getTime())) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'featuredUntil must be a valid datetime' });
        }
        data.featuredUntil = featuredUntil;
      } else {
        data.featuredUntil = null;
      }
    } else {
      data.featuredRegionCode = null;
      data.featuredRank = null;
      data.featuredUntil = null;
    }

    let it: any;
    try {
      it = await this.prisma.listing.update({ where: { id: listingId }, data });
    } catch (error: any) {
      if (error?.code === 'P2025') {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
      }
      throw error;
    }
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
    const hasPage = this.hasOwn(query, 'page');
    const hasPageSize = this.hasOwn(query, 'pageSize');
    const page = hasPage ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = hasPageSize ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
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
          deliverables: this.normalizeStringArray(it.deliverablesJson),
          expectedCompletionDays: it.expectedCompletionDays ?? null,
          negotiableRangeFen: it.negotiableRangeFen ?? null,
          negotiableRangePercent: it.negotiableRangePercent ?? null,
          negotiableNote: it.negotiableNote ?? null,
          pledgeStatus: it.pledgeStatus ?? null,
          existingLicenseStatus: it.existingLicenseStatus ?? null,
          encumbranceNote: it.encumbranceNote ?? null,
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
          listingTopics: this.normalizeStringArray(it.listingTopicsJson),
          proofFileIds: this.normalizeStringArray(it.proofFileIdsJson),
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
      deliverables: this.normalizeStringArray(it.deliverablesJson),
      expectedCompletionDays: it.expectedCompletionDays ?? null,
      negotiableRangeFen: it.negotiableRangeFen ?? null,
      negotiableRangePercent: it.negotiableRangePercent ?? null,
      negotiableNote: it.negotiableNote ?? null,
      pledgeStatus: it.pledgeStatus ?? null,
      existingLicenseStatus: it.existingLicenseStatus ?? null,
      encumbranceNote: it.encumbranceNote ?? null,
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
      listingTopics: this.normalizeStringArray(it.listingTopicsJson),
      clusterId: it.clusterId ?? null,
      proofFileIds: this.normalizeStringArray(it.proofFileIdsJson),
      summary: it.summary ?? null,
      createdAt: it.createdAt.toISOString(),
      updatedAt: it.updatedAt.toISOString(),
    };
  }

  async createListing(req: any, body: any) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
    const hasTradeMode = this.hasOwn(body, 'tradeMode');
    const hasLicenseMode = this.hasOwn(body, 'licenseMode');
    const hasPriceType = this.hasOwn(body, 'priceType');
    const hasPriceAmountFen = this.hasOwn(body, 'priceAmountFen');
    const hasDepositAmountFen = this.hasOwn(body, 'depositAmountFen');
    const hasPledgeStatus = this.hasOwn(body, 'pledgeStatus');
    const hasExistingLicenseStatus = this.hasOwn(body, 'existingLicenseStatus');
    const hasRegionCode = this.hasOwn(body, 'regionCode');
    const hasClusterId = this.hasOwn(body, 'clusterId');
    const tradeMode = hasTradeMode ? this.parseTradeModeStrict(body?.tradeMode, 'tradeMode') : 'ASSIGNMENT';
    const licenseMode = hasLicenseMode ? this.parseNullableLicenseModeStrict(body?.licenseMode, 'licenseMode') : null;
    const priceType = hasPriceType ? this.parsePriceTypeStrict(body?.priceType, 'priceType') : 'NEGOTIABLE';
    const priceAmountFen = hasPriceAmountFen ? this.parseOptionalInt(body?.priceAmountFen, 'priceAmountFen', 0) : undefined;
    const depositAmountFen = hasDepositAmountFen ? (this.parseOptionalInt(body?.depositAmountFen, 'depositAmountFen', 0) ?? 0) : 0;
    const pledgeStatus = hasPledgeStatus ? this.parseNullablePledgeStatusStrict(body?.pledgeStatus, 'pledgeStatus') : null;
    const existingLicenseStatus = hasExistingLicenseStatus
      ? this.parseNullableExistingLicenseStatusStrict(body?.existingLicenseStatus, 'existingLicenseStatus')
      : null;
    const regionCode = hasRegionCode ? this.parseNullableRegionCodeStrict(body?.regionCode, 'regionCode') : undefined;
    const clusterId = hasClusterId ? this.parseNullableRegionCodeStrict(body?.clusterId, 'clusterId') : undefined;
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
    const listingTopics = this.normalizeStringArray(body?.listingTopics ?? body?.listingTopic)
      .map((v: any) => String(v || '').trim().toUpperCase())
      .filter((v: any) => v.length > 0);
    const proofFileIds = this.normalizeFileIds(body?.proofFileIds);
    const deliverables = this.normalizeStringArray(body?.deliverables);
    const expectedCompletionDays = this.parseOptionalInt(body?.expectedCompletionDays, 'expectedCompletionDays', 1);
    const negotiableRangeFen = this.parseOptionalInt(body?.negotiableRangeFen, 'negotiableRangeFen', 0);
    const negotiableRangePercent = this.parseOptionalFloat(body?.negotiableRangePercent, 'negotiableRangePercent', 0, 100);
    if (negotiableRangeFen !== undefined && negotiableRangePercent !== undefined) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'negotiableRange is invalid' });
    }
    const negotiableNote = body?.negotiableNote ? String(body?.negotiableNote) : null;
    const encumbranceNote = body?.encumbranceNote ? String(body?.encumbranceNote) : null;
    const listing = await this.prisma.listing.create({
      data: {
        sellerUserId: req.auth.userId,
        source: 'USER',
        patentId: patent?.id ?? null,
        title: body?.title || patent?.title || 'Listing',
        summary: body?.summary || null,
        tradeMode,
        licenseMode,
        priceType,
        priceAmount: hasPriceAmountFen ? (priceAmountFen ?? null) : null,
        depositAmount: depositAmountFen,
        deliverablesJson: deliverables.length > 0 ? deliverables : Prisma.DbNull,
        expectedCompletionDays: expectedCompletionDays ?? null,
        negotiableRangeFen: negotiableRangeFen ?? null,
        negotiableRangePercent: negotiableRangePercent ?? null,
        negotiableNote,
        pledgeStatus,
        existingLicenseStatus,
        encumbranceNote,
        regionCode: hasRegionCode ? regionCode : null,
        industryTagsJson: body?.industryTags ?? Prisma.DbNull,
        listingTopicsJson: listingTopics.length > 0 ? listingTopics : Prisma.DbNull,
        proofFileIdsJson: proofFileIds.length > 0 ? proofFileIds : Prisma.DbNull,
        clusterId: hasClusterId ? clusterId : null,
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
    const hasDeliverables = Object.prototype.hasOwnProperty.call(body || {}, 'deliverables');
    const deliverables = hasDeliverables ? this.normalizeStringArray(body?.deliverables) : undefined;
    const hasExpectedCompletionDays = Object.prototype.hasOwnProperty.call(body || {}, 'expectedCompletionDays');
    const expectedCompletionDays = hasExpectedCompletionDays ? this.parseOptionalInt(body?.expectedCompletionDays, 'expectedCompletionDays', 1) : undefined;
    const hasNegotiableRangeFen = Object.prototype.hasOwnProperty.call(body || {}, 'negotiableRangeFen');
    const hasNegotiableRangePercent = Object.prototype.hasOwnProperty.call(body || {}, 'negotiableRangePercent');
    const negotiableRangeFen = hasNegotiableRangeFen ? this.parseOptionalInt(body?.negotiableRangeFen, 'negotiableRangeFen', 0) : undefined;
    const negotiableRangePercent = hasNegotiableRangePercent ? this.parseOptionalFloat(body?.negotiableRangePercent, 'negotiableRangePercent', 0, 100) : undefined;
    if (negotiableRangeFen !== undefined && negotiableRangePercent !== undefined) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'negotiableRange is invalid' });
    }
    const hasNegotiableNote = Object.prototype.hasOwnProperty.call(body || {}, 'negotiableNote');
    const negotiableNote = hasNegotiableNote ? (body?.negotiableNote ? String(body?.negotiableNote) : null) : undefined;
    const hasPledgeStatus = this.hasOwn(body, 'pledgeStatus');
    const pledgeStatus = hasPledgeStatus ? this.parseNullablePledgeStatusStrict(body?.pledgeStatus, 'pledgeStatus') : undefined;
    const hasExistingLicenseStatus = this.hasOwn(body, 'existingLicenseStatus');
    const existingLicenseStatus = hasExistingLicenseStatus
      ? this.parseNullableExistingLicenseStatusStrict(body?.existingLicenseStatus, 'existingLicenseStatus')
      : undefined;
    const hasEncumbranceNote = Object.prototype.hasOwnProperty.call(body || {}, 'encumbranceNote');
    const encumbranceNote = hasEncumbranceNote ? (body?.encumbranceNote ? String(body?.encumbranceNote) : null) : undefined;
    const hasClusterId = Object.prototype.hasOwnProperty.call(body || {}, 'clusterId');
    const clusterId = hasClusterId ? this.parseNullableRegionCodeStrict(body?.clusterId, 'clusterId') : undefined;
    const hasRegionCode = this.hasOwn(body, 'regionCode');
    const regionCode = hasRegionCode ? this.parseNullableRegionCodeStrict(body?.regionCode, 'regionCode') : undefined;
    const hasTradeMode = this.hasOwn(body, 'tradeMode');
    const tradeMode = hasTradeMode ? this.parseTradeModeStrict(body?.tradeMode, 'tradeMode') : undefined;
    const hasLicenseMode = this.hasOwn(body, 'licenseMode');
    const licenseMode = hasLicenseMode ? this.parseNullableLicenseModeStrict(body?.licenseMode, 'licenseMode') : undefined;
    const hasPriceType = this.hasOwn(body, 'priceType');
    const priceType = hasPriceType ? this.parsePriceTypeStrict(body?.priceType, 'priceType') : undefined;
    const hasPriceAmountFen = this.hasOwn(body, 'priceAmountFen');
    const priceAmountFen = hasPriceAmountFen ? this.parseOptionalInt(body?.priceAmountFen, 'priceAmountFen', 0) : undefined;
    const hasDepositAmountFen = this.hasOwn(body, 'depositAmountFen');
    const depositAmountFen = hasDepositAmountFen ? this.parseOptionalInt(body?.depositAmountFen, 'depositAmountFen', 0) : undefined;
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        patentId: patentId ?? null,
        title: body?.title ?? listing.title,
        summary: body?.summary ?? listing.summary,
        tradeMode: hasTradeMode ? tradeMode : listing.tradeMode,
        licenseMode: hasLicenseMode ? licenseMode : listing.licenseMode,
        priceType: hasPriceType ? priceType : listing.priceType,
        priceAmount: hasPriceAmountFen ? (priceAmountFen ?? listing.priceAmount) : listing.priceAmount,
        depositAmount: hasDepositAmountFen ? (depositAmountFen ?? listing.depositAmount) : listing.depositAmount,
        deliverablesJson: hasDeliverables ? (deliverables && deliverables.length > 0 ? deliverables : Prisma.DbNull) : undefined,
        expectedCompletionDays: hasExpectedCompletionDays ? (expectedCompletionDays ?? null) : listing.expectedCompletionDays,
        negotiableRangeFen: hasNegotiableRangeFen ? (negotiableRangeFen ?? null) : listing.negotiableRangeFen,
        negotiableRangePercent: hasNegotiableRangePercent ? (negotiableRangePercent ?? null) : listing.negotiableRangePercent,
        negotiableNote: hasNegotiableNote ? negotiableNote : listing.negotiableNote,
        pledgeStatus: hasPledgeStatus ? pledgeStatus ?? null : listing.pledgeStatus,
        existingLicenseStatus: hasExistingLicenseStatus ? existingLicenseStatus ?? null : listing.existingLicenseStatus,
        encumbranceNote: hasEncumbranceNote ? encumbranceNote : listing.encumbranceNote,
        regionCode: hasRegionCode ? regionCode : listing.regionCode,
        industryTagsJson: body?.industryTags !== undefined ? body?.industryTags ?? Prisma.DbNull : undefined,
        listingTopicsJson: hasListingTopics ? (listingTopics && listingTopics.length > 0 ? listingTopics : Prisma.DbNull) : undefined,
        proofFileIdsJson: hasProofFileIds ? (proofFileIds && proofFileIds.length > 0 ? proofFileIds : Prisma.DbNull) : undefined,
        clusterId: hasClusterId ? clusterId : listing.clusterId,
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
    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'LISTING_SUBMIT',
      targetType: 'LISTING',
      targetId: listingId,
      afterJson: { auditStatus: 'PENDING' },
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
    const hasPage = this.hasOwn(query, 'page');
    const hasPageSize = this.hasOwn(query, 'pageSize');
    const page = hasPage ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = hasPageSize ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
    const q = String(query?.q || '').trim();
    const hasQType = this.hasOwn(query, 'qType');
    const qType = hasQType ? this.parseSearchQTypeStrict(query?.qType, 'qType') : 'AUTO';
    const hasPatentType = this.hasOwn(query, 'patentType');
    const patentType = hasPatentType ? this.parsePatentTypeStrict(query?.patentType, 'patentType') : undefined;
    const inventor = String(query?.inventor || '').trim();
    const applicant = String(query?.applicant || query?.applicantName || '').trim();
    const assignee = String(query?.assignee || query?.assigneeName || '').trim();
    const hasSellerUserId = this.hasOwn(query, 'sellerUserId');
    const sellerUserId = hasSellerUserId ? this.parseNonEmptyFilterStrict(query?.sellerUserId, 'sellerUserId') : '';
    const hasTradeMode = this.hasOwn(query, 'tradeMode');
    const tradeMode = hasTradeMode ? this.parseTradeModeStrict(query?.tradeMode, 'tradeMode') : undefined;
    const hasLicenseMode = this.hasOwn(query, 'licenseMode');
    const licenseMode = hasLicenseMode ? this.parseLicenseModeStrict(query?.licenseMode, 'licenseMode') : undefined;
    const hasPriceType = this.hasOwn(query, 'priceType');
    const priceType = hasPriceType ? this.parsePriceTypeStrict(query?.priceType, 'priceType') : undefined;
    const hasRegionCode = this.hasOwn(query, 'regionCode');
    const regionCode = hasRegionCode ? this.parseRegionCodeFilterStrict(query?.regionCode, 'regionCode') : '';
    const hasLegalStatus = this.hasOwn(query, 'legalStatus');
    const legalStatus = hasLegalStatus ? this.parseLegalStatusStrict(query?.legalStatus, 'legalStatus') : undefined;
    const hasSortBy = this.hasOwn(query, 'sortBy');
    const sortBy = hasSortBy ? this.parseListingSortByStrict(query?.sortBy, 'sortBy') : 'NEWEST';
    const hasClusterId = this.hasOwn(query, 'clusterId');
    const clusterId = hasClusterId ? this.parseNonEmptyFilterStrict(query?.clusterId, 'clusterId') : '';
    const listingTopics = this.normalizeStringArray(query?.listingTopics ?? query?.listingTopic)
      .map((v: any) => String(v || '').trim().toUpperCase())
      .filter((v: any) => v.length > 0);
    const ipcList = this.normalizeStringArray(query?.ipc)
      .map((v: any) => String(v || '').trim().toUpperCase())
      .filter((v: any) => v.length > 0);
    const locList = this.normalizeStringArray(query?.loc ?? query?.locarno)
      .map((v: any) => String(v || '').trim().toUpperCase())
      .filter((v: any) => v.length > 0);

    const parseStrictQueryIntFilter = (primaryKey: string, fallbackKey?: string) => {
      const hasPrimary = this.hasOwn(query, primaryKey);
      const hasFallback = fallbackKey ? this.hasOwn(query, fallbackKey) : false;
      if (!hasPrimary && !hasFallback) return undefined;
      const key = hasPrimary ? primaryKey : (fallbackKey as string);
      const raw = hasPrimary ? query?.[primaryKey] : query?.[fallbackKey as string];
      const parsed = this.parseOptionalInt(raw, key, 0);
      if (parsed === undefined) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: `${key} is invalid` });
      }
      return parsed;
    };

    const priceMin = parseStrictQueryIntFilter('priceMin', 'priceMinFen');
    const priceMax = parseStrictQueryIntFilter('priceMax', 'priceMaxFen');
    const depositMin = parseStrictQueryIntFilter('depositMin', 'depositMinFen');
    const depositMax = parseStrictQueryIntFilter('depositMax', 'depositMaxFen');
    const transferCountMin = parseStrictQueryIntFilter('transferCountMin');
    const transferCountMax = parseStrictQueryIntFilter('transferCountMax');

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
      const useFts = qType === 'KEYWORD' || qType === 'AUTO';
      const ftsIds = useFts ? await this.searchListingIdsByFts(q) : [];
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
        if (ftsIds.length > 0) {
          orFilters.push({ id: { in: ftsIds } });
        } else {
          orFilters.push({ title: { contains: q, mode: 'insensitive' } });
          orFilters.push({ summary: { contains: q, mode: 'insensitive' } });
          orFilters.push({ patent: { title: { contains: q, mode: 'insensitive' } } });
          orFilters.push({ patent: { abstract: { contains: q, mode: 'insensitive' } } });
        }
      } else {
        if (ftsIds.length > 0) {
          orFilters.push({ id: { in: ftsIds } });
        }
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

    const include = { patent: { include: { parties: true, classifications: true } }, stats: true };

    if (sortBy == 'RECOMMENDED') {
      const recommendation = await this.config.getRecommendation();
      if (recommendation?.enabled) {
        const rows = await this.prisma.listing.findMany({
          where,
          select: {
            id: true,
            createdAt: true,
            regionCode: true,
            featuredLevel: true,
            featuredRegionCode: true,
            featuredRank: true,
            featuredUntil: true,
            stats: { select: { viewCount: true, favoriteCount: true, consultCount: true } },
          },
        });

        const nowMs = Date.now();
        const scored = rows.map((row: any) => {
          const score = this.computeRecommendationScore(row, recommendation, { regionCode }, nowMs);
          return {
            id: row.id,
            score,
            featuredRank: Number.isFinite(Number(row.featuredRank)) ? Number(row.featuredRank) : Number.MAX_SAFE_INTEGER,
            createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(0),
          };
        });
        const scoreMap = new Map(scored.map((item: any) => [item.id, item.score]));

        scored.sort((a: any, b: any) => {
          if (b.score !== a.score) return b.score - a.score;
          if (a.featuredRank !== b.featuredRank) return a.featuredRank - b.featuredRank;
          return b.createdAt.getTime() - a.createdAt.getTime();
        });

        const total = scored.length;
        const start = (page - 1) * pageSize;
        const pageIds = scored.slice(start, start + pageSize).map((item: any) => item.id);
        const items = pageIds.length
          ? await this.prisma.listing.findMany({
              where: { id: { in: pageIds } },
              include,
            })
          : [];
        const itemMap = new Map(items.map((item: any) => [item.id, item]));

        return {
          items: pageIds
            .map((id) => {
              const item = itemMap.get(id);
              if (!item) return null;
              return this.toListingSummary(item, scoreMap.get(id) ?? null);
            })
            .filter(Boolean),
          page: { page, pageSize, total },
        };
      }
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

  async getMyRecommendations(req: any, query: any) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
    const hasRegionCode = this.hasOwn(query, 'regionCode');
    let regionCode = hasRegionCode ? this.parseRegionCodeFilterStrict(query?.regionCode, 'regionCode') : '';
    if (!regionCode) {
      const user = await this.prisma.user.findUnique({
        where: { id: req.auth.userId },
        select: { regionCode: true },
      });
      regionCode = String(user?.regionCode || '').trim();
    }
    return await this.searchPublic({
      ...(query || {}),
      sortBy: 'RECOMMENDED',
      ...(regionCode ? { regionCode } : {}),
    });
  }
  async getPublicById(req: any, listingId: string) {
    const it = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { patent: { include: { parties: true, classifications: true } }, seller: true, stats: true },
    });
    if (!it) throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
    void this.events.recordView(req, 'LISTING', listingId).catch(() => {});
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
      deliverables: this.normalizeStringArray(it.deliverablesJson),
      expectedCompletionDays: it.expectedCompletionDays ?? null,
      negotiableRangeFen: it.negotiableRangeFen ?? null,
      negotiableRangePercent: it.negotiableRangePercent ?? null,
      negotiableNote: it.negotiableNote ?? null,
      pledgeStatus: it.pledgeStatus ?? null,
      existingLicenseStatus: it.existingLicenseStatus ?? null,
      encumbranceNote: it.encumbranceNote ?? null,
      tradeMode: it.tradeMode,
      licenseMode: it.licenseMode,
      priceType: it.priceType,
      priceAmountFen: it.priceAmount ?? null,
      depositAmountFen: it.depositAmount,
      regionCode: it.regionCode ?? null,
      industryTags: this.normalizeStringArray(it.industryTagsJson),
      listingTopics: this.normalizeStringArray(it.listingTopicsJson),
      clusterId: it.clusterId ?? null,
      featuredLevel: it.featuredLevel,
      featuredRegionCode: it.featuredRegionCode ?? null,
      recommendationScore: null,
      auditStatus: it.auditStatus,
      status: it.status,
      coverUrl: null,
      createdAt: it.createdAt.toISOString(),
      updatedAt: it.updatedAt.toISOString(),
      stats: mapStats(it.stats),
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
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
    const hasChannel = this.hasOwn(payload, 'channel');
    const channel = hasChannel ? this.parseConsultChannelStrict(payload?.channel, 'channel') : 'FORM';
    const recorded = await this.events.recordConsult(req, 'LISTING', listingId);
    if (recorded) {
      await this.prisma.listingConsultEvent.create({
        data: {
          listingId,
          userId: req.auth.userId,
          channel,
        },
      });
    }
    return { ok: true };
  }
}
