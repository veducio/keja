---

title: Commands
description: keja CLI commands and behavior.
---

Run these from a Keja project directory (except `init`, which creates one).

```shell
keja dev
keja start
keja migrate
keja generate
keja seed
keja init
keja build
```

`dev` and `start` load the project, run the self-test, then listen. The self-test requires Bun and `HOST`, `HTTP_PORT`, and `HTTP_SERVICE_PORT`. A failed self-test exits `1`.

## `keja dev`

Development server. Watches the project and reloads routes, local imports, `/_openapi.json`, and `/docs` without closing sockets. When a reload runs, an empty `.ts` file under the public or service folder is filled with a basic `defineRoute` stub (`get` on public, `post` on service; path from the file name; version `v1`).

| Output                | Meaning                                      |
| --------------------- | -------------------------------------------- |
| `reloading...`        | A watched change is being applied            |
| `no issues found`     | Project loaded                               |
| red `ERROR` badge     | Load failed; last good project keeps serving |
| `waiting for changes` | First boot failed; waiting for a fix         |

Database pool, Vault, and Argus stay as they were at boot. Restart after changing those settings, `.env`, or Keja itself.

## `keja start`

Listens once. Success prints `no issues found`. A project error prints the badge and exits `1`.

## `keja migrate`

Applies SQL files in the migrations folder. Requires `db.enabled`. Prints the folder and applied filenames, or `up to date`. Project errors exit `1`.

## `keja generate`

Reads migration SQL and writes `src/db/repositories.ts`. Does not connect to Postgres and does not apply migrations. `keja.repositories.ts` selects `list` / `get` flags. Project errors exit `1`.

## `keja seed`

Inserts each `defineSeeder` from `seed/`. Does not migrate. Skips rows whose `_id` already exists. Prints rows gained per table. Requires the database. Project errors exit `1`.

## `keja init`

Creates a project. Flags: [Install](/install).

## `keja build`

Prints `build is not implemented` and exits `1`.
