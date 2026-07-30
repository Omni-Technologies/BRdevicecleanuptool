# BR FieldSort agent handoff

This file is the primary operating guide for Codex and other coding agents. Read it before changing the project. Then read the relevant files under `docs/`.

## Product goal

BR FieldSort turns inconsistent BuildingReports CSV exports into reviewable, import-ready CSVs. It should become increasingly context-aware while remaining conservative, explainable, local-first, and non-destructive.

## Non-negotiable invariants

- Never change the exported `AreaSuite` value. It is the locked comparison source.
- Never delete or reorder input rows.
- Preserve the input column order. Append a missing target column only when necessary.
- Do not silently discard text that might carry operational meaning.
- Do not infer ambiguous values merely to reduce the Needs Review count.
- Never commit or publish a real customer CSV.
- Keep all CSV processing in the browser unless the user explicitly changes the architecture.
- Keep asset URLs relative so GitHub project Pages works at `/repository-name/`.

`app.js:exportCsv()` performs the final AreaSuite and row-count guard. Do not weaken it.

## Architecture

There is no framework and no build step.

- `parser.js` is a UMD-style pure logic module. It works in the browser and through `require()` in Node tests.
- `app.js` owns browser state, DOM rendering, editing, local learning, and export.
- `index.html` defines accessible controls.
- `styles.css` creates the responsive landing page and Excel-style grid.

Read `docs/ARCHITECTURE.md` before changing state flow or file handling. Read `docs/DATA_RULES.md` before changing parsing.

## Commands

```powershell
node --test
node --check parser.js
node --check app.js
node scripts/serve.js
```

No dependency installation is needed.

## Adding or changing a parser rule

1. Identify whether the rule belongs to extraction, normalization, classification, or cross-row context.
2. Put pure text/data logic in `parser.js`, not `app.js`.
3. Order specific rules before broad ones. Example: Duct must win before Smoke for `DUCT SMOKE`.
4. Preserve the original source and infer into target fields only.
5. Add representative tests in `tests/parser.test.js`.
6. Add or update the rule in `docs/DATA_RULES.md`.
7. Run the full test suite.
8. Check that a GitHub Pages artifact still needs only the four browser files.

## Browser state model

Each imported record in `app.js` keeps:

- `originalRow`: untouched parsed row values.
- `original`: original target values and AreaSuite.
- `parseSource`: the more informative of AreaSuite and cleaned Description.
- `inferred`: parser suggestions and confidence metadata.
- `values`: effective target values shown/exported.
- `edits`: manual edits to non-target columns.
- `manualColumns`: changed column indexes.
- `learningId`: stable key for locally remembered target corrections.

Do not collapse original, inferred, and effective values into one object. Their separation is what makes reset, review, and non-destructive export possible.

## Data privacy

`.gitignore` excludes all CSVs except `tests/fixtures/*.csv`. Keep fixtures fictional and sanitized. Do not mention customer names in committed tests or documentation.

The Pages workflow intentionally copies an allowlist into `_site`. Do not replace it with a repository-wide upload.

## UI expectations

- The grid should resemble a CSV opened in Excel: original column order, column letters, row numbers, compact cells, horizontal scroll, and direct editing.
- Empty utility columns E and N–Q may compact visually, but must remain present, editable, and export in their original positions.
- User-resized column widths are UI-only state. They must never alter CSV values, headers, column order, or export behavior.
- AreaSuite must remain visibly locked.
- Suggested, modified, and review states must remain distinguishable.
- Keyboard and paste workflows are first-class.
- Preserve responsiveness and `prefers-reduced-motion`.

## Completion checklist

- Tests pass.
- `parser.js` and `app.js` pass `node --check`.
- No customer exports are tracked.
- AreaSuite and row-count guards remain intact.
- Documentation reflects new rules or architecture.
- The landing page and workspace both render.
- Relative URLs work from a project subpath.
