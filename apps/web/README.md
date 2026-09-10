# opspilot-web

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

## Routes

Route table: `src/router/index.ts`.

- `/` → `views/LandingView.vue` — public landing page (sticky header, hero,
  features, how-it-works, footer). Static: no API calls, no store. Section
  components live in `src/components/landing/`.
- `/login` → `views/LoginView.vue` — placeholder stub («Вход» / «Скоро»). No
  real auth, forms, or route guards yet.

The old `views/HomeView.vue` (backend-health demo) and its spec were removed
when `/` became the landing page.

## Styling & UI

- **Tailwind CSS v4** via `@tailwindcss/vite` — no `tailwind.config.js`. Theme
  tokens and the `neutral` light/dark palette live in `src/assets/main.css`.
- **[shadcn-vue](https://www.shadcn-vue.com/)** (`new-york` style, `neutral`
  base). Components are vendored under `src/components/ui/` and edited in place.

```sh
# add another component (run in the web container)
npx shadcn-vue@latest add <name>
```

See `docs/DECISIONS.md` D41 and `apps/web/CLAUDE.md` for the full rules.
