---

title: How to batch requests
description: Call several routes in one POST, or turn batching off.
---

Run multiple versioned routes in one HTTP call, or disable the batch endpoint.

## Prerequisites

- A running Keja project with at least one public route under a version
- Batch left at the default (`enabled`), unless you already turned it off

## Steps

### 1. Send a batch

`POST /{version}/batch` on the public or service port. The version token is the same one a normal request uses (`v1`, a release date, `latest`, or `current`).

```shell
curl -X POST http://127.0.0.1:3000/v1/batch \
  -H "content-type: application/json" \
  -d "{
    \"requests\": [
      { \"method\": \"get\", \"path\": \"/hello\", \"query\": { \"name\": \"Ada\" } },
      { \"method\": \"get\", \"path\": \"/items\" }
    ]
  }"
```

The response status is `207`. `results` is an array in the same order as `requests`. Each entry has the status and JSON body that call would have returned alone. One failed call does not stop the others.

Rules of thumb:

- At most 25 calls per batch
- `path` is the route path (include `:id` segments the way the route declares them)
- Pass `params`, `query`, and `body` only as that route’s schemas expect
- On the service port, every call must use `method: "post"`

### 2. Confirm Scalar

Open `/docs`. There is one `POST /{version}/batch` operation under the Batch tag (not one entry per version duplicate).

### 3. Turn batch off

In `keja.config.ts`:

```ts
export default defineConfig({
  batch: false,
});
```

Or `batch: { enabled: false }`. Restart or reload as needed so config reloads apply in your workflow; prefer a restart after config changes.

## Done

You can fan out several calls in one request, or remove the endpoint. Request and response shapes: [Routes](/routes#batch). Config: [Project](/project#batch).
