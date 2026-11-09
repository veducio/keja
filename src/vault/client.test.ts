import { afterEach, describe, expect, it } from "vitest";
import {
  connectVault,
  createVault,
  setVault,
  VaultError,
  vaultSecret,
} from "./client.ts";

describe("createVault", () => {
  afterEach(() => {
    setVault(null);
  });
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

  it("looks up the token before vaultSecret uses the config client", async () => {
    const urls: string[] = [];
    await connectVault(
      {
        address: "https://vault.example",
        token: "s.token",
        namespace: null,
        mount: "secret",
        transit_key: null,
        transit_mount: "transit",
        grant_max_exp: 900,
      },
      async (url) => {
        urls.push(url);
        if (url.endsWith("/v1/auth/token/lookup-self")) {
          return Response.json({ data: { id: "s.token" } });
        }
        return Response.json({ data: { data: { password: "secret" } } });
      },
    );
    await expect(vaultSecret("apps/keja")).resolves.toEqual({
      password: "secret",
    });
    expect(urls[0]).toBe("https://vault.example/v1/auth/token/lookup-self");
  });

  it("turns a rejected token lookup into a project error", async () => {
    await expect(
      connectVault(
        {
          address: "https://vault.example",
          token: "s.token",
          namespace: null,
          mount: "secret",
          transit_key: null,
          transit_mount: "transit",
          grant_max_exp: 900,
        },
        async () =>
          Response.json({ errors: ["permission denied"] }, { status: 403 }),
      ),
    ).rejects.toThrow(
      "Vault rejected auth/token/lookup-self with status 403: permission denied",
    );
    expect(() => vaultSecret("apps/keja")).toThrow(
      "vaultSecret requires vault",
    );
  });
});
