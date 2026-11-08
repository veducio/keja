import { networkInterfaces } from "node:os";
import { setArgus } from "../argus/call.ts";
import { startArgusHeartbeat } from "../argus/heartbeat.ts";
import { migrateDatabase } from "../db/postgres.ts";
import { readOpenApiServers, readRequiredEnv } from "../env/required-env.ts";
import { createHttpApp } from "../http/create-app.ts";
import { loadProject } from "../project/load.ts";
import { formatSelfTest, runSelfTest } from "../self-test/run.ts";
import {
  buildIdentity,
  readPackageVersion,
  readServiceName,
} from "./identity.ts";

export type { AccessIdentity } from "../access/cloudflare.ts";
export { cloudflareAccess, verifyAccessJwt } from "../access/cloudflare.ts";
export { callService, ServiceCallError } from "../argus/call.ts";
export { DBCall } from "../db/client.ts";
export { frameworkErrors } from "../errors/framework-errors.ts";
export type {
  CreateObjectRowOptions,
  ObjectRowMeta,
  ParsedObjectId,
} from "../object-id/id.ts";
export {
  assertObjectType,
  createId,
  createObjectRow,
  idPrefixFromObjectType,
  isObjectId,
  isObjectType,
  OBJECT_ID_BODY_LENGTH,
  ObjectIdError,
  objectIdPattern,
  objectTypeFromRoute,
  parseObjectId,
} from "../object-id/id.ts";
export type { OwnedObject } from "../object-id/owned.ts";
export { assertOwnedObject } from "../object-id/owned.ts";
export { defineConfig } from "../project/config.ts";
export { defineRoute, response } from "../route/define.ts";
export { defineMiddleware } from "../route/middleware.ts";
export { createVault, VaultError, vaultSecret } from "../vault/client.ts";
export { defineVersions } from "../versioning/define.ts";

export async function listen(root = process.cwd()) {
  const project = await loadProject(root);
  const result = runSelfTest();
  if (!result.ok) {
    console.error(formatSelfTest(result, process.stderr.isTTY === true));
    process.exit(1);
  }
  console.log(formatSelfTest(result, process.stdout.isTTY === true));

  const env = readRequiredEnv(Bun.env);
  const openApiServers = readOpenApiServers(Bun.env);
  const migrated = project.database.enabled
    ? await migrateDatabase(
        project.database.migrations,
        Bun.env.DATABASE_URL ?? "",
      )
    : null;
  const identity = buildIdentity({
    name: readServiceName(root, project.name),
    bindHost: env.host,
    publicPort: env.httpPort,
    servicePort: env.httpServicePort,
    interfaces: networkInterfaces(),
  });
  const publicApp = createHttpApp({
    title: "Public",
    versions: project.versions,
    routes: project.publicRoutes,
    middleware: project.publicMiddleware,
    server: openApiServers.openapiServer,
    identity,
  });
  const serviceApp = createHttpApp({
    title: "Service",
    versions: project.versions,
    routes: project.serviceRoutes,
    middleware: project.serviceMiddleware,
    server: openApiServers.openapiServiceServer,
    identity,
    postOnly: true,
  });
  const publicServer = Bun.serve({
    hostname: env.host,
    port: env.httpPort,
    fetch(request) {
      return publicApp.fetch(request);
    },
  });
  const serviceServer = Bun.serve({
    hostname: env.host,
    port: env.httpServicePort,
    fetch(request) {
      return serviceApp.fetch(request);
    },
  });
  setArgus(project.argus);
  if (project.argus) {
    startArgusHeartbeat({
      argus: project.argus,
      identity,
      version: readPackageVersion(root),
    });
  }
  return {
    publicServer,
    serviceServer,
    paths: project.paths,
    identity,
    argus: project.argus,
    database: migrated,
  };
}
