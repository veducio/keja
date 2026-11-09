import { afterEach, describe, expect, it } from "vitest";
import type { ArgusSettings } from "../project/config.ts";
import { callService, ServiceCallError, setArgus } from "./call.ts";

const argus: ArgusSettings = {
  url: "https://argus.example",
  env: "staging",
  username: "argus",
  password: "secret",
  public: null,
  service: null,
};

describe("callService", () => {
  afterEach(() => {
    setArgus(null);
  });

  it("discovers a healthy instance and posts the body", async () => {
    setArgus(argus);
    const calls: {
      url: string;
      method?: string;
      authorization: string | null;
      body?: string;
    }[] = [];
    const result = await callService(
      "billing-service",
      "v1/invoices",
      { amount: 10 },
      {
        random: () => 0.9,
        fetchImpl: async (url, init) => {
          calls.push({
            url,
            method: init?.method,
            authorization: init?.headers?.get("authorization") ?? null,
            body: init?.body,
          });
          if (url.includes("/v1/services/")) {
            return Response.json({
              instances: [
                {
                  base_url: "http://10.0.0.4:3001",
                  weight: 1,
                  status: "healthy",
                },
                {
                  base_url: "http://10.0.0.5:3001",
                  weight: 3,
                  status: "healthy",
                },
                {
                  base_url: "http://10.0.0.9:3001",
                  weight: 100,
                  status: "unhealthy",
                },
              ],
            });
          }
          return Response.json({ id: "inv_1" });
        },
      },
    );
    expect(result).toEqual({ id: "inv_1" });
    expect(calls).toEqual([
      {
        url: "https://argus.example/v1/services/billing-service?env=staging",
        method: undefined,
        authorization: `Basic ${Buffer.from("argus:secret").toString("base64")}`,
        body: undefined,
      },
      {
        url: "http://10.0.0.5:3001/v1/invoices",
        method: "POST",
        authorization: null,
        body: JSON.stringify({ amount: 10 }),
      },
    ]);
  });

  it("requires an active Argus config and a registered instance", async () => {
    await expect(callService("billing", "/v1/invoices", {})).rejects.toThrow(
      "service call requires argus",
    );
    setArgus(argus);
    await expect(
      callService(
        "billing",
        "/v1/invoices",
        {},
        {
          fetchImpl: async () => Response.json({ instances: [] }),
        },
      ),
    ).rejects.toBeInstanceOf(ServiceCallError);
  });
});
