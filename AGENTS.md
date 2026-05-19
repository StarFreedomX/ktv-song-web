# Repository Guidance

## Working Rules

- Prefer Docker for all local development and debugging; do not run `npm install` or `pnpm install` on the host when the same task can be done with `docker compose`.
- Use `docker compose up -d --build --force-recreate --remove-orphans` for rebuilds, and `docker compose logs -f <service>` for runtime checks.
- Keep backend cache changes compatible with Redis TTL and existing `expireAt` payloads.
- Preserve the current B站点歌 flow: frontend calls `/api/bilibiliSearch`, backend owns search/cache logic, and Redis stores persistent cache data.
- B站跳转参数要区分平台：`bilibili://` 自定义协议用 `page` 且从 `0` 开始，网页端用 `p` 且从 `1` 开始；解析、生成、回写时都要兼容两种格式。
- Duration env vars may use `ms`, `s`, `m`, `h`, or `d` suffixes; prefer readable forms like `5m`, `1h`, and `24h` in compose/docs.
- Update `readme.md` whenever startup steps, cache behavior, or search integration behavior changes.
- Avoid broad refactors; keep edits focused on the requested feature or fix.

## Project Idea

- This is a KTV song list management web app, with the main job of helping users search songs, queue songs, manage playback order, and keep the current room state synchronized.
- The current重点 feature is B站点歌 integration: users search by keyword in the add-song flow, backend returns ranked candidates, and selected items feed back into click/popularity sorting.
- Redis is the shared state/cache layer for song lists, search results, search catalogs, and other short-lived runtime data.
- Docker/OrbStack is the intended development path, so future debugging should start from compose and container logs instead of rebuilding the host environment.

## Key Files

- `readme.md`: canonical startup guide, Docker debug workflow, and B站搜索/Redis cache behavior.
- `docker-compose.yml`: local compose wiring for backend, frontend, and Redis; also the best place to inspect runtime env defaults.
- `package.json`: repo-level scripts for `dev`, `build`, and Docker helpers.
- `backend/src/index.ts`: backend entry/bootstrap point.
- `backend/src/ktvServer.ts`: core backend business logic and HTTP routes, including B站搜索相关接口。
- `backend/src/storage.ts`: Redis access layer and cache compatibility logic.
- `backend/src/types.ts`: shared backend types.
- `backend/src/utils.ts` / `backend/src/logger.ts`: utility helpers and logging.
- `backend/src/songOperation.test.ts` / `backend/src/switchSong.test.ts`: existing backend behavior tests.
- `frontend/src/main.js`: frontend bootstrap.
- `frontend/src/App.vue` / `frontend/src/AppEntry.vue`: app shell and top-level rendering.
- `frontend/src/Home.vue`: main KTV page entry.
- `frontend/src/modals/AddSongModal.vue`: add-song flow, including B站搜索入口.
- `frontend/src/modals/*.vue`: queue/history/favorites/settings and other UI dialogs.
- `frontend/src/router/index.js`: route setup.
- `backend/Dockerfile` / `frontend/Dockerfile`: image build logic; check these before changing local debug assumptions.

## Quick Context Restore

- If you need to resume quickly, read `AGENTS.md` first, then `readme.md`, then inspect `backend/src/ktvServer.ts`, `backend/src/storage.ts`, `frontend/src/modals/AddSongModal.vue`, and `docker-compose.yml`.
- The current exposed ports are backend `5823` and frontend `5526`.
- The user asked to skip container-internal tests, so prefer build/log verification with Docker instead of adding host dependencies.
