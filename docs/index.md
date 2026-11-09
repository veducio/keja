---

title: Keja
description: A Bun server for Veducio container services.
---

Keja was first built as a side project by Plomyk. It later became part of Veducio Labs. Veducio Labs exists to power open source.

Keja is Polish for “quay”, the place where arrivals and departures meet. An API request has somewhere to dock. A response has a way back out.

Keja is a Bun server. [Hono](https://hono.dev) handles HTTP underneath. The pieces a Veducio service uses are already included: two listeners, versioned routes, Postgres rows with one shared shape, and optional Argus, Vault, and Cloudflare Access.

Use Keja for microservices that run in containers. That is the infrastructure it is built for. A service on a VPS, or a monolith, should use Hono on its own, or NestJS.

Keja is strict. A route, a version, and a stored row each have to match a small set of shapes. That limit is the goal. This shape runs 90% of the services in the Veducio infrastructure.

## Where to go

[Install](/install) gets the package onto the machine. [Build first service](/build-first-service) serves `GET /v1/hello`, then stores one table.

The concept pages follow the order a service meets them.

| Page                           | What it explains                                       |
| ------------------------------ | ------------------------------------------------------ |
| [Project](/project)            | The directory `keja dev` loads                         |
| [Versioning](/versioning)      | Why the first path segment chooses a handler           |
| [Routes](/routes)              | One `defineRoute` and the URL it owns                  |
| [Responses](/responses)        | `respond.Name`, the status, and the body schema        |
| [Middleware](/middleware)      | Code that runs after the route is chosen               |
| [Servers](/servers)            | The public port, the service port, and reserved routes |
| [OwnedObjects](/owned-objects) | The columns every application table has                |
| [TypeIDs](/type-ids)           | The time-ordered `_id`                                 |
| [Database](/database)          | Migrations, repositories, and seed data                |
| [Argus](/argus)                | Finding another service and calling it                 |
| [Vault](/vault)                | Reading one secret and signing grants                  |
| [Cloudflare Access](/access)   | Checking the caller’s Access token                     |

[Commands](/commands) and [Errors](/errors) are the lookup pages.
