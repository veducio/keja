---
title: Grants
description: Grant JWT config, grant(), and verifyGrant().
---

Off until `grants.enabled` is `true`. Config: [Project](/project#grants).

## Config

| Field | Default / env | Description |
| ----- | ------------- | ----------- |
| `enabled` | — | Required |
| `mode` | `transit` | `transit` or `secret` |
| `max_exp` | `900` | Max lifetime seconds |
| `transit_key` | — | Required for transit |
| `transit_mount` | `transit` | Transit mount |
| `secret` | `GRANT_SECRET` | HS256 secret |
| `secret_vault` | omit | KV path for secret |
| `secret_field` | `secret` | Field in that secret |

Transit and `secret_vault` require Vault. Secret mode needs `secret`, `GRANT_SECRET`, or `secret_vault`.

## Algorithms (`transit`)

| Vault key type | JWT `alg` |
| -------------- | --------- |
| RSA | `RS256` |
| P-256 | `ES256` |
| P-384 | `ES384` |
| P-521 | `ES512` |
| Ed25519 | `EdDSA` |

`secret` mode uses `HS256`.

## `grant`

| Field | Required | Description |
| ----- | -------- | ----------- |
| `subject` | yes | JWT `sub` |
| `action` | yes | Action claim |
| `exp` | yes | Lifetime seconds ≤ `max_exp` |
| `context` | no | Plain object; default `{}` |

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

## `verifyGrant`

Returns `{ subject, action, context }`. Rejects expired tokens, wrong action, missing subject, or non-object context.

| Condition | Error |
| --------- | ----- |
| Grants disabled | `DependencyNotMet`: `grant requires grants` |
| Transit without Vault | `grant transit requires vault` |
| `secret_vault` without Vault | `grant secret_vault requires vault` |
