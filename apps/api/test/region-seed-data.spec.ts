import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveRegionCodeForStorage } from '../src/common/region-code';

type SeedRegion = {
  code: string;
  name: string;
  level: 'PROVINCE' | 'CITY' | 'DISTRICT';
  parentCode: string | null;
};

const seedPath = path.resolve(__dirname, '../prisma/seed-data/regions-cn.json');
const regions = JSON.parse(fs.readFileSync(seedPath, 'utf8')) as SeedRegion[];
const regionByCode = new Map(regions.map((region) => [region.code, region]));

describe('region seed data', () => {
  it('contains province, city, and district rows with parent links', () => {
    expect(regionByCode.get('130000')).toMatchObject({
      code: '130000',
      name: '河北省',
      level: 'PROVINCE',
      parentCode: null,
    });
    expect(regionByCode.get('130200')).toMatchObject({
      code: '130200',
      name: '唐山市',
      level: 'CITY',
      parentCode: '130000',
    });
    expect(regionByCode.get('130202')).toMatchObject({
      code: '130202',
      name: '路南区',
      level: 'DISTRICT',
      parentCode: '130200',
    });
  });

  it('keeps exact district codes when resolving a profile region', async () => {
    const prisma = {
      region: {
        findMany: async ({ where }: any) =>
          regions
            .filter((region) => where.code.in.includes(region.code))
            .map((region) => ({ code: region.code })),
      },
    };

    await expect(resolveRegionCodeForStorage(prisma, '130202', 'regionCode')).resolves.toBe('130202');
  });
});
