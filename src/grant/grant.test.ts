import { decodeJwt, decodeProtectedHeader } from "jose";
import { afterEach, describe, expect, it } from "vitest";
import { connectVault, setVault } from "../vault/client.ts";
import { grant, verifyGrant } from "./grant.ts";
import { setGrants } from "./settings.ts";

afterEach(() => {
  setVault(null);
  setGrants(null);
});

describe("grant", () => {
  it("signs with a secret from grants config", async () => {
    setGrants({
      mode: "secret",
      max_exp: 900,
      secret: "test-secret",
    });
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
        alg: "HS256",
        typ: "JWT",
      });
      expect(decodeJwt(token)).toMatchObject({
        sub: "tenant_01h455vb4pex5vsknk084sn02q",
        action: "posts.read",
        iat: 1_700_000_000,
        exp: 1_700_000_060,
        context: { postId: "posts_01h455vb4pex5vsknk084sn02q" },
      });
      await expect(
        verifyGrant(token, { action: "posts.read" }),
      ).resolves.toEqual({
        subject: "tenant_01h455vb4pex5vsknk084sn02q",
        action: "posts.read",
        context: { postId: "posts_01h455vb4pex5vsknk084sn02q" },
      });
    } finally {
      Date.now = clock;
    }
  });

  it("signs a subject, action, expiry, and context with the transit key", async () => {
    const calls: { url: string; body: unknown }[] = [];
    await connectVault(
      {
        address: "https://vault.example",
        token: "s.token",
        namespace: "apps",
        mount: "secret",
      },
      async (url, init) => {
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        calls.push({ url, body });
        if (url.endsWith("/v1/auth/token/lookup-self")) {
          return Response.json({ data: { id: "s.token" } });
        }
        if (url.endsWith("/keys/keja-grants")) {
          return Response.json({
            data: { type: "ecdsa-p256", latest_version: 1 },
          });
        }
        if (url.endsWith("/sign/keja-grants")) {
          return Response.json({
            data: {
              signature: `vault:v1:${Buffer.from("signed").toString("base64")}`,
            },
          });
        }
        return Response.json({ data: { valid: true } });
      },
    );
    setGrants({
      mode: "transit",
      max_exp: 900,
      transit_key: "keja-grants",
      transit_mount: "transit",
    });
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
    } finally {
      Date.now = clock;
    }
  });

  it("rejects a lifetime past the configured maximum", async () => {
    setGrants({
      mode: "secret",
      max_exp: 900,
      secret: "test-secret",
    });
    await expect(
      grant({ subject: "tenant", action: "posts.read", exp: 901 }),
    ).rejects.toThrow("grant exp must be at most 900 seconds");
  });

  it("requires grants to be enabled", async () => {
    await expect(
      grant({ subject: "tenant", action: "posts.read", exp: 60 }),
    ).rejects.toThrow("grant requires grants");
  });

  it("rejects a signature Vault does not accept", async () => {
    await connectVault(
      {
        address: "https://vault.example",
        token: "s.token",
        namespace: null,
        mount: "secret",
      },
      async (url) => {
        if (url.endsWith("/v1/auth/token/lookup-self")) {
          return Response.json({ data: { id: "s.token" } });
        }
        if (url.endsWith("/keys/keja-grants")) {
          return Response.json({
            data: { type: "rsa-2048", latest_version: 1 },
          });
        }
        if (url.endsWith("/sign/keja-grants")) {
          return Response.json({
            data: {
              signature: `vault:v1:${Buffer.from("signed").toString("base64")}`,
            },
          });
        }
        return Response.json({ data: { valid: false } });
      },
    );
    setGrants({
      mode: "transit",
      max_exp: 900,
      transit_key: "keja-grants",
      transit_mount: "transit",
    });
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
});
