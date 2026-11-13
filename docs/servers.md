---

title: Servers
description: Reserved routes and the identity of each Keja process.
---

One process listens on two ports. The public port serves the methods each route declares. The service port is for other services, and every route there is POST. Both ports also expose health, identity, an OpenAPI document, and `/docs`.

Both servers expose the same reserved GET routes. They are registered before the versioned routes, so route middleware does not run for them.

| Path             | Body                                        |
| ---------------- | ------------------------------------------- |
| `/_health`       | `{ "status": "ok" }`                        |
| `/_identity`     | `{ "name", "public", "service" }`           |
| `/_openapi.json` | OpenAPI 3 document for that server's routes |
| `/docs`          | Scalar reference for `/_openapi.json`       |

`/_identity` is present after listen. `name` comes from `defineConfig({ name })`, otherwise the unscoped `package.json` name, otherwise the project directory name. `public` and `service` are `http://host:port` URLs. IPv6 hosts are wrapped in brackets.

When `HOST` is a specific address, that address is the only host. When `HOST` is `0.0.0.0` or `::`, Keja lists non-internal addresses and skips link-local addresses (`169.254.0.0/16` and `fe80::/10`). IPv4 addresses are used when any exist. With none, the list falls back to `127.0.0.1`.

The OpenAPI document lists each route under `/{version}{path}`, tagged by that version so Scalar groups them. An optional route `name` becomes the operation summary. When batch is enabled it also lists one `POST /{version}/batch` path under the Batch tag. On the service document the batch method enum is only `post`. Batch defaults to on; turn it off in [Project](/project#batch). `OPENAPI_SERVER` and `OPENAPI_SERVICE_SERVER` set `servers[0].url` for the public and service documents.
