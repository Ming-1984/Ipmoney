import { Injectable } from '@nestjs/common';
import { Prisma, PatentType } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class InventorsService {
  constructor(private readonly prisma: PrismaService) {}

  search(query: any) {
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const q = String(query?.q || '').trim();
    const regionCode = String(query?.regionCode || '').trim();
    const patentType = String(query?.patentType || '').trim().toUpperCase();
    const qLike = q ? `%${q}%` : null;
    const region = regionCode || null;
    const type = patentType && Object.values(PatentType).includes(patentType as PatentType) ? (patentType as PatentType) : null;
    const offset = (page - 1) * pageSize;

    return this.queryRankings(qLike, region, type, offset, pageSize, page, pageSize);
  }

  private async queryRankings(
    qLike: string | null,
    regionCode: string | null,
    patentType: PatentType | null,
    offset: number,
    limit: number,
    page: number,
    pageSize: number,
  ) {
    const countRows = await this.prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT p.name) AS total
      FROM patent_parties p
      JOIN patents pa ON pa.id = p.patent_id
      JOIN listings l ON l.patent_id = pa.id
      WHERE p.role = 'INVENTOR'
        AND (${qLike}::text IS NULL OR p.name ILIKE ${qLike})
        AND (${regionCode}::text IS NULL OR l.region_code = ${regionCode})
        AND (${patentType}::text IS NULL OR pa.patent_type = ${patentType})
    `);
    const total = Number(countRows[0]?.total ?? 0);

    if (!total) {
      return { items: [], page: { page, pageSize, total: 0 } };
    }

    const rows = await this.prisma.$queryRaw<
      Array<{ inventorName: string; patentCount: number; listingCount: number; avatarUrl: string | null }>
    >(Prisma.sql`
      SELECT
        p.name AS "inventorName",
        COUNT(DISTINCT p.patent_id)::int AS "patentCount",
        COUNT(DISTINCT l.id)::int AS "listingCount",
        MAX(av.avatar_url) AS "avatarUrl"
      FROM patent_parties p
      JOIN patents pa ON pa.id = p.patent_id
      JOIN listings l ON l.patent_id = pa.id
      LEFT JOIN LATERAL (
        SELECT u.avatar_url
        FROM user_verifications uv
        JOIN users u ON u.id = uv.user_id
        WHERE uv.display_name = p.name
          AND uv.status = 'APPROVED'
        ORDER BY u.updated_at DESC
        LIMIT 1
      ) av ON true
      WHERE p.role = 'INVENTOR'
        AND (${qLike}::text IS NULL OR p.name ILIKE ${qLike})
        AND (${regionCode}::text IS NULL OR l.region_code = ${regionCode})
        AND (${patentType}::text IS NULL OR pa.patent_type = ${patentType})
      GROUP BY p.name
      ORDER BY "patentCount" DESC, "listingCount" DESC, "inventorName" ASC
      OFFSET ${offset} LIMIT ${limit}
    `);

    return { items: rows, page: { page, pageSize, total } };
  }
}
