// src/common/update-dto-prisma-parity.spec.ts
import { Prisma } from '@prisma/client';
import { getMetadataStorage } from 'class-validator';
import { UpdateDriverDto } from '@modules/drivers/dto/update-driver.dto';
import { UpdateTenantDto } from '@modules/tenants/dto/update-tenant.dto';

/**
 * Services pass update DTOs straight into `model.update({ data: dto })`.
 *
 * TypeScript cannot catch a mismatched field here: excess-property checking
 * only applies to object *literals*, so passing a variable of an unrelated
 * shape satisfies the generated `XUpdateInput` and the mismatch only explodes
 * at runtime as Prisma "Unknown argument". Two such bugs existed:
 *
 *   - `UpdateDriverDto.password`  (inherited via bare PartialType)
 *   - `UpdateTenantDto.adminLang` (inherited after adminLang was added)
 *
 * This asserts every declared update-DTO field maps to a real Prisma column, so
 * the next DTO addition fails here rather than in production.
 */

type Ctor = abstract new (...args: never[]) => object;

const columnsOf = (model: string): Set<string> => {
  const found = Prisma.dmmf.datamodel.models.find((m) => m.name === model);
  if (!found) throw new Error(`Unknown Prisma model: ${model}`);
  return new Set(
    found.fields.filter((f) => f.kind !== 'object').map((f) => f.name),
  );
};

/**
 * Properties the DTO actually accepts, read from class-validator's metadata
 * storage. `design:type` is not emitted in this build, and OmitType/PartialType
 * rebuild a class at runtime, so reflection over the prototype finds nothing —
 * but this storage is rewritten by mapped-types and already reflects the
 * omitted keys.
 */
const declaredFields = (dto: Ctor): string[] =>
  [
    ...new Set(
      getMetadataStorage()
        .getTargetValidationMetadatas(dto, '', false, false)
        .map((m) => m.propertyName),
    ),
  ].sort();

const CASES: Array<[string, Ctor, string]> = [
  ['UpdateDriverDto', UpdateDriverDto, 'Driver'],
  ['UpdateTenantDto', UpdateTenantDto, 'Tenant'],
];

describe('update DTOs match their Prisma model', () => {
  it.each(CASES)(
    '%s only declares columns that exist on %s',
    (_l, dto, model) => {
      const columns = columnsOf(model);
      const unknown = declaredFields(dto).filter((f) => !columns.has(f));
      expect(unknown).toEqual([]);
    },
  );

  it('still exposes the columns services rely on', () => {
    // Guards against "fixing" the bug by over-omitting.
    //
    // Scope note: this only sees decorated properties. `isActive` is a real
    // Tenant column but carries no validator, so it is invisible here; the
    // parity test is therefore a floor, not a complete inventory. The
    // `prisma validate` + runtime probe in the commit covers the rest.
    expect(declaredFields(UpdateDriverDto)).toEqual(
      expect.arrayContaining(['name', 'phone', 'email', 'nationalId', 'lang']),
    );
    expect(declaredFields(UpdateTenantDto)).toEqual(
      expect.arrayContaining(['name', 'slug', 'plan']),
    );
    // A wholesale over-omit would leave these near-empty.
    expect(declaredFields(UpdateDriverDto).length).toBeGreaterThanOrEqual(6);
  });

  it('does not leak create-only fields back through OmitType', () => {
    expect(declaredFields(UpdateDriverDto)).not.toContain('password');
    expect(declaredFields(UpdateTenantDto)).not.toEqual(
      expect.arrayContaining([
        'adminName',
        'adminEmail',
        'adminPassword',
        'adminLang',
      ]),
    );
  });
});
