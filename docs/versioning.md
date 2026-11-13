---
title: Versioning
description: Version catalog, request tokens, and handler selection.
---

## Catalog

`defineVersions` in `keja.versioning.ts` (or `versioning` path).

| Field        | Required | Description                                                    |
| ------------ | -------- | -------------------------------------------------------------- |
| key          | yes      | `v` + whole number (`v0`, `v1`, `v10`; not `v01`)              |
| `releasedAt` | yes      | `YYYY-MM-DD`, `DD-MM-YYYY`, unix seconds, or unix milliseconds |

| Error | When |
| ----- | ---- |
| `2003` | File missing |
| `2004` | No catalog export |
| `2008` | Bad version id |
| `2009` | Bad release date |

## Request tokens

First path segment:

| Token | Resolves to |
| ----- | ----------- |
| `v1` | That catalog version when defined |
| `2024-06-01` / `01-06-2024` | Newest version released on or before that UTC day |
| `latest` | Newest version |
| `current` | Newest version |

Newest means later `releasedAt`. Equal release instants: higher version number wins. Unknown token → HTTP `404`, framework `1002`.

## Handler selection

1. Resolve the token to a catalog version.
2. Keep routes with the same method and path whose version is not newer than that version.
3. Run the newest remaining route.

Newer means later release date, or same date and higher version number. Nothing left → HTTP `404`, framework `1001`.

A `v2` request may run a `v1` handler when `v2` has no override. A `v1` request never runs a `v2` handler.
