# OpsPilot Web — Guide (for Claude)

Vue 3 + TypeScript + Vite SPA for OpsPilot. It talks only to the Laravel API
over HTTP. See the root `CLAUDE.md` for the whole stack.

## We work TDD

- **Tests first, then code.** Write a failing Vitest test before the component /
  store / composable.
- Red → green → refactor.
- **Done = every test green** plus `type-check`, `lint`, and `build` all pass.
- **Update docs in the same change** — this file, `README.md`, and any affected
  `docs/` file when behaviour or contracts change.

## Commands (run in the `web` container)

```bash
docker compose exec web npm run dev          # vite dev server
docker compose exec web npm run test         # vitest run (CI mode)
docker compose exec web npm run test:unit    # vitest watch
docker compose exec web npm run type-check   # vue-tsc --build
docker compose exec web npm run lint         # oxlint + eslint (--fix)
docker compose exec web npm run format       # prettier
docker compose exec web npm run build        # type-check + vite build
```

## Rules

- **TypeScript strict.** No `any`; type props, emits, store state, and API
  payloads.
- **Composition API only** — every component is `<script setup lang="ts">`.
  No Options API, no `defineComponent`.
- **State: Pinia** (`src/stores/`, one store per domain, `defineStore` with the
  setup syntax). **Routing: Vue Router** (`src/router/index.ts`).
- **HTTP: the shared axios instance** `src/lib/http.ts` (`baseURL: '/api'`,
  proxied to the API by Vite). Never call `axios` directly or hardcode host /
  port. Keep API calls out of components — put them in stores or `src/lib/`.
- **Lint/format: ESLint + oxlint + Prettier.** Match `.prettierrc.json` /
  `eslint.config.ts`; don't hand-format against them.
- **Tests: Vitest** with `@vue/test-utils`, colocated in `__tests__/` next to
  the unit under test. Mock HTTP (mock `src/lib/http.ts` or use an axios
  adapter) — tests never hit a real backend.

## Structure (`src/`)

- `main.ts` — app bootstrap (Pinia + Router).
- `App.vue`, `views/` — route-level components.
- `components/` — reusable presentational components.
- `stores/` — Pinia stores (data + API access).
- `router/` — route table.
- `lib/` — framework-agnostic helpers (`http.ts`, …).
- `assets/` — CSS and static assets.

## External libraries

- Before using an unknown library / API, check **Context7** for current docs.
  Never invent method names, options, or signatures.
- No new dependencies without a stated reason.

## Do NOT

- No Options API, no global `axios`, no hardcoded API URLs.
- No committing `.env` (only `.env.example`).
- No skipping `type-check` / `lint` / `build` before calling a task done.
