---
title: How to read Vault secrets
description: Enable Vault and read one KV v2 secret in a handler.
---

Connect Keja to HashiCorp Vault and read a KV version 2 secret at runtime.

## Prerequisites

- A Vault server with KV v2 enabled
- A token that can look itself up and read the secret path you need

## Steps

### 1. Enable Vault

Prefer env for address and token in real deployments:

```txt
VAULT_ADDR=https://vault.example
VAULT_TOKEN=s.token
```

```ts
export default defineConfig({
  vault: {
    enabled: true,
    mount: "secret",
  },
});
```

Or set `address` and `token` in config (config wins over env). Optional: `namespace`, `VAULT_NAMESPACE`, `VAULT_KV_MOUNT`.

Restart after enabling Vault. Startup calls token lookup; failure stops listen.

### 2. Read a secret

```ts
import { vaultSecret } from "@veducio/keja";

const secret = await vaultSecret("apps/keja");
const password = secret.password;
```

With mount `secret`, that path maps to `/v1/secret/data/apps/keja`.

### 3. Optional: a separate client

```ts
import { createVault } from "@veducio/keja";

const client = createVault({
  address: "https://vault.example",
  token: "s.token",
  mount: "secret",
});
const secret = await client.secret("apps/keja");
```

## Done

Vault is enabled and secrets are readable in handlers. Field map: [Vault](/vault). For JWT signing that uses Vault, see [How to issue grants](/how-to-issue-grants).
