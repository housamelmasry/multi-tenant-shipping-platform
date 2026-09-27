// src/i18n/i18n.constants.ts
export const SUPPORTED_LANGUAGES = ['ar', 'en'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export const isSupportedLanguage = (
  value: unknown,
): value is SupportedLanguage =>
  typeof value === 'string' &&
  (SUPPORTED_LANGUAGES as readonly string[]).includes(value);

/**
 * Normalize an arbitrary language tag ("ar-EG", "EN", undefined) to one of
 * the languages we actually ship catalogs for. Returns undefined when there is
 * no match, so callers can fall through to the next resolver.
 */
export const normalizeLanguage = (
  value: unknown,
): SupportedLanguage | undefined => {
  if (typeof value !== 'string') return undefined;
  const tag = value.trim().toLowerCase().replace('_', '-');
  if (!tag) return undefined;
  if (isSupportedLanguage(tag)) return tag;
  return SUPPORTED_LANGUAGES.find((lang) => tag.startsWith(`${lang}-`));
};
