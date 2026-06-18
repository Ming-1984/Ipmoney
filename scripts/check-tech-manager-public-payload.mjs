/* eslint-disable no-console */
import process from 'node:process';

const BASE_URL = String(process.env.API_BASE_URL || process.env.PUBLIC_API_BASE_URL || '').trim();

async function main() {
  if (!BASE_URL) {
    console.error('[check-tech-manager-public-payload] API_BASE_URL or PUBLIC_API_BASE_URL is required.');
    process.exit(1);
  }

  const url = new URL('/search/tech-managers?page=1&pageSize=3', BASE_URL);
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`[check-tech-manager-public-payload] request failed: ${response.status} ${response.statusText}`);
    process.exit(1);
  }

  const payload = await response.json();
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const missing = [];

  for (const item of items) {
    const keys = item && typeof item === 'object' ? Object.keys(item) : [];
    if (!keys.includes('experienceLabel')) missing.push(`experienceLabel@${String(item?.userId || 'unknown')}`);
    if (!keys.includes('levelLabel')) missing.push(`levelLabel@${String(item?.userId || 'unknown')}`);
  }

  if (missing.length) {
    console.error(
      `[check-tech-manager-public-payload] missing fields in public payload: ${missing.join(', ')}`,
    );
    process.exit(1);
  }

  console.log('[check-tech-manager-public-payload] ok');
}

main().catch((error) => {
  console.error('[check-tech-manager-public-payload] failed');
  console.error(error);
  process.exit(1);
});
