---
title: Keja
description: A Bun server for container microservices.
---

Keja is a Bun HTTP framework for small services that run in containers. You declare versions, routes, and optional Postgres tables. Keja loads the project directory and listens on two ports: one for public callers, one for other services.

Install the package, create a project, and follow the first-service lesson. After that, use a how-to when you have a concrete task, reference when you need exact fields, and explanation when you want the model behind a choice.

## Start here

1. [Install](/install) — put Keja on the machine and create a project.
2. [Build first service](/build-first-service) — serve `GET /v1/hello`, then store one table.

## How documentation is organized

| Kind | Use it when you want to… |
| ---- | ------------------------ |
| [How-to guides](/how-to-add-a-route) | Solve one problem (add a route, turn on Postgres, issue a grant) |
| [Reference](/project) | Look up config, CLI, APIs, and error codes |
| [Explanation](/why-keja) | Understand why Keja is shaped the way it is |

## What you get

- Two listeners: public methods as declared, service routes as POST only
- Path-based API versions with fallback to older handlers
- Optional batch calls on `POST /{version}/batch`
- Optional Postgres with one shared row shape (OwnedObjects)
- Optional Argus, Vault, Grants, and Cloudflare Access

Keja is a deliberate small surface. If you need a general-purpose web framework for a monolith or a long-lived VPS app, use Hono or NestJS directly. For the idea behind that choice, see [Why Keja](/why-keja).
