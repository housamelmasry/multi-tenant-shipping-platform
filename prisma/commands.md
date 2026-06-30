# أول مرة — تشغيل كامل
npx prisma migrate dev --name init
npm run seed

# في الـ production
npx prisma migrate deploy
npm run seed:prod

# إعادة تعيين كاملة (dev فقط)
npm run db:reset

# إنشاء admin جديد من الـ terminal
npm run admin:create