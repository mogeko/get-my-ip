# Agent Guide for get-my-ip

## Repository state

An API that returns the caller's public IP address plus geographic/network metadata (see [README.md](./README.md)). The Worker is scaffolded with a test suite; there are no bindings, linter plugins beyond Biome's recommended preset, or CI workflows yet.

Default branch is `master`; active development happens on `dev`.

## Stack

- **Cloudflare Workers** (ES modules) configured in `wrangler.jsonc`; entry point `src/index.ts` with a default-exported `fetch` handler.
- **Bun 1.4** as the local package manager and script runner (`bun install`, `bun run <script>`). `bun.lock` is committed. Vitest itself still executes on Node via its CLI shebang.
- **Vitest 5** with `@cloudflare/vitest-plugin` (`cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })` in `vitest.config.mts`). Integration tests call `exports.default.fetch()` from `cloudflare:workers`; the `SELF` and `env` exports of `cloudflare:test` are deprecated.
- **Biome 2.5** for formatting and linting. `formatter.useEditorconfig` is `true`, so indentation, line endings, and final-newline behavior come from `.editorconfig`, which sets per-format rules (4 spaces, LF; Biome-formatted TS/JSON has no final newline, while Markdown and generated files keep one). Keep those out of `biome.json`; only `lineWidth`, quote style, and semicolon style are configured there.

## API contract

| Route | Response |
|---|---|
| `GET /` | `text/plain` with the IP plus trailing newline |
| `GET /json` | `application/json` with `ip`, geo fields (`country`, `region`, `regionCode`, `city`, `postalCode`, `timezone`, `continent`, `latitude`, `longitude`) and network fields (`asn`, `asOrganization`, `colo`) |
| `OPTIONS` (any path) | `204` with CORS preflight headers |
| any other path | `404` (plain text) |
| method other than `GET`/`OPTIONS` | `405` with `allow: GET, OPTIONS` |
| missing `CF-Connecting-IP` | `500` |

- `IpInfo` keys are always present; unresolvable metadata is `null`, so a missing `request.cf` never produces a 5xx.
- All responses include `access-control-allow-origin: *`, `access-control-allow-methods: GET, OPTIONS`, `access-control-max-age: 86400`, and `cache-control: no-store` — including errors, otherwise browsers hide them.
- Error bodies: `text/plain` on `/`, `application/json` (`{"error": "..."}`) on `/json`.
- The handler stays thin and delegates to the exported pure helpers `clientIp(request)` and `toIpInfo(ip, cf)` in `src/index.ts`.

## Commands

| Purpose | Command |
|---|---|
| Install dependencies | `bun install` |
| Local dev server (http://localhost:8787) | `bun run dev` |
| Deploy | `bun run deploy` |
| Create a Preview deployment (open beta) | `bunx wrangler preview` — requires the `previews` block in `wrangler.jsonc` |
| Regenerate binding/runtime types | `bun run cf-typegen` |
| Type check | `bun run typecheck` |
| Run all tests | `bun run test` |
| Watch tests | `bun run test:watch` |
| Run one test file | `bunx vitest run test/index.test.ts` |
| Run one test by name | `bunx vitest run test/index.test.ts -t "<test name>"` |
| Check format + lint | `bun run lint` |
| Apply Biome fixes | `bun run fmt` |

Run `bun run cf-typegen` after changing bindings in `wrangler.jsonc`. It regenerates `worker-configuration.d.ts` (including the global `Env` type), which is committed and excluded from Biome via `files.includes` — never edit it by hand.

## Domain knowledge: client IP in Workers

The entire API depends on resolving the *real* caller IP, which has Workers-specific pitfalls:

- `CF-Connecting-IP` is the injected header containing the client IP. For a zone proxied by Cloudflare, this is the value to return; `X-Forwarded-For` is a comma-separated chain and is client-controllable.
- The "Remove visitor IP headers" Managed Transform can strip `CF-Connecting-IP`, so handle a missing header explicitly rather than returning an empty body.
- In **same-zone Worker subrequests**, `CF-Connecting-IP` mirrors `x-real-ip`, which the calling Worker can alter. In **cross-zone** subrequests it is set to `2a06:98c0:3600::103`. Do not build trust assumptions on the header for subrequest-originated traffic.
- `request.cf` (e.g. `request.cf.country`, `asn`) is populated by Cloudflare at the edge; every field is optional, so treat absent or blank values as `null`. It is unavailable in the Dashboard/Playground and can be absent when calling `worker.fetch` directly in tests — inject it with `new Request(url, { cf: {...} })` and assert the resulting JSON.
- Local `wrangler dev` does populate `request.cf` from your network, while the Vitest loopback binding typically does not; keep integration tests independent of real geo data.

## Conventions

- Keep the request handler thin: derive the IP in the pure `clientIp(request)` helper and metadata in `toIpInfo(ip, cf)`, so both are unit-testable without an HTTP round-trip; test routing and headers through `exports.default.fetch()`.
- Build responses through the `textResponse`/`jsonResponse`/`baseHeaders` helpers so CORS and `cache-control` stay consistent on success and error paths. Never add `access-control-allow-credentials` — the data is public and read-only.
- Local dev populates `CF-Connecting-IP` with `::1`; send the header explicitly with `curl -H 'CF-Connecting-IP: ...'` to exercise other values.
- Pin `compatibility_date` in `wrangler.jsonc` to a fixed date and bump it deliberately — runtime APIs (and the types generated by `wrangler types`) follow it.
- Local dev runs on `workerd` with `TZ=UTC` regardless of machine timezone. Node.js APIs require the `nodejs_compat` compatibility flag; prefer Web-standard APIs (`fetch`, `URL`, `Request`/`Response`) first.
- `wrangler dev` exposes a Local Explorer API on the printed dev-server URL for inspecting bindings, storage, and request traces under `/cdn-cgi/local/explorer/api/...`.
- MCP servers for current Cloudflare docs are declared in `.mcp.json` at the repository root.

## Cloudflare documentation

APIs and limits change frequently — retrieve current docs before implementing Workers, bindings, or limits:

- https://developers.cloudflare.com/workers/
- https://developers.cloudflare.com/workers/wrangler/commands/
- https://developers.cloudflare.com/workers/platform/limits/
- Markdown versions of any page are available by appending `index.md` to its URL.
