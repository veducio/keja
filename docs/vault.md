---

title: Vault
description: Read a KV v2 secret from HashiCorp Vault.
---

Vault holds secrets outside the project files. When it is on, `vaultSecret` reads one KV version 2 secret through the token configured for this process. Leave Vault off until a route needs a secret.

Vault is off until `vault.enabled` is `true`. On startup Keja calls `GET /v1/auth/token/lookup-self`. A failed lookup is project error `2024` and neither server listens. `vaultSecret` then reads one KV version 2 secret through that client. Keja calls `GET /v1/{mount}/data/{path}` and returns the secret data object.

```ts
export default defineConfig({
  vault: {
    enabled: true,
    address: "https://vault.example",
    token: "s.token",
    namespace: "apps",
    mount: "kv",
  },
});
```

```ts
import { vaultSecret } from "@veducio/keja";

const secret = await vaultSecret("apps/keja");
```

`secret.password` is the value stored in Vault. The default mount is `secret`, so the URL is `/v1/secret/data/apps/keja`. Config values win. A missing address, token, namespace, or mount is filled from the environment.

| Variable          | Role                                    |
| ----------------- | --------------------------------------- |
| `VAULT_ADDR`      | Absolute `http` or `https` URL of Vault |
| `VAULT_TOKEN`     | `X-Vault-Token`                         |
| `VAULT_NAMESPACE` | `X-Vault-Namespace`, sent when set      |
| `VAULT_KV_MOUNT`  | Mount name. Default `secret`            |

`createVault({ address, token, namespace, mount })` builds a separate client. `client.secret(path)` reads the same way. `vaultSecret(path)` without options uses the config client. Calling it while Vault is disabled throws `DependencyNotMet`: `vaultSecret requires vault`.

A missing address or token, a bad path, a missing secret, or a rejected token throws `VaultError`. The token is not included in the error. A `404` reports that the secret was not found. Any other failed status includes the Vault `errors` list when the body has one.
