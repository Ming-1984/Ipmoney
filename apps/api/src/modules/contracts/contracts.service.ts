import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

type ContractStatus = 'WAIT_UPLOAD' | 'WAIT_CONFIRM' | 'AVAILABLE';

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

const CONTRACT_STATE = new Map<string, ContractItem>();

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  async list(req: any, query: any): Promise<ContractListResponse> {
    this.ensureAuth(req);
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const orders = await this.prisma.order.findMany({
      where: {
        OR: [{ buyerUserId: req.auth.userId }, { listing: { sellerUserId: req.auth.userId } }],
      },
      include: { listing: true },
      orderBy: { createdAt: 'desc' },
    });

    const items: ContractItem[] = orders.map((order: { id: string; createdAt: Date; listing?: { title?: string | null } | null }) => {
      const id = `contract-${order.id}`;
      const cached = CONTRACT_STATE.get(id);
      const base: ContractItem = cached
        ? { ...cached }
        : {
        id,
        orderId: order.id,
        listingTitle: order.listing?.title ?? null,
        counterpartName: null,
        status: 'WAIT_UPLOAD',
        createdAt: order.createdAt.toISOString(),
      };

      // Only sellers can upload contract PDFs.
      return { ...base, canUpload: String(order.listing?.sellerUserId || '') === String(req.auth.userId) };
    });

    const slice = items.slice((page - 1) * pageSize, page * pageSize);
    return { items: slice, page: { page, pageSize, total: items.length } };
  }

  async upload(req: any, contractId: string, body: any): Promise<ContractItem> {
    this.ensureAuth(req);
    const orderId = contractId.replace(/^contract-/, '');
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { listing: true } });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: '订单不存在' });

    const sellerUserId = String(order.listing?.sellerUserId || '');
    if (!sellerUserId || sellerUserId !== String(req.auth.userId)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '仅卖家可上传合同' });
    }

    const now = new Date().toISOString();
    const contractFileId = body?.contractFileId ? String(body.contractFileId).trim() : '';

    let fileUrl = 'https://example.com/contract.pdf';
    if (contractFileId) {
      const file = await this.prisma.file.findUnique({ where: { id: contractFileId } });
      if (!file) throw new BadRequestException({ code: 'BAD_REQUEST', message: '合同文件不存在' });
      if (String(file.mimeType || '') !== 'application/pdf') {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: '仅支持上传 PDF 合同' });
      }
      fileUrl = file.url;
    }

    const current = CONTRACT_STATE.get(contractId);
    const updated: ContractItem = {
      ...(current || {
        id: contractId,
        orderId,
        status: 'WAIT_UPLOAD' as ContractStatus,
        createdAt: now,
      }),
      status: 'WAIT_CONFIRM',
      uploadedAt: now,
      fileUrl,
      watermarkOwner: sellerUserId,
    };
    CONTRACT_STATE.set(contractId, updated);
    return updated;
  }
}
