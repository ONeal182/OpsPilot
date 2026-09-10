# Plans

Each file here is one self-contained unit of work. Drive it with the project
skill:

```
/workflow docs/plans/XX-name.md
```

`XX` is a zero-padded ordinal (`00`, `01`, …). The `/workflow` skill reads the
file, studies the code it touches, makes the change, **runs the area's checks
until they pass**, invokes `opspilot-architect` / `opspilot-reviewer` when the
change is significant, then updates `docs/STATUS.md`. A step is not done just
because code was written — the checks must pass.

## Plan-file template

```markdown
# XX — Short title

## Goal
One or two sentences: what this delivers and why.

## Context
Which components/dirs it touches (apps/api, apps/web, services/agent, docker/),
relevant docs (SPEC, contracts/messaging.md, DECISIONS), current state, and any
constraints (agent least-privilege, JSON-only messaging, fake driver default,
no host changes).

## Steps
1. Ordered, concrete edits.
2. ...

## Checks
The exact commands to run for each area touched, e.g.:
- `docker compose exec -T php-cli ./vendor/bin/pest`
- `docker compose exec -T php-cli ./vendor/bin/phpstan analyse --no-progress`
- `docker compose exec -T php-cli ./vendor/bin/pint --test`
- `cd apps/web && npm run build && npm run test && npm run lint`
- `cd services/agent && npm run build && npm run typecheck && npm run test`
- messaging: `php artisan opspilot:analyze-ticket T-<n> --wait` + `npm run smoke`

## Done-criteria
Bullet list of observable conditions that mean "done" (all checks green,
STATUS.md updated, contract doc updated, review addressed).
```

## Index

| Plan | Status |
| --- | --- |
| `00-bootstrap.md` | mostly DONE (retrospective record of phases A–G) |
| `01-ticket-ingestion.md` | NOT STARTED (next step) |
