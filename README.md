# BR FieldSort

BR FieldSort is a local-first cleanup tool for BuildingReports CSV exports. Users drop a CSV into the browser, review contextual suggestions in an Excel-style grid, bulk-edit when needed, and download a cleaned CSV.

The application is a static website with no backend, account, database, build step, or runtime dependency. CSV contents never leave the browser.

## Current capabilities

- Preserves every original CSV row, column, and `AreaSuite` value.
- Corrects strongly identified Device Types, including Pull Station, Duct Detector, Smoke Detector, Heat Detector, Waterflow Switch, and Power Supply.
- Keeps ModelNumber aligned with DeviceType by learning from correct rows in the same file; Pull Station falls back to `SIGA-278` when no stronger file evidence exists.
- Extracts numbered floors, Lower Level, Penthouse, Mezzanine, Roof, Basement, Ground Floor, and parking levels.
- Extracts full and abbreviated compass directions.
- Separates broad areas from precise locations when the pattern is clear.
- Removes a backslash-separated company prefix from Description.
- Normalizes capitalization, spacing, common abbreviations, and conservative spelling errors.
- Compares AreaSuite and Description to handle exports that put useful source text in either field.
- Uses repeated room numbers and highly similar rows for conservative contextual floor suggestions.
- Supports direct cell editing, Excel range pasting, row selection, and bulk fill/replace.
- Automatically compacts empty utility columns E and N–Q, with a one-click full-width view.
- Lets users resize every CSV column, double-click to auto-fit, or reset all widths without changing exported data.
- Remembers target-field corrections in browser `localStorage`.

## Privacy

Do not commit customer CSV exports. The repository ignores every `*.csv` file except the sanitized fixture under `tests/fixtures/`.

The GitHub Pages workflow publishes only:

- `index.html`
- `styles.css`
- `parser.js`
- `app.js`
- `.nojekyll`

See [SECURITY.md](SECURITY.md) for the complete data-handling model.

## Open locally in VSCodium

1. Open this folder in VSCodium.
2. Press `Ctrl+Shift+B` and choose **BR FieldSort: Start local server**, or run:

   ```powershell
   node scripts/serve.js
   ```

3. Open `http://127.0.0.1:8080`.

Double-clicking `index.html` also works. The local server more closely matches GitHub Pages.

## Test

Node.js 18 or later is required for tests:

```powershell
node --test
```

The default VSCodium test task runs the same command. No package installation is required.

## Publish with GitHub Pages

Create a new empty GitHub repository, then run these commands from the VSCodium terminal:

```powershell
git add .
git commit -m "Initial BR FieldSort release"
git remote add origin https://github.com/YOUR-USER/YOUR-REPOSITORY.git
git push -u origin main
```

On GitHub:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, select **GitHub Actions** as the source.
3. Open the **Actions** tab and allow the `Test and deploy GitHub Pages` workflow to finish.
4. The deployment job displays the live Pages URL.

Every later push to `main` runs the tests and republishes the site. The workflow follows GitHub’s current [custom Pages workflow guidance](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Project map

| Path | Purpose |
| --- | --- |
| `index.html` | Application structure and controls |
| `styles.css` | Responsive visual design and spreadsheet grid |
| `parser.js` | Pure CSV parsing, inference, cleanup, and context rules |
| `app.js` | Browser state, file workflow, editing, learning, and export |
| `tests/` | Node tests and sanitized fixture |
| `scripts/serve.js` | Restricted local static server |
| `.github/workflows/pages.yml` | Test and GitHub Pages deployment |
| `AGENTS.md` | Primary handoff instructions for coding agents |
| `CLAUDE.md` | Claude entry point |
| `docs/ARCHITECTURE.md` | Data flow and implementation design |
| `docs/DATA_RULES.md` | Current inference and normalization rules |
| `docs/ROADMAP.md` | Known limitations and sensible next features |

## Development rules

The following are non-negotiable:

1. `AreaSuite` remains locked and exports character-for-character.
2. Row count and column order remain unchanged.
3. Ambiguous information stays blank or reviewable; do not invent it.
4. Customer files remain local and ignored by Git.
5. Parser behavior receives a test before or with its implementation.
6. The hosted application remains usable under a GitHub project subpath, so browser assets use relative URLs.

Start future work by reading [AGENTS.md](AGENTS.md).
