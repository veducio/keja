export const frameworkErrors = {
  notFound: {
    code: 1001,
    name: "NotFound",
    description: "No route matched this request.",
    tip: "Check the method, path, and version token.",
  },
  unknownVersion: {
    code: 1002,
    name: "UnknownVersion",
    description: "The version token does not match a published version.",
    tip: "Use a version such as v1, a release date, latest, or current.",
  },
  invalidRequest: {
    code: 1003,
    name: "InvalidRequest",
    description: "The request did not match the route schema.",
    tip: "Compare the path parameters, query, and JSON body with the route definition.",
  },
  invalidResponse: {
    code: 1004,
    name: "InvalidResponse",
    description:
      "The handler result did not match the declared response schema.",
    tip: "Return one of the named responses with the fields its schema requires.",
  },
  accessDenied: {
    code: 1005,
    name: "AccessDenied",
    description: "Cloudflare Access did not accept this request.",
    tip: "Send a valid Cf-Access-Jwt-Assertion header or CF_Authorization cookie.",
  },
  methodNotAllowed: {
    code: 1006,
    name: "MethodNotAllowed",
    description: "The service server only accepts POST.",
    tip: "Send the service request as POST.",
  },
} as const;

export function frameworkError<Extra extends Record<string, unknown>>(
  key: keyof typeof frameworkErrors,
  extra?: Extra,
) {
  return { ...frameworkErrors[key], ...extra };
}

const projectScope = "Project";

export const projectErrors = {
  unknownRouteVersion: {
    scope: projectScope,
    code: 2001,
    name: "UnknownRouteVersion",
    description: "A route uses a version this project does not define.",
    tip: "Add the version to keja.versioning.ts, or change the route version.",
  },
  duplicateRoute: {
    scope: projectScope,
    code: 2002,
    name: "DuplicateRoute",
    description: "Two routes use the same method, path, and version.",
    tip: "Keep one route for that method, path, and version.",
  },
  missingVersionFile: {
    scope: projectScope,
    code: 2003,
    name: "MissingVersionFile",
    description: "The project has no keja.versioning.ts file.",
    tip: "Add keja.versioning.ts that default-exports defineVersions(...).",
  },
  invalidVersionFile: {
    scope: projectScope,
    code: 2004,
    name: "InvalidVersionFile",
    description: "keja.versioning.ts does not export the version catalog.",
    tip: "Default-export the result of defineVersions(...).",
  },
  missingRouteDirectory: {
    scope: projectScope,
    code: 2005,
    name: "MissingRouteDirectory",
    description: "A route directory is missing.",
    tip: "Create src/public and src/service.",
  },
  invalidRouteFile: {
    scope: projectScope,
    code: 2006,
    name: "InvalidRouteFile",
    description: "A route file does not export a route.",
    tip: "Export defineRoute(...) by name, or as the default export.",
  },
  invalidMiddlewareFile: {
    scope: projectScope,
    code: 2007,
    name: "InvalidMiddlewareFile",
    description: "A server middleware file does not export middleware.",
    tip: "Default-export defineMiddleware(...) or an array of them.",
  },
  invalidVersionId: {
    scope: projectScope,
    code: 2008,
    name: "InvalidVersionId",
    description: "A version id is not v followed by a whole number.",
    tip: "Use a version such as v1, v2, or v10.",
  },
  invalidReleaseDate: {
    scope: projectScope,
    code: 2009,
    name: "InvalidReleaseDate",
    description: "A version has a release date Keja cannot read.",
    tip: "Use YYYY-MM-DD, DD-MM-YYYY, or a unix timestamp.",
  },
  invalidStatusCode: {
    scope: projectScope,
    code: 2010,
    name: "InvalidStatusCode",
    description: "A response status code is outside the HTTP range.",
    tip: "Use an integer from 100 to 599.",
  },
  invalidRouteMiddleware: {
    scope: projectScope,
    code: 2011,
    name: "InvalidRouteMiddleware",
    description: "A route lists middleware Keja did not create.",
    tip: "Pass functions created with defineMiddleware(...).",
  },
  invalidRoute: {
    scope: projectScope,
    code: 2030,
    name: "InvalidRoute",
    description:
      "A route definition has a method, path, or schema Keja cannot use.",
    tip: "Use get, post, put, patch, or delete, a path that starts with /, and Zod schemas.",
  },
  invalidConfigFile: {
    scope: projectScope,
    code: 2012,
    name: "InvalidConfigFile",
    description: "keja.config.ts does not export a Keja config.",
    tip: "Default-export the result of defineConfig(...).",
  },
  databaseUrl: {
    scope: projectScope,
    code: 2013,
    name: "DatabaseUrl",
    description:
      "The database is enabled and DATABASE_URL is missing or not a postgres URL.",
    tip: "Set DATABASE_URL to a postgres connection string, or set db.enabled to false.",
  },
  missingMigrations: {
    scope: projectScope,
    code: 2014,
    name: "MissingMigrations",
    description: "The migrations folder is missing.",
    tip: "Create the folder and add files named 0001_name.sql.",
  },
  invalidMigrationFile: {
    scope: projectScope,
    code: 2015,
    name: "InvalidMigrationFile",
    description: "A migration file does not use the 0001_name.sql form.",
    tip: "Rename the file to 0001_name.sql.",
  },
  duplicateMigration: {
    scope: projectScope,
    code: 2016,
    name: "DuplicateMigration",
    description: "Two migration files use the same number.",
    tip: "Keep one file for each migration number.",
  },
  migrationChanged: {
    scope: projectScope,
    code: 2017,
    name: "MigrationChanged",
    description: "An applied migration file changed.",
    tip: "Add a new migration instead of editing an applied file.",
  },
  migrationFailed: {
    scope: projectScope,
    code: 2018,
    name: "MigrationFailed",
    description: "Postgres rejected a migration.",
    tip: "Fix the SQL in that migration file.",
  },
  ownedObjects: {
    scope: projectScope,
    code: 2021,
    name: "OwnedObjects",
    description: "A table does not match the OwnedObjects shape.",
    tip: "Add _id, _object, _tenant, _archived, _createdAt, and _updatedAt with the Keja checks.",
  },
  serviceMethod: {
    scope: projectScope,
    code: 2020,
    name: "ServiceMethod",
    description: "A service route uses a method other than POST.",
    tip: "Change the service route method to post.",
  },
  databaseInit: {
    scope: projectScope,
    code: 2022,
    name: "DatabaseInit",
    description: "The database is enabled and Postgres could not be reached.",
    tip: "Check DATABASE_URL and that Postgres is running.",
  },
  argusInit: {
    scope: projectScope,
    code: 2023,
    name: "ArgusInit",
    description: "Argus is enabled and the first registration failed.",
    tip: "Check the Argus URL, credentials, and catalog service names.",
  },
  vaultInit: {
    scope: projectScope,
    code: 2024,
    name: "VaultInit",
    description: "Vault is enabled and the token lookup failed.",
    tip: "Check the Vault address, token, and namespace.",
  },
  dependencyNotMet: {
    scope: projectScope,
    code: 2025,
    name: "DependencyNotMet",
    description: "A feature was used while a feature it requires is disabled.",
    tip: "Enable the required feature in keja.config.ts.",
  },
  invalidSeeder: {
    scope: projectScope,
    code: 2026,
    name: "InvalidSeeder",
    description: "A seeder does not describe a table and OwnedObjects rows.",
    tip: "Pass a table name and objects with _id, _object, _tenant, _archived, _createdAt, and _updatedAt.",
  },
  invalidSeederFile: {
    scope: projectScope,
    code: 2027,
    name: "InvalidSeederFile",
    description: "A seed file does not export a seeder.",
    tip: "Export defineSeeder(...) by name, or as the default export.",
  },
  invalidRepositorySql: {
    scope: projectScope,
    code: 2028,
    name: "InvalidRepositorySql",
    description: "A migration cannot be read as a repository table.",
    tip: "Use CREATE TABLE or ALTER TABLE ... ADD COLUMN with a mapped column type and the OwnedObjects columns.",
  },
  invalidRepositoryFile: {
    scope: projectScope,
    code: 2029,
    name: "InvalidRepositoryFile",
    description: "keja.repositories.ts does not export repository flags.",
    tip: "Default-export defineRepositories(...), and name tables that the migrations create.",
  },
  accessConfig: {
    scope: projectScope,
    code: 2019,
    name: "AccessConfig",
    description:
      "Cloudflare Access is missing its team domain or audience tag.",
    tip: "Set CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD, or pass team and audience to cloudflareAccess().",
  },
} as const;

export type ProjectErrorEntry =
  (typeof projectErrors)[keyof typeof projectErrors];

export class ProjectError extends Error {
  readonly scope: string;
  readonly code: number;
  readonly errorName: string;
  readonly description: string;
  readonly tip: string;

  constructor(entry: ProjectErrorEntry, detail: string) {
    super(detail);
    this.scope = entry.scope;
    this.code = entry.code;
    this.errorName = entry.name;
    this.description = entry.description;
    this.tip = entry.tip;
  }
}

export function projectError(key: keyof typeof projectErrors, detail: string) {
  return new ProjectError(projectErrors[key], detail);
}

export class DependencyNotMet extends ProjectError {
  constructor(feature: string, requires: string) {
    super(projectErrors.dependencyNotMet, `${feature} requires ${requires}`);
    this.name = "DependencyNotMet";
  }
}
