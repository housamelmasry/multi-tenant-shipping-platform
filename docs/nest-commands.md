# Create the Notifications Module

```bash
# 1. Generate the module
nest g module modules/notifications --no-spec

# 2. Generate the controller
nest g controller modules/notifications --no-spec

# 3. Generate the service
nest g service modules/notifications --no-spec

# 4. Generate the DTOs
nest g class modules/notifications/dto/register-device.dto --no-spec
nest g class modules/notifications/dto/create-notification.dto --no-spec
nest g class modules/notifications/dto/query-notifications.dto --no-spec
```

## After Generation

- `NotificationsModule` is registered automatically in `app.module.ts`.
- Add the `PATCH /drivers/me/device` route to `DriversController` to register the FCM token.
- The `notifications` table has already been added to the Prisma schema.
