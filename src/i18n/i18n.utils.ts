// src/i18n/i18n.utils.ts
import { Injectable } from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import {
  DEFAULT_LANGUAGE,
  SupportedLanguage,
  normalizeLanguage,
} from './i18n.constants';

/**
 * I18nService is generic over the catalog shape, but our catalogs are loaded
 * from JSON at runtime and cannot be expressed as a type. Left untyped, the
 * `key` parameter collapses to `never` and the result to `unknown`, which would
 * force a cast at every call site. This is the one place that cast lives.
 */
type RawTranslate = (
  key: string,
  options?: { lang?: string; args?: Record<string, unknown> },
) => string;

/**
 * Single lookup that is tolerant of every failure mode: an unsupported or
 * unknown key resolves to the key itself, which is a stable, greppable signal
 * that a catalog entry is missing.
 */
export const lookup = (
  i18n: I18nService<any> | undefined,
  key: string,
  options?: { lang?: string; args?: Record<string, unknown> },
): string => {
  if (!i18n) return key;
  const result = (i18n.translate as RawTranslate)(key, options);
  return typeof result === 'string' ? result : key;
};

type TranslateOptions = {
  args?: Record<string, unknown>;
  lang?: string;
};

/**
 * Translation helper that works in BOTH request and non-request contexts.
 *
 * nestjs-i18n resolves the active language from an AsyncLocalStorage that is
 * only populated by I18nMiddleware. In queues, cron jobs, @OnEvent handlers
 * and any plain `ts-node` script there is no request, so `I18nContext.current()`
 * is undefined and every lookup falls back.
 *
 * `translate` takes an explicit `lang` for those cases and otherwise defers to
 * the request locale. It never throws: if a key is missing from the requested
 * language it falls back to the default language, then to the raw key, so a
 * typo degrades to something visible instead of crashing a background job.
 */
@Injectable()
export class I18nHelper {
  constructor(private readonly i18n: I18nService<any>) {}

  translate(key: string, options?: TranslateOptions): string {
    const { args, lang } = options ?? {};

    if (lang) {
      const resolved = normalizeLanguage(lang);
      if (resolved) {
        const direct = lookup(this.i18n, key, {
          ...(args ? { args } : {}),
          lang: resolved,
        });
        if (direct !== key) return direct;

        if (resolved !== DEFAULT_LANGUAGE) {
          const fallback = lookup(this.i18n, key, {
            ...(args ? { args } : {}),
            lang: DEFAULT_LANGUAGE,
          });
          if (fallback !== key) return fallback;
        }

        return direct;
      }
    }

    return lookup(this.i18n, key, args ? { args } : {});
  }

  /** Convenience alias mirroring I18nService.t. */
  t(key: string, options?: TranslateOptions): string {
    return this.translate(key, options);
  }
}

export const withLang = (lang: string | undefined): SupportedLanguage =>
  normalizeLanguage(lang) ?? DEFAULT_LANGUAGE;

/**
 * Request-scoped translation for code that cannot receive DI — multer
 * fileFilter callbacks, exception constructors called from static helpers.
 * Reads the same AsyncLocalStorage I18nMiddleware populates; returns the key
 * itself when no request context exists, which makes missing wiring obvious
 * instead of silently serving the wrong language.
 */
export const translate = (
  key: string,
  args?: Record<string, unknown>,
): string => {
  const i18n = I18nContext.current();
  if (!i18n) return key;
  return lookup(i18n.service, key, args ? { args } : {});
};
