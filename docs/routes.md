---

title: Routes
description: defineRoute files for the public and service servers.
---

A route is one `defineRoute` export. `path` is the URL after the version segment. The file’s folder decides which server owns it: `src/public` or `src/service`. The folders inside those directories do not change the URL.

A route file exports one or more `defineRoute` values. The URL is the `path` on the route. The folder path is only where the file lives.

```ts
import { defineRoute, response } from "@veducio/keja";
import { z } from "zod";

export default defineRoute({
  method: "get",
  path: "/users/:id",
  version: "v1",
  request: {
    params: z.object({ id: z.string().min(1) }),
  },
  responses: {
    User: response({ code: 200, json: z.object({ id: z.string() }) }),
  },
  handler: ({ params, respond }) => respond.User({ id: params.id }),
});
```

`method` is `get`, `post`, `put`, `patch`, or `delete`. `path` starts with `/` and can include `:name` parameters at any depth. A wrong method, path, or Zod schema fails when the route is defined, as project error `2030`. `version` must be a version id from `keja.versioning.ts`, such as `v1`. `request` may declare `params`, `query`, and `body` as Zod schemas. A failed parse returns HTTP `400` and framework error `1003`.

## Files

Keja walks the public folder and the service folder, including nested directories. A file is a route module when it ends in `.ts`, is not `*.test.ts`, and is not `_middleware.ts`. Nested `_middleware.ts` files are not loaded. The only server middleware file is `_middleware.ts` directly inside the public or service directory. See [Middleware](/middleware).

A module can export several routes. The default export is first. Other named `defineRoute` exports follow. Exports that are not routes, such as a shared Zod schema, are ignored. A file that exports zero routes fails startup with project error `2006`.

Two routes with the same method, path, and version fail startup with project error `2002`. A route version missing from `keja.versioning.ts` fails with project error `2001`.

## Service server

Every service route uses `method: "post"`. Any other method fails startup with project error `2020`. A request to the service server that is not POST returns HTTP `405` and framework error `1006`. Health, identity, OpenAPI, and docs stay GET. See [Servers](/servers).

The public server uses the method declared on each route.

## Request path

The first segment is the version token. The rest is the route path.

```txt
GET /v1/users/ada
POST /current/jobs
```

`/v1/users/ada` looks up version `v1` and path `/users/:id`. Version tokens are described in [Versioning](/versioning).
