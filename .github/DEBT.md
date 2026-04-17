## Lint toolchain (orphaned by Next 15 → 16 upgrade)

`next lint` was removed in Next 16. Repo has no eslint.config.* and no .eslintrc* — ESLint is effectively off across the codebase. Needs its own PR:

- Add `eslint.config.mjs` (flat config for Next 16)
- Extend `next/core-web-vitals` flat variant + `@typescript-eslint`
- Re-wire `pnpm lint` + `pnpm lint:fix` in package.json
- Triage existing violations repo-wide (not just driver code)
- Add pre-commit hook via husky + lint-staged once clean

Tracked but not blocking driver-dashboard-v2 commit.
