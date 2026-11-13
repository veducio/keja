---
title: How to version an API
description: Publish v2 while keeping v1 callers on older handlers.
---

Add a new API version and override one route without breaking callers pinned to the old version.

## Prerequisites

- A running project with at least `v1` in `keja.versioning.ts`
- An existing route such as `GET /hello` on `v1`

## Steps

### 1. Register the new version

Edit `keja.versioning.ts`:

```ts
import { defineVersions } from "@veducio/keja";

export default defineVersions({
  v1: { releasedAt: "2026-01-01" },
  v2: { releasedAt: "2026-06-01" },
});
```

`releasedAt` may be `YYYY-MM-DD`, `DD-MM-YYYY`, or a unix timestamp.

### 2. Add a v2-only route (or override)

Create a new export or file for the changed behavior:

```ts
export default defineRoute({
  method: "get",
  path: "/hello",
  version: "v2",
  responses: {
    Hello: response({
      code: 200,
      json: z.object({ message: z.string(), api: z.literal("v2") }),
    }),
  },
  handler: ({ respond }) =>
    respond.Hello({ message: "hello", api: "v2" }),
});
```

Leave the `v1` route in place.

### 3. Check both callers

```shell
curl http://127.0.0.1:3000/v1/hello
curl http://127.0.0.1:3000/v2/hello
```

`v1` keeps the old body. `v2` returns the new body.

### 4. Confirm fallback on an unchanged path

If `v2` has no route for some other method and path that `v1` still defines, `GET /v2/...` runs the `v1` handler. Only redefine routes you intend to change.

## Done

You published a new version with selective overrides. Selection rules: [Versioning](/versioning). Design discussion: [API versioning](/api-versioning).
