import { readFileSync } from "node:fs";
import path from "node:path";

export type NetworkAddress = {
  address: string;
  family: string | number;
  internal: boolean;
};

export type ServiceIdentity = {
  name: string;
  public: string[];
  service: string[];
};

export function serviceName(
  packageName: string | undefined,
  directoryName: string,
) {
  const trimmed = packageName?.trim() ?? "";
  if (!trimmed) {
    return directoryName;
  }
  const slash = trimmed.lastIndexOf("/");
  return slash === -1 ? trimmed : trimmed.slice(slash + 1);
}

export function readServiceName(root: string, configured: string | null) {
  if (configured) {
    return configured;
  }
  return serviceName(readPackage(root).name, path.basename(root));
}

export function readPackageVersion(root: string) {
  const version = readPackage(root).version?.trim();
  return version ? version : undefined;
}

export function accessibleHosts(
  bindHost: string,
  interfaces: Record<string, readonly NetworkAddress[] | undefined>,
) {
  const bind = bindHost.trim();
  if (bind !== "0.0.0.0" && bind !== "::" && bind !== "[::]") {
    return [bind];
  }
  const found: string[] = [];
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (!usableAddress(entry) || found.includes(entry.address)) {
        continue;
      }
      found.push(entry.address);
    }
  }
  const ipv4 = found.filter((address) => !address.includes(":"));
  const chosen = ipv4.length > 0 ? ipv4 : found;
  return chosen.length > 0 ? chosen : ["127.0.0.1"];
}

export function buildIdentity(input: {
  name: string;
  bindHost: string;
  publicPort: number;
  servicePort: number;
  interfaces: Record<string, readonly NetworkAddress[] | undefined>;
}): ServiceIdentity {
  const hosts = accessibleHosts(input.bindHost, input.interfaces);
  return {
    name: input.name,
    public: hosts.map((host) => endpoint(host, input.publicPort)),
    service: hosts.map((host) => endpoint(host, input.servicePort)),
  };
}

function usableAddress(entry: NetworkAddress) {
  if (entry.internal || entry.address.includes("%")) {
    return false;
  }
  if (
    entry.address.startsWith("169.254.") ||
    entry.address.startsWith("fe80:")
  ) {
    return false;
  }
  return (
    entry.family === 4 ||
    entry.family === "IPv4" ||
    entry.family === 6 ||
    entry.family === "IPv6"
  );
}

function endpoint(host: string, port: number) {
  const formatted =
    host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  return `http://${formatted}:${port}`;
}

function readPackage(root: string) {
  try {
    const parsed = JSON.parse(
      readFileSync(path.join(root, "package.json"), "utf8"),
    ) as {
      name?: unknown;
      version?: unknown;
    };
    return {
      name: typeof parsed.name === "string" ? parsed.name : undefined,
      version: typeof parsed.version === "string" ? parsed.version : undefined,
    };
  } catch {
    return { name: undefined, version: undefined };
  }
}
