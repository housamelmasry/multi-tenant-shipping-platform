// src/i18n/i18n.module.ts
import { Global, Module } from '@nestjs/common';
import { I18nHelper } from './i18n.utils';

/**
 * Exposes I18nHelper application-wide. `nestjs-i18n`'s I18nModule is already
 * @Global, so the I18nService it provides is injectable anywhere; this wrapper
 * just registers the thin wrapper that can also translate for an explicit
 * language outside of a request (queues, cron jobs, FCM/SMS sends).
 */
@Global()
@Module({
  providers: [I18nHelper],
  exports: [I18nHelper],
})
export class I18nHelperModule {}
