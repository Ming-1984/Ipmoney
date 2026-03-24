/* eslint-disable no-console */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let PrismaClient;
try {
  ({ PrismaClient } = require('@prisma/client'));
} catch {
  ({ PrismaClient } = require('../apps/api/node_modules/@prisma/client'));
}

const REGION_CODE_RE = /^[0-9]{6}$/;

function parseArgs(argv) {
  const out = {
    apply: false,
    scope: 'active-approved',
  };
  for (const raw of argv) {
    const arg = String(raw || '').trim();
    if (!arg) continue;
    if (arg === '--apply') {
      out.apply = true;
      continue;
    }
    if (arg.startsWith('--scope=')) {
      const scope = arg.slice('--scope='.length).trim().toLowerCase();
      if (scope === 'active-approved' || scope === 'all') out.scope = scope;
      continue;
    }
  }
  return out;
}

function normalizeCode(input, regionSet) {
  const raw = String(input || '').trim();
  if (!raw || !REGION_CODE_RE.test(raw)) return '';
  if (!regionSet.has(raw)) return '';
  return raw;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  const startedAt = new Date();
  try {
    const regions = await prisma.region.findMany({ select: { code: true } });
    const regionSet = new Set(regions.map((it) => String(it.code || '').trim()).filter(Boolean));

    const where =
      args.scope === 'active-approved'
        ? { regionCode: null, auditStatus: 'APPROVED', status: 'ACTIVE' }
        : { regionCode: null };

    const listings = await prisma.listing.findMany({
      where,
      select: {
        id: true,
        sellerUserId: true,
        regionCode: true,
        status: true,
        auditStatus: true,
        seller: { select: { regionCode: true } },
        patent: {
          select: {
            ownerUserId: true,
            owner: { select: { regionCode: true } },
          },
        },
      },
    });

    const userIds = new Set();
    for (const row of listings) {
      const sellerUserId = String(row.sellerUserId || '').trim();
      if (sellerUserId) userIds.add(sellerUserId);
      const ownerUserId = String(row.patent?.ownerUserId || '').trim();
      if (ownerUserId) userIds.add(ownerUserId);
    }

    const verifications = userIds.size
      ? await prisma.userVerification.findMany({
          where: {
            userId: { in: Array.from(userIds) },
            verificationStatus: 'APPROVED',
            regionCode: { not: null },
          },
          orderBy: [{ reviewedAt: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
          select: { userId: true, regionCode: true },
        })
      : [];

    const verificationRegionByUser = new Map();
    for (const row of verifications) {
      const userId = String(row.userId || '').trim();
      if (!userId || verificationRegionByUser.has(userId)) continue;
      const code = normalizeCode(row.regionCode, regionSet);
      if (code) verificationRegionByUser.set(userId, code);
    }

    const plan = [];
    const reasonStats = new Map();
    let conflictCount = 0;
    let unresolvedCount = 0;

    for (const row of listings) {
      const sellerUserId = String(row.sellerUserId || '').trim();
      const ownerUserId = String(row.patent?.ownerUserId || '').trim();
      const sellerVerification = normalizeCode(verificationRegionByUser.get(sellerUserId), regionSet);
      const sellerProfile = normalizeCode(row.seller?.regionCode, regionSet);
      const ownerVerification = normalizeCode(verificationRegionByUser.get(ownerUserId), regionSet);
      const ownerProfile = normalizeCode(row.patent?.owner?.regionCode, regionSet);

      const sellerCandidate = sellerVerification || sellerProfile || '';
      const ownerCandidate = ownerVerification || ownerProfile || '';
      const conflict = sellerCandidate && ownerCandidate && sellerCandidate !== ownerCandidate;
      if (conflict) {
        conflictCount += 1;
        unresolvedCount += 1;
        continue;
      }

      let nextRegionCode = '';
      let reason = '';
      if (sellerVerification) {
        nextRegionCode = sellerVerification;
        reason = 'seller_verification';
      } else if (sellerProfile) {
        nextRegionCode = sellerProfile;
        reason = 'seller_profile';
      } else if (ownerVerification) {
        nextRegionCode = ownerVerification;
        reason = 'owner_verification';
      } else if (ownerProfile) {
        nextRegionCode = ownerProfile;
        reason = 'owner_profile';
      } else {
        unresolvedCount += 1;
        continue;
      }

      reasonStats.set(reason, Number(reasonStats.get(reason) || 0) + 1);
      plan.push({ listingId: row.id, regionCode: nextRegionCode, reason });
    }

    let applied = 0;
    if (args.apply && plan.length > 0) {
      for (const item of plan) {
        await prisma.listing.update({
          where: { id: item.listingId },
          data: { regionCode: item.regionCode },
        });
        applied += 1;
      }
    }

    const summary = {
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      scope: args.scope,
      apply: args.apply,
      totalMissing: listings.length,
      resolvable: plan.length,
      applied,
      unresolved: unresolvedCount,
      conflicts: conflictCount,
      reasonBreakdown: Object.fromEntries(Array.from(reasonStats.entries()).sort((a, b) => b[1] - a[1])),
      sampleResolvable: plan.slice(0, 20),
    };
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
