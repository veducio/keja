import { isObjectType, ObjectIdError, parseObjectId } from "./id.ts";

const reserved = new Set(["_id", "_object", "_tenant", "_archived"]);

export type OwnedObject = {
  _id: string;
  _object: string;
  _tenant: string;
  _archived: boolean;
} & Record<string, unknown>;

export function assertOwnedObject(value: unknown): OwnedObject {
  const row = plainRow(value);
  if (!row) {
    throw new ObjectIdError("owned object must be an object");
  }
  assertId(row._id);
  assertObject(row._object);
  assertTenant(row._tenant);
  assertArchived(row._archived);
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
        throw new ObjectIdError(`insert must include ${column}`);
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
  assertDomainKeys(row);
}

function assertId(value: unknown) {
  if (typeof value !== "string" || !parseObjectId(value)) {
    throw new ObjectIdError("owned object _id must be an object id");
  }
}

function assertObject(value: unknown) {
  if (typeof value !== "string" || !isObjectType(value)) {
    throw new ObjectIdError("owned object _object must be an object type");
  }
}

function assertTenant(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ObjectIdError("owned object _tenant must be a tenant id");
  }
}

function assertArchived(value: unknown) {
  if (typeof value !== "boolean") {
    throw new ObjectIdError("owned object _archived must be a boolean");
  }
}

function assertDomainKeys(row: Record<string, unknown>) {
  for (const key of Object.keys(row)) {
    if (key.startsWith("_") && !reserved.has(key)) {
      throw new ObjectIdError(`owned object field ${key} is reserved`);
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
    }
  }
  return rows;
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
