import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { type ZodType, z } from "zod";
import type { RouteDefinition, RouteResponse } from "../route/define.ts";
import type { VersionDefinition } from "../versioning/define.ts";

const callMethods = ["get", "post", "put", "patch", "delete"] as const;

const batchResponse = z.object({
  results: z.array(
    z.object({
      status: z.number().int(),
      body: z.unknown().nullable(),
    }),
  ),
});

export function createOpenApiDocument(
  title: string,
  routes: readonly RouteDefinition[],
  server?: string | null,
  versions: readonly VersionDefinition[] = [],
  postOnly = false,
  batch = true,
) {
  const spec = new OpenAPIHono();
  if (batch && versions.length > 0) {
    const versionIds = versions.map((version) => version.id);
    spec.openapi(
      createRoute({
        method: "post",
        path: "/{version}/batch",
        tags: ["Batch"],
        summary: "Call several routes",
        description:
          "Runs each named route under this version token. Each result has the status and JSON body that call would return on its own. The version segment is a catalog id, a release date, latest, or current.",
        request: {
          params: z.object({
            version: z.string().meta({
              description:
                "A version token such as a catalog id, a release date, latest, or current.",
              examples: [versionIds[0]],
            }),
          }),
          body: {
            content: {
              "application/json": {
                schema: batchRequest(postOnly),
              },
            },
            required: true,
          },
        },
        responses: {
          207: {
            description: "Multi-Response",
            content: {
              "application/json": {
                schema: batchResponse,
              },
            },
          },
          400: {
            description: "The batch body is missing calls or names one badly",
            content: {
              "application/json": {
                schema: z.object({
                  code: z.literal(1003),
                  name: z.literal("InvalidRequest"),
                }),
              },
            },
          },
        },
      }),
      (c) => c.json({ results: [] }, 207) as never,
    );
  }
  for (const route of routes) {
    spec.openapi(
      createRoute({
        method: route.method,
        path: openApiPath(route.version, route.path),
        tags: [route.version],
        ...(route.name ? { summary: route.name } : {}),
        request: openApiRequest(route) as never,
        responses: openApiResponses(route.responses) as never,
      }),
      (c) => c.json({}, 200) as never,
    );
  }
  const tags = [
    ...(batch && versions.length > 0 ? [{ name: "Batch" }] : []),
    ...versions.map((version) => ({ name: version.id })),
  ];
  return spec.getOpenAPIDocument({
    openapi: "3.0.0",
    info: {
      title,
      version: "0.1.0",
    },
    ...(tags.length > 0 ? { tags } : {}),
    ...(server ? { servers: [{ url: server }] } : {}),
  });
}

function batchRequest(postOnly: boolean) {
  return z.object({
    requests: z
      .array(
        z.object({
          method: z.enum(postOnly ? ["post"] : callMethods),
          path: z.string().meta({
            description:
              "The route path, including :name where the route has parameters.",
          }),
          params: z.record(z.string(), z.unknown()).optional(),
          query: z.record(z.string(), z.unknown()).optional(),
          body: z.unknown().optional(),
        }),
      )
      .min(1)
      .max(25),
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
