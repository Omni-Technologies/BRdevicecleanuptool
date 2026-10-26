# Changelog

## Unreleased

- DeviceType rules now cover TAMPER/PIV/OS&Y → Tamper Switch, WATERFLOW misspellings (WATEERFLOW, WATERLFOW, WATERFOW), LOW/HIGH AIR → Air Pressure Switch, BEAM → Beam Detector, ANSUL/KITCHEN HOOD → Kitchen Hood, the four Fire Pump types, PREACTION → Pre-Action System, and elevator RECALL/SHUNT/FIRE HAT → Elevator. Relays take the type of what they control: DAMPER → Damper Control, AHU/fan SHUTDOWN → Fan Shutdown, SMOKE CURTAIN/ROLL DOOR → Roll Down Door, FIRE CURTAIN → Fire Curtain, AUTO DOOR → Releasing Device, PURGE → Fan Purge System.
- House decisions: amplifiers exported as Voice Evacuation (AMP, AA30, AA50) → Amplifier, STROBE PANEL/STROBE CONTROL signal modules → Programmable Relay, and AUDIO circuit modules stay as exported.
- A relay is never turned into a detector or switch (`SMOKE CONTROL RELAY` and `RELAY FOR WATERFLOW BELL` stay Programmable Relay), and detector types never take relay function types.
- AI Assist may choose any of BuildingReports' 121 Fire Alarm DeviceTypes, not only the six rule targets and types already in the file. A DeviceType settled by a matched rule is kept over the AI's answer. The AI may not swap one generic module type for another or turn a relay into a detector or switch.

- Added optional AI Assist (DeepSeek `deepseek-flash`). It reads each AreaSuite and panel label in file context and fills Floor, Direction, Location, Zone, and DeviceType, plus optional Description and Type, as reviewable suggestions with confidence and notes. Includes an "AI filled" filter, undo, cancel, per-customer extra rules, and a key that can be remembered or forgotten.
- Blank ScanNumbers get unique sequential placeholders at import, matching the file's digit width (`0000000001`, …), because BuildingReports import rejects blanks.
- AI output is validated in code: unknown rows and fields are rejected, DeviceType is limited to allowed values, and Zone is accepted only when literally stated in the source.

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
