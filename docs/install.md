---

title: Install
description: Install Keja from npm or GitHub Packages and create a project.
---

Install puts Keja on the machine and `keja init` creates the project. [Build first service](/build-first-service) is the next page. It serves `GET /v1/hello` from that project.

Keja publishes to npm as `keja`. Imports from that package use `keja`.

```shell
bun add keja zod
```

```ts
import { defineRoute, response } from "keja";
```

Keja also publishes to GitHub Packages as `@veducio/keja`. That package is restricted. An install needs a token that can read packages from the `veducio` organization, and imports use `@veducio/keja`.

Add this `.npmrc` before installing `@veducio/keja`:

```txt
@veducio:registry=https://npm.pkg.github.com
```

```shell
bun add @veducio/keja zod
```

`keja init` creates a project from the starter that ships inside the package. Bun and Git must be installed. The destination must be empty. Init copies the starter, writes `package.json`, `keja.config.ts`, and `tsconfig.json`, adds a public `GET /hello` and a service `POST /ping`, runs `bun install`, then runs `git init`. The new project depends on the package that ran `init`. An `@veducio/keja` install also writes `.npmrc` for GitHub Packages.

```shell
keja init --name my-app --dir ./my-app --public ./src/public --service ./src/service
```

| Flag        | Default         |
| ----------- | --------------- |
| `--name`    | `my-app`        |
| `--dir`     | `./<name>`      |
| `--public`  | `./src/public`  |
| `--service` | `./src/service` |

In a terminal, Enter accepts the default for any flag you omit. Without a terminal, omitted flags use those defaults. The public and service paths are relative to the new project and are written into `keja.config.ts`. The dependency is `^` plus the version of the Keja package that ran `init`.

The generated scripts call the `keja` command. `keja dev` reloads the project when a route or a file it imports changes. Bun loads `.env` from the project directory.

```json
{
  "scripts": {
    "dev": "keja dev",
    "start": "keja start"
  }
}
```

`keja init` copies `.env.example` to `.env` when `.env` is missing. Set `HOST`, `HTTP_PORT`, and `HTTP_SERVICE_PORT` before the first start. When `db` is enabled, also set `DATABASE_URL`.
