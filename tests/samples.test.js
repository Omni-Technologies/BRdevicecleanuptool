const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Parser = require("../parser.js");

const samples = ["tests/fixtures/buildingreports-sample.csv"];

for (const name of samples) {
  test(`preserves row count, column order, and AreaSuite values for ${name}`, () => {
    const filePath = path.join(__dirname, "..", name);
    const parsed = Parser.parseCsv(fs.readFileSync(filePath, "utf8"));
    const areaSuiteIndex = Parser.findColumn(parsed.headers, ["AreaSuite"]);
    assert.notEqual(areaSuiteIndex, -1);

    const before = parsed.rows.map((row) => row[areaSuiteIndex]);
    const roundTrip = Parser.parseCsv(Parser.stringifyCsv(parsed.headers, parsed.rows, parsed.delimiter));
    const after = roundTrip.rows.map((row) => row[areaSuiteIndex]);

    assert.deepEqual(roundTrip.headers, parsed.headers);
    assert.equal(roundTrip.rows.length, parsed.rows.length);
    assert.deepEqual(after, before);
  });
}
