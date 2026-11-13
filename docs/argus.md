---

title: Argus
description: Registration and callService reference.
---

Off until `argus.enabled` is `true`. Config: [Project](/project#argus).

## Config

| Field                   | Default          | Description                                      |
| ----------------------- | ---------------- | ------------------------------------------------ |
| `enabled`               | —                | Required                                         |
| `url`                   | —                | Absolute `http`/`https`; trailing slash stripped |
| `env`                   | —                | Argus environment                                |
| `username` / `password` | omit             | Both set or both omit; Basic auth to Argus       |
| `public`                | service name     | Public catalog key                               |
| `service`               | `<name>-service` | Service catalog key                              |

First registration runs before listen. Failure → project error `2023`. Later heartbeat failures log and leave APIs up.

## Registration

POST `/v1/register` per reachable public and service base URL: `instance_id`, `service`, `env`, `base_url`, weight `100`, status `healthy`, `ttl_seconds` `30`, metadata for both surfaces, package version when present. Heartbeat every 10s. Shutdown POST `/v1/deregister`.

Unknown catalog service → Argus HTTP `404`.

## `callService`

```ts
import { callService } from "@veducio/keja";

const invoice = await callService("billing-service", "/v1/invoices", {
  amount: 10,
});
```

| Detail      | Value                                  |
| ----------- | -------------------------------------- |
| Discovery   | `GET /v1/services/{service}?env={env}` |
| Pick        | Healthy instances by weight            |
| Method      | Always POST                            |
| Body        | JSON; default `{}`                     |
| Credentials | Sent to Argus only, not to the target  |

Disabled Argus → `DependencyNotMet`: `service call requires argus`. No healthy instance / unknown name / failed downstream → `ServiceCallError`.
