---

title: API versioning
description: Why Keja puts the version in the path and falls back to older handlers.
---

Every request names a version in the first path segment. Every route is written for one version id from `keja.versioning.ts`. Keja does not keep parallel complete copies of the API for each version. It keeps a catalog of releases and picks the newest handler that is not newer than what the caller asked for.

## Why path versions

A container fleet often needs old and new clients at the same time. Putting the version in the path makes the choice visible in logs, OpenAPI, and load-balancer rules. The catalog’s `releasedAt` values give date tokens (`2024-06-01`) and aliases (`latest`, `current`) a deterministic meaning.

## Fallback instead of forks

When you add `v2`, you do not have to redeclare every `v1` route. A caller on `v2` still reaches a `v1` handler for a method and path that `v2` never redefined. A caller on `v1` never receives a `v2` handler. That is the compatibility rule: older clients stay pinned; newer clients inherit until you override.

The cost is discipline. A breaking change needs a new version id and a new route file (or export). A silent edit to a shared `v1` handler still breaks `v1` callers.

## Tokens and selection

The request token resolves to one catalog version. Then Keja filters routes by method and path, drops anything newer than that version, and runs the newest remaining route. Exact rules and error codes are in the [Versioning](/versioning) reference. For a recipe that adds `v2`, see [How to version an API](/how-to-version-an-api).
