---
title: How to use Postgres
description: Enable the database, migrate, generate repositories, and query in a handler.
---

Turn on Postgres for a Keja project, apply migrations, generate repositories, and read rows from a route.

## Prerequisites

- A Keja project that runs with `keja dev` / `keja start`
- A Postgres database you can reach
- Familiarity with the [OwnedObjects](/owned-objects) column list

## Steps

### 1. Enable the database

In `keja.config.ts`:

```ts
export default defineConfig({
  db: { enabled: true, migrations: "migrations" },
});
```

In `.env`:

```txt
DATABASE_URL=postgres://user:pass@127.0.0.1:5432/mydb
```

Restart the process after changing `db` or `DATABASE_URL`. The pool is fixed at boot.

### 2. Add a migration

Create `migrations/0001_notes.sql` (use the next free number if files already exist):

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

```shell
keja migrate
```

### 3. Turn on list/get and generate

`keja.repositories.ts`:

```ts
import { defineRepositories } from "@veducio/keja";

export default defineRepositories({
  notes: { list: true, get: true },
});
```

```shell
keja generate
```

This writes `src/db/repositories.ts` from migration SQL. It does not connect to Postgres.

### 4. Use the repository in a route

```ts
import { defineRoute, response } from "@veducio/keja";
import { z } from "zod";
import { notes } from "../db/repositories.ts";

export default defineRoute({
  method: "get",
  path: "/notes",
  version: "v1",
  request: { query: notes.list.schema },
  responses: {
    Notes: response({
      code: 200,
      json: z.object({
        notes: z.array(notes.meta),
        nextCursor: z.string().nullable(),
      }),
    }),
  },
  handler: async ({ query, respond }) => {
    const page = await notes.list(query, {
      tenant: "tenant_01h455vb4pex5vsknk084sn02q",
    });
    return respond.Notes({
      notes: page.items,
      nextCursor: page.nextCursor,
    });
  },
});
```

### 5. Optional: seed rows

Add `seed/notes.ts`:

```ts
import { defineSeeder } from "@veducio/keja";

const at = new Date("2026-01-15T00:00:00.000Z");

export default defineSeeder({
  table: "notes",
  objects: [
    {
      _id: "notes_01h455vb4pex5vsknk084sn02q",
      _object: "v1.notes",
      _tenant: "tenant_01h455vb4pex5vsknk084sn02q",
      _archived: false,
      _createdAt: at,
      _updatedAt: at,
      message: "hello",
    },
  ],
});
```

```shell
keja seed
```

Existing `_id` values are skipped on re-run.

## Done

Postgres is on, migrations applied, and a handler can list rows. Full API: [Database](/database). Why the row shape exists: [OwnedObjects model](/owned-objects-model).
