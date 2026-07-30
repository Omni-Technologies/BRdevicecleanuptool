# Architecture

## Overview

BR FieldSort is deliberately small and dependency-free:

```text
CSV File
   │
   ▼
parser.js: parseCsv
   │
   ▼
app.js: preserve original rows and build record state
   │
   ├── parser.js: infer each row
   ├── parser.js: apply cross-row context
   └── app.js: merge originals, suggestions, learning, and edits
   │
   ▼
Excel-style browser grid
   │
   ▼
app.js: validate AreaSuite + row count
   │
   ▼
parser.js: stringifyCsv → local download
```

Nothing is sent to a server.

## Runtime files

### `parser.js`

Pure logic exposed as both `window.BRParser` and `module.exports`.

Responsibilities:

- Delimiter detection.
- RFC-style quoted CSV parsing.
- CSV serialization.
- Header matching.
- Text normalization and spelling cleanup.
- Floor and Direction extraction.
- DeviceType classification.
- ModelNumber inference from trustworthy same-file DeviceType/manufacturer evidence.
- Area/Location splitting.
- Description prefix cleanup.
- Per-row confidence metadata.
- Conservative cross-row context.

Keep this module free of DOM, File API, Blob, download, and localStorage behavior.

### `app.js`

Browser orchestration.

Responsibilities:

- File selection and drag/drop.
- Required-column discovery and missing target-column creation.
- Selection of AreaSuite or Description as `parseSource`.
- Merge modes: smart, explicit-only, and replace.
- Spreadsheet rendering.
- Search and review filters.
- Direct editing, Excel paste, selection, and bulk editing.
- Local correction learning.
- Export validation and download.

### `index.html`

Static semantic structure. Script order is significant: `parser.js` must load before `app.js`.

### `styles.css`

Landing view, workspace, spreadsheet grid, locked/suggested/modified states, responsive layout, and reduced-motion behavior.

## Import state

`parseCsv()` returns:

```js
{
  headers: ["ScanNumber", "..."],
  rows: [["value", "..."]],
  delimiter: ","
}
```

`ensureTargetColumns()` resolves normalized header aliases and appends missing target columns. It never reorders input headers.

Each record retains three layers:

1. Original: immutable source values.
2. Inferred: parser suggestions plus confidence and reasons.
3. Effective: values currently shown and exported after merge mode, learning, and edits.

This separation is required for safe reset and export.

## Source selection

Some exports place useful text in AreaSuite; others place it in Description. Both receive an inference score based on floor, direction, location length, device terminology, and location cues. Description must exceed AreaSuite by more than two points to become `parseSource`; ties favor AreaSuite.

DeviceType checks the combined AreaSuite and cleaned Description because strong device terminology may appear in either field.

## Context pass

`applyContext(records)` runs after all rows have independent inferences.

It can:

- Learn a floor associated with an explicit room number elsewhere in the file.
- Borrow a floor from a strongly matching row of the same DeviceType.
- Match ModelNumber from rows whose original DeviceType is already correct, preferring the same manufacturer.

Context results are medium confidence. Conflicting room/floor evidence is rejected.

ModelNumber evidence is resolved independently. One unambiguous model is accepted; competing models require an 80% dominant result with at least two supporting rows. Conflicting results are left unchanged. `Pull Station → SIGA-278` is the only built-in fallback and is used only when the file contains no conflicting or stronger model evidence.

## Grid width behavior

Columns E and N–Q are compacted to a narrow Excel-style width only when every effective cell in that column is blank. The toolbar can expand them, and adding a value restores normal width automatically. This is visual only; no column is removed or reordered.

Every CSV column also has an accessible resize separator in its header. Dragging changes a CSS width variable stored in `state.columnWidths`; double-click or Enter auto-fits, arrow keys adjust the width, Home resets one column, and the toolbar resets all columns. Manual widths last for the current imported file and are cleared when a new file is loaded. Width state is never read by `exportCsv()`.

## Export safety

`exportCsv()` reconstructs every row in original header order, applies effective values, restores original AreaSuite, then verifies:

- Output row count equals input row count.
- Every output AreaSuite equals its original parsed value.

Only after validation does it generate the download.

## Deployment

GitHub Pages serves relative assets from a project subpath. `.github/workflows/pages.yml`:

1. Runs tests.
2. Copies only runtime assets to `_site`.
3. Uploads the Pages artifact.
4. Deploys through the `github-pages` environment.

There is no production build transformation.
