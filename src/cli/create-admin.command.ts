// src/cli/create-admin.command.ts
// لإنشاء super admin جديد من الـ terminal بدون seed

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DatabaseService } from '@database/database.service';
import * as bcrypt from 'bcryptjs';
import * as readline from 'readline';

async function createAdmin() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get(DatabaseService);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (q: string) =>
    new Promise<string>((resolve) => rl.question(q, resolve));

  console.log('\n🔐 إنشاء Super Admin جديد\n');

  const name = await question('الاسم: ');
  const email = await question('الإيميل: ');
  const password = await question('كلمة المرور: ');

  // التحقق
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log('\n❌ هذا الإيميل مستخدم بالفعل');
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 12);

  const admin = await db.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log(`\n✅ تم إنشاء Super Admin بنجاح`);
  console.log(`   ID:    ${admin.id}`);
  console.log(`   Email: ${admin.email}\n`);

  rl.close();
  await app.close();
}

createAdmin();
