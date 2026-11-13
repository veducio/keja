---

title: How to call a service
description: Enable Argus and POST to another service with callService.
---

Register this process with Argus and call another catalog service by name.

## Prerequisites

- An Argus deployment your process can reach
- Catalog entries for the services you will call
- This project’s public and service ports reachable at the URLs Argus will store

## Steps

### 1. Enable Argus in config

```ts
export default defineConfig({
  name: "billing",
  argus: {
    enabled: true,
    url: "https://argus.example",
    env: "staging",
    username: "argus",
    password: "secret",
  },
});
```

`url` and `env` are required when enabled. Username and password are both set or both omitted. Optional `public` and `service` override catalog keys (defaults: `name` and `<name>-service`).

Restart after enabling Argus. The first registration runs before listen; failure stops startup.

### 2. Call another service

```ts
import { callService } from "@veducio/keja";

const invoice = await callService("billing-service", "/v1/invoices", {
  amount: 10,
});
```

The first argument is the Argus catalog name. To hit another Keja service port, use its `<name>-service` key. The HTTP method is always POST. An omitted body becomes `{}`.

### 3. Handle failures

Calling while Argus is disabled throws `DependencyNotMet`. No healthy instance, unknown catalog name, or a failed downstream status throws `ServiceCallError`.

## Done

This process registers with Argus and can POST through `callService`. Fields and registration payload: [Argus](/argus). Why two ports matter: [Two servers](/two-servers).
