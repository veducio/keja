import { fromString, getSuffix, getType, typeid } from "typeid-js";

const typePrefix = /^[a-z](?:[a-z_]{0,61}[a-z])?$/;
const objectSegment = /^(?:v[0-9]+|[a-z](?:[a-z_]{0,61}[a-z])?)$/;

export type ObjectRowMeta = {
  _id: string;
  _object: string;
  _tenant: string;
  _archived: false;
  _createdAt: Date;
  _updatedAt: Date;
};

export type CreateObjectRowOptions = {
  tenant: string;
  idPrefix?: string;
};

export type ParsedTypeId = {
  prefix: string;
  suffix: string;
};

export class TypeIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TypeIdError";
  }
}

export function objectTypeFromRoute(version: number, routePath: string) {
  const segments = routePath.split("/").filter(Boolean);
  if (segments.length === 0) {
    throw new TypeIdError(
      `route path must include at least one segment: ${routePath}`,
    );
  }
  if (!Number.isInteger(version) || version < 1) {
    throw new TypeIdError(`invalid API version: ${version}`);
  }
  for (const segment of segments) {
    if (!typePrefix.test(segment)) {
      throw new TypeIdError(
        `invalid route segment "${segment}" in ${routePath}`,
      );
    }
  }
  return [`v${version}`, ...segments].join(".");
}

export function idPrefixFromObjectType(objectType: string) {
  assertObjectType(objectType);
  const prefix = objectType.split(".").at(-1);
  if (!(prefix && typePrefix.test(prefix))) {
    throw new TypeIdError(
      `cannot derive type prefix from object type: ${objectType}`,
    );
  }
  return prefix;
}

export function assertObjectType(objectType: string) {
  const segments = objectType.split(".");
  if (segments.length < 2) {
    throw new TypeIdError(
      `object type must be route-derived (e.g. v2.core.users), got: ${objectType}`,
    );
  }
  for (const segment of segments) {
    if (!objectSegment.test(segment)) {
      throw new TypeIdError(
        `invalid object type segment "${segment}" in ${objectType}`,
      );
    }
  }
  if (!/^v[0-9]+$/.test(segments[0] ?? "")) {
    throw new TypeIdError(
      `object type must start with vN (e.g. v2.core.users), got: ${objectType}`,
    );
  }
}

export function isObjectType(objectType: string) {
  try {
    assertObjectType(objectType);
    return true;
  } catch {
    return false;
  }
}

export function createTypeId(prefix: string) {
  assertTypePrefix(prefix);
  return typeid(prefix).toString();
}

export function isTypeId(value: string, prefix: string) {
  return parseTypeId(value)?.prefix === prefix;
}

export function parseTypeId(value: string): ParsedTypeId | null {
  try {
    const parsed = fromString(value);
    const prefix = getType(parsed);
    if (!typePrefix.test(prefix)) {
      return null;
    }
    return { prefix, suffix: getSuffix(parsed) };
  } catch {
    return null;
  }
}

export function createObjectRow(
  objectType: string,
  options: CreateObjectRowOptions,
): ObjectRowMeta {
  assertObjectType(objectType);
  const prefix = options.idPrefix ?? idPrefixFromObjectType(objectType);
  const now = new Date();
  return {
    _id: createTypeId(prefix),
    _object: objectType,
    _tenant: options.tenant,
    _archived: false,
    _createdAt: now,
    _updatedAt: now,
  };
}

function assertTypePrefix(prefix: string) {
  if (!typePrefix.test(prefix)) {
    throw new TypeIdError(`invalid type prefix: ${prefix}`);
  }
}
