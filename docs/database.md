---

title: Database
description: Migrations, seeders, repositories, and DBCall.
---

Postgres is off until `db.enabled` is `true`. Config fields: [Project](/project#db).

## Config and env

| Item            | Value                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| `db.migrations` | Default `migrations`                                                       |
| `DATABASE_URL`  | Required when enabled; `postgres://` or `postgresql://` (`2013` otherwise) |

`keja dev` / `keja start` open the pool and do not apply migrations. Connection failure → `2022`.

## Migration files

| Pattern         | Rules                                                                          |
| --------------- | ------------------------------------------------------------------------------ |
| `0001_name.sql` | Number ≥ four digits; name starts with letter/digit; letters, digits, `_`, `-` |

| Error  | Meaning                         |
| ------ | ------------------------------- |
| `2014` | Folder missing                  |
| `2015` | Invalid file/name               |
| `2016` | Duplicate number                |
| `2017` | Applied file checksum changed   |
| `2018` | Postgres rejected SQL           |
| `2021` | Table failed OwnedObjects check |

Gaps in numbers are allowed. Empty folder creates `keja_migrations` and reports up to date. Each file runs in a transaction; checksums stored in `keja_migrations`.

## Seeders

Modules in `seed/`. Path order. `defineSeeder({ table, objects })`. Objects must be OwnedObjects-shaped and share columns within one seeder. Existing `_id` skipped. No seeder export → `2027`. Bad table/row → `2026`. Database disabled → `DependencyNotMet`: `seed requires db`.

## Repositories

`keja generate` reads `CREATE TABLE` / `ALTER TABLE ... ADD COLUMN` and writes `src/db/repositories.ts` (no DB connection). Unreadable SQL → `2028`.

`keja.repositories.ts`:

```ts
export default defineRepositories({
  users: { list: { filters: ["name"], limit: 20 }, get: true },
});
```

| Flag                       | Meaning                                              |
| -------------------------- | ---------------------------------------------------- |
| omit / false               | Method not generated as list/get processor           |
| `list: true`               | Equality filters for every non-`jsonb` domain column |
| `list: { filters, limit }` | Named filters; default page size (cap 100)           |
| `get: true`                | Get by id                                            |

Unknown table or flag → `2029`. Tables without an entry still get insert/upsert/update/archive/hardDelete/find.

### Generated surface

| Member                                                             | Description                                   |
| ------------------------------------------------------------------ | --------------------------------------------- |
| `schema`                                                           | Domain columns only                           |
| `meta`                                                             | Full owned row schema                         |
| `insert` / `upsert` / `update` / `archive` / `hardDelete` / `find` | Row helpers; null when no match for id+tenant |
| `list(query, { tenant, where? })`                                  | Page `{ items, nextCursor }`                  |
| `list.schema`                                                      | Query Zod schema                              |
| `list.includeArchived`                                             | Live + archived                               |
| `get(params, query, { tenant })`                                   | Row or null                                   |
| `get.params` / `get.query`                                         | Zod for route wiring                          |
| `get.includeArchived`                                              | Live + archived                               |

List query: `q`, `sort`, `cursor`, `limit`, `archived`, plus filter fields. `archived=true` → archived only. Default sort `_id` ascending. `where` adds equality beside tenant. Upsert returns null when `_id` exists under another tenant.

## `DBCall`

Shared Bun SQL client after the pool connects.

```ts
const rows = await DBCall`select _id from notes where _tenant = ${tenant}`;
```

Disabled DB → `DependencyNotMet`: `DBCall requires db`. Default pool size 10. No automatic retry of in-flight queries after a reset connection.
