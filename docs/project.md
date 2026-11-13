---

title: Project
description: Layout, config, and environment for a Keja project.
---

A Keja project is one directory. It holds the version catalog, the public routes, the service routes, and, when you store data, the migrations and repositories. `keja dev` loads the directory you run it in.

A Keja project is the current directory of `keja dev`, `keja start`, `keja migrate`, `keja generate`, or `keja seed`. `keja.versioning.ts` is required. `keja.config.ts` is optional.

```txt
keja.versioning.ts
keja.config.ts
keja.repositories.ts
src/public/
src/service/
src/db/repositories.ts
migrations/
seed/
.env
```

## Versions

`keja.versioning.ts` default-exports `defineVersions`. Each key is `v` plus a whole number. `releasedAt` is `YYYY-MM-DD`, `DD-MM-YYYY`, or a unix timestamp.

```ts
import { defineVersions } from "@veducio/keja";

export default defineVersions({
  v1: { releasedAt: "2026-01-01" },
  v2: { releasedAt: "2026-06-01" },
});
```

## Config

`keja.config.ts` default-exports `defineConfig`. Omitted paths use the defaults below. A path is resolved from the project root. An empty path fails startup. Nested blocks that are omitted are off, except `batch`, which defaults to on.

```ts
import { defineConfig } from "@veducio/keja";

export default defineConfig({
  name: "billing",
  versioning: "keja.versioning.ts",
  public_path: "src/public",
  service_path: "src/service",
  db: { enabled: true, migrations: "migrations" },
  argus: {
    enabled: true,
    url: "https://argus.veducio.com",
    env: "staging",
    username: "argus",
    password: "secret",
    public: "billing",
    service: "billing-service",
  },
  vault: {
    enabled: true,
    address: "https://vault.example",
    token: "s.token",
    namespace: "apps",
    mount: "secret",
  },
  grants: {
    enabled: true,
    mode: "transit",
    max_exp: 900,
    transit_key: "keja-grants",
    transit_mount: "transit",
  },
  batch: true,
});
```

### Top level

| Field          | Default                               | Role                                                    |
| -------------- | ------------------------------------- | ------------------------------------------------------- |
| `name`         | package name, then the directory name | Identity and Argus catalog name                         |
| `versioning`   | `keja.versioning.ts`                  | Version catalog path                                    |
| `public_path`  | `src/public`                          | Public route folder                                     |
| `service_path` | `src/service`                         | Service route folder                                    |
| `db`           | `{ enabled: false }`                  | Postgres. See [Database](#db)                           |
| `argus`        | `{ enabled: false }`                  | Service registry. See [Argus](#argus)                   |
| `vault`        | `{ enabled: false }`                  | KV v2 client. See [Vault](#vault)                       |
| `grants`       | `{ enabled: false }`                  | Grant JWTs. See [Grants](#grants)                       |
| `batch`        | `{ enabled: true }`                   | `POST /{version}/batch`. See [Batch](#batch)            |

`name` in config is used as written. Otherwise Keja reads `package.json` and drops a scope, so `@veducio/billing` becomes `billing`. With no package name, the directory name is used.

### `db`

| Field         | Default        | Role                                                                 |
| ------------- | -------------- | -------------------------------------------------------------------- |
| `enabled`     | —              | Required. `false` leaves Postgres off                                |
| `migrations`  | `migrations`   | Folder of `0001_name.sql` files when `enabled` is `true`             |

See [Database](/database).

### `argus`

| Field      | Default | Role                                                                 |
| ---------- | ------- | -------------------------------------------------------------------- |
| `enabled`  | —       | Required. `false` leaves Argus off                                   |
| `url`      | —       | Required when enabled. Absolute `http` or `https` Argus base URL     |
| `env`      | —       | Required when enabled. Argus environment name                        |
| `username` | omit    | Basic auth username. Set with `password`, or omit both               |
| `password` | omit    | Basic auth password. Set with `username`, or omit both               |
| `public`   | `name`  | Catalog key for the public port                                      |
| `service`  | `<name>-service` | Catalog key for the service port                              |

See [Argus](/argus).

### `vault`

Config values win. A missing field is filled from the environment when that variable is set.

| Field       | Default / env                         | Role                                      |
| ----------- | ------------------------------------- | ----------------------------------------- |
| `enabled`   | —                                     | Required. `false` leaves Vault off        |
| `address`   | `VAULT_ADDR`                          | Absolute `http` or `https` Vault URL      |
| `token`     | `VAULT_TOKEN`                         | `X-Vault-Token`                           |
| `namespace` | `VAULT_NAMESPACE`, or omit            | `X-Vault-Namespace` when set              |
| `mount`     | `VAULT_KV_MOUNT`, else `secret`       | KV v2 mount name                          |

Address and token are required when Vault is enabled. See [Vault](/vault).

### `grants`

| Field           | Default / env              | Role                                                                 |
| --------------- | -------------------------- | -------------------------------------------------------------------- |
| `enabled`       | —                          | Required. `false` leaves grants off                                  |
| `mode`          | `transit`                  | `transit` or `secret`                                                |
| `max_exp`       | `900`                      | Max `exp` in seconds for `grant()`                                   |
| `transit_key`   | —                          | Required for `transit`. Vault Transit key name                       |
| `transit_mount` | `transit`                  | Vault Transit mount                                                  |
| `secret`        | `GRANT_SECRET`             | HS256 secret for `secret` mode. Config wins over the env var         |
| `secret_vault`  | omit                       | KV path for the HS256 secret when not set in config or `GRANT_SECRET` |
| `secret_field`  | `secret`                   | Field name inside that KV secret                                     |

`mode: "transit"` requires [Vault](/vault) enabled. `secret_vault` also requires Vault. One of `secret`, `GRANT_SECRET`, or `secret_vault` is required for `mode: "secret"`. See [Grants](/grants).

### `batch`

| Form                       | Role                                      |
| -------------------------- | ----------------------------------------- |
| `true` / omit              | `POST /{version}/batch` is registered     |
| `false`                    | Batch is off                              |
| `{ enabled: true \| false }` | Same as the boolean                     |

See [Routes](/routes#batch).

## Environment

| Variable                 | Required                                                                     | Role                                             |
| ------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| `HOST`                   | yes                                                                          | Bind address                                     |
| `HTTP_PORT`              | yes                                                                          | Public server port, `1`–`65535`                  |
| `HTTP_SERVICE_PORT`      | yes                                                                          | Service server port, `1`–`65535`                 |
| `OPENAPI_SERVER`         | no                                                                           | `servers[0].url` in the public OpenAPI document  |
| `OPENAPI_SERVICE_SERVER` | no                                                                           | `servers[0].url` in the service OpenAPI document |
| `DATABASE_URL`           | when `db.enabled` is true                                                    | `postgres://` or `postgresql://`                 |
| `VAULT_ADDR`             | when `vault.enabled` and `vault.address` is omitted                          | Vault base URL                                   |
| `VAULT_TOKEN`            | when `vault.enabled` and `vault.token` is omitted                            | Vault token                                      |
| `VAULT_NAMESPACE`        | no                                                                           | Vault namespace when set                         |
| `VAULT_KV_MOUNT`         | no                                                                           | KV mount. Default `secret`                       |
| `GRANT_SECRET`           | when grants use `mode: "secret"` without `grants.secret` or `secret_vault`   | HS256 signing secret                             |
| `CF_ACCESS_TEAM_DOMAIN`  | when `cloudflareAccess()` omits `team`                                       | Access team hostname or origin                   |
| `CF_ACCESS_AUD`          | when `cloudflareAccess()` omits `audience`                                   | Access audience tag                              |

An OpenAPI URL must be an absolute `http` or `https` URL.

## Startup

After a successful listen, Keja prints the loaded paths, the identity, the database, and the bind addresses. The config line is the absolute path of `keja.config.ts`, or `defaults` when that file is absent. Database is `disabled`, or `postgres` when the pool is open. Migrations are applied by `keja migrate`. Argus and Vault are printed when they are enabled.

When `db`, `argus`, `vault`, or `grants` is enabled, Keja checks that service before either server listens. Transit grants and `secret_vault` need Vault on. A failed check throws `ProjectError`. `keja dev` prints it and waits. `keja start` prints it and exits `1`.
