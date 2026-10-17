export function clientIp(request: Request): string | null {
  const value = request.headers.get("CF-Connecting-IP")?.trim();
  return value ? value : null;
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export default {
  fetch(request: Request): Response {
    if (request.method !== "GET") {
      return new Response("Method Not Allowed\n", {
        status: 405,
        headers: { allow: "GET" },
      });
    }

    const { pathname } = new URL(request.url);
    if (pathname !== "/" && pathname !== "/json") {
      return textResponse("Not Found\n", 404);
    }

    const ip = clientIp(request);
    if (ip === null) {
      return textResponse("Unable to determine client IP\n", 500);
    }

    if (pathname === "/json") {
      return Response.json({ ip }, { headers: { "cache-control": "no-store" } });
    }

    return textResponse(`${ip}\n`);
  },
} satisfies ExportedHandler<Env>;
