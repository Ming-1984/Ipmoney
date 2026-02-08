import { ForbiddenException, Injectable } from '@nestjs/common';

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
      if (cached) return cached;
      return {
        id,
        orderId: order.id,
        listingTitle: order.listing?.title ?? null,
        counterpartName: null,
        status: 'WAIT_UPLOAD',
        createdAt: order.createdAt.toISOString(),
      };
    });

    const slice = items.slice((page - 1) * pageSize, page * pageSize);
    return { items: slice, page: { page, pageSize, total: items.length } };
  }

  async upload(req: any, contractId: string): Promise<ContractItem> {
    this.ensureAuth(req);
    const now = new Date().toISOString();
    const current = CONTRACT_STATE.get(contractId);
    const updated: ContractItem = {
      ...(current || {
        id: contractId,
        orderId: contractId.replace(/^contract-/, ''),
        status: 'WAIT_UPLOAD' as ContractStatus,
        createdAt: now,
      }),
      status: 'WAIT_CONFIRM',
      uploadedAt: now,
      fileUrl: 'https://example.com/contract.pdf',
      watermarkOwner: req.auth.userId,
    };
    CONTRACT_STATE.set(contractId, updated);
    return updated;
  }
}
