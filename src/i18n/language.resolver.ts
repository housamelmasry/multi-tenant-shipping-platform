// src/i18n/language.resolver.ts
import { ExecutionContext } from '@nestjs/common';
import { I18nResolver } from 'nestjs-i18n';
import {
  AcceptLanguageResolver,
  QueryResolver,
} from 'nestjs-i18n/dist/resolvers';
import { DEFAULT_LANGUAGE, normalizeLanguage } from './i18n.constants';
/**
 * Resolves the request language, normalizing every candidate to a language we
 * actually ship a catalog for.
 *
 * The stock QueryResolver/AcceptLanguageResolver return the raw value, so
 * `?lang=ar-EG` or `Accept-Language: en-US` produce a context whose `lang`
 * matches no catalog. nestjs-i18n then falls back to the default language for
 * EVERY key, which silently answers an explicit Arabic request in English.
 * Normalizing here means the request locale and the stored record locale
 * (Driver.lang / Order.recipientLang) are always the same set of values, so
 * `?lang=ar-EG` and a stored `ar-EG` behave identically.
 */
export class LanguageResolver implements I18nResolver {
  private readonly query = new QueryResolver(['lang']);
  private readonly accept = new AcceptLanguageResolver({
    // "loose" so a bare "ar" or "en" still matches; we validate the rest.
    matchType: 'loose',
  });

  async resolve(context: ExecutionContext): Promise<string> {
    const candidates = [
      ...toArray(this.query.resolve(context)),
      ...toArray(await this.accept.resolve(context)),
    ];

    for (const candidate of candidates) {
      const normalized = normalizeLanguage(candidate);
      if (normalized) return normalized;
    }

    return DEFAULT_LANGUAGE;
  }
}

const toArray = (value: string | string[] | undefined): string[] => {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
};
