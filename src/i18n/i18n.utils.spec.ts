// src/i18n/i18n.utils.spec.ts
import { I18nHelper } from './i18n.utils';
import { DEFAULT_LANGUAGE, normalizeLanguage } from './i18n.constants';

/**
 * Minimal stand-in for I18nService. The real class is generic over the catalog
 * shape, which collapses its `translate` signature to `key: never` unless a
 * catalog type is supplied, so tests drive the helper through this shape.
 */
const makeService = (catalog: Record<string, Record<string, string>>) => ({
  translate: (key: string, options?: { lang?: string }) => {
    const lang = options?.lang ?? DEFAULT_LANGUAGE;
    return catalog[lang]?.[key] ?? key;
  },
});

describe('normalizeLanguage', () => {
  it('accepts exact supported tags', () => {
    expect(normalizeLanguage('ar')).toBe('ar');
    expect(normalizeLanguage('en')).toBe('en');
  });

  it('normalizes region subtags to the base language', () => {
    // Without this, `?lang=ar-EG` produced a context matching no catalog and
    // every lookup silently fell back to the default language.
    expect(normalizeLanguage('ar-EG')).toBe('ar');
    expect(normalizeLanguage('en-US')).toBe('en');
    expect(normalizeLanguage('en-GB')).toBe('en');
  });

  it('is case- and separator-insensitive', () => {
    expect(normalizeLanguage('AR')).toBe('ar');
    expect(normalizeLanguage('  En-US  ')).toBe('en');
    expect(normalizeLanguage('ar_EG')).toBe('ar');
  });

  it('rejects unsupported and malformed values so callers can fall through', () => {
    expect(normalizeLanguage('fr')).toBeUndefined();
    expect(normalizeLanguage('fr-FR')).toBeUndefined();
    expect(normalizeLanguage('')).toBeUndefined();
    expect(normalizeLanguage(undefined)).toBeUndefined();
    expect(normalizeLanguage(null)).toBeUndefined();
    expect(normalizeLanguage(42)).toBeUndefined();
  });
});

describe('I18nHelper', () => {
  const catalog = {
    ar: { 'errors.common.unauthorized': 'يرجى تسجيل الدخول' },
    en: { 'errors.common.unauthorized': 'Please sign in first' },
  };

  it('translates for an explicit language', () => {
    const helper = new I18nHelper(makeService(catalog) as never);
    expect(helper.t('errors.common.unauthorized', { lang: 'ar' })).toBe(
      'يرجى تسجيل الدخول',
    );
    expect(helper.t('errors.common.unauthorized', { lang: 'en' })).toBe(
      'Please sign in first',
    );
  });

  it('normalizes the explicit language before looking up', () => {
    const helper = new I18nHelper(makeService(catalog) as never);
    expect(helper.t('errors.common.unauthorized', { lang: 'ar-EG' })).toBe(
      'يرجى تسجيل الدخول',
    );
  });

  it('falls back to the default language for an unsupported one', () => {
    const helper = new I18nHelper(makeService(catalog) as never);
    expect(helper.t('errors.common.unauthorized', { lang: 'fr' })).toBe(
      'Please sign in first',
    );
  });

  it('returns the key itself when no translation exists', () => {
    // Never throws: a typo must not crash a queue worker or a cron job.
    const helper = new I18nHelper(makeService(catalog) as never);
    expect(helper.t('errors.does.not.exist', { lang: 'ar' })).toBe(
      'errors.does.not.exist',
    );
  });

  it('falls back to the default language when a key is missing in the requested one', () => {
    const partial = {
      ar: {},
      en: { 'errors.common.forbidden': 'Forbidden' },
    };
    const helper = new I18nHelper(makeService(partial) as never);
    expect(helper.t('errors.common.forbidden', { lang: 'ar' })).toBe(
      'Forbidden',
    );
  });

  it('interpolates args', () => {
    const withArgs: Record<string, Record<string, string>> = {
      ar: { 'sms.otp.delivery': 'رمزك {code}' },
      en: { 'sms.otp.delivery': 'Your code is {code}' },
    };
    const service = {
      translate: (
        key: string,
        o?: { lang?: string; args?: Record<string, unknown> },
      ) => {
        const template = withArgs[o?.lang ?? DEFAULT_LANGUAGE]?.[key];
        return template
          ? template.replace('{code}', String(o?.args?.code))
          : key;
      },
    };
    const helper = new I18nHelper(service as never);
    expect(
      helper.t('sms.otp.delivery', { lang: 'ar', args: { code: '1234' } }),
    ).toBe('رمزك 1234');
  });

  it('degrades to the key when constructed without a service', () => {
    // This is the exact state the missing @Injectable() decorator produced:
    // Nest injected `undefined`, so every lookup returned its own key. Guards
    // then surfaced raw keys like "errors.common.unauthorized" to clients.
    const helper = new I18nHelper(undefined as never);
    expect(helper.t('errors.common.unauthorized', { lang: 'ar' })).toBe(
      'errors.common.unauthorized',
    );
  });
});
