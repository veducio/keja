---

title: How to protect with Access
description: Require a Cloudflare Access JWT on one route.
---

Protect a single route so only callers with a valid Cloudflare Access token reach the handler.

## Prerequisites

- A Cloudflare Access application and audience tag
- The team domain for your Access team

## Steps

### 1. Provide team and audience

Either env:

```txt
CF_ACCESS_TEAM_DOMAIN=example.cloudflareaccess.com
CF_ACCESS_AUD=your-audience-tag
```

Or options on the middleware (see next step).

### 2. Attach route middleware

Do not put Access on server `_middleware.ts`. That file cannot pass fields to the handler.

```ts
import { cloudflareAccess, defineRoute, response } from "@veducio/keja";
import { z } from "zod";

export default defineRoute({
  method: "get",
  path: "/me",
  version: "v1",
  middleware: [
    cloudflareAccess({
      team: "example.cloudflareaccess.com",
      audience: "your-audience-tag",
    }),
  ],
  responses: {
    Me: response({
      code: 200,
      json: z.object({ email: z.string() }),
    }),
  },
  handler: ({ access, respond }) => respond.Me({ email: access.email ?? "" }),
});
```

If you omit `team` / `audience`, Keja reads `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD`. Missing values throw project error `2019` when the middleware is created.

### 3. Call the route through Access

The token is read from `Cf-Access-Jwt-Assertion`, or from the `CF_Authorization` cookie when the header is empty. A missing or rejected token returns HTTP `401` (framework error `1005`).

## Done

The handler receives `access` only after a valid Access JWT. Identity fields and helpers: [Cloudflare Access](/access).
