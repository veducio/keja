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

`keja.config.ts` default-exports `defineConfig`. Omitted paths use the defaults below. A path is resolved from the project root. An empty path fails startup.

```ts
import { defineConfig } from "@veducio/keja";

export default defineConfig({
  name: "billing",
  versioning: "keja.versioning.ts",
  public_path: "src/public",
  service_path: "src/service",
  db: { enabled: true },
  argus: {
    enabled: true,
    url: "https://argus.veducio.com",
    env: "staging",
  },
  vault: {
    enabled: true,
    address: "https://vault.example",
    token: "s.token",
  },
});
```

| Field          | Default                               | Role                                                                   |
| -------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| `name`         | package name, then the directory name | Identity and Argus catalog name                                        |
| `versioning`   | `keja.versioning.ts`                  | Version catalog                                                        |
| `public_path`  | `src/public`                          | Public route folder                                                    |
| `service_path` | `src/service`                         | Service route folder                                                   |
| `db`           | `{ enabled: false }`                  | Postgres. `enabled: true` uses `migrations` unless `migrations` is set |
| `argus`        | `{ enabled: false }`                  | Service registry. `url` and `env` are required when enabled            |
| `vault`        | `{ enabled: false }`                  | KV v2 client. Address and token are required when enabled              |

`argus.username` and `argus.password` are both set or both omitted. `argus.public` and `argus.service` override the catalog names. See [Argus](/argus) and [Vault](/vault).

`name` in config is used as written. Otherwise Keja reads `package.json` and drops a scope, so `@veducio/billing` becomes `billing`. With no package name, the directory name is used.

## Environment

| Variable                 | Required                  | Role                                             |
| ------------------------ | ------------------------- | ------------------------------------------------ |
| `HOST`                   | yes                       | Bind address                                     |
| `HTTP_PORT`              | yes                       | Public server port, `1`–`65535`                  |
| `HTTP_SERVICE_PORT`      | yes                       | Service server port, `1`–`65535`                 |
| `OPENAPI_SERVER`         | no                        | `servers[0].url` in the public OpenAPI document  |
| `OPENAPI_SERVICE_SERVER` | no                        | `servers[0].url` in the service OpenAPI document |
| `DATABASE_URL`           | when `db.enabled` is true | `postgres://` or `postgresql://`                 |

An OpenAPI URL must be an absolute `http` or `https` URL.

## Startup

After a successful listen, Keja prints the loaded paths, the identity, the database, and the bind addresses. The config line is the absolute path of `keja.config.ts`, or `defaults` when that file is absent. Database is `disabled`, or `postgres` when the pool is open. Migrations are applied by `keja migrate`. Argus and Vault are printed when they are enabled.

When `db`, `argus`, or `vault` is enabled, Keja checks that service before either server listens. A failed check throws `ProjectError`. `keja dev` prints it and waits. `keja start` prints it and exits `1`.
