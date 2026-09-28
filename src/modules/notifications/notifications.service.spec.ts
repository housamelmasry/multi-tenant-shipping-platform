jest.mock('@config/firebase.config', () => ({
  initializeFirebase: jest.fn(),
  getFirebaseMessaging: jest.fn(),
}));

import { getFirebaseMessaging } from '@config/firebase.config';
import { NotificationsService } from './notifications.service';

/**
 * sendAnnouncement() calls `this.i18n.t('errors.notification.no_drivers_to_notify')`
 * on the empty-recipient path. Passing a bare `{}` for the helper compiles only
 * under ts-jest's transpile-only mode and throws "t is not a function" the
 * moment that branch is reached, so stub it properly.
 */
const i18n = (over: Record<string, string> = {}) =>
  ({ t: (key: string) => over[key] ?? key }) as never;

describe('NotificationsService announcements', () => {
  it('sends batches of at most 500 and records each recipient result', async () => {
    const drivers = Array.from({ length: 501 }, (_, index) => ({
      id: `driver-${index}`,
      fcmToken: `token-${index}`,
      name: `Driver ${index}`,
    }));
    const db = {
      driver: { findMany: jest.fn().mockResolvedValue(drivers) },
      notification: { createMany: jest.fn().mockResolvedValue({ count: 500 }) },
    };
    const sendEachForMulticast = jest.fn(
      async ({ tokens }: { tokens: string[] }) => ({
        responses: tokens.map((_, index) => ({ success: index % 2 === 0 })),
      }),
    );
    (getFirebaseMessaging as jest.Mock).mockReturnValue({
      sendEachForMulticast,
    });
    const service = new NotificationsService(db as never, {} as never, i18n());

    const result = await service.sendAnnouncement('tenant-1', {
      title: 'Test announcement',
      body: 'Test message',
    } as never);

    expect(
      sendEachForMulticast.mock.calls.map(([batch]) => batch.tokens.length),
    ).toEqual([500, 1]);
    expect(db.notification.createMany).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ total: 501, sent: 251, failed: 250 });
  });

  it('localizes the no-drivers message instead of leaking a key', async () => {
    // Guards the i18n helper dependency: this branch is the only place
    // sendAnnouncement() touches `this.i18n`, so it is the one that breaks when
    // the helper is not actually injected. With a bare `{}` stub this returned
    // the raw key "errors.notification.no_drivers_to_notify" to the caller.
    const db = {
      driver: { findMany: jest.fn().mockResolvedValue([]) },
      notification: { createMany: jest.fn() },
    };
    (getFirebaseMessaging as jest.Mock).mockReturnValue({
      sendEachForMulticast: jest.fn(),
    });
    const service = new NotificationsService(
      db as never,
      {} as never,
      i18n({ 'errors.notification.no_drivers_to_notify': 'لا يوجد سائقون' }),
    );

    await expect(
      service.sendAnnouncement('tenant-1', {
        title: 'Test announcement',
        body: 'Test message',
      } as never),
    ).resolves.toEqual({ sent: 0, message: 'لا يوجد سائقون' });
  });
});
