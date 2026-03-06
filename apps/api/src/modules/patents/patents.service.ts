import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

type PatentNumberInputType = 'APPLICATION_NO' | 'PATENT_NO' | 'PUBLICATION_NO';

type PatentNormalizeResponseDto = {
  jurisdiction: 'CN';
  inputType: PatentNumberInputType;
  applicationNoNorm?: string;
  applicationNoDisplay?: string;
  publicationNoNorm?: string;
  publicationNoDisplay?: string;
  patentNoNorm?: string;
  patentNoDisplay?: string;
  kindCode?: string;
  patentType?: 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN';
  warnings?: string[];
};

type PatentDto = {
  id: string;
  jurisdiction: 'CN';
  applicationNoNorm: string;
  applicationNoDisplay?: string;
  publicationNoDisplay?: string;
  patentNoDisplay?: string;
  grantPublicationNoDisplay?: string;
  patentType: 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN';
  title: string;
  abstract?: string;
  inventorNames?: string[];
  assigneeNames?: string[];
  applicantNames?: string[];
  filingDate?: string;
  publicationDate?: string;
  grantDate?: string;
  legalStatus?: 'PENDING' | 'GRANTED' | 'EXPIRED' | 'INVALIDATED' | 'UNKNOWN';
  sourcePrimary?: 'USER' | 'ADMIN' | 'PROVIDER';
  sourceUpdatedAt?: string;
  transferCount?: number;
  createdAt: string;
  updatedAt: string;
};

type LegalStatusDto = NonNullable<PatentDto['legalStatus']>;
type PatentTypeDto = PatentDto['patentType'];
type PatentSourcePrimaryDto = NonNullable<PatentDto['sourcePrimary']>;
type PatentPartyRoleDto = 'INVENTOR' | 'ASSIGNEE' | 'APPLICANT';
type PagedPatentDto = {
  items: PatentDto[];
  page: { page: number; pageSize: number; total: number };
};

const PATENT_PARTY_ROLE = {
  INVENTOR: 'INVENTOR',
  ASSIGNEE: 'ASSIGNEE',
  APPLICANT: 'APPLICANT',
} as const;

type PatentParty = {
  role: string;
  name: string;
};

function toHalfWidth(input: string): string {
  let outputText = '';
  for (const character of input) {
    const charCode = character.charCodeAt(0);
    if (charCode === 0x3000) {
      outputText += ' ';
      continue;
    }
    if (charCode >= 0xff01 && charCode <= 0xff5e) {
      outputText += String.fromCharCode(charCode - 0xfee0);
      continue;
    }
    outputText += character;
  }
  return outputText;
}

function cleanRaw(raw: string): string {
  let cleanedValue = toHalfWidth(String(raw || '')).trim();
  cleanedValue = cleanedValue.toUpperCase();
  cleanedValue = cleanedValue.replace(/(专利申请号|专利号|申请号|公开号|公告号|公开\(公告\)号)/g, '');
  cleanedValue = cleanedValue.replace(/[:：]/g, '');
  cleanedValue = cleanedValue.replace(/[\s\-_，,、；;（）()【】\[\]]/g, '');
  return cleanedValue;
}

function digitToPatentType(typeDigit: string): 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN' | null {
  if (typeDigit === '1') return 'INVENTION';
  if (typeDigit === '2') return 'UTILITY_MODEL';
  if (typeDigit === '3') return 'DESIGN';
  return null;
}

function kindToPatentType(kind: string): 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN' | null {
  const normalizedKind = String(kind || '').toUpperCase();
  if (normalizedKind.startsWith('U')) return 'UTILITY_MODEL';
  if (normalizedKind.startsWith('S')) return 'DESIGN';
  if (normalizedKind.startsWith('A') || normalizedKind.startsWith('B')) return 'INVENTION';
  return null;
}

function toApplicationDisplay(normDigits: string): string {
  const digitsOnly = String(normDigits || '').replace(/\D/g, '');
  if (digitsOnly.length < 2) return digitsOnly;
  return `${digitsOnly.slice(0, -1)}.${digitsOnly.slice(-1)}`;
}

@Injectable()
export class PatentsService {
  constructor(private readonly prisma: PrismaService) {}

  ensureAdmin(req: any) {
    if (!req?.auth?.isAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
  }

  private normalizeStringArray(input: unknown): string[] {
    if (Array.isArray(input)) {
      return Array.from(
        new Set(
          input
            .map((value) => String(value || '').trim())
            .filter((value) => value.length > 0),
        ),
      );
    }
    if (typeof input === 'string') {
      return Array.from(
        new Set(
          input
            .split(/[,\n，；;]/g)
            .map((value) => value.trim())
            .filter((value) => value.length > 0),
        ),
      );
    }
    return [];
  }

  private hasOwn(body: unknown, key: string): boolean {
    return body !== null && body !== undefined && Object.prototype.hasOwnProperty.call(body, key);
  }

  private normalizePatentType(value: unknown): PatentTypeDto | undefined {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'INVENTION' || normalized === 'UTILITY_MODEL' || normalized === 'DESIGN') {
      return normalized as PatentTypeDto;
    }
    return undefined;
  }

  private normalizeLegalStatus(value: unknown): LegalStatusDto | undefined {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized) return undefined;
    if (['PENDING', 'GRANTED', 'EXPIRED', 'INVALIDATED', 'UNKNOWN'].includes(normalized)) {
      return normalized as LegalStatusDto;
    }
    throw new BadRequestException({ code: 'BAD_REQUEST', message: 'legalStatus is invalid' });
  }

  private normalizeSourcePrimary(value: unknown): PatentSourcePrimaryDto | undefined {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized) return undefined;
    if (normalized === 'USER' || normalized === 'ADMIN' || normalized === 'PROVIDER') {
      return normalized as PatentSourcePrimaryDto;
    }
    throw new BadRequestException({ code: 'BAD_REQUEST', message: 'sourcePrimary is invalid' });
  }

  private parseDate(value: unknown, fieldName: string): Date | undefined {
    if (value === undefined || value === null || String(value).trim() === '') return undefined;
    const date = new Date(String(value).trim());
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return new Date(date.toISOString().slice(0, 10));
  }

  private parseDateTime(value: unknown, fieldName: string): Date | undefined {
    if (value === undefined || value === null || String(value).trim() === '') return undefined;
    const date = new Date(String(value).trim());
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return date;
  }

  private normalizeApplicationNo(input: unknown): { applicationNoNorm: string; applicationNoDisplay: string } {
    const raw = String(input || '').trim();
    const cleaned = cleanRaw(raw).replace(/^CN/, '').replace(/^ZL/, '').replace(/\./g, '');
    const isValid =
      /^(19\d{2}|20\d{2})[123]\d{7}\d$/.test(cleaned) || /^\d{2}[123]\d{5}\d$/.test(cleaned);
    if (!isValid) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'applicationNoNorm is invalid' });
    }
    return {
      applicationNoNorm: cleaned,
      applicationNoDisplay: toApplicationDisplay(cleaned),
    };
  }

  private toDate(dateValue?: Date | null) {
    return dateValue ? dateValue.toISOString().slice(0, 10) : undefined;
  }

  private toDateTime(dateValue?: Date | null) {
    return dateValue ? dateValue.toISOString() : undefined;
  }

  private mapPatentRecord(record: any): PatentDto {
    const parties = (record?.parties ?? []) as PatentParty[];
    const inventorNames = parties
      .filter((party: PatentParty) => party.role === PATENT_PARTY_ROLE.INVENTOR)
      .map((party: PatentParty) => party.name);
    const assigneeNames = parties
      .filter((party: PatentParty) => party.role === PATENT_PARTY_ROLE.ASSIGNEE)
      .map((party: PatentParty) => party.name);
    const applicantNames = parties
      .filter((party: PatentParty) => party.role === PATENT_PARTY_ROLE.APPLICANT)
      .map((party: PatentParty) => party.name);

    const legal = record?.legalStatus ? String(record.legalStatus).toUpperCase() : '';
    const legalStatus =
      legal && ['PENDING', 'GRANTED', 'EXPIRED', 'INVALIDATED', 'UNKNOWN'].includes(legal)
        ? (legal as LegalStatusDto)
        : undefined;
    const transferCountValue =
      typeof record?.transferCount === 'number'
        ? record.transferCount
        : Number.isFinite(Number(record?.transferCount))
          ? Number(record.transferCount)
          : undefined;

    return {
      id: record.id,
      jurisdiction: 'CN',
      applicationNoNorm: record.applicationNoNorm,
      applicationNoDisplay: record.applicationNoDisplay ?? undefined,
      publicationNoDisplay: record.publicationNoDisplay ?? undefined,
      patentNoDisplay: record.patentNoDisplay ?? undefined,
      grantPublicationNoDisplay: record.grantPublicationNoDisplay ?? undefined,
      patentType: record.patentType,
      title: record.title,
      abstract: record.abstract ?? undefined,
      inventorNames: inventorNames.length ? inventorNames : undefined,
      assigneeNames: assigneeNames.length ? assigneeNames : undefined,
      applicantNames: applicantNames.length ? applicantNames : undefined,
      filingDate: this.toDate(record.filingDate),
      publicationDate: this.toDate(record.publicationDate),
      grantDate: this.toDate(record.grantDate),
      legalStatus,
      sourcePrimary: record.sourcePrimary ?? undefined,
      sourceUpdatedAt: this.toDateTime(record.sourceUpdatedAt),
      transferCount: transferCountValue,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private async syncParties(patentId: string, role: PatentPartyRoleDto, input: unknown) {
    const names = this.normalizeStringArray(input);
    await this.prisma.patentParty.deleteMany({ where: { patentId, role } });
    if (!names.length) return;
    await this.prisma.patentParty.createMany({
      data: names.map((name) => ({ patentId, role, name })),
    });
  }

  normalizeNumber(raw?: string): PatentNormalizeResponseDto {
    const cleanedInput = cleanRaw(String(raw || ''));
    if (!cleanedInput) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'raw 不能为空' });

    const warnings: string[] = [];

    const isPatentNo = cleanedInput.startsWith('ZL') || cleanedInput.startsWith('CNZL');
    const withoutPrefix = cleanedInput.replace(/^CN/, '').replace(/^ZL/, '');
    const cleanedDigits = withoutPrefix.replace(/\./g, '');

    if (
      /^(19\d{2}|20\d{2})[123]\d{7}\d$/.test(cleanedDigits) ||
      /^\d{2}[123]\d{5}\d$/.test(cleanedDigits)
    ) {
      const patentTypeDigit =
        cleanedDigits.startsWith('19') || cleanedDigits.startsWith('20')
          ? cleanedDigits.slice(4, 5)
          : cleanedDigits.slice(2, 3);
      const patentType = digitToPatentType(patentTypeDigit);
      if (!patentType) warnings.push('无法从号码类型位推断专利类型');

      const applicationNoNorm = cleanedDigits;
      const applicationNoDisplay = toApplicationDisplay(cleanedDigits);

      const normalizeResult: PatentNormalizeResponseDto = {
        jurisdiction: 'CN',
        inputType: isPatentNo ? 'PATENT_NO' : 'APPLICATION_NO',
        applicationNoNorm,
        applicationNoDisplay,
        patentType: patentType ?? undefined,
        warnings: warnings.length ? warnings : undefined,
      };

      if (isPatentNo) {
        normalizeResult.patentNoNorm = `ZL${applicationNoNorm}`;
        normalizeResult.patentNoDisplay = `ZL${applicationNoDisplay}`;
      }

      return normalizeResult;
    }

    const publicationMatch = cleanedInput.match(/^(?:CN)?(\d{7,9})([A-Z]\d?)$/);
    if (publicationMatch) {
      const publicationNumber = publicationMatch[1];
      const kindCode = publicationMatch[2];
      const publicationNoNorm = `CN${publicationNumber}${kindCode}`;
      const patentType = kindToPatentType(kindCode);
      if (!patentType) warnings.push('无法从文献种类代码推断专利类型（以数据源为准）');
      return {
        jurisdiction: 'CN',
        inputType: 'PUBLICATION_NO',
        publicationNoNorm,
        publicationNoDisplay: publicationNoNorm,
        kindCode,
        patentType: patentType ?? undefined,
        warnings: warnings.length ? warnings : undefined,
      };
    }

    throw new BadRequestException({ code: 'BAD_REQUEST', message: '无法识别专利号码格式' });
  }

  async adminList(req: any, query: any): Promise<PagedPatentDto> {
    this.ensureAdmin(req);
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(query?.pageSize || 20)));
    const q = String(query?.q || '').trim();
    const patentType = this.normalizePatentType(query?.patentType);
    const legalStatus = this.normalizeLegalStatus(query?.legalStatus);

    const where: any = {};
    if (patentType) where.patentType = patentType;
    if (legalStatus) where.legalStatus = legalStatus;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { applicationNoNorm: { contains: q, mode: 'insensitive' } },
        { applicationNoDisplay: { contains: q, mode: 'insensitive' } },
        { publicationNoDisplay: { contains: q, mode: 'insensitive' } },
        { patentNoDisplay: { contains: q, mode: 'insensitive' } },
        { parties: { some: { name: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.patent.findMany({
        where,
        include: { parties: true },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.patent.count({ where }),
    ]);

    return {
      items: items.map((item) => this.mapPatentRecord(item)),
      page: { page, pageSize, total },
    };
  }

  async adminCreate(req: any, body: any): Promise<PatentDto> {
    this.ensureAdmin(req);
    const normalizedNo = this.normalizeApplicationNo(body?.applicationNoNorm || body?.applicationNoDisplay);
    const patentType = this.normalizePatentType(body?.patentType);
    if (!patentType) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'patentType is required' });
    }
    const title = String(body?.title || '').trim();
    if (!title) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'title is required' });
    }
    const hasJurisdiction = this.hasOwn(body, 'jurisdiction');
    const jurisdiction = hasJurisdiction ? String(body?.jurisdiction ?? '').trim().toUpperCase() : 'CN';
    if (jurisdiction !== 'CN') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'only CN jurisdiction is supported' });
    }

    const legalStatus = this.normalizeLegalStatus(body?.legalStatus);
    const hasSourcePrimary = this.hasOwn(body, 'sourcePrimary');
    let sourcePrimary: PatentSourcePrimaryDto = 'ADMIN';
    if (hasSourcePrimary) {
      const parsedSourcePrimary = this.normalizeSourcePrimary(body?.sourcePrimary);
      if (!parsedSourcePrimary) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'sourcePrimary is invalid' });
      }
      sourcePrimary = parsedSourcePrimary;
    }
    const sourceUpdatedAt = this.parseDateTime(body?.sourceUpdatedAt, 'sourceUpdatedAt') ?? new Date();
    const filingDate = this.parseDate(body?.filingDate, 'filingDate');
    const publicationDate = this.parseDate(body?.publicationDate, 'publicationDate');
    const grantDate = this.parseDate(body?.grantDate, 'grantDate');

    const upserted = await this.prisma.patent.upsert({
      where: {
        jurisdiction_applicationNoNorm: {
          jurisdiction,
          applicationNoNorm: normalizedNo.applicationNoNorm,
        },
      },
      create: {
        jurisdiction,
        applicationNoNorm: normalizedNo.applicationNoNorm,
        applicationNoDisplay: String(body?.applicationNoDisplay || normalizedNo.applicationNoDisplay),
        patentType,
        title,
        abstract: body?.abstract ? String(body.abstract) : null,
        filingDate: filingDate ?? null,
        publicationDate: publicationDate ?? null,
        grantDate: grantDate ?? null,
        legalStatus: legalStatus ?? null,
        sourcePrimary,
        sourceUpdatedAt,
      },
      update: {
        applicationNoDisplay: String(body?.applicationNoDisplay || normalizedNo.applicationNoDisplay),
        patentType,
        title,
        abstract: body?.abstract ? String(body.abstract) : null,
        filingDate: filingDate ?? undefined,
        publicationDate: publicationDate ?? undefined,
        grantDate: grantDate ?? undefined,
        legalStatus: legalStatus ?? undefined,
        sourcePrimary,
        sourceUpdatedAt,
      },
    });

    if (this.hasOwn(body, 'inventorNames')) {
      await this.syncParties(upserted.id, 'INVENTOR', body?.inventorNames);
    }
    if (this.hasOwn(body, 'assigneeNames')) {
      await this.syncParties(upserted.id, 'ASSIGNEE', body?.assigneeNames);
    }
    if (this.hasOwn(body, 'applicantNames')) {
      await this.syncParties(upserted.id, 'APPLICANT', body?.applicantNames);
    }

    return await this.getPatentById(upserted.id);
  }

  async adminGetById(req: any, patentId: string): Promise<PatentDto> {
    this.ensureAdmin(req);
    return await this.getPatentById(patentId);
  }

  async adminUpdate(req: any, patentId: string, body: any): Promise<PatentDto> {
    this.ensureAdmin(req);
    const existing = await this.prisma.patent.findUnique({ where: { id: String(patentId) } });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '专利不存在' });
    }

    const patch: any = {};
    if (this.hasOwn(body, 'applicationNoDisplay')) {
      const value = String(body?.applicationNoDisplay || '').trim();
      patch.applicationNoDisplay = value || null;
    }
    if (this.hasOwn(body, 'patentType')) {
      const patentType = this.normalizePatentType(body?.patentType);
      if (!patentType) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'patentType is invalid' });
      }
      patch.patentType = patentType;
    }
    if (this.hasOwn(body, 'title')) {
      const title = String(body?.title || '').trim();
      if (!title) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'title is required' });
      }
      patch.title = title;
    }
    if (this.hasOwn(body, 'abstract')) {
      const abstract = String(body?.abstract || '').trim();
      patch.abstract = abstract || null;
    }
    if (this.hasOwn(body, 'filingDate')) {
      patch.filingDate = this.parseDate(body?.filingDate, 'filingDate') ?? null;
    }
    if (this.hasOwn(body, 'publicationDate')) {
      patch.publicationDate = this.parseDate(body?.publicationDate, 'publicationDate') ?? null;
    }
    if (this.hasOwn(body, 'grantDate')) {
      patch.grantDate = this.parseDate(body?.grantDate, 'grantDate') ?? null;
    }
    if (this.hasOwn(body, 'legalStatus')) {
      patch.legalStatus = this.normalizeLegalStatus(body?.legalStatus) ?? null;
    }
    if (this.hasOwn(body, 'sourcePrimary')) {
      const sourcePrimary = this.normalizeSourcePrimary(body?.sourcePrimary);
      if (!sourcePrimary) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'sourcePrimary is invalid' });
      }
      patch.sourcePrimary = sourcePrimary;
    }
    if (this.hasOwn(body, 'sourceUpdatedAt')) {
      patch.sourceUpdatedAt = this.parseDateTime(body?.sourceUpdatedAt, 'sourceUpdatedAt') ?? null;
    }

    if (Object.keys(patch).length > 0) {
      await this.prisma.patent.update({ where: { id: existing.id }, data: patch });
    }
    if (this.hasOwn(body, 'inventorNames')) {
      await this.syncParties(existing.id, 'INVENTOR', body?.inventorNames);
    }
    if (this.hasOwn(body, 'assigneeNames')) {
      await this.syncParties(existing.id, 'ASSIGNEE', body?.assigneeNames);
    }
    if (this.hasOwn(body, 'applicantNames')) {
      await this.syncParties(existing.id, 'APPLICANT', body?.applicantNames);
    }

    return await this.getPatentById(existing.id);
  }

  async getPatentById(patentId: string): Promise<PatentDto> {
    const patentRecord = await this.prisma.patent.findUnique({
      where: { id: String(patentId) },
      include: { parties: true },
    });
    if (!patentRecord) throw new NotFoundException({ code: 'NOT_FOUND', message: '专利不存在' });
    return this.mapPatentRecord(patentRecord);
  }
}
