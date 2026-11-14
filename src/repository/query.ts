import type { DomainColumn } from "./sql.ts";

const pageDefault = 50;
const pageMax = 100;

export type ListInput = {
  q?: string;
  sort?: string;
  cursor?: string;
  limit?: number;
  archived?: "true" | "false";
  [column: string]: string | number | undefined;
};

export type Sort = {
  column: string;
  direction: "asc" | "desc";
};

type Cursor = {
  column: string;
  direction: "asc" | "desc";
  value: string | null;
  id: string;
};

export function sortableColumns(columns: readonly DomainColumn[]) {
  return [
    "_id",
    ...columns
      .filter((column) => column.type !== "jsonb" && !column.nullable)
      .map((column) => column.name),
  ];
}

export function filterColumns(columns: readonly DomainColumn[]) {
  return columns.filter((column) => column.type !== "jsonb");
}

export function searchColumns(columns: readonly DomainColumn[]) {
  return columns.filter((column) => column.type === "text");
}

export function buildListSql(input: {
  table: string;
  columns: readonly DomainColumn[];
  query: ListInput;
  tenant: string;
  filters?: readonly string[];
  limitDefault?: number;
  where?: Record<string, unknown>;
  includeArchived?: boolean;
}) {
  const sort = parseSort(input.query.sort, sortableColumns(input.columns));
  const limit = pageLimit(input.query.limit, input.limitDefault);
  const values: unknown[] = [input.tenant];
  const where = [`${quote("_tenant")} = $1`];
  if (!input.includeArchived) {
    values.push(input.query.archived === "true");
    where.push(`${quote("_archived")} = $${values.length}`);
  }
  for (const [name, value] of Object.entries(input.where ?? {})) {
    if (value === undefined) {
      continue;
    }
    const column = input.columns.find((item) => item.name === name);
    if (!column || column.type === "jsonb") {
      throw new Error(`invalid where ${name}`);
    }
    if (value === null) {
      where.push(`${quote(name)} is null`);
      continue;
    }
    values.push(value);
    where.push(`${quote(name)} = $${values.length}`);
  }
  const filters = input.filters
    ? filterColumns(input.columns).filter((column) =>
        input.filters?.includes(column.name),
      )
    : filterColumns(input.columns);
  for (const column of filters) {
    const raw = (input.query as Record<string, unknown>)[column.name];
    if (typeof raw !== "string" || raw === "") {
      continue;
    }
    values.push(parseValue(column, raw));
    where.push(`${quote(column.name)} = $${values.length}`);
  }
  const pattern = likePattern(input.query.q);
  const searchable = input.filters
    ? searchColumns(input.columns).filter((column) =>
        input.filters?.includes(column.name),
      )
    : searchColumns(input.columns);
  if (pattern) {
    const matches = searchable.map((column) => {
      values.push(pattern);
      return `${quote(column.name)} ilike $${values.length} escape '\\'`;
    });
    if (matches.length > 0) {
      where.push(`(${matches.join(" or ")})`);
    }
  }
  const cursor = input.query.cursor
    ? decodeCursor(input.query.cursor, sort)
    : null;
  if (cursor) {
    where.push(cursorPredicate(input.columns, cursor, values));
  }
  values.push(limit + 1);
  const order =
    sort.column === "_id"
      ? `${quote("_id")} ${sort.direction}`
      : `${quote(sort.column)} ${sort.direction}, ${quote("_id")} ${sort.direction}`;
  return {
    text: `select ${selectList(input.columns)} from ${quote(input.table)} where ${where.join(" and ")} order by ${order} limit $${values.length}`,
    values,
    limit,
  };
}

export function encodeCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function cursorFromRow(row: Record<string, unknown>, sort: Sort) {
  const value = sort.column === "_id" ? row._id : row[sort.column];
  return encodeCursor({
    column: sort.column,
    direction: sort.direction,
    value: serialize(value),
    id: String(row._id),
  });
}

export function quote(name: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`invalid column ${name}`);
  }
  return `"${name}"`;
}

function parseSort(sort: string | undefined, allowed: readonly string[]): Sort {
  const raw = sort && sort !== "" ? sort : "_id";
  const direction = raw.startsWith("-") ? "desc" : "asc";
  const column = raw.startsWith("-") ? raw.slice(1) : raw;
  if (!allowed.includes(column)) {
    throw new Error(`invalid sort ${raw}`);
  }
  return { column, direction };
}

function pageLimit(limit: number | undefined, fallback = pageDefault) {
  const chosen = limit === undefined ? fallback : limit;
  if (!Number.isInteger(chosen) || chosen < 1 || chosen > pageMax) {
    throw new Error("limit must be from 1 to 100");
  }
  return chosen;
}

function cursorPredicate(
  columns: readonly DomainColumn[],
  cursor: Cursor,
  values: unknown[],
) {
  if (cursor.column === "_id") {
    values.push(cursor.id);
    const operator = cursor.direction === "asc" ? ">" : "<";
    return `${quote("_id")} ${operator} $${values.length}`;
  }
  const column = columns.find((item) => item.name === cursor.column);
  if (!column) {
    throw new Error("invalid cursor");
  }
  const operator = cursor.direction === "asc" ? ">" : "<";
  if (cursor.value === null) {
    values.push(cursor.id);
    const id = values.length;
    return cursor.direction === "asc"
      ? `(${quote(cursor.column)} is null and ${quote("_id")} > $${id})`
      : `(${quote(cursor.column)} is not null or (${quote(cursor.column)} is null and ${quote("_id")} < $${id}))`;
  }
  values.push(parseValue(column, cursor.value));
  const compared = values.length;
  values.push(cursor.id);
  const id = values.length;
  const tied = `(${quote(cursor.column)} = $${compared} and ${quote("_id")} ${operator} $${id})`;
  const moved = `${quote(cursor.column)} ${operator} $${compared}`;
  if (cursor.direction === "asc") {
    return `(${moved} or ${tied} or ${quote(cursor.column)} is null)`;
  }
  return `(${moved} or ${tied})`;
}

function decodeCursor(value: string, sort: Sort): Cursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<Cursor>;
    if (
      parsed.column !== sort.column ||
      parsed.direction !== sort.direction ||
      typeof parsed.id !== "string" ||
      (parsed.value !== null && typeof parsed.value !== "string")
    ) {
      throw new Error("invalid cursor");
    }
    return {
      column: parsed.column,
      direction: parsed.direction,
      value: parsed.value,
      id: parsed.id,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "invalid cursor") {
      throw error;
    }
    throw new Error("invalid cursor");
  }
}

function parseValue(column: DomainColumn, value: string) {
  if (column.type === "boolean") {
    if (value !== "true" && value !== "false") {
      throw new Error(`${column.name} filter must be true or false`);
    }
    return value === "true";
  }
  if (column.type === "integer") {
    if (!/^-?\d+$/.test(value)) {
      throw new Error(`${column.name} filter must be an integer`);
    }
    return Number(value);
  }
  if (column.type === "bigint") {
    if (!/^-?\d+$/.test(value)) {
      throw new Error(`${column.name} filter must be an integer`);
    }
    return value;
  }
  if (column.type === "numeric") {
    if (!/^-?\d+(?:\.\d+)?$/.test(value)) {
      throw new Error(`${column.name} filter must be a number`);
    }
    return value;
  }
  if (column.type === "enum" && !column.values.includes(value)) {
    throw new Error(
      `${column.name} filter must be ${column.values.join(", ")}`,
    );
  }
  return value;
}

function likePattern(value: string | undefined) {
  if (!value) {
    return null;
  }
  const escaped = value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
  return `%${escaped}%`;
}

function serialize(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

function selectList(columns: readonly DomainColumn[]) {
  return [
    "_id",
    "_object",
    "_tenant",
    "_archived",
    "_createdAt",
    "_updatedAt",
    ...columns.map((column) => column.name),
  ]
    .map((name) => quote(name))
    .join(", ");
}
