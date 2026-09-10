---
name: opspilot-vue
description: Vue 3 + TypeScript conventions for apps/web — Composition API, Pinia, the axios instance, router, Vitest, and the build/test/lint gates. Use for any work under apps/web.
---

# opspilot-vue — Vue 3 + TS conventions (`apps/web`)

Vue 3.5, Vite 8, TypeScript strict, Vue Router 5, Pinia 4. No CSS framework.

## Conventions

- **Composition API only** — `<script setup lang="ts">`. TypeScript strict mode.
- **Pinia stores** in `src/stores/` (e.g. `stores/health.ts`).
- **HTTP** via the shared axios instance in `src/lib/http.ts` — baseURL `/api`,
  which the Vite dev proxy forwards to nginx
  (`VITE_API_PROXY_TARGET || http://localhost:8080`; compose sets
  `http://nginx:80` for the `web` service). Do not create ad-hoc axios instances
  or hardcode hosts.
- **Routing** via Vue Router in `src/router/`.
- **Tests**: Vitest + `@vue/test-utils`, in `src/**/__tests__/*.spec.ts`. Mock
  axios — never hit a real backend in a unit test.
- Keep components small and focused.

## Gates that must stay green (run from `apps/web`)

```bash
npm run build   # run-p type-check (vue-tsc) + vite build
npm run test    # vitest run
npm run lint    # oxlint --fix + eslint --fix
```

All three must exit 0. In-container equivalent: `docker compose exec -T web npm run <script>`.

## Dev URLs

- Web: http://localhost:5173
- API is proxied under http://localhost:5173/api → nginx.

## After significant frontend changes

Run build + test + lint. For cross-cutting UI/state architecture questions use
`opspilot-architect`; for a review of a significant change use `opspilot-reviewer`.
