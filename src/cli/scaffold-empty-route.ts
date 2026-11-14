import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { collectRouteFiles } from "../project/load.ts";

export function routePathFromFile(file: string) {
  const base = path.basename(file, ".ts");
  if (/^[A-Za-z0-9._~-]+$/.test(base)) {
    return `/${base}`;
  }
  return "/route";
}

export function emptyRouteSource(
  surface: "public" | "service",
  routePath: string,
) {
  const method = surface === "service" ? "post" : "get";
  return `import { defineRoute, response } from "@veducio/keja";
import { z } from "zod";

export default defineRoute({
  method: "${method}",
  path: "${routePath}",
  version: "v1",
  responses: {
    Ok: response({
      code: 200,
      json: z.object({ ok: z.literal(true) }),
    }),
  },
  handler: ({ respond }) => respond.Ok({ ok: true }),
});
`;
}

export async function scaffoldEmptyRouteFile(
  file: string,
  surface: "public" | "service",
) {
  if (!existsSync(file)) {
    return false;
  }
  const content = await readFile(file, "utf8");
  if (content.trim() !== "") {
    return false;
  }
  await writeFile(file, emptyRouteSource(surface, routePathFromFile(file)));
  return true;
}

export async function scaffoldEmptyRoutes(
  publicDir: string,
  serviceDir: string,
) {
  const written: string[] = [];
  for (const [surface, directory] of [
    ["public", publicDir],
    ["service", serviceDir],
  ] as const) {
    if (!existsSync(directory)) {
      continue;
    }
    for (const relative of await collectRouteFiles(directory)) {
      const file = path.join(directory, relative);
      if (await scaffoldEmptyRouteFile(file, surface)) {
        written.push(file);
      }
    }
  }
  return written;
}
