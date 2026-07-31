import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContractSignedSubmissionStatus, ContractStatus } from '@prisma/client';

import { AuditLogService } from '../../common/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeDisplayText, resolvePublicFileUrl } from '../content-utils';
import { NotificationsService } from '../notifications/notifications.service';

type ContractSignedSubmissionDto = {
  id: string;
  orderId: string;
  contractId: string;
  status: ContractSignedSubmissionStatus;
  fileId: string;
  fileUrl?: string | null;
  fileName?: string | null;
  submittedByUserId: string;
  submittedByName?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  rejectReason?: string | null;
};

type ContractItem = {
  id: string;
  orderId: string;
  listingTitle?: string | null;
  counterpartName?: string | null;
  status: ContractStatus;
  createdAt: string;
  uploadedAt?: string | null;
  signedAt?: string | null;
  fileUrl?: string | null;
  watermarkOwner?: string | null;
  canUpload?: boolean;
  latestSignedSubmission?: ContractSignedSubmissionDto | null;
};

type ContractListResponse = {
  items: ContractItem[];
  page: { page: number; pageSize: number; total: number };
};

const CONTRACT_ID_PREFIX = 'contract-';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_SUBMISSION_INCLUDE = {
  file: true,
  submittedBy: { include: { verifications: { orderBy: { submittedAt: 'desc' as const }, take: 1 } } },
  reviewedBy: { include: { verifications: { orderBy: { submittedAt: 'desc' as const }, take: 1 } } },
};
const CONTRACT_INCLUDE = {
  contractFile: true,
  signedContractFile: true,
  signedSubmissions: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    include: SIGNED_SUBMISSION_INCLUDE,
  },
};

type SupersededSignedSubmission = {
  id: string;
  fileId: string;
  submittedByUserId: string;
};

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly notifications: NotificationsService,
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
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private parseUuidStrict(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw || !UUID_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseOrderId(contractId: string) {
    const id = String(contractId || '');
    const normalizedId = id.startsWith(CONTRACT_ID_PREFIX) ? id.slice(CONTRACT_ID_PREFIX.length) : id;
    return this.parseUuidStrict(normalizedId, 'contractId');
  }

  private userDisplayName(user: any): string | null {
    return (
      normalizeDisplayText(user?.verifications?.[0]?.displayName) ??
      normalizeDisplayText(user?.nickname) ??
      normalizeDisplayText(user?.phone) ??
      null
    );
  }

  private buildSignedSubmissionDto(submission?: any | null): ContractSignedSubmissionDto | null {
    if (!submission) return null;
    return {
      id: submission.id,
      orderId: submission.orderId,
      contractId: `${CONTRACT_ID_PREFIX}${submission.contractOrderId || submission.orderId}`,
      status: submission.status as ContractSignedSubmissionStatus,
      fileId: submission.fileId,
      fileUrl: resolvePublicFileUrl(submission.file, { baseUrl: process.env.BASE_URL }) ?? submission.file?.url ?? null,
      fileName: submission.file?.fileName ?? null,
      submittedByUserId: submission.submittedByUserId,
      submittedByName: this.userDisplayName(submission.submittedBy),
      createdAt: submission.createdAt ? submission.createdAt.toISOString() : new Date().toISOString(),
      reviewedAt: submission.reviewedAt ? submission.reviewedAt.toISOString() : null,
      rejectReason: submission.rejectReason ?? null,
    };
  }

  private buildContractItem(order: any, contract: any | null, userId: string): ContractItem {
    const isSeller = String(order.listing?.sellerUserId || '') === String(userId);
    const counterpart = isSeller ? order.buyer : order.listing?.seller;
    const createdAt = (contract?.createdAt || order.createdAt) as Date;
    const uploadedAt = contract?.uploadedAt ? contract.uploadedAt.toISOString() : null;
    const signedAt = contract?.signedAt ? contract.signedAt.toISOString() : null;
    const fileUrl =
      resolvePublicFileUrl(contract?.contractFile, { baseUrl: process.env.BASE_URL }) ??
      resolvePublicFileUrl({ url: contract?.fileUrl ?? null }, { baseUrl: process.env.BASE_URL }) ??
      null;

    const counterpartVerificationDisplayName = normalizeDisplayText(counterpart?.verifications?.[0]?.displayName);
    const counterpartNickname = normalizeDisplayText(counterpart?.nickname);

    return {
      id: `${CONTRACT_ID_PREFIX}${order.id}`,
      orderId: order.id,
      listingTitle: order.listing?.title ?? null,
      counterpartName: counterpartVerificationDisplayName ?? counterpartNickname ?? null,
      status: (contract?.status ?? 'WAIT_UPLOAD') as ContractStatus,
      createdAt: createdAt.toISOString(),
      uploadedAt,
      signedAt,
      fileUrl,
      watermarkOwner: contract?.watermarkOwner ?? null,
      canUpload: isSeller,
      latestSignedSubmission: this.buildSignedSubmissionDto(contract?.signedSubmissions?.[0] ?? null),
    };
  }

  private async notifyAssignedContractReviewer(order: any) {
    let reviewerUserId = order?.assignedCsUserId ? String(order.assignedCsUserId) : '';
    if (!reviewerUserId) {
      const cs = await this.prisma.user.findFirst({ where: { role: 'cs' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
      reviewerUserId = cs?.id || '';
    }
    if (!reviewerUserId) return;
    await this.notifications.create({
      userId: reviewerUserId,
      title: '用户已回传签署版合同',
      summary: `${normalizeDisplayText(order?.listing?.title) || '交易标的待确认'} 已收到签署版合同，请进入订单核对确认。`,
      source: '交易通知',
    });
  }

  private async logSupersededSubmissions(
    actorUserId: string,
    orderId: string,
    submissions: SupersededSignedSubmission[],
    reason: string,
    req?: any,
  ) {
    for (const submission of submissions) {
      await this.audit.log({
        actorUserId,
        action: 'CONTRACT_SIGNED_SUBMISSION_SUPERSEDE',
        targetType: 'CONTRACT_SIGNED_SUBMISSION',
        targetId: submission.id,
        afterJson: {
          orderId,
          contractId: `${CONTRACT_ID_PREFIX}${orderId}`,
          fileId: submission.fileId,
          submittedByUserId: submission.submittedByUserId,
          status: 'SUPERSEDED',
          reason,
        },
        requestId: req?.headers?.['x-request-id'] || req?.headers?.['x-requestid'],
        ip: req?.ip,
        userAgent: req?.headers?.['user-agent'],
      });
    }
  }

  async list(req: any, query: any): Promise<ContractListResponse> {
    this.ensureAuth(req);
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
    const hasStatus = this.hasOwn(query, 'status');
    const status = String(query?.status || '').trim().toUpperCase();
    const hasOrderId = this.hasOwn(query, 'orderId');
    const normalizedStatus =
      status === 'WAIT_UPLOAD' || status === 'WAIT_CONFIRM' || status === 'AVAILABLE' ? (status as ContractStatus) : null;
    if (hasStatus && !normalizedStatus) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'status is invalid' });
    }

    const baseWhere: any = {
      OR: [{ buyerUserId: req.auth.userId }, { listing: { sellerUserId: req.auth.userId } }],
    };

    if (hasOrderId) {
      baseWhere.id = this.parseUuidStrict(query?.orderId, 'orderId');
    }

    if (normalizedStatus && !hasOrderId) {
      if (normalizedStatus === 'WAIT_UPLOAD') {
        baseWhere.AND = [
          {
            OR: [{ contract: { is: null } }, { contract: { is: { status: normalizedStatus } } }],
          },
        ];
      } else {
        baseWhere.AND = [{ contract: { is: { status: normalizedStatus } } }];
      }
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: baseWhere,
        include: {
          listing: { include: { seller: { include: { verifications: { orderBy: { submittedAt: 'desc' }, take: 1 } } } } },
          buyer: { include: { verifications: { orderBy: { submittedAt: 'desc' }, take: 1 } } },
          contract: { include: CONTRACT_INCLUDE },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where: baseWhere }),
    ]);

    return {
      items: orders.map((order: any) => this.buildContractItem(order, order.contract ?? null, req.auth.userId)),
      page: { page, pageSize, total },
    };
  }

  async upload(req: any, contractId: string, body: any): Promise<ContractItem> {
    this.ensureAuth(req);
    const orderId = this.parseOrderId(contractId);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: { include: { seller: { include: { verifications: { orderBy: { submittedAt: 'desc' }, take: 1 } } } } },
        buyer: { include: { verifications: { orderBy: { submittedAt: 'desc' }, take: 1 } } },
        contract: { include: CONTRACT_INCLUDE },
      },
    });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: '订单不存在' });

    const sellerUserId = String(order.listing?.sellerUserId || '');
    if (!sellerUserId || sellerUserId !== String(req.auth.userId)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '仅卖家可上传合同' });
    }

    const now = new Date();
    const rawContractFileId = body?.contractFileId ? String(body.contractFileId).trim() : '';
    if (!rawContractFileId) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'contractFileId is required' });
    }
    const contractFileId = this.parseUuidStrict(rawContractFileId, 'contractFileId');

    const file = await this.prisma.file.findUnique({ where: { id: contractFileId } });
    if (!file) throw new BadRequestException({ code: 'BAD_REQUEST', message: '合同文件不存在' });
    if (String(file.ownerId || '') !== sellerUserId) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'contractFileId is invalid' });
    }
    if (String(file.mimeType || '') !== 'application/pdf') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: '仅支持上传 PDF 合同' });
    }
    const fileUrl = resolvePublicFileUrl(file, { baseUrl: process.env.BASE_URL }) ?? file.url;

    const result = await this.prisma.$transaction(async (tx) => {
      const superseded = await tx.contractSignedSubmission.findMany({
        where: { orderId, status: 'PENDING' },
        select: { id: true, fileId: true, submittedByUserId: true },
      });
      if (superseded.length) {
        await tx.contractSignedSubmission.updateMany({
          where: { orderId, status: 'PENDING' },
          data: { status: 'SUPERSEDED' },
        });
      }
      const contract = await tx.contract.upsert({
        where: { orderId },
        create: {
          orderId,
          status: 'WAIT_CONFIRM',
          contractFileId: contractFileId || null,
          signedContractFileId: null,
          signedSubmissionId: null,
          fileUrl,
          uploadedAt: now,
          signedAt: null,
          watermarkOwner: sellerUserId,
        },
        update: {
          status: 'WAIT_CONFIRM',
          contractFileId: contractFileId || null,
          signedContractFileId: null,
          signedSubmissionId: null,
          fileUrl,
          uploadedAt: now,
          signedAt: null,
          watermarkOwner: sellerUserId,
        },
        include: CONTRACT_INCLUDE,
      });
      return { contract, superseded };
    });

    await this.logSupersededSubmissions(req.auth.userId, orderId, result.superseded, 'CONTRACT_FILE_REPLACED', req);

    const contract = result.contract;
    return this.buildContractItem({ ...order, contract }, contract, req.auth.userId);
  }

  async submitSignedContract(req: any, contractId: string, body: any): Promise<ContractSignedSubmissionDto> {
    this.ensureAuth(req);
    const orderId = this.parseOrderId(contractId);
    const rawFileId = body?.fileId ? String(body.fileId).trim() : '';
    if (!rawFileId) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'fileId is required' });
    }
    const fileId = this.parseUuidStrict(rawFileId, 'fileId');

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: { include: { seller: { include: { verifications: { orderBy: { submittedAt: 'desc' }, take: 1 } } } } },
        buyer: { include: { verifications: { orderBy: { submittedAt: 'desc' }, take: 1 } } },
        contract: { include: CONTRACT_INCLUDE },
      },
    });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: '\u8ba2\u5355\u4e0d\u5b58\u5728' });

    const userId = String(req.auth.userId || '');
    const sellerUserId = String(order.listing?.sellerUserId || '');
    if (userId !== String(order.buyerUserId || '') && userId !== sellerUserId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '\u4ec5\u8ba2\u5355\u4e70\u5356\u53cc\u65b9\u53ef\u4e0a\u4f20\u7b7e\u7f72\u7248\u5408\u540c',
      });
    }
    if (!order.contract?.contractFileId || order.contract.status !== 'WAIT_CONFIRM') {
      throw new ConflictException({
        code: 'CONFLICT',
        message: '\u5f53\u524d\u5408\u540c\u72b6\u6001\u4e0d\u5141\u8bb8\u4e0a\u4f20\u7b7e\u7f72\u7248',
      });
    }

    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: '\u7b7e\u7f72\u7248\u5408\u540c\u6587\u4ef6\u4e0d\u5b58\u5728',
      });
    }
    if (String(file.ownerId || '') !== userId) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'fileId is invalid' });
    }
    if (String(file.mimeType || '') !== 'application/pdf') {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: '\u4ec5\u652f\u6301\u4e0a\u4f20 PDF \u7b7e\u7f72\u7248\u5408\u540c',
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const superseded = await tx.contractSignedSubmission.findMany({
        where: { orderId, status: 'PENDING' },
        select: { id: true, fileId: true, submittedByUserId: true },
      });
      if (superseded.length) {
        await tx.contractSignedSubmission.updateMany({
          where: { orderId, status: 'PENDING' },
          data: { status: 'SUPERSEDED' },
        });
      }
      const submission = await tx.contractSignedSubmission.create({
        data: {
          orderId,
          contractOrderId: orderId,
          fileId,
          submittedByUserId: userId,
          status: 'PENDING',
        },
        include: SIGNED_SUBMISSION_INCLUDE,
      });
      return { submission, superseded };
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'CONTRACT_SIGNED_SUBMISSION_CREATE',
      targetType: 'CONTRACT_SIGNED_SUBMISSION',
      targetId: result.submission.id,
      afterJson: {
        orderId,
        contractId: `${CONTRACT_ID_PREFIX}${orderId}`,
        fileId,
        status: result.submission.status,
        supersededCount: result.superseded.length,
      },
      requestId: req?.headers?.['x-request-id'] || req?.headers?.['x-requestid'],
      ip: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });
    await this.logSupersededSubmissions(userId, orderId, result.superseded, 'NEW_SIGNED_SUBMISSION', req);
    await this.notifyAssignedContractReviewer(order);

    const dto = this.buildSignedSubmissionDto(result.submission);
    if (!dto) throw new Error('empty signed submission');
    return dto;
  }
}
