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

Each rule applies only to certain exported types:

- **input**: generic monitor modules (`Initiating Device`, `Monitor Device`, `Module`, `Alarm Device`, `Supervisory Device`, blank).
- **relay**: `Programmable Relay`, `Non-Programmable Relay`, `Control Relay`, `Relay`.
- **device**: every other exported type (detectors, pull stations, notification appliances, and so on).

A rule can also name one exact exported type. Every target is a BuildingReports Fire Alarm (F1) DeviceType; the full F1 list is `KNOWN_DEVICE_TYPES` in `ai.js`.

Specific patterns run before broad ones. The first rule that applies to the row's exported type and matches its text wins. A matched rule settles the row's DeviceType: AI Assist cannot change it. "Keep" rules settle the exported type without changing it.

| # | Text | DeviceType | Applies to |
|---|---|---|---|
| 1 | `AUDIO` (audio circuit modules) | keep exported | input |
| 2 | `STROBE PANEL`, `STROBE CONTROL`, without `TROUBLE`/`TRBL`/`FAULT` | Programmable Relay | input |
| 3 | `AMP`, `AMPLIFIER`, `AA30`, `AA50` | Amplifier | exported `Voice Evacuation` only |
| 4 | `PULL` | Pull Station | input, device |
| 5 | `BEAM` | Beam Detector | input, relay (beam reset relays) |
| 6 | `DUCT` | Duct Detector | input, device |
| 7 | `FIRE CURTAIN` | Fire Curtain | input, relay |
| 8 | `SMOKE CURTAIN`, `ROLL DOOR`, `ROLL DOWN` | Roll Down Door | input, relay |
| 9 | `SMOKE`, `SMK`, common transposition | Smoke Detector | input, device |
| 10 | `HEAT` | Heat Detector | input, device |
| 11 | `WATERFLOW`, `WATER FLOW`, `WATEERFLOW`, `WATERLFOW`, `WATERFOW`, `WTR FLOW`, `FLOW SWITCH` | Waterflow Switch | input, device |
| 12 | `TAMPER`, `TAMP`, `PIV`, `OS&Y` | Tamper Switch | input, device |
| 13 | `LOW AIR`, `HIGH AIR`, `HI/LO AIR`, `AIR PRESSURE` | Air Pressure Switch | input, device |
| 14 | `ANSUL`, `KITCHEN HOOD`, `HOOD SYSTEM` | Kitchen Hood | input |
| 15 | `FIRE PUMP RUN(NING)` / `PHASE REVERSAL` / `POWER` / `TROUBLE` | Fire Pump Running / Phase Reversal / Power / Trouble | input |
| 16 | `POWER SUPPLY` and common abbreviations | Power Supply | input, device |
| 17 | `PREACTION`, `PRE ACTION`, `PRE-ACTION` | Pre-Action System | input, relay |
| 18 | `ELEV`/`ELEVATOR` together with `RECALL`, `SHUNT`, or `(FIRE) HAT` | Elevator | input, relay |
| 19 | `DAMPER` | Damper Control | relay |
| 20 | `PURGE` | Fan Purge System | relay |
| 21 | `AHU`/`RTU`/`MAU`/`CAU`/`EF`/`FAN`/`EXHAUST` together with `SHUTDOWN`/`SHUTDWN` | Fan Shutdown | relay |
| 22 | `AUTODOOR`, `AUTO DOOR` | Releasing Device | relay |

Consequences of this order and scoping:

- `DUCT SMOKE` becomes Duct Detector, not Smoke Detector.
- A device word wins over a place: `TAMPER BSMT ATRIUM ELEVATOR 32 PIT` is a Tamper Switch, `WATERFLOW 4 CENTER C-SECTION PREACTION` a Waterflow Switch, `LOW AIR … PREACTION` an Air Pressure Switch. Only preaction points with no device word (`TROUBLE … PREACTION`, `PREACTION TRIP`) become Pre-Action System.
- A relay never becomes a detector or switch: `SMOKE CONTROL RELAY`, `RELAY FOR WATERFLOW BELL`, and a relay labeled `DUCT SMOKE` stay Programmable Relay.
- Detector types never take relay function types: a Smoke Detector labeled `ELEV LOBBY RECALL` stays a Smoke Detector.
- `NORTH PENT AHU SHUTDOWN ELEV 17 EQUIP RM` is a Fan Shutdown: the Elevator rule needs RECALL, SHUNT, or HAT.

- `AMP PANELS TROUBLE` monitors stay Initiating Device: the Amplifier rule only applies to rows exported as Voice Evacuation.

These mappings follow BuildingReports' own types and a completed BuildingReports export of the same building, where dampers were Damper Control, AHU shutdowns Fan Shutdown, elevator recall/shunt/fire hat points Elevator, smoke curtains Roll Down Door, and auto doors Releasing Device. Rules 1–3 and 20 are the user's house decisions (2026-10-26): amplifiers import as Amplifier, strobe panel signal modules as Programmable Relay, audio circuit modules keep Initiating Device, and purge relays become Fan Purge System.

Deliberately left unchanged (no rule): door holder and door unlock/release relays, dialer relays, relays and monitors that talk to another panel (`ALARM TO FIKE`, `CHECK FIKE PANEL`), and amplifier and NAC panel trouble monitors. They keep their exported type unless AI Assist finds a clearly better one.

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

## ScanNumber placeholders

BuildingReports import rejects a blank ScanNumber. At import, every blank or whitespace-only ScanNumber gets a sequential placeholder: `1000000001`, `1000000002`, and so on, in row order.

- Placeholders start with `1`, not zeros, so Excel keeps every digit when the export is opened and saved there (it turns `0000000001` into `1`).
- The width matches the most common digit length among the file's numeric ScanNumbers, which is 10 in current exports. It falls back to 10 when the file has none.
- A placeholder never repeats a ScanNumber already in the file. Taken values are skipped.
- Existing ScanNumbers are never changed. Placeholders show as suggested cells, can be edited like any cell, and are exported.

## AI Assist rules

AI Assist follows the same house format as the rules above. The full prompt wording is `FIELD_RULES` in `ai.js`.

- **Floor:** `1st Floor` … `12th Floor`, Basement, Lower Level, Ground Floor, Mezzanine, Penthouse, Roof, or parking `2P`. A bare number before a wing or building name (`4 CENTER`, `7 TOWER`) is the floor. A bare `3` returned by the model is normalized to `3rd Floor`.
- **Direction:** the wing, building, tower, or compass area, spelled one way across the file. The file conventions pass fixes the spellings.
- **Location:** the specific place, in Title Case with every word capitalized. Device words and the floor and area already used are removed, and shorthand is expanded (RM, MECH, ELEV, EQUIP, ELEC, BSMT, PENT). Room numbers, stair letters, elevator numbers, and equipment tags are kept exactly as written. Uncertain abbreviations are left as written.
- **DeviceType:** generic module types become the BuildingReports type for what the point is or does, using the same mappings as the DeviceType table above. Rows that table leaves alone (door holder relays, other-panel monitors) keep the exported type unless a better type clearly fits. Any type in `KNOWN_DEVICE_TYPES` (`ai.js`, BuildingReports' full Fire Alarm list of 121 types, read from the Device Import Tool on 2026-10-26) or already in the file is accepted. When a parser rule matched the row, including a "keep" rule, its DeviceType is settled and the AI's answer is ignored. Code also rejects an AI DeviceType that only swaps one generic module type for another (Initiating Device ↔ Monitor Device ↔ Module) or turns a relay into a detector or switch. ModelNumber then follows the existing ModelNumber inference.
- **Zone:** filled only when the zone is literally stated, as in `Z15` or `ZONE 15` in AreaSuite or Description, and only into a blank Zone cell. Leading address numbers such as `13 PULL DOOR 17` are rejected in code even if the model returns them.
- **Description:** off by default. The completed reference export keeps Description as the cleaned original. When enabled, it becomes a short device-function statement such as `Damper Relay` or `Duct Detector - AHU 5N1 Supply`, with one wording per function keyword.
- **Type:** off by default. Filled only when the text states it explicitly.
- **Confidence:** each row gets high, medium, or low. Low rows and rows with no extracted Floor, Direction, Location, or Description count as Needs Review. A short AI note appears in the cell tooltip.

## Review policy

A row needs review when useful source exists and:

- No Floor, Direction, or Location could be extracted.
- Overall inference is low confidence.
- A recognizable floor cue remains unresolved.

A blank field is not automatically an error. Some source descriptions genuinely omit a floor or direction.
