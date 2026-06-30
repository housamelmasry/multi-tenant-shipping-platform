import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from './database/database.module';
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
import { I18nModule, AcceptLanguageResolver, QueryResolver } from 'nestjs-i18n';
import { ReturnsModule } from './modules/returns/returns.module';
import * as path from 'path';


@Module({
  imports: [
    // Config أول حاجة دايماً
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'ar', // العربية افتراضي
      loaderOptions: {
        path: path.join(__dirname, '/i18n/'),
        watch: true,
      },
      resolvers: [
        // بيحدد اللغة من الـ header أو الـ query
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
      ],
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

    // Modules
    AuthModule,
    TenantsModule,
    UsersModule,
    DriversModule,
    OrdersModule,
    TrackingModule,
    WebhooksModule,
    ReturnsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // على كل الـ routes
    { provide: APP_GUARD, useClass: RolesGuard }, // تحقق من الـ roles
  ],
})
export class AppModule {}
