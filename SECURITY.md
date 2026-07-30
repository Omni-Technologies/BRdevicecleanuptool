# Security and data privacy

## Data processing

BR FieldSort is a static, local-first browser application. It has no backend, analytics, telemetry, account system, or network request in its runtime code. Imported CSV content is parsed in browser memory and exported through a local Blob download.

The only persistent browser data is the user’s learned target-field corrections in `localStorage` under `br-fieldsort-corrections-v2`.

## Repository data policy

Real BuildingReports exports may contain customer, building, device, and location information. They must not be committed.

- `.gitignore` excludes all `*.csv` files.
- Only fictional fixtures under `tests/fixtures/` are allowed.
- Before committing, run `git status --ignored` and confirm customer files are ignored.
- The Pages workflow publishes an explicit asset allowlist.

## Hosting

GitHub Pages serves only application code. CSV files selected by users are not uploaded to GitHub Pages or any other server.

## Reporting a problem

If a future change adds a dependency, remote service, telemetry, upload, or server component, update this document and obtain explicit approval before deployment.

