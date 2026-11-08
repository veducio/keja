import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { type ZodType, z } from "zod";
import type { RouteDefinition, RouteResponse } from "../route/define.ts";

export function createOpenApiDocument(
  title: string,
  routes: readonly RouteDefinition[],
  server?: string | null,
) {
  const spec = new OpenAPIHono();
  for (const route of routes) {
    spec.openapi(
      createRoute({
        method: route.method,
        path: openApiPath(route.version, route.path),
        request: openApiRequest(route) as never,
        responses: openApiResponses(route.responses) as never,
      }),
      (c) => c.json({}, 200) as never,
    );
  }
  return spec.getOpenAPIDocument({
    openapi: "3.0.0",
    info: {
      title,
      version: "0.1.0",
    },
    ...(server ? { servers: [{ url: server }] } : {}),
  });
}

function openApiPath(version: string, path: string) {
  const converted = path.replaceAll(/:([A-Za-z0-9_]+)/g, "{$1}");
  return `/${version}${converted.startsWith("/") ? converted : `/${converted}`}`;
}

function openApiRequest(route: RouteDefinition) {
  const request: {
    params?: ZodType;
    query?: ZodType;
    body?: {
      content: {
        "application/json": {
          schema: ZodType;
        };
      };
      required: true;
    };
  } = {};
  if (route.request.params) {
    request.params = route.request.params;
  }
  if (route.request.query) {
    request.query = route.request.query;
  }
  if (route.request.body) {
    request.body = {
      content: {
        "application/json": {
          schema: route.request.body,
        },
      },
      required: true,
    };
  }
  return request;
}

function openApiResponses(responses: readonly RouteResponse[]) {
  const documented: Record<
    number,
    {
      description: string;
      content: {
        "application/json": {
          schema: ZodType;
        };
      };
    }
  > = {};
  const grouped = new Map<number, RouteResponse[]>();
  for (const defined of responses) {
    grouped.set(defined.code, [...(grouped.get(defined.code) ?? []), defined]);
  }
  for (const [status, group] of grouped) {
    documented[status] = {
      description: group.map((defined) => defined.name).join(", "),
      content: {
        "application/json": {
          schema: group.length === 1 ? group[0].schema : unionSchema(group),
        },
      },
    };
  }
  if (Object.keys(documented).length === 0) {
    documented[200] = {
      description: "200",
      content: {
        "application/json": {
          schema: z.object({}),
        },
      },
    };
  }
  return documented;
}

function unionSchema(group: RouteResponse[]) {
  const schemas = group.map((defined) => defined.schema);
  return z.union(schemas as [ZodType, ZodType, ...ZodType[]]);
}
