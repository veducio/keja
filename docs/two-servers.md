---
title: Two servers
description: Why one Keja process listens on a public port and a service port.
---

One Keja process opens two HTTP servers. They share the same version catalog and the same optional integrations. They do not share the same route folders or the same method rules.

## Public vs service

The public port (`HTTP_PORT`) is for callers outside the service mesh: browsers, gateways, and other clients that speak normal REST methods. Each public route declares its own `get`, `post`, `put`, `patch`, or `delete`.

The service port (`HTTP_SERVICE_PORT`) is for other services. Every project route on that port must be `post`. A non-POST request to a service route returns HTTP `405`. Health, identity, OpenAPI, and docs stay GET on both ports so operators and Scalar still work.

That split keeps a clear boundary: human-facing and gateway-facing traffic on one socket, machine-to-machine work on another. It also makes it hard to accidentally expose a write-shaped service handler with a GET.

## What belongs where

Put read and write APIs that external clients call under `src/public`. Put internal jobs, fan-out, and privileged operations under `src/service`. The folder decides the server. Nested folders do not change the URL; only `path` and `version` do.

## Discovery

When Argus is enabled, Keja registers both ports. The public catalog key defaults to the service name. The service catalog key defaults to `<name>-service`. Callers that should hit the service port use that second key with `callService`. See [Integrations overview](/integrations-overview) and the [Argus](/argus) reference.

## Looking it up

Reserved paths, identity JSON, and OpenAPI behavior are listed under [Servers](/servers). Method rules for routes are under [Routes](/routes).
