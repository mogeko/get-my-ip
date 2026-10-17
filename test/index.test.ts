import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker, { clientIp, toIpInfo } from "../src/index";

const clientIpHeader = { "CF-Connecting-IP": "203.0.113.7" };

const fullCf: Partial<IncomingRequestCfProperties> = {
  asn: 395747,
  asOrganization: "Google Cloud",
  colo: "DFW",
  country: "US",
  region: "Texas",
  regionCode: "TX",
  city: "Austin",
  postalCode: "78701",
  timezone: "America/Chicago",
  continent: "NA",
  latitude: "30.27130",
  longitude: "-97.74260",
};

const emptyIpInfo = {
  ip: "203.0.113.7",
  country: null,
  region: null,
  regionCode: null,
  city: null,
  postalCode: null,
  timezone: null,
  continent: null,
  latitude: null,
  longitude: null,
  asn: null,
  asOrganization: null,
  colo: null,
};

function expectCors(response: Response): void {
  expect(response.headers.get("access-control-allow-origin")).toBe("*");
  expect(response.headers.get("access-control-allow-methods")).toBe("GET, OPTIONS");
  expect(response.headers.get("cache-control")).toBe("no-store");
}

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

describe("toIpInfo", () => {
  it("maps every cf field", () => {
    expect(toIpInfo("203.0.113.7", fullCf)).toEqual({
      ip: "203.0.113.7",
      country: "US",
      region: "Texas",
      regionCode: "TX",
      city: "Austin",
      postalCode: "78701",
      timezone: "America/Chicago",
      continent: "NA",
      latitude: "30.27130",
      longitude: "-97.74260",
      asn: 395747,
      asOrganization: "Google Cloud",
      colo: "DFW",
    });
  });

  it("returns nulls when cf is missing", () => {
    expect(toIpInfo("203.0.113.7", undefined)).toEqual(emptyIpInfo);
  });

  it("normalises blank and invalid values", () => {
    expect(
      toIpInfo("203.0.113.7", {
        country: "US",
        region: "  ",
        city: "",
        asn: Number.NaN,
        colo: " DFW ",
      }),
    ).toEqual({
      ...emptyIpInfo,
      country: "US",
      colo: "DFW",
    });
  });
});

describe("GET /", () => {
  it("returns the client IP as plain text", async () => {
    const response = await SELF.fetch("https://example.com/", { headers: clientIpHeader });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toBe("203.0.113.7\n");
    expectCors(response);
  });
});

describe("GET /json", () => {
  it("returns the client IP and metadata as JSON", async () => {
    const request = new Request("https://example.com/json", {
      headers: clientIpHeader,
      cf: fullCf,
    }) as Request<unknown, IncomingRequestCfProperties>;

    const response = worker.fetch(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(await response.json()).toEqual({ ...fullCf, ip: "203.0.113.7" });
    expectCors(response);
  });

  it("returns null metadata when cf is unavailable", async () => {
    const response = await SELF.fetch("https://example.com/json", { headers: clientIpHeader });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(emptyIpInfo);
  });
});

describe("OPTIONS", () => {
  it("answers CORS preflight for /", async () => {
    const response = await SELF.fetch("https://example.com/", { method: "OPTIONS" });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("access-control-max-age")).toBe("86400");
    expectCors(response);
  });

  it("answers CORS preflight for /json", async () => {
    const response = await SELF.fetch("https://example.com/json", { method: "OPTIONS" });

    expect(response.status).toBe(204);
    expectCors(response);
  });
});

describe("error responses", () => {
  it("returns 500 when the client IP cannot be determined", async () => {
    const response = await SELF.fetch("https://example.com/");

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Unable to determine client IP\n");
    expectCors(response);
  });

  it("returns a JSON error when /json cannot determine the client IP", async () => {
    const response = await SELF.fetch("https://example.com/json");

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(await response.json()).toEqual({ error: "Unable to determine client IP" });
    expectCors(response);
  });

  it("returns 404 for unknown paths", async () => {
    const response = await SELF.fetch("https://example.com/unknown", {
      headers: clientIpHeader,
    });

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found\n");
    expectCors(response);
  });

  it("returns 405 for non-GET methods", async () => {
    const response = await SELF.fetch("https://example.com/", {
      method: "POST",
      headers: clientIpHeader,
    });

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, OPTIONS");
    expectCors(response);
  });

  it("returns a JSON error for non-GET methods on /json", async () => {
    const response = await SELF.fetch("https://example.com/json", {
      method: "POST",
      headers: clientIpHeader,
    });

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, OPTIONS");
    expect(await response.json()).toEqual({ error: "Method Not Allowed" });
    expectCors(response);
  });
});
