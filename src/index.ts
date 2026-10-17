export interface IpInfo {
  ip: string;
  country: string | null;
  region: string | null;
  regionCode: string | null;
  city: string | null;
  postalCode: string | null;
  timezone: string | null;
  continent: string | null;
  latitude: string | null;
  longitude: string | null;
  asn: number | null;
  asOrganization: string | null;
  colo: string | null;
}

type IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-max-age": "86400",
} as const;

export function clientIp(request: Request): string | null {
  const value = request.headers.get("CF-Connecting-IP")?.trim();
  return value ? value : null;
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function toIpInfo(ip: string, cf: Partial<IncomingRequestCfProperties> | undefined): IpInfo {
  const asn = cf?.asn;
  return {
    ip,
    country: stringOrNull(cf?.country),
    region: stringOrNull(cf?.region),
    regionCode: stringOrNull(cf?.regionCode),
    city: stringOrNull(cf?.city),
    postalCode: stringOrNull(cf?.postalCode),
    timezone: stringOrNull(cf?.timezone),
    continent: stringOrNull(cf?.continent),
    latitude: stringOrNull(cf?.latitude),
    longitude: stringOrNull(cf?.longitude),
    asn: typeof asn === "number" && Number.isFinite(asn) ? asn : null,
    asOrganization: stringOrNull(cf?.asOrganization),
    colo: stringOrNull(cf?.colo),
  };
}

function baseHeaders(extra: Record<string, string> = {}): Headers {
  return new Headers({ ...corsHeaders, "cache-control": "no-store", ...extra });
}

function headers(contentType: string, extra: Record<string, string> = {}): Headers {
  const result = baseHeaders(extra);
  result.set("content-type", contentType);
  return result;
}

function textResponse(body: string, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: headers("text/plain; charset=utf-8", extra) });
}

function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: headers("application/json; charset=utf-8", extra),
  });
}

export default {
  fetch(request: IncomingRequest): Response {
    const { pathname } = new URL(request.url);
    const isJson = pathname === "/json";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: baseHeaders() });
    }

    if (request.method !== "GET") {
      return isJson
        ? jsonResponse({ error: "Method Not Allowed" }, 405, { allow: "GET, OPTIONS" })
        : textResponse("Method Not Allowed\n", 405, { allow: "GET, OPTIONS" });
    }

    if (pathname !== "/" && !isJson) {
      return textResponse("Not Found\n", 404);
    }

    const ip = clientIp(request);
    if (ip === null) {
      return isJson
        ? jsonResponse({ error: "Unable to determine client IP" }, 500)
        : textResponse("Unable to determine client IP\n", 500);
    }

    return isJson ? jsonResponse(toIpInfo(ip, request.cf)) : textResponse(`${ip}\n`);
  },
} satisfies ExportedHandler<Env>;
