# CI Pipeline

Six gates run in parallel on every PR and on push to `main`.

## Gates

- **typecheck** — `tsc --noEmit` must pass; blocks type regressions.
- **lint** — `pnpm lint` (next lint) must pass; blocks style and unsafe-pattern regressions.
- **audit** — `pnpm audit --audit-level=high` fails on any high or critical CVE in the dependency tree.
- **secrets** — `gitleaks` scans the diff against `.gitleaks.toml`, including custom rules for Supabase service_role keys, Anthropic keys, and Supabase-shaped JWTs.
- **semgrep** — `returntocorp/semgrep-action` runs OWASP top ten, typescript, react, plus `semgrep-rules/earthmove.yml` (RLS wildcard allow, service_role outside server, free-form SMS, `next/headers` import, unscoped RLS `EXISTS`).
- **migrations** — filenames must match `^[0-9]{3}_[a-z0-9_]+\.sql$`; destructive ops (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE FROM` without `WHERE`) fail unless the commit message contains `--allow-destructive`.

## Run locally

```bash
pnpm typecheck
pnpm lint
pnpm ci:audit
gitleaks detect --source . --config .gitleaks.toml
semgrep --config=semgrep-rules/earthmove.yml .
```

## Allowlisting false positives

- **gitleaks**: add a path pattern to `[allowlist].paths` in `.gitleaks.toml`, or a regex to `[allowlist].regexes`.
- **semgrep**: add the path to `paths.exclude` in the offending rule inside `semgrep-rules/earthmove.yml`.

## Intentionally shipping a destructive migration

Include the literal string `--allow-destructive` anywhere in the commit message that introduces the migration. The `migrations` gate greps `git log -1 --format=%B` for it and will pass.
