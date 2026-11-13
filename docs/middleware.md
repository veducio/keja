---
title: Middleware
description: Server middleware and route middleware.
---

Middleware runs after route selection and before the handler. It may mutate the outgoing response. Returning a `Response` before `next()` stops the chain. `next()` runs once.

## `defineMiddleware`

```ts
import { defineMiddleware } from "@veducio/keja";

export default defineMiddleware(async ({ next }) => {
  const response = await next();
  response.headers.set("x-keja", "public");
  return response;
});
```

Arguments include the request, resolved version id, path params, and `next`.

## Order

1. Server middleware (`_middleware.ts`)
2. Route `middleware` list
3. Zod request parse
4. Handler

The JSON body is read during request parse, after `next()`.

Reserved `next` field names: `params`, `query`, `body`, `respond`. Passing one throws.

## Server middleware

| Location | Applies to |
| -------- | ---------- |
| `<public_path>/_middleware.ts` | Public routes |
| `<service_path>/_middleware.ts` | Service routes |

Nested `_middleware.ts` files are ignored. Default-export `defineMiddleware(...)` or an array of them. Invalid file → project error `2007`.

Server middleware must call `next()` with no argument. Passing fields throws `Server middleware cannot pass values to next()`.

## Route middleware

Listed on `defineRoute({ middleware })`. May pass fields; the handler receives them.

```ts
const audit = defineMiddleware(async ({ next }) => {
  return next({ requestId: crypto.randomUUID() });
});
```

An entry not created with `defineMiddleware` → project error `2011`.

[Cloudflare Access](/access) is route middleware (passes `access`). It cannot run from `_middleware.ts`.
