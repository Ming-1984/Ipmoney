import { PrismaService } from '../common/prisma/prisma.service';

export type OrganizationSummary = {
  userId: string;
  displayName: string;
  verificationType: string;
  verificationStatus: string;
  orgCategory?: string | null;
  regionCode?: string | null;
  logoUrl?: string | null;
  intro?: string | null;
  stats?: unknown;
  verifiedAt?: string | null;
};

export type ContentMediaDto = {
  fileId: string;
  type: string;
  sort: number;
  url?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  fileName?: string | null;
};

export type MediaInput = { fileId?: string; type?: string; sort?: number };

export function normalizeStringArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .map((value) => String(value || '').trim())
      .filter((value) => value.length > 0);
  }
  if (typeof input === 'string') {
    return input
      .split(',')
      .map((value) => String(value || '').trim())
      .filter((value) => value.length > 0);
  }
  return [];
}

export function normalizeMediaInput(input: unknown): Array<{ fileId: string; type: string; sort: number }> {
  if (!Array.isArray(input)) return [];
  return input
    .map((item, index) => {
      const fileId = String((item as MediaInput)?.fileId || '').trim();
      const type = String((item as MediaInput)?.type || '').trim().toUpperCase();
      const sortValue = (item as MediaInput)?.sort;
      const sort = Number.isFinite(Number(sortValue)) ? Number(sortValue) : index;
      return { fileId, type, sort };
    })
    .filter((item) => item.fileId && ['IMAGE', 'VIDEO', 'FILE'].includes(item.type));
}

export function mapContentMedia(records: Array<{ fileId: string; type: string; sort: number; file?: any }> = []): ContentMediaDto[] {
  return [...records]
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((item) => ({
      fileId: item.fileId,
      type: item.type,
      sort: item.sort ?? 0,
      url: item.file?.url ?? null,
      mimeType: item.file?.mimeType ?? null,
      sizeBytes: item.file?.sizeBytes ?? null,
      fileName: item.file?.fileName ?? null,
    }));
}

export function mapStats(
  stats?: { viewCount?: number; favoriteCount?: number; consultCount?: number; commentCount?: number } | null,
) {
  return {
    viewCount: stats?.viewCount ?? 0,
    favoriteCount: stats?.favoriteCount ?? 0,
    consultCount: stats?.consultCount ?? 0,
    commentCount: stats?.commentCount ?? 0,
  };
}

function toPublisherSummary(user: any, verification?: any): OrganizationSummary {
  const verificationType = verification?.verificationType ?? 'PERSON';
  const verificationStatus = verification?.verificationStatus ?? 'PENDING';
  return {
    userId: user.id,
    displayName: verification?.displayName ?? user.nickname ?? 'User',
    verificationType,
    verificationStatus,
    orgCategory: null,
    regionCode: verification?.regionCode ?? user.regionCode ?? null,
    logoUrl: verification?.logoFile?.url ?? null,
    intro: verification?.intro ?? null,
    stats: undefined,
    verifiedAt: verification?.reviewedAt ? verification.reviewedAt.toISOString() : null,
  };
}

export async function buildPublisherMap(prisma: PrismaService, userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter((id) => String(id || '').length > 0)));
  if (uniqueIds.length === 0) return {} as Record<string, OrganizationSummary>;

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    include: {
      verifications: {
        orderBy: { submittedAt: 'desc' },
        take: 1,
        include: { logoFile: true },
      },
    },
  });

  const map: Record<string, OrganizationSummary> = {};
  for (const user of users) {
    const verification = user.verifications?.[0];
    map[user.id] = toPublisherSummary(user, verification);
  }
  return map;
}

