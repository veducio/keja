---

title: Errors
description: HTTP framework errors and project startup errors.
---

Keja has two kinds of failure. A bad request returns a framework error as JSON and the process keeps serving. A bad project file prints a project error. `keja dev` keeps the last good project and waits. `keja start` exits.

A request that fails inside a route returns JSON. The body is the framework error plus any extra fields, such as Zod `issues`. These responses are not printed by the CLI.

| Code | Name             | Status | Meaning                                              |
| ---- | ---------------- | ------ | ---------------------------------------------------- |
| 1001 | NotFound         | 404    | No route matched the method, path, and version       |
| 1002 | UnknownVersion   | 404    | The version token is not in the catalog              |
| 1003 | InvalidRequest   | 400    | Params, query, or JSON body failed the route schema  |
| 1004 | InvalidResponse  | 500    | The handler result failed the response schema        |
| 1005 | AccessDenied     | 401    | Cloudflare Access rejected the token                 |
| 1006 | MethodNotAllowed | 405    | The service server received a method other than POST |

`frameworkErrors` exports the same objects.

A failure while loading the project throws `ProjectError`. The CLI prints a red `ERROR` badge, the scope `Project`, the code, the name, the detail, the description, and the tip. `keja dev` then waits. `keja start` exits `1`.

| Code | Name                   | Meaning                                                          |
| ---- | ---------------------- | ---------------------------------------------------------------- |
| 2001 | UnknownRouteVersion    | A route version is missing from the catalog                      |
| 2002 | DuplicateRoute         | Two routes share a method, path, and version                     |
| 2003 | MissingVersionFile     | `keja.versioning.ts` is missing                                  |
| 2004 | InvalidVersionFile     | The version file has no catalog export                           |
| 2005 | MissingRouteDirectory  | The public or service folder is missing                          |
| 2006 | InvalidRouteFile       | A route file exports no `defineRoute`                            |
| 2007 | InvalidMiddlewareFile  | `_middleware.ts` has no middleware export                        |
| 2008 | InvalidVersionId       | A version id is not `v` plus a whole number                      |
| 2009 | InvalidReleaseDate     | A release date cannot be read                                    |
| 2010 | InvalidStatusCode      | A response code is outside `100`–`599`                           |
| 2011 | InvalidRouteMiddleware | A route middleware was not created with `defineMiddleware`       |
| 2012 | InvalidConfigFile      | `keja.config.ts` is not a `defineConfig` result                  |
| 2013 | DatabaseUrl            | `DATABASE_URL` is missing or is not a postgres URL               |
| 2014 | MissingMigrations      | The migrations folder is missing                                 |
| 2015 | InvalidMigrationFile   | A migration file is not `0001_name.sql`                          |
| 2016 | DuplicateMigration     | Two files share a migration number                               |
| 2017 | MigrationChanged       | An applied file changed                                          |
| 2018 | MigrationFailed        | Postgres rejected a migration                                    |
| 2019 | AccessConfig           | Cloudflare Access is missing a team or audience                  |
| 2020 | ServiceMethod          | A service route is not POST                                      |
| 2021 | OwnedObjects           | A table does not match the OwnedObjects shape                    |
| 2022 | DatabaseInit           | Postgres could not be reached while the database is enabled      |
| 2023 | ArgusInit              | The first Argus registration failed                              |
| 2024 | VaultInit              | The Vault token lookup failed                                    |
| 2025 | DependencyNotMet       | A feature ran while one it requires is disabled                  |
| 2026 | InvalidSeeder          | A seeder table or row does not match OwnedObjects                |
| 2027 | InvalidSeederFile      | A seed file exports no `defineSeeder`                            |
| 2028 | InvalidRepositorySql   | A migration cannot be read as a repository table                 |
| 2029 | InvalidRepositoryFile  | `keja.repositories.ts` does not export repository flags          |
| 2030 | InvalidRoute           | A route definition has a method, path, or schema Keja cannot use |
