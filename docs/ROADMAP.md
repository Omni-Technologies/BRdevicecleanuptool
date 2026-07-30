# Roadmap and known limitations

This is a guide, not a commitment. Prefer changes backed by completed reference exports.

## Strong next candidates

- Undo/redo for manual and bulk edits.
- User-defined parsing rules with preview and rollback.
- Import profiles for recurring customers or building naming conventions.
- Column-level validation rules before export.
- A visible explanation popover for ModelNumber evidence and conflicts.
- Duplicate and near-duplicate detection.
- A comparison pane showing original source beside all inferred targets.
- Exportable/importable learned rules instead of browser-only localStorage.
- Better room/equipment tokenization without losing identifiers.
- Direction vocabulary profiles for facilities that use Direction as an area category.
- A test corpus of fictional edge cases generated from observed structures.

## Current limitations

- The parser is deterministic and rule/context based; it does not call an AI model.
- Learned corrections stay in one browser profile.
- CSV is supported; native `.xlsx` files are not.
- CSV serialization quotes every field and uses CRLF. Values are preserved, but byte-for-byte file formatting is not.
- Extremely large files render all visible rows and may eventually need virtualization.
- Company-prefix cleanup currently recognizes the backslash-separated convention only.
- Ambiguous device terms intentionally keep the existing DeviceType.

## Before adding remote AI

Remote inference would change the privacy model. It requires explicit user approval, a clear data-retention policy, authentication, error handling, offline fallback, and updates to `SECURITY.md`.
