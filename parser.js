(function attachParser(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BRParser = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildParser() {
  "use strict";

  const ACRONYMS = new Set([
    "AC", "AHU", "BPS", "CC1S", "EOL", "FACP", "HVAC", "MCC", "MCCR",
    "ADA", "CO", "DOAS", "EA", "ER", "IDF", "MRI", "NAC", "NO2", "OA", "OR",
    "PBX", "PIV", "QA", "RO", "RTU", "SE", "SW", "NE", "NW", "VAV", "WF"
  ]);

  const DESCRIPTION_RULES = [
    { pattern: /\bMAIN\s+FIRE\s+PUMP\s+FAIL?URE\b/i, value: "Main Fire Pump Failure", strip: /\bMAIN\s+FIRE\s+PUMP\s+FAIL?URE\b/ig },
    { pattern: /\bMAIN\s+FIRE\s+PUMP\s+RUNNING\b/i, value: "Main Fire Pump Running", strip: /\bMAIN\s+FIRE\s+PUMP\s+RUNNING\b/ig },
    { pattern: /\bMAIN\s+FIRE\s+PUMP\s+CONTROL+ER\b/i, value: "Main Fire Pump Controller", strip: /\bMAIN\s+FIRE\s+PUMP\s+CONTROL+ER\b/ig },
    { pattern: /\bFLAMELES+\s+V(?:E)?NT\s+SYS(?:TEM)?\b.*\bFAULT\b/i, value: "Flameless Vent System Fault", strip: /\bFLAMELES+\s+V(?:E)?NT\s+SYS(?:TEM)?\b|\bFAULT\b/ig },
    { pattern: /\bFLAMELES+\s+V(?:E)?NT\s+SYS(?:TEM)?\b.*\bSERV(?:I?C?E?|C)\b/i, value: "Flameless Vent System Service", strip: /\bFLAMELES+\s+V(?:E)?NT\s+SYS(?:TEM)?\b|\bSERV(?:I?C?E?|C)\b/ig },
    { pattern: /\bFLAMELES+\s+V(?:E)?NT\s+SYS(?:TEM)?\b.*\bALARM\b/i, value: "Flameless Vent System Alarm", strip: /\bFLAMELES+\s+V(?:E)?NT\s+SYS(?:TEM)?\b|\bALARM\b/ig },
    { pattern: /\bPULL\b/i, value: "Pull Station", strip: /\bPULL\b/ig },
    { pattern: /\b(?:DUCT\s+(?:SMK|SMOKE)|(?:SMK|SMOKE)\s+DUCT|DUCT\s+AHU\w*)\b/i, value: "Duct Detector", strip: /\bDUCT\b|\bSMK\b|\bSMOKE\b/ig },
    { pattern: /\bSMOKE\b|\bSMK\b/i, value: "Smoke Detector", strip: /\bSMOKE\b|\bSMK\b/ig },
    { pattern: /\bHEAT(?:\/TEMP)?\s+SENSOR\b|\bHEAT\b/i, value: "Heat Detector", strip: /\bHEAT(?:\/TEMP)?\s+SENSOR\b|\bHEAT\b/ig },
    { pattern: /\bWATER\s*FLOW\b|\bWATERFLOW\b/i, value: "Waterflow Switch", strip: /\bWATER\s*FLOW\b|\bWATERFLOW\b/ig },
    { pattern: /\bLOW\s+AIR\b/i, value: "Low Air Supervisory", strip: /\bLOW\s+AIR\b/ig },
    { pattern: /\bTAMPER(?:S)?\b/i, value: "Tamper Switch", strip: /\bTAMPER(?:S)?\b/ig },
    { pattern: /\bGATE\s*VALVE\b/i, value: "Gate Valve Monitor", strip: /\bGATE\s*VALVE\b/ig },
    { pattern: /\bTEMP(?:ATURE)?\s+(?:SENSOR|MONITOR|ALARM)\b/i, value: "Temperature Monitor", strip: /\bTEMP(?:ATURE)?\s+(?:SENSOR|MONITOR|ALARM)\b/ig },
    { pattern: /\bAHU[\w-]*\b.*\bSHUTDOWN\b|\bSHUTDOWN\b.*\bAHU[\w-]*\b/i, value: "AHU Shutdown Relay", strip: /\bSHUTDOWN\b/ig },
    { pattern: /\b(?:PWR|POWER)\s+S(?:U)?P(?:P)?L(?:Y)?\b/i, value: "Power Supply", strip: /\b(?:PWR|POWER)\s+S(?:U)?P(?:P)?L(?:Y)?\b/ig },
    { pattern: /\bAC\s+POWER\b/i, value: "AC Power Monitor", strip: /\bAC\s+POWER\b/ig },
    { pattern: /\bSUPERVISORY\b|\bSUPERFVISORY\b/i, value: "Supervisory Monitor", strip: /\bSUPERVISORY\b|\bSUPERFVISORY\b/ig },
    { pattern: /\b(?:AMP|AMPLIFIER)\b/i, value: "Voice Evacuation Amplifier", strip: /\bAMP(?:LIFIER)?\b/ig },
    { pattern: /\bAUDIO\b|\bAUDIBLE\b/i, value: "Audio Circuit", strip: /\bAUDIO\b|\bAUDIBLE\b/ig },
    { pattern: /\bSTROBES?\b/i, value: "Strobe Circuit", strip: /\bSTROBES?\b/ig },
    { pattern: /\bRELAY\b|\bEOL\b/i, value: "Control Relay", strip: /\bRELAY\b|\bEOL\b/ig },
    { pattern: /\bSPARE(?:\s+INPUT)?\b/i, value: "Spare Input", strip: /\bSPARE(?:\s+INPUT)?\b/ig },
    { pattern: /\bFAULT\b/i, value: "System Fault", strip: /\bFAULT\b/ig },
    { pattern: /\bPANEL\s+TROUBLE\b|\bDEVICE\s+TROUBLE\b/i, value: "Panel Trouble", strip: /\bPANEL\s+TROUBLE\b|\bDEVICE\s+TROUBLE\b/ig },
    { pattern: /\bALARM\b/i, value: "Alarm Monitor", strip: /\bALARM\b/ig }
  ];

  const DEVICE_FALLBACKS = [
    [/pull station/i, "Pull Station"],
    [/smoke detector/i, "Smoke Detector"],
    [/duct detector/i, "Duct Detector"],
    [/heat detector/i, "Heat Detector"],
    [/power supply/i, "Power Supply"],
    [/voice evacuation/i, "Voice Evacuation"],
    [/programmable relay/i, "Control Relay"],
    [/initiating device/i, "Initiating Device"]
  ];

  function detectDelimiter(text) {
    const sample = String(text || "").slice(0, 10000);
    const candidates = [",", "\t", ";"];
    let inQuotes = false;
    const counts = new Map(candidates.map((value) => [value, 0]));
    for (let i = 0; i < sample.length; i += 1) {
      const char = sample[i];
      if (char === '"') {
        if (inQuotes && sample[i + 1] === '"') i += 1;
        else inQuotes = !inQuotes;
      } else if (!inQuotes && candidates.includes(char)) {
        counts.set(char, counts.get(char) + 1);
      } else if (!inQuotes && (char === "\r" || char === "\n")) {
        break;
      }
    }
    return candidates.sort((a, b) => counts.get(b) - counts.get(a))[0];
  }

  function parseCsv(text, delimiter) {
    const source = String(text == null ? "" : text).replace(/^\uFEFF/, "");
    const separator = delimiter || detectDelimiter(source);
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      if (quoted) {
        if (char === '"') {
          if (source[i + 1] === '"') {
            cell += '"';
            i += 1;
          } else {
            quoted = false;
          }
        } else {
          cell += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === separator) {
        row.push(cell);
        cell = "";
      } else if (char === "\r" || char === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        if (char === "\r" && source[i + 1] === "\n") i += 1;
      } else {
        cell += char;
      }
    }

    if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
    if (cell.length || row.length) {
      row.push(cell);
      rows.push(row);
    }

    while (rows.length && rows[rows.length - 1].every((value) => value === "")) rows.pop();
    if (!rows.length) throw new Error("This CSV does not contain any rows.");
    return { headers: rows[0], rows: rows.slice(1), delimiter: separator };
  }

  function stringifyCsv(headers, rows, delimiter) {
    const separator = delimiter || ",";
    const quote = (value) => `"${String(value == null ? "" : value).replace(/"/g, '""')}"`;
    return [headers, ...rows].map((row) => row.map(quote).join(separator)).join("\r\n") + "\r\n";
  }

  function normalizeHeader(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function findColumn(headers, names) {
    const wanted = names.map(normalizeHeader);
    return headers.findIndex((header) => wanted.includes(normalizeHeader(header)));
  }

  function normalizeForParsing(value) {
    return String(value || "")
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function ordinal(number) {
    const n = Number(number);
    const mod100 = n % 100;
    const suffix = mod100 >= 11 && mod100 <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
    return `${n}${suffix} Floor`;
  }

  function extractFloor(source) {
    const text = normalizeForParsing(source);
    const named = [
      [/\bPENT\s*HOUSE\b/i, "Penthouse"],
      [/\bMEZZ(?:ANINE|ANNE|A)?\b/i, "Mezzanine"],
      [/\bROOF\s*TOP\b|\bROOF\b/i, "Roof"],
      [/\bBASEMENT\b|\bBSMT\b/i, "Basement"],
      [/\bGROUND\s+(?:FLOOR|LEVEL)\b/i, "Ground Floor"],
      [/\bLOWER\s+LEVEL\b|\bLL\b/i, "Lower Level"],
      [/\bUPPER\s+LEVEL\b/i, "Upper Level"]
    ];
    for (const [pattern, value] of named) {
      const match = text.match(pattern);
      if (match) return { value, matched: match[0] };
    }

    const parking = text.match(/\b(\d{1,2})\s*P\s*(?:LEVEL)?\b/i);
    if (parking) return { value: `${Number(parking[1])}P`, matched: parking[0] };

    const numeric = text.match(/\b(?:LEVEL\s*)?(\d{1,2})(?:ST|ND|RD|TH)?\s*(?:FLOOR|FLOO|FOOLR|FLR|FL)\b/i)
      || text.match(/\b(\d{1,2})(?:ST|ND|RD|TH)?FL\b/i)
      || text.match(/\b(?:FLOOR|FLOO|FOOLR|FLR|FL)\s*(\d{1,2})\b/i)
      || text.match(/\bLEVEL\s*(\d{1,2})\b/i);
    if (numeric) return { value: ordinal(numeric[1]), matched: numeric[0] };

    const wordFloors = [
      [/\bFIRST\s+(?:FLOOR|LEVEL)\b/i, "1st Floor"],
      [/\bSECOND\s+(?:FLOOR|LEVEL)\b/i, "2nd Floor"],
      [/\bTHIRD\s+(?:FLOOR|LEVEL)\b/i, "3rd Floor"],
      [/\bFOURTH\s+(?:FLOOR|LEVEL)\b/i, "4th Floor"]
    ];
    for (const [pattern, value] of wordFloors) {
      const match = text.match(pattern);
      if (match) return { value, matched: match[0] };
    }
    return { value: "", matched: "" };
  }

  function descriptionFrom(source, deviceType) {
    const text = normalizeForParsing(source);
    for (const rule of DESCRIPTION_RULES) {
      if (rule.pattern.test(text)) return { value: rule.value, rule, inferred: true };
    }
    for (const [pattern, value] of DEVICE_FALLBACKS) {
      if (pattern.test(deviceType || "")) return { value, rule: null, inferred: false };
    }
    return { value: "", rule: null, inferred: false };
  }

  const GENERIC_INPUT_TYPES = new Set(["", "initiating device", "monitor device", "module", "alarm device", "supervisory device"]);
  const RELAY_TYPES = new Set(["programmable relay", "non-programmable relay", "control relay", "relay"]);

  // Each rule names the exported type classes it may correct: "input" (generic monitor modules),
  // "relay" (relay outputs), "device" (every other exported type), or one exact exported type.
  // A null value keeps the exported type as settled. A relay never becomes a detector.
  const DEVICE_TYPE_RULES = [
    [/\bAUDIO\b/i, null, ["input"]],
    [/^(?!.*\b(?:TROUBLE|TRBL|FAULT)\b).*\bSTROBE\s+(?:PANEL|CONTROL)S?\b/i, "Programmable Relay", ["input"]],
    [/\bAMP(?:LIFIER)?S?\b|\bAA\d{2,3}\b/i, "Amplifier", ["voice evacuation"]],
    [/\bPULL(?:\s+STATION)?\b/i, "Pull Station", ["input", "device"]],
    [/\bBEAM\b/i, "Beam Detector", ["input", "relay"]],
    [/\bDUCT\b/i, "Duct Detector", ["input", "device"]],
    [/\bFIRE\s+CURTAINS?\b/i, "Fire Curtain", ["input", "relay"]],
    [/\bSMOKE\s+CURTAINS?\b|\bROLL(?:ING)?[\s-]*(?:DOWN[\s-]*)?DOORS?\b|\bROLL[\s-]*DOWN\b/i, "Roll Down Door", ["input", "relay"]],
    [/\bSMOKE\b|\bSMK\b|\bSOMKE\b/i, "Smoke Detector", ["input", "device"]],
    [/\bHEAT(?:\s+DETECTOR)?\b/i, "Heat Detector", ["input", "device"]],
    [/\b(?:WATE{1,2}R|WTR)[\s-]*(?:FLOWS?|LFOW|FOW)\b|\bFLOW\s+SW(?:ITCH)?\b/i, "Waterflow Switch", ["input", "device"]],
    [/\bTAMPERS?\b|\bTAMP\b|\bPIV\b|\bOS\s*&\s*Y\b/i, "Tamper Switch", ["input", "device"]],
    [/\b(?:LOW?|HI(?:GH)?)(?:\s*[/-]\s*(?:LOW?|HI(?:GH)?))?\s+AIR\b|\bAIR\s+PRESS(?:URE)?\b/i, "Air Pressure Switch", ["input", "device"]],
    [/\bANSUL\b|\bKITCHEN\s+HOOD\b|\bHOOD\s+(?:SYSTEM|SUPP?RESSION)\b/i, "Kitchen Hood", ["input"]],
    [/\bFIRE\s+PUMP\s+RUN(?:NING)?\b/i, "Fire Pump Running", ["input"]],
    [/\bFIRE\s+PUMP\s+PHASE\s+REV(?:ERSAL)?\b/i, "Fire Pump Phase Reversal", ["input"]],
    [/\bFIRE\s+PUMP\s+(?:POWER|PWR)\b/i, "Fire Pump Power", ["input"]],
    [/\bFIRE\s+PUMP\s+(?:TROUBLE|TRBL)\b/i, "Fire Pump Trouble", ["input"]],
    [/\b(?:PWR|POWER)\s+S(?:U)?P(?:P)?L(?:Y)?\b/i, "Power Supply", ["input", "device"]],
    [/\bPRE[\s-]*ACTION\b/i, "Pre-Action System", ["input", "relay"]],
    [/^(?=.*\bELEV(?:ATOR)?S?\b)(?=.*\b(?:RECALL|SHUNT|(?:FIRE\s*)?HAT)\b)/i, "Elevator", ["input", "relay"]],
    [/\bDAMPERS?\b/i, "Damper Control", ["relay"]],
    [/\bPURGE\b/i, "Fan Purge System", ["relay"]],
    [/^(?=.*\b(?:AHUS?|RTUS?|MAU|CAU|ERU|HRU|EF|FANS?|EXHAUST|AIR\s+HANDL\w*)\b)(?=.*\bSHUT[\s-]*DO?WN\b)/i, "Fan Shutdown", ["relay"]],
    [/\bAUTO[\s-]*DOORS?\b/i, "Releasing Device", ["relay"]]
  ];

  function deviceTypeClass(key) {
    if (RELAY_TYPES.has(key)) return "relay";
    return GENERIC_INPUT_TYPES.has(key) ? "input" : "device";
  }

  function matchDeviceTypeRule(source, currentDeviceType) {
    const text = normalizeForParsing(source);
    const current = String(currentDeviceType || "").trim();
    const key = current.toLowerCase();
    const typeClass = deviceTypeClass(key);
    for (const [pattern, value, appliesTo] of DEVICE_TYPE_RULES) {
      if ((appliesTo.includes(typeClass) || appliesTo.includes(key)) && pattern.test(text)) {
        return { value: value || current, matched: true };
      }
    }
    return { value: current, matched: false };
  }

  function inferDeviceType(source, currentDeviceType) {
    return matchDeviceTypeRule(source, currentDeviceType).value;
  }

  const DEFAULT_MODEL_NUMBERS = new Map([
    ["pull station", "SIGA-278"]
  ]);

  function normalizedEvidenceKey(value) {
    return normalizeForParsing(value).toLowerCase();
  }

  function addModelEvidence(index, key, modelNumber) {
    if (!key || !modelNumber) return;
    if (!index.has(key)) index.set(key, new Map());
    const models = index.get(key);
    const normalizedModel = normalizedEvidenceKey(modelNumber);
    const current = models.get(normalizedModel) || { value: normalizeForParsing(modelNumber), count: 0 };
    current.count += 1;
    models.set(normalizedModel, current);
  }

  function resolveModelEvidence(models) {
    if (!models || !models.size) return { value: "", evidence: 0, ambiguous: false };
    const ranked = Array.from(models.values()).sort((left, right) => right.count - left.count);
    const total = ranked.reduce((sum, item) => sum + item.count, 0);
    if (ranked.length === 1) return { value: ranked[0].value, evidence: total, ambiguous: false };
    const dominant = ranked[0].count >= 2
      && ranked[0].count / total >= 0.8
      && ranked[0].count > ranked[1].count;
    return {
      value: dominant ? ranked[0].value : "",
      evidence: total,
      ambiguous: !dominant
    };
  }

  function modelEvidenceIndexes(records) {
    const byDeviceType = new Map();
    const byManufacturerAndType = new Map();

    records.forEach((record) => {
      const inferredType = normalizedEvidenceKey(
        (record.inferred && record.inferred.deviceType) || record.deviceType
      );
      const originalType = normalizedEvidenceKey(
        (record.original && record.original.deviceType) || record.originalDeviceType
      );
      const modelNumber = normalizeForParsing(
        (record.original && record.original.modelNumber) || record.modelNumber
      );
      if (!inferredType || inferredType !== originalType || !modelNumber) return;

      const manufacturer = normalizedEvidenceKey(
        record.manufacturer || (record.original && record.original.manufacturer)
      );
      addModelEvidence(byDeviceType, inferredType, modelNumber);
      if (manufacturer) addModelEvidence(byManufacturerAndType, `${manufacturer}||${inferredType}`, modelNumber);
    });

    return { byDeviceType, byManufacturerAndType };
  }

  function inferModelNumberFromIndexes(deviceType, manufacturer, indexes) {
    const typeKey = normalizedEvidenceKey(deviceType);
    if (!typeKey) return { value: "", source: "", evidence: 0 };
    const manufacturerKey = normalizedEvidenceKey(manufacturer);

    if (manufacturerKey) {
      const manufacturerResult = resolveModelEvidence(
        indexes.byManufacturerAndType.get(`${manufacturerKey}||${typeKey}`)
      );
      if (manufacturerResult.value) {
        return {
          value: manufacturerResult.value,
          source: "manufacturer-device context",
          evidence: manufacturerResult.evidence
        };
      }
    }

    const typeEvidence = indexes.byDeviceType.get(typeKey);
    const typeResult = resolveModelEvidence(typeEvidence);
    if (typeResult.value) {
      return {
        value: typeResult.value,
        source: "device context",
        evidence: typeResult.evidence
      };
    }

    // Conflicting in-file evidence is stronger than a generic default.
    if (typeResult.ambiguous) return { value: "", source: "conflicting context", evidence: typeResult.evidence };

    const defaultValue = DEFAULT_MODEL_NUMBERS.get(typeKey) || "";
    return {
      value: defaultValue,
      source: defaultValue ? "known device mapping" : "",
      evidence: 0
    };
  }

  function inferModelNumber(deviceType, manufacturer, records) {
    return inferModelNumberFromIndexes(deviceType, manufacturer, modelEvidenceIndexes(records || []));
  }

  function applyModelContext(records) {
    const indexes = modelEvidenceIndexes(records);
    records.forEach((record) => {
      if (!record.inferred) return;
      if (record.inferred.modelNumber) return;
      if (!Array.isArray(record.inferred.reasons)) record.inferred.reasons = [];
      const suggestion = inferModelNumberFromIndexes(
        record.inferred.deviceType || record.deviceType,
        record.manufacturer || (record.original && record.original.manufacturer),
        indexes
      );
      record.inferred.modelNumber = suggestion.value;
      record.inferred.modelNumberSource = suggestion.source;
      record.inferred.modelNumberEvidence = suggestion.evidence;
      if (suggestion.value) {
        const contextText = suggestion.evidence === 1 ? "matching row" : "matching rows";
        record.inferred.reasons.push(
          suggestion.evidence
            ? `model matched from ${suggestion.evidence} ${contextText}`
            : "model matched from device type"
        );
      }
    });
    return records;
  }

  function cleanDescription(value) {
    const original = normalizeForParsing(value);
    if (!original) return "";
    let result = original;
    if (result.includes("\\")) {
      const segments = result.split("\\").map((segment) => segment.trim()).filter(Boolean);
      if (segments.length > 1) result = segments.slice(1).join(" / ");
    }
    result = cleanupSpelling(result);
    const letters = result.replace(/[^A-Za-z]/g, "");
    if (letters && letters === letters.toUpperCase()) result = titleCaseField(result);
    const describedFloor = extractFloor(result);
    if (describedFloor.matched) result = result.replace(describedFloor.matched, describedFloor.value);
    return result;
  }

  function titleCaseField(value) {
    return String(value || "")
      .split(/(\s+|\/)/)
      .map((token) => {
        if (/^\s+$|^\/$/.test(token)) return token;
        const upper = token.toUpperCase();
        const ordinalToken = token.match(/^(\d+)(ST|ND|RD|TH)$/i);
        if (ordinalToken) return `${ordinalToken[1]}${ordinalToken[2].toLowerCase()}`;
        if (ACRONYMS.has(upper) || /\d/.test(token) || /^[A-Z]\d/.test(upper)) return upper;
        if (/^(N|S|E|W)\.?$/i.test(token)) return upper;
        return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
      })
      .join("")
      .replace(/\bBldg\.?\s*/gi, "Building ")
      .replace(/\bBuilding\s*\.?\s*/gi, "Building ")
      .replace(/\bRm\b/g, "Room")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanupSpelling(value) {
    const replacements = [
      [/\bAERA\b/gi, "AREA"],
      [/\bINGEDIENTS?\b/gi, (word) => /S$/i.test(word) ? "INGREDIENTS" : "INGREDIENT"],
      [/\bFINSHED\b|\bFINIS\b/gi, "FINISHED"],
      [/\bMAINTANCE\b|\bMAINTENCE\b|\bMAINTANCE\b/gi, "MAINTENANCE"],
      [/\bANMONIA\b/gi, "AMMONIA"],
      [/\bMEZZANNE\b|\bMEZZA\b/gi, "MEZZANINE"],
      [/\bCOMPRES\b/gi, "COMPRESSOR"],
      [/\bFRIEGHT\b/gi, "FREIGHT"],
      [/\bSTORBES\b/gi, "STROBES"],
      [/\bGUAGE\b/gi, "GAUGE"],
      [/\bFALURE\b/gi, "FAILURE"],
      [/\bSUPERFVISORY\b/gi, "SUPERVISORY"],
      [/\bSOMKE\b/gi, "SMOKE"],
      [/\bSPRINKLE\s+RM\b/gi, "SPRINKLER ROOM"],
      [/\bSERVERRM\b/gi, "SERVER ROOM"],
      [/\bMOBILEMRI\b/gi, "MOBILE MRI"],
      [/\bMACH\s+ROOM\b/gi, "MACHINE ROOM"],
      [/\bFLAMELES+\b/gi, "FLAMELESS"],
      [/\bVNT\s+SYS\b/gi, "VENT SYSTEM"],
      [/\bSERVC\b/gi, "SERVICE"]
    ];
    let result = String(value || "").replace(/(\d)([A-Z]{3,})\b/g, "$1 $2");
    for (const [pattern, replacement] of replacements) result = result.replace(pattern, replacement);
    return result;
  }

  function stripDeviceLanguage(text, deviceType) {
    const type = String(deviceType || "").toLowerCase();
    let result = text;
    if (/pull station/.test(type) || /\bPULL\b/i.test(result)) {
      result = result
        .replace(/^\s*(?:\d+\s+)?PULL(?:\s+STATION)?\b/i, " ")
        .replace(/\bPULL\s+STATION\b/ig, " ");
    }
    if (/smoke detector/.test(type)) {
      result = result.replace(/\bSMOKE\s*(?:DET(?:ECTOR)?\.?)?/ig, " ");
    }
    if (/duct detector/.test(type) || /^\s*DUCT\b/i.test(result)) {
      result = result.replace(/\bDUCT(?:\s+(?:SMK|SMOKE))?\s*(?:DET(?:ECTOR)?\.?)?/ig, " ");
    }
    if (/heat detector/.test(type) || /^\s*HEAT\b/i.test(result)) {
      result = result
        .replace(/^\s*HEAT(?:\/TEMP(?:\s+SENSOR)?)?\b/i, " ")
        .replace(/\bHEAT(?:\s*\/\s*CO)?\s*(?:DET(?:ECTOR)?\.?)?S?/ig, " ");
    }
    if (/power supply/.test(type)) {
      result = result.replace(/^\s*(?:PWR|POWER)\s+S(?:U)?P(?:P)?L(?:Y)?\b/i, " ");
    }
    if (/voice evacuation/.test(type)) {
      result = result.replace(/^\s*(?:AMP|AUDIO|AUDIBLE)\b/i, " ");
    }
    return result;
  }

  const DIRECTION_PATTERNS = [
    { pattern: /\b(?:NORTH[\s-]*EAST|NORTHEAST|N\s*[\/,.-]\s*E|N\.?\s+E\.?|NE)\b/i, value: "Northeast" },
    { pattern: /\b(?:NORTH[\s-]*WEST|NORTHWEST|N\s*[\/,.-]\s*W|N\.?\s+W\.?|NW)\b/i, value: "Northwest" },
    { pattern: /\b(?:SOUTH[\s-]*EAST|SOUTHEAST|S\s*[\/,.-]\s*E|S\.?\s+E\.?|SE)\b/i, value: "Southeast" },
    { pattern: /\b(?:SOUTH[\s-]*WEST|SOUTHWEST|S\s*[\/,.-]\s*W|S\.?\s+W\.?|SW)\b/i, value: "Southwest" },
    { pattern: /\bNORTH\b|(?<![A-Z0-9])N(?![A-Z0-9])/i, value: "North" },
    { pattern: /\bSOUTH\b|(?<![A-Z0-9])S(?![A-Z0-9])/i, value: "South" },
    { pattern: /\bEAST\b|(?<![A-Z0-9])E(?![A-Z0-9])/i, value: "East" },
    { pattern: /\bWEST\b|(?<![A-Z0-9])W(?![A-Z0-9])/i, value: "West" }
  ];

  function extractDirection(source) {
    const text = normalizeForParsing(source);
    for (const item of DIRECTION_PATTERNS) {
      const match = text.match(item.pattern);
      if (match) return { value: item.value, matched: match[0] };
    }
    return { value: "", matched: "" };
  }

  function removeMatched(text, matched) {
    if (!matched) return text;
    const escaped = matched.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return text.replace(new RegExp(escaped, "ig"), " ");
  }

  function splitBroadLocation(value, direction) {
    const text = normalizeForParsing(value);
    if (!text) return { direction: direction.value, location: "" };
    if (direction.value) {
      return {
        direction: direction.value,
        location: titleCaseField(normalizeForParsing(removeMatched(text, direction.matched)))
      };
    }

    const patterns = [
      /^(.+?)\s+(BY\s+(?:ROOM|STAIR|VENDING|ELEVATOR|DOOR|EXIT)\b.*)$/i,
      /^(.+?)\s+((?:ROOM|RM)\s*#?\s*[A-Z]?\d+[A-Z-]*)$/i,
      /^(.+?)\s+(LOBBY|LANDING|EXIT|MAIN\s+AREA)$/i
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match || !match[1].trim() || !match[2].trim()) continue;
      return {
        direction: titleCaseField(match[1]),
        location: titleCaseField(match[2].replace(/^RM\b/i, "Room"))
      };
    }
    return { direction: "", location: titleCaseField(text) };
  }

  function extractLocationParts(source, floor, description, deviceType) {
    let text = normalizeForParsing(source);
    if (!text) return { direction: "", location: "" };

    text = stripDeviceLanguage(text, deviceType);
    text = removeMatched(text, floor.matched);

    text = text
      .replace(/\b(?:BLDG|BLD|BUILDING)\.?\s*#?\s*(\d+\s*[A-Z]?|X)\b/ig, "Building $1")
      .replace(/\bDOOR\s*#?\s*([A-Z]?\d+(?:-\d+)?[A-Z]?|X)\b/ig, "Door $1")
      .replace(/\b(?:FLR|FLOOR|FLOO)\b/ig, " ")
      .replace(/^[\s,;:/-]+|[\s,;:/-]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    text = titleCaseField(cleanupSpelling(text));
    return splitBroadLocation(text, extractDirection(text));
  }

  function inferFields(areaSuite, deviceType) {
    const source = String(areaSuite == null ? "" : areaSuite);
    const inferredDeviceType = inferDeviceType(source, deviceType);
    const floor = extractFloor(source);
    const description = descriptionFrom(source, inferredDeviceType);
    const locationParts = extractLocationParts(source, floor, description, inferredDeviceType);
    const location = locationParts.location;
    let confidence = 24;
    const reasons = [];

    if (description.value) {
      confidence += description.inferred ? 18 : 10;
      reasons.push(description.inferred ? "device language recognized" : "device type used");
    }
    if (location) {
      confidence += 30;
      reasons.push("location context retained");
    }
    if (floor.value) {
      confidence += 22;
      reasons.push("floor recognized");
    }
    if (/\b(?:BLDG|BLD|BUILDING|DOOR|ROOM|RM|OFFICE|AREA|AERA|STAIRS?|DOCK|WAREHOUSE|PENTHOUSE|MEZZ|ROOF)\b/i.test(source)) {
      confidence += 6;
    }
    confidence = Math.min(confidence, 98);

    return {
      deviceType: inferredDeviceType,
      floor: floor.value,
      direction: locationParts.direction,
      location,
      description: "",
      classification: description.value,
      confidence,
      level: floor.value && confidence >= 78 ? "high" : confidence >= 58 ? "medium" : "low",
      floorSource: floor.value ? "text" : "",
      reasons
    };
  }

  function placeholderScanNumbers(values) {
    const existing = values.map((value) => normalizeForParsing(value));
    const taken = new Set(existing.filter(Boolean).map((value) => value.toUpperCase()));
    const lengths = new Map();
    existing.forEach((value) => {
      if (/^\d+$/.test(value)) lengths.set(value.length, (lengths.get(value.length) || 0) + 1);
    });
    const width = lengths.size
      ? Array.from(lengths.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]
      : 10;
    let next = 10 ** (width - 1) + 1;
    return existing.map((value) => {
      if (value) return "";
      let candidate = String(next);
      while (taken.has(candidate)) {
        next += 1;
        candidate = String(next);
      }
      next += 1;
      taken.add(candidate);
      return candidate;
    });
  }

  function contextTokens(value) {
    const stopWords = new Set([
      "amp", "area", "at", "audio", "building", "by", "ch", "door", "duct",
      "eol", "exhaust", "floor", "in", "level", "of", "relay", "room", "smoke",
      "supply", "tamper", "the", "to", "wf"
    ]);
    return new Set(
      normalizeForParsing(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 1 && !/^\d+$/.test(token) && !stopWords.has(token))
    );
  }

  function tokenSimilarity(left, right) {
    if (!left.size || !right.size) return { score: 0, shared: 0, jaccard: 0 };
    let intersection = 0;
    left.forEach((token) => {
      if (right.has(token)) intersection += 1;
    });
    return {
      score: intersection / Math.min(left.size, right.size),
      shared: intersection,
      jaccard: intersection / (left.size + right.size - intersection)
    };
  }

  function applyContext(records) {
    const known = records.filter((record) => record.inferred.floorSource === "text");
    const roomFloorCounts = new Map();

    known.forEach((record) => {
      const contextSource = record.parseSource || record.areaSuite;
      const roomMatches = Array.from(
        normalizeForParsing(contextSource).matchAll(/\b(?:ROOM|RM|ELEC(?:TRICAL)?)\s*#?\s*(\d{3,4})\b/ig),
        (match) => match[1]
      );
      roomMatches.forEach((room) => {
        if (!roomFloorCounts.has(room)) roomFloorCounts.set(room, new Map());
        const counts = roomFloorCounts.get(room);
        counts.set(record.inferred.floor, (counts.get(record.inferred.floor) || 0) + 1);
      });
    });

    records.forEach((record) => {
      if (record.inferred.floor || !record.inferred.location) return;
      const contextSource = record.parseSource || record.areaSuite;
      const roomMatch = normalizeForParsing(contextSource).match(/\b(?:ROOM|RM|ELEC(?:TRICAL)?)\s*#?\s*(\d{3,4})\b/i);
      if (roomMatch && roomFloorCounts.has(roomMatch[1])) {
        const ranked = Array.from(roomFloorCounts.get(roomMatch[1]).entries()).sort((a, b) => b[1] - a[1]);
        const total = ranked.reduce((sum, item) => sum + item[1], 0);
        if (ranked.length === 1 || ranked[0][1] / total >= 0.8) {
          record.inferred.floor = ranked[0][0];
          record.inferred.floorSource = "context";
          record.inferred.confidence = Math.max(record.inferred.confidence, 76);
          record.inferred.level = "medium";
          record.inferred.reasons.push(`floor matched from Room ${roomMatch[1]}`);
          return;
        }
      }
      const tokens = contextTokens(record.inferred.location);
      let bestScore = 0;
      let bestFloor = "";
      let tied = false;

      known.forEach((candidate) => {
        if (String(candidate.deviceType || "").toLowerCase() !== String(record.deviceType || "").toLowerCase()) return;
        const candidateTokens = contextTokens(candidate.inferred.location);
        const similarity = tokenSimilarity(tokens, candidateTokens);
        const qualifies = similarity.shared >= 3 && similarity.jaccard >= 0.6;
        if (!qualifies) return;
        if (similarity.score > bestScore + 0.04) {
          bestScore = similarity.score;
          bestFloor = candidate.inferred.floor;
          tied = false;
        } else if (similarity.score >= bestScore - 0.04 && similarity.score >= 0.75 && candidate.inferred.floor !== bestFloor) {
          tied = true;
        }
      });

      if (bestScore >= 0.75 && !tied && tokens.size >= 2) {
        record.inferred.floor = bestFloor;
        record.inferred.floorSource = "context";
        record.inferred.confidence = Math.max(record.inferred.confidence, 72);
        record.inferred.level = "medium";
        record.inferred.reasons.push("floor suggested from a similar row");
      }
    });
    applyModelContext(records);
    return records;
  }

  return {
    detectDelimiter,
    parseCsv,
    stringifyCsv,
    normalizeHeader,
    findColumn,
    normalizeForParsing,
    extractFloor,
    extractDirection,
    inferDeviceType,
    matchDeviceTypeRule,
    inferModelNumber,
    cleanDescription,
    inferFields,
    applyModelContext,
    applyContext,
    placeholderScanNumbers,
    cleanupSpelling,
    titleCaseField
  };
});
