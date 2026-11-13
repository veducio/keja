---

title: Integrations overview
description: How Argus, Vault, Grants, and Cloudflare Access fit around the core.
---

Keja’s core is the project directory, two listeners, versions, and routes. Everything else is optional and off until you enable it. That keeps a minimal service small, and it keeps secrets and mesh concerns out of projects that do not need them.

## Argus

Argus is a service registry. When enabled, Keja registers the public and service base URLs and refreshes them on a heartbeat. `callService` asks Argus for a healthy instance and POSTs to it. Use Argus when services must find each other by catalog name instead of hard-coded hosts. See [How to call a service](/how-to-call-a-service) and [Argus](/argus).

## Vault

Vault holds secrets outside the repo. When enabled, startup checks the token, and `vaultSecret` reads one KV v2 secret. Grants in transit mode, or secret mode with `secret_vault`, also need Vault. See [How to read Vault secrets](/how-to-read-vault-secrets) and [Vault](/vault).

## Grants

A grant is a short-lived JWT for one subject and one action. Signing is either Vault Transit or an HS256 secret (config, `GRANT_SECRET`, or a KV path). Grants are not middleware; you issue and verify them in handlers. See [How to issue grants](/how-to-issue-grants) and [Grants](/grants).

## Cloudflare Access

`cloudflareAccess()` is route middleware. It verifies the Access JWT and passes identity into the handler as `access`. It cannot live in server `_middleware.ts`, because that file cannot pass fields to the handler. See [How to protect with Access](/how-to-protect-with-access) and [Cloudflare Access](/access).

## Dependency rules

Features that need another integration fail fast with `DependencyNotMet` (project error `2025`) when that dependency is disabled. Transit grants and `secret_vault` require Vault. `callService` requires Argus. `DBCall` and seed require the database. Startup checks enabled integrations before either server listens.
