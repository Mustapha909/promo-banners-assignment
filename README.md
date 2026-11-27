[![Ceasefire Now](https://badge.techforpalestine.org/default)](https://techforpalestine.org/learn-more)

# Technical assignment: dynamic promotion banners

This repository is the Tech for Palestine website with a promotional-banner feature added on top. The original project README follows [further down](#tech-for-palestine).

**Status:** the back-end foundation is complete and working: storage, scheduling rules, a public endpoint for the homepage and a protected admin endpoint. The write endpoints (create, edit, toggle, delete), the homepage display and the admin page are not built yet. [Status and next steps](#status-and-next-steps) lists what remains, in order.

## What is implemented

| File                                   | Purpose                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `wrangler.toml`                        | Adds a dedicated `BANNERS` Cloudflare KV namespace, separate from the existing payment-tracking data                                 |
| `src/env.d.ts`, `src/utils/getEnv.ts`  | Adds `delete` to the project's KV type and a `getBannerKv(locals)` helper, so routes reach the store the same way existing code does |
| `src/types/banners.ts`                 | `Banner`, `BannerInput` (a banner without the server-controlled `id`, `createdAt`, `updatedAt`) and `BannerStatus`                   |
| `src/utils/bannerSchedule.ts`          | `getBannerStatus(banner, now)` and `getActiveBanners(banners, now)`: the display rules                                               |
| `src/store/bannersClient.ts`           | The only module that talks to KV: `getBanner`, `getBanners`, `createBanner`, `updateBanner`, `deleteBanner`                          |
| `src/pages/api/banners/active.ts`      | `GET /api/banners/active`, public: banners to show right now, in display order                                                       |
| `src/pages/api/admin/banners/index.ts` | `GET /api/admin/banners`, admin only: every banner with every field                                                                  |

### API

| Method and path                 | Access                  | Status                          |
| ------------------------------- | ----------------------- | ------------------------------- |
| `GET /api/banners/active`       | Public, read-only       | Done                            |
| `GET /api/admin/banners`        | Admin (HTTP Basic Auth) | Done                            |
| `POST /api/admin/banners`       | Admin                   | Planned (store function exists) |
| `PUT /api/admin/banners/:id`    | Admin                   | Planned (store function exists) |
| `DELETE /api/admin/banners/:id` | Admin                   | Planned (store function exists) |

`GET /api/banners/active` returns only `id`, `title`, `imageUrl` and `linkUrl`. Internal fields such as `enabled`, `priority` and the timestamps stay on the server.

## Running it locally

1. Install Node 22 and pnpm 9, then run `pnpm install --frozen-lockfile` (see [Getting started](#getting-started) below).
2. Create a `.dev.vars` file in the project root with admin credentials of your choice. It is git-ignored.

   ```
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=choose-a-password
   ```

3. Start the dev server with `pnpm dev`. The Cloudflare adapter simulates the `BANNERS` KV namespace on disk under `.wrangler/state/`.

### Adding demo banners

The create endpoint is not built yet, so demo data is written straight into the local KV store with Wrangler. In `pnpm dev` the site reads the namespace's `preview_id`, so the command needs `--preview`. This adds one live banner:

```bash
pnpm exec wrangler kv key put --binding BANNERS --local --preview "banner:demo-1" '{"id":"demo-1","title":"Demo: live banner","imageUrl":"https://placehold.co/1200x300/png","linkUrl":"https://techforpalestine.org/events","startsAt":"2026-01-01T00:00:00.000Z","endsAt":"2027-01-01T00:00:00.000Z","enabled":true,"priority":1,"createdAt":"2026-11-27T00:00:00.000Z","updatedAt":"2026-11-27T00:00:00.000Z"}'
```

Add more with different keys and values, for example one with `"enabled":false` and one whose `endsAt` is in the past. Then compare the two endpoints:

```bash
curl http://localhost:4321/api/banners/active
curl -u admin:choose-a-password http://localhost:4321/api/admin/banners
```

The public endpoint shows only the live banner. The admin endpoint shows all of them, newest first. Without credentials the admin endpoint answers `401`.

## Design decisions

- **Cloudflare KV for storage.** The project already runs on Cloudflare Pages and already uses KV, so this adds no new infrastructure and works locally with no account. Cloudflare D1 (SQLite) was the alternative. It would be the better choice for thousands of banners or complex queries, but a banner list is small and filtering it in code is cheap.
- **One key per banner** (`banner:<uuid>`), rather than one key holding an array. Saving one banner never rewrites the others, so two admins editing different banners cannot overwrite each other's changes.
- **Status is calculated, not stored.** `getBannerStatus` derives `live`, `scheduled`, `expired` or `disabled` from `enabled`, the two dates and the current time. Nothing goes stale and no scheduled job is needed. The public endpoint and the admin list use the same function, so they always agree.
- **`now` is passed in.** The schedule functions are pure: the same inputs always give the same answer, so every boundary case can be checked without faking the clock.
- **A single storage module.** Routes never call `kv.get` or `kv.put` directly. Replacing KV with a database would only change `bannersClient.ts`.
- **Server-controlled fields always win.** `createBanner` and `updateBanner` set `id`, `createdAt` and `updatedAt` after spreading the input. A request body cannot choose or change a banner's ID or creation date, even though TypeScript types are not checked at runtime.
- **Admin access reuses the existing Basic Auth** (`src/utils/basicAuth.ts`), the same mechanism as the existing `/admin/conversions` dashboard. It compares credentials in constant time, and it denies access when the credentials are not configured.
- **Dates are ISO-8601 strings in UTC.** They survive JSON and KV unchanged, and they sort correctly as plain text.

## Edge cases

| Scenario                                                | Handling                                                                                                                               | Status            |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Expired banners                                         | Filtered out at request time (`now >= endsAt`). The record is kept, so an admin can see it and extend it.                              | Done              |
| Banner disabled while inside its schedule               | `enabled` is checked first and always wins. `/api/*` responses are `Cache-Control: no-store`, so the change shows on the next request. | Done              |
| Several banners live at once                            | All live banners are returned, sorted by `priority` (lower first), then by newest `startsAt`.                                          | Done              |
| Exact start and end moments                             | The start moment is included and the end moment is excluded, so a banner ending at 10:00 is not shown at 10:00.                        | Done              |
| Unreadable dates in a stored record                     | Treated as expired: a corrupted record never goes live ("fails closed").                                                               | Done              |
| Corrupted or missing KV record                          | Skipped instead of failing the whole list. Only the key is logged, because `JSON.parse` errors can include the stored text.            | Done              |
| Storage not configured                                  | Endpoints answer `503` with a generic message instead of crashing.                                                                     | Done              |
| Update or delete of an unknown ID                       | The store returns `null` or `false`, ready to become a `404`.                                                                          | Done in the store |
| Invalid or missing link                                 | Planned validation: `https:` only, which rejects `javascript:` and `data:` URLs. A banner without a link is shown but not clickable.   | Planned           |
| Missing or invalid image                                | Planned validation: required `https:` URL. On the page, a failed image load falls back instead of showing a broken image.              | Planned           |
| End date before start date, overlong title, wrong types | Planned validation, returning `400` with one message per field so the admin form can show each error next to its input.                | Planned           |

## Status and next steps

In the order they would be built:

1. **Validation** (`src/utils/bannerValidation.ts`): required fields, `https:` URLs, end after start, length limits, real booleans. The output is rebuilt field by field so unknown fields are dropped.
2. **Write endpoints:** `POST /api/admin/banners`, plus `PUT` and `DELETE /api/admin/banners/[id]`, calling the existing store functions and answering `404` for unknown IDs.
3. **Homepage display:** a React island in `src/pages/index.astro` that fetches `/api/banners/active`, renders nothing when the list is empty or the request fails, and handles broken images.
4. **Admin page** (`/admin/banners`, using the existing `AdminLayout` and Basic Auth): a table with a status badge for each banner, enable/disable and delete buttons, and a create/edit form. The page must be excluded from the sitemap and marked `noindex`.
5. **Token authentication** (optional in the brief): `POST /api/auth/token` exchanges a client ID and secret for a short-lived signed token, which the admin endpoints accept alongside Basic Auth.
6. **Unit tests** for `getBannerStatus` boundaries, validation, and the store against an in-memory KV.

### Known limitations

- **KV is eventually consistent.** In production a write can take up to about 60 seconds to reach every Cloudflare location, so a banner that was just disabled may still show briefly in other regions.
- **No transactions.** If two admins save the same banner at the same moment, the last save wins. A version number checked on update would prevent this.
- **Production setup:** the `id` and `preview_id` in `wrangler.toml` are local placeholders. A real deployment needs a namespace created with `wrangler kv namespace create BANNERS`, and `ADMIN_USERNAME` and `ADMIN_PASSWORD` set in the Cloudflare Pages dashboard.

---

# Tech for Palestine

Help normalize Palestinian humanity in different ways.

## Getting started

To run this project on your local machine you need Node 22 (see `.nvmrc`) and pnpm 9+ (via Corepack). Install dependencies:

```bash
pnpm install --frozen-lockfile
```

Next, run the development server:

```bash
pnpm dev
```

Finally, open [http://localhost:4321](http://localhost:4321) in your browser to view the website.

## Features

### Events System

The `/events` page displays events from a public ICS calendar feed (Mattermost Events Calendar plugin). See [docs/EVENTS.md](docs/EVENTS.md) for detailed documentation.

Key features:

- Manual refresh (no background polling)
- Graceful fallbacks for failed/expired images
- Responsive event cards with registration/recording links

## Documentation

Full documentation index: [docs/README.md](docs/README.md) — architecture, API reference, security model, Notion/ProjectHub integrations, donation pipeline, and more.

- [Deployment](DEPLOYMENT.md) - Cloudflare Pages deployment and environment variables

## Code of Conduct

This project follows the Tech for Palestine Code of Conduct. Please read it before contributing: [http://github.com/techforpalestine/code-of-conduct](http://github.com/techforpalestine/code-of-conduct)

## Contributions

Contributions of all kind are welcome. Fork this repo, clone, create branch and make the first commit for change. Open a PR with appropriate title. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and the pre-PR checklist.
