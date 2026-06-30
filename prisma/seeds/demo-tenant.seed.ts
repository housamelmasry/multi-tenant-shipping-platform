// prisma/seeds/demo-tenant.seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

export async function seedDemoTenant(prisma: PrismaClient) {
  console.log('🏢 إنشاء بيانات تجريبية...');

  // ─── Demo Tenant ──────────────────────────────────────

  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: 'demo-shipping' },
  });

  if (existingTenant) {
    console.log('   ⏭️  Demo Tenant موجود بالفعل');
    return;
  }

  const apiKey = `sk_${crypto.randomBytes(24).toString('hex')}`;
  const apiSecret = `secret_${crypto.randomBytes(32).toString('hex')}`;

  const tenant = await prisma.tenant.create({
    data: {
      name: 'شركة الشحن التجريبية',
      slug: 'demo-shipping',
      plan: 'PRO',
      apiKey,
      apiSecret,
      isActive: true,
      settings: {
        defaultLang: 'ar',
        smsEnabled: true,
        webhookRetries: 3,
        maxDistanceKm: 20,
        maxOrdersPerDriver: 1,
      },
    },
  });

  console.log(`   ✅ Tenant: ${tenant.name}`);
  console.log(`   🔑 API Key: ${apiKey}`);

  // ─── Tenant Admin ─────────────────────────────────────

  const adminPassword = await bcrypt.hash('Admin@123456', 12);

  const tenantAdmin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'مدير الشركة',
      email: 'manager@demo-shipping.com',
      password: adminPassword,
      role: 'TENANT_ADMIN',
      isActive: true,
    },
  });

  console.log(`   ✅ Tenant Admin: ${tenantAdmin.email}`);

  // ─── Drivers ──────────────────────────────────────────

  const driversData = [
    {
      name: 'أحمد محمد السيد',
      phone: '+966501111111',
      nationalId: '1234567890',
      vehicleType: 'motorcycle',
      vehiclePlate: 'أ ب ج 1234',
      status: 'available',
      currentLat: 24.7136,
      currentLng: 46.6753,
    },
    {
      name: 'محمد علي حسن',
      phone: '+966502222222',
      nationalId: '0987654321',
      vehicleType: 'car',
      vehiclePlate: 'د هـ و 5678',
      status: 'available',
      currentLat: 24.72,
      currentLng: 46.68,
    },
    {
      name: 'خالد عبدالله الأحمد',
      phone: '+966503333333',
      nationalId: '1122334455',
      vehicleType: 'van',
      vehiclePlate: 'ز ح ط 9012',
      status: 'offline',
      currentLat: null,
      currentLng: null,
    },
  ];

  const driverPassword = await bcrypt.hash('Driver@123456', 12);

  for (const driverData of driversData) {
    const { status, currentLat, currentLng, ...rest } = driverData;

    const driver = await prisma.driver.create({
      data: {
        tenantId: tenant.id,
        ...rest,
        status,
        currentLat,
        currentLng,
        lastLocationAt: currentLat ? new Date() : null,
        isActive: true,
      },
    });

    // user account للسائق
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: driver.name,
        email: `driver_${driver.id.slice(0, 8)}@demo.com`,
        password: driverPassword,
        role: 'TENANT_STAFF',
        driverId: driver.id,
        isActive: true,
      },
    });

    console.log(`   ✅ Driver: ${driver.name} (${driver.vehicleType})`);
  }

  // ─── Demo Orders ──────────────────────────────────────

  const ordersData = [
    {
      trackingCode: 'SHP-DEMO0001',
      status: 'pending',
      senderName: 'متجر الرياض الإلكتروني',
      senderPhone: '+966511111111',
      senderAddress: 'شارع الملك فهد، الرياض',
      senderLat: 24.7136,
      senderLng: 46.6753,
      recipientName: 'فاطمة أحمد',
      recipientPhone: '+966522222222',
      recipientAddress: 'حي النزهة، الرياض',
      recipientLat: 24.75,
      recipientLng: 46.71,
      codAmount: 150.0,
      description: 'ملابس نسائية',
    },
    {
      trackingCode: 'SHP-DEMO0002',
      status: 'delivered',
      senderName: 'متجر الرياض الإلكتروني',
      senderPhone: '+966511111111',
      senderAddress: 'شارع الملك فهد، الرياض',
      senderLat: 24.7136,
      senderLng: 46.6753,
      recipientName: 'محمد سعيد',
      recipientPhone: '+966533333333',
      recipientAddress: 'حي العليا، الرياض',
      recipientLat: 24.6877,
      recipientLng: 46.6857,
      codAmount: 0,
      description: 'إلكترونيات',
      deliveredAt: new Date(),
    },
    {
      trackingCode: 'SHP-DEMO0003',
      status: 'failed',
      senderName: 'متجر جدة',
      senderPhone: '+966544444444',
      senderAddress: 'شارع التحلية، جدة',
      senderLat: 21.5433,
      senderLng: 39.1728,
      recipientName: 'سارة عبدالله',
      recipientPhone: '+966555555555',
      recipientAddress: 'حي الروضة، جدة',
      recipientLat: 21.58,
      recipientLng: 39.2,
      codAmount: 75.5,
      description: 'عطور',
    },
  ];

  for (const orderData of ordersData) {
    const order = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        ...orderData,
      },
    });

    // تسجيل حالة البداية
    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        toStatus: 'pending',
        changedByType: 'system',
        note: 'تم إنشاء الطلب',
      },
    });

    console.log(`   ✅ Order: ${order.trackingCode} (${order.status})`);
  }

  // ─── Demo Webhook ─────────────────────────────────────

  const webhookSecret = `whsec_${crypto.randomBytes(32).toString('hex')}`;

  await prisma.webhook.create({
    data: {
      tenantId: tenant.id,
      url: 'https://webhook.site/demo-endpoint',
      secret: webhookSecret,
      events: [
        'order.assigned',
        'order.delivered',
        'order.failed',
        'order.cancelled',
        'order.returned',
      ],
      isActive: true,
    },
  });

  console.log(`   ✅ Demo Webhook configured`);
  console.log('\n   📋 بيانات الدخول للـ Demo:');
  console.log(`   Manager: manager@demo-shipping.com / Admin@123456`);
  console.log(`   Driver:  driver_***@demo.com / Driver@123456`);
}
