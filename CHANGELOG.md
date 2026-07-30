# Changelog

## Unreleased

- Added context-aware ModelNumber inference from correct same-file DeviceType and manufacturer matches.
- Added the explicit `Pull Station → SIGA-278` fallback while suppressing it when file evidence conflicts.
- Kept ModelNumber synchronized after direct, pasted, or bulk DeviceType edits.
- Added automatic compact widths for empty columns E and N–Q plus a full-width toggle.
- Added drag, keyboard, auto-fit, and reset controls for every CSV column while keeping widths separate from exported data.

## 0.1.0 — Initial packaged release

- Local drag-and-drop BuildingReports CSV workflow.
- Excel-style full-column grid with direct and bulk editing.
- CSV parser supporting quoted values and embedded line breaks.
- Floor, Direction, Location, Description, and DeviceType inference.
- Cross-row context using room numbers and strong text similarity.
- Local correction learning.
- Locked AreaSuite and row-count export validation.
- Automated Node tests with sanitized fixture.
- GitHub Pages deployment workflow.
- Codex and Claude handoff documentation.
