import { describe, expect, it } from "vitest";
import {
  readOpenApiServers,
  readRequiredEnv,
  requiredEnv,
  validateOpenApiServer,
} from "./required-env.ts";

describe("requiredEnv", () => {
  it("accepts a usable host and ports", () => {
    expect(
      readRequiredEnv({
        HOST: "127.0.0.1",
        HTTP_PORT: "3000",
        HTTP_SERVICE_PORT: "3001",
      }),
    ).toEqual({
      host: "127.0.0.1",
      httpPort: 3000,
      httpServicePort: 3001,
    });
  });

  it("rejects a blank host and an out of range port", () => {
    expect(requiredEnv[0].validate(" ")).toBe("HOST is required");
    expect(requiredEnv[1].validate("70000")).toBe(
      "HTTP_PORT must be an integer from 1 to 65535",
    );
    expect(requiredEnv[2].validate("0")).toBe(
      "HTTP_SERVICE_PORT must be an integer from 1 to 65535",
    );
  });

  it("reads optional openapi servers and rejects a bad url", () => {
    expect(validateOpenApiServer("OPENAPI_SERVER", undefined)).toBeNull();
    expect(validateOpenApiServer("OPENAPI_SERVER", " ")).toBeNull();
    expect(
      readOpenApiServers({
        OPENAPI_SERVER: "http://127.0.0.1:3500",
        OPENAPI_SERVICE_SERVER: "https://service.example/api",
      }),
    ).toEqual({
      openapiServer: "http://127.0.0.1:3500",
      openapiServiceServer: "https://service.example/api",
    });
    expect(validateOpenApiServer("OPENAPI_SERVER", "notaurl")).toBe(
      "OPENAPI_SERVER must be an absolute http or https URL",
    );
    expect(() =>
      readOpenApiServers({ OPENAPI_SERVICE_SERVER: "ftp://files.example" }),
    ).toThrow("OPENAPI_SERVICE_SERVER must be an absolute http or https URL");
  });

  it("defines a validator for every required variable", () => {
    expect(requiredEnv.map((requirement) => requirement.name)).toEqual([
      "HOST",
      "HTTP_PORT",
      "HTTP_SERVICE_PORT",
    ]);
    for (const requirement of requiredEnv) {
      expect(typeof requirement.validate).toBe("function");
    }
  });
});
