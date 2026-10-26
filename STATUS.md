# Status

Where the project stands right now. `AGENTS.md` is the operating contract, `docs/DATA_RULES.md` the rule reference. Customer names and customer file paths never go in this file (see AGENTS.md "Data privacy"); the local Claude memory note `br-fieldsort.md` holds those.

Last updated: 2026-10-26.

## Current state (all on `main`, pushed, GitHub Pages deployed)

- `bcb444a` ScanNumber placeholders start at `1000000001` (leading 1, file's digit width) so Excel does not strip zeros. Verified: `node --test` 40/40, and a real 2,176-row export got 49 unique 10-digit placeholders. Pages deploy run succeeded.
- `63b56a9` DeviceType rules + AI Assist on BuildingReports' full Fire Alarm list. Verified:
  - `node --test` 40/40.
  - Headless-Chrome run of the real app on a 2,176-row export: row count, header order and AreaSuite unchanged; with a mocked AI every rule-settled row (717) kept its type; Undo AI restored the rule result exactly.
  - Live DeepSeek (`deepseek-flash`) run on a 267-row sample: every rule-settled row agreed, no generic-to-generic flips, no relay-to-detector.
  - Before/after diff of every row's DeviceType on four real exports, reviewed by hand.
- The repo moved to `Omni-Technologies/BRdevicecleanuptool`; the old `networkdrew/BRdevicecleanuptool` remote URL redirects and pushes work.

## Decisions (do not re-litigate)

- Device words win over places: `TAMPER … ELEVATOR PIT` is Tamper Switch, `WATERFLOW … PREACTION` is Waterflow Switch.
- A relay never becomes a detector or switch. A detector type never takes a relay function type.
- Relays take the type of what they control: Damper Control, Fan Shutdown, Elevator (recall/shunt/fire hat), Roll Down Door (smoke curtain/roll door), Fire Curtain, Releasing Device (auto door), Fan Purge System (purge), Pre-Action System (preaction trip).
- User's house decisions (2026-10-26): amplifiers (AMP/AA30/AA50, exported Voice Evacuation) → **Amplifier**; STROBE PANEL/STROBE CONTROL modules → **Programmable Relay**; AUDIO circuit modules **stay as exported**; PURGE → **Fan Purge System**.
- A matched parser rule (including a "keep" rule) settles DeviceType; AI Assist cannot override it (`inferred.deviceTypeRule`, `app.js:keepRuleDeviceType`).
- `ai.js` `KNOWN_DEVICE_TYPES` is BuildingReports' exact 121-type F1 list. Refresh it from the logged-in Device Import Tool page (`appDevices.F1` in the console) — the user must log in; an agent cannot. Never hand-edit it from memory.
- ScanNumber placeholders: `1000000001`, `1000000002`, … never zero-padded.

## Deliberately not done

- No rule for door holder / door unlock relays, dialer relays, alarm-to-other-panel points (`ALARM TO FIKE`, `CHECK FIKE PANEL`), amp/NAC panel trouble monitors. Evidence was mixed; they keep the exported type.
- Candidates surfaced, not acted on: a Heat Detector labeled `SMOKE …` still becomes Smoke Detector (older rule, unchanged); rules-only Location keeps the leading `Tamper`/`Waterflow` word (AI Assist strips it).

## Next task: merge notification appliances from a prior BuildingReports export

The user will supply a FieldSort-cleaned import CSV and wants the **Strobe, Speaker/Strobe, Speaker, and Horn/Strobe** devices from a prior full BuildingReports export of the same building appended to it, in the import file's columns. File paths and site specifics are in the memory note `br-fieldsort.md`.

What is already known about the two formats:

- Import CSV headers, in order: `ScanNumber, DeviceType, Manufacturer, ModelNumber, SerialNumber, Floor, Direction, Location, Description, AreaSuite, ControlPanel, Zone, Address, ManufactureDate, InstallDate, Type, Note`.
- The full BR export uses ~60 lowercase internal headers in a different order (`bisimpairment, bispumptest, inspectionnumberid, actualscannumber, …, scannumber, inspectiondate, devicetype, …`). **All 17 import headers exist there under the same name lowercased**, so map by case-insensitive header name, never by position.
- Extra columns in the BR export (`tested, passed, service, inspectiondate, actualscannumber`, …) are inspection results and must not be carried into the import file.

Procedure:

1. Parse both files with `parser.js` (`parseCsv`), filter the BR export to `devicetype` in the four types, map columns by name, append after the existing rows. Never change, drop, or reorder existing rows or headers.
2. Check the combined ScanNumbers are unique and non-blank.
3. Write with `stringifyCsv` (all fields quoted, CRLF) to a **new** file next to the user's file; never overwrite the user's file. Keep customer files out of the repo.
4. Report counts per DeviceType and anything changed.

Ask the user before deciding these (found while profiling the prior export):

- **Dates**: ManufactureDate/InstallDate are `MM/DD/YYYY 12:00 AM`. Keep as-is or trim to `MM/DD/YYYY`? Check which format the Device Import Tool accepts (its public script is `https://www.buildingreports.com/apps/device-import-tool/classic/app.js`; search `dateDbs`).
- **ControlPanel**: the prior export has the old system's panel numbers (1, 2, 3); the new panel export uses `1` throughout. Keep old values or set all to `1`?
- **Manufacturer typo** `Wheellock` (2 rows) → `Wheelock`? Two Horn/Strobes have blank Manufacturer and ModelNumber.
- One Speaker/Strobe has a 12-digit ScanNumber; the rest are 8 digits. Keep as-is unless told otherwise.

## Commands

```powershell
node --test                      # 40 tests, no dependencies
node --check parser.js; node --check ai.js; node --check app.js
node scripts/serve.js 8091       # local app at http://127.0.0.1:8091/ — stop it when done
git push origin main             # deploys GitHub Pages (Actions "Test and deploy GitHub Pages")
```

DeepSeek key for a live AI check: user environment variable `DEEPSEEK_API_KEY`. Serve it to the page through a one-request localhost helper; never write it into the repo or a URL.
