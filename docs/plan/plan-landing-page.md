# Plan: plan-landing-page

**PRD:** @docs/prd/prd-landing-page.md
**Дата:** 2026-09-10

## Фазы реализации

### Фаза 1: Роутинг `/` -> LandingView + `/login` заглушка (Tracer Bullet)

**Цель:** `/` рендерит новый `LandingView` (пустой каркас), `/login` рендерит
`LoginView`-заглушку, кнопка «Войти» ведёт на `/login`. Полный навигационный
путь работает end-to-end.

**Затрагивает:** frontend

**Задачи:**
- [ ] Спека `views/__tests__/LandingView.spec.ts`: монтирует `LandingView` с
      мок-роутером, проверяет `<header>`, наличие `RouterLink` с `to="/login"`,
      текст кнопки «Войти».
- [ ] Спека `views/__tests__/LoginView.spec.ts`: рендерит заголовок «Вход» и
      текст «Скоро».
- [ ] `views/LandingView.vue` (`<script setup lang="ts">`): `<header>` sticky,
      лого-текст «OpsPilot», `<Button as-child>` + `RouterLink to="/login"`
      «Войти». Ниже — пустые `<section>` заглушки под будущие блоки.
- [ ] `views/LoginView.vue`: `<h1>Вход</h1>` + `<p>Скоро</p>`.
- [ ] `router/index.ts`: `/` -> `LandingView` (name `landing`), `/login` ->
      `LoginView` (name `login`); удалить/переписать `HomeView.spec.ts` под
      новый маршрут или удалить вместе с неиспользуемым `HomeView.vue`.

**Когда готова:** `docker compose exec web npm run test` зелёный (новые спеки +
нет упавшего `HomeView.spec.ts`); `type-check`, `lint`, `build` -> exit 0;
`curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/` -> `200`;
переход `/` -> клик «Войти» -> `/login` показывает `LoginView`, консоль без
ошибок.

### Фаза 2: Контент лендинга — Hero, Features, How-it-works, Footer

**Цель:** `LandingView` содержит все секции PRD с русским текстом и версткой
Tailwind v4; адаптив в одну колонку на ~375px.

**Затрагивает:** frontend

**Задачи:**
- [x] Дополнить `LandingView.spec.ts`: hero-заголовок присутствует; вторая
      «Войти в личный кабинет» ссылка на `/login`; блок `features` содержит ≥4
      карточки; блок `how-it-works` содержит ровно 4 пронумерованных шага;
      `<footer>` содержит `© 2026 OpsPilot`.
- [x] Hero-секция: заголовок, подзаголовок (1–2 предложения про OpsPilot),
      основная `<Button as-child>` -> `RouterLink to="/login"`.
- [x] Features-секция: сетка (Tailwind grid, ≥4 карточки), каждая — иконка
      `@lucide/vue` + заголовок + описание по темам PRD (анализ тикетов агентом;
      агент предлагает, не выполняет; approve/reject — человек; данные только
      через MCP + Internal API).
- [x] How-it-works-секция: 4 пронумерованных шага
      `тикет -> RabbitMQ -> агент (fake|claude) -> предложение -> человек`.
- [x] Footer: `© 2026 OpsPilot` + ссылки-заглушки `<a href="#">`; классы
      адаптива (`grid`/`flex` -> одна колонка на мобильном), `<style>` пустой
      или минимальный.

**Когда готова:** `docker compose exec web npm run test` зелёный (расширенные
спеки); `type-check`, `lint`, `build` -> exit 0; на `/` в DOM присутствуют
`header`, hero-заголовок, `features` (≥4 карточки), `how-it-works` (4 шага),
`footer`; при ширине 375px `document.documentElement.scrollWidth ===
document.documentElement.clientWidth`; вкладка Network пуста после загрузки `/`.

### Фаза 3: Синхронизация документации

**Цель:** доки отражают новые `views/` и маршрут `/login`; гейт Stop-hook
проходит.

**Затрагивает:** frontend (docs)

**Задачи:**
- [x] `apps/web/CLAUDE.md`: в разделе Structure описать `views/LandingView.vue`
      (маршрут `/`), `views/LoginView.vue` (маршрут `/login`), судьбу
      `HomeView.vue`.
- [x] `docs/STATUS.md`: пункт Web — лендинг на `/`, заглушка `/login`; обновить
      счётчик тестов Vitest под фактическое число.
- [x] `apps/web/README.md`: при необходимости упомянуть маршруты `/` и `/login`.

**Когда готова:** `git grep -n "HomeView" apps/web docs` не возвращает
устаревших упоминаний; счётчик тестов в `docs/STATUS.md` совпадает с выводом
`npm run test`; повторный прогон `test` / `lint` / `type-check` / `build` ->
exit 0.
