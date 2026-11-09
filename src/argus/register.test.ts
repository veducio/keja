import { describe, expect, it } from "vitest";
import { defineConfig } from "../project/config.ts";
import { argusRegistrations, publishArgus } from "./register.ts";

const identity = {
  name: "billing",
  public: ["http://192.168.1.10:3000", "http://100.96.0.5:3000"],
  service: ["http://192.168.1.10:3001", "http://100.96.0.5:3001"],
};

describe("argusRegistrations", () => {
  it("registers every reachable address for both surfaces", () => {
    const argus = defineConfig({
      argus: {
        enabled: true,
        url: "https://argus.veducio.com",
        env: "staging",
        username: "argus",
        password: "secret",
      },
    }).argus;
    if (!argus.enabled) {
      throw new Error("missing argus config");
    }
    const registrations = argusRegistrations({
      identity,
      argus,
      version: "0.1.0",
    });
    expect(
      registrations.map((item) => [
        item.service,
        item.base_url,
        item.instance_id,
      ]),
    ).toEqual([
      ["billing", "http://192.168.1.10:3000", "billing-192-168-1-10-3000"],
      ["billing", "http://100.96.0.5:3000", "billing-100-96-0-5-3000"],
      [
        "billing-service",
        "http://192.168.1.10:3001",
        "billing-service-192-168-1-10-3001",
      ],
      [
        "billing-service",
        "http://100.96.0.5:3001",
        "billing-service-100-96-0-5-3001",
      ],
    ]);
    expect(registrations[0]).toMatchObject({
      env: "staging",
      version: "0.1.0",
      ttl_seconds: 30,
      metadata: {
        surface: "public",
        public: identity.public,
        service: identity.service,
      },
    });
  });

  it("sends a basic-auth heartbeat to the registry", async () => {
    const calls: {
      url: string;
      authorization: string | null;
      body: unknown;
    }[] = [];
    const errors = await publishArgus({
      url: "https://argus.veducio.com/",
      username: "argus",
      password: "secret",
      registrations: [
        {
          instance_id: "billing-192-168-1-10-3000",
          service: "billing",
          env: "staging",
          base_url: "http://192.168.1.10:3000",
          weight: 100,
          status: "healthy",
          ttl_seconds: 30,
          metadata: {
            surface: "public",
            public: identity.public,
            service: identity.service,
          },
        },
      ],
      fetchImpl: async (url, init) => {
        const headers = new Headers(init?.headers);
        calls.push({
          url: String(url),
          authorization: headers.get("authorization"),
          body: JSON.parse(String(init?.body)),
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });
    expect(errors).toEqual([]);
    expect(calls).toEqual([
      {
        url: "https://argus.veducio.com/v1/register",
        authorization: `Basic ${Buffer.from("argus:secret").toString("base64")}`,
        body: {
          instance_id: "billing-192-168-1-10-3000",
          service: "billing",
          env: "staging",
          base_url: "http://192.168.1.10:3000",
          weight: 100,
          status: "healthy",
          ttl_seconds: 30,
          metadata: {
            surface: "public",
            public: identity.public,
            service: identity.service,
          },
        },
      },
    ]);
  });
});
