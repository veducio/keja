---
title: OwnedObjects
description: Required Postgres columns for application tables.
---

Every application table (except `keja_migrations`) must match this shape. Keja checks it after each migration transaction and when writing rows through helpers.

## Columns

| Column | Type | Rule |
| ------ | ---- | ---- |
| `_id` | `text` | Primary key; `keja_is_typeid` |
| `_object` | `text` | Not null; `keja_is_object_type` |
| `_tenant` | `text` | Not null; `keja_is_tenant` |
| `_archived` | `boolean` | Not null; default false for new rows |
| `_createdAt` | `timestamptz` | Not null; quote as `"_createdAt"` in SQL |
| `_updatedAt` | `timestamptz` | Not null; quote as `"_updatedAt"`; `keja_timestamps` with `_createdAt` |

Domain columns follow. Names must not start with `_`.

## Value forms

| Field | Form |
| ----- | ---- |
| `_id` | TypeID: `prefix_suffix` (26 Crockford base32 suffix / UUIDv7) |
| `_object` | `vN.segment` with one or more TypeID-prefix segments |
| `_tenant` | Non-blank text (often a TypeID) |

`objectTypeFromRoute(2, "/user")` → `v2.user`. Last segment is the default `_id` prefix.

## Example table

```sql
create table notes (
  _id text primary key check (keja_is_typeid(_id)),
  _object text not null check (keja_is_object_type(_object)),
  _tenant text not null check (keja_is_tenant(_tenant)),
  _archived boolean not null default false,
  "_createdAt" timestamptz not null,
  "_updatedAt" timestamptz not null,
  check (keja_timestamps("_createdAt", "_updatedAt")),
  message text not null
);
```

## Writes

`assertOwnedObject` validates a full row object. SQL inserts that pass scalars must still name the reserved columns so Postgres checks apply. Updates may change domain columns; reserved values that are sent must still satisfy the checks. Failed shape after migration → project error `2021` and rollback.

See also [TypeIDs](/type-ids) and [OwnedObjects model](/owned-objects-model).
