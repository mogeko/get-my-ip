import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { clientIp } from "../src/index";

const clientIpHeader = { "CF-Connecting-IP": "203.0.113.7" };

describe("clientIp", () => {
  it("reads the CF-Connecting-IP header", () => {
    const request = new Request("https://example.com", { headers: clientIpHeader });
    expect(clientIp(request)).toBe("203.0.113.7");
  });

  it("trims surrounding whitespace", () => {
    const request = new Request("https://example.com", {
      headers: { "CF-Connecting-IP": " 2001:db8::1 " },
    });
    expect(clientIp(request)).toBe("2001:db8::1");
  });

  it("returns null when the header is absent or empty", () => {
    expect(clientIp(new Request("https://example.com"))).toBeNull();
    expect(
      clientIp(new Request("https://example.com", { headers: { "CF-Connecting-IP": "  " } })),
    ).toBeNull();
  });
});

describe("GET /", () => {
  it("returns the client IP as plain text", async () => {
    const response = await SELF.fetch("https://example.com/", { headers: clientIpHeader });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("203.0.113.7\n");
  });
});

describe("GET /json", () => {
  it("returns the client IP as JSON", async () => {
    const response = await SELF.fetch("https://example.com/json", { headers: clientIpHeader });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ip: "203.0.113.7" });
  });
});

describe("error responses", () => {
  it("returns 500 when the client IP cannot be determined", async () => {
    const response = await SELF.fetch("https://example.com/");

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Unable to determine client IP\n");
  });

  it("returns 404 for unknown paths", async () => {
    const response = await SELF.fetch("https://example.com/unknown", {
      headers: clientIpHeader,
    });

    expect(response.status).toBe(404);
  });

  it("returns 405 for non-GET methods", async () => {
    const response = await SELF.fetch("https://example.com/", {
      method: "POST",
      headers: clientIpHeader,
    });

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });
});
