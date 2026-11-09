---

title: Cloudflare Access
description: Validate a Cloudflare Access JWT on a route.
---

Cloudflare Access checks that the caller passed through the team login before the handler runs. `cloudflareAccess()` is route middleware. The handler receives the token’s identity as `access`. It does not belong in `_middleware.ts`, because that file cannot pass fields to the handler.

`cloudflareAccess()` is route middleware. It reads a JWT, verifies it with the team JWKS from `jose`, and passes the identity to the handler as `access`. Put it on the route `middleware` list. Server `_middleware.ts` cannot pass fields, so Access does not work there. See [Middleware](/middleware).

```ts
import { cloudflareAccess, defineRoute, response } from "@veducio/keja";
import { z } from "zod";

export default defineRoute({
  method: "get",
  path: "/me",
  version: "v1",
  middleware: [cloudflareAccess()],
  responses: {
    Me: response({ code: 200, json: z.object({ email: z.string() }) }),
  },
  handler: ({ access, respond }) => respond.Me({ email: access.email ?? "" }),
});
```

The token is the `Cf-Access-Jwt-Assertion` header. When that header is empty, Keja reads the `CF_Authorization` cookie. A missing or rejected token returns HTTP `401` and framework error `1005`.

## Configuration

`cloudflareAccess()` reads `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` when `team` and `audience` are omitted. A missing value throws project error `2019` when the middleware is created. The message names only the missing variables.

```ts
cloudflareAccess({
  team: "example.cloudflareaccess.com",
  audience: "audience-tag",
});
```

`team` is a hostname, which becomes `https://<host>`, or an `https` origin. The issuer sent to `jose` is that origin. `audience` is a string, a comma-separated string, or an array of strings. JWKS is fetched from `{issuer}/cdn-cgi/access/certs` and cached per issuer.

`access` contains `sub`, `iss`, `aud`, `exp`, and `iat`. `email`, `country`, and `type` are included when the token has them.

`verifyAccessJwt(token, { team, audience })` runs the same check and returns that identity. Pass `getKey` to supply a verification key in tests.
