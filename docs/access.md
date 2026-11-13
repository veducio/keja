---

title: Cloudflare Access
description: cloudflareAccess middleware and verifyAccessJwt.
---

Not a `defineConfig` block. Attach as route middleware. Cannot use server `_middleware.ts` (cannot pass fields).

## Options and env

| Option / env | Description                                                       |
| ------------ | ----------------------------------------------------------------- |
| `team`       | Hostname or `https` origin; else `CF_ACCESS_TEAM_DOMAIN`          |
| `audience`   | String, comma-separated string, or string[]; else `CF_ACCESS_AUD` |

Missing team/audience at middleware creation → project error `2019`.

## `cloudflareAccess`

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

| Detail       | Value                                               |
| ------------ | --------------------------------------------------- |
| Token header | `Cf-Access-Jwt-Assertion`                           |
| Fallback     | `CF_Authorization` cookie                           |
| JWKS         | `{issuer}/cdn-cgi/access/certs` (cached per issuer) |
| Failure      | HTTP `401`, framework `1005`                        |

## Identity

Always: `sub`, `iss`, `aud`, `exp`, `iat`. Optional when present: `email`, `country`, `type`.

## `verifyAccessJwt`

`verifyAccessJwt(token, { team, audience })` returns the same identity. Pass `getKey` in tests to supply a verification key.
