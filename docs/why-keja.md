---
title: Why Keja
description: What Keja is for, and what it deliberately leaves out.
---

Keja started as a side project by Plomyk and later became part of Veducio Labs. Veducio Labs exists to power open source. The name is Polish for “quay”: a place where arrivals and departures meet. An API request has somewhere to dock. A response has a way back out.

## The job

Keja is built for microservices that run in containers. A process boots, binds two ports, serves versioned routes, and optionally talks to Postgres, a service registry, Vault, or Cloudflare Access. That is the job. It is not a general application framework.

If you are building a monolith, a long-lived VPS app, or a site with a large UI surface, use Hono or NestJS on their own. Keja sits on Hono for HTTP, but it adds constraints that only pay off when many small services share the same shapes.

## Strict shapes on purpose

A route, a version id, and a stored row each have to match a small set of forms. Those limits are the product. The same OwnedObjects columns, the same version catalog, and the same two-port layout make services interchangeable in a fleet. You trade flexibility for predictability: migration checks, generated repositories, and OpenAPI that stays close to the code.

## What “shipping with Keja” means

You ship by putting a Keja project in a container image, setting env vars, and running `keja start`. Optional integrations stay off until you turn them on in `keja.config.ts`. Nothing in the core assumes Argus, Vault, or Access are present.

For the two listeners, see [Two servers](/two-servers). For path versions, see [API versioning](/api-versioning). For the row model, see [OwnedObjects model](/owned-objects-model). For optional systems, see [Integrations overview](/integrations-overview).
