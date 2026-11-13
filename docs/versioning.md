---

title: Versioning
description: Version tokens and how Keja chooses a handler.
---

Every request names a version in the first path segment, such as `/v1/hello`. Every route is written for one version. Keja runs the newest route for that method and path whose version is not newer than the one the caller asked for. A caller on `v1` keeps the `v1` handler after `v2` exists. A caller on `v2` still reaches a `v1` route when `v2` has no route for that method and path.

`defineVersions` records each version id and the instant it was released. Ids match `v` plus a whole number: `v0`, `v1`, `v2`, `v10`. `v01` is rejected.

| Field        | Required | Role                                                                 |
| ------------ | -------- | -------------------------------------------------------------------- |
| key          | yes      | Version id: `v` plus a whole number                                  |
| `releasedAt` | yes      | `YYYY-MM-DD`, `DD-MM-YYYY`, unix seconds, or unix milliseconds       |

```ts
import { defineVersions } from "@veducio/keja";

export default defineVersions({
  v1: { releasedAt: "2020-01-15" },
  v2: { releasedAt: "2024-06-01" },
});
```

A missing file is project error `2003`. A file that does not default-export the catalog is project error `2004`. A bad id is `2008`. A bad date is `2009`.

## Request token

The first path segment is the token.

| Token                        | Selection                                         |
| ---------------------------- | ------------------------------------------------- |
| `v1`                         | That version, when the catalog defines it         |
| `2024-06-01` or `01-06-2024` | Newest version released on or before that UTC day |
| `latest`                     | Newest version                                    |
| `current`                    | Newest version                                    |

Newest means the later `releasedAt`. When two versions share a release instant, the higher version number wins. An unknown token returns HTTP `404` and framework error `1002`.

## Handler fallback

After the token resolves, Keja keeps routes with the same method and path whose version is not newer than the requested version. Newer means a later release date, or the same release date and a higher version number. Among the remaining routes, the newest one runs.

A request for `v2` can run a `v1` handler when `v2` has no route for that method and path. A request for `v1` does not run a `v2` handler. When nothing remains, the response is HTTP `404` and framework error `1001`.
