import { projectError } from "../errors/framework-errors.ts";
import { processBrand } from "../process/slot.ts";
import { assertOwnedObject, type OwnedObject } from "../typeid/owned.ts";

const seederBrand = processBrand("seeder");
const tableName = /^[a-z_][a-z0-9_]*$/;

export type Seeder = {
  table: string;
  objects: OwnedObject[];
};

export function defineSeeder(input: {
  table: string;
  objects: readonly Record<string, unknown>[];
}): Seeder {
  if (!tableName.test(input.table)) {
    throw projectError("invalidSeeder", `${input.table} is not a table name`);
  }
  if (input.objects.length === 0) {
    throw projectError("invalidSeeder", `${input.table} has no objects`);
  }
  const objects = input.objects.map((object) => readObject(object));
  const columns = Object.keys(objects[0] ?? {}).join("\0");
  for (const object of objects) {
    if (Object.keys(object).join("\0") !== columns) {
      throw projectError(
        "invalidSeeder",
        `${input.table} objects must use the same columns`,
      );
    }
  }
  return Object.assign(
    { table: input.table, objects },
    { [seederBrand]: true },
  );
}

export function isSeeder(value: unknown): value is Seeder {
  return (
    typeof value === "object" &&
    value !== null &&
    seederBrand in value &&
    (value as Record<symbol, unknown>)[seederBrand] === true
  );
}

function readObject(object: Record<string, unknown>) {
  try {
    return assertOwnedObject(object);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Invalid object";
    throw projectError("invalidSeeder", detail);
  }
}
