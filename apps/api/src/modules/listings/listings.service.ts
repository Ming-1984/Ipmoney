import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

type AuditStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ListingStatus = 'DRAFT' | 'ACTIVE' | 'OFF_SHELF' | 'SOLD';
type FeaturedLevel = 'NONE' | 'CITY' | 'PROVINCE';
type ContentSource = 'USER' | 'PLATFORM' | 'ADMIN';
type PledgeStatus = 'NONE' | 'PLEDGED' | 'UNKNOWN';
type ExistingLicenseStatus = 'NONE' | 'EXCLUSIVE' | 'SOLE' | 'NON_EXCLUSIVE' | 'UNKNOWN';
type ListingTopic = 'HIGH_TECH_RETIRED' | 'SLEEPING' | 'AWARD_WINNING' | 'FIVE_STAR' | 'OPEN_LICENSE';

import { AuditLogService } from '../../common/audit-log.service';
import { ContentEventService } from '../../common/content-event.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WechatContentSecurityService } from '../../common/wechat-content-security.service';
import { resolveUploadDir } from '../../common/upload-dir';
import { NotificationsService } from '../notifications/notifications.service';
import { mapStats, resolvePublicFileUrl, sanitizeIndustryTagNames } from '../content-utils';
import { ConfigService, type RecommendationConfig } from '../config/config.service';
import { FilesService } from '../files/files.service';
import { readWorkbookRowsFromBuffer } from '../../common/workbook-reader';

const LISTING_TOPIC_VALUE_SET = new Set<ListingTopic>([
  'HIGH_TECH_RETIRED',
  'SLEEPING',
  'AWARD_WINNING',
  'FIVE_STAR',
  'OPEN_LICENSE',
]);

type ListingAdminDto = {
  id: string;
  source?: ContentSource;
  proofFileIds?: string[];
  deliverables?: string[];
  industryTags?: string[];
  listingTopics?: ListingTopic[];
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
  consultationRouting?: 'PLATFORM' | 'OWNER';
  featuredLevel?: FeaturedLevel;
  featuredRegionCode?: string | null;
  featuredRank?: number | null;
  featuredUntil?: string | null;
};

type PagedListingAdmin = {
  items: ListingAdminDto[];
  page: { page: number; pageSize: number; total: number };
};

type ListingJobStatus = 'PENDING' | 'RUNNING' | 'PAUSED' | 'SUCCEEDED' | 'FAILED';
type ListingBatchAction = 'APPROVE' | 'REJECT' | 'PUBLISH' | 'OFF_SHELF';
type ListingBatchItemStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';
type ListingImportDuplicatePolicy = 'SKIP' | 'OVERWRITE';
type ListingImportRowStatus = 'PENDING' | 'VALID' | 'INVALID' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';

type ListingBatchJobDto = {
  id: string;
  operatorUserId: string;
  action: ListingBatchAction;
  reason?: string | null;
  status: ListingJobStatus;
  totalCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  failRate: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  pausedAt?: string | null;
  errorFileId?: string | null;
  createdAt: string;
  updatedAt: string;
};

type ListingBatchJobItemDto = {
  id: string;
  jobId: string;
  listingId: string;
  status: ListingBatchItemStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  processedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type PagedListingBatchJobs = {
  items: ListingBatchJobDto[];
  page: { page: number; pageSize: number; total: number };
};

type PagedListingBatchJobItems = {
  items: ListingBatchJobItemDto[];
  page: { page: number; pageSize: number; total: number };
};

type ListingImportJobDto = {
  id: string;
  operatorUserId: string;
  fileId: string;
  duplicatePolicy: ListingImportDuplicatePolicy;
  defaults?: Record<string, any>;
  status: ListingJobStatus;
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

type ListingImportJobRowDto = {
  id: string;
  jobId: string;
  rowNo: number;
  status: ListingImportRowStatus;
  raw?: Record<string, any>;
  normalized?: Record<string, any> | null;
  listingId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  processedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type PagedListingImportJobs = {
  items: ListingImportJobDto[];
  page: { page: number; pageSize: number; total: number };
};

type PagedListingImportJobRows = {
  items: ListingImportJobRowDto[];
  page: { page: number; pageSize: number; total: number };
};

type ListingImportDefaults = {
  sellerUserId?: string;
  consultationRouting?: 'PLATFORM' | 'OWNER';
  source?: ContentSource;
  tradeMode?: 'ASSIGNMENT' | 'LICENSE';
  licenseMode?: 'EXCLUSIVE' | 'SOLE' | 'NON_EXCLUSIVE';
  priceType?: 'FIXED' | 'NEGOTIABLE';
  priceAmountFen?: number;
  depositAmountFen?: number;
  regionCode?: string;
  listingTopics?: ListingTopic[];
  industryTags?: string[];
  status?: ListingStatus;
  auditStatus?: AuditStatus;
};

const UPLOAD_DIR = resolveUploadDir();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGION_CODE_RE = /^[0-9]{6}$/;
const LISTING_JOB_STATUS_SET = new Set<ListingJobStatus>(['PENDING', 'RUNNING', 'PAUSED', 'SUCCEEDED', 'FAILED']);
const LISTING_BATCH_ACTION_SET = new Set<ListingBatchAction>(['APPROVE', 'REJECT', 'PUBLISH', 'OFF_SHELF']);
const LISTING_BATCH_ITEM_STATUS_SET = new Set<ListingBatchItemStatus>(['PENDING', 'SUCCEEDED', 'FAILED', 'SKIPPED']);
const LISTING_IMPORT_DUPLICATE_POLICY_SET = new Set<ListingImportDuplicatePolicy>(['SKIP', 'OVERWRITE']);
const LISTING_IMPORT_ROW_STATUS_SET = new Set<ListingImportRowStatus>(['PENDING', 'VALID', 'INVALID', 'SUCCEEDED', 'FAILED', 'SKIPPED']);
const PLATFORM_BRAND_NAME = 'ipmoney';

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly notifications: NotificationsService,
    private readonly events: ContentEventService,
    private readonly config: ConfigService,
    private readonly contentSecurity: WechatContentSecurityService,
    @Optional() private readonly files?: FilesService,
  ) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }

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

  private parseUuidStrict(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw || !UUID_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private normalizeListingJobStatus(value: unknown): ListingJobStatus | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw || !LISTING_JOB_STATUS_SET.has(raw as ListingJobStatus)) return undefined;
    return raw as ListingJobStatus;
  }

  private parseListingJobStatusStrict(value: unknown, fieldName: string): ListingJobStatus {
    const normalized = this.normalizeListingJobStatus(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private normalizeListingBatchAction(value: unknown): ListingBatchAction | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw || !LISTING_BATCH_ACTION_SET.has(raw as ListingBatchAction)) return undefined;
    return raw as ListingBatchAction;
  }

  private parseListingBatchActionStrict(value: unknown, fieldName: string): ListingBatchAction {
    const normalized = this.normalizeListingBatchAction(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private normalizeListingBatchItemStatus(value: unknown): ListingBatchItemStatus | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw || !LISTING_BATCH_ITEM_STATUS_SET.has(raw as ListingBatchItemStatus)) return undefined;
    return raw as ListingBatchItemStatus;
  }

  private normalizeListingImportDuplicatePolicy(value: unknown): ListingImportDuplicatePolicy | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw || !LISTING_IMPORT_DUPLICATE_POLICY_SET.has(raw as ListingImportDuplicatePolicy)) return undefined;
    return raw as ListingImportDuplicatePolicy;
  }

  private parseListingImportDuplicatePolicyStrict(value: unknown, fieldName: string): ListingImportDuplicatePolicy {
    const normalized = this.normalizeListingImportDuplicatePolicy(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private normalizeListingImportRowStatus(value: unknown): ListingImportRowStatus | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw || !LISTING_IMPORT_ROW_STATUS_SET.has(raw as ListingImportRowStatus)) return undefined;
    return raw as ListingImportRowStatus;
  }

  private normalizeOptionalReason(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    const raw = String(value).trim();
    return raw || undefined;
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

  private normalizeConsultationRouting(value: unknown): 'PLATFORM' | 'OWNER' | undefined {
    const routing = String(value || '').trim().toUpperCase();
    if (!routing) return undefined;
    if (routing === 'PLATFORM' || routing === 'OWNER') {
      return routing as 'PLATFORM' | 'OWNER';
    }
    return undefined;
  }

  private parseConsultationRoutingStrict(value: unknown, fieldName: string): 'PLATFORM' | 'OWNER' {
    const normalized = this.normalizeConsultationRouting(value);
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

  private normalizeListingTopics(input: unknown): ListingTopic[] {
    return Array.from(
      new Set(
        this.normalizeStringArray(input)
          .map((v: any) => String(v || '').trim().toUpperCase())
          .filter((v: any) => LISTING_TOPIC_VALUE_SET.has(v as ListingTopic)),
      ),
    ) as ListingTopic[];
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
    if (!raw || !REGION_CODE_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseRegionCodeFilterStrict(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw || !REGION_CODE_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private assertRegionCodeRequiredForActiveStatus(regionCode: string | null | undefined, status: ListingStatus | null | undefined) {
    const statusRaw = String(status || '').trim().toUpperCase();
    const requiresRegionCode = statusRaw === 'ACTIVE';
    if (!requiresRegionCode) return;

    const code = String(regionCode || '').trim();
    if (!code || !REGION_CODE_RE.test(code)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'regionCode is required when status is ACTIVE',
      });
    }
  }

  private parseNonEmptyFilterStrict(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseNullableNonEmptyStringStrict(value: unknown, fieldName: string): string | null {
    if (value === null) return null;
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
    if (!Number.isFinite(num) || !Number.isSafeInteger(num) || (min !== undefined && num < min)) {
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
      industryTags: sanitizeIndustryTagNames(it.industryTagsJson),
      listingTopics: this.normalizeListingTopics(it.listingTopicsJson),
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
      consultationRouting: it.consultationRouting ?? 'PLATFORM',
      featuredLevel: it.featuredLevel,
      featuredRegionCode: it.featuredRegionCode ?? undefined,
      featuredRank: it.featuredRank ?? undefined,
      featuredUntil: toIso(it.featuredUntil),
    };
  }

  private isPlatformBrandedListing(listing: any): boolean {
    const source = String(listing?.source || '').trim().toUpperCase();
    const consultationRouting = String(listing?.consultationRouting || '').trim().toUpperCase();
    return (source === 'ADMIN' || source === 'PLATFORM') && consultationRouting === 'PLATFORM';
  }

  private resolvePublicSellerNickname(listing: any): string | null {
    if (this.isPlatformBrandedListing(listing)) return PLATFORM_BRAND_NAME;
    const nickname = String(listing?.seller?.nickname || '').trim();
    return nickname || null;
  }

  private toBatchJobDto(it: any): ListingBatchJobDto {
    const toIso = (d?: Date | null) => (d ? d.toISOString() : null);
    return {
      id: it.id,
      operatorUserId: it.operatorUserId,
      action: it.action,
      reason: it.reason ?? null,
      status: it.status,
      totalCount: Number(it.totalCount || 0),
      successCount: Number(it.successCount || 0),
      failedCount: Number(it.failedCount || 0),
      skippedCount: Number(it.skippedCount || 0),
      failRate: Number(it.failRate || 0),
      startedAt: toIso(it.startedAt),
      finishedAt: toIso(it.finishedAt),
      pausedAt: toIso(it.pausedAt),
      errorFileId: it.errorFileId ?? null,
      createdAt: toIso(it.createdAt) || new Date().toISOString(),
      updatedAt: toIso(it.updatedAt) || new Date().toISOString(),
    };
  }

  private toBatchJobItemDto(it: any): ListingBatchJobItemDto {
    const toIso = (d?: Date | null) => (d ? d.toISOString() : null);
    return {
      id: it.id,
      jobId: it.jobId,
      listingId: it.listingId,
      status: it.status,
      errorCode: it.errorCode ?? null,
      errorMessage: it.errorMessage ?? null,
      processedAt: toIso(it.processedAt),
      createdAt: toIso(it.createdAt) || new Date().toISOString(),
      updatedAt: toIso(it.updatedAt) || new Date().toISOString(),
    };
  }

  private toImportJobDto(it: any): ListingImportJobDto {
    const toIso = (d?: Date | null) => (d ? d.toISOString() : null);
    return {
      id: it.id,
      operatorUserId: it.operatorUserId,
      fileId: it.fileId,
      duplicatePolicy: it.duplicatePolicy,
      defaults: typeof it.defaultsJson === 'object' && it.defaultsJson ? it.defaultsJson : {},
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

  private toImportJobRowDto(it: any): ListingImportJobRowDto {
    const toIso = (d?: Date | null) => (d ? d.toISOString() : null);
    return {
      id: it.id,
      jobId: it.jobId,
      rowNo: Number(it.rowNo || 0),
      status: it.status,
      raw: typeof it.rawJson === 'object' && it.rawJson ? it.rawJson : {},
      normalized: typeof it.normalizedJson === 'object' && it.normalizedJson ? it.normalizedJson : null,
      listingId: it.listingId ?? null,
      errorCode: it.errorCode ?? null,
      errorMessage: it.errorMessage ?? null,
      processedAt: toIso(it.processedAt),
      createdAt: toIso(it.createdAt) || new Date().toISOString(),
      updatedAt: toIso(it.updatedAt) || new Date().toISOString(),
    };
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
    contentLines.push(params.headers.map((h) => ListingsService.escapeCsv(h)).join(','));
    for (const row of params.rows) {
      contentLines.push(row.map((v) => ListingsService.escapeCsv(v)).join(','));
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

  private normalizeWorkbookHeader(value: unknown): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[()\[\]{}（）]/g, '')
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

  private splitWorkbookTags(raw: unknown): string[] {
    if (Array.isArray(raw)) {
      return raw
        .map((v) => String(v || '').trim())
        .filter(Boolean);
    }
    const text = String(raw || '').trim();
    if (!text) return [];
    return text
      .split(/[\n,，;；|、/]+/g)
      .map((v) => v.trim())
      .filter(Boolean);
  }

  private parseMoneyYuanToFenOptional(value: unknown, fieldName: string): number | undefined {
    if (value === undefined || value === null) return undefined;
    const raw = String(value).trim();
    if (!raw) return undefined;
    const normalized = raw.replace(/[,，\s]/g, '');
    const num = Number(normalized);
    if (!Number.isFinite(num) || num < 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return Math.round(num * 100);
  }

  private parseImportDefaults(body: any): ListingImportDefaults {
    const defaults = body?.defaults && typeof body.defaults === 'object' ? body.defaults : {};
    const out: ListingImportDefaults = {};
    if (this.hasOwn(defaults, 'sellerUserId')) {
      out.sellerUserId = this.parseNonEmptyFilterStrict(defaults?.sellerUserId, 'defaults.sellerUserId');
    }
    if (this.hasOwn(defaults, 'consultationRouting')) {
      out.consultationRouting = this.parseConsultationRoutingStrict(defaults?.consultationRouting, 'defaults.consultationRouting');
    }
    if (this.hasOwn(defaults, 'source')) {
      out.source = this.parseContentSourceStrict(defaults?.source, 'defaults.source');
    }
    if (this.hasOwn(defaults, 'tradeMode')) {
      out.tradeMode = this.parseTradeModeStrict(defaults?.tradeMode, 'defaults.tradeMode');
    }
    if (this.hasOwn(defaults, 'licenseMode')) {
      out.licenseMode = this.parseLicenseModeStrict(defaults?.licenseMode, 'defaults.licenseMode');
    }
    if (this.hasOwn(defaults, 'priceType')) {
      out.priceType = this.parsePriceTypeStrict(defaults?.priceType, 'defaults.priceType');
    }
    if (this.hasOwn(defaults, 'priceAmountFen')) {
      out.priceAmountFen = this.parseOptionalInt(defaults?.priceAmountFen, 'defaults.priceAmountFen', 0);
    } else if (this.hasOwn(defaults, 'priceAmountYuan')) {
      out.priceAmountFen = this.parseMoneyYuanToFenOptional(defaults?.priceAmountYuan, 'defaults.priceAmountYuan');
    }
    if (this.hasOwn(defaults, 'depositAmountFen')) {
      out.depositAmountFen = this.parseOptionalInt(defaults?.depositAmountFen, 'defaults.depositAmountFen', 0);
    } else if (this.hasOwn(defaults, 'depositAmountYuan')) {
      out.depositAmountFen = this.parseMoneyYuanToFenOptional(defaults?.depositAmountYuan, 'defaults.depositAmountYuan');
    }
    if (this.hasOwn(defaults, 'regionCode')) {
      out.regionCode = this.parseRegionCodeFilterStrict(defaults?.regionCode, 'defaults.regionCode');
    }
    if (this.hasOwn(defaults, 'listingTopics')) {
      out.listingTopics = this.normalizeListingTopics(defaults?.listingTopics);
    }
    if (this.hasOwn(defaults, 'industryTags')) {
      out.industryTags = sanitizeIndustryTagNames(defaults?.industryTags);
    }
    if (this.hasOwn(defaults, 'status')) {
      out.status = this.parseListingStatusStrict(defaults?.status, 'defaults.status');
    }
    if (this.hasOwn(defaults, 'auditStatus')) {
      out.auditStatus = this.parseAuditStatusStrict(defaults?.auditStatus, 'defaults.auditStatus');
    }
    return out;
  }

  private normalizeImportRows(sheetRows: Array<Record<string, any>>, defaults: ListingImportDefaults) {
    const out: Array<{
      rowNo: number;
      status: ListingImportRowStatus;
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
        const patentNumberRaw = String(
          this.pickWorkbookValue(row, [
            '专利号/申请号/公开号',
            '专利号/申请号',
            '专利号',
            '申请号',
            '公开号',
            'patentNumberRaw',
            'patentNo',
            'applicationNo',
            'publicationNo',
          ]) || '',
        ).trim();
        if (!patentNumberRaw) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'patentNumberRaw is required' });
        }

        const titleRaw = this.pickWorkbookValue(row, ['专利标题', '标题', 'title']);
        const summaryRaw = this.pickWorkbookValue(row, ['摘要', 'summary']);
        const sourceRaw = this.pickWorkbookValue(row, ['source', '来源']);
        const sellerUserIdRaw = this.pickWorkbookValue(row, ['sellerUserId', '卖家用户ID', '卖家用户']);
        const consultationRoutingRaw = this.pickWorkbookValue(row, ['consultationRouting', '咨询路由', '咨询方式']);
        const tradeModeRaw = this.pickWorkbookValue(row, ['tradeMode', '交易方式', '交易模式']);
        const licenseModeRaw = this.pickWorkbookValue(row, ['licenseMode', '许可方式', '许可模式']);
        const priceTypeRaw = this.pickWorkbookValue(row, ['priceType', '价格类型', '报价类型']);
        const priceAmountFenRaw = this.pickWorkbookValue(row, ['priceAmountFen', '价格分']);
        const priceAmountYuanRaw = this.pickWorkbookValue(row, ['priceAmountYuan', '价格元', '价格', '报价']);
        const depositAmountFenRaw = this.pickWorkbookValue(row, ['depositAmountFen', '定金分', '保证金分']);
        const depositAmountYuanRaw = this.pickWorkbookValue(row, ['depositAmountYuan', '定金元', '保证金元', '保证金']);
        const regionCodeRaw = this.pickWorkbookValue(row, ['regionCode', '地区编码', '行政区编码']);
        const listingTopicsRaw = this.pickWorkbookValue(row, ['listingTopics', '特色标签', '标签']);
        const industryTagsRaw = this.pickWorkbookValue(row, ['industryTags', '行业标签', '行业']);
        const statusRaw = this.pickWorkbookValue(row, ['status', '上架状态']);
        const auditStatusRaw = this.pickWorkbookValue(row, ['auditStatus', '审核状态']);

        const source = sourceRaw !== undefined ? this.parseContentSourceStrict(sourceRaw, 'source') : defaults.source;
        const sellerUserId =
          sellerUserIdRaw !== undefined
            ? this.parseNonEmptyFilterStrict(sellerUserIdRaw, 'sellerUserId')
            : defaults.sellerUserId;
        const consultationRouting =
          consultationRoutingRaw !== undefined
            ? this.parseConsultationRoutingStrict(consultationRoutingRaw, 'consultationRouting')
            : defaults.consultationRouting;
        const tradeMode =
          tradeModeRaw !== undefined
            ? this.parseTradeModeStrict(tradeModeRaw, 'tradeMode')
            : defaults.tradeMode || 'ASSIGNMENT';
        const licenseMode =
          licenseModeRaw !== undefined
            ? this.parseNullableLicenseModeStrict(licenseModeRaw, 'licenseMode')
            : defaults.licenseMode ?? null;
        const priceType =
          priceTypeRaw !== undefined
            ? this.parsePriceTypeStrict(priceTypeRaw, 'priceType')
            : defaults.priceType || 'NEGOTIABLE';
        const priceAmountFen =
          priceAmountFenRaw !== undefined
            ? this.parseOptionalInt(priceAmountFenRaw, 'priceAmountFen', 0)
            : priceAmountYuanRaw !== undefined
              ? this.parseMoneyYuanToFenOptional(priceAmountYuanRaw, 'priceAmountYuan')
              : defaults.priceAmountFen;
        const depositAmountFen =
          depositAmountFenRaw !== undefined
            ? this.parseOptionalInt(depositAmountFenRaw, 'depositAmountFen', 0)
            : depositAmountYuanRaw !== undefined
              ? this.parseMoneyYuanToFenOptional(depositAmountYuanRaw, 'depositAmountYuan')
              : defaults.depositAmountFen ?? 0;
        const regionCode =
          regionCodeRaw !== undefined
            ? this.parseRegionCodeFilterStrict(regionCodeRaw, 'regionCode')
            : defaults.regionCode;
        const listingTopics =
          listingTopicsRaw !== undefined
            ? this.normalizeListingTopics(this.splitWorkbookTags(listingTopicsRaw))
            : defaults.listingTopics || [];
        const industryTags =
          industryTagsRaw !== undefined ? sanitizeIndustryTagNames(this.splitWorkbookTags(industryTagsRaw)) : defaults.industryTags || [];
        const status =
          statusRaw !== undefined ? this.parseListingStatusStrict(statusRaw, 'status') : defaults.status;
        const auditStatus =
          auditStatusRaw !== undefined ? this.parseAuditStatusStrict(auditStatusRaw, 'auditStatus') : defaults.auditStatus;
        const title = titleRaw !== undefined ? String(titleRaw || '').trim() : undefined;
        const summary = summaryRaw !== undefined ? String(summaryRaw || '').trim() : undefined;

        if (tradeMode !== 'LICENSE' && licenseMode) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'licenseMode is invalid' });
        }
        if (priceType === 'FIXED' && (priceAmountFen === undefined || priceAmountFen === null)) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'priceAmountFen is required' });
        }
        this.assertRegionCodeRequiredForActiveStatus(regionCode ?? null, status);

        payload = {
          patentNumberRaw,
          source,
          sellerUserId,
          consultationRouting,
          title,
          summary,
          tradeMode,
          licenseMode: tradeMode === 'LICENSE' ? licenseMode : null,
          priceType,
          priceAmountFen: priceType === 'NEGOTIABLE' ? undefined : priceAmountFen,
          depositAmountFen,
          regionCode,
          listingTopics,
          industryTags,
          status,
          auditStatus,
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

  private async readFileBufferById(fileId: string): Promise<{ file: any; buffer: Buffer }> {
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
      return { file, buffer: fromService };
    }
    try {
      const local = readFileSync(path.resolve(UPLOAD_DIR, path.basename(fileName)));
      if (!local.length) throw new Error('empty');
      return { file, buffer: local };
    } catch {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'file not found' });
    }
  }

  private async findLatestListingByPatentNumber(patentNumberRaw: string): Promise<{ id: string } | null> {
    const parsed = this.parsePatentNumber(patentNumberRaw);
    const patent = await this.prisma.patent.findFirst({
      where: {
        OR: [
          { applicationNoNorm: parsed.applicationNoNorm },
          {
            identifiers: {
              some: {
                OR: parsed.identifierCandidates.map((c: any) => ({
                  idType: c.idType,
                  idValueNorm: c.idValueNorm,
                })),
              },
            },
          },
        ],
      },
      select: { id: true },
    });
    if (!patent) return null;
    return await this.prisma.listing.findFirst({
      where: { patentId: patent.id },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
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
      if (!Number.isFinite(num) || num < 0 || !Number.isSafeInteger(num)) {
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
      if (!Number.isFinite(num) || num < 0 || !Number.isSafeInteger(num)) {
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
    const coverFile = Array.isArray(it.media)
      ? it.media.find((mediaItem: any) => String(mediaItem?.type || '').toUpperCase() === 'IMAGE' && mediaItem?.file)
          ?.file
      : null;
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
      industryTags: sanitizeIndustryTagNames(it.industryTagsJson),
      listingTopics: this.normalizeListingTopics(it.listingTopicsJson),
      ipcCodes: meta.ipcCodes,
      locCodes: meta.locCodes,
      featuredLevel: it.featuredLevel,
      featuredRegionCode: it.featuredRegionCode ?? null,
      consultationRouting: it.consultationRouting ?? 'PLATFORM',
      auditStatus: it.auditStatus,
      status: it.status,
      coverUrl: resolvePublicFileUrl(coverFile),
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
    const hasListingTopic = this.hasOwn(query, 'listingTopic');
    const auditStatus = hasAuditStatus ? this.parseAuditStatusStrict(query?.auditStatus, 'auditStatus') : undefined;
    const status = hasStatus ? this.parseListingStatusStrict(query?.status, 'status') : undefined;
    const source = hasSource ? this.parseContentSourceStrict(query?.source, 'source') : undefined;
    const listingTopics = this.normalizeListingTopics(query?.listingTopic);
    if (hasListingTopic && listingTopics.length === 0 && String(query?.listingTopic ?? '').trim()) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'listingTopic is invalid' });
    }

    const where: any = {};
    if (q) {
      where.OR = [{ title: { contains: q, mode: 'insensitive' } }];
    }
    if (regionCode) where.regionCode = regionCode;
    if (auditStatus) where.auditStatus = auditStatus;
    if (status) where.status = status;
    if (source) where.source = source;
    if (listingTopics.length > 0) {
      where.AND = listingTopics.map((topic) => ({ listingTopicsJson: { array_contains: [topic] } }));
    }

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
    const hasAuditStatus = this.hasOwn(body, 'auditStatus');
    const hasStatus = this.hasOwn(body, 'status');
    const hasConsultationRouting = this.hasOwn(body, 'consultationRouting');
    const hasSellerUserId = this.hasOwn(body, 'sellerUserId');
    const hasTitle = this.hasOwn(body, 'title');
    const hasSummary = this.hasOwn(body, 'summary');
    const industryTags = sanitizeIndustryTagNames(body?.industryTags);

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
    const auditStatus = hasAuditStatus ? this.parseAuditStatusStrict(body?.auditStatus, 'auditStatus') : 'PENDING';
    const status = hasStatus ? this.parseListingStatusStrict(body?.status, 'status') : 'DRAFT';
    const consultationRouting = hasConsultationRouting
      ? this.parseConsultationRoutingStrict(body?.consultationRouting, 'consultationRouting')
      : 'PLATFORM';

    const sellerUserId = hasSellerUserId
      ? this.parseNonEmptyFilterStrict(body?.sellerUserId, 'sellerUserId')
      : String(req?.auth?.userId || '').trim();
    if (!sellerUserId) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'sellerUserId is required' });
    }
    const listingTopics = this.normalizeListingTopics(body?.listingTopics);
    const proofFileIds = this.normalizeFileIds(body?.proofFileIds);
    const deliverables = this.normalizeStringArray(body?.deliverables);
    const expectedCompletionDays = this.parseOptionalInt(body?.expectedCompletionDays, 'expectedCompletionDays', 1);
    const negotiableRangeFen = this.parseOptionalInt(body?.negotiableRangeFen, 'negotiableRangeFen', 0);
    const negotiableRangePercent = this.parseOptionalFloat(body?.negotiableRangePercent, 'negotiableRangePercent', 0, 100);
    if (negotiableRangeFen !== undefined && negotiableRangePercent !== undefined) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'negotiableRange is invalid' });
    }
    const hasNegotiableNote = this.hasOwn(body, 'negotiableNote');
    const negotiableNote = hasNegotiableNote
      ? this.parseNullableNonEmptyStringStrict(body?.negotiableNote, 'negotiableNote')
      : null;
    const hasEncumbranceNote = this.hasOwn(body, 'encumbranceNote');
    const encumbranceNote = hasEncumbranceNote
      ? this.parseNullableNonEmptyStringStrict(body?.encumbranceNote, 'encumbranceNote')
      : null;
    const parsedTitle = hasTitle ? this.parseNullableNonEmptyStringStrict(body?.title, 'title') : undefined;
    const parsedSummary = hasSummary ? this.parseNullableNonEmptyStringStrict(body?.summary, 'summary') : undefined;
    this.assertRegionCodeRequiredForActiveStatus(hasRegionCode ? regionCode : null, status);
    const patent = await this.ensurePatent(body);
    let resolvedSellerUserId = sellerUserId;
    if (consultationRouting === 'OWNER') {
      const ownerUserId = String(patent?.ownerUserId || '').trim();
      if (!ownerUserId) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'patent owner is required for OWNER routing' });
      }
      resolvedSellerUserId = ownerUserId;
    }
    if (patent) {
      await Promise.all([
        this.syncPatentParties(patent.id, 'INVENTOR', body?.inventorNames),
        this.syncPatentParties(patent.id, 'ASSIGNEE', body?.assigneeNames),
        this.syncPatentParties(patent.id, 'APPLICANT', body?.applicantNames),
        this.syncPatentClassifications(patent.id, 'IPC', body?.ipcCodes),
        this.syncPatentClassifications(patent.id, 'LOC', body?.locCodes),
      ]);
    }
    const fallbackTitle = patent?.title || 'Listing';
    const title = hasTitle ? (parsedTitle ?? fallbackTitle) : fallbackTitle;
    const summary = hasSummary ? parsedSummary : null;
    if (proofFileIds.length > 0) {
      await this.assertOwnedFiles(req.auth.userId, proofFileIds, 'proofFileIds');
    }
    await this.contentSecurity.assertSafeTexts(
      [title, summary, negotiableNote, encumbranceNote],
      {
        requestMeta: {
          actorUserId: req.auth.userId,
          targetType: 'LISTING',
          targetId: req.auth.userId,
        },
      },
    );
    if (proofFileIds.length > 0) {
      await this.contentSecurity.ensureReferencedFilesReady({
        userId: req.auth.userId,
        fileIds: proofFileIds,
        label: 'proofFileIds',
        requestMeta: {
          actorUserId: req.auth.userId,
          targetType: 'LISTING',
          targetId: req.auth.userId,
        },
      });
    }
    const listing = await this.prisma.listing.create({
      data: {
        sellerUserId: resolvedSellerUserId,
        source,
        patentId: patent?.id ?? null,
        title,
        summary,
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
        industryTagsJson: industryTags.length > 0 ? industryTags : Prisma.DbNull,
        listingTopicsJson: listingTopics.length > 0 ? listingTopics : Prisma.DbNull,
        proofFileIdsJson: proofFileIds.length > 0 ? proofFileIds : Prisma.DbNull,
        consultationRouting,
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
    const patentBody = body;
    const hasListingTopics = body?.listingTopics !== undefined;
    const listingTopics = hasListingTopics ? this.normalizeListingTopics(body?.listingTopics) : undefined;
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
    const negotiableNote = hasNegotiableNote
      ? this.parseNullableNonEmptyStringStrict(body?.negotiableNote, 'negotiableNote')
      : undefined;
    const hasPledgeStatus = Object.prototype.hasOwnProperty.call(body || {}, 'pledgeStatus');
    const pledgeStatus = hasPledgeStatus ? this.parseNullablePledgeStatusStrict(body?.pledgeStatus, 'pledgeStatus') : undefined;
    const hasExistingLicenseStatus = Object.prototype.hasOwnProperty.call(body || {}, 'existingLicenseStatus');
    const existingLicenseStatus = hasExistingLicenseStatus
      ? this.parseNullableExistingLicenseStatusStrict(body?.existingLicenseStatus, 'existingLicenseStatus')
      : undefined;
    const hasEncumbranceNote = Object.prototype.hasOwnProperty.call(body || {}, 'encumbranceNote');
    const encumbranceNote = hasEncumbranceNote
      ? this.parseNullableNonEmptyStringStrict(body?.encumbranceNote, 'encumbranceNote')
      : undefined;
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
    const hasConsultationRouting = this.hasOwn(body, 'consultationRouting');
    const consultationRouting = hasConsultationRouting
      ? this.parseConsultationRoutingStrict(body?.consultationRouting, 'consultationRouting')
      : undefined;
    const hasIndustryTags = this.hasOwn(body, 'industryTags');
    const industryTags = hasIndustryTags ? sanitizeIndustryTagNames(body?.industryTags) : undefined;
    const hasSellerUserId = this.hasOwn(body, 'sellerUserId');
    const hasTitle = this.hasOwn(body, 'title');
    const hasSummary = this.hasOwn(body, 'summary');
    let sellerUserId = hasSellerUserId ? this.parseNonEmptyFilterStrict(body?.sellerUserId, 'sellerUserId') : listing.sellerUserId;
    const parsedTitle = hasTitle ? this.parseNullableNonEmptyStringStrict(body?.title, 'title') : undefined;
    const parsedSummary = hasSummary ? this.parseNullableNonEmptyStringStrict(body?.summary, 'summary') : undefined;
    if (body?.patentNumberRaw) {
      const patent = await this.ensurePatent(patentBody);
      if (patent) patentId = patent.id;
    }
    const effectiveConsultationRouting = hasConsultationRouting
      ? consultationRouting
      : (listing as any).consultationRouting || 'PLATFORM';
    if (effectiveConsultationRouting === 'OWNER') {
      const ownerPatentId = patentId ?? listing.patentId;
      if (!ownerPatentId) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'patent owner is required for OWNER routing' });
      }
      const ownerPatent = await this.prisma.patent.findUnique({
        where: { id: ownerPatentId },
        select: { ownerUserId: true },
      });
      const ownerUserId = String(ownerPatent?.ownerUserId || '').trim();
      if (!ownerUserId) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'patent owner is required for OWNER routing' });
      }
      sellerUserId = ownerUserId;
    }
    const nextStatus = hasStatus ? status : listing.status;
    if (hasStatus || hasRegionCode) {
      const nextRegionCode = hasRegionCode ? regionCode : listing.regionCode;
      this.assertRegionCodeRequiredForActiveStatus(nextRegionCode, nextStatus);
    }
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        sellerUserId,
        source: hasSource ? source : listing.source,
        patentId: patentId ?? null,
        title: hasTitle ? (parsedTitle ?? listing.title) : listing.title,
        summary: hasSummary ? (parsedSummary ?? listing.summary) : listing.summary,
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
        industryTagsJson: hasIndustryTags ? (industryTags && industryTags.length > 0 ? industryTags : Prisma.DbNull) : undefined,
        listingTopicsJson: hasListingTopics ? (listingTopics && listingTopics.length > 0 ? listingTopics : Prisma.DbNull) : undefined,
        proofFileIdsJson: hasProofFileIds ? (proofFileIds && proofFileIds.length > 0 ? proofFileIds : Prisma.DbNull) : undefined,
        auditStatus: hasAuditStatus ? auditStatus : listing.auditStatus,
        status: hasStatus ? status : listing.status,
        consultationRouting: hasConsultationRouting ? consultationRouting : (listing as any).consultationRouting,
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
    if (listing.auditStatus !== 'APPROVED') {
      throw new ConflictException({ code: 'CONFLICT', message: 'listing must be approved before publish' });
    }
    if (listing.status === 'SOLD') {
      throw new ConflictException({ code: 'CONFLICT', message: 'listing is sold' });
    }
    this.assertRegionCodeRequiredForActiveStatus(listing.regionCode, 'ACTIVE');
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: 'ACTIVE' },
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

  async createBatchJob(req: any, body: any): Promise<ListingBatchJobDto> {
    this.ensureAdmin(req);
    const operatorUserId = this.parseUuidStrict(req?.auth?.userId, 'operatorUserId');
    const action = this.parseListingBatchActionStrict(body?.action, 'action');
    const listingIds = this.parseUuidArrayStrict(body?.listingIds, 'listingIds', { min: 1, max: 1000 });
    const reason = this.normalizeOptionalReason(body?.reason);
    const scope = `listing-batch-job:${action}:${listingIds.join(',')}`;

    return await this.withIdempotency(req, scope, async () => {
      const created = await this.prisma.$transaction(async (tx) => {
        const totalExisting = await tx.listing.count({ where: { id: { in: listingIds } } });
        if (totalExisting !== listingIds.length) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'listingIds is invalid' });
        }
        const job = await tx.listingBatchJob.create({
          data: {
            operatorUserId,
            action,
            reason: reason || null,
            totalCount: listingIds.length,
          },
        });
        await tx.listingBatchJobItem.createMany({
          data: listingIds.map((listingId: string) => ({
            jobId: job.id,
            listingId,
          })),
          skipDuplicates: true,
        });
        return job;
      });

      setTimeout(() => {
        void this.processBatchJob(created.id).catch(() => {});
      }, 0);

      return this.toBatchJobDto(created);
    });
  }

  async listBatchJobs(_req: any, query: any): Promise<PagedListingBatchJobs> {
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(100, pageSizeInput);
    const status = this.hasOwn(query, 'status') ? this.parseListingJobStatusStrict(query?.status, 'status') : undefined;
    const action = this.hasOwn(query, 'action') ? this.parseListingBatchActionStrict(query?.action, 'action') : undefined;
    const where: any = {};
    if (status) where.status = status;
    if (action) where.action = action;
    const [items, total] = await Promise.all([
      this.prisma.listingBatchJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.listingBatchJob.count({ where }),
    ]);
    return {
      items: items.map((it: any) => this.toBatchJobDto(it)),
      page: { page, pageSize, total },
    };
  }

  async getBatchJob(_req: any, jobId: string): Promise<ListingBatchJobDto> {
    const job = await this.prisma.listingBatchJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'batch job not found' });
    return this.toBatchJobDto(job);
  }

  async listBatchJobItems(_req: any, jobId: string, query: any): Promise<PagedListingBatchJobItems> {
    const job = await this.prisma.listingBatchJob.findUnique({ where: { id: jobId }, select: { id: true } });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'batch job not found' });
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(200, pageSizeInput);
    const status = this.hasOwn(query, 'status')
      ? this.normalizeListingBatchItemStatus(query?.status) || (() => {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'status is invalid' });
        })()
      : undefined;
    const where: any = { jobId };
    if (status) where.status = status;
    const [items, total] = await Promise.all([
      this.prisma.listingBatchJobItem.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.listingBatchJobItem.count({ where }),
    ]);
    return {
      items: items.map((it: any) => this.toBatchJobItemDto(it)),
      page: { page, pageSize, total },
    };
  }

  async getBatchJobErrorFile(req: any, jobId: string): Promise<{ fileId: string | null; url: string | null }> {
    const job = await this.prisma.listingBatchJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'batch job not found' });
    if (!job.errorFileId) return { fileId: null, url: null };
    const file = await this.prisma.file.findUnique({ where: { id: job.errorFileId } });
    return {
      fileId: job.errorFileId,
      url: file?.url || `${this.resolveBaseUrl(req)}/files/${job.errorFileId}`,
    };
  }

  private async applyBatchJobAction(job: { action: ListingBatchAction; reason?: string | null; operatorUserId: string }, listingId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
    }

    if (job.action === 'APPROVE') {
      if (listing.auditStatus === 'APPROVED') return 'SKIPPED' as const;
      await this.approve(listingId, job.operatorUserId, job.reason || undefined);
      return 'SUCCEEDED' as const;
    }
    if (job.action === 'REJECT') {
      if (listing.auditStatus === 'REJECTED') return 'SKIPPED' as const;
      await this.reject(listingId, job.operatorUserId, job.reason || undefined);
      return 'SUCCEEDED' as const;
    }
    if (job.action === 'PUBLISH') {
      if (listing.status === 'ACTIVE') return 'SKIPPED' as const;
      if (listing.status === 'SOLD') {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'listing is sold' });
      }
      if (listing.auditStatus !== 'APPROVED') {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'listing auditStatus must be APPROVED' });
      }
      this.assertRegionCodeRequiredForActiveStatus(listing.regionCode, 'ACTIVE');
      await this.prisma.listing.update({ where: { id: listingId }, data: { status: 'ACTIVE' } });
      return 'SUCCEEDED' as const;
    }
    if (job.action === 'OFF_SHELF') {
      if (listing.status === 'OFF_SHELF') return 'SKIPPED' as const;
      if (listing.status === 'SOLD') {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'listing is sold' });
      }
      await this.prisma.listing.update({ where: { id: listingId }, data: { status: 'OFF_SHELF' } });
      return 'SUCCEEDED' as const;
    }
    throw new BadRequestException({ code: 'BAD_REQUEST', message: 'action is invalid' });
  }

  private extractJobError(error: any): { code: string; message: string } {
    const code = String(error?.response?.code || error?.code || 'BATCH_JOB_FAILED');
    const message =
      String(error?.response?.message || error?.message || 'batch job item failed').slice(0, 1000) ||
      'batch job item failed';
    return { code, message };
  }

  private async processBatchJob(jobId: string): Promise<void> {
    const startAt = new Date();
    const lock = await this.prisma.listingBatchJob.updateMany({
      where: { id: jobId, status: { in: ['PENDING', 'PAUSED'] } },
      data: { status: 'RUNNING', startedAt: startAt, pausedAt: null, finishedAt: null },
    });
    if (!lock.count) return;

    const job = await this.prisma.listingBatchJob.findUnique({ where: { id: jobId } });
    if (!job) return;

    const pendingItems = await this.prisma.listingBatchJobItem.findMany({
      where: { jobId, status: 'PENDING' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    let successCount = Number(job.successCount || 0);
    let failedCount = Number(job.failedCount || 0);
    let skippedCount = Number(job.skippedCount || 0);
    let processedInRun = 0;
    let paused = false;

    for (const item of pendingItems) {
      try {
        const result = await this.applyBatchJobAction(
          {
            action: job.action as ListingBatchAction,
            reason: job.reason,
            operatorUserId: job.operatorUserId,
          },
          item.listingId,
        );
        const nextStatus = result === 'SKIPPED' ? 'SKIPPED' : 'SUCCEEDED';
        if (nextStatus === 'SKIPPED') skippedCount += 1;
        else successCount += 1;
        await this.prisma.listingBatchJobItem.update({
          where: { id: item.id },
          data: {
            status: nextStatus,
            errorCode: null,
            errorMessage: null,
            processedAt: new Date(),
          },
        });
      } catch (error: any) {
        failedCount += 1;
        const mapped = this.extractJobError(error);
        await this.prisma.listingBatchJobItem.update({
          where: { id: item.id },
          data: {
            status: 'FAILED',
            errorCode: mapped.code,
            errorMessage: mapped.message,
            processedAt: new Date(),
          },
        });
      }

      processedInRun += 1;
      const processedTotal = successCount + failedCount + skippedCount;
      const runtimeFailRate = processedTotal > 0 ? failedCount / processedTotal : 0;
      if (processedInRun >= 10 && runtimeFailRate > 0.3) {
        paused = true;
        break;
      }
    }

    const failedItems = await this.prisma.listingBatchJobItem.findMany({
      where: { jobId, status: 'FAILED' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const errorFileId = await this.createOwnedCsvFile({
      ownerUserId: job.operatorUserId,
      filenamePrefix: `listing-batch-job-${jobId}`,
      headers: ['jobId', 'listingId', 'errorCode', 'errorMessage'],
      rows: failedItems.map((it: any) => [jobId, it.listingId, it.errorCode, it.errorMessage]),
    });

    const processedTotal = successCount + failedCount + skippedCount;
    const failRate = processedTotal > 0 ? failedCount / processedTotal : 0;
    const nextStatus: ListingJobStatus = paused ? 'PAUSED' : failedCount > 0 ? 'FAILED' : 'SUCCEEDED';
    await this.prisma.listingBatchJob.update({
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

  async createImportJob(req: any, body: any): Promise<ListingImportJobDto> {
    this.ensureAdmin(req);
    const operatorUserId = this.parseUuidStrict(req?.auth?.userId, 'operatorUserId');
    const fileId = this.parseUuidStrict(body?.fileId, 'fileId');
    const duplicatePolicy = this.hasOwn(body, 'duplicatePolicy')
      ? this.parseListingImportDuplicatePolicyStrict(body?.duplicatePolicy, 'duplicatePolicy')
      : 'SKIP';
    const defaults = this.parseImportDefaults(body);

    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException({ code: 'NOT_FOUND', message: 'file not found' });

    const scope = `listing-import-job:${fileId}:${duplicatePolicy}`;
    return await this.withIdempotency(req, scope, async () => {
      const created = await this.prisma.listingImportJob.create({
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

  async validateImportJob(_req: any, jobId: string): Promise<ListingImportJobDto> {
    const job = await this.prisma.listingImportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'import job not found' });

    const { file, buffer } = await this.readFileBufferById(job.fileId);
    let rows: Array<Record<string, any>>;
    try {
      rows = await readWorkbookRowsFromBuffer(buffer, { fileName: String(file?.fileName || '') });
    } catch {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'import file is invalid' });
    }
    if (!rows.length) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'import file is empty' });
    }

    const defaults = this.parseImportDefaults({ defaults: job.defaultsJson || {} });
    const normalizedRows = this.normalizeImportRows(rows, defaults);
    const totalCount = normalizedRows.length;
    const validCount = normalizedRows.filter((it) => it.status === 'VALID').length;
    const invalidCount = normalizedRows.filter((it) => it.status === 'INVALID').length;
    const failRate = totalCount > 0 ? invalidCount / totalCount : 0;

    await this.prisma.$transaction([
      this.prisma.listingImportJobRow.deleteMany({ where: { jobId } }),
      this.prisma.listingImportJobRow.createMany({
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
      this.prisma.listingImportJob.update({
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

    const updated = await this.prisma.listingImportJob.findUnique({ where: { id: jobId } });
    if (!updated) throw new NotFoundException({ code: 'NOT_FOUND', message: 'import job not found' });
    return this.toImportJobDto(updated);
  }

  async executeImportJob(_req: any, jobId: string): Promise<ListingImportJobDto> {
    const job = await this.prisma.listingImportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'import job not found' });
    if (!job.validatedAt) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'import job has not been validated' });
    }

    await this.prisma.listingImportJob.update({
      where: { id: jobId },
      data: { status: 'PENDING', pausedAt: null, finishedAt: null },
    });

    setTimeout(() => {
      void this.processImportJob(jobId).catch(() => {});
    }, 0);

    const latest = await this.prisma.listingImportJob.findUnique({ where: { id: jobId } });
    if (!latest) throw new NotFoundException({ code: 'NOT_FOUND', message: 'import job not found' });
    return this.toImportJobDto(latest);
  }

  async listImportJobs(_req: any, query: any): Promise<PagedListingImportJobs> {
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(100, pageSizeInput);
    const status = this.hasOwn(query, 'status') ? this.parseListingJobStatusStrict(query?.status, 'status') : undefined;
    const duplicatePolicy = this.hasOwn(query, 'duplicatePolicy')
      ? this.parseListingImportDuplicatePolicyStrict(query?.duplicatePolicy, 'duplicatePolicy')
      : undefined;
    const where: any = {};
    if (status) where.status = status;
    if (duplicatePolicy) where.duplicatePolicy = duplicatePolicy;
    const [items, total] = await Promise.all([
      this.prisma.listingImportJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.listingImportJob.count({ where }),
    ]);
    return {
      items: items.map((it: any) => this.toImportJobDto(it)),
      page: { page, pageSize, total },
    };
  }

  async getImportJob(_req: any, jobId: string): Promise<ListingImportJobDto> {
    const job = await this.prisma.listingImportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'import job not found' });
    return this.toImportJobDto(job);
  }

  async listImportJobRows(_req: any, jobId: string, query: any): Promise<PagedListingImportJobRows> {
    const job = await this.prisma.listingImportJob.findUnique({ where: { id: jobId }, select: { id: true } });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'import job not found' });
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(200, pageSizeInput);
    const status = this.hasOwn(query, 'status')
      ? this.normalizeListingImportRowStatus(query?.status) || (() => {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'status is invalid' });
        })()
      : undefined;
    const where: any = { jobId };
    if (status) where.status = status;
    const [items, total] = await Promise.all([
      this.prisma.listingImportJobRow.findMany({
        where,
        orderBy: [{ rowNo: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.listingImportJobRow.count({ where }),
    ]);
    return {
      items: items.map((it: any) => this.toImportJobRowDto(it)),
      page: { page, pageSize, total },
    };
  }

  async getImportJobErrorFile(req: any, jobId: string): Promise<{ fileId: string | null; url: string | null }> {
    const job = await this.prisma.listingImportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'import job not found' });
    if (!job.errorFileId) return { fileId: null, url: null };
    const file = await this.prisma.file.findUnique({ where: { id: job.errorFileId } });
    return {
      fileId: job.errorFileId,
      url: file?.url || `${this.resolveBaseUrl(req)}/files/${job.errorFileId}`,
    };
  }

  private async processImportJob(jobId: string): Promise<void> {
    const startAt = new Date();
    const lock = await this.prisma.listingImportJob.updateMany({
      where: { id: jobId, status: { in: ['PENDING', 'PAUSED'] } },
      data: { status: 'RUNNING', startedAt: startAt, pausedAt: null, finishedAt: null },
    });
    if (!lock.count) return;

    const job = await this.prisma.listingImportJob.findUnique({ where: { id: jobId } });
    if (!job) return;

    const validRows = await this.prisma.listingImportJobRow.findMany({
      where: { jobId, status: 'VALID' },
      orderBy: [{ rowNo: 'asc' }, { id: 'asc' }],
    });

    let successCount = Number(job.successCount || 0);
    let failedCount = Math.max(Number(job.failedCount || 0), Number(job.invalidCount || 0));
    let skippedCount = Number(job.skippedCount || 0);
    let processedInRun = 0;
    let paused = false;

    const reqAsAdmin = { auth: { userId: job.operatorUserId, isAdmin: true } };
    for (const row of validRows) {
      try {
        const payload = (row.normalizedJson || {}) as Record<string, any>;
        const patentNumberRaw = String(payload?.patentNumberRaw || '').trim();
        if (!patentNumberRaw) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: 'patentNumberRaw is required' });
        }

        let listingId: string | null = null;
        const existing = await this.findLatestListingByPatentNumber(patentNumberRaw);
        if (existing && job.duplicatePolicy === 'SKIP') {
          listingId = existing.id;
          skippedCount += 1;
          await this.prisma.listingImportJobRow.update({
            where: { id: row.id },
            data: {
              status: 'SKIPPED',
              listingId,
              errorCode: null,
              errorMessage: null,
              processedAt: new Date(),
            },
          });
        } else if (existing && job.duplicatePolicy === 'OVERWRITE') {
          const updated = await this.adminUpdate(reqAsAdmin, existing.id, payload);
          listingId = updated.id;
          successCount += 1;
          await this.prisma.listingImportJobRow.update({
            where: { id: row.id },
            data: {
              status: 'SUCCEEDED',
              listingId,
              errorCode: null,
              errorMessage: null,
              processedAt: new Date(),
            },
          });
        } else {
          const created = await this.adminCreate(reqAsAdmin, payload);
          listingId = created.id;
          successCount += 1;
          await this.prisma.listingImportJobRow.update({
            where: { id: row.id },
            data: {
              status: 'SUCCEEDED',
              listingId,
              errorCode: null,
              errorMessage: null,
              processedAt: new Date(),
            },
          });
        }
      } catch (error: any) {
        failedCount += 1;
        const mapped = this.extractJobError(error);
        await this.prisma.listingImportJobRow.update({
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
      const processedTotal = successCount + skippedCount + Math.max(0, failedCount - Number(job.invalidCount || 0));
      const runtimeFailed = Math.max(0, failedCount - Number(job.invalidCount || 0));
      const runtimeFailRate = processedTotal > 0 ? runtimeFailed / processedTotal : 0;
      if (processedInRun >= 10 && runtimeFailRate > 0.3) {
        paused = true;
        break;
      }
    }

    const failedRows = await this.prisma.listingImportJobRow.findMany({
      where: {
        jobId,
        status: { in: ['FAILED', 'INVALID'] },
      },
      orderBy: [{ rowNo: 'asc' }, { id: 'asc' }],
    });

    const errorFileId = await this.createOwnedCsvFile({
      ownerUserId: job.operatorUserId,
      filenamePrefix: `listing-import-job-${jobId}`,
      headers: ['jobId', 'rowNo', 'status', 'errorCode', 'errorMessage', 'listingId', 'patentNumberRaw', 'title'],
      rows: failedRows.map((it: any) => [
        jobId,
        it.rowNo,
        it.status,
        it.errorCode,
        it.errorMessage,
        it.listingId,
        (it.normalizedJson as any)?.patentNumberRaw,
        (it.normalizedJson as any)?.title,
      ]),
    });

    const totalCount = Number(job.totalCount || 0);
    const failRate = totalCount > 0 ? failedCount / totalCount : 0;
    const nextStatus: ListingJobStatus = paused ? 'PAUSED' : failedCount > 0 ? 'FAILED' : 'SUCCEEDED';
    await this.prisma.listingImportJob.update({
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
        if (!Number.isFinite(featuredRank) || !Number.isSafeInteger(featuredRank) || featuredRank < 0) {
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
          listingTopics: this.normalizeListingTopics(it.listingTopicsJson),
          proofFileIds: this.normalizeStringArray(it.proofFileIdsJson),
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
      listingTopics: this.normalizeListingTopics(it.listingTopicsJson),
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
    const hasTitle = this.hasOwn(body, 'title');
    const hasSummary = this.hasOwn(body, 'summary');
    const industryTags = sanitizeIndustryTagNames(body?.industryTags);
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
    const listingTopics = this.normalizeListingTopics(body?.listingTopics);
    const proofFileIds = this.normalizeFileIds(body?.proofFileIds);
    const deliverables = this.normalizeStringArray(body?.deliverables);
    const expectedCompletionDays = this.parseOptionalInt(body?.expectedCompletionDays, 'expectedCompletionDays', 1);
    const negotiableRangeFen = this.parseOptionalInt(body?.negotiableRangeFen, 'negotiableRangeFen', 0);
    const negotiableRangePercent = this.parseOptionalFloat(body?.negotiableRangePercent, 'negotiableRangePercent', 0, 100);
    if (negotiableRangeFen !== undefined && negotiableRangePercent !== undefined) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'negotiableRange is invalid' });
    }
    const hasNegotiableNote = this.hasOwn(body, 'negotiableNote');
    const negotiableNote = hasNegotiableNote
      ? this.parseNullableNonEmptyStringStrict(body?.negotiableNote, 'negotiableNote')
      : null;
    const hasEncumbranceNote = this.hasOwn(body, 'encumbranceNote');
    const encumbranceNote = hasEncumbranceNote
      ? this.parseNullableNonEmptyStringStrict(body?.encumbranceNote, 'encumbranceNote')
      : null;
    const parsedTitle = hasTitle ? this.parseNullableNonEmptyStringStrict(body?.title, 'title') : undefined;
    const parsedSummary = hasSummary ? this.parseNullableNonEmptyStringStrict(body?.summary, 'summary') : undefined;
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
    const fallbackTitle = patent?.title || 'Listing';
    const title = hasTitle ? (parsedTitle ?? fallbackTitle) : fallbackTitle;
    const summary = hasSummary ? parsedSummary : null;
    if (proofFileIds.length > 0) {
      await this.assertOwnedFiles(req.auth.userId, proofFileIds, 'proofFileIds');
    }
    await this.contentSecurity.assertSafeTexts(
      [title, summary, negotiableNote, encumbranceNote],
      {
        requestMeta: {
          actorUserId: req.auth.userId,
          targetType: 'LISTING',
          targetId: req.auth.userId,
        },
      },
    );
    if (proofFileIds.length > 0) {
      await this.contentSecurity.ensureReferencedFilesReady({
        userId: req.auth.userId,
        fileIds: proofFileIds,
        label: 'proofFileIds',
        requestMeta: {
          actorUserId: req.auth.userId,
          targetType: 'LISTING',
          targetId: req.auth.userId,
        },
      });
    }
    const listing = await this.prisma.listing.create({
      data: {
        sellerUserId: req.auth.userId,
        source: 'USER',
        patentId: patent?.id ?? null,
        title,
        summary,
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
        industryTagsJson: industryTags.length > 0 ? industryTags : Prisma.DbNull,
        listingTopicsJson: listingTopics.length > 0 ? listingTopics : Prisma.DbNull,
        proofFileIdsJson: proofFileIds.length > 0 ? proofFileIds : Prisma.DbNull,
        consultationRouting: 'OWNER',
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
    const hasListingTopics = body?.listingTopics !== undefined;
    const listingTopics = hasListingTopics ? this.normalizeListingTopics(body?.listingTopics) : undefined;
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
    const negotiableNote = hasNegotiableNote
      ? this.parseNullableNonEmptyStringStrict(body?.negotiableNote, 'negotiableNote')
      : undefined;
    const hasPledgeStatus = this.hasOwn(body, 'pledgeStatus');
    const pledgeStatus = hasPledgeStatus ? this.parseNullablePledgeStatusStrict(body?.pledgeStatus, 'pledgeStatus') : undefined;
    const hasExistingLicenseStatus = this.hasOwn(body, 'existingLicenseStatus');
    const existingLicenseStatus = hasExistingLicenseStatus
      ? this.parseNullableExistingLicenseStatusStrict(body?.existingLicenseStatus, 'existingLicenseStatus')
      : undefined;
    const hasEncumbranceNote = Object.prototype.hasOwnProperty.call(body || {}, 'encumbranceNote');
    const encumbranceNote = hasEncumbranceNote
      ? this.parseNullableNonEmptyStringStrict(body?.encumbranceNote, 'encumbranceNote')
      : undefined;
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
    const hasIndustryTags = this.hasOwn(body, 'industryTags');
    const industryTags = hasIndustryTags ? sanitizeIndustryTagNames(body?.industryTags) : undefined;
    const hasTitle = this.hasOwn(body, 'title');
    const hasSummary = this.hasOwn(body, 'summary');
    const parsedTitle = hasTitle ? this.parseNullableNonEmptyStringStrict(body?.title, 'title') : undefined;
    const parsedSummary = hasSummary ? this.parseNullableNonEmptyStringStrict(body?.summary, 'summary') : undefined;
    if (body?.patentNumberRaw) {
      const patent = await this.ensurePatent(body);
      if (patent) patentId = patent.id;
    }
    if (hasRegionCode) {
      this.assertRegionCodeRequiredForActiveStatus(regionCode, listing.status as ListingStatus);
    }
    await this.contentSecurity.assertSafeTexts(
      [
        hasTitle ? (parsedTitle ?? listing.title) : listing.title,
        hasSummary ? (parsedSummary ?? listing.summary) : listing.summary,
        hasNegotiableNote ? negotiableNote : listing.negotiableNote,
        hasEncumbranceNote ? encumbranceNote : listing.encumbranceNote,
      ],
      {
        requestMeta: {
          actorUserId: req.auth.userId,
          targetType: 'LISTING',
          targetId: listingId,
        },
      },
    );
    const effectiveProofFileIds = hasProofFileIds ? proofFileIds ?? [] : this.normalizeFileIds((listing as any).proofFileIdsJson);
    if (effectiveProofFileIds.length > 0) {
      await this.assertOwnedFiles(req.auth.userId, effectiveProofFileIds, 'proofFileIds');
      await this.contentSecurity.ensureReferencedFilesReady({
        userId: req.auth.userId,
        fileIds: effectiveProofFileIds,
        label: 'proofFileIds',
        requestMeta: {
          actorUserId: req.auth.userId,
          targetType: 'LISTING',
          targetId: listingId,
        },
      });
    }
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        patentId: patentId ?? null,
        title: hasTitle ? (parsedTitle ?? listing.title) : listing.title,
        summary: hasSummary ? (parsedSummary ?? listing.summary) : listing.summary,
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
        industryTagsJson: hasIndustryTags ? (industryTags && industryTags.length > 0 ? industryTags : Prisma.DbNull) : undefined,
        listingTopicsJson: hasListingTopics ? (listingTopics && listingTopics.length > 0 ? listingTopics : Prisma.DbNull) : undefined,
        proofFileIdsJson: hasProofFileIds ? (proofFileIds && proofFileIds.length > 0 ? proofFileIds : Prisma.DbNull) : undefined,
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
    await this.contentSecurity.assertSafeTexts(
      [listing.title, listing.summary, listing.negotiableNote, listing.encumbranceNote],
      {
        requestMeta: {
          actorUserId: req.auth.userId,
          targetType: 'LISTING',
          targetId: listingId,
        },
      },
    );
    await this.contentSecurity.ensureReferencedFilesReady({
      userId: req.auth.userId,
      fileIds: proofFileIds,
      label: 'proofFileIds',
      requestMeta: {
        actorUserId: req.auth.userId,
        targetType: 'LISTING',
        targetId: listingId,
      },
    });
    this.assertRegionCodeRequiredForActiveStatus(listing.regionCode, 'ACTIVE');
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
    const applicant = String(query?.applicant || '').trim();
    const assignee = String(query?.assignee || '').trim();
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
    const listingTopics = this.normalizeListingTopics(query?.listingTopic);
    const ipcList = this.normalizeStringArray(query?.ipc)
      .map((v: any) => String(v || '').trim().toUpperCase())
      .filter((v: any) => v.length > 0);
    const locList = this.normalizeStringArray(query?.loc)
      .map((v: any) => String(v || '').trim().toUpperCase())
      .filter((v: any) => v.length > 0);

    const parseStrictQueryIntFilter = (primaryKey: string) => {
      const hasPrimary = this.hasOwn(query, primaryKey);
      if (!hasPrimary) return undefined;
      const key = primaryKey;
      const raw = query?.[primaryKey];
      const parsed = this.parseOptionalInt(raw, key, 0);
      if (parsed === undefined) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: `${key} is invalid` });
      }
      return parsed;
    };

    const priceMin = parseStrictQueryIntFilter('priceMin');
    const priceMax = parseStrictQueryIntFilter('priceMax');
    const depositMin = parseStrictQueryIntFilter('depositMin');
    const depositMax = parseStrictQueryIntFilter('depositMax');
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

    const industryTags = sanitizeIndustryTagNames(query?.industryTags);

    const where: any = { auditStatus: 'APPROVED', status: 'ACTIVE' };
    if (regionCode) where.regionCode = regionCode;
    if (tradeMode) where.tradeMode = tradeMode;
    if (licenseMode) where.licenseMode = licenseMode;
    if (priceType) where.priceType = priceType;
    if (sellerUserId) where.sellerUserId = sellerUserId;
    if (listingTopics.length > 0) {
      const listingTopicFilters = listingTopics.map((topic) => {
        if (topic === 'OPEN_LICENSE') {
          return {
            OR: [{ tradeMode: 'LICENSE' }, { listingTopicsJson: { array_contains: ['OPEN_LICENSE'] } }],
          };
        }
        if (topic === 'SLEEPING') {
          return {
            OR: [{ patent: { transferCount: 0 } }, { listingTopicsJson: { array_contains: ['SLEEPING'] } }],
          };
        }
        if (topic === 'HIGH_TECH_RETIRED') {
          return {
            OR: [
              { listingTopicsJson: { array_contains: ['HIGH_TECH_RETIRED'] } },
              { patent: { legalStatus: { in: ['EXPIRED', 'INVALIDATED'] } } },
            ],
          };
        }
        if (topic === 'AWARD_WINNING') {
          return {
            OR: [
              { listingTopicsJson: { array_contains: ['AWARD_WINNING'] } },
              { featuredLevel: { not: 'NONE' } },
            ],
          };
        }
        if (topic === 'FIVE_STAR') {
          return {
            OR: [
              { listingTopicsJson: { array_contains: ['FIVE_STAR'] } },
              { featuredLevel: { not: 'NONE' } },
            ],
          };
        }
        return { listingTopicsJson: { array_contains: [topic] } };
      });
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), ...listingTopicFilters];
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
        }
        orFilters.push({ title: { contains: q, mode: 'insensitive' } });
        orFilters.push({ summary: { contains: q, mode: 'insensitive' } });
        orFilters.push({ patent: { title: { contains: q, mode: 'insensitive' } } });
        orFilters.push({ patent: { abstract: { contains: q, mode: 'insensitive' } } });
        orFilters.push({ patent: { applicationNoDisplay: { contains: q, mode: 'insensitive' } } });
        orFilters.push({ patent: { publicationNoDisplay: { contains: q, mode: 'insensitive' } } });
        orFilters.push({ patent: { patentNoDisplay: { contains: q, mode: 'insensitive' } } });
        orFilters.push({
          patent: {
            classifications: { some: { code: { contains: q.toUpperCase() } } },
          },
        });
      } else {
        if (ftsIds.length > 0) {
          orFilters.push({ id: { in: ftsIds } });
        }
        orFilters.push({ title: { contains: q, mode: 'insensitive' } });
        orFilters.push({ summary: { contains: q, mode: 'insensitive' } });
        orFilters.push({ patent: { title: { contains: q, mode: 'insensitive' } } });
        orFilters.push({ patent: { abstract: { contains: q, mode: 'insensitive' } } });
        orFilters.push({ patent: { applicationNoDisplay: { contains: q, mode: 'insensitive' } } });
        orFilters.push({ patent: { publicationNoDisplay: { contains: q, mode: 'insensitive' } } });
        orFilters.push({ patent: { patentNoDisplay: { contains: q, mode: 'insensitive' } } });
        orFilters.push({
          patent: {
            classifications: { some: { code: { contains: q.toUpperCase() } } },
          },
        });
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

    const include = { patent: { include: { parties: true, classifications: true } }, stats: true, media: { include: { file: true } } };

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
      include: { patent: { include: { parties: true, classifications: true } }, seller: true, stats: true, media: { include: { file: true } } },
    });
    if (!it) throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
    void this.events.recordView(req, 'LISTING', listingId).catch(() => {});
    const meta = this.extractPatentMeta(it.patent);
    const detailCoverFile = Array.isArray(it.media)
      ? it.media.find((mediaItem: any) => String(mediaItem?.type || '').toUpperCase() === 'IMAGE' && mediaItem?.file)
          ?.file
      : null;
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
      industryTags: sanitizeIndustryTagNames(it.industryTagsJson),
      listingTopics: this.normalizeListingTopics(it.listingTopicsJson),
      featuredLevel: it.featuredLevel,
      featuredRegionCode: it.featuredRegionCode ?? null,
      recommendationScore: null,
      auditStatus: it.auditStatus,
      status: it.status,
      coverUrl: resolvePublicFileUrl(detailCoverFile),
      createdAt: it.createdAt.toISOString(),
      updatedAt: it.updatedAt.toISOString(),
      stats: mapStats(it.stats),
      seller: it.seller
        ? {
            id: it.seller.id,
            nickname: this.resolvePublicSellerNickname(it),
            avatarUrl: resolvePublicFileUrl({ url: it.seller.avatarUrl }),
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
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        contentType: 'LISTING',
        contentId: listingId,
        buyerUserId: req.auth.userId,
        sellerUserId: listing.sellerUserId,
      },
    });
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          contentType: 'LISTING',
          contentId: listingId,
          listingId: listing.id,
          buyerUserId: req.auth.userId,
          sellerUserId: listing.sellerUserId,
        },
      });
    }
    return { ok: true, conversationId: conversation.id };
  }
}
