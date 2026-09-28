import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { Plan } from '@common/enums';

describe('TenantsService API credentials', () => {
  it('creates a tenant with only the API key credential', async () => {
    const tenant = { id: 'tenant-1', name: 'Example', slug: 'example' };
    const tenantCreate = jest
      .fn<Promise<typeof tenant>, [{ data: Record<string, unknown> }]>()
      .mockResolvedValue(tenant);
    const tx = {
      tenant: { create: tenantCreate },
      user: { create: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    };
    const db = {
      tenant: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = new TenantsService(
      db as never,
      {} as never,
      { t: (key: string) => key } as never,
    );

    const result = await service.create({
      name: 'Example',
      slug: 'example',
      plan: Plan.BASIC,
      adminName: 'Admin',
      adminEmail: 'admin@example.test',
      adminPassword: 'portfolio-password',
    } satisfies CreateTenantDto);

    expect(result.apiKey).toMatch(/^sk_/);
    expect(result).not.toHaveProperty('apiSecret');
    const createData = tenantCreate.mock.calls[0]?.[0].data;
    expect(createData).toHaveProperty('apiKey', result.apiKey);
    expect(createData).not.toHaveProperty('apiSecret');
  });

  it('does not select the one-time API key for tenant profile reads', async () => {
    type TenantFindArgs = {
      where: { id: string };
      select: { apiKey?: boolean; id: boolean; [key: string]: unknown };
    };
    let findArgs: TenantFindArgs | undefined;
    const tenantFindUnique = jest.fn((args: TenantFindArgs) => {
      findArgs = args;
      return Promise.resolve({
        id: 'tenant-1',
        name: 'Example',
        slug: 'example',
        _count: { orders: 0, drivers: 0, users: 0 },
      });
    });
    const service = new TenantsService(
      { tenant: { findUnique: tenantFindUnique } } as never,
      {} as never,
      { t: (key: string) => key } as never,
    );

    const result = await service.findOne('tenant-1');

    expect(result).not.toHaveProperty('apiKey');
    expect(findArgs?.select.apiKey).toBeUndefined();
  });
});
