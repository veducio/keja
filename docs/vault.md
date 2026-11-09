---

title: Vault
description: Read a KV v2 secret and sign grants with Vault Transit.
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

## Grants

A grant is a JWT for one subject and one action. Vault Transit signs it, and the private key stays in Vault. `exp` is a whole number of seconds from now. It is required, and it cannot be longer than `grant_max_exp`. The default maximum is 900 seconds. `context` is a plain object the issuing service fills. The receiving service reads it after `verifyGrant` accepts the token.

`transit_key` names the transit key. `transit_mount` defaults to `transit`. A call without `transit_key` throws `VaultError`. A call while Vault is disabled throws `DependencyNotMet`.

```ts
vault: {
  enabled: true,
  address: "https://vault.example",
  token: "s.token",
  transit_key: "keja-grants",
},
```

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

`allowed.subject` is the subject. `allowed.context` is the object that was signed. Keja reads the key type and sets `alg` from it. RSA signs as `RS256`, P-256 as `ES256`, P-384 as `ES384`, P-521 as `ES512`, and Ed25519 as `EdDSA`. Verification asks Vault Transit to check the signature and rejects a token whose `exp` is not strictly in the future. A different action, a missing subject, or a context that is not a plain object is rejected.
