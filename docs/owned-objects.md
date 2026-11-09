---

title: OwnedObjects
description: The Postgres row shape for a Veducio object.
---

Every application table stores the same kind of row. The reserved columns are the id, the object name, the tenant, the archive flag, and the two timestamps. Every other column is domain data for that object. Keja checks this shape when a migration runs and when a row is written.

An OwnedObjects row is the shape Veducio stores in Postgres. Every application table is one OwnedObjects table. `_id`, `_object`, `_tenant`, `_archived`, `_createdAt`, and `_updatedAt` are reserved. Every other column is domain data.

```text
_id:        user_01h455vb4pex5vsknk084sn02q
_object:    v2.user
_tenant:    tenant_01h455vb4pex5vsknk084sn02q
_archived:  false
_createdAt: 2026-01-01T00:00:00.000Z
_updatedAt: 2026-01-01T00:00:00.000Z
actor_id:   232532fsarrw23
active:     true
message:    wewesraewe wew eas
```

## Identity

`_id` is a [TypeID](/type-ids). It is the primary key. A TypeID starts with a lowercase prefix and continues with a time-ordered suffix, so new rows append in a Postgres B-tree instead of landing at random leaves.

```text
user_01h455vb4pex5vsknk084sn02q
```

`createTypeId` and `createObjectRow` build this value. `parseTypeId` accepts only that form.

## Object name

`_object` is the object type. It starts with the API major version and continues with one or more lowercase segments.

```text
v2.user
v2.core.users
```

Each segment after the version is a TypeID prefix: it starts and ends with a letter and may contain lowercase letters and underscores. `objectTypeFromRoute(2, "/user")` produces `v2.user`. The last segment is the default `_id` prefix.

## Tenant

`_tenant` is the id of the tenant that owns the row. It is required text and must contain a non-blank value. A tenant id is usually itself a TypeID.

## Archive

`_archived` is the soft-delete flag. It is a boolean and it is never null.

New rows set `_archived` to `false`. When other rows still reference this object, deletion sets `_archived` to `true` and leaves the row in place. A later read treats an archived row as deleted.

## Timestamps

`_createdAt` and `_updatedAt` are `timestamptz` values and they are never null. `createObjectRow` sets both to the current time. A later write sets `_updatedAt` to the new time and leaves `_createdAt` unchanged. `_updatedAt` is at or after `_createdAt`.

Quote these names in SQL. Postgres folds unquoted mixed-case identifiers, so the columns are `"_createdAt"` and `"_updatedAt"`.

## Domain columns

Columns after the reserved fields belong to the object. Their names must not start with `_`. Their types belong to the table.

`actor_id`, `active`, and `message` in the example are domain columns. They are not part of the OwnedObjects contract beyond being stored on the same row.

## Table

A table in `public` other than `keja_migrations` uses this shape. The check functions are installed before migrations run.

```sql
create table notes (
  _id text primary key check (keja_is_typeid(_id)),
  _object text not null check (keja_is_object_type(_object)),
  _tenant text not null check (keja_is_tenant(_tenant)),
  _archived boolean not null default false,
  "_createdAt" timestamptz not null,
  "_updatedAt" timestamptz not null,
  check (keja_timestamps("_createdAt", "_updatedAt")),
  actor_id text,
  active boolean,
  message text
);
```

| Column       | Type          | Rule                                          |
| ------------ | ------------- | --------------------------------------------- |
| `_id`        | `text`        | Primary key. `keja_is_typeid`                 |
| `_object`    | `text`        | Not null. `keja_is_object_type`               |
| `_tenant`    | `text`        | Not null. `keja_is_tenant`                    |
| `_archived`  | `boolean`     | Not null                                      |
| `_createdAt` | `timestamptz` | Not null                                      |
| `_updatedAt` | `timestamptz` | Not null. `keja_timestamps` with `_createdAt` |

`keja_is_typeid` accepts `prefix_suffix`. The suffix is 26 Crockford base32 characters encoding a UUIDv7. `keja_is_object_type` accepts `vN.segment` and further segments. `keja_is_tenant` accepts text that is not blank.

## Migrations

Each migration runs inside a transaction. After its SQL, Keja calls `keja_owned_object_violations()`. A table that misses a reserved column, uses the wrong type, leaves a reserved column nullable, uses a primary key other than `_id`, or omits a check fails the migration. The transaction rolls back. `keja_migrations` is the only table that is exempt.

## Database calls

`DBCall` is the database function path.

An `insert` that passes a row object must pass `assertOwnedObject`. The row needs a TypeID `_id`, `_object`, `_tenant`, boolean `_archived`, and both timestamps. Extra keys must not start with `_`.

An `insert` that passes scalar values must name `_id`, `_object`, `_tenant`, `_archived`, `_createdAt`, and `_updatedAt` in the SQL. Postgres then applies the same checks.

An `update` may change domain columns. When the update carries a reserved field, that value must still match this spec. A select is not an OwnedObjects write.
