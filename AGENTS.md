# Agent instructions

This package is a TypeScript Bun server. Biome formats and lints the repository. Vitest tests the self-test helpers. Checks live in `src/self-test/checks.ts`. `bun src/self-test/run.ts` runs them.

- Write TypeScript. Do not add JavaScript source files.
- Keep each concern in its own folder under `src/`: `cli`, `server`, `env`, `self-test`, `versioning`, `route`, `project`, and `http`.
- `src/server` is importable. Do not listen or exit when that module is imported. The CLI in `src/cli` is the executable entry.
- Run `npm run typecheck`, `npm test`, `npm run self-test`, and `npm run check` before finishing a change.
- Required environment variables and their validators live in `src/env/required-env.ts`. A project sets `HOST`, `HTTP_PORT`, and `HTTP_SERVICE_PORT`. Optional `OPENAPI_SERVER` and `OPENAPI_SERVICE_SERVER` set the OpenAPI server URL for each document.
- A Keja project keeps `keja.versioning.ts` at its root and one route module per file in `src/public` and `src/service`. `dev` and `start` load that project from the current directory. `examples/example-app` is a sample package. `bun dev` in that directory starts it. Its tsconfig maps `@veducio/keja`.
- Do not edit `version` in `package.json` by hand. A push to `production` or `main` bumps the version from commit messages. The rules live in `.github/scripts/version-bump.sh`.
- Husky blocks direct commits and pushes to `production`. Commit messages must use Conventional Commits. The pre-commit hook runs Biome on staged files.
