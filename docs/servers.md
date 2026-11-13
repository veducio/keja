---

title: Servers
description: Reserved routes, identity, and OpenAPI / Scalar.
---

One process listens on `HTTP_PORT` (public) and `HTTP_SERVICE_PORT` (service). Both expose the reserved GET routes below before versioned project routes. Route middleware does not run on reserved routes.

## Reserved paths

| Path             | Body                                        |
| ---------------- | ------------------------------------------- |
| `/_health`       | `{ "status": "ok" }`                        |
| `/_identity`     | `{ "name", "public", "service" }`           |
| `/_openapi.json` | OpenAPI 3 document for that server’s routes |
| `/docs`          | Scalar UI for `/_openapi.json`              |

## Identity

`name` comes from `defineConfig({ name })`, else unscoped `package.json` name, else directory name. `public` and `service` are `http://host:port` URLs. IPv6 hosts are wrapped in brackets.

## Bind addresses

| `HOST`            | Advertised hosts                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| Specific address  | That address only                                                                                         |
| `0.0.0.0` or `::` | Non-internal addresses; skips link-local `169.254.0.0/16` and `fe80::/10`; prefers IPv4; else `127.0.0.1` |

## OpenAPI

| Behavior  | Detail                                                                      |
| --------- | --------------------------------------------------------------------------- |
| Path form | `/{version}{path}`                                                          |
| Tags      | Route `version`; batch under `Batch`                                        |
| Summary   | Optional route `name`                                                       |
| Batch     | One `POST /{version}/batch` when batch enabled; service enum is `post` only |
| Servers   | `OPENAPI_SERVER` / `OPENAPI_SERVICE_SERVER` → `servers[0].url`              |
