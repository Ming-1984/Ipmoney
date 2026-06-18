/* eslint-disable no-console */
import process from 'node:process';

const BASE_URL = String(process.env.API_BASE_URL || process.env.PUBLIC_API_BASE_URL || '').trim();

function looksPlaceholder(value) {
  const text = String(value ?? '').trim();
  if (!text) return true;
  return ['-', '--', '无', '暂无', '暂无信息', '未提供', '待补充', 'null', 'NULL'].includes(text);
}

async function main() {
  if (!BASE_URL) {
    console.error('[audit-tech-manager-public-content] API_BASE_URL or PUBLIC_API_BASE_URL is required.');
    process.exit(1);
  }

  const url = new URL('/search/tech-managers?page=1&pageSize=100', BASE_URL);
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`[audit-tech-manager-public-content] request failed: ${response.status} ${response.statusText}`);
    process.exit(1);
  }

  const payload = await response.json();
  const items = Array.isArray(payload?.items) ? payload.items : [];

  const summary = {
    total: items.length,
    missingExperienceLabel: 0,
    missingLevelLabel: 0,
    placeholderPosition: 0,
    placeholderIntro: 0,
    placeholderOrganization: 0,
  };

  for (const item of items) {
    if (!('experienceLabel' in item) || looksPlaceholder(item?.experienceLabel)) summary.missingExperienceLabel += 1;
    if (!('levelLabel' in item) || looksPlaceholder(item?.levelLabel)) summary.missingLevelLabel += 1;
    if (looksPlaceholder(item?.position)) summary.placeholderPosition += 1;
    if (looksPlaceholder(item?.intro)) summary.placeholderIntro += 1;
    if (looksPlaceholder(item?.organization)) summary.placeholderOrganization += 1;
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('[audit-tech-manager-public-content] failed');
  console.error(error);
  process.exit(1);
});
