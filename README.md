# get-my-ip

[![Test](https://github.com/mogeko/get-my-ip/actions/workflows/test.yml/badge.svg)](https://github.com/mogeko/get-my-ip/actions/workflows/test.yml)
[![GitHub License](https://img.shields.io/github/license/mogeko/get-my-ip)](./LICENSE)

An API to get your public IP address, deployed on Cloudflare Workers.

## Endpoints

`GET /` returns the IP as plain text:

```bash
curl https://get-my-ip.mogeko.me/
# 203.0.113.7
```

`GET /json` returns the IP plus geographic and network metadata from `request.cf`:

```bash
curl https://get-my-ip.mogeko.me/json
```

```json
{
  "ip": "203.0.113.7",
  "country": "US",
  "region": "Texas",
  "regionCode": "TX",
  "city": "Austin",
  "postalCode": "78701",
  "timezone": "America/Chicago",
  "continent": "NA",
  "latitude": "30.27130",
  "longitude": "-97.74260",
  "asn": 395747,
  "asOrganization": "Google Cloud",
  "colo": "DFW"
}
```

All keys are always present. Fields Cloudflare cannot resolve are `null`; the API never fails because metadata is missing. The IP comes exclusively from `CF-Connecting-IP` and is never read from client-controlled headers.

## CORS

Every response carries `access-control-allow-origin: *`, `access-control-allow-methods: GET, OPTIONS`, and `cache-control: no-store`. `OPTIONS` preflight requests return `204` with `access-control-max-age: 86400`.

## Errors

| Status | When |
|---|---|
| `404` | Unknown path (plain text) |
| `405` | Method other than `GET`/`OPTIONS`; includes `allow: GET, OPTIONS` |
| `500` | `CF-Connecting-IP` is missing |

`GET /` errors are `text/plain`; `/json` errors are `application/json` such as `{"error":"Unable to determine client IP"}`.

## Development

Requires [Bun](https://bun.sh/) 1.4+.

```bash
bun install
bun run dev        # http://localhost:8787
bun run test       # Vitest with workerd
bun run typecheck
bun run lint       # Biome format + lint
bun run fmt        # Apply Biome fixes
```

Local requests get `CF-Connecting-IP: ::1` from the runtime; override it to test other values:

```bash
curl -H 'CF-Connecting-IP: 198.51.100.9' http://localhost:8787/
```

## License

[MIT](./LICENSE)
