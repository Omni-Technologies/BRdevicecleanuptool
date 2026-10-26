# Security and data privacy

## Data processing

BR FieldSort is a static, local-first browser application. It has no backend, analytics, telemetry, or account system. Imported CSV content is parsed in browser memory and exported through a local Blob download.

The rule-based cleanup makes no network request. The only network request in the runtime code is the optional AI Assist described below.

## AI Assist (optional, user-initiated)

AI Assist sends nothing until the user pastes a DeepSeek API key and clicks **Fill with AI**. Each run then sends requests directly from the browser to `https://api.deepseek.com/chat/completions`, authenticated with the user's own key. There is no proxy or FieldSort server in between.

Per row, only these exported columns are sent: DeviceType, Manufacturer, ModelNumber, Description, AreaSuite, Floor, Direction, Location, Zone, and Type. A file-level summary built from the same columns is also sent: value counts and a sample of AreaSuite text. ScanNumber, SerialNumber, Address, and every other column are never sent.

DeepSeek's own terms and retention policy apply to the text sent. Do not run AI Assist on an export the customer has not cleared for third-party processing.

Model output is treated as untrusted data. `ai.js` accepts only known row ids and fields, only DeviceType values from the allowed list, and a Zone only when that zone is literally present in the row's source text. Accepted values become reviewable suggestions, and AreaSuite cannot be changed by AI output.

## Browser storage

- `br-fieldsort-corrections-v2`: learned target-field corrections.
- `br-fieldsort-ai-settings-v1`: AI model, chosen columns, extra instructions, and the remember-key preference.
- `br-fieldsort-deepseek-key`: the DeepSeek API key, stored only while **Remember key on this device** is checked. **Forget key** deletes it.

`localStorage` is shared by every page on the same origin. On GitHub Pages that origin is the organization's `*.github.io` host, which other repositories' Pages sites can also use. On a shared or untrusted computer, uncheck **Remember key** or click **Forget key** after use.

## Repository data policy

Real BuildingReports exports may contain customer, building, device, and location information. They must not be committed.

- `.gitignore` excludes all `*.csv` files.
- Only fictional fixtures under `tests/fixtures/` are allowed.
- Before committing, run `git status --ignored` and confirm customer files are ignored.
- The Pages workflow publishes an explicit asset allowlist.
- API keys are entered at runtime and must never be committed.

## Hosting

GitHub Pages serves only application code. CSV files selected by users are not uploaded to GitHub Pages or any FieldSort server.

## Reporting a problem

If a future change adds a dependency, remote service, telemetry, upload, or server component, update this document and obtain explicit approval before deployment.
