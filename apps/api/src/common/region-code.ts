import { BadRequestException } from '@nestjs/common';

const REGION_CODE_RE = /^[0-9]{6}$/;

type RegionLookupClient = {
  region?: {
    findMany(args: any): Promise<Array<{ code: string }>>;
  };
};

type ResolveRegionCodeOptions = {
  allowEmpty?: boolean;
};

function parseRegionCode(
  value: unknown,
  fieldName: string,
  options?: ResolveRegionCodeOptions,
): string | null {
  if (value === null) return null;
  const raw = String(value ?? '').trim();
  if (!raw) {
    if (options?.allowEmpty) return null;
    throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
  }
  if (!REGION_CODE_RE.test(raw)) {
    throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
  }
  return raw;
}

function buildRegionFallbackCandidates(code: string): string[] {
  const candidates = [code];
  if (!code.endsWith('00')) candidates.push(`${code.slice(0, 4)}00`);
  if (!code.endsWith('0000')) candidates.push(`${code.slice(0, 2)}0000`);
  return Array.from(new Set(candidates.filter(Boolean)));
}

export async function resolveRegionCodeForStorage(
  prisma: RegionLookupClient,
  value: unknown,
  fieldName: string,
  options?: ResolveRegionCodeOptions,
): Promise<string | null> {
  const code = parseRegionCode(value, fieldName, options);
  if (!code) return null;

  if (!prisma?.region || typeof prisma.region.findMany !== 'function') {
    return code;
  }

  const candidates = buildRegionFallbackCandidates(code);
  const found = await prisma.region.findMany({
    where: { code: { in: candidates } },
    select: { code: true },
  });
  const foundSet = new Set(found.map((item) => String(item.code || '').trim()).filter(Boolean));
  const matched = candidates.find((candidate) => foundSet.has(candidate));
  if (matched) return matched;

  throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
}
