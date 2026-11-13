---

title: Argus
description: Optional registration and service-to-service calls.
---

Argus is how one Keja service finds another. On startup the process registers the public port and the service port. `callService` asks Argus for a healthy instance and POSTs to it. Leave Argus off until this service calls another one, or until other services need to find this one. The full field list is on [Project](/project#argus).

Argus is the Veducio service registry. It is off until `argus.enabled` is `true`. The first registration runs before either server listens. A failure is project error `2023` and startup stops. After that, a failed heartbeat logs `Argus register failed` or `Argus deregister failed` and the APIs stay up.

## Config

| Field      | Default              | Role                                                              |
| ---------- | -------------------- | ----------------------------------------------------------------- |
| `enabled`  | —                    | Required. `false` leaves Argus off                                |
| `url`      | —                    | Required when enabled. Absolute `http` or `https` Argus base URL  |
| `env`      | —                    | Required when enabled. Argus environment name                     |
| `username` | omit                 | Basic auth username. Set with `password`, or omit both            |
| `password` | omit                 | Basic auth password. Set with `username`, or omit both            |
| `public`   | service `name`       | Catalog key for the public port                                   |
| `service`  | `<name>-service`     | Catalog key for the service port                                  |

```ts
export default defineConfig({
  argus: {
    enabled: true,
    url: "https://argus.veducio.com",
    env: "staging",
    username: "argus",
    password: "secret",
    public: "billing",
    service: "billing-service",
  },
});
```

`url` is an absolute `http` or `https` URL. A trailing slash is removed. `env` is the Argus environment. Username and password are sent as HTTP Basic auth when both are set. The catalog must already contain the service name. An unknown service is HTTP `404` from Argus.

## Registration

On listen, Keja registers one instance for each reachable public URL and each reachable service URL. The public catalog key is the service name. The service catalog key is `<name>-service`. `argus.public` and `argus.service` replace those names.

Each registration is a POST to `/v1/register` with `instance_id`, `service`, `env`, `base_url`, weight `100`, status `healthy`, `ttl_seconds` `30`, and metadata that lists both surfaces. The package version is sent when `package.json` has one. A heartbeat repeats the register every 10 seconds. On shutdown, Keja POSTs `/v1/deregister`.

## callService

`callService` uses the Argus config loaded by `dev` or `start`. It GETs `/v1/services/{service}?env={env}`, keeps instances whose status is `healthy`, and picks one by weight. The call is always POST with a JSON body. An omitted body is `{}`.

```ts
import { callService } from "@veducio/keja";

const invoice = await callService("billing-service", "/v1/invoices", {
  amount: 10,
});
```

The first argument is the Argus catalog name. A call to another Keja service API uses the `<name>-service` key, because that key is registered with the service port.

A call while Argus is disabled throws `DependencyNotMet`: `service call requires argus`. `ServiceCallError` is thrown when Argus has no healthy instance, when the catalog name is unknown, or when the downstream service returns a failed status. Argus credentials are sent only to Argus. The service request does not receive them.
