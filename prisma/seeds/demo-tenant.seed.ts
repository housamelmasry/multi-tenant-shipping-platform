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

  const adminPassword = process.env.DEMO_TENANT_ADMIN_PASSWORD;
  const driverPassword = process.env.DEMO_DRIVER_PASSWORD;

  if (!adminPassword) {
    throw new Error(
      'DEMO_TENANT_ADMIN_PASSWORD is required for the development seed',
    );
  }

  if (!driverPassword) {
    throw new Error(
      'DEMO_DRIVER_PASSWORD is required for the development seed',
    );
  }

  const apiKey = `sk_${crypto.randomBytes(24).toString('hex')}`;
  const apiSecret = `secret_${crypto.randomBytes(32).toString('hex')}`;

  const tenant = await prisma.tenant.create({
    data: {
      name: 'Demo Shipping Company',
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

  // ─── Tenant Admin ─────────────────────────────────────

  const hashedAdminPassword = await bcrypt.hash(adminPassword, 12);

  const tenantAdmin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Demo Tenant Admin',
      email: 'manager@demo.invalid',
      password: hashedAdminPassword,
      role: 'TENANT_ADMIN',
      isActive: true,
    },
  });

  console.log(`   ✅ Tenant Admin: ${tenantAdmin.email}`);

  // ─── Drivers ──────────────────────────────────────────

  const driversData = [
    {
      name: 'Demo Driver 1',
      phone: '+966500000001',
      nationalId: '0000000001',
      vehicleType: 'motorcycle',
      vehiclePlate: 'DEMO-0001',
      status: 'available',
      currentLat: 24.7136,
      currentLng: 46.6753,
    },
    {
      name: 'Demo Driver 2',
      phone: '+966500000002',
      nationalId: '0000000002',
      vehicleType: 'car',
      vehiclePlate: 'DEMO-0002',
      status: 'available',
      currentLat: 24.72,
      currentLng: 46.68,
    },
    {
      name: 'Demo Driver 3',
      phone: '+966500000003',
      nationalId: '0000000003',
      vehicleType: 'van',
      vehiclePlate: 'DEMO-0003',
      status: 'offline',
      currentLat: null,
      currentLng: null,
    },
  ];

  const hashedDriverPassword = await bcrypt.hash(driverPassword, 12);

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

    // Create a user account for the driver.
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: driver.name,
        email: `driver_${driver.id.slice(0, 8)}@demo.invalid`,
        password: hashedDriverPassword,
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
      senderName: 'Demo Store',
      senderPhone: '+966500000011',
      senderAddress: 'Demo address, Riyadh',
      senderLat: 24.7136,
      senderLng: 46.6753,
      recipientName: 'Demo Recipient 1',
      recipientPhone: '+966500000021',
      recipientAddress: 'Demo address 1, Riyadh',
      recipientLat: 24.75,
      recipientLng: 46.71,
      codAmount: 150.0,
      description: 'ملابس نسائية',
    },
    {
      trackingCode: 'SHP-DEMO0002',
      status: 'delivered',
      senderName: 'Demo Store',
      senderPhone: '+966500000011',
      senderAddress: 'Demo address, Riyadh',
      senderLat: 24.7136,
      senderLng: 46.6753,
      recipientName: 'Demo Recipient 2',
      recipientPhone: '+966500000022',
      recipientAddress: 'Demo address 2, Riyadh',
      recipientLat: 24.6877,
      recipientLng: 46.6857,
      codAmount: 0,
      description: 'إلكترونيات',
      deliveredAt: new Date(),
    },
    {
      trackingCode: 'SHP-DEMO0003',
      status: 'failed',
      senderName: 'Demo Store 2',
      senderPhone: '+966500000012',
      senderAddress: 'Demo address, Jeddah',
      senderLat: 21.5433,
      senderLng: 39.1728,
      recipientName: 'Demo Recipient 3',
      recipientPhone: '+966500000023',
      recipientAddress: 'Demo address 3, Jeddah',
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

    // Record the initial status.
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
  console.log(
    '\n   Demo account passwords are supplied through environment variables.',
  );
}
