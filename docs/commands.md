---

title: Commands
description: keja dev, start, migrate, generate, seed, init, and build.
---

Run these commands from a Keja project directory. `dev` and `start` serve the two ports. `migrate`, `generate`, and `seed` are the database commands. `init` creates a project. `build` is reserved. `dev` and `start` load that directory, run the self-test, then listen.

```shell
keja dev
keja start
keja migrate
keja generate
keja seed
keja init
keja build
```

The self-test checks that the process is Bun and that `HOST`, `HTTP_PORT`, and `HTTP_SERVICE_PORT` are present. A failed self-test exits `1` for both commands.

## dev

`keja dev` is the development server. It watches the project and reloads routes, their local imports, `/_openapi.json`, and `/docs` without closing the sockets. A reload prints `reloading...`. A project with no errors prints `no issues found`. A failed reload prints the red error badge and keeps serving the last good project. The first boot failure prints that badge and `waiting for changes` until a later save succeeds.

The database pool, Vault, and Argus stay as they were at boot. Restart `dev` after changing those settings, `.env`, or Keja itself.

## start

`keja start` listens once. A project with no errors prints `no issues found`. A project error prints the same badge and the process exits `1`.

## migrate

`keja migrate` applies the files in the migrations folder. It prints the folder and the filenames applied by that command, or `up to date`. The database must be enabled. A project error prints the same badge and the process exits `1`.

## generate

`keja generate` reads the migration SQL and writes `src/db/repositories.ts`. It does not connect to Postgres and it does not apply migrations. `keja.repositories.ts` turns on `list` and `get` for named tables. A project error prints the same badge and the process exits `1`.

## seed

`keja seed` inserts each `defineSeeder` from the `seed` folder. It does not apply migrations. A row whose `_id` is already stored is left in place. The command prints how many rows each table gained. The database must be enabled. A project error prints the same badge and the process exits `1`.

## init

`keja init` creates a project. Flags and the generated files are in [Install](/install).

## build

`keja build` prints `build is not implemented` and exits `1`.
