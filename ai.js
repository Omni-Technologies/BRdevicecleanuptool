(function attachAi(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BRAI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildAi() {
  "use strict";

  const ENDPOINT = "https://api.deepseek.com/chat/completions";
  const DEFAULT_MODEL = "deepseek-flash";
  const MODELS = ["deepseek-flash", "deepseek-v4-pro"];

  const KNOWN_DEVICE_TYPES = [
    "Acoustic Leak Detector", "Air Pressure Switch", "Alarm Device", "Alarm Pressure Switch", "Amplifier",
    "Annunciator", "Aspirating Detector", "Base", "Battery", "Beacon", "Beam Detector", "Bell", "Bell/Strobe",
    "Building Automation", "Call Station", "Carbon Dioxide System", "Chemical System", "Chime", "Chime/Strobe",
    "Clean Agent System", "CO Alarm", "CO Detector", "Communication Line", "Communicator", "Control Panel", "Damper",
    "Damper Control", "Disconnect", "Door Smoke Detector", "Duct Detector", "Egress Markers", "Elevator",
    "Emergency Light", "Emergency Power Off", "Emergency Power Supply", "End Of Line", "Exit Light", "Expander Panel",
    "Fan Purge System", "Fan Running", "Fan Shutdown", "Fan Start", "Fault Isolation Module", "Fire Barrier",
    "Fire Curtain", "Fire Pump Auto", "Fire Pump Phase Reversal", "Fire Pump Power", "Fire Pump Running",
    "Fire Pump Trouble", "Flame Detector", "Foam System", "Gas Detector", "Gas Shutdown", "Generator Auto",
    "Generator Running", "Generator Trouble", "Handset", "Heat Detector", "Horn", "Horn/Strobe", "Indicating Device",
    "Initiating Device", "Kitchen Hood", "Knox Box", "Lighting Control", "Locking Device", "Low Fuel",
    "Low Temperature", "Low Water", "Low-Freq. Sounder/Strobe", "Low-Frequency Sounder", "Master Control Station",
    "Masterbox", "Microphone", "Mini-Horn", "Module", "Monitor Device", "Monitoring", "Multi-Criteria Detector",
    "Multi-Criteria Smoke Alarm", "Multi-Sensor Alarm", "Multi-Sensor Detector", "No Entry Sign",
    "Non-Programmable Relay", "Phone Jack", "Phone Station", "Power Loss", "Power Supply", "Pre-Action Signal",
    "Pre-Action System", "Printer", "Programmable Relay", "Pull Station", "Releasing Device", "Remote Indicator",
    "Remote Test Switch", "Repeater", "Roll Down Door", "Signage", "Sliding Door", "Smoke Alarm", "Smoke Detector",
    "Sound Shutdown", "Speaker", "Speaker Array", "Speaker/Strobe", "Special Control", "Stairwell Exit", "Strobe",
    "Supervisory Device", "Supervisory Valve", "Surge Protector", "System Documents", "Tamper Switch",
    "Thermal Imaging Detector", "Transformer", "Voice Evacuation", "Water Mist System", "Water Pressure Switch",
    "Waterflow Switch"
  ];

  const GENERIC_DEVICE_TYPES = ["initiating device", "monitor device", "module"];
  const RELAY_DEVICE_TYPES = ["programmable relay", "non-programmable relay", "control relay", "relay"];
  const DETECTOR_DEVICE_TYPES = [
    "acoustic leak detector", "air pressure switch", "alarm pressure switch", "aspirating detector", "beam detector",
    "co alarm", "co detector", "door smoke detector", "duct detector", "flame detector", "gas detector", "heat detector",
    "multi-criteria detector", "multi-criteria smoke alarm", "multi-sensor alarm", "multi-sensor detector", "pull station",
    "smoke alarm", "smoke detector", "supervisory valve", "tamper switch", "thermal imaging detector",
    "water pressure switch", "waterflow switch"
  ];

  const KNOWN_TYPES = ["Supervisory", "Verification", "Tamper", "NS Output", "General Alarm"];

  const FIELDS = [
    { key: "deviceType", header: "DeviceType", label: "Device Type", defaultOn: true },
    { key: "floor", header: "Floor", label: "Floor", defaultOn: true },
    { key: "direction", header: "Direction", label: "Direction", defaultOn: true },
    { key: "location", header: "Location", label: "Location", defaultOn: true },
    { key: "description", header: "Description", label: "Description (device function)", defaultOn: false },
    { key: "zone", header: "Zone", label: "Zone", defaultOn: true },
    { key: "type", header: "Type", label: "Type", defaultOn: false }
  ];

  const INPUT_COLUMNS = [
    ["deviceType", "DeviceType"],
    ["manufacturer", "Manufacturer"],
    ["modelNumber", "ModelNumber"],
    ["description", "Description"],
    ["areaSuite", "AreaSuite"],
    ["floor", "Floor"],
    ["direction", "Direction"],
    ["location", "Location"],
    ["zone", "Zone"],
    ["type", "Type"]
  ];

  const FIELD_RULES = {
    deviceType:
      "DeviceType: the exported value names the panel module, and generic modules (Initiating Device or Monitor Device = an input, " +
      "Programmable Relay = a relay output) should become the BuildingReports type for what the point is or does, chosen only " +
      "from the allowed DeviceType list. Device words win, even when the text also names a place such as an elevator pit or a " +
      "preaction system: PULL → Pull Station, DUCT SMK/DUCT SMOKE → Duct Detector, SMOKE/SMK → Smoke Detector, HEAT → Heat Detector, " +
      "WATERFLOW (also misspelled WATEERFLOW, WATERLFOW, WATERFOW) → Waterflow Switch, TAMPER/PIV/OS&Y → Tamper Switch, " +
      "LOW AIR/HIGH AIR → Air Pressure Switch, BEAM → Beam Detector, ANSUL/KITCHEN HOOD → Kitchen Hood, " +
      "FIRE PUMP RUNNING/POWER/PHASE REVERSAL/TROUBLE → the matching Fire Pump type, POWER SUPPLY/PWR SPLY → Power Supply. " +
      "Preaction ALARM/TROUBLE monitors and PREACTION TRIP relays → Pre-Action System. Elevator RECALL, SHUNT TRIP/SHUNT POWER, " +
      "and FIRE HAT points, relay or monitor → Elevator. A relay takes the type of what it controls: DAMPER → Damper Control, " +
      "AHU/fan/exhaust SHUTDOWN → Fan Shutdown, PURGE → Fan Purge System, SMOKE CURTAIN/ROLL DOOR → Roll Down Door, " +
      "FIRE CURTAIN → Fire Curtain, AUTO DOOR → Releasing Device. STROBE PANEL/STROBE CONTROL signal modules → Programmable Relay. " +
      "Amplifiers exported as Voice Evacuation (AMP, AA30, AA50) → Amplifier. " +
      "A relay is never a detector or switch: SMOKE CONTROL RELAY or RELAY FOR WATERFLOW BELL stays Programmable Relay, and so do " +
      "door holder, door unlock, dialer, and alarm-to-other-panel relays. Monitor points that report another panel or system " +
      "(CHECK FIKE PANEL, AMP PANELS TROUBLE, NAC PANELS TROUBLE, DIALER TROUBLE) and AUDIO circuit modules keep the exported " +
      "type. A detector or pull station keeps its exported type unless " +
      "the text names a different detector. When no allowed type clearly fits, keep the exported value.",
    floor:
      "Floor: exactly one of \"1st Floor\", \"2nd Floor\", \"3rd Floor\", \"4th Floor\" … \"12th Floor\" (ordinal + Floor), " +
      "\"Basement\" (BSMT), \"Lower Level\" (LL), \"Ground Floor\", \"Mezzanine\" (MEZZ), \"Penthouse\" (PENT, PH), \"Roof\", " +
      "or a parking level such as \"2P\". A bare number directly before a wing or building name (\"4 CENTER\", \"7 TOWER\") is the floor. " +
      "Use the floor where the device physically is. Leave blank when neither the text nor its panel label states a floor.",
    direction:
      "Direction: the wing, building, tower, or compass area that contains the device, in Title Case " +
      "(\"North\", \"Tower\", \"Atrium\", \"Building 3\"). Prefer the wing or building in the row's panel label when one exists. " +
      "Use one consistent spelling per area across the whole file. Leave blank when no area is given.",
    location:
      "Location: the specific place inside that floor and area, in Title Case (capitalize every word), with device words (PULL, SMOKE, SMK, DUCT, HEAT, " +
      "DETECTOR, DET) and the floor and area already used in Floor/Direction removed. Expand shorthand: RM → Room, MECH → Mechanical, " +
      "ELEV → Elevator, EQUIP → Equipment, ELEC → Electrical, BSMT → Basement, PENT → Penthouse, CORR → Corridor, " +
      "STAIR → Stair, OFC → Office, STOR → Storage. Keep identifiers exactly: room numbers, stair letters, elevator numbers, " +
      "and equipment tags such as AHU 5N1, SPU-03, CR-1, EF-1, W4-PR4. Keep acronyms upper case (AHU, FACP, NICU, MRI, IDF, OR, ICU). " +
      "When the meaning of an abbreviation is uncertain, keep it exactly as written. Do not invent a place.",
    description:
      "Description: a short Title Case statement of what the point is or does, built from the tech's own words — for example " +
      "\"Pull Station\", \"Smoke Detector\", \"Duct Detector - AHU 5N1 Supply\", \"Tamper Switch\", \"Waterflow Switch - Preaction\", " +
      "\"Elevator 11 Shunt Trip\", \"Damper Relay\", \"Door Release Relay\", \"AHU 1 Shutdown Relay\", \"Amplifier CH1 - Serves 6 Atrium\", " +
      "\"Audio Circuit 1-1\", \"Strobe Panel\", \"Fike Panel Alarm\", \"Spare Input\". Do not add qualifiers the tech did not write " +
      "(DAMPER is \"Damper Relay\", not \"Smoke Damper Relay\"). Use the same wording for the same function on every row. " +
      "Keep equipment tags, circuit and channel numbers. Do not repeat the floor or location unless the point serves a different " +
      "place than where it is installed.",
    zone:
      "Zone: the zone number only when the text or panel label states it explicitly (\"Z15\", \"ZONE 15\" → \"15\"). " +
      "Otherwise keep the exported value.",
    type:
      "Type: only when the text explicitly states it, using values already present in the file or one of " +
      `${KNOWN_TYPES.join(", ")}. Otherwise keep the exported value.`
  };

  function clean(value) {
    return String(value == null ? "" : value).replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function rowPayload(row) {
    return INPUT_COLUMNS.map(([key]) => clean(row[key]));
  }

  function countValues(values) {
    const counts = new Map();
    values.forEach((value) => {
      const text = clean(value);
      if (text) counts.set(text, (counts.get(text) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }

  function allowedTypes(rows) {
    const seen = new Map(KNOWN_TYPES.map((value) => [value.toLowerCase(), value]));
    rows.forEach((row) => {
      const value = clean(row.type);
      if (value && !seen.has(value.toLowerCase())) seen.set(value.toLowerCase(), value);
    });
    return Array.from(seen.values());
  }

  function allowedDeviceTypes(rows) {
    const seen = new Map(KNOWN_DEVICE_TYPES.map((value) => [value.toLowerCase(), value]));
    rows.forEach((row) => {
      const value = clean(row.deviceType);
      if (value && !seen.has(value.toLowerCase())) seen.set(value.toLowerCase(), value);
    });
    return Array.from(seen.values()).sort();
  }

  function buildFileProfile(rows) {
    const modelsByType = new Map();
    rows.forEach((row) => {
      const type = clean(row.deviceType) || "(blank)";
      if (!modelsByType.has(type)) modelsByType.set(type, []);
      modelsByType.get(type).push(row.modelNumber);
    });
    const step = Math.max(1, Math.floor(rows.length / 150));
    const samples = [];
    for (let i = 0; i < rows.length && samples.length < 150; i += step) {
      const text = clean(rows[i].areaSuite);
      if (text) samples.push(text);
    }
    return {
      rowCount: rows.length,
      deviceTypes: countValues(rows.map((row) => row.deviceType)),
      modelsByType: Array.from(modelsByType.entries()).map(([type, models]) => [type, countValues(models).slice(0, 6)]),
      descriptionLabels: countValues(rows.map((row) => row.description)).slice(0, 80),
      existingFloors: countValues(rows.map((row) => row.floor)).slice(0, 20),
      existingDirections: countValues(rows.map((row) => row.direction)).slice(0, 30),
      existingTypes: countValues(rows.map((row) => row.type)).slice(0, 12),
      areaSuiteSamples: samples,
      allowedDeviceTypes: allowedDeviceTypes(rows),
      allowedTypes: allowedTypes(rows)
    };
  }

  function formatCounts(entries) {
    return entries.map(([value, count]) => `${value} (${count})`).join("; ") || "none";
  }

  function profileText(profile) {
    return [
      `Rows: ${profile.rowCount}`,
      `Exported DeviceTypes: ${formatCounts(profile.deviceTypes)}`,
      `Models by DeviceType: ${profile.modelsByType.map(([type, models]) => `${type} → ${formatCounts(models)}`).join(" | ")}`,
      `Description column values (often the panel's Building\\Wing\\Floor Zone label): ${formatCounts(profile.descriptionLabels)}`,
      `Existing Floor values: ${formatCounts(profile.existingFloors)}`,
      `Existing Direction values: ${formatCounts(profile.existingDirections)}`,
      `Existing Type values: ${formatCounts(profile.existingTypes)}`,
      `AreaSuite samples:\n${profile.areaSuiteSamples.join("\n")}`
    ].join("\n");
  }

  const ROLE =
    "You are a senior fire alarm inspection data technician preparing a BuildingReports device export for import. " +
    "Each row is one addressable point on a fire alarm panel. AreaSuite is the technician's shorthand label for the point; " +
    "Description often holds the panel's hierarchical location label (Customer\\Wing\\Floor Zone). DeviceType and ModelNumber " +
    "come from the panel programming. Read each label like an experienced tech: decode abbreviations, separate where the device is " +
    "from what it does, and use the rest of the file as context.";

  function conventionsMessages(profile, options) {
    const settings = options || {};
    const system = [
      ROLE,
      "First, study this file and write the conventions every batch of rows must follow so results are consistent.",
      "Return a JSON object with these keys:",
      "\"site\": one sentence describing the site and its layout;",
      "\"floors\": how floors are written in this file and how to map them to the house Floor format;",
      "\"areas\": array of the wing/building/area names to use for Direction, each spelled exactly as it should appear;",
      "\"glossary\": object mapping abbreviations seen in this file to the expansion to use in Location — only abbreviations whose " +
        "meaning is certain, and never acronyms that stay as written (AHU, FACP, NICU, MRI, IDF, OR);",
      "\"descriptions\": object mapping each recurring function keyword in this file (PULL, SMOKE, DAMPER, TAMPER, AMP, …) to the exact " +
        "Description wording every row with that keyword must use;",
      "\"rules\": array of short file-specific rules (for example how panel labels relate to floors, or which words mean a device type).",
      "House format the conventions must respect:",
      FIELD_RULES.floor,
      FIELD_RULES.direction,
      FIELD_RULES.location,
      FIELD_RULES.description,
      settings.instructions ? `User instructions (these override the house format): ${settings.instructions}` : ""
    ].filter(Boolean).join("\n");
    return [
      { role: "system", content: system },
      { role: "user", content: profileText(profile) }
    ];
  }

  function batchMessages(context, batch, options) {
    const settings = options || {};
    const fields = FIELDS.filter((field) => settings.fields.includes(field.key));
    const outputKeys = ["id", ...fields.map((field) => field.header), "confidence", "note"];
    const system = [
      ROLE,
      "Fill the target columns for every row in the house format below.",
      ...fields.map((field) => FIELD_RULES[field.key]),
      `Allowed DeviceType values: ${context.profile.allowedDeviceTypes.join(", ")}.`,
      "Never alter or return AreaSuite. Do not guess: when information is truly absent, return \"\" (blank).",
      "confidence: \"high\" when every value is directly supported by the text, \"medium\" when you resolved an abbreviation or " +
        "used file context, \"low\" when the row is ambiguous and a person should review it.",
      "note: blank unless confidence is low or the text contains something a reviewer must know; then at most 12 words.",
      `File conventions (follow them for consistency): ${JSON.stringify(context.conventions || {})}`,
      `File profile: Exported DeviceTypes ${formatCounts(context.profile.deviceTypes)}. Models by DeviceType ${context.profile.modelsByType
        .map(([type, models]) => `${type} → ${formatCounts(models)}`).join(" | ")}.`,
      settings.instructions ? `User instructions (these override the house format): ${settings.instructions}` : "",
      `Return JSON: {"rows": [{${outputKeys.map((key) => `"${key}": …`).join(", ")}}]} with one object for every input id, in order.`
    ].filter(Boolean).join("\n");
    const header = ["id", ...INPUT_COLUMNS.map(([, name]) => name)];
    const lines = batch.map((item) => JSON.stringify([item.id, ...item.payload]));
    return [
      { role: "system", content: system },
      { role: "user", content: `Columns: ${JSON.stringify(header)}\nRows:\n${lines.join("\n")}` }
    ];
  }

  function ordinalFloor(number) {
    const n = Number(number);
    const mod100 = n % 100;
    const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
    return `${n}${suffix} Floor`;
  }

  function normalizeFloor(value) {
    const numbered = value.match(/^(?:floor|level|flr)?\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s*(?:floor|flr|fl))?$/i);
    return numbered && Number(numbered[1]) > 0 ? ordinalFloor(numbered[1]) : value;
  }

  function stripFormulaPrefix(value) {
    return value.replace(/^[=+@\s]+/, "").replace(/^-+(?=\D)/, "").trim();
  }

  function zoneIsStated(value, item) {
    if (!value) return true;
    const source = [item.payload[3], item.payload[4]].join(" ");
    const escaped = value.replace(/^0+(?=\d)/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\bZ(?:ONE)?\\s*#?\\s*0*${escaped}\\b`, "i").test(source)
      || clean(item.payload[8]) === value;
  }

  function capitalizeWords(value) {
    return value.replace(/(^|[\s/(-])([a-z])(?=[a-z]*\b)/g, (match, lead, letter) => lead + letter.toUpperCase());
  }

  function canonicalValue(value, allowed) {
    const text = clean(value).toLowerCase();
    return allowed.find((item) => item.toLowerCase() === text) || "";
  }

  function deviceTypeChangeAllowed(value, exported) {
    const next = value.toLowerCase();
    const current = clean(exported).toLowerCase();
    if (next === current) return true;
    if (GENERIC_DEVICE_TYPES.includes(next)) return false;
    return !(RELAY_DEVICE_TYPES.includes(current) && DETECTOR_DEVICE_TYPES.includes(next));
  }

  function parseJsonContent(content) {
    const text = String(content || "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    return JSON.parse(text);
  }

  function parseBatchResponse(content, batch, options) {
    const settings = options || {};
    const data = parseJsonContent(content);
    const items = Array.isArray(data) ? data : Array.isArray(data && data.rows) ? data.rows : [];
    const expected = new Map(batch.map((item) => [Number(item.id), item]));
    const fields = FIELDS.filter((field) => settings.fields.includes(field.key));
    const results = new Map();
    items.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const id = Number(item.id);
      if (!expected.has(id) || results.has(id)) return;
      const values = {};
      fields.forEach((field) => {
        const raw = item[field.header] != null ? item[field.header] : item[field.key];
        if (raw == null || typeof raw === "object") return;
        let value = stripFormulaPrefix(clean(raw).slice(0, 160));
        if (["direction", "location", "description"].includes(field.key)) value = capitalizeWords(value);
        if (field.key === "floor") value = normalizeFloor(value);
        if (field.key === "zone" && !zoneIsStated(value, expected.get(id))) return;
        if (field.key === "deviceType") value = canonicalValue(value, settings.allowedDeviceTypes || KNOWN_DEVICE_TYPES);
        if (field.key === "deviceType" && !value) return;
        if (field.key === "deviceType" && !deviceTypeChangeAllowed(value, expected.get(id).payload[0])) return;
        if (field.key === "type" && value) {
          value = canonicalValue(value, settings.allowedTypes || KNOWN_TYPES);
          if (!value) return;
        }
        values[field.key] = value;
      });
      const confidence = ["high", "medium", "low"].includes(clean(item.confidence).toLowerCase())
        ? clean(item.confidence).toLowerCase()
        : "medium";
      results.set(id, { values, confidence, note: clean(item.note).slice(0, 200) });
    });
    return results;
  }

  function friendlyError(status, body) {
    let detail = "";
    try {
      const parsed = JSON.parse(body);
      detail = (parsed.error && parsed.error.message) || parsed.message || "";
    } catch {
      detail = String(body || "").slice(0, 200);
    }
    if (status === 401) return "DeepSeek rejected the API key. Check the key and try again.";
    if (status === 402) return "The DeepSeek account has insufficient balance.";
    if (status === 429) return "DeepSeek is rate limiting requests. Wait a minute and try again.";
    return `DeepSeek request failed (${status})${detail ? `: ${detail}` : "."}`;
  }

  function wait(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) {
        reject(signal.reason || new Error("Cancelled"));
        return;
      }
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal.reason || new Error("Cancelled"));
      };
      const timer = setTimeout(() => {
        if (signal) signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      if (signal) signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  async function callDeepSeek(request) {
    const fetchImpl = request.fetchImpl || globalThis.fetch.bind(globalThis);
    const body = {
      model: request.model || DEFAULT_MODEL,
      messages: request.messages,
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      temperature: 0,
      max_tokens: request.maxTokens || 8192,
      stream: false
    };
    const delays = request.retryDelays || [2000, 6000, 15000];
    for (let attempt = 0; ; attempt += 1) {
      let response;
      try {
        response = await fetchImpl(ENDPOINT, {
          method: "POST",
          headers: { Authorization: `Bearer ${request.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: request.signal
        });
      } catch (error) {
        if (request.signal && request.signal.aborted) throw error;
        if (attempt >= delays.length) throw new Error("Could not reach DeepSeek. Check the internet connection.");
        await wait(delays[attempt], request.signal);
        continue;
      }
      const text = await response.text();
      if (response.ok) {
        const data = JSON.parse(text);
        const choice = data.choices && data.choices[0];
        return {
          content: (choice && choice.message && choice.message.content) || "",
          finishReason: (choice && choice.finish_reason) || "",
          usage: data.usage || {}
        };
      }
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt >= delays.length) {
        const error = new Error(friendlyError(response.status, text));
        error.status = response.status;
        throw error;
      }
      await wait(delays[attempt], request.signal);
    }
  }

  function dedupeRows(rows) {
    const groups = new Map();
    rows.forEach((row) => {
      const payload = rowPayload(row);
      const key = JSON.stringify(payload);
      if (!groups.has(key)) groups.set(key, { payload, indexes: [] });
      groups.get(key).indexes.push(row.index);
    });
    return Array.from(groups.values()).map((group, position) => ({ id: position + 1, ...group }));
  }

  function addUsage(total, usage) {
    total.promptTokens += usage.prompt_tokens || 0;
    total.completionTokens += usage.completion_tokens || 0;
    total.cacheHitTokens += usage.prompt_cache_hit_tokens || 0;
    total.requests += 1;
  }

  async function runAiFill(options) {
    const settings = {
      model: DEFAULT_MODEL,
      batchSize: 40,
      concurrency: 6,
      instructions: "",
      fields: FIELDS.filter((field) => field.defaultOn).map((field) => field.key),
      ...options
    };
    const contextRows = settings.contextRows || settings.rows;
    const profile = buildFileProfile(contextRows);
    const usage = { promptTokens: 0, completionTokens: 0, cacheHitTokens: 0, requests: 0 };
    const progress = (update) => settings.onProgress && settings.onProgress(update);
    const stop = new AbortController();
    if (settings.signal) {
      if (settings.signal.aborted) stop.abort(settings.signal.reason);
      else settings.signal.addEventListener("abort", () => stop.abort(settings.signal.reason), { once: true });
    }
    const request = (messages) => callDeepSeek({
      apiKey: settings.apiKey,
      model: settings.model,
      messages,
      signal: stop.signal,
      fetchImpl: settings.fetchImpl,
      retryDelays: settings.retryDelays
    });

    progress({ phase: "conventions", done: 0, total: 0 });
    let conventions = {};
    try {
      const reply = await request(conventionsMessages(profile, settings));
      addUsage(usage, reply.usage);
      conventions = parseJsonContent(reply.content);
    } catch (error) {
      if (error.status || stop.signal.aborted) throw error;
      conventions = {};
    }

    const groups = dedupeRows(settings.rows);
    const queue = [];
    for (let i = 0; i < groups.length; i += settings.batchSize) queue.push(groups.slice(i, i + settings.batchSize));
    const context = { profile, conventions };
    const parseOptions = {
      fields: settings.fields,
      allowedDeviceTypes: profile.allowedDeviceTypes,
      allowedTypes: profile.allowedTypes
    };
    const results = new Map();
    const failed = [];
    let done = 0;
    progress({ phase: "rows", done, total: groups.length });

    async function runBatch(batch, depth) {
      let parsed = new Map();
      let truncated = false;
      try {
        const reply = await request(batchMessages(context, batch, settings));
        addUsage(usage, reply.usage);
        truncated = reply.finishReason === "length";
        parsed = parseBatchResponse(reply.content, batch, parseOptions);
      } catch (error) {
        if (error.status === 401 || error.status === 402 || stop.signal.aborted) throw error;
        if (depth >= 2) {
          batch.forEach((item) => failed.push(item));
          done += batch.length;
          progress({ phase: "rows", done, total: groups.length });
          return;
        }
      }
      const missing = batch.filter((item) => !parsed.has(item.id));
      const received = [];
      batch.forEach((item) => {
        if (!parsed.has(item.id)) return;
        const suggestion = parsed.get(item.id);
        item.indexes.forEach((index) => {
          results.set(index, suggestion);
          received.push([index, suggestion]);
        });
      });
      if (received.length && settings.onBatch) settings.onBatch(received);
      done += batch.length - missing.length;
      progress({ phase: "rows", done, total: groups.length });
      if (!missing.length) return;
      if (depth >= 2 || (missing.length === batch.length && !truncated && depth >= 1)) {
        missing.forEach((item) => failed.push(item));
        done += missing.length;
        progress({ phase: "rows", done, total: groups.length });
        return;
      }
      const half = Math.ceil(missing.length / 2);
      const parts = missing.length > 4 ? [missing.slice(0, half), missing.slice(half)] : [missing];
      for (const part of parts) await runBatch(part, depth + 1);
    }

    let fatal = null;
    async function worker() {
      while (queue.length && !fatal) {
        const batch = queue.shift();
        try {
          await runBatch(batch, 0);
        } catch (error) {
          if (!fatal) {
            fatal = error;
            stop.abort(error);
          }
        }
      }
    }

    const workers = [];
    for (let i = 0; i < Math.min(settings.concurrency, queue.length); i += 1) workers.push(worker());
    await Promise.all(workers);
    if (fatal) throw fatal;

    return {
      results,
      conventions,
      usage,
      failedRows: failed.reduce((count, item) => count + item.indexes.length, 0),
      uniqueRows: groups.length
    };
  }

  return {
    ENDPOINT,
    DEFAULT_MODEL,
    MODELS,
    FIELDS,
    KNOWN_DEVICE_TYPES,
    buildFileProfile,
    conventionsMessages,
    batchMessages,
    parseBatchResponse,
    callDeepSeek,
    dedupeRows,
    runAiFill
  };
});
