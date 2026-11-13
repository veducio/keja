---

title: Build first service
description: Serve GET /v1/hello, then store one table.
---

This page builds the smallest Keja service. Each step does one thing and links to the page that explains it. [Install](/install) covers the GitHub Packages token and `bun add`.

## Create the project

`keja init` copies the starter into an empty directory, writes `.env` from `.env.example`, runs `bun install`, runs `git init`, and adds `src/public/hello.ts` plus `src/service/ping.ts`.

```shell
keja init --name my-app --dir ./my-app
cd my-app
```

The starter turns Postgres on. The first request on this page does not need a database, so open `keja.config.ts` and set `db` to `{ enabled: false }` until the data section below. [Project](/project) lists the other config fields.

`.env` already sets `HOST`, `HTTP_PORT`, and `HTTP_SERVICE_PORT`. The starter values are `127.0.0.1`, `3000`, and `3001`.

```shell
bun run dev
```

`keja dev` prints `no issues found` when the project loads. Request the public port:

```shell
curl http://127.0.0.1:3000/v1/hello
```

The body is `{ "message": "hello" }`. `src/public/hello.ts` is the route that produced it:

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

`path` is `/hello`. The `/v1` in the URL is the version, from the next section. Saving this file reloads the route. `keja dev` prints `reloading...` and then `no issues found`.

## The version in the URL

`keja.versioning.ts` is the catalog. The starter publishes one version:

```ts
import { defineVersions } from "@veducio/keja";

export default defineVersions({
  v1: { releasedAt: "2026-01-01" },
});
```

The first segment of a request path is that version. `GET /v1/hello` asks for `v1` and the route path `/hello`. [Versioning](/versioning) explains what happens when a later version exists and this path does not.

## Change the greeting

Add a query parameter so the handler reads the request. [Routes](/routes) describes `request`. [Responses](/responses) describes `respond.Hello`.

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

The body is `{ "message": "hello Ada" }`. A request with no `name` returns HTTP `400`.

## The second server

The same process listens on `HTTP_SERVICE_PORT`. Service routes are POST. The starter’s `src/service/ping.ts` is `POST /ping`.

```shell
curl -X POST http://127.0.0.1:3001/v1/ping
```

The body is `{ "ok": true }`. [Servers](/servers) lists the reserved routes on both ports, including `/_health` and `/docs`.

## When the service stores data

Turn Postgres back on when a route needs to store a row. [OwnedObjects](/owned-objects) is the column shape. [TypeIDs](/type-ids) is the `_id`. [Database](/database) is migrations, repositories, and seed data.

Set `db` to `{ enabled: true }` in `keja.config.ts`. `.env` needs a `postgres://` or `postgresql://` `DATABASE_URL`. Restart `keja dev` after that change so the pool opens. The database pool stays as it was at boot.

The starter already has `migrations/0001_init.sql`. Add the notes table as the next file, `migrations/0002_notes.sql`:

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

`keja.repositories.ts` turns on list for that table:

```ts
import { defineRepositories } from "@veducio/keja";

export default defineRepositories({
  notes: { list: true },
});
```

Apply the SQL, then generate the repository. Generate reads the migration files. It does not connect to Postgres.

```shell
keja migrate
keja generate
```

`keja generate` writes `src/db/repositories.ts`. A route attaches `notes.list.schema` and passes the tenant itself. The tenant is a value your service already knows. This handler uses a fixed one so the first list runs:

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

Save that file as `src/public/notes.ts`. After the reload:

```shell
curl http://127.0.0.1:3000/v1/notes
```

The body is `{ "notes": [], "nextCursor": null }` until a row exists. `notes.meta` is the stored row, including `_id` and the timestamps. `notes.schema` is the domain columns only, here `message`. `keja seed` inserts starter rows. The Database page shows `defineSeeder`.

Argus, Vault, Grants, and Cloudflare Access stay off until a service needs them. Batch is on by default. Set `batch: false` in `keja.config.ts` to turn `POST /{version}/batch` off.
