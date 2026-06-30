// prisma/seeds/index.ts
import { PrismaClient } from '@prisma/client';
import { seedSuperAdmin } from './super-admin.seed';
import { seedDemoTenant } from './demo-tenant.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 بدء تهيئة قاعدة البيانات...\n');

  const isDev = process.env.NODE_ENV === 'development';

  // ─── إلزامي في كل البيئات ────────────────────────────
  await seedSuperAdmin(prisma);

  // ─── للـ development فقط ──────────────────────────────
  if (isDev) {
    await seedDemoTenant(prisma);
  }

  console.log('\n✅ تمت التهيئة بنجاح');
}

main()
  .catch((error) => {
    console.error('❌ خطأ في التهيئة:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
