---
name: run-milestones
description: Берёт открытые GitHub milestones и выполняет их по одному — ветка фичи на milestone, TDD по каждому issue, гейты компонента, комментарий + закрытие issue, PR в конце. Использую, когда бэклог разложен по milestones (см. skill issues) и надо его отработать.
---

# Исполнитель milestones

Отрабатывает открытые milestones репозитория **по одному**: заводит ветку фичи,
закрывает issue за issue через TDD, в конце открывает PR. Инструмент — `gh` CLI
+ git. Это ручной исполнитель в текущей сессии, не `Workflow` tool.

Использование: `/run-milestones [<номер milestone> | <подстрока названия>]`.
Без аргумента — берётся open milestone с наименьшим номером.

## Инварианты

- **Никогда не коммитить в `main`.** Вся работа — в ветке фичи.
- **TDD:** для каждого issue сначала падающий тест, потом код (см. skill `tdd`).
- **Issue закрыт только когда гейты компонента зелёные** (см. §5). Код написан
  ≠ готово.
- **Каждое изменение кода правит доки в том же коммите** — `docs/STATUS.md` и
  любые задетые `CLAUDE.md` / `README.md` / `docs/`.
- Один PR на milestone. PR не мёржит скилл — это решает человек.
- Атрибуция коммитов и PR — по строкам из system-reminder текущей сессии.

## Шаги

### 1. Выбрать milestone

```bash
gh api repos/{owner}/{repo}/milestones --state open \
  --jq 'sort_by(.number)[] | "M\(.number) [\(.open_issues) open] \(.title)"'
```

- Аргумент задан — взять совпавший (по номеру или подстроке названия).
- Иначе — milestone с наименьшим номером.
- Открытых milestones нет — сообщить и выйти.
- Показать выбранный milestone и список его открытых issues:
  `gh issue list --milestone "<title>" --state open --json number,title`.

### 2. Предложить ветку фичи (обязательно спросить)

Собрать имя из названия milestone: `feature/<slug>`, где `<slug>` — короткий
kebab-case на английском по смыслу milestone (напр. `Фаза 1: Роутинг / ->
LandingView` → `feature/landing-routing`).

**Вложенность.** Если milestones — это фазы одной фичи, предложить дерево:

```
feature/<фича>                    (интеграционная ветка фичи, от main)
  └─ feature/<фича>/phase-1-...    (ветка фазы, от feature/<фича>)
  └─ feature/<фича>/phase-2-...    (от feature/<фича>, после мёржа phase-1 — ребейз)
```

Спросить у пользователя:
- имя ветки (предложить своё, дать переопределить);
- базовую ветку: `main` или родительская `feature/<фича>` (по умолчанию —
  родительская, если предыдущая фаза уже в работе, иначе `main`);
- нужна ли отдельная интеграционная ветка фичи.

Не создавать ветку, пока пользователь не подтвердил имя и базу.

```bash
git fetch origin
git switch -c <branch> <base>        # base: origin/main или feature/<фича>
```

Если ветка уже есть — `git switch <branch>` и продолжить с незакрытых issues.

### 3. Отработать issues milestone по одному

Для каждого открытого issue (по возрастанию номера):

1. Прочитать issue: `gh issue view <n> --json title,body`.
2. Изучить задетый код перед правкой:
   - `apps/api` — Laravel (запуск через `docker compose exec -T php-cli`)
   - `apps/web` — Vue 3 + TS + Vite (запуск через `docker compose exec -T web`)
   - `services/agent` — Node + TS
   - `docker/` — Dockerfile'ы, nginx vhost, compose
   Плюс `docs/SPEC.md`, `docs/DECISIONS.md`, `docs/contracts/` по теме issue.
   Для Vue-задач — сначала skill `vue-best-practices`, затем реализация.
3. Написать падающий тест по критерию issue.
4. Реализовать минимально, до зелёного теста.
5. Прогнать гейты компонента (§5). Красный — чинить и повторять.
6. Закоммитить (одна логическая правка + доки):

   ```bash
   git add -A
   git commit   # тело оканчивается строками атрибуции из system-reminder
   ```

   Первая строка: `<type>(<scope>): <что сделано> (#<n>)`.

### 4. Закрыть issues и открыть PR

После того как **все** issues milestone зелёные:

1. По каждому issue — комментарий что сделано и закрытие:

   ```bash
   gh issue close <n> --reason completed --comment "$(cat <<'EOF'
   Сделано в ветке <branch>:
   - <короткий список изменений>
   Коммиты: <sha1>, <sha2>
   Гейты: <перечислить> — зелёные.
   EOF
   )"
   ```

2. Обновить `docs/STATUS.md` (и задетые `CLAUDE.md` / `README.md`), закоммитить.
3. Запушить ветку: `git push -u origin <branch>`.
4. Открыть PR в базовую ветку из §2:

   ```bash
   gh pr create --base <base> --head <branch> \
     --title "<Название milestone>" \
     --milestone "<title>" \
     --body "$(cat <<'EOF'
   ## Что сделано
   - <по одному пункту на issue>

   ## Как проверено
   - <гейты и их вывод>

   Closes #<n1>
   Closes #<n2>
   ...

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```

   `Closes #…` для всех issues milestone (двойная страховка к §4.1 —
   мёрж PR ничего не оставит открытым).

### 5. Гейты компонента (не пропускать)

- **Vue** (`apps/web`):
  `docker compose exec -T web npm run test` **+** `... npm run type-check`
  **+** `... npm run lint` **+** `... npm run build` — все exit 0.
  Файлы, созданные CLI внутри контейнера, — `chown 1000:1000` (контейнер под
  root).
- **Laravel** (`apps/api`):
  `docker compose exec -T php-cli ./vendor/bin/pest` **+**
  `... ./vendor/bin/phpstan analyse --no-progress` **+**
  `... ./vendor/bin/pint --test`.
- **Agent** (`services/agent`):
  `docker compose exec -T agent npm run build` **+** `... npm run typecheck`
  **+** `... npm test`.
- **Messaging** (топология / форма сообщений / publisher / consumer):
  `docker compose exec -T php-cli php artisan opspilot:analyze-ticket T-<n> --wait`
  **+** `docker compose exec -T agent npm run smoke`.

### 6. Отчёт

Компактно: milestone, ветка + база, закрытые issues (#), созданный PR (url),
прогнанные гейты и их итог, что осталось.

Затем — если остались открытые milestones — предложить перейти к следующему
(повтор с шага 1). Между фазами одной фичи: при вложенных ветках сначала
дождаться мёржа предыдущего PR, затем `git switch <parent> && git pull` и
`git switch -c <next-phase> <parent>`.

## Не делать

- Не мёржить PR, не делать force-push, не трогать `main` напрямую.
- Не закрывать issue, по которому гейты не зелёные.
- Не создавать ветку без подтверждения имени пользователем.
- Не тащить в milestone задачи, которых нет в его issues.
