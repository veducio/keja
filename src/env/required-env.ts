export type EnvSource = {
  readonly [key: string]: string | undefined;
};

export type RequiredEnv = {
  host: string;
  httpPort: number;
  httpServicePort: number;
};

type EnvRequirement<Key extends keyof RequiredEnv> = {
  key: Key;
  name: string;
  validate(value: string | undefined): string | null;
  parse(value: string): RequiredEnv[Key];
};

function portValidator(name: string) {
  return (value: string | undefined): string | null => {
    if (typeof value !== "string" || !/^\d+$/.test(value)) {
      return `${name} must be an integer from 1 to 65535`;
    }
    const port = Number(value);
    if (port < 1 || port > 65535) {
      return `${name} must be an integer from 1 to 65535`;
    }
    return null;
  };
}

function portParser(value: string) {
  return Number(value);
}

export const requiredEnv: [
  EnvRequirement<"host">,
  EnvRequirement<"httpPort">,
  EnvRequirement<"httpServicePort">,
] = [
  {
    key: "host",
    name: "HOST",
    validate(value: string | undefined): string | null {
      if (typeof value !== "string" || value.trim() === "") {
        return "HOST is required";
      }
      return null;
    },
    parse(value: string): string {
      return value;
    },
  },
  {
    key: "httpPort",
    name: "HTTP_PORT",
    validate: portValidator("HTTP_PORT"),
    parse: portParser,
  },
  {
    key: "httpServicePort",
    name: "HTTP_SERVICE_PORT",
    validate: portValidator("HTTP_SERVICE_PORT"),
    parse: portParser,
  },
];

export function readRequiredEnv(env: EnvSource): RequiredEnv {
  return {
    host: requiredEnv[0].parse(env.HOST ?? ""),
    httpPort: requiredEnv[1].parse(env.HTTP_PORT ?? ""),
    httpServicePort: requiredEnv[2].parse(env.HTTP_SERVICE_PORT ?? ""),
  };
}

export const openApiServerEnv = [
  { key: "openapiServer", name: "OPENAPI_SERVER" },
  { key: "openapiServiceServer", name: "OPENAPI_SERVICE_SERVER" },
] as const;

export function validateOpenApiServer(
  name: string,
  value: string | undefined,
): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  try {
    const url = new URL(value.trim());
    if (url.protocol === "http:" || url.protocol === "https:") {
      return null;
    }
  } catch {
    return `${name} must be an absolute http or https URL`;
  }
  return `${name} must be an absolute http or https URL`;
}

export function readOpenApiServers(env: EnvSource): {
  openapiServer: string | null;
  openapiServiceServer: string | null;
} {
  return {
    openapiServer: readOpenApiServer("OPENAPI_SERVER", env.OPENAPI_SERVER),
    openapiServiceServer: readOpenApiServer(
      "OPENAPI_SERVICE_SERVER",
      env.OPENAPI_SERVICE_SERVER,
    ),
  };
}

function readOpenApiServer(name: string, value: string | undefined) {
  const error = validateOpenApiServer(name, value);
  if (error) {
    throw new Error(error);
  }
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  return value.trim();
}
