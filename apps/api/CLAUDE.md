<laravel-boost-guidelines>
# Laravel Boost Guidelines

Curated by Laravel maintainers for this app. Follow closely.

## Context

- Laravel app on **PHP 8.4**. Always use APIs matching the **installed** major
  version — never assume. Confirm versions: `composer show --direct` (PHP),
  `package.json` (JS).
- Activate the relevant domain skill in `**/skills/**` as soon as you work in
  that domain — don't wait until stuck.

## Conventions

- Follow existing code conventions; check sibling files for structure, approach,
  and naming. Use descriptive names (`isRegisteredForDiscounts`, not
  `discount()`).
- Reuse existing components before writing new ones.
- Keep the existing directory structure — no new base folders and no dependency
  changes without approval.
- Don't write verification scripts / tinker when tests already cover it — unit
  and feature tests matter more.
- Only create documentation files when the user explicitly asks.
- If a frontend change doesn't show, they may need `npm run build` / `npm run
  dev` / `composer run dev` — ask.
- Be concise in explanations.

## Laravel Boost MCP (prefer over shell / manual reads)

- `database-query` — read-only DB queries (not raw SQL in tinker).
- `database-schema` — inspect tables before migrations / models.
- `get-absolute-url` — resolve scheme/domain/port before sharing any URL.
- `browser-logs` — recent browser logs/errors only.
- `search-docs` — **before** any change depending on Laravel-ecosystem APIs,
  behavior, config, or version-specific syntax. Skip for copy-only edits. Scope
  with a `packages` array; use broad topic queries
  (`['rate limiting', 'routing']`); don't put package names in the query text;
  reuse results already in context.

### search-docs syntax

- Words = auto-stemmed AND (`rate limit` → "rate" AND "limit").
- `"quoted phrases"` = exact adjacent order.
- Mix: `middleware "rate limit"`. Multiple queries = OR.

## Project rules (`.ai/rules`)

- If `.ai/rules` exists: **before** plan mode or creating/editing any file, open
  `@.ai/rules/index.md` (maps globs → rule files), read every rule file whose
  globs cover the path(s) in scope, and run `grep -rin 'keyword' .ai/rules`.
  Don't write code until you follow every matching rule.
- Record durable rules with the `record-rule` MCP tool (`glob`, `title`,
  `note`) — never native memory; only `.ai/rules` is shared and persisted.

## Artisan & Tinker

- Run Artisan directly (`php artisan route:list` — filter with `--method`,
  `--name`, `--path`, `--except-vendor`). Discover with `php artisan list`,
  `php artisan [command] --help`. Pass `--no-interaction` and the right
  `--options`.
- Create files with `php artisan make:*` (generic class → `make:class`). New
  models: also make factories + seeders.
- Read config via dot notation: `php artisan config:show app.name`.
- Tinker: PHP in app context for debugging; prefer tests with factories over
  creating models. Single-quote the script, double-quote PHP strings inside:
  `php artisan tinker --execute 'User::where("active", true)->count();'`

## PHP style

- Always use curly braces, even single-line bodies.
- Constructor property promotion: `public function __construct(public GitHub
  $github) {}`. No empty zero-arg `__construct()` unless private.
- Explicit return types and param type hints everywhere.
- `TitleCase` enum keys. PHPDoc blocks over inline comments (inline only for
  exceptionally complex logic); use array-shape types in PHPDoc.

## APIs, routes, deploy

- APIs: default to Eloquent API Resources + API versioning unless existing
  routes don't, then follow existing convention.
- Links: prefer named routes + `route()`.
- Laravel Cloud deploys → activate the `deploying-to-cloud` skill.
- "Unable to locate file in Vite manifest" → run `npm run build` (or ask for
  `npm run dev` / `composer run dev`).

## Pint (formatting)

- After modifying PHP, run `vendor/bin/pint --dirty --format agent` before
  finalizing. Do **not** run `pint --test` here — just `pint` to auto-fix.

## Pest (tests)

- Create tests with `php artisan make:test --pest {name}` (no suite dir in the
  name; `--unit` for unit tests — most tests are feature tests).
- Faker via `$this->faker->word()` / `fake()->randomDigit()` — follow existing
  convention. Use model factories and their custom states.
- Never delete tests / test files without approval.
- Run the narrowest set covering the change:
  `php artisan test --compact --filter=testName` or a file path; `vendor/bin/pest`
  takes the same args. Rerun a test after each change to it. After feature tests
  pass, ask the user to run the full suite (`php artisan test --compact`).
- Read the `testing-best-practices` skill for coverage, naming, structure,
  isolation.
</laravel-boost-guidelines>
