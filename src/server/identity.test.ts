import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  accessibleHosts,
  buildIdentity,
  readServiceName,
  serviceName,
} from "./identity.ts";

const lan = {
  Ethernet: [
    { address: "192.168.1.10", family: "IPv4", internal: false },
    { address: "fe80::1", family: "IPv6", internal: false },
    { address: "127.0.0.1", family: "IPv4", internal: true },
  ],
  Tailscale: [{ address: "100.96.0.5", family: "IPv4", internal: false }],
};

describe("service identity", () => {
  it("uses the package name without a scope", () => {
    expect(serviceName("@veducio/billing", "app")).toBe("billing");
    expect(serviceName(undefined, "notes")).toBe("notes");
  });

  it("prefers the configured name over package.json", () => {
    const root = mkdtempSync(path.join(tmpdir(), "keja-identity-"));
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "@veducio/billing" }),
    );
    expect(readServiceName(root, null)).toBe("billing");
    expect(readServiceName(root, "payments")).toBe("payments");
  });

  it("lists reachable addresses for both API surfaces", () => {
    expect(accessibleHosts("127.0.0.1", lan)).toEqual(["127.0.0.1"]);
    expect(accessibleHosts("0.0.0.0", lan)).toEqual([
      "192.168.1.10",
      "100.96.0.5",
    ]);
    expect(
      buildIdentity({
        name: "billing",
        bindHost: "0.0.0.0",
        publicPort: 3000,
        servicePort: 3001,
        interfaces: lan,
      }),
    ).toEqual({
      name: "billing",
      public: ["http://192.168.1.10:3000", "http://100.96.0.5:3000"],
      service: ["http://192.168.1.10:3001", "http://100.96.0.5:3001"],
    });
  });
});
