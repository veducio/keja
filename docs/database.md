---

title: Database
description: Optional Postgres migrations, repositories, and the DBCall client.
---

Postgres is optional. When it is on, three commands split the work. `keja migrate` applies the SQL files. `keja generate` reads those files and writes a repository for each table. `keja seed` inserts starter rows. `keja dev` and `keja start` open the pool and leave the SQL files where they are.

Postgres is off until config turns it on. An omitted `db` and `db: { enabled: false }` leave the database disabled, so a project can boot with no `DATABASE_URL`. `db: { enabled: true }` uses the `migrations` folder. `migrations` sets another path, resolved from the project root. An empty migrations path fails config loading. The full field list is on [Project](/project#db).

| Field        | Default      | Role                                                      |
| ------------ | ------------ | --------------------------------------------------------- |
| `enabled`    | —            | Required. `false` leaves Postgres off                     |
| `migrations` | `migrations` | Folder of `0001_name.sql` files when `enabled` is `true`  |

```ts
export default defineConfig({
  db: { enabled: true, migrations: "migrations" },
});
```

When the database is enabled, `DATABASE_URL` must be a `postgres://` or `postgresql://` URL. Anything else is project error `2013`. `keja dev` and `keja start` open the pool and leave migrations untouched. `keja migrate` applies the files. A rejected migration is `2018`. A connection failure is `2022`.

## Migration files

Files are `0001_name.sql`. The number is at least four digits. The name starts with a letter or digit and may contain letters, digits, `_`, and `-`. Other files and directories in the folder are project error `2015`. Two files with the same number are `2016`. A missing folder is `2014`. Gaps in the numbers are allowed. An empty folder creates the ledger table and reports the database as up to date.

Keja records each applied file in `keja_migrations` with the filename, a sha256 checksum, and `applied_at`. Each file runs inside a transaction. A changed checksum on an applied file is project error `2017`. SQL that Postgres rejects is `2018`.

`keja migrate` prints the migrations folder and the filenames applied by that command, or `up to date`. Startup prints `postgres` when the pool is open.

## Seeders

`defineSeeder` names a table and the OwnedObjects rows that belong in it. Put one module per file in `seed`. `keja seed` loads those files in path order and inserts the rows. Run `keja migrate` first so the tables exist. An `_id` that is already present is skipped, so running the command again does not duplicate rows. Objects in one seeder use the same columns. A seed file that exports no seeder is project error `2027`. A table name or row that does not match OwnedObjects is `2026`.

```ts
import { defineSeeder } from "@veducio/keja";

const at = new Date("2026-01-15T00:00:00.000Z");

export default defineSeeder({
  table: "users",
  objects: [
    {
      _id: "users_01h455vb4pex5vsknk084sn02q",
      _object: "v1.users",
      _tenant: "tenant_01h455vb4pex5vsknk084sn02q",
      _archived: false,
      _createdAt: at,
      _updatedAt: at,
      name: "Ada Lovelace",
      email: "ada@example.com",
    },
  ],
});
```

`keja seed` with the database disabled throws `DependencyNotMet`: `seed requires db`.

## Repositories

`keja generate` reads `CREATE TABLE` and `ALTER TABLE ... ADD COLUMN` from the migration files and writes `src/db/repositories.ts`. It does not connect to Postgres. Each table gets `insert`, `upsert`, `update`, `archive`, `hardDelete`, and `find`. `keja.repositories.ts` turns on `list` and `get` for the tables you name. A table with no entry still gets the repository.

```ts
import { defineRepositories } from "@veducio/keja";

export default defineRepositories({
  users: { list: { filters: ["name"], limit: 20 }, get: true },
});
```

A handler still owns the route. It attaches the processor schema and passes the parsed query plus the tenant.

```ts
export default defineRoute({
  method: "get",
  path: "/users",
  version: "v1",
  request: { query: users.list.schema },
  responses: {
    Users: response({
      code: 200,
      json: z.object({
        users: z.array(users.schema),
        nextCursor: z.string().nullable(),
      }),
    }),
  },
  handler: async ({ query, respond }) => {
    const page = await users.list(query, {
      tenant,
      where: { email: "ada@example.com" },
    });
    return respond.Users({
      users: page.items,
      nextCursor: page.nextCursor,
    });
  },
});
```

`list: true` accepts an equality filter for every domain column except `jsonb`. `list: { filters, limit }` names the filters the query may pass and the page size used when `limit` is omitted. `limit` still stops at 100. The handler can pass `where` for more equality checks beside the tenant. `archived=true` returns archived rows only. Call `list.includeArchived(...)` or `get.includeArchived(...)` to return live rows and archived rows together. `q` matches the text columns that are allowed filters. `sort` is one non-null domain column or `_id`, with a leading `-` for descending. The default sort is `_id` ascending. The cursor is opaque. `schema` is one row without the owned columns. `meta` is one row with `_id`, `_object`, `_tenant`, `_archived`, `_createdAt`, and `_updatedAt`. `insert` stores a full owned row. `upsert` stores that row, or replaces the domain columns, `_archived`, and `_updatedAt` when `_id` already belongs to the same tenant. A conflicting `_id` in another tenant is left in place and `upsert` returns null. `update` changes the named domain columns and sets `_updatedAt`. `archive` sets `_archived` and `_updatedAt`. `hardDelete` removes the row. Each of those returns the row, or null when no row matches the id and tenant. `get` returns the row or null. Get exposes `params` and `query` separately so they map onto `defineRoute`.

A migration Keja cannot read is project error `2028`. A repository file that names an unknown table or a flag other than `list` and `get` is `2029`.

## DBCall

`DBCall` is the shared client after the pool connects. It forwards tagged templates and methods to the Bun SQL client.

```ts
import { DBCall } from "@veducio/keja";

const rows = await DBCall`select id from notes where _tenant = ${tenant}`;
```

Calling it while the database is disabled throws `DependencyNotMet`: `DBCall requires db`. Inserts and updates must follow the [OwnedObjects](/owned-objects) shape. A table created by a migration is checked for that shape before the migration is recorded. A mismatch is project error `2021` and the transaction rolls back.

## Connections

Keja opens one Bun SQL pool at startup and keeps it for the life of the process. A query that is running when its connection resets fails. Keja does not retry that query. A later `DBCall` can open a new connection from the same pool when the pool has none available. The default pool size is 10.
