---
title: Vault
description: Vault KV v2 client reference.
---

Off until `vault.enabled` is `true`. Config: [Project](/project#vault).

## Config and env

| Field | Default / env | Description |
| ----- | ------------- | ----------- |
| `enabled` | — | Required |
| `address` | `VAULT_ADDR` | Absolute URL |
| `token` | `VAULT_TOKEN` | Token |
| `namespace` | `VAULT_NAMESPACE` | Optional |
| `mount` | `VAULT_KV_MOUNT` or `secret` | KV v2 mount |

Startup: `GET /v1/auth/token/lookup-self`. Failure → `2024`.

## `vaultSecret`

```ts
import { vaultSecret } from "@veducio/keja";

const secret = await vaultSecret("apps/keja");
```

Reads `GET /v1/{mount}/data/{path}` and returns the secret data object. Disabled → `DependencyNotMet`: `vaultSecret requires vault`.

## `createVault`

```ts
import { createVault } from "@veducio/keja";

const client = createVault({
  address: "https://vault.example",
  token: "s.token",
  namespace: null,
  mount: "secret",
});
await client.secret("apps/keja");
```

## Errors

`VaultError` on missing address/token, bad path, missing secret, or rejected token. Token is not included in the error. `404` → secret not found. Other failures may include Vault `errors` from the body.
