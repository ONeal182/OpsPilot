---
name: workflow
description: Execute a single plan file from docs/plans/ end-to-end — study code, make the change, run the area's checks until green, review if significant, update STATUS.md. Use when the user types "/workflow docs/plans/XX-name.md" or asks to run/drive a plan file.
---

# /workflow — single-plan executor

A lightweight, single-plan executor. **Not** the built-in `Workflow` tool (that
is multi-agent orchestration). This skill runs one plan file, in this session,
with the main agent doing the work.

Usage: `/workflow docs/plans/XX-name.md`

## Steps (in order)

1. **Read the plan.** Open the named file in `docs/plans/`. If no path was
   given, run `ls docs/plans/*.md`, show the list, and ask which one. Do not
   guess.

2. **Study the related code.** Read the dirs the plan touches before editing:
   - `apps/api` — Laravel API (PHP 8.4, run via `docker compose exec -T php-cli`)
   - `apps/web` — Vue 3 + TS + Vite
   - `services/agent` — Node + TS agent runtime
   - `docker/` — Dockerfiles, nginx vhost, compose wiring
   Also skim `docs/SPEC.md`, `docs/contracts/messaging.md`, `docs/DECISIONS.md`
   for anything the plan depends on.

3. **Produce a short action plan** — a todo list of the concrete edits.

4. **Make the changes.**

5. **Run the checks for every area touched.** Do not skip.
   - **Laravel** (`apps/api`):
     - `docker compose exec -T php-cli ./vendor/bin/pest`
     - `docker compose exec -T php-cli ./vendor/bin/phpstan analyse --no-progress`
     - `docker compose exec -T php-cli ./vendor/bin/pint --test`
   - **Vue** (`apps/web`):
     - `cd apps/web && npm run build && npm run test && npm run lint`
   - **Agent** (`services/agent`):
     - `cd services/agent && npm run build && npm run typecheck && npm run test`
   - **Messaging change** (topology, message shapes, publisher/consumer, contract):
     - `docker compose exec -T php-cli php artisan opspilot:analyze-ticket T-<n> --wait`
     - `cd services/agent && npm run smoke`

6. **Fix every failure and re-run until green.** A step is **NOT done just
   because code was written** — the checks must pass.

7. **Review when the change is significant** — schema/migration, security,
   messaging semantics, a cross-service contract, or Agent SDK permissions:
   - For architectural or contract questions, invoke **`opspilot-architect`
     FIRST** (analysis only — it returns a recommendation, not a diff).
   - Then invoke **`opspilot-reviewer`** on the finished change.
   - The **main agent decides** which review comments to act on; act on them,
     then re-run the relevant checks.

8. **Update `docs/STATUS.md`.** Move the item to DONE only if all checks passed.
   Otherwise leave it in progress with a note on what remains.

9. **Report a compact result:** what changed (files), checks run + outcomes,
   review outcome, and any follow-ups.

## Naming note

Project scope wins for this repo, so `/workflow` here means this skill. If you
need the built-in multi-agent orchestrator, call the `Workflow` tool by name
explicitly.
