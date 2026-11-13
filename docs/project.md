---

title: Project
description: Project layout, defineConfig fields, and environment variables.
---

A Keja project is the directory you run `keja dev`, `keja start`, `keja migrate`, `keja generate`, or `keja seed` from. `keja.versioning.ts` is required. `keja.config.ts` is optional; without it Keja uses defaults.

## Layout

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

Paths for versioning, public routes, and service routes are configurable. Migrations and seed folders apply when the database is enabled.

## `defineVersions`

Default-export from `keja.versioning.ts` (or the path in `versioning`).

| Field        | Required | Description                                                    |
| ------------ | -------- | -------------------------------------------------------------- |
| key          | yes      | Version id: `v` plus a whole number (`v1`, not `v01`)          |
| `releasedAt` | yes      | `YYYY-MM-DD`, `DD-MM-YYYY`, unix seconds, or unix milliseconds |

## `defineConfig`

Default-export from `keja.config.ts`. Omitted nested blocks are off, except `batch`, which defaults to on. Paths resolve from the project root. Empty paths fail startup.

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
    url: "https://argus.example",
    env: "staging",
  },
  vault: { enabled: true },
  grants: {
    enabled: true,
    mode: "transit",
    transit_key: "keja-grants",
  },
  batch: true,
});
```

### Top level

| Field          | Default                           | Description                     |
| -------------- | --------------------------------- | ------------------------------- |
| `name`         | package name, then directory name | Identity and Argus catalog name |
| `versioning`   | `keja.versioning.ts`              | Version catalog path            |
| `public_path`  | `src/public`                      | Public route folder             |
| `service_path` | `src/service`                     | Service route folder            |
| `db`           | `{ enabled: false }`              | Postgres                        |
| `argus`        | `{ enabled: false }`              | Service registry                |
| `vault`        | `{ enabled: false }`              | Vault KV client                 |
| `grants`       | `{ enabled: false }`              | Grant JWTs                      |
| `batch`        | `{ enabled: true }`               | `POST /{version}/batch`         |

If `name` is omitted, Keja reads `package.json` and drops a scope (`@org/billing` → `billing`). With no package name, the directory name is used.

### `db`

| Field        | Default      | Description                                  |
| ------------ | ------------ | -------------------------------------------- |
| `enabled`    | —            | Required boolean                             |
| `migrations` | `migrations` | Folder of `0001_name.sql` files when enabled |

### `argus`

| Field      | Default          | Description                                        |
| ---------- | ---------------- | -------------------------------------------------- |
| `enabled`  | —                | Required boolean                                   |
| `url`      | —                | Required when enabled. Absolute `http`/`https` URL |
| `env`      | —                | Required when enabled                              |
| `username` | omit             | Basic auth; set with `password` or omit both       |
| `password` | omit             | Basic auth; set with `username` or omit both       |
| `public`   | service `name`   | Catalog key for the public port                    |
| `service`  | `<name>-service` | Catalog key for the service port                   |

### `vault`

Config values win over environment variables.

| Field       | Default / env                   | Description                  |
| ----------- | ------------------------------- | ---------------------------- |
| `enabled`   | —                               | Required boolean             |
| `address`   | `VAULT_ADDR`                    | Absolute Vault URL           |
| `token`     | `VAULT_TOKEN`                   | `X-Vault-Token`              |
| `namespace` | `VAULT_NAMESPACE`, or omit      | `X-Vault-Namespace` when set |
| `mount`     | `VAULT_KV_MOUNT`, else `secret` | KV v2 mount                  |

Address and token are required when enabled.

### `grants`

| Field           | Default / env  | Description                              |
| --------------- | -------------- | ---------------------------------------- |
| `enabled`       | —              | Required boolean                         |
| `mode`          | `transit`      | `transit` or `secret`                    |
| `max_exp`       | `900`          | Max `grant({ exp })` lifetime in seconds |
| `transit_key`   | —              | Required for `transit`                   |
| `transit_mount` | `transit`      | Vault Transit mount                      |
| `secret`        | `GRANT_SECRET` | HS256 secret for `secret` mode           |
| `secret_vault`  | omit           | KV path alternative to `secret` / env    |
| `secret_field`  | `secret`       | Field inside the KV secret               |

`mode: "transit"` and `secret_vault` require Vault enabled. For `secret` mode, one of `secret`, `GRANT_SECRET`, or `secret_vault` is required.

### `batch`

| Form                         | Description     |
| ---------------------------- | --------------- |
| omit / `true`                | Batch enabled   |
| `false`                      | Batch disabled  |
| `{ enabled: true \| false }` | Same as boolean |

## Environment

| Variable                 | Required                                                    | Description                      |
| ------------------------ | ----------------------------------------------------------- | -------------------------------- |
| `HOST`                   | yes                                                         | Bind address                     |
| `HTTP_PORT`              | yes                                                         | Public port `1`–`65535`          |
| `HTTP_SERVICE_PORT`      | yes                                                         | Service port `1`–`65535`         |
| `OPENAPI_SERVER`         | no                                                          | Public OpenAPI `servers[0].url`  |
| `OPENAPI_SERVICE_SERVER` | no                                                          | Service OpenAPI `servers[0].url` |
| `DATABASE_URL`           | when `db.enabled`                                           | `postgres://` or `postgresql://` |
| `VAULT_ADDR`             | when Vault enabled and `address` omitted                    | Vault base URL                   |
| `VAULT_TOKEN`            | when Vault enabled and `token` omitted                      | Vault token                      |
| `VAULT_NAMESPACE`        | no                                                          | Vault namespace                  |
| `VAULT_KV_MOUNT`         | no                                                          | KV mount (default `secret`)      |
| `GRANT_SECRET`           | when grants `secret` mode without `secret` / `secret_vault` | HS256 secret                     |
| `CF_ACCESS_TEAM_DOMAIN`  | when `cloudflareAccess()` omits `team`                      | Access team host or origin       |
| `CF_ACCESS_AUD`          | when `cloudflareAccess()` omits `audience`                  | Access audience                  |

OpenAPI URLs must be absolute `http` or `https`.

## Startup checks

When `db`, `argus`, `vault`, or `grants` is enabled, Keja validates that dependency before listen. Transit grants and `secret_vault` require Vault. Failures throw `ProjectError`. `keja dev` prints and waits; `keja start` exits `1`.
