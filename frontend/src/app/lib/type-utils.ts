// app/lib/type-utils.ts

import {EditField} from "@/components/entity/EntityEditView";

/**
 * Determines if a property is required (non-nullable and non-optional)
 */
export type IsRequired<T, K extends keyof T> =
  undefined extends T[K] ? false :
  null extends T[K] ? false :
  true;

/**
 * Map model fields → whether they are required
 */
export type FieldRequirementMap<T> = {
  [K in keyof T]-?: IsRequired<T, K>;
};

/**
 * Automatically merges a field definition array with type-inferred required flags
 * based on FieldRequirementMap<T>.
 */
export function applyRequiredFlags<
  T extends Record<string, unknown>,
  R extends Record<string, unknown> = T,
  const F extends readonly EditField<T, R>[] = readonly EditField<T, R>[]
>(
  fields: F,
  requiredKeys?: readonly (keyof T)[]
): { [K in keyof F]: F[K] & { required: boolean } } {
  type RequirementMap = FieldRequirementMap<T>;

  return fields.map((field) => {
    const inferredRequired =
      requiredKeys?.includes(field.field) ??
      (false as RequirementMap[keyof T] extends true ? true : false);

    return {
      ...field,
      required: field.required ?? inferredRequired,
    };
  }) as { [K in keyof F]: F[K] & { required: boolean } };
}




