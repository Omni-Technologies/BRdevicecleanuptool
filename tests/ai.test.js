const test = require("node:test");
const assert = require("node:assert/strict");
const AI = require("../ai.js");

const ALL_FIELDS = AI.FIELDS.map((field) => field.key);

function row(index, areaSuite, extra) {
  return {
    index,
    deviceType: "Smoke Detector",
    manufacturer: "EST",
    modelNumber: "SIGA-OSD",
    description: "EXAMPLE CAMPUS\\NORTH\\3 NORTH Z20",
    areaSuite,
    floor: "",
    direction: "",
    location: "",
    zone: "",
    type: "",
    ...(extra || {})
  };
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

function chatReply(content, finishReason) {
  return jsonResponse(200, {
    choices: [{ message: { content: JSON.stringify(content) }, finish_reason: finishReason || "stop" }],
    usage: { prompt_tokens: 100, completion_tokens: 20 }
  });
}

function rowsFromRequest(init) {
  const body = JSON.parse(init.body);
  const user = body.messages[1].content;
  return user.split("\n").slice(2).map((line) => JSON.parse(line));
}

function isConventionsRequest(init) {
  return JSON.parse(init.body).messages[0].content.includes("\"descriptions\"");
}

test("validates batch output, normalizes floors, and rejects unknown ids", () => {
  const batch = AI.dedupeRows([row(0, "SMOKE 3 NORTH HALL BY ROOM 388"), row(1, "SMOKE 4 NORTH LOBBY")]);
  const content = JSON.stringify({
    rows: [
      { id: 1, DeviceType: "smoke detector", Floor: "3", Direction: "north", Location: "hall by room 388", Description: "Smoke Detector", confidence: "HIGH" },
      { id: 2, DeviceType: "Laser Cannon", Floor: "4th floor", Location: "Lobby", confidence: "unsure" },
      { id: 99, Floor: "9th Floor" }
    ]
  });
  const results = AI.parseBatchResponse(content, batch, { fields: ALL_FIELDS, allowedDeviceTypes: AI.KNOWN_DEVICE_TYPES });
  assert.equal(results.size, 2);
  assert.deepEqual(results.get(1).values, {
    deviceType: "Smoke Detector",
    floor: "3rd Floor",
    direction: "North",
    location: "Hall By Room 388",
    description: "Smoke Detector"
  });
  assert.equal(results.get(1).confidence, "high");
  assert.equal(results.get(2).values.floor, "4th Floor");
  assert.equal(Object.prototype.hasOwnProperty.call(results.get(2).values, "deviceType"), false);
  assert.equal(results.get(2).confidence, "medium");
});

test("accepts a zone only when the source text states it", () => {
  const batch = AI.dedupeRows([
    row(0, "SMOKE 3 NORTH LOBBY"),
    row(1, "13 PULL DOOR 17 SOUTH", { description: "EXAMPLE CAMPUS\\SECURITY OFFICE" })
  ]);
  const content = JSON.stringify({ rows: [{ id: 1, Zone: "20" }, { id: 2, Zone: "13" }] });
  const results = AI.parseBatchResponse(content, batch, { fields: ["zone"] });
  assert.equal(results.get(1).values.zone, "20");
  assert.equal(Object.prototype.hasOwnProperty.call(results.get(2).values, "zone"), false);
});

test("only returns enabled fields and never returns AreaSuite", () => {
  const batch = AI.dedupeRows([row(0, "SMOKE 3 NORTH LOBBY")]);
  const content = JSON.stringify({ rows: [{ id: 1, Floor: "3rd Floor", Location: "Lobby", AreaSuite: "CHANGED" }] });
  const results = AI.parseBatchResponse(content, batch, { fields: ["floor"] });
  assert.deepEqual(results.get(1).values, { floor: "3rd Floor" });
});

test("sends duplicate descriptions once and maps the answer to every matching row", async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push(init);
    if (isConventionsRequest(init)) return chatReply({ site: "Example", areas: ["North"] });
    const rows = rowsFromRequest(init);
    return chatReply({ rows: rows.map(([id]) => ({ id, Floor: "3rd Floor", Direction: "North", Location: "Lobby", confidence: "high" })) });
  };
  const rows = [row(0, "SMOKE 3 NORTH LOBBY"), row(1, "SMOKE 3 NORTH LOBBY"), row(2, "SMOKE 3 NORTH OFFICE")];
  const outcome = await AI.runAiFill({ apiKey: "test-key", rows, fetchImpl, retryDelays: [] });
  assert.equal(outcome.uniqueRows, 2);
  assert.equal(outcome.results.size, 3);
  assert.equal(outcome.results.get(1).values.location, "Lobby");
  assert.equal(outcome.failedRows, 0);
  assert.equal(requests.length, 2);
  const body = JSON.parse(requests[1].body);
  assert.equal(body.model, AI.DEFAULT_MODEL);
  assert.deepEqual(body.thinking, { type: "disabled" });
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.equal(requests[1].headers.Authorization, "Bearer test-key");
});

test("splits and retries a batch when the model skips rows", async () => {
  let rowCalls = 0;
  const fetchImpl = async (url, init) => {
    if (isConventionsRequest(init)) return chatReply({});
    rowCalls += 1;
    const rows = rowsFromRequest(init);
    const answered = rowCalls === 1 ? rows.slice(0, 3) : rows;
    return chatReply({ rows: answered.map(([id]) => ({ id, Floor: "1st Floor", confidence: "medium" })) });
  };
  const rows = Array.from({ length: 10 }, (_, index) => row(index, `SMOKE 1 NORTH ROOM ${100 + index}`));
  const outcome = await AI.runAiFill({ apiKey: "k", rows, fetchImpl, retryDelays: [] });
  assert.equal(outcome.results.size, 10);
  assert.equal(outcome.failedRows, 0);
  assert.ok(rowCalls >= 2);
});

test("stops immediately on a rejected API key", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse(401, { error: { message: "Authentication Fails" } });
  };
  await assert.rejects(
    AI.runAiFill({ apiKey: "bad", rows: [row(0, "SMOKE 3 NORTH LOBBY")], fetchImpl, retryDelays: [] }),
    /rejected the API key/
  );
  assert.equal(calls, 1);
});

test("retries rate-limited requests before succeeding", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return jsonResponse(429, { error: { message: "Too many requests" } });
    return chatReply({ rows: [] });
  };
  const reply = await AI.callDeepSeek({ apiKey: "k", messages: [], fetchImpl, retryDelays: [0] });
  assert.equal(calls, 2);
  assert.equal(reply.content, JSON.stringify({ rows: [] }));
});

test("accepts Type only from the file's values or the known list, and strips formula prefixes", () => {
  const batch = AI.dedupeRows([row(0, "TAMPER 3 NORTH STAIR B"), row(1, "SMOKE 3 NORTH LOBBY")]);
  const content = JSON.stringify({
    rows: [
      { id: 1, Type: "tamper", Location: "=HYPERLINK(\"x\")" },
      { id: 2, Type: "Very Important Detector", Location: "-Lobby" }
    ]
  });
  const results = AI.parseBatchResponse(content, batch, { fields: ["type", "location"], allowedTypes: ["Tamper", "Supervisory"] });
  assert.equal(results.get(1).values.type, "Tamper");
  assert.equal(results.get(1).values.location, "HYPERLINK(\"x\")");
  assert.equal(Object.prototype.hasOwnProperty.call(results.get(2).values, "type"), false);
  assert.equal(results.get(2).values.location, "Lobby");
});

test("a fatal error stops every worker instead of spending on the remaining batches", async () => {
  let rowCalls = 0;
  const fetchImpl = async (url, init) => {
    if (isConventionsRequest(init)) return chatReply({});
    rowCalls += 1;
    return jsonResponse(402, { error: { message: "Insufficient Balance" } });
  };
  const rows = Array.from({ length: 400 }, (_, index) => row(index, `SMOKE 1 NORTH ROOM ${1000 + index}`));
  await assert.rejects(
    AI.runAiFill({ apiKey: "k", rows, fetchImpl, retryDelays: [], batchSize: 10, concurrency: 3 }),
    /insufficient balance/
  );
  assert.ok(rowCalls <= 3, `expected at most one request per worker, saw ${rowCalls}`);
});

test("cancelling during a retry wait stops at once", async () => {
  const controller = new AbortController();
  const fetchImpl = async () => {
    controller.abort();
    return jsonResponse(503, { error: { message: "busy" } });
  };
  const started = Date.now();
  await assert.rejects(AI.callDeepSeek({ apiKey: "k", messages: [], fetchImpl, signal: controller.signal, retryDelays: [5000] }));
  assert.ok(Date.now() - started < 1000);
});

test("file profile lists DeviceTypes from the file plus known BuildingReports types", () => {
  const profile = AI.buildFileProfile([row(0, "SMOKE 3 NORTH LOBBY", { deviceType: "Custom Gadget" })]);
  assert.ok(profile.allowedDeviceTypes.includes("Custom Gadget"));
  assert.ok(profile.allowedDeviceTypes.includes("Pull Station"));
  assert.ok(profile.allowedDeviceTypes.includes("Tamper Switch"));
  assert.ok(profile.allowedDeviceTypes.includes("Damper Control"));
  assert.equal(profile.descriptionLabels[0][0], "EXAMPLE CAMPUS\\NORTH\\3 NORTH Z20");
});

test("accepts any known BuildingReports DeviceType the file does not already contain", () => {
  const batch = [{ id: 0, payload: [] }, { id: 1, payload: [] }];
  const content = JSON.stringify({ rows: [{ id: 0, DeviceType: "tamper switch" }, { id: 1, DeviceType: "Roll Down Door" }] });
  const profile = AI.buildFileProfile([row(0, "TAMPER 3 NORTH STAIR B", { deviceType: "Initiating Device" })]);
  const results = AI.parseBatchResponse(content, batch, { fields: ["deviceType"], allowedDeviceTypes: profile.allowedDeviceTypes });
  assert.equal(results.get(0).values.deviceType, "Tamper Switch");
  assert.equal(results.get(1).values.deviceType, "Roll Down Door");
});

test("rejects generic-to-generic DeviceType swaps and relays turned into detectors", () => {
  const batch = [
    { id: 0, payload: ["Initiating Device"] }, { id: 1, payload: ["Monitor Device"] },
    { id: 2, payload: ["Programmable Relay"] }, { id: 3, payload: ["Programmable Relay"] },
    { id: 4, payload: ["Non-Programmable Relay"] }
  ];
  const content = JSON.stringify({ rows: [
    { id: 0, DeviceType: "Monitor Device" }, { id: 1, DeviceType: "Monitor Device" },
    { id: 2, DeviceType: "Duct Detector" }, { id: 3, DeviceType: "Damper Control" },
    { id: 4, DeviceType: "Door Smoke Detector" }
  ] });
  const results = AI.parseBatchResponse(content, batch, { fields: ["deviceType"], allowedDeviceTypes: AI.KNOWN_DEVICE_TYPES });
  assert.equal(results.get(0).values.deviceType, undefined);
  assert.equal(results.get(1).values.deviceType, "Monitor Device");
  assert.equal(results.get(2).values.deviceType, undefined);
  assert.equal(results.get(3).values.deviceType, "Damper Control");
  assert.equal(results.get(4).values.deviceType, undefined);
});
