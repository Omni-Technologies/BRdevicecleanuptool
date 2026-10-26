const test = require("node:test");
const assert = require("node:assert/strict");
const Parser = require("../parser.js");

test("parses quoted CSV fields with commas, quotes, and embedded newlines", () => {
  const csv = '"AreaSuite","Floor"\r\n"BLDG 1,\nNORTH ""LAB""",""\r\n';
  const parsed = Parser.parseCsv(csv);
  assert.deepEqual(parsed.headers, ["AreaSuite", "Floor"]);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0][0], 'BLDG 1,\nNORTH "LAB"');
});

test("round trips all source text without changing AreaSuite", () => {
  const source = 'PULL DOOR 14A BLDG \r\n11 SOUTH';
  const csv = Parser.stringifyCsv(["AreaSuite", "Floor"], [[source, "2nd Floor"]]);
  const parsed = Parser.parseCsv(csv);
  assert.equal(parsed.rows[0][0], source);
  assert.equal(parsed.rows[0][1], "2nd Floor");
});

test("extracts common floor variations", () => {
  assert.equal(Parser.inferFields("PULL 2ND FLR BLDG 1", "Pull Station").floor, "2nd Floor");
  assert.equal(Parser.inferFields("POWER SUPPLY 3RDFL", "Power Supply").floor, "3rd Floor");
  assert.equal(Parser.inferFields("PULL ON STAIRS TO MEZZ IN BLDG 8", "Initiating Device").floor, "Mezzanine");
  assert.equal(Parser.inferFields("DUCT BLDG 3 ROOF AHU", "Duct Detector").floor, "Roof");
  assert.equal(Parser.inferFields("DUCT AHU RTU FLR 1 SUPPLY", "Duct Detector").floor, "1st Floor");
  assert.equal(Parser.inferFields("PULL LOWER OFFICE EXIT", "Pull Station").floor, "");
});

test("classifies representative BuildingReports descriptions", () => {
  assert.equal(Parser.inferFields("PULL DOOR 12 BLDG 12 FREEZER", "Initiating Device").classification, "Pull Station");
  assert.equal(Parser.inferFields("WATERFLOW 11 BLDG 14", "Initiating Device").classification, "Waterflow Switch");
  assert.equal(Parser.inferFields("TAMPER OUTSIDE PUMP HOUSE PIV1", "Initiating Device").classification, "Tamper Switch");
  assert.equal(Parser.inferFields("DUCT SMK BLDG 1 RTU-1 NORTH EAST SUPPLY", "Duct Detector").classification, "Duct Detector");
});

test("corrects DeviceType from strong source terminology", () => {
  assert.equal(Parser.inferDeviceType("PULL DOOR 12 BLDG 12", "Initiating Device"), "Pull Station");
  assert.equal(Parser.inferDeviceType("DUCT SMOKE BLDG 1 RTU", "Initiating Device"), "Duct Detector");
  assert.equal(Parser.inferDeviceType("SMOKE MAIN LOBBY", "Initiating Device"), "Smoke Detector");
  assert.equal(Parser.inferDeviceType("HEAT BOILER ROOM", "Initiating Device"), "Heat Detector");
  assert.equal(Parser.inferDeviceType("WATERFLOW BLDG 14", "Initiating Device"), "Waterflow Switch");
});

test("corrects generic monitor modules to the device the text names", () => {
  assert.equal(Parser.inferDeviceType("TAMPER BSMT NORTH ELEVATOR 3 PIT", "Initiating Device"), "Tamper Switch");
  assert.equal(Parser.inferDeviceType("TAMPER 2 EAST COMPUTER ROOM PREACTION", "Initiating Device"), "Tamper Switch");
  assert.equal(Parser.inferDeviceType("WATERFLOW 4 EAST LAB PREACTION", "Initiating Device"), "Waterflow Switch");
  assert.equal(Parser.inferDeviceType("WATEERFLOW CANOPY DRY SYSTEM", "Initiating Device"), "Waterflow Switch");
  assert.equal(Parser.inferDeviceType("WATERLFOW EAST PENTHOUSE", "Initiating Device"), "Waterflow Switch");
  assert.equal(Parser.inferDeviceType("1 SOUTH WATERFOW ACTIVE", "Initiating Device"), "Waterflow Switch");
  assert.equal(Parser.inferDeviceType("LOW AIR 1 NORTH DATA ROOM PRE ACTION", "Initiating Device"), "Air Pressure Switch");
  assert.equal(Parser.inferDeviceType("TROUBLE 5 EAST LAB PREACTION", "Initiating Device"), "Pre-Action System");
  assert.equal(Parser.inferDeviceType("BEAM SMK ATRIUM ABOVE PODS", "Initiating Device"), "Beam Detector");
  assert.equal(Parser.inferDeviceType("ANSUL 2 EAST CAFE KITCHEN", "Initiating Device"), "Kitchen Hood");
  assert.equal(Parser.inferDeviceType("SHUNT POWER NORTH PENT ELEV 2 EQUIP RM", "Initiating Device"), "Elevator");
  assert.equal(Parser.inferDeviceType("FIRE PUMP RUN WATER SERVICE RM 114", "Monitor Device"), "Fire Pump Running");
  assert.equal(Parser.inferDeviceType("HEAT BSMT NORTH ELEVATOR 3 PIT", "Initiating Device"), "Heat Detector");
});

test("corrects relays to the function they control and never to a detector", () => {
  assert.equal(Parser.inferDeviceType("DAMPER 5 EAST MECH RM AHU 5N1 SUPPLY", "Programmable Relay"), "Damper Control");
  assert.equal(Parser.inferDeviceType("AHU 2N01 RETURN SHUTDOWN MECH RM 2450", "Programmable Relay"), "Fan Shutdown");
  assert.equal(Parser.inferDeviceType("SOUTH PENT STAIR C PRESS FAN SHUTDWN", "Programmable Relay"), "Fan Shutdown");
  assert.equal(Parser.inferDeviceType("ELEV 2-3 ALT RECALL - PENT EQUIP RM", "Programmable Relay"), "Elevator");
  assert.equal(Parser.inferDeviceType("ELEV 17 HAT NORTH PENT ELEV 17 EQUIP RM", "Programmable Relay"), "Elevator");
  assert.equal(Parser.inferDeviceType("NORTH PENT AHU SHUTDOWN ELEV 17 EQUIP RM", "Programmable Relay"), "Fan Shutdown");
  assert.equal(Parser.inferDeviceType("SMOKE CURTAIN 3 NORTH ELEV 2 LOBBY", "Programmable Relay"), "Roll Down Door");
  assert.equal(Parser.inferDeviceType("ROLL DOOR 2 EAST GIFT SHOP", "Programmable Relay"), "Roll Down Door");
  assert.equal(Parser.inferDeviceType("AUTODOOR 10 EAST CLINIC ENTRANCE", "Programmable Relay"), "Releasing Device");
  assert.equal(Parser.inferDeviceType("PREACTION TRIP 2 EAST COMPUTER ROOM", "Programmable Relay"), "Pre-Action System");
  assert.equal(Parser.inferDeviceType("RELAY FOR WATERFLOW BELL", "Programmable Relay"), "Programmable Relay");
  assert.equal(Parser.inferDeviceType("VAV OR-1 SMOKE CONTROL RELAY", "Programmable Relay"), "Programmable Relay");
  assert.equal(Parser.inferDeviceType("DOOR UNLOCK 2 EAST EXIT TO PATIO", "Programmable Relay"), "Programmable Relay");
});

test("every DeviceType a rule produces is a BuildingReports Fire Alarm type", () => {
  const AI = require("../ai.js");
  const samples = [
    ["PULL LOBBY", "Initiating Device"], ["BEAM SMK ATRIUM", "Initiating Device"], ["DUCT AHU 1", "Initiating Device"],
    ["FIRE CURTAIN STAGE", "Programmable Relay"], ["SMOKE CURTAIN ELEV 2 LOBBY", "Programmable Relay"],
    ["SMOKE LOBBY", "Initiating Device"], ["HEAT BOILER ROOM", "Initiating Device"], ["WATERFLOW RISER 1", "Initiating Device"],
    ["TAMPER RISER 1", "Initiating Device"], ["LOW AIR DRY SYSTEM", "Initiating Device"], ["ANSUL KITCHEN", "Initiating Device"],
    ["FIRE PUMP RUNNING", "Initiating Device"], ["FIRE PUMP PHASE REVERSAL", "Initiating Device"],
    ["FIRE PUMP POWER FAIL", "Initiating Device"], ["FIRE PUMP TROUBLE", "Initiating Device"],
    ["POWER SUPPLY IDF", "Initiating Device"], ["PREACTION TRIP LAB", "Programmable Relay"],
    ["ELEV 1 MAIN RECALL", "Programmable Relay"], ["DAMPER AHU 1 SUPPLY", "Non-Programmable Relay"],
    ["AHU 1 SHUTDOWN", "Programmable Relay"], ["AUTODOOR CLINIC ENTRANCE", "Programmable Relay"],
    ["AMP 3 NORTH CH1", "Voice Evacuation"], ["PURGE MECH RM", "Programmable Relay"], ["STROBE PANEL 3 NORTH", "Initiating Device"]
  ];
  const produced = samples.map(([text, type]) => Parser.inferDeviceType(text, type));
  assert.equal(new Set(produced).size, samples.length);
  produced.forEach((value) => assert.ok(AI.KNOWN_DEVICE_TYPES.includes(value), value));
});

test("applies the house decisions for amplifiers, strobe panels, audio circuits, and purge relays", () => {
  assert.equal(Parser.inferDeviceType("AMP 5 EAST CH1 - 6 EAST HOUSEKEEPING", "Voice Evacuation"), "Amplifier");
  assert.equal(Parser.inferDeviceType("AA30 FINISH WHRS1", "Voice Evacuation"), "Amplifier");
  assert.equal(Parser.inferDeviceType("AMP PANELS TROUBLE -5 EAST MECH ROOM", "Initiating Device"), "Initiating Device");
  assert.equal(Parser.inferDeviceType("AMP ROOM HALL", "Smoke Detector"), "Smoke Detector");
  assert.equal(Parser.inferDeviceType("STROBE PANEL 6 NORTH IN NURSERY", "Initiating Device"), "Programmable Relay");
  assert.equal(Parser.inferDeviceType("OUTSIDE BELL BSMT EAST STROBE CONTROL", "Initiating Device"), "Programmable Relay");
  assert.equal(Parser.inferDeviceType("STROBE PANEL TROUBLE 2 EAST", "Initiating Device"), "Initiating Device");
  assert.equal(Parser.inferDeviceType("PURGE 5 EAST MECH RM FOR OR 2", "Programmable Relay"), "Fan Purge System");
  assert.equal(Parser.inferDeviceType("FIRE CURTAIN STAGE", "Programmable Relay"), "Fire Curtain");
  assert.deepEqual(Parser.matchDeviceTypeRule("AUDIO 1 EAST CKT 1-1 BY ELEV 2", "Initiating Device"), { value: "Initiating Device", matched: true });
  assert.deepEqual(Parser.matchDeviceTypeRule("DOOR UNLOCK 2 EAST EXIT", "Programmable Relay"), { value: "Programmable Relay", matched: false });
  assert.deepEqual(Parser.matchDeviceTypeRule("TAMPER STAIR B", "Initiating Device"), { value: "Tamper Switch", matched: true });
});

test("keeps detector hardware types away from relay function rules", () => {
  assert.equal(Parser.inferDeviceType("SMOKE ELEV LOBBY RECALL", "Smoke Detector"), "Smoke Detector");
  assert.equal(Parser.inferDeviceType("ELEV 4 LOBBY RECALL", "Smoke Detector"), "Smoke Detector");
  assert.equal(Parser.inferDeviceType("DAMPER ROOM HALL", "Heat Detector"), "Heat Detector");
  assert.equal(Parser.inferDeviceType("DUCT SMOKE ROOF AHU SUPPLY", "Smoke Detector"), "Duct Detector");
});

test("maps Pull Station to its known ModelNumber when the file has no stronger evidence", () => {
  const result = Parser.inferModelNumber("Pull Station", "Example", []);
  assert.equal(result.value, "SIGA-278");
  assert.equal(result.source, "known device mapping");
});

test("learns ModelNumber from correct matching DeviceType rows", () => {
  const records = [
    {
      deviceType: "Pull Station",
      manufacturer: "Example",
      original: { deviceType: "Pull Station", modelNumber: "SITE-PULL-1", manufacturer: "Example" },
      inferred: { deviceType: "Pull Station", reasons: [] }
    },
    {
      deviceType: "Pull Station",
      manufacturer: "Example",
      original: { deviceType: "Initiating Device", modelNumber: "", manufacturer: "Example" },
      inferred: { deviceType: "Pull Station", reasons: [] }
    }
  ];

  Parser.applyModelContext(records);
  assert.equal(records[1].inferred.modelNumber, "SITE-PULL-1");
  assert.equal(records[1].inferred.modelNumberSource, "manufacturer-device context");
});

test("does not use a generic ModelNumber when correct rows conflict", () => {
  const records = [
    {
      deviceType: "Pull Station",
      original: { deviceType: "Pull Station", modelNumber: "MODEL-A" },
      inferred: { deviceType: "Pull Station", reasons: [] }
    },
    {
      deviceType: "Pull Station",
      original: { deviceType: "Pull Station", modelNumber: "MODEL-B" },
      inferred: { deviceType: "Pull Station", reasons: [] }
    }
  ];

  const result = Parser.inferModelNumber("Pull Station", "", records);
  assert.equal(result.value, "");
  assert.equal(result.source, "conflicting context");
});

test("removes a company prefix from Description and normalizes the remainder", () => {
  assert.equal(Parser.cleanDescription("EXAMPLE COMPANY\\MAINTENANCE OFFICE"), "Maintenance Office");
  assert.equal(Parser.cleanDescription("EXAMPLE COMPANY\\SECURITY OFFICE"), "Security Office");
  assert.equal(Parser.cleanDescription("Photo/CO"), "Photo/CO");
});

test("can parse useful source text found in Description", () => {
  const description = Parser.cleanDescription("ACME\\2ND FLOOR SMOKE NORTH LOBBY");
  const result = Parser.inferFields(description, "Initiating Device");
  assert.equal(description, "2nd Floor Smoke North Lobby");
  assert.equal(result.deviceType, "Smoke Detector");
  assert.equal(result.floor, "2nd Floor");
  assert.equal(result.direction, "North");
  assert.equal(result.location, "Lobby");
});

test("follows the completed example by leaving inferred Description blank", () => {
  assert.equal(Parser.inferFields("PULL 1ST FLOOR RADIOLOGY EXIT TO MOBILEMRI", "Pull Station").description, "");
  assert.equal(
    Parser.inferFields("PULL 1ST FLOOR RADIOLOGY EXIT TO MOBILEMRI", "Pull Station").location,
    "Radiology Exit To Mobile MRI"
  );
});

test("fills blank ScanNumbers with sequential placeholders matching the file's digit width", () => {
  assert.deepEqual(
    Parser.placeholderScanNumbers(["4893460453", "", "4893462228", "  ", "4893455688"]),
    ["", "1000000001", "", "1000000002", ""]
  );
  assert.deepEqual(Parser.placeholderScanNumbers(["23288875", "", "23288876"]), ["", "10000001", ""]);
});

test("placeholder ScanNumbers skip values already in the file", () => {
  assert.deepEqual(
    Parser.placeholderScanNumbers(["1000000001", "", "1000000003", "", "B6322107", "4895715483"]),
    ["", "1000000002", "", "1000000004", "", ""]
  );
});

test("placeholder ScanNumbers default to 10 digits and leave complete files alone", () => {
  assert.deepEqual(Parser.placeholderScanNumbers(["", ""]), ["1000000001", "1000000002"]);
  assert.deepEqual(Parser.placeholderScanNumbers(["4893460453", "4893462228"]), ["", ""]);
});

test("cleans conservative spelling mistakes without changing the source", () => {
  const source = "PWR SPLY COMPRES BLDG 2A DRY INGEDIENTS AERA";
  const result = Parser.inferFields(source, "Power Supply");
  assert.equal(result.location, "Compressor Building 2A Dry Ingredients Area");
  assert.equal(source, "PWR SPLY COMPRES BLDG 2A DRY INGEDIENTS AERA");
});

test("retains useful context in Location", () => {
  const result = Parser.inferFields("10 PULL DOOR 46 BLDG 11 2ND FLOOR SOUTH", "Pull Station");
  assert.equal(result.floor, "2nd Floor");
  assert.equal(result.description, "");
  assert.equal(result.classification, "Pull Station");
  assert.match(result.location, /Door 46/i);
  assert.match(result.location, /Building 11/i);
  assert.equal(result.direction, "South");
});

test("separates compass abbreviations into Direction", () => {
  assert.equal(Parser.inferFields("PULL 2ND FLOOR BLDG 11 N/E STAIRS", "Pull Station").direction, "Northeast");
  assert.equal(Parser.inferFields("SMOKE LOWER LEVEL NORTH STAIR 2", "Smoke Detector").direction, "North");
  assert.equal(Parser.inferFields("DUCT BLDG 1 RTU-2 SW EXHAUST", "Duct Detector").direction, "Southwest");
});

test("supports parking levels and prioritizes named floors", () => {
  assert.equal(Parser.inferFields("2 P LEVEL SMOKE DET. ELEVATOR LOBBY", "Smoke Detector").floor, "2P");
  assert.equal(Parser.inferFields("PULL LEVEL 5 PENTHOUSE", "Pull Station").floor, "Penthouse");
});

test("splits a broad area from its precise location", () => {
  const result = Parser.inferFields("5TH FLOOR SMOKE DET. CORRIDOR BY RM 518", "Smoke Detector");
  assert.equal(result.direction, "Corridor");
  assert.equal(result.location, "By Room 518");
});

test("borrows a floor only from a strongly matching row of the same device type", () => {
  const records = [
    {
      deviceType: "Pull Station",
      inferred: Parser.inferFields("PULL 1ST FLOOR HALL NORTH STAIRS EXIT", "Pull Station")
    },
    {
      deviceType: "Pull Station",
      inferred: Parser.inferFields("PULL HALL NORTH STAIRS EXIT", "Pull Station")
    },
    {
      deviceType: "Smoke Detector",
      inferred: Parser.inferFields("SMOKE HALL NORTH STAIRS EXIT", "Smoke Detector")
    }
  ];
  Parser.applyContext(records);
  assert.equal(records[1].inferred.floor, "1st Floor");
  assert.equal(records[1].inferred.floorSource, "context");
  assert.equal(records[2].inferred.floor, "");
});

test("learns a floor from matching room numbers elsewhere in the file", () => {
  const records = [
    {
      areaSuite: "1ST FLOOR SMOKE DET. SERVICE ROOM 114",
      deviceType: "Smoke Detector",
      inferred: Parser.inferFields("1ST FLOOR SMOKE DET. SERVICE ROOM 114", "Smoke Detector")
    },
    {
      areaSuite: "FIRE PUMP POWER FAIL WATER SERVICE RM114",
      deviceType: "Monitor Device",
      inferred: Parser.inferFields("FIRE PUMP POWER FAIL WATER SERVICE RM114", "Monitor Device")
    }
  ];
  Parser.applyContext(records);
  assert.equal(records[1].inferred.floor, "1st Floor");
  assert.equal(records[1].inferred.floorSource, "context");
});
