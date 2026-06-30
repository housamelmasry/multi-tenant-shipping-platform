// prisma/seeds/super-admin.seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export async function seedSuperAdmin(prisma: PrismaClient) {
  console.log('👤 التحقق من Super Admin...');

  const email = process.env.SUPER_ADMIN_EMAIL ?? 'admin@shipping.com';
  const password = process.env.SUPER_ADMIN_PASSWORD ?? 'Admin@123456';
  const name = process.env.SUPER_ADMIN_NAME ?? 'Super Admin';

  // التحقق من الوجود المسبق
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    console.log(`   ⏭️  Super Admin موجود بالفعل (${email})`);
    return existing;
  }

  // إنشاء Super Admin
  const hashedPassword = await bcrypt.hash(password, 12);

  const superAdmin = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      tenantId: null,
      isActive: true,
    },
  });

  console.log(`   ✅ تم إنشاء Super Admin`);
  console.log(`   📧 Email:    ${email}`);
  console.log(`   🔑 Password: ${password}`);
  console.log(`   ⚠️  يرجى تغيير كلمة المرور فور تسجيل الدخول\n`);

  return superAdmin;
}
