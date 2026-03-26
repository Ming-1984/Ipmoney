/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULT_DEMO_USER_ID = '8c592d03-c1c1-40be-8d62-64ce71ac7606';
const DEFAULT_DEMO_ADMIN_ID = '804b7a04-aafe-409a-bee4-e84f953cb4c0';

const demoUserId = String(process.env.DEMO_USER_ID || DEFAULT_DEMO_USER_ID).trim() || DEFAULT_DEMO_USER_ID;
const demoAdminId =
  String(process.env.DEMO_ADMIN_ID || DEFAULT_DEMO_ADMIN_ID).trim() || DEFAULT_DEMO_ADMIN_ID;

const demoUserNickname =
  String(process.env.DEMO_USER_NICKNAME || '').trim() || '\u6f14\u793a\u7528\u6237';
const demoAdminNickname =
  String(process.env.DEMO_ADMIN_NICKNAME || '').trim() || '\u5e73\u53f0\u7ba1\u7406\u5458';

async function main() {
  const results = await Promise.all([
    prisma.user.updateMany({ where: { id: demoUserId }, data: { nickname: demoUserNickname } }),
    prisma.user.updateMany({ where: { id: demoAdminId }, data: { nickname: demoAdminNickname } }),
  ]);

  console.log(
    `[fix-demo-nicknames] admin(${demoAdminId}) updated=${results[1].count} nickname=${demoAdminNickname}`,
  );
  console.log(
    `[fix-demo-nicknames] user(${demoUserId}) updated=${results[0].count} nickname=${demoUserNickname}`,
  );
}

main()
  .catch((err) => {
    console.error('[fix-demo-nicknames] failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
