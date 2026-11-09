import { isObjectType, parseTypeId, TypeIdError } from "./id.ts";

const reserved = new Set([
  "_id",
  "_object",
  "_tenant",
  "_archived",
  "_createdAt",
  "_updatedAt",
]);

export type OwnedObject = {
  _id: string;
  _object: string;
  _tenant: string;
  _archived: boolean;
  _createdAt: Date;
  _updatedAt: Date;
} & Record<string, unknown>;

export function assertOwnedObject(value: unknown): OwnedObject {
  const row = plainRow(value);
  if (!row) {
    throw new TypeIdError("OwnedObjects must be an object");
  }
  assertId(row._id);
  assertObject(row._object);
  assertTenant(row._tenant);
  assertArchived(row._archived);
  assertCreatedAt(row._createdAt);
  assertUpdatedAt(row._createdAt, row._updatedAt);
  assertDomainKeys(row);
  return row as OwnedObject;
}

export function assertOwnedCall(sql: string, values: readonly unknown[]) {
  const kind = writeKind(sql);
  if (!kind) {
    return;
  }
  const rows = rowsOf(values);
  if (kind === "insert" && rows.length === 0) {
    for (const column of reserved) {
      if (!namesColumn(sql, column)) {
        throw new TypeIdError(`insert must include ${column}`);
      }
    }
    return;
  }
  for (const row of rows) {
    if (kind === "insert") {
      assertOwnedObject(row);
      continue;
    }
    assertPresentFields(row);
  }
}

function assertPresentFields(row: Record<string, unknown>) {
  if ("_id" in row) {
    assertId(row._id);
  }
  if ("_object" in row) {
    assertObject(row._object);
  }
  if ("_tenant" in row) {
    assertTenant(row._tenant);
  }
  if ("_archived" in row) {
    assertArchived(row._archived);
  }
  if ("_createdAt" in row) {
    assertCreatedAt(row._createdAt);
  }
  if ("_updatedAt" in row) {
    const created = "_createdAt" in row ? row._createdAt : row._updatedAt;
    assertUpdatedAt(created, row._updatedAt);
  }
  assertDomainKeys(row);
}

function assertId(value: unknown) {
  if (typeof value !== "string" || !parseTypeId(value)) {
    throw new TypeIdError("OwnedObjects _id must be a typeid");
  }
}

function assertObject(value: unknown) {
  if (typeof value !== "string" || !isObjectType(value)) {
    throw new TypeIdError("OwnedObjects _object must be an object type");
  }
}

function assertTenant(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeIdError("OwnedObjects _tenant must be a tenant id");
  }
}

function assertArchived(value: unknown) {
  if (typeof value !== "boolean") {
    throw new TypeIdError("OwnedObjects _archived must be a boolean");
  }
}

function assertCreatedAt(value: unknown) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeIdError("OwnedObjects _createdAt must be a timestamp");
  }
}

function assertUpdatedAt(created: unknown, updated: unknown) {
  if (!(updated instanceof Date) || Number.isNaN(updated.getTime())) {
    throw new TypeIdError("OwnedObjects _updatedAt must be a timestamp");
  }
  if (created instanceof Date && updated.getTime() < created.getTime()) {
    throw new TypeIdError(
      "OwnedObjects _updatedAt must be at or after _createdAt",
    );
  }
}

function assertDomainKeys(row: Record<string, unknown>) {
  for (const key of Object.keys(row)) {
    if (key.startsWith("_") && !reserved.has(key)) {
      throw new TypeIdError(`OwnedObjects field ${key} is reserved`);
    }
  }
}

function writeKind(sql: string) {
  const stripped = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .trim();
  const word = stripped.match(/^[a-z]+/i)?.[0]?.toLowerCase();
  if (word === "insert") {
    return "insert";
  }
  if (word === "update") {
    return "update";
  }
  if (word === "with" && /\binsert\b/i.test(stripped)) {
    return "insert";
  }
  if (word === "with" && /\bupdate\b/i.test(stripped)) {
    return "update";
  }
  return null;
}

function namesColumn(sql: string, column: string) {
  return new RegExp(`(^|[^a-z0-9])${column}([^a-z0-9]|$)`, "i").test(sql);
}

function rowsOf(values: readonly unknown[]) {
  const rows: Record<string, unknown>[] = [];
  for (const value of values) {
    if (Array.isArray(value)) {
      rows.push(...rowsOf(value));
      continue;
    }
    const row = plainRow(value);
    if (row) {
      rows.push(row);
      continue;
    }
    const nested = helperRows(value);
    if (nested) {
      rows.push(...rowsOf(nested));
    }
  }
  return rows;
}

function helperRows(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const helper = value as { value?: unknown };
  return Array.isArray(helper.value) ? helper.value : null;
}

function plainRow(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    return null;
  }
  return value as Record<string, unknown>;
}
