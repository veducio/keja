---

title: How to add a route
description: Add a public or service route and see it in Scalar.
---

Add one HTTP route to a Keja project and confirm it in Scalar.

## Prerequisites

- A project from [Install](/install) that runs with `bun run dev`
- A version id in `keja.versioning.ts` (usually `v1`)

## Steps

### 1. Choose the server folder

- Public API → `src/public` (or your `public_path`)
- Service API → `src/service` (or your `service_path`)

Service routes must use `method: "post"`.

### 2. Create a route file

Create `src/public/items.ts` (name is yours):

```ts
import { defineRoute, response } from "@veducio/keja";
import { z } from "zod";

export default defineRoute({
  method: "get",
  path: "/items",
  name: "List items",
  version: "v1",
  responses: {
    Items: response({
      code: 200,
      json: z.object({ items: z.array(z.string()) }),
    }),
  },
  handler: ({ respond }) => respond.Items({ items: [] }),
});
```

`path` is the URL after the version segment. `name` is optional; Scalar uses it as the operation summary.

### 3. Confirm reload and response

With `keja dev` running, save the file. You should see `reloading...` then `no issues found`.

```shell
curl http://127.0.0.1:3000/v1/items
```

Open `http://127.0.0.1:3000/docs`. The route appears under the `v1` tag.

### 4. Service route variant

For the service port:

```ts
export default defineRoute({
  method: "post",
  path: "/jobs",
  version: "v1",
  responses: {
    Ok: response({ code: 200, json: z.object({ ok: z.literal(true) }) }),
  },
  handler: ({ respond }) => respond.Ok({ ok: true }),
});
```

```shell
curl -X POST http://127.0.0.1:3001/v1/jobs
```

## Done

You have a loaded route on the right server. Field rules: [Routes](/routes). Response helpers: [Responses](/responses). Why two ports: [Two servers](/two-servers).
