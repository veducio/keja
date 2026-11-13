---

title: Grants
description: Short-lived JWTs for one subject and one action.
---

A grant is a JWT for one subject and one action. Configure it with top-level `grants` in `keja.config.ts`. Grants are off until `grants.enabled` is `true`.

`exp` is a whole number of seconds from now. It is required, and it cannot be longer than `max_exp`. The default maximum is 900 seconds. `context` is a plain object the issuing service fills. The receiving service reads it after `verifyGrant` accepts the token.

## Modes

`mode: "transit"` signs with Vault Transit. [Vault](/vault) must be enabled. `transit_key` is required. `transit_mount` defaults to `transit`. The private key stays in Vault. Keja reads the key type and sets `alg` from it. RSA signs as `RS256`, P-256 as `ES256`, P-384 as `ES384`, P-521 as `ES512`, and Ed25519 as `EdDSA`.

`mode: "secret"` signs with HS256. The secret comes from `grants.secret`, the `GRANT_SECRET` environment variable, or `grants.secret_vault` (a KV path). `secret_field` defaults to `secret`. A Vault path requires Vault to be enabled. A value in config or `GRANT_SECRET` does not.

```ts
export default defineConfig({
  vault: {
    enabled: true,
    address: "https://vault.example",
    token: "s.token",
  },
  grants: {
    enabled: true,
    mode: "transit",
    transit_key: "keja-grants",
  },
});
```

```ts
export default defineConfig({
  grants: {
    enabled: true,
    mode: "secret",
    secret: "from-config",
  },
});
```

```ts
export default defineConfig({
  vault: { enabled: true, address: "https://vault.example", token: "s.token" },
  grants: {
    enabled: true,
    mode: "secret",
    secret_vault: "apps/keja",
    secret_field: "secret",
  },
});
```

## Issue and verify

```ts
import { grant, verifyGrant } from "@veducio/keja";

const token = await grant({
  subject: "tenant_01h455vb4pex5vsknk084sn02q",
  action: "posts.read",
  exp: 60,
  context: { postId: "posts_01h455vb4pex5vsknk084sn02q" },
});

const allowed = await verifyGrant(token, { action: "posts.read" });
```

`allowed` is `{ subject, action, context }`. A call while grants are disabled throws `DependencyNotMet`: `grant requires grants`. Transit mode without Vault throws `grant transit requires vault`. A `secret_vault` without Vault throws `grant secret_vault requires vault`.

Verification rejects a token whose `exp` is not strictly in the future. A different action, a missing subject, or a context that is not a plain object is rejected.
