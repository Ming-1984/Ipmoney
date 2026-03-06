import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContractStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

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
};

type ContractListResponse = {
  items: ContractItem[];
  page: { page: number; pageSize: number; total: number };
};

const CONTRACT_ID_PREFIX = 'contract-';

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  private parseOrderId(contractId: string) {
    const id = String(contractId || '');
    if (id.startsWith(CONTRACT_ID_PREFIX)) return id.slice(CONTRACT_ID_PREFIX.length);
    return id;
  }

  private buildContractItem(order: any, contract: any | null, userId: string): ContractItem {
    const isSeller = String(order.listing?.sellerUserId || '') === String(userId);
    const counterpart = isSeller ? order.buyer : order.listing?.seller;
    const createdAt = (contract?.createdAt || order.createdAt) as Date;
    const uploadedAt = contract?.uploadedAt ? contract.uploadedAt.toISOString() : null;
    const signedAt = contract?.signedAt ? contract.signedAt.toISOString() : null;
    const fileUrl = contract?.fileUrl ?? contract?.contractFile?.url ?? null;

    return {
      id: `${CONTRACT_ID_PREFIX}${order.id}`,
      orderId: order.id,
      listingTitle: order.listing?.title ?? null,
      counterpartName: counterpart?.nickname ?? null,
      status: (contract?.status ?? 'WAIT_UPLOAD') as ContractStatus,
      createdAt: createdAt.toISOString(),
      uploadedAt,
      signedAt,
      fileUrl,
      watermarkOwner: contract?.watermarkOwner ?? null,
      canUpload: isSeller,
    };
  }

  async list(req: any, query: any): Promise<ContractListResponse> {
    this.ensureAuth(req);
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const hasStatus = !!query && Object.prototype.hasOwnProperty.call(query, 'status');
    const status = String(query?.status || '').trim().toUpperCase();
    const normalizedStatus =
      status === 'WAIT_UPLOAD' || status === 'WAIT_CONFIRM' || status === 'AVAILABLE' ? (status as ContractStatus) : null;
    if (hasStatus && !normalizedStatus) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'status is invalid' });
    }

    const baseWhere: any = {
      OR: [{ buyerUserId: req.auth.userId }, { listing: { sellerUserId: req.auth.userId } }],
    };

    if (normalizedStatus) {
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
          listing: { include: { seller: true } },
          buyer: true,
          contract: { include: { contractFile: true } },
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
      include: { listing: { include: { seller: true } }, buyer: true, contract: { include: { contractFile: true } } },
    });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: '订单不存在' });

    const sellerUserId = String(order.listing?.sellerUserId || '');
    if (!sellerUserId || sellerUserId !== String(req.auth.userId)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '仅卖家可上传合同' });
    }

    const now = new Date();
    const contractFileId = body?.contractFileId ? String(body.contractFileId).trim() : '';
    if (!contractFileId) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'contractFileId is required' });
    }

    const file = await this.prisma.file.findUnique({ where: { id: contractFileId } });
    if (!file) throw new BadRequestException({ code: 'BAD_REQUEST', message: '合同文件不存在' });
    if (String(file.mimeType || '') !== 'application/pdf') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: '仅支持上传 PDF 合同' });
    }
    const fileUrl = file.url;

    const contract = await this.prisma.contract.upsert({
      where: { orderId },
      create: {
        orderId,
        status: 'WAIT_CONFIRM',
        contractFileId: contractFileId || null,
        fileUrl,
        uploadedAt: now,
        watermarkOwner: sellerUserId,
      },
      update: {
        status: 'WAIT_CONFIRM',
        contractFileId: contractFileId || null,
        fileUrl,
        uploadedAt: now,
        watermarkOwner: sellerUserId,
      },
      include: { contractFile: true },
    });

    return this.buildContractItem({ ...order, contract }, contract, req.auth.userId);
  }
}
