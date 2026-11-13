---
title: Errors
description: Framework HTTP errors and project startup errors.
---

## Framework errors

Returned as JSON on a request. Process keeps serving.

| Code | Name | Status | Meaning |
| ---- | ---- | ------ | ------- |
| 1001 | NotFound | 404 | No route for method, path, and version |
| 1002 | UnknownVersion | 404 | Version token not in catalog |
| 1003 | InvalidRequest | 400 | Params, query, or body failed schema |
| 1004 | InvalidResponse | 500 | Handler result failed response schema |
| 1005 | AccessDenied | 401 | Cloudflare Access rejected the token |
| 1006 | MethodNotAllowed | 405 | Service server got a non-POST project method |

Also exported as `frameworkErrors`.

## Project errors

Thrown while loading or checking the project. CLI prints a red `ERROR` badge with scope, code, name, detail, description, and tip. `keja dev` waits (or keeps last good project). `keja start` exits `1`.

| Code | Name | Meaning |
| ---- | ---- | ------- |
| 2001 | UnknownRouteVersion | Route version missing from catalog |
| 2002 | DuplicateRoute | Same method, path, and version twice |
| 2003 | MissingVersionFile | `keja.versioning.ts` missing |
| 2004 | InvalidVersionFile | No catalog export |
| 2005 | MissingRouteDirectory | Public or service folder missing |
| 2006 | InvalidRouteFile | Route file exports no `defineRoute` |
| 2007 | InvalidMiddlewareFile | `_middleware.ts` has no middleware export |
| 2008 | InvalidVersionId | Version id not `v` + whole number |
| 2009 | InvalidReleaseDate | Unreadable release date |
| 2010 | InvalidStatusCode | Response code outside `100`–`599` |
| 2011 | InvalidRouteMiddleware | Middleware not from `defineMiddleware` |
| 2012 | InvalidConfigFile | Config is not a `defineConfig` result |
| 2013 | DatabaseUrl | Bad or missing `DATABASE_URL` |
| 2014 | MissingMigrations | Migrations folder missing |
| 2015 | InvalidMigrationFile | Not `0001_name.sql` |
| 2016 | DuplicateMigration | Duplicate migration number |
| 2017 | MigrationChanged | Applied file checksum changed |
| 2018 | MigrationFailed | Postgres rejected migration |
| 2019 | AccessConfig | Access missing team or audience |
| 2020 | ServiceMethod | Service route is not POST |
| 2021 | OwnedObjects | Table failed OwnedObjects check |
| 2022 | DatabaseInit | Postgres unreachable while DB enabled |
| 2023 | ArgusInit | First Argus registration failed |
| 2024 | VaultInit | Vault token lookup failed |
| 2025 | DependencyNotMet | Feature used while a dependency is off |
| 2026 | InvalidSeeder | Seeder table/row not OwnedObjects |
| 2027 | InvalidSeederFile | Seed file exports no `defineSeeder` |
| 2028 | InvalidRepositorySql | Migration unreadable for generate |
| 2029 | InvalidRepositoryFile | Bad `keja.repositories.ts` |
| 2030 | InvalidRoute | Bad method, path, name, or schema |
