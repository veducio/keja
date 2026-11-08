import type { RouteDefinition } from "../route/define.ts";
import {
  isAfterVersion,
  type VersionDefinition,
} from "../versioning/define.ts";

export function matchPath(pattern: string, pathname: string) {
  const expected = segments(pattern);
  const actual = segments(pathname);
  if (expected.length !== actual.length) {
    return null;
  }
  const params: Record<string, string> = {};
  for (const [index, part] of expected.entries()) {
    const value = actual[index] ?? "";
    if (part.startsWith(":")) {
      params[part.slice(1)] = decodeURIComponent(value);
      continue;
    }
    if (part !== value) {
      return null;
    }
  }
  return params;
}

export function selectRoute(
  routes: readonly RouteDefinition[],
  versions: readonly VersionDefinition[],
  method: string,
  pathname: string,
  requested: VersionDefinition,
) {
  const matches = [];
  for (const route of routes) {
    if (route.method !== method.toLowerCase()) {
      continue;
    }
    const params = matchPath(route.path, pathname);
    if (!params) {
      continue;
    }
    const version = versions.find((item) => item.id === route.version);
    if (!version || isAfterVersion(version, requested)) {
      continue;
    }
    matches.push({ route, params, version });
  }
  matches.sort((left, right) => {
    if (left.version.releasedAt !== right.version.releasedAt) {
      return right.version.releasedAt - left.version.releasedAt;
    }
    return right.version.number - left.version.number;
  });
  return matches[0] ?? null;
}

function segments(value: string) {
  const normalized =
    value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;
  return normalized.split("/").filter((part) => part.length > 0);
}
