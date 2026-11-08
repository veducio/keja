import { projectError } from "../errors/framework-errors.ts";

export type VersionDefinition = {
  id: string;
  number: number;
  releasedAt: number;
};

const versionKey = /^v(0|[1-9]\d*)$/;
const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/;
const dayMonthYear = /^(\d{2})-(\d{2})-(\d{4})$/;

export function parseReleasedAt(value: string | number): number | null {
  if (typeof value === "number") {
    return unixMilliseconds(value);
  }
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    return unixMilliseconds(Number(text));
  }
  const iso = isoDate.exec(text);
  if (iso) {
    return calendarUtc(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  const dmy = dayMonthYear.exec(text);
  if (dmy) {
    return calendarUtc(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  }
  return null;
}

type WholeNumber<Value extends string> = Value extends `${bigint}`
  ? Value extends `-${string}` | `0${string}`
    ? Value extends "0"
      ? Value
      : never
    : Value
  : never;

export type VersionId<Value extends string> = Value extends `v${infer Rest}`
  ? WholeNumber<Rest> extends never
    ? never
    : Value
  : never;

type VersionRecord = Record<string, { releasedAt: string | number }>;

type CheckedVersions<Versions extends VersionRecord> = {
  [Key in keyof Versions]: Key extends string
    ? VersionId<Key> extends never
      ? "Version must use the form v1, v2, v3"
      : Versions[Key]
    : never;
};

export function readVersionNumber(id: string): number | null {
  const match = versionKey.exec(id);
  if (!match) {
    return null;
  }
  const number = Number(match[1]);
  if (!Number.isSafeInteger(number) || String(number) !== match[1]) {
    return null;
  }
  return number;
}

export function defineVersions<const Versions extends VersionRecord>(
  versions: Versions & CheckedVersions<Versions>,
) {
  const parsed = Object.entries(versions).map(([id, version]) => {
    const number = readVersionNumber(id);
    if (number === null) {
      throw projectError(
        "invalidVersionId",
        `Version ${id} must use the form v1, v2, v3`,
      );
    }
    const releasedAt = parseReleasedAt(version.releasedAt);
    if (releasedAt === null) {
      throw projectError(
        "invalidReleaseDate",
        `Version ${id} has an invalid release date`,
      );
    }
    return {
      id,
      number,
      releasedAt,
    };
  });
  return {
    versions: parsed.sort(compareVersions),
  };
}

export function isVersions(
  value: unknown,
): value is { versions: VersionDefinition[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "versions" in value &&
    Array.isArray(value.versions)
  );
}

export function newestVersion(versions: readonly VersionDefinition[]) {
  return [...versions].sort(compareVersions).at(-1) ?? null;
}

export function resolveVersionToken(
  token: string,
  versions: readonly VersionDefinition[],
) {
  if (versions.length === 0) {
    return null;
  }
  const keyword = token.toLowerCase();
  if (keyword === "latest" || keyword === "current") {
    return newestVersion(versions);
  }
  if (versionKey.test(token)) {
    return versions.find((version) => version.id === token) ?? null;
  }
  const releasedAt = parseReleasedAt(token);
  if (releasedAt === null) {
    return null;
  }
  const eligible = versions.filter(
    (version) => version.releasedAt <= releasedAt,
  );
  return newestVersion(eligible);
}

export function isAfterVersion(
  candidate: VersionDefinition,
  requested: VersionDefinition,
) {
  if (candidate.releasedAt !== requested.releasedAt) {
    return candidate.releasedAt > requested.releasedAt;
  }
  return candidate.number > requested.number;
}

function unixMilliseconds(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return value >= 1_000_000_000_000 ? value : value * 1000;
}

function calendarUtc(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.getTime();
}

function compareVersions(left: VersionDefinition, right: VersionDefinition) {
  if (left.releasedAt !== right.releasedAt) {
    return left.releasedAt - right.releasedAt;
  }
  return left.number - right.number;
}
