# Data and inference rules

This document describes current behavior. Update it whenever parser rules change.

## Protected source

- `AreaSuite` is locked in the UI.
- Its parsed string value is restored before export.
- Row count and column order are preserved.

## Source fields

AreaSuite is normally the parsing source. Cleaned Description can become the source when it contains materially stronger floor/location information.

Description cleanup:

- `EXAMPLE COMPANY\SECURITY OFFICE` → `Security Office`
- `Photo/CO` remains `Photo/CO`
- Only a backslash-separated leading segment is treated as the company prefix.

## DeviceType priority

Specific patterns run before broad ones:

1. `PULL` → `Pull Station`
2. `DUCT` → `Duct Detector`
3. `SMOKE`, `SMK`, or common transposition → `Smoke Detector`
4. `HEAT` → `Heat Detector`
5. `WATERFLOW` / `WATER FLOW` → `Waterflow Switch`
6. `POWER SUPPLY` / common abbreviations → `Power Supply`

This order ensures `DUCT SMOKE` becomes Duct Detector, not Smoke Detector. Avoid adding ambiguous mappings such as Relay or Tamper without representative completed exports.

## ModelNumber inference

ModelNumber is kept in sync when DeviceType is corrected:

1. Use a clear model from rows with the same manufacturer and an already-correct original DeviceType.
2. Otherwise use a clear file-wide model for that DeviceType.
3. If the file has no model evidence, `Pull Station` falls back to `SIGA-278`.

A single unique model is accepted. If multiple models exist, the leading model needs at least two rows, at least 80% of the evidence, and no tie. Conflicting model families are not guessed, and a conflicting in-file result suppresses the generic Pull Station fallback.

Smart mode replaces ModelNumber when DeviceType changes and a reliable model suggestion exists. It fills a blank ModelNumber for an already-correct DeviceType. Explicit-only mode preserves the original ModelNumber. Replace mode prefers the inferred model.

## Floor extraction

Supported examples:

- `1ST FLOOR`, `1ST FLR`, `1FL`, `FLR 1` → `1st Floor`
- `2 P LEVEL` → `2P`
- `LOWER LEVEL`, `LL` → `Lower Level`
- `PENTHOUSE` → `Penthouse`
- `MEZZ`, common misspellings → `Mezzanine`
- `ROOF`, `ROOFTOP` → `Roof`
- `BASEMENT`, `GROUND FLOOR`, `UPPER LEVEL`

Named levels take precedence over numbered text. For example, `LEVEL 5 PENTHOUSE` becomes Penthouse.

## Direction extraction

Full and abbreviated forms normalize to:

- North
- Northeast
- East
- Southeast
- South
- Southwest
- West
- Northwest

Examples such as `NE`, `N/E`, `N.E.`, `NORTH EAST`, and `NORTHEAST` are equivalent.

When a compass term is extracted, it is removed from Location.

## Direction as broad area

Completed exports sometimes use Direction for a broad area rather than a compass heading. Strong split patterns include:

- `Corridor By Room 518` → Direction `Corridor`, Location `By Room 518`
- `Guest Room 522` → Direction `Guest`, Location `Room 522`
- `Elevator Lobby` → Direction `Elevator`, Location `Lobby`

If a split is unclear, the text stays together in Location.

## Location cleanup

Examples:

- `BLDG 11` → `Building 11`
- `RM 114` → `Room 114`
- `N/W` moves to Direction `Northwest`
- All-caps text becomes normalized title case while recognized acronyms remain capitalized.
- A conservative spelling dictionary fixes known export mistakes.

Do not add broad fuzzy spelling corrections that may alter equipment identifiers or room codes.

## Context rules

Room-number context requires an unambiguous or at least 80% dominant floor association elsewhere in the file.

Text-similarity context requires:

- Same DeviceType.
- At least three meaningful shared tokens.
- Jaccard similarity of at least 0.6.
- No conflicting floor tie.

Context suggestions remain medium confidence.

## Review policy

A row needs review when useful source exists and:

- No Floor, Direction, or Location could be extracted.
- Overall inference is low confidence.
- A recognizable floor cue remains unresolved.

A blank field is not automatically an error. Some source descriptions genuinely omit a floor or direction.
