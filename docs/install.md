---
title: Install
description: Install Keja and create a project with keja init.
---

This lesson gets Keja onto your machine and creates a project directory you can run. When you finish, you have a folder with routes, config, and a `.env` file. The next lesson starts that project and serves a request.

## Prerequisites

- [Bun](https://bun.sh) installed (Keja targets Bun 1.4+)
- Git installed (`keja init` runs `git init`)
- An empty directory for the new project (or let init create one)

## Install the package

Keja publishes to npm as `@veducio/keja`.

```shell
bun add @veducio/keja zod
```

```ts
import { defineRoute, response } from "@veducio/keja";
```

The same package name is also on GitHub Packages. That feed is restricted. To install from GitHub Packages instead of npm, add an `.npmrc` that sends the `@veducio` scope there, then run the same `bun add` command:

```txt
@veducio:registry=https://npm.pkg.github.com
```

You need a token that can read packages from the `veducio` organization.

## Create a project

`keja init` copies the starter that ships inside the package. Bun and Git must be available. The destination must be empty.

```shell
keja init --name my-app --dir ./my-app
cd my-app
```

| Flag        | Default         |
| ----------- | --------------- |
| `--name`    | `my-app`        |
| `--dir`     | `./<name>`      |
| `--public`  | `./src/public`  |
| `--service` | `./src/service` |

In a terminal, Enter accepts the default for any flag you omit. Without a terminal, omitted flags use those defaults. The public and service paths are written into `keja.config.ts`. The dependency is `^` plus the version of the Keja package that ran `init`.

Init copies the starter, writes `package.json`, `keja.config.ts`, and `tsconfig.json`, adds a public `GET /hello` and a service `POST /ping`, runs `bun install`, then runs `git init`. If the Keja package that ran init came from GitHub Packages, init also writes `.npmrc` for that feed. An npm install leaves `.npmrc` out so the new project installs from npm.

## Environment

Init copies `.env.example` to `.env` when `.env` is missing. Set these before the first start:

| Variable            | Example       |
| ------------------- | ------------- |
| `HOST`              | `127.0.0.1`   |
| `HTTP_PORT`         | `3000`        |
| `HTTP_SERVICE_PORT` | `3001`        |

When Postgres is enabled in config, also set `DATABASE_URL` to a `postgres://` or `postgresql://` URL. The full env list is in [Project](/project#environment).

## Scripts

The generated `package.json` calls the `keja` command:

```json
{
  "scripts": {
    "dev": "keja dev",
    "start": "keja start"
  }
}
```

Bun loads `.env` from the project directory when you run those scripts.

## What you should have

A project directory with `keja.versioning.ts`, `keja.config.ts`, `src/public/hello.ts`, `src/service/ping.ts`, and `.env`.

Next: [Build first service](/build-first-service).
