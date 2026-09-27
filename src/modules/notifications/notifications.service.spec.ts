jest.mock('@config/firebase.config', () => ({
  initializeFirebase: jest.fn(),
  getFirebaseMessaging: jest.fn(),
}));

import { getFirebaseMessaging } from '@config/firebase.config';
import { NotificationsService } from './notifications.service';

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
    const service = new NotificationsService(db as never, {} as never);

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
});
