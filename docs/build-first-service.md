---

title: Build first service
description: Serve GET /v1/hello, then store one table.
---

This lesson builds the smallest useful Keja service. You will serve a public hello route, call the service port, then store and list one Postgres table. Finish [Install](/install) first so you have a project directory.

## 1. Open the project and turn Postgres off for a moment

The starter enables Postgres. The first requests do not need a database. Open `keja.config.ts` and set:

```ts
db: { enabled: false },
```

`.env` should already define `HOST`, `HTTP_PORT`, and `HTTP_SERVICE_PORT` (typically `127.0.0.1`, `3000`, `3001`).

```shell
bun run dev
```

When the project loads, the CLI prints `no issues found`.

## 2. Call the hello route

```shell
curl http://127.0.0.1:3000/v1/hello
```

You should see `{ "message": "hello" }`. That response comes from `src/public/hello.ts`:

```ts
import { defineRoute, response } from "@veducio/keja";
import { z } from "zod";

export default defineRoute({
  method: "get",
  path: "/hello",
  version: "v1",
  responses: {
    Hello: response({
      code: 200,
      json: z.object({ message: z.string() }),
    }),
  },
  handler: ({ respond }) => respond.Hello({ message: "hello" }),
});
```

Save a change to that file. `keja dev` prints `reloading...`, then `no issues found` again.

## 3. See the version in the URL

`keja.versioning.ts` lists published versions:

```ts
import { defineVersions } from "@veducio/keja";

export default defineVersions({
  v1: { releasedAt: "2026-01-01" },
});
```

`GET /v1/hello` means version `v1` and route path `/hello`. You will learn fallback rules later; for this lesson, one version is enough.

## 4. Read a query parameter

Replace the hello route so it requires `name`:

```ts
export default defineRoute({
  method: "get",
  path: "/hello",
  version: "v1",
  request: {
    query: z.object({ name: z.string().min(1) }),
  },
  responses: {
    Hello: response({
      code: 200,
      json: z.object({ message: z.string() }),
    }),
  },
  handler: ({ query, respond }) =>
    respond.Hello({ message: `hello ${query.name}` }),
});
```

```shell
curl "http://127.0.0.1:3000/v1/hello?name=Ada"
```

You should see `{ "message": "hello Ada" }`. Omitting `name` returns HTTP `400`.

## 5. Call the service port

The same process listens on `HTTP_SERVICE_PORT`. Service routes are POST only. The starter includes `src/service/ping.ts`.

```shell
curl -X POST http://127.0.0.1:3001/v1/ping
```

You should see `{ "ok": true }`. Open `http://127.0.0.1:3000/docs` in a browser for the public Scalar UI.

## 6. Store a table

Set `db` back to `{ enabled: true }` in `keja.config.ts`. Add a `postgres://` or `postgresql://` `DATABASE_URL` to `.env`. Restart `keja dev` so the pool opens (database settings are not hot-reloaded).

Add `migrations/0002_notes.sql` (keep any starter migration that already exists):

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

Enable list for that table in `keja.repositories.ts`:

```ts
import { defineRepositories } from "@veducio/keja";

export default defineRepositories({
  notes: { list: true },
});
```

Apply SQL, then generate repositories:

```shell
keja migrate
keja generate
```

Create `src/public/notes.ts`:

```ts
import { defineRoute, response } from "@veducio/keja";
import { z } from "zod";
import { notes } from "../db/repositories.ts";

const tenant = "tenant_01h455vb4pex5vsknk084sn02q";

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
    const page = await notes.list(query, { tenant });
    return respond.Notes({
      notes: page.items,
      nextCursor: page.nextCursor,
    });
  },
});
```

```shell
curl http://127.0.0.1:3000/v1/notes
```

You should see `{ "notes": [], "nextCursor": null }` until rows exist. Use [How to use Postgres](/how-to-use-postgres) for seeders and writes.

## You finished the lesson

You have a public route, a service route, Scalar docs, and a generated list endpoint. Next steps by task:

- [How to add a route](/how-to-add-a-route)
- [How to version an API](/how-to-version-an-api)
- [How to batch requests](/how-to-batch-requests)
- [Why Keja](/why-keja) if you want the design discussion
