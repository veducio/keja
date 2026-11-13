import { networkInterfaces } from "node:os";
import { setArgus } from "../argus/call.ts";
import { startArgusHeartbeat } from "../argus/heartbeat.ts";
import { argusRegistrations, publishArgus } from "../argus/register.ts";
import { connectDatabase } from "../db/postgres.ts";
import { readOpenApiServers, readRequiredEnv } from "../env/required-env.ts";
import { DependencyNotMet, projectError } from "../errors/framework-errors.ts";
import { connectGrants, setGrants } from "../grant/settings.ts";
import { createHttpApp } from "../http/create-app.ts";
import { type LoadedProject, loadProject } from "../project/load.ts";
import { formatSelfTest, runSelfTest } from "../self-test/run.ts";
import { connectVault, setVault } from "../vault/client.ts";
import {
  buildIdentity,
  readPackageVersion,
  readServiceName,
} from "./identity.ts";
import { swapProjectHandlers } from "./swap.ts";

export type { AccessIdentity } from "../access/cloudflare.ts";
export { cloudflareAccess, verifyAccessJwt } from "../access/cloudflare.ts";
export { callService, ServiceCallError } from "../argus/call.ts";
export { DBCall } from "../db/client.ts";
export {
  DependencyNotMet,
  frameworkErrors,
} from "../errors/framework-errors.ts";
export type { Grant } from "../grant/grant.ts";
export { grant, verifyGrant } from "../grant/grant.ts";
export { defineConfig } from "../project/config.ts";
export { defineRepositories } from "../repository/define.ts";
export { repository } from "../repository/runtime.ts";
export { defineRoute, response } from "../route/define.ts";
export { defineMiddleware } from "../route/middleware.ts";
export { defineSeeder } from "../seed/define.ts";
export type {
  CreateObjectRowOptions,
  ObjectRowMeta,
  ParsedTypeId,
} from "../typeid/id.ts";
export {
  assertObjectType,
  createObjectRow,
  createTypeId,
  idPrefixFromObjectType,
  isObjectType,
  isTypeId,
  objectTypeFromRoute,
  parseTypeId,
  TypeIdError,
} from "../typeid/id.ts";
export type { OwnedObject } from "../typeid/owned.ts";
export { assertOwnedObject } from "../typeid/owned.ts";
export { createVault, VaultError, vaultSecret } from "../vault/client.ts";
export { defineVersions } from "../versioning/define.ts";

export async function listen(
  root = process.cwd(),
  options?: { generation?: string },
) {
  const project = await loadProject(root, options);
  const result = runSelfTest();
  if (!result.ok) {
    console.error(formatSelfTest(result, process.stderr.isTTY === true));
    process.exit(1);
  }
  console.log(formatSelfTest(result, process.stdout.isTTY === true));

  const env = readRequiredEnv(Bun.env);
  const openApiServers = readOpenApiServers(Bun.env);
  if (project.database.enabled) {
    await connectDatabase(Bun.env.DATABASE_URL ?? "");
  }
  if (project.vault.enabled) {
    await connectVault(project.vault);
  } else {
    setVault(null);
  }
  if (project.grants.enabled) {
    if (project.grants.mode === "transit" && !project.vault.enabled) {
      throw new DependencyNotMet("grant transit", "vault");
    }
    if (
      project.grants.mode === "secret" &&
      project.grants.secret_vault &&
      !project.vault.enabled
    ) {
      throw new DependencyNotMet("grant secret_vault", "vault");
    }
    await connectGrants(project.grants);
  } else {
    setGrants(null);
  }
  const mounted = mountProject(root, project, env, openApiServers);
  const identity = mounted.identity;
  if (project.argus.enabled) {
    const errors = await publishArgus({
      url: project.argus.url,
      username: project.argus.username,
      password: project.argus.password,
      registrations: argusRegistrations({
        identity,
        argus: project.argus,
        version: readPackageVersion(root),
      }),
    });
    if (errors.length > 0) {
      throw projectError("argusInit", errors.join("; "));
    }
  }
  const publicServer = Bun.serve({
    hostname: env.host,
    port: env.httpPort,
    fetch(request) {
      return mounted.publicApp.fetch(request);
    },
  });
  const serviceServer = Bun.serve({
    hostname: env.host,
    port: env.httpServicePort,
    fetch(request) {
      return mounted.serviceApp.fetch(request);
    },
  });
  setArgus(project.argus.enabled ? project.argus : null);
  if (project.argus.enabled) {
    startArgusHeartbeat({
      argus: project.argus,
      identity,
      version: readPackageVersion(root),
      lead: false,
    });
  }
  return {
    publicServer,
    serviceServer,
    paths: project.paths,
    identity,
    argus: project.argus,
    vault: project.vault,
    database: project.database.enabled ? { connected: true as const } : null,
    reload(next: LoadedProject) {
      swapProjectHandlers(
        { publicServer, serviceServer },
        mountProject(root, next, env, openApiServers),
      );
    },
  };
}

function mountProject(
  root: string,
  project: LoadedProject,
  env: { host: string; httpPort: number; httpServicePort: number },
  openApiServers: {
    openapiServer: string | null;
    openapiServiceServer: string | null;
  },
) {
  const identity = buildIdentity({
    name: readServiceName(root, project.name),
    bindHost: env.host,
    publicPort: env.httpPort,
    servicePort: env.httpServicePort,
    interfaces: networkInterfaces(),
  });
  return {
    identity,
    publicApp: createHttpApp({
      title: "Public",
      versions: project.versions,
      routes: project.publicRoutes,
      middleware: project.publicMiddleware,
      server: openApiServers.openapiServer,
      identity,
      batch: project.batch.enabled,
    }),
    serviceApp: createHttpApp({
      title: "Service",
      versions: project.versions,
      routes: project.serviceRoutes,
      middleware: project.serviceMiddleware,
      server: openApiServers.openapiServiceServer,
      identity,
      postOnly: true,
      batch: project.batch.enabled,
    }),
  };
}
