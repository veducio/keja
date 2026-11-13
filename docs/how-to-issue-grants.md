---
title: How to issue grants
description: Enable grant JWTs with Transit or a shared secret, then verify them.
---

Issue a short-lived JWT for one subject and one action, then verify it in another handler or service.

## Prerequisites

- For `mode: "transit"`: Vault enabled with a Transit key
- For `mode: "secret"`: a secret in config, `GRANT_SECRET`, or a Vault KV path

## Steps

### 1. Choose a mode and enable grants

Transit (key stays in Vault):

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
    transit_mount: "transit",
    max_exp: 900,
  },
});
```

Shared secret:

```ts
export default defineConfig({
  grants: {
    enabled: true,
    mode: "secret",
    secret: "replace-me",
    max_exp: 900,
  },
});
```

Or set `GRANT_SECRET` and omit `secret`. Or set `secret_vault` (and usually `secret_field`) with Vault enabled.

Restart after enabling grants.

### 2. Issue a token

```ts
import { grant } from "@veducio/keja";

const token = await grant({
  subject: "tenant_01h455vb4pex5vsknk084sn02q",
  action: "posts.read",
  exp: 60,
  context: { postId: "posts_01h455vb4pex5vsknk084sn02q" },
});
```

`exp` is seconds from now and cannot exceed `max_exp`.

### 3. Verify a token

```ts
import { verifyGrant } from "@veducio/keja";

const allowed = await verifyGrant(token, { action: "posts.read" });
```

`allowed` is `{ subject, action, context }`. Wrong action, expired `exp`, or a non-object context is rejected.

## Done

You can issue and verify grants without grant middleware. Config and algorithms: [Grants](/grants).
