// src/common/pipes/localized-validation.pipe.regression.spec.ts
import { ArgumentMetadata } from '@nestjs/common';
import { LocalizedValidationPipe } from './localized-validation.pipe';

/**
 * Regression: a `toValidate` override returning `true` made the pipe validate
 * primitive arguments. class-validator cannot validate a bare string, so every
 * route with `@Param('id') id: string` returned
 *   400 { message: ["undefined value is invalid"] }
 * before reaching its handler — 30 routes, including the public
 * GET /tracking/:trackingCode.
 *
 * The 40 existing tests all passed while this was live, because none of them
 * exercise the pipe against a primitive param.
 */
const meta = (metatype: unknown, type: ArgumentMetadata['type'] = 'param') =>
  ({ metatype, type, data: undefined }) as ArgumentMetadata;

describe('LocalizedValidationPipe.toValidate', () => {
  const pipe = new LocalizedValidationPipe();
  const toValidate = (m: ArgumentMetadata) =>
    (
      pipe as unknown as { toValidate: (a: ArgumentMetadata) => boolean }
    ).toValidate(m);

  it('skips primitive params so @Param("id") id: string reaches the handler', () => {
    expect(toValidate(meta(String))).toBe(false);
    expect(toValidate(meta(Number))).toBe(false);
    expect(toValidate(meta(Boolean))).toBe(false);
  });

  it('still validates DTO classes in body, query and param', () => {
    class FakeDto {}
    expect(toValidate(meta(FakeDto, 'body'))).toBe(true);
    expect(toValidate(meta(FakeDto, 'query'))).toBe(true);
    expect(toValidate(meta(FakeDto, 'param'))).toBe(true);
  });
});
