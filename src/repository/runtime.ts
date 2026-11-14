import { z } from "zod";
import { DBCall } from "../db/client.ts";
import { assertOwnedObject } from "../typeid/owned.ts";
import {
  buildListSql,
  cursorFromRow,
  filterColumns,
  quote,
  sortableColumns,
} from "./query.ts";
import type { ColumnType, DomainColumn } from "./sql.ts";

export type ColumnSpec =
  | {
      readonly type: Exclude<ColumnType, "enum">;
      readonly nullable: boolean;
    }
  | {
      readonly type: "enum";
      readonly values: readonly [string, ...string[]];
      readonly nullable: boolean;
    };

type SpecValue<Spec extends ColumnSpec> = Spec extends {
  type: "enum";
  values: readonly (infer Value)[];
}
  ? Value
  : Spec["type"] extends "text"
    ? string
    : Spec["type"] extends "boolean"
      ? boolean
      : Spec["type"] extends "timestamptz"
        ? Date
        : Spec["type"] extends "integer"
          ? number
          : Spec["type"] extends "bigint"
            ? string
            : Spec["type"] extends "numeric"
              ? string
              : Spec["type"] extends "jsonb"
                ? unknown
                : never;

export type DomainRow<Columns extends Record<string, ColumnSpec>> = {
  [Key in keyof Columns]: Columns[Key]["nullable"] extends true
    ? SpecValue<Columns[Key]> | null
    : SpecValue<Columns[Key]>;
};

export type RepositoryRow<Columns extends Record<string, ColumnSpec>> = {
  _id: string;
  _object: string;
  _tenant: string;
  _archived: boolean;
  _createdAt: Date;
  _updatedAt: Date;
} & DomainRow<Columns>;

export type ListConstraints<Columns extends Record<string, ColumnSpec>> = {
  filters?: readonly (keyof Columns & string)[];
  limit?: number;
};

type AllowedFilters<
  Columns extends Record<string, ColumnSpec>,
  List,
> = List extends { filters: readonly (infer Name)[] }
  ? Extract<Name, keyof Columns>
  : keyof Columns;

type ListQuery<Columns extends Record<string, ColumnSpec>, List> = {
  q?: string;
  sort?: string;
  cursor?: string;
  limit?: number;
  archived?: "true" | "false";
} & {
  [Key in AllowedFilters<Columns, List>]?: string;
};

type ListCall<Columns extends Record<string, ColumnSpec>, List> = (
  query: ListQuery<Columns, List>,
  options: { tenant: string; where?: Partial<DomainRow<Columns>> },
) => Promise<{
  items: RepositoryRow<Columns>[];
  nextCursor: string | null;
}>;

type ListProcessor<Columns extends Record<string, ColumnSpec>, List> = ListCall<
  Columns,
  List
> & {
  schema: z.ZodType<ListQuery<Columns, List>>;
  includeArchived: ListCall<Columns, List>;
};

type GetCall<Columns extends Record<string, ColumnSpec>> = (
  params: { id: string },
  query: { archived?: "true" | "false" },
  options: { tenant: string },
) => Promise<RepositoryRow<Columns> | null>;

type GetProcessor<Columns extends Record<string, ColumnSpec>> =
  GetCall<Columns> & {
    params: z.ZodObject<{ id: z.ZodString }>;
    query: z.ZodObject<{
      archived: z.ZodOptional<z.ZodEnum<{ true: "true"; false: "false" }>>;
    }>;
    includeArchived: GetCall<Columns>;
  };

export type Repository<Columns extends Record<string, ColumnSpec>> = {
  table: string;
  schema: z.ZodType<DomainRow<Columns>>;
  meta: z.ZodType<RepositoryRow<Columns>>;
  insert(row: RepositoryRow<Columns>): Promise<RepositoryRow<Columns>>;
  upsert(row: RepositoryRow<Columns>): Promise<RepositoryRow<Columns> | null>;
  update(
    id: string,
    tenant: string,
    patch: Partial<DomainRow<Columns>> & { _archived?: boolean },
  ): Promise<RepositoryRow<Columns> | null>;
  archive(id: string, tenant: string): Promise<RepositoryRow<Columns> | null>;
  hardDelete(
    id: string,
    tenant: string,
  ): Promise<RepositoryRow<Columns> | null>;
  find(
    id: string,
    options: { tenant: string; archived?: boolean },
  ): Promise<RepositoryRow<Columns> | null>;
};

export function repository<
  const Columns extends Record<string, ColumnSpec>,
  const List extends boolean | ListConstraints<Columns> = false,
  const Get extends boolean = false,
>(input: {
  table: string;
  columns: Columns;
  list?: List;
  get?: Get;
}): Repository<Columns> &
  (List extends false ? object : { list: ListProcessor<Columns, List> }) &
  (Get extends true ? { get: GetProcessor<Columns> } : object) {
  const columns = Object.entries(input.columns).map(
    ([name, column]): DomainColumn =>
      column.type === "enum"
        ? {
            name,
            type: "enum",
            nullable: column.nullable,
            values: column.values,
          }
        : {
            name,
            type: column.type,
            nullable: column.nullable,
          },
  );
  const shape = rowSchemas(columns);
  const base: Repository<Columns> = {
    table: input.table,
    schema: shape.schema as z.ZodType<DomainRow<Columns>>,
    meta: shape.meta as z.ZodType<RepositoryRow<Columns>>,
    insert: (row) => insertRow(input.table, row),
    upsert: (row) => upsertRow<Columns>(input.table, columns, row),
    update: (id, tenant, patch) =>
      updateRow<Columns>(input.table, columns, id, tenant, patch),
    archive: (id, tenant) =>
      updateRow<Columns>(input.table, columns, id, tenant, archivedPatch()),
    hardDelete: (id, tenant) => hardDeleteRow<Columns>(input.table, id, tenant),
    find: (id, options) => findRow<Columns>(input.table, columns, id, options),
  };
  const withList =
    input.list === true || typeof input.list === "object"
      ? { ...base, list: createList(input.table, columns, input.list) }
      : base;
  const withGet = input.get
    ? { ...withList, get: createGet(input.table, columns) }
    : withList;
  return withGet as Repository<Columns> &
    (List extends false ? object : { list: ListProcessor<Columns, List> }) &
    (Get extends true ? { get: GetProcessor<Columns> } : object);
}

function createList<Columns extends Record<string, ColumnSpec>>(
  table: string,
  columns: DomainColumn[],
  list: true | ListConstraints<Columns>,
): ListProcessor<Columns, typeof list> {
  const constraints = list === true ? {} : list;
  const allowed = listFilters(table, columns, constraints.filters);
  const sorts = sortableColumns(columns).flatMap((column) => [
    column,
    `-${column}`,
  ]);
  const shape: Record<string, z.ZodType> = {
    q: z.string().optional(),
    sort: z.enum(sorts as [string, ...string[]]).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    archived: z.enum(["true", "false"]).optional(),
  };
  for (const column of allowed) {
    shape[column.name] = z.string().optional();
  }
  const schema = z.object(shape) as z.ZodType<ListQuery<Columns, typeof list>>;
  const run =
    (includeArchived: boolean) =>
    async (
      query: ListQuery<Columns, typeof list>,
      options: { tenant: string; where?: Partial<DomainRow<Columns>> },
    ) => {
      const built = buildListSql({
        table,
        columns,
        query,
        tenant: options.tenant,
        filters: constraints.filters,
        limitDefault: constraints.limit,
        where: options.where,
        includeArchived,
      });
      const rows = (await DBCall.unsafe(
        built.text,
        built.values,
      )) as RepositoryRow<Columns>[];
      const items = rows.slice(0, built.limit);
      const last = items.at(-1);
      const nextCursor =
        rows.length > built.limit && last
          ? cursorFromRow(last, {
              column: builtQuerySort(query.sort),
              direction: query.sort?.startsWith("-") ? "desc" : "asc",
            })
          : null;
      return { items, nextCursor };
    };
  return Object.assign(run(false), { schema, includeArchived: run(true) });
}

function listFilters(
  table: string,
  columns: readonly DomainColumn[],
  filters: readonly string[] | undefined,
) {
  if (!filters) {
    return filterColumns(columns);
  }
  return filters.map((name) => {
    const column = columns.find((item) => item.name === name);
    if (!column || column.type === "jsonb") {
      throw new Error(`${table} list cannot filter ${name}`);
    }
    return column;
  });
}

function rowSchemas(columns: readonly DomainColumn[]) {
  const domain: Record<string, z.ZodType> = {};
  for (const column of columns) {
    domain[column.name] = columnSchema(column);
  }
  return {
    schema: z.object(domain),
    meta: z.object({
      _id: z.string(),
      _object: z.string(),
      _tenant: z.string(),
      _archived: z.boolean(),
      _createdAt: z.date(),
      _updatedAt: z.date(),
      ...domain,
    }),
  };
}

function columnSchema(column: DomainColumn) {
  const schema =
    column.type === "boolean"
      ? z.boolean()
      : column.type === "timestamptz"
        ? z.date()
        : column.type === "integer"
          ? z.number().int()
          : column.type === "bigint" || column.type === "numeric"
            ? z.string()
            : column.type === "jsonb"
              ? z.unknown()
              : column.type === "enum"
                ? z.enum(column.values)
                : z.string();
  return column.nullable ? schema.nullable() : schema;
}

function builtQuerySort(sort: string | undefined) {
  const raw = sort && sort !== "" ? sort : "_id";
  return raw.startsWith("-") ? raw.slice(1) : raw;
}

function createGet<Columns extends Record<string, ColumnSpec>>(
  table: string,
  columns: DomainColumn[],
): GetProcessor<Columns> {
  const params = z.object({ id: z.string().min(1) });
  const query = z.object({
    archived: z.enum(["true", "false"]).optional(),
  });
  const run =
    (includeArchived: boolean) =>
    async (
      input: { id: string },
      parsed: { archived?: "true" | "false" },
      options: { tenant: string },
    ) =>
      findRow<Columns>(table, columns, input.id, {
        tenant: options.tenant,
        archived: parsed.archived === "true",
        includeArchived,
      });
  return Object.assign(run(false), {
    params,
    query,
    includeArchived: run(true),
  });
}

async function insertRow<Columns extends Record<string, ColumnSpec>>(
  table: string,
  row: RepositoryRow<Columns>,
) {
  assertOwnedObject(row);
  const inserted = await DBCall<RepositoryRow<Columns>[]>`
    insert into ${DBCall(table)} ${DBCall(row)}
    returning *
  `;
  const saved = inserted[0];
  if (!saved) {
    throw new Error(`insert into ${table} returned no row`);
  }
  return saved;
}

function archivedPatch<Columns extends Record<string, ColumnSpec>>() {
  const patch: Partial<DomainRow<Columns>> & { _archived?: boolean } = {};
  patch._archived = true;
  return patch;
}

async function upsertRow<Columns extends Record<string, ColumnSpec>>(
  table: string,
  columns: readonly DomainColumn[],
  row: RepositoryRow<Columns>,
) {
  assertOwnedObject(row);
  const names = [
    "_id",
    "_object",
    "_tenant",
    "_archived",
    "_createdAt",
    "_updatedAt",
    ...columns.map((column) => column.name),
  ];
  const updates = names.filter(
    (name) =>
      name !== "_id" &&
      name !== "_object" &&
      name !== "_tenant" &&
      name !== "_createdAt",
  );
  const values = names.map((name) => row[name as keyof RepositoryRow<Columns>]);
  const placeholders = names.map((_, index) => `$${index + 1}`).join(", ");
  const assignments = updates
    .map((name) => `${quote(name)} = excluded.${quote(name)}`)
    .join(", ");
  const rows = (await DBCall.unsafe(
    `insert into ${quote(table)} (${names.map((name) => quote(name)).join(", ")}) values (${placeholders}) on conflict (${quote("_id")}) do update set ${assignments} where ${quote(table)}.${quote("_tenant")} = excluded.${quote("_tenant")} returning *`,
    values,
  )) as RepositoryRow<Columns>[];
  return rows[0] ?? null;
}

async function hardDeleteRow<Columns extends Record<string, ColumnSpec>>(
  table: string,
  id: string,
  tenant: string,
) {
  const rows = (await DBCall.unsafe(
    `delete from ${quote(table)} where ${quote("_id")} = $1 and ${quote("_tenant")} = $2 returning *`,
    [id, tenant],
  )) as RepositoryRow<Columns>[];
  return rows[0] ?? null;
}

async function updateRow<Columns extends Record<string, ColumnSpec>>(
  table: string,
  columns: readonly DomainColumn[],
  id: string,
  tenant: string,
  patch: Partial<DomainRow<Columns>> & { _archived?: boolean },
) {
  const entries = Object.entries(patch).filter(
    ([, value]) => value !== undefined,
  );
  if (entries.length === 0) {
    throw new Error(`${table} update has no columns`);
  }
  const values: unknown[] = [];
  const sets = entries.map(([key, value]) => {
    if (key !== "_archived" && !columns.some((column) => column.name === key)) {
      throw new Error(`${table} update cannot set ${key}`);
    }
    values.push(value);
    return `${quote(key)} = $${values.length}`;
  });
  values.push(new Date());
  const updatedAt = values.length;
  values.push(id, tenant);
  const rows = (await DBCall.unsafe(
    `update ${quote(table)} set ${sets.join(", ")}, ${quote("_updatedAt")} = $${updatedAt} where ${quote("_id")} = $${updatedAt + 1} and ${quote("_tenant")} = $${updatedAt + 2} returning *`,
    values,
  )) as RepositoryRow<Columns>[];
  return rows[0] ?? null;
}

async function findRow<Columns extends Record<string, ColumnSpec>>(
  table: string,
  columns: readonly DomainColumn[],
  id: string,
  options: { tenant: string; archived?: boolean; includeArchived?: boolean },
) {
  const selected = [
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
  const archived = options.includeArchived
    ? ""
    : ` and ${quote("_archived")} = $3`;
  const values = options.includeArchived
    ? [id, options.tenant]
    : [id, options.tenant, options.archived === true];
  const rows = (await DBCall.unsafe(
    `select ${selected} from ${quote(table)} where ${quote("_id")} = $1 and ${quote("_tenant")} = $2${archived}`,
    values,
  )) as RepositoryRow<Columns>[];
  return rows[0] ?? null;
}
