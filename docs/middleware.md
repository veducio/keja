---

title: Middleware
description: Server middleware and route middleware.
---

Middleware runs after Keja has chosen the route and before the handler. It can change the response on the way out. It can also stop the chain by returning a `Response` before `next()`. Route middleware may pass extra fields into the handler. Server middleware may not.

`defineMiddleware` wraps a function that receives the request, the resolved version id, the path params, and `next`. It returns a `Response`. Calling `next()` continues the chain. Returning a `Response` before `next()` stops the chain. `next()` runs once.

```ts
import { defineMiddleware } from "@veducio/keja";

export default defineMiddleware(async ({ next }) => {
  const response = await next();
  response.headers.set("x-keja", "public");
  return response;
});
```

## Order

After a route is selected, Keja runs server middleware, then that route's `middleware` list, then Zod parsing, then the handler. The JSON body is read when the handler's request is parsed, which is after `next()`.

Reserved `next` keys are `params`, `query`, `body`, and `respond`. Passing one throws.

## Server middleware

`_middleware.ts` directly in the public directory applies to public routes. The same file in the service directory applies to service routes. Nested `_middleware.ts` files are ignored. The file default-exports `defineMiddleware(...)` or an array of those values. A bad file is project error `2007`.

Server middleware calls `next()` with no argument. Passing fields throws `Server middleware cannot pass values to next()`.

## Route middleware

A route lists middleware on `middleware`. Those functions may pass fields, and the handler receives them as its own properties.

```ts
const audit = defineMiddleware(async ({ next }) => {
  return next({ requestId: crypto.randomUUID() });
});

export default defineRoute({
  method: "post",
  path: "/jobs",
  version: "v1",
  middleware: [audit],
  responses: {
    Ok: response({ code: 200, json: z.object({ requestId: z.string() }) }),
  },
  handler: ({ requestId, respond }) => respond.Ok({ requestId }),
});
```

A list entry that was not created with `defineMiddleware` is project error `2011`.

[Cloudflare Access](/access) is route middleware. It passes `access` through `next`. It cannot run from `_middleware.ts`, because that file cannot pass fields.
