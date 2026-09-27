// src/i18n/catalogs.spec.ts
import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from './i18n.constants';

const I18N_DIR = path.join(__dirname);
const CATALOG_FILES = ['errors', 'validation', 'sms', 'notifications'] as const;

const readCatalog = (lang: string, file: string) => {
  const raw = fs.readFileSync(
    path.join(I18N_DIR, lang, `${file}.json`),
    'utf8',
  );
  return JSON.parse(raw) as Record<string, unknown>;
};
const flatten = (obj: unknown, prefix = ''): string[] => {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj as Record<string, unknown>).flatMap(
    ([key, value]) => {
      const full = prefix ? `${prefix}.${key}` : key;
      return value && typeof value === 'object' ? flatten(value, full) : [full];
    },
  );
};
const placeholders = (value: unknown): string[] => {
  if (typeof value !== 'string') return [];
  return (value.match(/\{(\w+)\}/g) ?? [])
    .map((m: string) => m.slice(1, -1))
    .sort();
};

const leaf = (obj: unknown, dotted: string): unknown =>
  dotted
    .split('.')
    .reduce<unknown>(
      (acc, k) => (acc as Record<string, unknown> | undefined)?.[k],
      obj,
    );

describe('i18n catalogs', () => {
  it.each(SUPPORTED_LANGUAGES)('%s catalogs are valid JSON', (lang) => {
    // A leading `//` comment once made two files unparseable, which the loader
    // only surfaces at runtime.
    for (const file of CATALOG_FILES) {
      expect(() => readCatalog(lang, file)).not.toThrow();
    }
  });

  it.each(CATALOG_FILES)('%s has the same keys in every language', (file) => {
    // The default language is the floor: a key present only in ar would render
    // as the raw key for the majority of requests.
    const baseline = flatten(readCatalog(DEFAULT_LANGUAGE, file)).sort();
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(flatten(readCatalog(lang, file)).sort()).toEqual(baseline);
    }
  });

  it.each(CATALOG_FILES)(
    '%s uses matching placeholders across languages',
    (file) => {
      const baseline = readCatalog(DEFAULT_LANGUAGE, file);
      for (const lang of SUPPORTED_LANGUAGES) {
        const catalog = readCatalog(lang, file);
        for (const key of flatten(baseline)) {
          expect({ lang, key, args: placeholders(leaf(catalog, key)) }).toEqual(
            {
              lang,
              key,
              args: placeholders(leaf(baseline, key)),
            },
          );
        }
      }
    },
  );

  it('every shipped language has a directory', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(fs.existsSync(path.join(I18N_DIR, lang))).toBe(true);
    }
  });
});
