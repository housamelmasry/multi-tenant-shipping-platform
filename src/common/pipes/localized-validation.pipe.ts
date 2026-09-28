// src/common/pipes/localized-validation.pipe.ts
import {
  BadRequestException,
  Injectable,
  ValidationError,
  ValidationPipe,
  ValidationPipeOptions,
} from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { DEFAULT_LANGUAGE, normalizeLanguage } from '@i18n/i18n.constants';
import { lookup } from '@i18n/i18n.utils';

const NAMESPACE = 'validation';

/** Constraints whose class-validator message embeds an allowed list. */
const LIST_CONSTRAINTS = new Set(['isIn', 'isEnum', 'equals', 'notEquals']);

/**
 * Validation pipe that localizes class-validator messages.
 *
 * Nest's built-in ValidationPipe emits class-validator's English defaults
 * ("short must be longer than or equal to 3 characters"), which produced
 * mixed-language responses alongside our domain errors. Each constraint is
 * resolved by its constraint KEY against the `validation` catalog, so the
 * response follows the locale negotiated by I18nMiddleware.
 *
 * I18nContext.current() is populated by the middleware, which runs before
 * pipes, so it is available here.
 *
 * We deliberately do NOT use the library's formatI18nErrors: it expects
 * constraint values pre-encoded as `key|{json}` (via i18nValidationMessage) and
 * otherwise emits the raw English text.
 */
@Injectable()
export class LocalizedValidationPipe extends ValidationPipe {
  constructor(options?: ValidationPipeOptions) {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      ...options,
      exceptionFactory: (errors: ValidationError[]) => {
        const i18n = I18nContext.current()?.service;
        const lang = resolveLang();
        const translate = (key: string, error: ValidationError) =>
          translateConstraint(i18n, key, error, lang);

        return new BadRequestException({
          message: collectMessages(errors, translate),
          errors: buildErrorTree(errors, translate),
        });
      },
    });
  }
  // NOTE: deliberately no `toValidate` override.
  //
  // An earlier version returned `true` unconditionally, which made Nest
  // validate primitive arguments too. class-validator cannot validate a bare
  // string, so every route with `@Param('id') id: string` (30 of them) rejected
  // the request with 400 "undefined value is invalid" — including the public,
  // unauthenticated GET /tracking/:trackingCode. The inherited implementation
  // skips primitives and validates only class metatypes, which is the
  // behaviour we want. `regression.spec.ts` locks this in.
}

function resolveLang(): string {
  return normalizeLanguage(I18nContext.current()?.lang) ?? DEFAULT_LANGUAGE;
}

/**
 * Pull the constraint argument out of class-validator's message so the
 * localized template can keep the numeric bound or allowed-value list.
 *
 * This is a heuristic over the library's own message format, which is why
 * `undefined` is a real outcome: when nothing can be extracted we fall back to
 * the original message rather than emit a template with an empty placeholder.
 */
function extractConstraint(key: string, message: string): string | undefined {
  if (LIST_CONSTRAINTS.has(key)) {
    // "en must be one of the following values: a, b"
    const index = message.lastIndexOf(': ');
    return index === -1 ? undefined : message.slice(index + 2);
  }

  // "short must be longer than or equal to 3 characters" / "num must not be
  // less than 10" — the bound is the first number that is not part of a word.
  const match = message.match(/(?:^|\s)(-?\d+(?:\.\d+)?)(?:\s|$)/);
  return match ? match[1] : undefined;
}

/**
 * Resolve one constraint to a localized string.
 *
 * A DTO may point at a specific catalog entry by setting `message` to a key
 * under the `validation` namespace (e.g. `validation.phone`); anything else is
 * treated as a literal. Otherwise the constraint KEY is used (`isString`,
 * `minLength`, ...).
 *
 * When no catalog entry matches we return class-validator's own message. It is
 * English, but it is real information — better than leaking a raw translation
 * key — and the catalogs cover every decorator in the DTOs.
 */
function translateConstraint(
  i18n: I18nService<any> | undefined,
  key: string,
  error: ValidationError,
  lang: string,
): string {
  const message = (error.constraints ?? {})[key];
  if (typeof message !== 'string') return String(message);

  const explicit = message.startsWith(`${NAMESPACE}.`);
  const lookupKey = explicit ? message : `${NAMESPACE}.${key}`;

  if (i18n) {
    const args = {
      property: fieldLabel(i18n, error.property, lang),
      value: error.value,
      constraints: explicit ? '' : extractConstraint(key, message),
    };

    const translated = lookup(i18n, lookupKey, { lang, args });
    if (translated !== lookupKey) return translated;

    if (!explicit) {
      const fallback = lookup(i18n, `${NAMESPACE}.default`, { lang, args });
      if (fallback !== `${NAMESPACE}.default`) return fallback;
    }
  }

  return message;
}

/**
 * Human-readable name of a DTO property for use inside a message.
 *
 * `{property}` is interpolated into the translated sentence, so substituting
 * the raw camelCase name produces mixed-language output ("email يجب أن يكون
 * نصاً"). Falls back to the raw name when a property is not in the catalog,
 * which is still better than an empty sentence.
 */
function fieldLabel(
  i18n: I18nService<any> | undefined,
  property: string,
  lang: string,
): string {
  const key = `${NAMESPACE}.fields.${property}`;
  const label = lookup(i18n, key, { lang });
  return label === key ? property : label;
}

/** Flatten nested errors into a message array, preserving their property path. */
function collectMessages(
  errors: ValidationError[],
  translate: (key: string, error: ValidationError) => string,
  parentPath = '',
): string[] {
  return errors.flatMap((error) => {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    const own = Object.keys(error.constraints ?? {}).map((key) => {
      const message = translate(key, error);
      return parentPath ? `${path}: ${message}` : message;
    });

    return [...own, ...collectMessages(error.children ?? [], translate, path)];
  });
}

/** Keep the structured error tree for clients that want field-level detail. */
function buildErrorTree(
  errors: ValidationError[],
  translate: (key: string, error: ValidationError) => string,
): unknown[] {
  return errors.map((error) => ({
    field: error.property,
    constraints: Object.keys(error.constraints ?? {}).reduce(
      (acc, key) => ({ ...acc, [key]: translate(key, error) }),
      {} as Record<string, string>,
    ),
    children: buildErrorTree(error.children ?? [], translate),
  }));
}
