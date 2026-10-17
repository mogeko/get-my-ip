# get-my-ip

An API to get your public IP address, deployed on Cloudflare Workers.

## Endpoints

```bash
curl https://<your-worker-domain>/
# 203.0.113.7

curl https://<your-worker-domain>/json
# {"ip":"203.0.113.7"}
```

Responses use `cache-control: no-store`. Unknown paths return `404`, non-`GET` methods return `405`, and a missing `CF-Connecting-IP` header returns `500`.

## Development

Requires [Bun](https://bun.sh/) 1.4+.

```bash
bun install
bun run dev        # http://localhost:8787
bun run test       # Vitest with workerd
bun run typecheck
bun run check      # Biome format + lint
```

Local requests get `CF-Connecting-IP: ::1` from the runtime; override it to test other values:

```bash
curl -H 'CF-Connecting-IP: 198.51.100.9' http://localhost:8787/
```

## Deploy

```bash
bun run deploy
```

Run `bun run cf-typegen` after changing bindings in `wrangler.jsonc`.

## License

[MIT](./LICENSE)
