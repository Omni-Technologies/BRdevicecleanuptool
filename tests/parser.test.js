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
