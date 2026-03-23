import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import crypto from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

import { PrismaService } from '../../common/prisma/prisma.service';
import { FilesService } from '../files/files.service';

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
  ownerUserId?: string;
  ownerClaimedAt?: string;
  ownerClaimSource?: PatentOwnerClaimSource;
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
type PatentJobStatus = 'PENDING' | 'RUNNING' | 'PAUSED' | 'SUCCEEDED' | 'FAILED';
type PatentImportDuplicatePolicy = 'SKIP' | 'OVERWRITE';
type PatentImportRowStatus = 'PENDING' | 'VALID' | 'INVALID' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';
type ConsultationRouting = 'PLATFORM' | 'OWNER';
type ListingTradeMode = 'ASSIGNMENT' | 'LICENSE';
type LicenseMode = 'EXCLUSIVE' | 'SOLE' | 'NON_EXCLUSIVE';
type PriceType = 'FIXED' | 'NEGOTIABLE';
type ListingTopic = 'HIGH_TECH_RETIRED' | 'SLEEPING' | 'AWARD_WINNING' | 'OPEN_LICENSE';
type AuditStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ListingStatus = 'DRAFT' | 'ACTIVE' | 'OFF_SHELF' | 'SOLD';
type PatentClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type PatentOwnerClaimSource = 'PLATFORM_IMPORT' | 'USER_CLAIM' | 'ADMIN_ASSIGN';
type PatentImportListingDefaults = {
  enabled?: boolean;
  consultationRouting?: ConsultationRouting;
  sellerUserId?: string;
  tradeMode?: ListingTradeMode;
  licenseMode?: LicenseMode;
  priceType?: PriceType;
  priceAmountFen?: number;
  depositAmountFen?: number;
  regionCode?: string;
  listingTopics?: ListingTopic[];
  industryTags?: string[];
  auditStatus?: AuditStatus;
  status?: ListingStatus;
};
type PatentImportDefaults = {
  listing?: PatentImportListingDefaults;
};
type PatentImportJobDto = {
  id: string;
  operatorUserId: string;
  fileId: string;
  duplicatePolicy: PatentImportDuplicatePolicy;
  defaults?: PatentImportDefaults;
  status: PatentJobStatus;
  totalCount: number;
  validCount: number;
  invalidCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  failRate: number;
  validatedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  pausedAt?: string | null;
  errorFileId?: string | null;
  createdAt: string;
  updatedAt: string;
};
type PatentImportJobRowDto = {
  id: string;
  jobId: string;
  rowNo: number;
  status: PatentImportRowStatus;
  raw?: Record<string, any>;
  normalized?: Record<string, any> | null;
  patentId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  processedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};
type PagedPatentImportJobs = {
  items: PatentImportJobDto[];
  page: { page: number; pageSize: number; total: number };
};
type PagedPatentImportJobRows = {
  items: PatentImportJobRowDto[];
  page: { page: number; pageSize: number; total: number };
};
type PatentClaimRequestDto = {
  id: string;
  patentId: string;
  applicantUserId: string;
  status: PatentClaimStatus;
  claimReason?: string | null;
  evidenceFileIds?: string[];
  reviewerUserId?: string | null;
  reviewComment?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};
type PagedPatentClaimRequests = {
  items: PatentClaimRequestDto[];
  page: { page: number; pageSize: number; total: number };
};
type PatentListingGenerateResultDto = {
  totalCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  rows: Array<{
    patentId: string;
    listingId?: string | null;
    status: 'SUCCEEDED' | 'FAILED' | 'SKIPPED';
    errorCode?: string | null;
    errorMessage?: string | null;
  }>;
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
const PATENT_JOB_STATUS_SET = new Set<PatentJobStatus>(['PENDING', 'RUNNING', 'PAUSED', 'SUCCEEDED', 'FAILED']);
const PATENT_IMPORT_DUPLICATE_POLICY_SET = new Set<PatentImportDuplicatePolicy>(['SKIP', 'OVERWRITE']);
const PATENT_IMPORT_ROW_STATUS_SET = new Set<PatentImportRowStatus>(['PENDING', 'VALID', 'INVALID', 'SUCCEEDED', 'FAILED', 'SKIPPED']);
const PATENT_IMPORT_MAX_ROWS = 5000;
const PATENT_CLAIM_STATUS_SET = new Set<PatentClaimStatus>(['PENDING', 'APPROVED', 'REJECTED']);
const CONSULTATION_ROUTING_SET = new Set<ConsultationRouting>(['PLATFORM', 'OWNER']);
const LISTING_TOPIC_VALUE_SET = new Set<ListingTopic>([
  'HIGH_TECH_RETIRED',
  'SLEEPING',
  'AWARD_WINNING',
  'OPEN_LICENSE',
]);
const ORDER_BLOCKING_STATUS_SET = new Set<string>([
  'DEPOSIT_PENDING',
  'DEPOSIT_PAID',
  'WAIT_FINAL_PAYMENT',
  'FINAL_PAID_ESCROW',
  'READY_TO_SETTLE',
  'REFUNDING',
]);

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
  cleanedValue = cleanedValue.replace(/(\u4e13\u5229\u7533\u8bf7\u53f7|\u4e13\u5229\u53f7|\u7533\u8bf7\u53f7|\u516c\u5f00\u53f7|\u516c\u544a\u53f7|\u516c\u5f00\(\u516c\u544a\)\u53f7)/g, '');
  cleanedValue = cleanedValue.replace(/[:：]/g, '');
  cleanedValue = cleanedValue.replace(/[\s\-_，。；;（）()\[\]【】]/g, '');
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
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly files?: FilesService,
  ) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  ensureAdmin(req: any) {
    if (!req?.auth?.isAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
  }

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
  }

  private parseUuidStrict(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw || !UUID_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseUuidArrayStrict(value: unknown, fieldName: string, opts?: { min?: number; max?: number }): string[] {
    const list = Array.isArray(value) ? value : [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of list) {
      const id = this.parseUuidStrict(item, fieldName);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    const min = opts?.min ?? 0;
    const max = opts?.max ?? 1000;
    if (out.length < min || out.length > max) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return out;
  }

  private parseBooleanStrict(value: unknown, fieldName: string): boolean {
    if (value === true || value === false) return value;
    const raw = String(value ?? '').trim().toLowerCase();
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
    throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
  }

  private parseNonEmptyStringStrict(value: unknown, fieldName: string): string {
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
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || (min !== undefined && parsed < min)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private normalizeConsultationRouting(value: unknown): ConsultationRouting | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw || !CONSULTATION_ROUTING_SET.has(raw as ConsultationRouting)) return undefined;
    return raw as ConsultationRouting;
  }

  private parseConsultationRoutingStrict(value: unknown, fieldName: string): ConsultationRouting {
    const normalized = this.normalizeConsultationRouting(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private normalizePatentImportDuplicatePolicy(value: unknown): PatentImportDuplicatePolicy | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw || !PATENT_IMPORT_DUPLICATE_POLICY_SET.has(raw as PatentImportDuplicatePolicy)) return undefined;
    return raw as PatentImportDuplicatePolicy;
  }

  private parsePatentImportDuplicatePolicyStrict(value: unknown, fieldName: string): PatentImportDuplicatePolicy {
    const normalized = this.normalizePatentImportDuplicatePolicy(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private normalizePatentJobStatus(value: unknown): PatentJobStatus | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw || !PATENT_JOB_STATUS_SET.has(raw as PatentJobStatus)) return undefined;
    return raw as PatentJobStatus;
  }

  private parsePatentJobStatusStrict(value: unknown, fieldName: string): PatentJobStatus {
    const normalized = this.normalizePatentJobStatus(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private normalizePatentImportRowStatus(value: unknown): PatentImportRowStatus | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw || !PATENT_IMPORT_ROW_STATUS_SET.has(raw as PatentImportRowStatus)) return undefined;
    return raw as PatentImportRowStatus;
  }

  private normalizePatentClaimStatus(value: unknown): PatentClaimStatus | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw || !PATENT_CLAIM_STATUS_SET.has(raw as PatentClaimStatus)) return undefined;
    return raw as PatentClaimStatus;
  }

  private normalizeListingTradeMode(value: unknown): ListingTradeMode | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if (raw === 'ASSIGNMENT' || raw === 'LICENSE') return raw as ListingTradeMode;
    return undefined;
  }

  private parseListingTradeModeStrict(value: unknown, fieldName: string): ListingTradeMode {
    const normalized = this.normalizeListingTradeMode(value);
    if (!normalized) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    return normalized;
  }

  private normalizeLicenseMode(value: unknown): LicenseMode | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if (raw === 'EXCLUSIVE' || raw === 'SOLE' || raw === 'NON_EXCLUSIVE') return raw as LicenseMode;
    return undefined;
  }

  private parseLicenseModeStrict(value: unknown, fieldName: string): LicenseMode {
    const normalized = this.normalizeLicenseMode(value);
    if (!normalized) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    return normalized;
  }

  private normalizePriceType(value: unknown): PriceType | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if (raw === 'FIXED' || raw === 'NEGOTIABLE') return raw as PriceType;
    return undefined;
  }

  private parsePriceTypeStrict(value: unknown, fieldName: string): PriceType {
    const normalized = this.normalizePriceType(value);
    if (!normalized) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    return normalized;
  }

  private normalizeListingTopic(value: unknown): ListingTopic | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw || !LISTING_TOPIC_VALUE_SET.has(raw as ListingTopic)) return undefined;
    return raw as ListingTopic;
  }

  private normalizeListingTopics(input: unknown): ListingTopic[] {
    const values = this.normalizeStringArray(input)
      .map((item) => this.normalizeListingTopic(item))
      .filter((item): item is ListingTopic => Boolean(item));
    return Array.from(new Set(values));
  }

  private normalizeAuditStatus(value: unknown): AuditStatus | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if (raw === 'PENDING' || raw === 'APPROVED' || raw === 'REJECTED') return raw as AuditStatus;
    return undefined;
  }

  private parseAuditStatusStrict(value: unknown, fieldName: string): AuditStatus {
    const normalized = this.normalizeAuditStatus(value);
    if (!normalized) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    return normalized;
  }

  private normalizeListingStatus(value: unknown): ListingStatus | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if (raw === 'DRAFT' || raw === 'ACTIVE' || raw === 'OFF_SHELF' || raw === 'SOLD') return raw as ListingStatus;
    return undefined;
  }

  private parseListingStatusStrict(value: unknown, fieldName: string): ListingStatus {
    const normalized = this.normalizeListingStatus(value);
    if (!normalized) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    return normalized;
  }

  private getIdempotencyKey(req: any) {
    const raw = req?.headers?.['idempotency-key'];
    if (!raw) return '';
    return String(raw).trim();
  }

  private async withIdempotency<T>(req: any, scope: string, handler: () => Promise<T>): Promise<T> {
    const key = this.getIdempotencyKey(req);
    if (!key) return await handler();
    const userId = req?.auth?.userId ? String(req.auth.userId) : '';
    if (!userId) return await handler();

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key_scope_userId: { key, scope, userId } },
    });
    if (existing) {
      if (existing.status === 'COMPLETED' && existing.responseJson != null) {
        return existing.responseJson as T;
      }
      throw new ConflictException({ code: 'CONFLICT', message: 'idempotency key already used' });
    }

    const record = await this.prisma.idempotencyKey.create({
      data: { key, scope, userId, status: 'IN_PROGRESS' },
    });
    try {
      const result = await handler();
      await this.prisma.idempotencyKey.update({
        where: { id: record.id },
        data: { status: 'COMPLETED', responseJson: result as any },
      });
      return result;
    } catch (error) {
      await this.prisma.idempotencyKey.delete({ where: { id: record.id } });
      throw error;
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
            .split(/[,\n锛岋紱;]/g)
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

  private parsePositiveIntStrict(value: unknown, fieldName: string): number {
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
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

  private parsePatentTypeStrict(value: unknown, fieldName: string): PatentTypeDto {
    const patentType = this.normalizePatentType(value);
    if (!patentType) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return patentType;
  }

  private parseLegalStatusStrict(value: unknown, fieldName: string): LegalStatusDto {
    const legalStatus = this.normalizeLegalStatus(value);
    if (!legalStatus) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return legalStatus;
  }

  private parseNullableLegalStatusStrict(value: unknown, fieldName: string): LegalStatusDto | null {
    if (value === null) return null;
    if (typeof value === 'string' && value.trim() === '') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const legalStatus = this.normalizeLegalStatus(value);
    if (!legalStatus) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return legalStatus;
  }

  private parseNullableNonEmptyStringStrict(value: unknown, fieldName: string): string | null {
    if (value === null) return null;
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseDate(value: unknown, fieldName: string): Date | undefined {
    if (value === undefined || value === null) return undefined;
    if (String(value).trim() === '') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const date = new Date(String(value).trim());
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return new Date(date.toISOString().slice(0, 10));
  }

  private parseDateTime(value: unknown, fieldName: string): Date | undefined {
    if (value === undefined || value === null) return undefined;
    if (String(value).trim() === '') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const date = new Date(String(value).trim());
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return date;
  }

  private parseUuidParam(value: string, fieldName: string): string {
    const raw = String(value || '').trim();
    if (!raw || !UUID_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
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
    const rawTransferCount =
      typeof record?.transferCount === 'number'
        ? record.transferCount
        : Number.isFinite(Number(record?.transferCount))
          ? Number(record.transferCount)
          : undefined;
    const transferCountValue =
      typeof rawTransferCount === 'number' && Number.isSafeInteger(rawTransferCount) && rawTransferCount >= 0
        ? rawTransferCount
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
      ownerUserId: record.ownerUserId ?? undefined,
      ownerClaimedAt: this.toDateTime(record.ownerClaimedAt),
      ownerClaimSource: record.ownerClaimSource ?? undefined,
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
    if (!cleanedInput) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'raw 涓嶈兘涓虹┖' });

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
      if (!patentType) warnings.push('鏃犳硶浠庡彿鐮佺被鍨嬩綅鎺ㄦ柇涓撳埄绫诲瀷');

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
      if (!patentType) warnings.push('cannot infer patent type from publication kind code');
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

    throw new BadRequestException({ code: 'BAD_REQUEST', message: '鏃犳硶璇嗗埆涓撳埄鍙风爜鏍煎紡' });
  }

  async adminList(req: any, query: any): Promise<PagedPatentDto> {
    this.ensureAdmin(req);
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(100, pageSizeInput);
    const q = String(query?.q || '').trim();
    const hasPatentType = this.hasOwn(query, 'patentType');
    const hasLegalStatus = this.hasOwn(query, 'legalStatus');
    const hasSourcePrimary = this.hasOwn(query, 'sourcePrimary');
    const patentType = hasPatentType ? this.parsePatentTypeStrict(query?.patentType, 'patentType') : undefined;
    const legalStatus = hasLegalStatus ? this.parseLegalStatusStrict(query?.legalStatus, 'legalStatus') : undefined;
    const sourcePrimary = hasSourcePrimary ? this.normalizeSourcePrimary(query?.sourcePrimary) : undefined;

    const where: any = {};
    if (patentType) where.patentType = patentType;
    if (legalStatus) where.legalStatus = legalStatus;
    if (sourcePrimary) where.sourcePrimary = sourcePrimary;
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
    const hasApplicationNoDisplay = this.hasOwn(body, 'applicationNoDisplay');
    const applicationNoDisplay = hasApplicationNoDisplay
      ? this.parseNullableNonEmptyStringStrict(body?.applicationNoDisplay, 'applicationNoDisplay')
      : undefined;
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

    const hasLegalStatus = this.hasOwn(body, 'legalStatus');
    const legalStatus = hasLegalStatus ? this.parseNullableLegalStatusStrict(body?.legalStatus, 'legalStatus') : undefined;
    const hasSourcePrimary = this.hasOwn(body, 'sourcePrimary');
    let sourcePrimary: PatentSourcePrimaryDto = 'ADMIN';
    if (hasSourcePrimary) {
      const parsedSourcePrimary = this.normalizeSourcePrimary(body?.sourcePrimary);
      if (!parsedSourcePrimary) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'sourcePrimary is invalid' });
      }
      sourcePrimary = parsedSourcePrimary;
    }
    const hasSourceUpdatedAt = this.hasOwn(body, 'sourceUpdatedAt');
    const sourceUpdatedAt = this.parseDateTime(body?.sourceUpdatedAt, 'sourceUpdatedAt') ?? new Date();
    const hasFilingDate = this.hasOwn(body, 'filingDate');
    const filingDate = hasFilingDate ? this.parseDate(body?.filingDate, 'filingDate') : undefined;
    const hasPublicationDate = this.hasOwn(body, 'publicationDate');
    const publicationDate = hasPublicationDate ? this.parseDate(body?.publicationDate, 'publicationDate') : undefined;
    const hasGrantDate = this.hasOwn(body, 'grantDate');
    const grantDate = hasGrantDate ? this.parseDate(body?.grantDate, 'grantDate') : undefined;
    const hasAbstract = this.hasOwn(body, 'abstract');
    const abstract = hasAbstract ? String(body?.abstract ?? '').trim() : undefined;

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
        applicationNoDisplay: applicationNoDisplay ?? normalizedNo.applicationNoDisplay,
        patentType,
        title,
        abstract: abstract === undefined ? null : abstract || null,
        filingDate: filingDate ?? null,
        publicationDate: publicationDate ?? null,
        grantDate: grantDate ?? null,
        legalStatus: legalStatus === undefined ? null : legalStatus,
        sourcePrimary,
        sourceUpdatedAt,
      },
      update: {
        applicationNoDisplay: hasApplicationNoDisplay ? applicationNoDisplay : undefined,
        patentType,
        title,
        abstract: hasAbstract ? abstract || null : undefined,
        filingDate: hasFilingDate ? (filingDate ?? null) : undefined,
        publicationDate: hasPublicationDate ? (publicationDate ?? null) : undefined,
        grantDate: hasGrantDate ? (grantDate ?? null) : undefined,
        legalStatus: hasLegalStatus ? legalStatus : undefined,
        sourcePrimary: hasSourcePrimary ? sourcePrimary : undefined,
        sourceUpdatedAt: hasSourceUpdatedAt ? sourceUpdatedAt : undefined,
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
    const normalizedPatentId = this.parseUuidParam(patentId, 'patentId');
    return await this.getPatentById(normalizedPatentId);
  }

  async adminUpdate(req: any, patentId: string, body: any): Promise<PatentDto> {
    this.ensureAdmin(req);
    const normalizedPatentId = this.parseUuidParam(patentId, 'patentId');
    const existing = await this.prisma.patent.findUnique({ where: { id: normalizedPatentId } });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'patent not found' });
    }

    const patch: any = {};
    if (this.hasOwn(body, 'applicationNoDisplay')) {
      patch.applicationNoDisplay = this.parseNullableNonEmptyStringStrict(body?.applicationNoDisplay, 'applicationNoDisplay');
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
      patch.legalStatus = this.parseNullableLegalStatusStrict(body?.legalStatus, 'legalStatus');
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
    const normalizedPatentId = this.parseUuidParam(patentId, 'patentId');
    const patentRecord = await this.prisma.patent.findUnique({
      where: { id: normalizedPatentId },
      include: { parties: true },
    });
    if (!patentRecord) throw new NotFoundException({ code: 'NOT_FOUND', message: 'patent not found' });
    return this.mapPatentRecord(patentRecord);
  }

  private resolveBaseUrl(req?: any) {
    return (
      (process.env.BASE_URL && String(process.env.BASE_URL)) ||
      (req?.protocol && req?.get ? `${req.protocol}://${req.get('host')}` : 'http://127.0.0.1:3000')
    );
  }

  private static escapeCsv(value: any) {
    if (value === null || value === undefined) return '';
    const raw = String(value);
    if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  }

  private async createOwnedCsvFile(params: {
    ownerUserId: string;
    req?: any;
    filenamePrefix: string;
    headers: string[];
    rows: Array<Array<string | number | null | undefined>>;
  }): Promise<string | null> {
    if (!params.rows.length) return null;
    const contentLines: string[] = [];
    contentLines.push(params.headers.map((h) => PatentsService.escapeCsv(h)).join(','));
    for (const row of params.rows) {
      contentLines.push(row.map((v) => PatentsService.escapeCsv(v)).join(','));
    }
    const content = `${contentLines.join('\n')}\n`;
    const fileId = crypto.randomUUID();
    const fileName = `${params.filenamePrefix}-${fileId}.csv`;
    const filePath = path.resolve(UPLOAD_DIR, fileName);
    writeFileSync(filePath, content, 'utf8');

    if (this.files?.isObjectStorageEnabled()) {
      await this.files.uploadToObjectStorage({
        key: fileName,
        filePath,
        contentType: 'text/csv',
      });
    }

    const baseUrl = this.resolveBaseUrl(params.req);
    if (this.files) {
      const created = await this.files.createUserFile({
        fileId,
        userId: params.ownerUserId,
        filename: fileName,
        mimeType: 'text/csv',
        sizeBytes: Buffer.byteLength(content, 'utf8'),
        baseUrl,
      });
      return created.id;
    }

    await this.prisma.file.create({
      data: {
        id: fileId,
        url: `${baseUrl}/files/${fileId}`,
        fileName,
        mimeType: 'text/csv',
        sizeBytes: Buffer.byteLength(content, 'utf8'),
        ownerScope: 'USER',
        ownerId: params.ownerUserId,
      },
    });
    return fileId;
  }

  private async readFileBufferById(fileId: string): Promise<Buffer> {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'file not found' });
    }
    const fileName = String(file.fileName || '').trim();
    if (!fileName) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'file is invalid' });
    }
    const fromService = this.files ? await this.files.getFileBuffer(fileName) : null;
    if (fromService && fromService.length > 0) {
      return fromService;
    }
    try {
      const local = readFileSync(path.resolve(UPLOAD_DIR, path.basename(fileName)));
      if (!local.length) throw new Error('empty');
      return local;
    } catch {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'file not found' });
    }
  }

  private normalizeWorkbookHeader(value: unknown): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[()\[\]{}锛堬級]/g, '')
      .replace(/[\/\\_\-\s]/g, '');
  }

  private pickWorkbookValue(row: Record<string, any>, aliases: string[]): any {
    const map = new Map<string, any>();
    for (const [k, v] of Object.entries(row || {})) {
      map.set(this.normalizeWorkbookHeader(k), v);
    }
    for (const alias of aliases) {
      const value = map.get(this.normalizeWorkbookHeader(alias));
      if (value === undefined || value === null) continue;
      if (typeof value === 'string' && !value.trim()) continue;
      return value;
    }
    return undefined;
  }

  private splitWorkbookTextList(raw: unknown): string[] {
    if (Array.isArray(raw)) {
      return raw
        .map((item) => String(item || '').trim())
        .filter(Boolean);
    }
    const text = String(raw || '').trim();
    if (!text) return [];
    return text
      .split(/[\n,;，；、]+/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private parseWorkbookDate(value: unknown, fieldName: string): Date | undefined {
    if (value === undefined || value === null) return undefined;
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
      }
      return new Date(value.toISOString().slice(0, 10));
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (!parsed || !parsed.y || !parsed.m || !parsed.d) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
      }
      const utcDate = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      return new Date(utcDate.toISOString().slice(0, 10));
    }
    const raw = String(value || '').trim();
    if (!raw) return undefined;
    const normalized = raw
      .replace(/[年/.]/g, '-')
      .replace(/月/g, '-')
      .replace(/日/g, '')
      .trim();
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return new Date(date.toISOString().slice(0, 10));
  }

  private normalizePatentTypeFromWorkbook(value: unknown): PatentTypeDto | undefined {
    if (value === undefined || value === null) return undefined;
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return undefined;
    if (raw === 'INVENTION' || raw.includes('鍙戞槑')) return 'INVENTION';
    if (raw === 'UTILITY_MODEL' || raw.includes('瀹炵敤鏂板瀷')) return 'UTILITY_MODEL';
    if (raw === 'DESIGN' || raw.includes('澶栬')) return 'DESIGN';
    return this.normalizePatentType(raw);
  }

  private normalizeLegalStatusFromWorkbook(value: unknown): LegalStatusDto | undefined {
    if (value === undefined || value === null) return undefined;
    const raw = String(value || '').trim();
    if (!raw) return undefined;
    const upper = raw.toUpperCase();
    if (upper === 'PENDING' || raw.includes('审中') || raw.includes('公开') || raw.includes('受理')) return 'PENDING';
    if (upper === 'GRANTED' || raw.includes('鏈夋晥') || raw.includes('鎺堟潈') || raw.includes('缁存寔')) return 'GRANTED';
    if (upper === 'EXPIRED' || raw.includes('澶辨晥') || raw.includes('缁堟') || raw.includes('灞婃弧')) return 'EXPIRED';
    if (upper === 'INVALIDATED' || raw.includes('鏃犳晥')) return 'INVALIDATED';
    if (upper === 'UNKNOWN') return 'UNKNOWN';
    return 'UNKNOWN';
  }

  private parseImportDefaults(body: any): PatentImportDefaults {
    const defaultsRaw = body?.defaults && typeof body.defaults === 'object' ? body.defaults : {};
    const listingRaw = defaultsRaw?.listing && typeof defaultsRaw.listing === 'object' ? defaultsRaw.listing : {};
    const listing: PatentImportListingDefaults = {
      enabled: true,
      consultationRouting: 'PLATFORM',
      tradeMode: 'ASSIGNMENT',
      priceType: 'NEGOTIABLE',
      depositAmountFen: 0,
      listingTopics: [],
      industryTags: [],
      auditStatus: 'APPROVED',
      status: 'ACTIVE',
    };
    if (this.hasOwn(listingRaw, 'enabled')) {
      listing.enabled = this.parseBooleanStrict(listingRaw?.enabled, 'defaults.listing.enabled');
    }
    if (this.hasOwn(listingRaw, 'consultationRouting')) {
      listing.consultationRouting = this.parseConsultationRoutingStrict(
        listingRaw?.consultationRouting,
        'defaults.listing.consultationRouting',
      );
    }
    if (this.hasOwn(listingRaw, 'sellerUserId')) {
      listing.sellerUserId = this.parseNonEmptyStringStrict(listingRaw?.sellerUserId, 'defaults.listing.sellerUserId');
    }
    if (this.hasOwn(listingRaw, 'tradeMode')) {
      listing.tradeMode = this.parseListingTradeModeStrict(listingRaw?.tradeMode, 'defaults.listing.tradeMode');
    }
    if (this.hasOwn(listingRaw, 'licenseMode')) {
      listing.licenseMode = this.parseLicenseModeStrict(listingRaw?.licenseMode, 'defaults.listing.licenseMode');
    }
    if (this.hasOwn(listingRaw, 'priceType')) {
      listing.priceType = this.parsePriceTypeStrict(listingRaw?.priceType, 'defaults.listing.priceType');
    }
    if (this.hasOwn(listingRaw, 'priceAmountFen')) {
      listing.priceAmountFen = this.parseOptionalInt(listingRaw?.priceAmountFen, 'defaults.listing.priceAmountFen', 0);
    }
    if (this.hasOwn(listingRaw, 'depositAmountFen')) {
      listing.depositAmountFen = this.parseOptionalInt(listingRaw?.depositAmountFen, 'defaults.listing.depositAmountFen', 0);
    }
    if (this.hasOwn(listingRaw, 'regionCode')) {
      listing.regionCode = this.parseNonEmptyStringStrict(listingRaw?.regionCode, 'defaults.listing.regionCode');
    }
    if (this.hasOwn(listingRaw, 'listingTopics')) {
      listing.listingTopics = this.normalizeListingTopics(listingRaw?.listingTopics);
    }
    if (this.hasOwn(listingRaw, 'industryTags')) {
      listing.industryTags = this.normalizeStringArray(listingRaw?.industryTags);
    }
    if (this.hasOwn(listingRaw, 'auditStatus')) {
      listing.auditStatus = this.parseAuditStatusStrict(listingRaw?.auditStatus, 'defaults.listing.auditStatus');
    }
    if (this.hasOwn(listingRaw, 'status')) {
      listing.status = this.parseListingStatusStrict(listingRaw?.status, 'defaults.listing.status');
    }
    if (listing.tradeMode !== 'LICENSE') {
      listing.licenseMode = undefined;
    }
    if (listing.priceType === 'FIXED' && (listing.priceAmountFen === undefined || listing.priceAmountFen === null)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'defaults.listing.priceAmountFen is required' });
    }
    if (listing.status === 'ACTIVE' && listing.auditStatus !== 'APPROVED') {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'defaults.listing.auditStatus must be APPROVED when status is ACTIVE',
      });
    }
    return { listing };
  }

  private toImportJobDto(it: any): PatentImportJobDto {
    const toIso = (d?: Date | null) => (d ? d.toISOString() : null);
    return {
      id: it.id,
      operatorUserId: it.operatorUserId,
      fileId: it.fileId,
      duplicatePolicy: it.duplicatePolicy,
      defaults: typeof it.defaultsJson === 'object' && it.defaultsJson ? (it.defaultsJson as PatentImportDefaults) : {},
      status: it.status,
      totalCount: Number(it.totalCount || 0),
      validCount: Number(it.validCount || 0),
      invalidCount: Number(it.invalidCount || 0),
      successCount: Number(it.successCount || 0),
      failedCount: Number(it.failedCount || 0),
      skippedCount: Number(it.skippedCount || 0),
      failRate: Number(it.failRate || 0),
      validatedAt: toIso(it.validatedAt),
      startedAt: toIso(it.startedAt),
      finishedAt: toIso(it.finishedAt),
      pausedAt: toIso(it.pausedAt),
      errorFileId: it.errorFileId ?? null,
      createdAt: toIso(it.createdAt) || new Date().toISOString(),
      updatedAt: toIso(it.updatedAt) || new Date().toISOString(),
    };
  }

  private toImportJobRowDto(it: any): PatentImportJobRowDto {
    const toIso = (d?: Date | null) => (d ? d.toISOString() : null);
    return {
      id: it.id,
      jobId: it.jobId,
      rowNo: Number(it.rowNo || 0),
      status: it.status,
      raw: typeof it.rawJson === 'object' && it.rawJson ? it.rawJson : {},
      normalized: typeof it.normalizedJson === 'object' && it.normalizedJson ? it.normalizedJson : null,
      patentId: it.patentId ?? null,
      errorCode: it.errorCode ?? null,
      errorMessage: it.errorMessage ?? null,
      processedAt: toIso(it.processedAt),
      createdAt: toIso(it.createdAt) || new Date().toISOString(),
      updatedAt: toIso(it.updatedAt) || new Date().toISOString(),
    };
  }

  private toClaimDto(it: any): PatentClaimRequestDto {
    const toIso = (d?: Date | null) => (d ? d.toISOString() : null);
    return {
      id: it.id,
      patentId: it.patentId,
      applicantUserId: it.applicantUserId,
      status: it.status,
      claimReason: it.claimReason ?? null,
      evidenceFileIds: this.normalizeStringArray(it.evidenceFileIdsJson),
      reviewerUserId: it.reviewerUserId ?? null,
      reviewComment: it.reviewComment ?? null,
      submittedAt: toIso(it.submittedAt) || new Date().toISOString(),
      reviewedAt: toIso(it.reviewedAt),
      createdAt: toIso(it.createdAt) || new Date().toISOString(),
      updatedAt: toIso(it.updatedAt) || new Date().toISOString(),
    };
  }

  private extractJobError(error: any): { code: string; message: string } {
    const code = String(error?.response?.code || error?.code || 'JOB_ERROR').trim() || 'JOB_ERROR';
    const message = String(error?.response?.message || error?.message || 'job failed').trim() || 'job failed';
    return { code, message };
  }

  private normalizeImportRows(sheetRows: Array<Record<string, any>>) {
    const out: Array<{
      rowNo: number;
      status: PatentImportRowStatus;
      rawJson: Record<string, any>;
      normalizedJson: Record<string, any> | null;
      errorCode: string | null;
      errorMessage: string | null;
    }> = [];
    for (let i = 0; i < sheetRows.length; i += 1) {
      const row = sheetRows[i] || {};
      const rowNo = i + 2;
      const errors: string[] = [];
      let payload: Record<string, any> | null = null;
      try {
        const applicationNoRaw = this.pickWorkbookValue(row, [
          '\u7533\u8bf7\u53f7',
          '\u7533\u8bf7\u7f16\u53f7',
          'applicationNo',
          'application_no',
          '\u4e13\u5229\u53f7',
        ]);
        const titleRaw = this.pickWorkbookValue(row, ['\u53d1\u660e\u540d\u79f0', '\u540d\u79f0', '\u6807\u9898', 'title']);
        const patentTypeRaw = this.pickWorkbookValue(row, ['\u4e13\u5229\u7c7b\u578b', 'patentType', 'type']);
        const legalStatusRaw = this.pickWorkbookValue(row, ['\u6cd5\u5f8b\u72b6\u6001', 'legalStatus']);
        const filingDateRaw = this.pickWorkbookValue(row, ['\u7533\u8bf7\u65e5', '\u7533\u8bf7\u65e5\u671f', 'filingDate']);
        const grantDateRaw = this.pickWorkbookValue(row, ['\u6388\u6743\u65e5', '\u6388\u6743\u65e5\u671f', 'grantDate']);
        const publicationNoRaw = this.pickWorkbookValue(row, [
          '\u516c\u5f00(\u516c\u544a)\u53f7',
          '\u516c\u5f00\uff08\u516c\u544a\uff09\u53f7',
          '\u516c\u5f00\u516c\u544a\u53f7',
          'publicationNo',
        ]);
        const publicationDateRaw = this.pickWorkbookValue(row, [
          '\u516c\u5f00(\u516c\u544a)\u65e5\u671f',
          '\u516c\u5f00\uff08\u516c\u544a\uff09\u65e5',
          '\u516c\u5f00\uff08\u516c\u544a\uff09\u65e5\u671f',
          '\u516c\u5f00\u516c\u544a\u65e5',
          'publicationDate',
        ]);
        const assigneeRaw = this.pickWorkbookValue(row, [
          '\u7533\u8bf7(\u4e13\u5229\u6743)\u4eba',
          '\u4e13\u5229\u6743\u4eba',
          'assigneeNames',
        ]);
        const applicantRaw = this.pickWorkbookValue(row, ['\u7533\u8bf7\u4eba', 'applicantNames']);
        const inventorRaw = this.pickWorkbookValue(row, ['\u53d1\u660e\u4eba', '\u53d1\u660e\uff08\u8bbe\u8ba1\uff09\u4eba', 'inventorNames']);
        const abstractRaw = this.pickWorkbookValue(row, ['\u6458\u8981', 'abstract']);

        if (!applicationNoRaw) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'applicationNo is required' });
        }
        const normalizedNo = this.normalizeApplicationNo(applicationNoRaw);
        const title = String(titleRaw || '').trim();
        if (!title) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'title is required' });
        }
        const inferredType = this.normalizePatentTypeFromWorkbook(patentTypeRaw);
        const normalizeProbe = this.normalizeNumber(String(applicationNoRaw || ''));
        const patentType = inferredType || normalizeProbe.patentType;
        if (!patentType) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'patentType is required' });
        }
        const legalStatus = this.normalizeLegalStatusFromWorkbook(legalStatusRaw);
        const filingDate = this.parseWorkbookDate(filingDateRaw, 'filingDate');
        const publicationDate = this.parseWorkbookDate(publicationDateRaw, 'publicationDate');
        const grantDate = this.parseWorkbookDate(grantDateRaw, 'grantDate');
        const assigneeNames = this.splitWorkbookTextList(assigneeRaw);
        const applicantNames = this.splitWorkbookTextList(applicantRaw);
        const inventorNames = this.splitWorkbookTextList(inventorRaw);
        const abstract = abstractRaw !== undefined ? String(abstractRaw || '').trim() : undefined;
        const publicationNoDisplay = publicationNoRaw !== undefined ? String(publicationNoRaw || '').trim() : undefined;

        payload = {
          jurisdiction: 'CN',
          applicationNoNorm: normalizedNo.applicationNoNorm,
          applicationNoDisplay: normalizedNo.applicationNoDisplay,
          patentType,
          title,
          abstract: abstract || undefined,
          legalStatus: legalStatus || undefined,
          filingDate: filingDate ? filingDate.toISOString().slice(0, 10) : undefined,
          publicationDate: publicationDate ? publicationDate.toISOString().slice(0, 10) : undefined,
          grantDate: grantDate ? grantDate.toISOString().slice(0, 10) : undefined,
          publicationNoDisplay: publicationNoDisplay || undefined,
          assigneeNames,
          applicantNames: applicantNames.length ? applicantNames : assigneeNames,
          inventorNames,
        };
      } catch (error: any) {
        errors.push(error?.response?.message || error?.message || 'row is invalid');
      }
      out.push({
        rowNo,
        status: errors.length ? 'INVALID' : 'VALID',
        rawJson: row,
        normalizedJson: errors.length ? null : payload,
        errorCode: errors.length ? 'VALIDATION_FAILED' : null,
        errorMessage: errors.length ? errors.join('; ') : null,
      });
    }
    return out;
  }

  private async assertOwnedFiles(userId: string, fileIds: string[], label: string) {
    if (!fileIds || fileIds.length === 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${label} is required` });
    }
    const files = await this.prisma.file.findMany({ where: { id: { in: fileIds } } });
    if (files.length !== fileIds.length) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${label} is invalid` });
    }
    const notOwned = files.filter((item: any) => String(item.ownerId || '') !== userId);
    if (notOwned.length > 0) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
  }

  private async upsertPatentFromImportPayload(payload: Record<string, any>, duplicatePolicy: PatentImportDuplicatePolicy): Promise<{
    status: 'SUCCEEDED' | 'SKIPPED';
    patent: any;
  }> {
    const applicationNoNorm = this.parseNonEmptyStringStrict(payload?.applicationNoNorm, 'applicationNoNorm');
    const title = this.parseNonEmptyStringStrict(payload?.title, 'title');
    const patentType = this.parsePatentTypeStrict(payload?.patentType, 'patentType');
    const existing = await this.prisma.patent.findUnique({
      where: { jurisdiction_applicationNoNorm: { jurisdiction: 'CN', applicationNoNorm } },
    });
    if (existing && duplicatePolicy === 'SKIP') {
      return { status: 'SKIPPED', patent: existing };
    }

    const filingDate = this.parseDate(payload?.filingDate, 'filingDate');
    const publicationDate = this.parseDate(payload?.publicationDate, 'publicationDate');
    const grantDate = this.parseDate(payload?.grantDate, 'grantDate');
    const legalStatus = payload?.legalStatus ? this.parseLegalStatusStrict(payload?.legalStatus, 'legalStatus') : undefined;
    const abstract = payload?.abstract !== undefined ? String(payload?.abstract || '').trim() : undefined;
    const publicationNoDisplay = payload?.publicationNoDisplay !== undefined ? String(payload?.publicationNoDisplay || '').trim() : undefined;
    const patent = await this.prisma.patent.upsert({
      where: { jurisdiction_applicationNoNorm: { jurisdiction: 'CN', applicationNoNorm } },
      create: {
        jurisdiction: 'CN',
        applicationNoNorm,
        applicationNoDisplay: String(payload?.applicationNoDisplay || '').trim() || toApplicationDisplay(applicationNoNorm),
        patentType,
        title,
        abstract: abstract || null,
        filingDate: filingDate ?? null,
        publicationDate: publicationDate ?? null,
        grantDate: grantDate ?? null,
        legalStatus: legalStatus ?? null,
        publicationNoDisplay: publicationNoDisplay || null,
        sourcePrimary: 'ADMIN',
        sourceUpdatedAt: new Date(),
      },
      update: {
        applicationNoDisplay: String(payload?.applicationNoDisplay || '').trim() || toApplicationDisplay(applicationNoNorm),
        patentType,
        title,
        abstract: abstract === undefined ? undefined : abstract || null,
        filingDate: filingDate === undefined ? undefined : filingDate,
        publicationDate: publicationDate === undefined ? undefined : publicationDate,
        grantDate: grantDate === undefined ? undefined : grantDate,
        legalStatus: legalStatus === undefined ? undefined : legalStatus,
        publicationNoDisplay: publicationNoDisplay === undefined ? undefined : publicationNoDisplay || null,
        sourcePrimary: 'ADMIN',
        sourceUpdatedAt: new Date(),
      },
    });
    if (payload?.inventorNames !== undefined) {
      await this.syncParties(patent.id, 'INVENTOR', payload?.inventorNames);
    }
    if (payload?.assigneeNames !== undefined) {
      await this.syncParties(patent.id, 'ASSIGNEE', payload?.assigneeNames);
    }
    if (payload?.applicantNames !== undefined) {
      await this.syncParties(patent.id, 'APPLICANT', payload?.applicantNames);
    }
    const latest = await this.prisma.patent.findUnique({ where: { id: patent.id } });
    return { status: 'SUCCEEDED', patent: latest || patent };
  }

  private async upsertListingForPatent(params: {
    patent: any;
    operatorUserId: string;
    listingDefaults: PatentImportListingDefaults;
    duplicatePolicy: PatentImportDuplicatePolicy;
  }): Promise<{
    status: 'SUCCEEDED' | 'SKIPPED' | 'FAILED';
    listingId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  }> {
    const defaults = params.listingDefaults;
    if (defaults.enabled === false) {
      return { status: 'SKIPPED', listingId: null, errorCode: 'LISTING_DISABLED', errorMessage: 'listing disabled' };
    }

    let sellerUserId = String(defaults.sellerUserId || '').trim();
    const consultationRouting = defaults.consultationRouting || 'PLATFORM';
    if (consultationRouting === 'OWNER') {
      const ownerUserId = String(params.patent?.ownerUserId || '').trim();
      if (!ownerUserId) {
        return {
          status: 'FAILED',
          errorCode: 'OWNER_REQUIRED',
          errorMessage: 'consultationRouting OWNER requires patent owner',
        };
      }
      sellerUserId = ownerUserId;
    } else if (!sellerUserId) {
      sellerUserId = params.operatorUserId;
    }
    const seller = await this.prisma.user.findUnique({ where: { id: sellerUserId }, select: { id: true } });
    if (!seller) {
      return { status: 'FAILED', errorCode: 'SELLER_NOT_FOUND', errorMessage: 'seller user not found' };
    }

    const tradeMode = defaults.tradeMode || 'ASSIGNMENT';
    const licenseMode = tradeMode === 'LICENSE' ? defaults.licenseMode || null : null;
    const priceType = defaults.priceType || 'NEGOTIABLE';
    const priceAmount = priceType === 'FIXED' ? defaults.priceAmountFen ?? null : null;
    const existingListing = await this.prisma.listing.findFirst({
      where: { patentId: params.patent.id },
      orderBy: { createdAt: 'desc' },
    });
    if (existingListing && params.duplicatePolicy === 'SKIP') {
      return {
        status: 'SKIPPED',
        listingId: existingListing.id,
        errorCode: 'LISTING_DUPLICATE_SKIPPED',
        errorMessage: 'listing exists and duplicatePolicy is SKIP',
      };
    }
    const listingPayload = {
      sellerUserId,
      source: 'ADMIN' as const,
      patentId: params.patent.id,
      title: String(params.patent?.title || '').trim() || String(params.patent?.applicationNoDisplay || '').trim() || 'Patent',
      summary: String(params.patent?.abstract || '').trim() || null,
      tradeMode,
      licenseMode,
      priceType,
      priceAmount,
      depositAmount: defaults.depositAmountFen ?? 0,
      regionCode: defaults.regionCode ?? null,
      industryTagsJson: defaults.industryTags || [],
      listingTopicsJson: defaults.listingTopics || [],
      consultationRouting,
      auditStatus: defaults.auditStatus || 'APPROVED',
      status: defaults.status || 'ACTIVE',
    };
    if (existingListing) {
      const updated = await this.prisma.listing.update({
        where: { id: existingListing.id },
        data: listingPayload,
      });
      return { status: 'SUCCEEDED', listingId: updated.id };
    }
    const created = await this.prisma.listing.create({ data: listingPayload });
    return { status: 'SUCCEEDED', listingId: created.id };
  }

  async createImportJob(req: any, body: any): Promise<PatentImportJobDto> {
    this.ensureAdmin(req);
    const operatorUserId = this.parseUuidStrict(req?.auth?.userId, 'operatorUserId');
    const fileId = this.parseUuidStrict(body?.fileId, 'fileId');
    const duplicatePolicy = this.hasOwn(body, 'duplicatePolicy')
      ? this.parsePatentImportDuplicatePolicyStrict(body?.duplicatePolicy, 'duplicatePolicy')
      : 'SKIP';
    const defaults = this.parseImportDefaults(body || {});
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException({ code: 'NOT_FOUND', message: 'file not found' });

    const scope = `patent-import-job:${fileId}:${duplicatePolicy}`;
    return await this.withIdempotency(req, scope, async () => {
      const created = await this.prisma.patentImportJob.create({
        data: {
          operatorUserId,
          fileId,
          duplicatePolicy,
          defaultsJson: defaults as any,
          status: 'PENDING',
        },
      });
      return this.toImportJobDto(created);
    });
  }

  async validateImportJob(_req: any, jobId: string): Promise<PatentImportJobDto> {
    const job = await this.prisma.patentImportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'import job not found' });
    if (job.status === 'RUNNING') {
      throw new ConflictException({ code: 'CONFLICT', message: 'import job is running' });
    }
    const buffer = await this.readFileBufferById(job.fileId);
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'import file is invalid' });
    }
    const sheetName = workbook.SheetNames?.[0];
    if (!sheetName) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'import file is empty' });
    }
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
    if (!rows.length) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'import file is empty' });
    }
    if (rows.length > PATENT_IMPORT_MAX_ROWS) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `import file rows exceed limit (${PATENT_IMPORT_MAX_ROWS})`,
      });
    }

    const normalizedRows = this.normalizeImportRows(rows);
    const totalCount = normalizedRows.length;
    const validCount = normalizedRows.filter((it) => it.status === 'VALID').length;
    const invalidCount = normalizedRows.filter((it) => it.status === 'INVALID').length;
    const failRate = totalCount > 0 ? invalidCount / totalCount : 0;
    await this.prisma.$transaction([
      this.prisma.patentImportJobRow.deleteMany({ where: { jobId } }),
      this.prisma.patentImportJobRow.createMany({
        data: normalizedRows.map((it) => ({
          jobId,
          rowNo: it.rowNo,
          status: it.status,
          rawJson: it.rawJson as any,
          normalizedJson: it.normalizedJson as any,
          errorCode: it.errorCode,
          errorMessage: it.errorMessage,
        })),
      }),
      this.prisma.patentImportJob.update({
        where: { id: jobId },
        data: {
          status: 'PENDING',
          totalCount,
          validCount,
          invalidCount,
          successCount: 0,
          failedCount: invalidCount,
          skippedCount: 0,
          failRate,
          validatedAt: new Date(),
          startedAt: null,
          finishedAt: null,
          pausedAt: null,
          errorFileId: null,
        },
      }),
    ]);
    const latest = await this.prisma.patentImportJob.findUnique({ where: { id: jobId } });
    if (!latest) throw new NotFoundException({ code: 'NOT_FOUND', message: 'import job not found' });
    return this.toImportJobDto(latest);
  }

  async executeImportJob(_req: any, jobId: string): Promise<PatentImportJobDto> {
    const job = await this.prisma.patentImportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'import job not found' });
    if (job.status === 'RUNNING') {
      throw new ConflictException({ code: 'CONFLICT', message: 'import job is running' });
    }
    if (!job.validatedAt) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'import job has not been validated' });
    }
    await this.prisma.patentImportJob.update({
      where: { id: jobId },
      data: { status: 'PENDING', pausedAt: null, finishedAt: null },
    });
    setTimeout(() => {
      void this.processImportJob(jobId).catch(() => {});
    }, 0);
    const latest = await this.prisma.patentImportJob.findUnique({ where: { id: jobId } });
    if (!latest) throw new NotFoundException({ code: 'NOT_FOUND', message: 'import job not found' });
    return this.toImportJobDto(latest);
  }

  async listImportJobs(_req: any, query: any): Promise<PagedPatentImportJobs> {
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(100, pageSizeInput);
    const status = this.hasOwn(query, 'status') ? this.parsePatentJobStatusStrict(query?.status, 'status') : undefined;
    const duplicatePolicy = this.hasOwn(query, 'duplicatePolicy')
      ? this.parsePatentImportDuplicatePolicyStrict(query?.duplicatePolicy, 'duplicatePolicy')
      : undefined;
    const where: any = {};
    if (status) where.status = status;
    if (duplicatePolicy) where.duplicatePolicy = duplicatePolicy;
    const [items, total] = await Promise.all([
      this.prisma.patentImportJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.patentImportJob.count({ where }),
    ]);
    return {
      items: items.map((it) => this.toImportJobDto(it)),
      page: { page, pageSize, total },
    };
  }

  async getImportJob(_req: any, jobId: string): Promise<PatentImportJobDto> {
    const job = await this.prisma.patentImportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'import job not found' });
    return this.toImportJobDto(job);
  }

  async listImportJobRows(_req: any, jobId: string, query: any): Promise<PagedPatentImportJobRows> {
    const exists = await this.prisma.patentImportJob.findUnique({ where: { id: jobId }, select: { id: true } });
    if (!exists) throw new NotFoundException({ code: 'NOT_FOUND', message: 'import job not found' });
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(200, pageSizeInput);
    const status = this.hasOwn(query, 'status') ? this.normalizePatentImportRowStatus(query?.status) : undefined;
    if (this.hasOwn(query, 'status') && !status) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'status is invalid' });
    }
    const where: any = { jobId };
    if (status) where.status = status;
    const [items, total] = await Promise.all([
      this.prisma.patentImportJobRow.findMany({
        where,
        orderBy: [{ rowNo: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.patentImportJobRow.count({ where }),
    ]);
    return {
      items: items.map((it) => this.toImportJobRowDto(it)),
      page: { page, pageSize, total },
    };
  }

  async getImportJobErrorFile(req: any, jobId: string): Promise<{ fileId: string | null; url: string | null }> {
    const job = await this.prisma.patentImportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'import job not found' });
    if (!job.errorFileId) return { fileId: null, url: null };
    const file = await this.prisma.file.findUnique({ where: { id: job.errorFileId } });
    return {
      fileId: job.errorFileId,
      url: file?.url || `${this.resolveBaseUrl(req)}/files/${job.errorFileId}`,
    };
  }

  private async processImportJob(jobId: string): Promise<void> {
    const lock = await this.prisma.patentImportJob.updateMany({
      where: { id: jobId, status: { in: ['PENDING', 'PAUSED'] } },
      data: { status: 'RUNNING', startedAt: new Date(), pausedAt: null, finishedAt: null },
    });
    if (!lock.count) return;
    const job = await this.prisma.patentImportJob.findUnique({ where: { id: jobId } });
    if (!job) return;
    const defaults = this.parseImportDefaults({ defaults: job.defaultsJson || {} });
    const validRows = await this.prisma.patentImportJobRow.findMany({
      where: { jobId, status: 'VALID' },
      orderBy: [{ rowNo: 'asc' }, { id: 'asc' }],
    });
    let successCount = 0;
    let failedCount = Number(job.invalidCount || 0);
    let skippedCount = 0;
    let processedInRun = 0;
    let paused = false;

    for (const row of validRows) {
      try {
        const payload = (row.normalizedJson || {}) as Record<string, any>;
        const upsertResult = await this.upsertPatentFromImportPayload(payload, job.duplicatePolicy as PatentImportDuplicatePolicy);
        if (upsertResult.status === 'SKIPPED') {
          skippedCount += 1;
          await this.prisma.patentImportJobRow.update({
            where: { id: row.id },
            data: {
              status: 'SKIPPED',
              patentId: upsertResult.patent.id,
              errorCode: 'DUPLICATE_SKIPPED',
              errorMessage: 'patent exists and duplicatePolicy is SKIP',
              processedAt: new Date(),
            },
          });
        } else {
          const listingResult = await this.upsertListingForPatent({
            patent: upsertResult.patent,
            operatorUserId: job.operatorUserId,
            listingDefaults: defaults.listing || {},
            duplicatePolicy: job.duplicatePolicy as PatentImportDuplicatePolicy,
          });
          if (listingResult.status === 'FAILED') {
            throw new BadRequestException({
              code: listingResult.errorCode || 'LISTING_UPSERT_FAILED',
              message: listingResult.errorMessage || 'listing upsert failed',
            });
          }
          if (listingResult.status === 'SKIPPED') {
            skippedCount += 1;
            await this.prisma.patentImportJobRow.update({
              where: { id: row.id },
              data: {
                status: 'SKIPPED',
                patentId: upsertResult.patent.id,
                errorCode: listingResult.errorCode || null,
                errorMessage: listingResult.errorMessage || null,
                processedAt: new Date(),
              },
            });
          } else {
            successCount += 1;
            await this.prisma.patentImportJobRow.update({
              where: { id: row.id },
              data: {
                status: 'SUCCEEDED',
                patentId: upsertResult.patent.id,
                errorCode: null,
                errorMessage: null,
                processedAt: new Date(),
              },
            });
          }
        }
      } catch (error: any) {
        failedCount += 1;
        const mapped = this.extractJobError(error);
        await this.prisma.patentImportJobRow.update({
          where: { id: row.id },
          data: {
            status: 'FAILED',
            errorCode: mapped.code,
            errorMessage: mapped.message,
            processedAt: new Date(),
          },
        });
      }
      processedInRun += 1;
      const runtimeTotal = successCount + skippedCount + Math.max(0, failedCount - Number(job.invalidCount || 0));
      const runtimeFailed = Math.max(0, failedCount - Number(job.invalidCount || 0));
      const runtimeFailRate = runtimeTotal > 0 ? runtimeFailed / runtimeTotal : 0;
      if (processedInRun >= 10 && runtimeFailRate > 0.3) {
        paused = true;
        break;
      }
    }

    const failedRows = await this.prisma.patentImportJobRow.findMany({
      where: { jobId, status: { in: ['FAILED', 'INVALID'] } },
      orderBy: [{ rowNo: 'asc' }, { id: 'asc' }],
    });
    const errorFileId = await this.createOwnedCsvFile({
      ownerUserId: job.operatorUserId,
      filenamePrefix: `patent-import-job-${jobId}`,
      headers: ['jobId', 'rowNo', 'status', 'errorCode', 'errorMessage', 'applicationNoNorm', 'title'],
      rows: failedRows.map((it: any) => [
        jobId,
        it.rowNo,
        it.status,
        it.errorCode,
        it.errorMessage,
        (it.normalizedJson as any)?.applicationNoNorm,
        (it.normalizedJson as any)?.title,
      ]),
    });
    const totalCount = Number(job.totalCount || 0);
    const failRate = totalCount > 0 ? failedCount / totalCount : 0;
    const nextStatus: PatentJobStatus = paused ? 'PAUSED' : failedCount > 0 ? 'FAILED' : 'SUCCEEDED';
    await this.prisma.patentImportJob.update({
      where: { id: jobId },
      data: {
        status: nextStatus,
        successCount,
        failedCount,
        skippedCount,
        failRate,
        pausedAt: paused ? new Date() : null,
        finishedAt: paused ? null : new Date(),
        errorFileId: errorFileId || null,
      },
    });
  }

  async adminGenerateListings(req: any, body: any): Promise<PatentListingGenerateResultDto> {
    this.ensureAdmin(req);
    const operatorUserId = this.parseUuidStrict(req?.auth?.userId, 'operatorUserId');
    const patentIds = this.parseUuidArrayStrict(body?.patentIds, 'patentIds', { min: 1, max: 1000 });
    const duplicatePolicy = this.hasOwn(body, 'duplicatePolicy')
      ? this.parsePatentImportDuplicatePolicyStrict(body?.duplicatePolicy, 'duplicatePolicy')
      : 'SKIP';
    const defaults = this.parseImportDefaults({ defaults: { listing: body?.listingDefaults || {} } });
    const rows: PatentListingGenerateResultDto['rows'] = [];
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const patentId of patentIds) {
      const patent = await this.prisma.patent.findUnique({ where: { id: patentId } });
      if (!patent) {
        failedCount += 1;
        rows.push({ patentId, status: 'FAILED', errorCode: 'PATENT_NOT_FOUND', errorMessage: 'patent not found' });
        continue;
      }
      const result = await this.upsertListingForPatent({
        patent,
        operatorUserId,
        listingDefaults: defaults.listing || {},
        duplicatePolicy,
      });
      if (result.status === 'SUCCEEDED') {
        successCount += 1;
        rows.push({ patentId, listingId: result.listingId || null, status: 'SUCCEEDED' });
      } else if (result.status === 'SKIPPED') {
        skippedCount += 1;
        rows.push({
          patentId,
          listingId: result.listingId || null,
          status: 'SKIPPED',
          errorCode: result.errorCode || null,
          errorMessage: result.errorMessage || null,
        });
      } else {
        failedCount += 1;
        rows.push({
          patentId,
          listingId: result.listingId || null,
          status: 'FAILED',
          errorCode: result.errorCode || null,
          errorMessage: result.errorMessage || null,
        });
      }
    }

    return {
      totalCount: patentIds.length,
      successCount,
      failedCount,
      skippedCount,
      rows,
    };
  }

  async createMyClaim(req: any, body: any): Promise<PatentClaimRequestDto> {
    this.ensureAuth(req);
    const applicantUserId = this.parseUuidStrict(req?.auth?.userId, 'applicantUserId');
    const patentId = this.parseUuidStrict(body?.patentId, 'patentId');
    const evidenceFileIds = this.parseUuidArrayStrict(body?.evidenceFileIds, 'evidenceFileIds', { min: 1, max: 20 });
    await this.assertOwnedFiles(applicantUserId, evidenceFileIds, 'evidenceFileIds');
    const verification = await this.prisma.userVerification.findFirst({
      where: { userId: applicantUserId, verificationStatus: 'APPROVED' },
      select: { id: true },
    });
    if (!verification) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'approved verification required' });
    }
    const patent = await this.prisma.patent.findUnique({ where: { id: patentId } });
    if (!patent) throw new NotFoundException({ code: 'NOT_FOUND', message: 'patent not found' });
    if (String(patent.ownerUserId || '') === applicantUserId) {
      throw new ConflictException({ code: 'CONFLICT', message: 'patent already belongs to current user' });
    }
    const existingPending = await this.prisma.patentClaimRequest.findFirst({
      where: { patentId, applicantUserId, status: 'PENDING' },
      select: { id: true },
    });
    if (existingPending) {
      throw new ConflictException({ code: 'CONFLICT', message: 'pending claim already exists' });
    }
    const claimReason = this.hasOwn(body, 'claimReason') ? String(body?.claimReason || '').trim() : '';
    const created = await this.prisma.patentClaimRequest.create({
      data: {
        patentId,
        applicantUserId,
        status: 'PENDING',
        claimReason: claimReason || null,
        evidenceFileIdsJson: evidenceFileIds as any,
      },
    });
    return this.toClaimDto(created);
  }

  async listMyClaims(req: any, query: any): Promise<PagedPatentClaimRequests> {
    this.ensureAuth(req);
    const applicantUserId = this.parseUuidStrict(req?.auth?.userId, 'applicantUserId');
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(100, pageSizeInput);
    const status = this.hasOwn(query, 'status') ? this.normalizePatentClaimStatus(query?.status) : undefined;
    if (this.hasOwn(query, 'status') && !status) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'status is invalid' });
    }
    const where: any = { applicantUserId };
    if (status) where.status = status;
    const [items, total] = await Promise.all([
      this.prisma.patentClaimRequest.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.patentClaimRequest.count({ where }),
    ]);
    return {
      items: items.map((it) => this.toClaimDto(it)),
      page: { page, pageSize, total },
    };
  }

  async adminListClaims(req: any, query: any): Promise<PagedPatentClaimRequests> {
    this.ensureAdmin(req);
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(100, pageSizeInput);
    const status = this.hasOwn(query, 'status') ? this.normalizePatentClaimStatus(query?.status) : undefined;
    if (this.hasOwn(query, 'status') && !status) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'status is invalid' });
    }
    const q = String(query?.q || '').trim();
    const where: any = {};
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { claimReason: { contains: q, mode: 'insensitive' } },
        { patent: { title: { contains: q, mode: 'insensitive' } } },
        { patent: { applicationNoNorm: { contains: q, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.patentClaimRequest.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.patentClaimRequest.count({ where }),
    ]);
    return {
      items: items.map((it) => this.toClaimDto(it)),
      page: { page, pageSize, total },
    };
  }

  async approveClaim(req: any, claimId: string, body: any): Promise<PatentClaimRequestDto> {
    this.ensureAdmin(req);
    const reviewerUserId = this.parseUuidStrict(req?.auth?.userId, 'reviewerUserId');
    const normalizedClaimId = this.parseUuidStrict(claimId, 'claimId');
    const claim = await this.prisma.patentClaimRequest.findUnique({ where: { id: normalizedClaimId } });
    if (!claim) throw new NotFoundException({ code: 'NOT_FOUND', message: 'claim not found' });
    if (claim.status !== 'PENDING') {
      throw new ConflictException({ code: 'CONFLICT', message: 'claim already processed' });
    }
    const blockingOrders = await this.prisma.order.count({
      where: {
        status: { in: Array.from(ORDER_BLOCKING_STATUS_SET) },
        listing: { patentId: claim.patentId },
      },
    });
    if (blockingOrders > 0) {
      throw new ConflictException({ code: 'CONFLICT', message: 'ongoing orders exist for this patent' });
    }
    const reviewComment = this.hasOwn(body, 'reviewComment') ? String(body?.reviewComment || '').trim() : '';
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.patentClaimRequest.update({
        where: { id: claim.id },
        data: {
          status: 'APPROVED',
          reviewerUserId,
          reviewComment: reviewComment || null,
          reviewedAt: now,
        },
      }),
      this.prisma.patent.update({
        where: { id: claim.patentId },
        data: {
          ownerUserId: claim.applicantUserId,
          ownerClaimedAt: now,
          ownerClaimSource: 'USER_CLAIM',
        },
      }),
      this.prisma.listing.updateMany({
        where: { patentId: claim.patentId, consultationRouting: 'OWNER' },
        data: { sellerUserId: claim.applicantUserId },
      }),
      this.prisma.patentClaimRequest.updateMany({
        where: { patentId: claim.patentId, status: 'PENDING', id: { not: claim.id } },
        data: {
          status: 'REJECTED',
          reviewerUserId,
          reviewComment: 'rejected because another claim has been approved',
          reviewedAt: now,
        },
      }),
    ]);
    const updated = await this.prisma.patentClaimRequest.findUnique({ where: { id: claim.id } });
    if (!updated) throw new NotFoundException({ code: 'NOT_FOUND', message: 'claim not found' });
    return this.toClaimDto(updated);
  }

  async rejectClaim(req: any, claimId: string, body: any): Promise<PatentClaimRequestDto> {
    this.ensureAdmin(req);
    const reviewerUserId = this.parseUuidStrict(req?.auth?.userId, 'reviewerUserId');
    const normalizedClaimId = this.parseUuidStrict(claimId, 'claimId');
    const claim = await this.prisma.patentClaimRequest.findUnique({ where: { id: normalizedClaimId } });
    if (!claim) throw new NotFoundException({ code: 'NOT_FOUND', message: 'claim not found' });
    if (claim.status !== 'PENDING') {
      throw new ConflictException({ code: 'CONFLICT', message: 'claim already processed' });
    }
    const reviewComment = this.parseNonEmptyStringStrict(body?.reviewComment, 'reviewComment');
    const updated = await this.prisma.patentClaimRequest.update({
      where: { id: claim.id },
      data: {
        status: 'REJECTED',
        reviewerUserId,
        reviewComment,
        reviewedAt: new Date(),
      },
    });
    return this.toClaimDto(updated);
  }
}
