import { generateKeyPair, SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { frameworkErrors } from "../errors/framework-errors.ts";
import {
  accessToken,
  cloudflareAccess,
  verifyAccessJwt,
} from "./cloudflare.ts";

const issuer = "https://veducio.cloudflareaccess.com";
const audience = "app-aud";

describe("accessToken", () => {
  it("reads the assertion header before the cookie", () => {
    const request = new Request("https://app.test", {
      headers: {
        "Cf-Access-Jwt-Assertion": "header-token",
        cookie: "CF_Authorization=cookie-token",
      },
    });
    expect(accessToken(request)).toBe("header-token");
    expect(
      accessToken(
        new Request("https://app.test", {
          headers: { cookie: "theme=light; CF_Authorization=cookie-token" },
        }),
      ),
    ).toBe("cookie-token");
  });
});

describe("verifyAccessJwt", () => {
  it("accepts a token signed for the team audience", async () => {
    const { publicKey, privateKey } = await generateKeyPair("ES256");
    const token = await new SignJWT({
      email: "ada@veducio.com",
      country: "PL",
    })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject("ada")
      .setIssuedAt()
      .setExpirationTime("2m")
      .sign(privateKey);

    await expect(
      verifyAccessJwt(token, {
        team: "veducio.cloudflareaccess.com",
        audience,
        getKey: async () => publicKey,
      }),
    ).resolves.toMatchObject({
      sub: "ada",
      iss: issuer,
      aud: [audience],
      email: "ada@veducio.com",
      country: "PL",
    });
  });

  it("rejects a token for a different audience", async () => {
    const { publicKey, privateKey } = await generateKeyPair("ES256");
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer(issuer)
      .setAudience("other-app")
      .setSubject("ada")
      .setIssuedAt()
      .setExpirationTime("2m")
      .sign(privateKey);

    await expect(
      verifyAccessJwt(token, {
        team: issuer,
        audience,
        getKey: async () => publicKey,
      }),
    ).rejects.toThrow("Cloudflare Access token was rejected");
  });
});

describe("cloudflareAccess", () => {
  it("passes the identity to the route and denies a missing token", async () => {
    const { publicKey, privateKey } = await generateKeyPair("ES256");
    const token = await new SignJWT({ email: "ada@veducio.com" })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject("ada")
      .setIssuedAt()
      .setExpirationTime("2m")
      .sign(privateKey);
    const middleware = cloudflareAccess({
      team: issuer,
      audience,
      getKey: async () => publicKey,
    });
    const accepted = await middleware.handle({
      request: new Request("https://app.test/v1/jobs", {
        headers: { "Cf-Access-Jwt-Assertion": token },
      }),
      version: "v1",
      params: {},
      next: async (fields) => Response.json(fields ?? null),
    });
    expect(accepted.status).toBe(200);
    await expect(accepted.json()).resolves.toMatchObject({
      access: { email: "ada@veducio.com", sub: "ada" },
    });

    const denied = await middleware.handle({
      request: new Request("https://app.test/v1/jobs"),
      version: "v1",
      params: {},
      next: async () => Response.json({ ok: true }),
    });
    expect(denied.status).toBe(401);
    await expect(denied.json()).resolves.toMatchObject(
      frameworkErrors.accessDenied,
    );
  });

  it("requires a team domain and audience tag", () => {
    delete process.env.CF_ACCESS_TEAM_DOMAIN;
    delete process.env.CF_ACCESS_AUD;
    expect(() => cloudflareAccess()).toThrow(
      "Missing CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD",
    );
  });
});
