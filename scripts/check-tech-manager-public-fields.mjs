/* eslint-disable no-console */
import process from 'node:process';

const REQUIRED_COLUMNS = ['experience_label', 'level_label'];

async function main() {
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    console.error('[check-tech-manager-public-fields] DATABASE_URL is required.');
    process.exit(1);
  }

  let PrismaClient;
  try {
    ({ PrismaClient } = await import('../apps/api/node_modules/@prisma/client/index.js'));
  } catch (error) {
    console.error('[check-tech-manager-public-fields] failed to load Prisma client.');
    console.error(error);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe(`
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = 'tech_manager_profiles'
    `);
    const columns = new Set((rows || []).map((item) => String(item?.column_name || '').trim()).filter(Boolean));
    const missing = REQUIRED_COLUMNS.filter((column) => !columns.has(column));
    if (missing.length) {
      console.error(
        `[check-tech-manager-public-fields] missing columns in public.tech_manager_profiles: ${missing.join(', ')}`,
      );
      process.exit(1);
    }
    console.log('[check-tech-manager-public-fields] ok');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[check-tech-manager-public-fields] failed');
  console.error(error);
  process.exit(1);
});
