import { customAlphabet } from "nanoid";

function urlSafeAlphabet() {
  let out = "";
  for (let index = 0; index < 10; index += 1) {
    out += String(index);
  }
  for (let index = 0; index < 26; index += 1) {
    out += String.fromCharCode(65 + index);
  }
  for (let index = 0; index < 26; index += 1) {
    out += String.fromCharCode(97 + index);
  }
  return out;
}

const alphabet = urlSafeAlphabet();
export const OBJECT_ID_BODY_LENGTH = 21;
const nanoid = customAlphabet(alphabet, OBJECT_ID_BODY_LENGTH);

const idPrefix = /^[a-z][a-z0-9]*$/;
const objectSegment = /^(?:v[0-9]+|[a-z][a-z0-9]*)$/;

export type ObjectRowMeta = {
  _id: string;
  _object: string;
  _tenant: string;
  _archived: false;
};

export type CreateObjectRowOptions = {
  tenant: string;
  idPrefix?: string;
};

export type ParsedObjectId = {
  prefix: string;
  body: string;
};

export class ObjectIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ObjectIdError";
  }
}

export function objectTypeFromRoute(version: number, routePath: string) {
  const segments = routePath.split("/").filter(Boolean);
  if (segments.length === 0) {
    throw new ObjectIdError(
      `route path must include at least one segment: ${routePath}`,
    );
  }
  if (!Number.isInteger(version) || version < 1) {
    throw new ObjectIdError(`invalid API version: ${version}`);
  }
  for (const segment of segments) {
    if (!idPrefix.test(segment)) {
      throw new ObjectIdError(
        `invalid route segment "${segment}" in ${routePath}`,
      );
    }
  }
  return [`v${version}`, ...segments].join(".");
}

export function idPrefixFromObjectType(objectType: string) {
  assertObjectType(objectType);
  const prefix = objectType.split(".").at(-1);
  if (!(prefix && idPrefix.test(prefix))) {
    throw new ObjectIdError(
      `cannot derive id prefix from object type: ${objectType}`,
    );
  }
  return prefix;
}

export function assertObjectType(objectType: string) {
  const segments = objectType.split(".");
  if (segments.length < 2) {
    throw new ObjectIdError(
      `object type must be route-derived (e.g. v2.core.users), got: ${objectType}`,
    );
  }
  for (const segment of segments) {
    if (!objectSegment.test(segment)) {
      throw new ObjectIdError(
        `invalid object type segment "${segment}" in ${objectType}`,
      );
    }
  }
  if (!/^v[0-9]+$/.test(segments[0] ?? "")) {
    throw new ObjectIdError(
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

function assertIdPrefix(prefix: string) {
  if (!idPrefix.test(prefix)) {
    throw new ObjectIdError(`invalid id prefix: ${prefix}`);
  }
}

export function createId(prefix: string) {
  assertIdPrefix(prefix);
  return `${prefix}_${nanoid()}`;
}

export function createObjectRow(
  objectType: string,
  options: CreateObjectRowOptions,
): ObjectRowMeta {
  assertObjectType(objectType);
  const prefix = options.idPrefix ?? idPrefixFromObjectType(objectType);
  assertIdPrefix(prefix);
  return {
    _id: createId(prefix),
    _object: objectType,
    _tenant: options.tenant,
    _archived: false,
  };
}

export function objectIdPattern(prefix: string) {
  assertIdPrefix(prefix);
  return new RegExp(`^${prefix}_[${alphabet}]{${OBJECT_ID_BODY_LENGTH}}$`);
}

export function isObjectId(value: string, prefix: string) {
  return objectIdPattern(prefix).test(value);
}

export function parseObjectId(value: string): ParsedObjectId | null {
  const separator = value.indexOf("_");
  if (separator <= 0 || separator === value.length - 1) {
    return null;
  }
  const prefix = value.slice(0, separator);
  const body = value.slice(separator + 1);
  if (!idPrefix.test(prefix)) {
    return null;
  }
  if (body.length !== OBJECT_ID_BODY_LENGTH) {
    return null;
  }
  if (![...body].every((character) => alphabet.includes(character))) {
    return null;
  }
  return { prefix, body };
}
