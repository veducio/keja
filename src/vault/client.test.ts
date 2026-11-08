import { describe, expect, it } from "vitest";
import { createVault, VaultError } from "./client.ts";

describe("createVault", () => {
  it("reads a KV v2 secret and returns its data", async () => {
    const calls: {
      url: string;
      token: string | null;
      namespace: string | null;
    }[] = [];
    const client = createVault({
      address: "https://vault.example/",
      token: "s.token",
      namespace: "apps",
      fetch: async (url, init) => {
        const headers = new Headers(init?.headers);
        calls.push({
          url,
          token: headers.get("X-Vault-Token"),
          namespace: headers.get("X-Vault-Namespace"),
        });
        return Response.json({
          data: {
            data: { password: "secret" },
            metadata: { version: 3 },
          },
        });
      },
    });
    await expect(client.secret("apps/keja")).resolves.toEqual({
      password: "secret",
    });
    expect(calls).toEqual([
      {
        url: "https://vault.example/v1/secret/data/apps/keja",
        token: "s.token",
        namespace: "apps",
      },
    ]);
  });

  it("reports a missing secret without the token", async () => {
    const client = createVault({
      address: "https://vault.example",
      token: "s.token",
      mount: "kv",
      fetch: async () =>
        Response.json({ errors: ["permission denied"] }, { status: 403 }),
    });
    await expect(client.secret("apps/keja")).rejects.toThrow(
      "Vault rejected kv/apps/keja with status 403: permission denied",
    );
    await expect(
      createVault({
        address: "https://vault.example",
        token: "s.token",
        fetch: async () => new Response(null, { status: 404 }),
      }).secret("missing"),
    ).rejects.toThrow(VaultError);
  });

  it("requires an address and a token", () => {
    expect(() => createVault({ token: "s.token" })).toThrow(
      "VAULT_ADDR is required",
    );
    expect(() => createVault({ address: "https://vault.example" })).toThrow(
      "VAULT_TOKEN is required",
    );
  });
});
