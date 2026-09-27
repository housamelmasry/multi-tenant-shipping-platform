import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { OrdersModule } from './modules/orders/orders.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { I18nModule, I18nMiddleware } from 'nestjs-i18n';
import { LanguageResolver } from './i18n/language.resolver';
import { ReturnsModule } from './modules/returns/returns.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PdplModule } from './modules/pdpl/pdpl.module';
import * as path from 'path';
import appConfig from './config/app.config';

import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from './i18n/i18n.constants';
import type { SupportedLanguage } from './i18n/i18n.constants';
import { I18nHelperModule } from './i18n/i18n.module';

export { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES };
export type { SupportedLanguage };

@Module({
  imports: [
    // Load configuration first.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      // appConfig groups values under a namespace (app.publicUrl, ...), which
      // is what SmsService reads to build customer tracking links.
      load: [appConfig],
    }),
    I18nModule.forRoot({
      fallbackLanguage: DEFAULT_LANGUAGE,
      loaderOptions: {
        // Resolved relative to this file so it works both under ts-node
        // (src/i18n) and after a build (dist/src/i18n).
        path: path.join(__dirname, 'i18n'),
        watch: false,
      },
      // Single resolver: `?lang=` first, then Accept-Language, each normalized
      // to a shipped language. The stock resolvers do not normalize.
      resolvers: [LanguageResolver],
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST'),
          port: config.get('REDIS_PORT'),
        },
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
    }),

    // Database
    DatabaseModule,

    // Redis
    RedisModule,

    // Translation helper (I18nService is provided by the global I18nModule)
    I18nHelperModule,

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: new ThrottlerStorageRedisService({
          host: config.get('REDIS_HOST'),
          port: config.get('REDIS_PORT'),
        }),
        throttlers: [
          {
            name: 'short',
            ttl: 1000,
            limit: 10,
          },
          {
            name: 'medium',
            ttl: 60000,
            limit: 100,
          },
          {
            name: 'long',
            ttl: 86400000,
            limit: 5000,
          },
        ],
      }),
    }),

    // Modules
    AuthModule,
    TenantsModule,
    UsersModule,
    DriversModule,
    OrdersModule,
    TrackingModule,
    WebhooksModule,
    ReturnsModule,
    NotificationsModule,
    PdplModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Populates the AsyncLocalStorage that I18nContext/I18nService read from.
    // Without this every translation call silently falls back.
    consumer.apply(I18nMiddleware).forRoutes('*');
  }
}
