---

title: Owned object
description: The Postgres row shape for a Veducio object.
---

An owned object is the row shape Veducio stores in Postgres. Every application table is one owned object. `_id`, `_object`, `_tenant`, and `_archived` are reserved. Every other column is domain data.

```text
_id:       user_V1StGXR8Z5jdHi6BmyT01
_object:   v2.user
_tenant:   tenant_0k3hN9mQ2pLx7aWc4sYbZ
_archived: false
actor_id:  232532fsarrw23
active:    true
message:   wewesraewe wew eas
```

## Identity

`_id` is an object id. It is the primary key.

An object id is a lowercase prefix, an underscore, and 21 characters from `0-9A-Za-z`.

```text
user_V1StGXR8Z5jdHi6BmyT01
```

The prefix matches `^[a-z][a-z0-9]*$`. The body length is always 21. `createId` and `createObjectRow` build this value. `parseObjectId` accepts only that form.

## Object name

`_object` is the object type. It starts with the API major version and continues with one or more lowercase segments.

```text
v2.user
v2.core.users
```

Each segment after the version matches `^[a-z][a-z0-9]*$`. `objectTypeFromRoute(2, "/user")` produces `v2.user`. The last segment is the default `_id` prefix.

## Tenant

`_tenant` is the id of the tenant that owns the row. It is required text and must contain a non-blank value. A tenant id is usually itself an object id, such as `tenant_0k3hN9mQ2pLx7aWc4sYbZ`.

## Archive

`_archived` is the soft-delete flag. It is a boolean and it is never null.

New rows set `_archived` to `false`. When other rows still reference this object, deletion sets `_archived` to `true` and leaves the row in place. A later read treats an archived row as deleted.

## Domain columns

Columns after the four reserved fields belong to the object. Their names must not start with `_`. Their types belong to the table.

`actor_id`, `active`, and `message` in the example are domain columns. They are not part of the owned-object contract beyond being stored on the same row.

## Table

A table in `public` other than `keja_migrations` uses this shape. The check functions are installed before migrations run.

```sql
create table notes (
  _id text primary key check (keja_is_object_id(_id)),
  _object text not null check (keja_is_object_type(_object)),
  _tenant text not null check (keja_is_tenant(_tenant)),
  _archived boolean not null default false,
  actor_id text,
  active boolean,
  message text
);
```

| Column      | Type      | Rule                             |
| ----------- | --------- | -------------------------------- |
| `_id`       | `text`    | Primary key. `keja_is_object_id` |
| `_object`   | `text`    | Not null. `keja_is_object_type`  |
| `_tenant`   | `text`    | Not null. `keja_is_tenant`       |
| `_archived` | `boolean` | Not null                         |

`keja_is_object_id` accepts `prefix_body` with a 21-character body. `keja_is_object_type` accepts `vN.segment` and further segments. `keja_is_tenant` accepts text that is not blank.

## Migrations

Each migration runs inside a transaction. After its SQL, Keja calls `keja_owned_object_violations()`. A table that misses a reserved column, uses the wrong type, leaves a reserved column nullable, uses a primary key other than `_id`, or omits a check fails the migration. The transaction rolls back. `keja_migrations` is the only table that is exempt.

## Database calls

`DBCall` is the database function path.

An `insert` that passes a row object must pass `assertOwnedObject`. The row needs a valid `_id`, `_object`, `_tenant`, and boolean `_archived`. Extra keys must not start with `_`.

An `insert` that passes scalar values must name `_id`, `_object`, `_tenant`, and `_archived` in the SQL. Postgres then applies the same checks.

An `update` may change domain columns. When the update carries `_id`, `_object`, `_tenant`, or `_archived`, those values must still match this spec. A select is not an owned-object write.
