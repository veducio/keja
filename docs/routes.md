---

title: Routes
description: defineRoute fields, file loading, and batch API.
---

A route is a `defineRoute` export. The folder (`public_path` or `service_path`) chooses the server. Nested folders do not change the URL.

## `defineRoute`

```ts
import { defineRoute, response } from "@veducio/keja";
import { z } from "zod";

export default defineRoute({
  method: "get",
  path: "/users/:id",
  name: "Get user",
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

| Field        | Required | Description                                             |
| ------------ | -------- | ------------------------------------------------------- |
| `method`     | yes      | `get`, `post`, `put`, `patch`, or `delete`              |
| `path`       | yes      | Starts with `/`; may include `:name` parameters         |
| `name`       | no       | Non-empty string; Scalar operation summary              |
| `version`    | yes      | Catalog id such as `v1`                                 |
| `request`    | no       | `params`, `query`, and/or `body` Zod schemas            |
| `middleware` | no       | Route middleware list                                   |
| `responses`  | yes      | Named `response({ code, json, const? })` map            |
| `handler`    | yes      | Receives parsed input, middleware fields, and `respond` |

Invalid method, path, name, or schema throws project error `2030` at definition time. Failed request parse returns HTTP `400` (framework `1003`).

Scalar groups operations by `version` tag.

## Files

Keja walks the public and service folders recursively.

| Included             | Excluded                       |
| -------------------- | ------------------------------ |
| `*.ts` route modules | `*.test.ts`                    |
|                      | `_middleware.ts` (not a route) |

Only `_middleware.ts` directly inside the public or service root is loaded as server middleware. Nested `_middleware.ts` files are ignored.

A module may export several routes. Default export first, then other named `defineRoute` exports. Non-route exports are ignored. Zero routes → project error `2006`. Duplicate method+path+version → `2002`. Version missing from catalog → `2001`.

## Service server

Every service route must use `method: "post"` (`2020` otherwise). Non-POST requests to service project routes return HTTP `405` (`1006`). Reserved GET routes still exist; see [Servers](/servers).

## Request path

```txt
GET /v1/users/ada
POST /current/jobs
```

First segment is the version token; remainder matches `path`. See [Versioning](/versioning).

## Batch

Enabled by default. Disable with `batch: false` or `batch: { enabled: false }`.

`POST /{version}/batch`

Request body:

```json
{
  "requests": [
    {
      "method": "get",
      "path": "/users/:id",
      "params": { "id": "ada" }
    },
    {
      "method": "post",
      "path": "/jobs",
      "body": { "name": "sync" }
    }
  ]
}
```

| Rule       | Detail                                                                     |
| ---------- | -------------------------------------------------------------------------- |
| Max calls  | 25                                                                         |
| Response   | HTTP `207`, `results` in request order                                     |
| Per result | Status + JSON as a standalone call                                         |
| Isolation  | One failure does not stop others                                           |
| Validation | Missing/empty/`requests` too long, or missing `method`/`path` → HTTP `400` |
| Reserved   | Project routes cannot use `POST /batch`                                    |
| Service    | Calls inside batch must be `post`                                          |
| OpenAPI    | One `POST /{version}/batch` under tag `Batch`                              |
