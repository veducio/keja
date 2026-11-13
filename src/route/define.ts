import type { ZodType } from "zod";
import { frameworkError, projectError } from "../errors/framework-errors.ts";
import { readVersionNumber, type VersionId } from "../versioning/define.ts";
import { isMiddleware, type MiddlewareDefinition } from "./middleware.ts";

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export type RequestSchemas = {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
};

export type RouteResponse = {
  name: string;
  code: number;
  schema: ZodType;
};

type DefinedInput<Request extends RequestSchemas> = {
  [Key in keyof Request & keyof RequestSchemas as Request[Key] extends ZodType
    ? Key
    : never]: Request[Key] extends ZodType ? Request[Key]["_output"] : never;
};

type ResponseDefinition = {
  code: number;
  json: ZodType;
};

type ResponseMap = Record<string, ResponseDefinition>;

type JsonOutput<Schema> = Schema extends ZodType ? Schema["_output"] : never;

type ResponseSchema<Definition> = Definition extends { json: infer Schema }
  ? Schema
  : never;

type ResponseConstants<Definition> = Definition extends {
  const: infer Constants extends object;
}
  ? Constants
  : never;

type VariableBody<Definition> =
  ResponseConstants<Definition> extends never
    ? JsonOutput<ResponseSchema<Definition>>
    : Omit<
        JsonOutput<ResponseSchema<Definition>>,
        keyof ResponseConstants<Definition>
      >;

type RespondFns<Responses extends ResponseMap> = {
  [Name in keyof Responses]: keyof VariableBody<Responses[Name]> extends never
    ? () => Response
    : (body: VariableBody<Responses[Name]>) => Response;
};

type UnionToIntersection<Union> = (
  Union extends unknown
    ? (value: Union) => void
    : never
) extends (value: infer Intersection) => void
  ? Intersection
  : never;

type FieldsOf<Middleware> =
  Middleware extends MiddlewareDefinition<infer Fields>
    ? Fields
    : Record<never, never>;

type MergedFields<List extends readonly MiddlewareDefinition<object>[]> =
  List extends readonly []
    ? Record<never, never>
    : UnionToIntersection<FieldsOf<List[number]>>;

export type RouteDefinition = {
  method: HttpMethod;
  path: string;
  version: string;
  name: string | null;
  request: RequestSchemas;
  responses: RouteResponse[];
  middleware: readonly MiddlewareDefinition<object>[];
  handle: (input: {
    params?: unknown;
    query?: unknown;
    body?: unknown;
    fields: Record<string, unknown>;
  }) => Response | Promise<Response>;
};

const routeBrand = "keja.route";
const httpMethods = ["get", "post", "put", "patch", "delete"] as const;

const routePath =
  /^\/(?:$|(?:[A-Za-z0-9._~-]+|:[A-Za-z_][A-Za-z0-9_]*)(?:\/(?:[A-Za-z0-9._~-]+|:[A-Za-z_][A-Za-z0-9_]*))*\/?)$/;

export function response<
  const Code extends number,
  Schema extends ZodType,
>(definition: { code: Code; json: Schema }): { code: Code; json: Schema };
export function response<
  const Code extends number,
  Schema extends ZodType,
  const Constants extends Partial<Schema["_output"]>,
>(definition: {
  code: Code;
  json: Schema;
  const: Constants;
}): { code: Code; json: Schema; const: Constants };
export function response(definition: {
  code: number;
  json: ZodType;
  const?: object;
}) {
  return definition;
}

export function defineRoute<
  const Version extends string,
  const Request extends RequestSchemas,
  const Responses extends ResponseMap,
  const MiddlewareList extends readonly MiddlewareDefinition<object>[] = [],
>(definition: {
  method: HttpMethod;
  path: string;
  name?: string;
  version: VersionId<Version> extends never
    ? "Version must use the form v1, v2, v3"
    : Version;
  request?: Request;
  middleware?: MiddlewareList;
  responses: Responses;
  handler: (
    input: DefinedInput<Request> &
      MergedFields<MiddlewareList> & { respond: RespondFns<Responses> },
  ) => Response | Promise<Response>;
}): RouteDefinition {
  if (
    typeof definition.method !== "string" ||
    !httpMethods.includes(definition.method)
  ) {
    throw projectError(
      "invalidRoute",
      `Method ${String(definition.method)} must be get, post, put, patch, or delete`,
    );
  }
  if (typeof definition.path !== "string" || !routePath.test(definition.path)) {
    throw projectError(
      "invalidRoute",
      `Path ${String(definition.path)} must start with /`,
    );
  }
  const name =
    definition.name === undefined
      ? null
      : typeof definition.name === "string" && definition.name.trim() !== ""
        ? definition.name.trim()
        : (() => {
            throw projectError(
              "invalidRoute",
              `${definition.method.toUpperCase()} ${definition.path} name must be a non-empty string`,
            );
          })();
  const request = definition.request as RequestSchemas | undefined;
  if (request) {
    for (const key of ["params", "query", "body"] as const) {
      if (request[key] !== undefined) {
        assertSchema(
          request[key],
          `${definition.method.toUpperCase()} ${definition.path} request.${key}`,
        );
      }
    }
  }
  if (readVersionNumber(definition.version) === null) {
    throw projectError(
      "invalidVersionId",
      `Version ${definition.version} must use the form v1, v2, v3`,
    );
  }
  const responses = Object.entries(definition.responses).map(
    ([name, defined]) => {
      if (!defined || typeof defined !== "object" || !("json" in defined)) {
        throw projectError(
          "invalidRoute",
          `${definition.method.toUpperCase()} ${definition.path} response ${name} must be created with response(...)`,
        );
      }
      assertSchema(
        defined.json,
        `${definition.method.toUpperCase()} ${definition.path} response ${name}`,
      );
      if (
        !Number.isInteger(defined.code) ||
        defined.code < 100 ||
        defined.code > 599
      ) {
        throw projectError(
          "invalidStatusCode",
          `Response ${name} has an invalid status code`,
        );
      }
      return {
        name,
        code: defined.code,
        schema: defined.json,
      };
    },
  );
  const respond = Object.fromEntries(
    Object.entries(definition.responses).map(([name, defined]) => [
      name,
      (body: unknown) => {
        const fixed = defined as ResponseDefinition & { const?: object };
        const parsed = fixed.json.safeParse({
          ...(isRecord(body) ? body : {}),
          ...(fixed.const ?? {}),
        });
        if (!parsed.success) {
          return Response.json(
            frameworkError("invalidResponse", { issues: parsed.error.issues }),
            { status: 500 },
          );
        }
        return Response.json(parsed.data, { status: defined.code });
      },
    ]),
  ) as RespondFns<Responses>;
  const middleware: MiddlewareDefinition<object>[] = [];
  for (const item of definition.middleware ?? []) {
    if (!isMiddleware(item)) {
      throw projectError(
        "invalidRouteMiddleware",
        `${definition.method.toUpperCase()} ${definition.path} middleware must be created with defineMiddleware(...)`,
      );
    }
    middleware.push(item);
  }
  const route: RouteDefinition = {
    method: definition.method,
    path: definition.path,
    version: definition.version,
    name,
    request: definition.request ?? {},
    responses,
    middleware,
    handle: (input) =>
      definition.handler({
        ...input.fields,
        ...(input.params === undefined ? {} : { params: input.params }),
        ...(input.query === undefined ? {} : { query: input.query }),
        ...(input.body === undefined ? {} : { body: input.body }),
        respond,
      } as DefinedInput<Request> &
        MergedFields<MiddlewareList> & { respond: RespondFns<Responses> }),
  };
  return Object.assign(route, { [routeBrand]: true });
}

function assertSchema(value: unknown, label: string, seen = new Set<object>()) {
  if (!isSchema(value)) {
    throw projectError("invalidRoute", `${label} must be a Zod schema`);
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);
  const def = value._zod.def;
  if (!def) {
    return;
  }
  if ("element" in def) {
    assertSchema(def.element, label, seen);
  }
  if ("innerType" in def) {
    assertSchema(def.innerType, label, seen);
  }
  if (def.shape && typeof def.shape === "object") {
    for (const nested of Object.values(def.shape)) {
      assertSchema(nested, label, seen);
    }
  }
  if (Array.isArray(def.options)) {
    for (const option of def.options) {
      assertSchema(option, label, seen);
    }
  }
  if (Array.isArray(def.items)) {
    for (const item of def.items) {
      assertSchema(item, label, seen);
    }
  }
}

function isSchema(value: unknown): value is {
  _zod: { def?: Record<string, unknown> };
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "_zod" in value &&
    typeof (value as { safeParse?: unknown }).safeParse === "function"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isRoute(value: unknown): value is RouteDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    routeBrand in value &&
    (value as Record<string, unknown>)[routeBrand] === true &&
    "method" in value &&
    "path" in value
  );
}
