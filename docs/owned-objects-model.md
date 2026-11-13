---
title: OwnedObjects model
description: Why every application table shares the same reserved columns.
---

When Postgres is enabled, every application table is an OwnedObjects table. The reserved columns are `_id`, `_object`, `_tenant`, `_archived`, `_createdAt`, and `_updatedAt`. Everything else is domain data for that object.

## Why one shape

Small services share operators, migrations, and generated code. One row contract means one set of checks in SQL, one TypeID story for primary keys, one soft-delete flag, and repositories that can generate `list` and `get` without per-table special cases. The framework can refuse a migration that drifts from the contract before that drift ships.

## What the columns mean together

`_id` is a TypeID: a typed, time-ordered primary key. `_object` names the type at an API major version (`v1.notes`). `_tenant` scopes the row to an owner. `_archived` is soft delete without removing the row. The timestamps record create and last write. Domain columns must not start with `_`, so reserved names stay reserved.

## What this is not

OwnedObjects is not an ORM domain model and not a document store. It is a Postgres table contract plus helpers (`createObjectRow`, repositories, seeders). You still write SQL migrations. You still decide indexes and domain columns. Keja only insists that the shared envelope stays intact.

Exact column rules and SQL checks are in [OwnedObjects](/owned-objects). Id format is in [TypeIDs](/type-ids). Commands and repository APIs are in [Database](/database).
