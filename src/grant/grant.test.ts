import { decodeJwt, decodeProtectedHeader } from "jose";
import { afterEach, describe, expect, it } from "vitest";
import { connectVault, setVault, VaultError } from "../vault/client.ts";
import { grant, verifyGrant } from "./grant.ts";

const settings = {
  address: "https://vault.example",
  token: "s.token",
  namespace: "apps" as string | null,
  mount: "secret",
  transit_key: "keja-grants" as string | null,
  transit_mount: "transit",
  grant_max_exp: 900,
};

afterEach(() => {
  setVault(null);
});

describe("grant", () => {
  it("signs a subject, action, expiry, and context with the transit key", async () => {
    const calls: { url: string; body: unknown }[] = [];
    await connect(calls, { type: "ecdsa-p256", valid: true });
    const now = 1_700_000_000_000;
    const clock = Date.now;
    Date.now = () => now;
    try {
      const token = await grant({
        subject: "tenant_01h455vb4pex5vsknk084sn02q",
        action: "posts.read",
        exp: 60,
        context: { postId: "posts_01h455vb4pex5vsknk084sn02q" },
      });
      expect(decodeProtectedHeader(token)).toEqual({
        alg: "ES256",
        typ: "JWT",
        kid: "1",
      });
      expect(decodeJwt(token)).toMatchObject({
        sub: "tenant_01h455vb4pex5vsknk084sn02q",
        action: "posts.read",
        iat: 1_700_000_000,
        exp: 1_700_000_060,
        context: { postId: "posts_01h455vb4pex5vsknk084sn02q" },
      });
      const sign = calls.find((call) => call.url.endsWith("/sign/keja-grants"));
      expect(sign?.body).toMatchObject({
        hash_algorithm: "sha2-256",
        marshaling_algorithm: "jws",
      });
      await expect(
        verifyGrant(token, { action: "posts.read" }),
      ).resolves.toEqual({
        subject: "tenant_01h455vb4pex5vsknk084sn02q",
        action: "posts.read",
        context: { postId: "posts_01h455vb4pex5vsknk084sn02q" },
      });
      Date.now = () => now + 120_000;
      await expect(
        verifyGrant(token, { action: "posts.read" }),
      ).rejects.toThrow("grant is expired");
      Date.now = () => now;
      await expect(
        verifyGrant(token, { action: "posts.write" }),
      ).rejects.toThrow("grant action does not match");
    } finally {
      Date.now = clock;
    }
  });

  it("rejects a lifetime past the configured maximum", async () => {
    await connect([], { type: "rsa-2048", valid: true });
    await expect(
      grant({ subject: "tenant", action: "posts.read", exp: 901 }),
    ).rejects.toThrow("grant exp must be at most 900 seconds");
  });

  it("rejects a signature Vault does not accept", async () => {
    await connect([], { type: "rsa-2048", valid: false });
    const now = Date.now;
    Date.now = () => 1_700_000_000_000;
    try {
      const token = await grant({
        subject: "tenant",
        action: "posts.read",
        exp: 60,
      });
      await expect(
        verifyGrant(token, { action: "posts.read" }),
      ).rejects.toThrow("grant signature was rejected");
    } finally {
      Date.now = now;
    }
  });

  it("requires vault and a transit key", async () => {
    await expect(
      grant({ subject: "tenant", action: "posts.read", exp: 60 }),
    ).rejects.toThrow("grant requires vault");
    await connect([], { type: "rsa-2048", valid: true });
    setVault({ ...settings, transit_key: null });
    await expect(
      grant({ subject: "tenant", action: "posts.read", exp: 60 }),
    ).rejects.toBeInstanceOf(VaultError);
  });
});

async function connect(
  calls: { url: string; body: unknown }[],
  result: { type: string; valid: boolean },
) {
  await connectVault(settings, async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body });
    if (url.endsWith("/v1/auth/token/lookup-self")) {
      return Response.json({ data: { id: "s.token" } });
    }
    if (url.endsWith("/keys/keja-grants")) {
      return Response.json({ data: { type: result.type, latest_version: 1 } });
    }
    if (url.endsWith("/sign/keja-grants")) {
      return Response.json({
        data: {
          signature: `vault:v1:${Buffer.from("signed").toString("base64")}`,
        },
      });
    }
    return Response.json({ data: { valid: result.valid } });
  });
}
