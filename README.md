# keja

Hono server framework for Bun.

Copy `.env.example` to `.env` and set `HOST`, `HTTP_PORT`, and `HTTP_SERVICE_PORT` before starting. `OPENAPI_SERVER` and `OPENAPI_SERVICE_SERVER` are optional absolute http or https URLs written into each OpenAPI document. The names and validators live in `src/env/required-env.ts`.

A project keeps `keja.versioning.ts` at its root. Public routes live in `src/public` and service routes live in `src/service`, one `defineRoute` module per file. `npm run dev` and `npm start` load that project from the current directory and listen on both ports. Each server exposes `/_health`, `/_openapi.json`, and `/docs`.

## Commands

- `examples/example-app` is its own package. From that directory, `bun install` then `bun dev` starts it. The app defines `v1` and `v2`, serves users and posts on the public port, and creates jobs on the service port.
- `npm run dev` runs the self-test, then starts the development server with Bun watch. Run it from a Keja project. In this repository it fails until `keja.versioning.ts` exists in the current directory.
- `npm start` runs the self-test, then starts the server once.
- `npm run self-test` checks that the process is Bun, checks the machine, then checks required environment variables.
- `keja dev` and `keja start` are the same commands through the CLI. `keja build` and `keja init` are reserved for a later specification.
- `npm run typecheck` typechecks the project with TypeScript.
- `npm test` runs the Vitest suite once.
- `npm run test:watch` runs Vitest in watch mode.
- `npm run lint` lints the project with Biome.
- `npm run format` formats the project with Biome.
- `npm run check` runs the Biome formatter and linter without writing.

## Git hooks

Husky installs the hooks in `.husky` on `npm install`.

- Commits and pushes directly to `production` are rejected.
- Commit messages must use Conventional Commits, such as `feat: add a route` or `fix(api): handle a missing host`.
- Staged files are checked with Biome before a commit is created.

## Versioning

A push to `production` or `main` runs the test suite, then chooses a version bump from the commit messages in that push:

- `type!:` or a `BREAKING CHANGE:` footer bumps the major version.
- `feat:` bumps the minor version.
- `fix:` bumps the patch version.
- Any other message does not bump the version.

When several commits are pushed together, the highest bump wins. The workflow commits `chore: release <version>` and pushes that commit plus the git tag.
